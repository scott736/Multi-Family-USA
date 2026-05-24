/**
 * Nylas Grant Management via Supabase
 * Stores and retrieves Nylas grant IDs from Supabase instead of hardcoded config.
 * Config.ts grants serve as fallback if Supabase is unreachable.
 */

import { getServerSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { TeamMember, NylasGrantConfig } from './types';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface StoredGrant {
  id: string;
  team_member_id: string;
  grant_id: string;
  provider: 'google' | 'microsoft';
  email: string;
  is_primary: boolean;
  status: 'active' | 'expired' | 'revoked';
  connected_at: string;
  updated_at: string;
}

// ============================================================================
// CRUD Functions
// ============================================================================

/**
 * Save a grant to Supabase after OAuth exchange.
 * Upserts on grant_id — re-authenticating updates the existing row.
 * First active grant for a team member is automatically marked primary.
 */
export async function saveGrant(params: {
  teamMemberId: string;
  grantId: string;
  provider: 'google' | 'microsoft';
  email: string;
}): Promise<StoredGrant> {
  const supabase = getServerSupabase();

  // Check if this team member already has active grants
  const { data: existing } = await supabase
    .from('nylas_grants')
    .select('id')
    .eq('team_member_id', params.teamMemberId)
    .eq('status', 'active');

  const isPrimary = !existing || existing.length === 0;

  const { data, error } = await supabase
    .from('nylas_grants')
    .upsert(
      {
        team_member_id: params.teamMemberId,
        grant_id: params.grantId,
        provider: params.provider,
        email: params.email,
        is_primary: isPrimary,
        status: 'active',
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'grant_id' }
    )
    .select()
    .single();

  if (error) {
    logger.error('Error saving grant:', error);
    throw new Error('Failed to save grant');
  }

  invalidateGrantCache(params.teamMemberId);
  logger.info(
    `Grant saved: ${params.grantId} for ${params.teamMemberId} (primary: ${isPrimary})`
  );
  return data as StoredGrant;
}

/**
 * Get all active grants for a team member.
 */
export async function getGrantsByTeamMember(teamMemberId: string): Promise<StoredGrant[]> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('nylas_grants')
    .select('*')
    .eq('team_member_id', teamMemberId)
    .eq('status', 'active')
    .order('is_primary', { ascending: false });

  if (error) {
    logger.error(`Error fetching grants for ${teamMemberId}:`, error);
    return [];
  }

  return (data || []) as StoredGrant[];
}

/**
 * Get all grants across all team members (for admin page).
 */
export async function getAllGrants(): Promise<StoredGrant[]> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('nylas_grants')
    .select('*')
    .order('connected_at', { ascending: false });

  if (error) {
    logger.error('Error fetching all grants:', error);
    return [];
  }

  return (data || []) as StoredGrant[];
}

/**
 * Mark a grant as expired or revoked (e.g., from webhook).
 */
export async function deactivateGrant(
  grantId: string,
  reason: 'expired' | 'revoked'
): Promise<void> {
  const supabase = getServerSupabase();

  const { error } = await supabase
    .from('nylas_grants')
    .update({ status: reason, updated_at: new Date().toISOString() })
    .eq('grant_id', grantId);

  if (error) {
    logger.error(`Error deactivating grant ${grantId}:`, error);
    throw new Error('Failed to deactivate grant');
  }

  invalidateGrantCache(); // Clear all — we don't know the team member from grantId alone
  logger.warn(`Grant ${grantId} marked as ${reason}`);
}

/**
 * Delete a grant entirely (admin action).
 */
export async function deleteGrant(grantId: string): Promise<void> {
  const supabase = getServerSupabase();

  const { error } = await supabase.from('nylas_grants').delete().eq('grant_id', grantId);

  if (error) {
    logger.error(`Error deleting grant ${grantId}:`, error);
    throw new Error('Failed to delete grant');
  }

  invalidateGrantCache(); // Clear all — we don't know the team member from grantId alone
  logger.info(`Grant ${grantId} deleted`);
}

// ============================================================================
// Grant Cache (Redis-backed via Upstash, avoids Supabase round-trip)
// ============================================================================

const GRANT_CACHE_TTL = 300; // 5 minutes (seconds for Redis)

let _redisGrantClient: Promise<InstanceType<typeof import('@upstash/redis').Redis> | null> | null = null;

function getRedisGrantClient() {
  if (_redisGrantClient) return _redisGrantClient;
  const url = import.meta.env.UPSTASH_REDIS_REST_URL
    || (typeof process !== 'undefined' ? process.env.UPSTASH_REDIS_REST_URL : undefined);
  const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN
    || (typeof process !== 'undefined' ? process.env.UPSTASH_REDIS_REST_TOKEN : undefined);
  if (!url || !token) {
    _redisGrantClient = Promise.resolve(null);
    return _redisGrantClient;
  }
  _redisGrantClient = import('@upstash/redis')
    .then(({ Redis }) => new Redis({ url, token }))
    .catch(() => null);
  return _redisGrantClient;
}

// In-memory fallback when Redis is unavailable
const inMemoryGrantCache = new Map<string, { grants: StoredGrant[]; expiresAt: number }>();

async function getCachedGrants(teamMemberId: string): Promise<StoredGrant[]> {
  const cacheKey = `nylas-grant:${teamMemberId}`;

  // Try Redis first
  try {
    const redis = await getRedisGrantClient();
    if (redis) {
      const cached = await redis.get<StoredGrant[]>(cacheKey);
      if (cached) return cached;

      const grants = await getGrantsByTeamMember(teamMemberId);
      await redis.set(cacheKey, grants, { ex: GRANT_CACHE_TTL }).catch(() => {});
      return grants;
    }
  } catch {
    // Fall through to in-memory
  }

  // In-memory fallback
  const cached = inMemoryGrantCache.get(teamMemberId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.grants;
  }
  const grants = await getGrantsByTeamMember(teamMemberId);
  inMemoryGrantCache.set(teamMemberId, { grants, expiresAt: Date.now() + GRANT_CACHE_TTL * 1000 });
  return grants;
}

/**
 * Invalidate grant cache for a team member (call after OAuth or grant changes)
 */
export function invalidateGrantCache(teamMemberId?: string): void {
  if (teamMemberId) {
    inMemoryGrantCache.delete(teamMemberId);
    // Also remove from Redis (fire-and-forget)
    getRedisGrantClient()
      .then((redis) => { if (redis) redis.del(`nylas-grant:${teamMemberId}`).catch(() => {}); })
      .catch(() => {});
  } else {
    inMemoryGrantCache.clear();
    // Clear all grant keys from Redis (fire-and-forget)
    getRedisGrantClient()
      .then(async (redis) => {
        if (!redis) return;
        const keys = await redis.keys('nylas-grant:*').catch(() => [] as string[]);
        if (keys.length > 0) await redis.del(...keys).catch(() => {});
      })
      .catch(() => {});
  }
}

// ============================================================================
// Enrichment Functions
// ============================================================================

/**
 * Enrich a TeamMember with grants from Supabase.
 * Supabase grants replace config grants when found.
 * Falls back to config grants on Supabase error.
 */
export async function enrichTeamMember(member: TeamMember): Promise<TeamMember> {
  if (!isSupabaseConfigured()) {
    return member;
  }
  try {
    const grants = await getCachedGrants(member.id);

    if (grants.length === 0) {
      return member;
    }

    const nylasGrants: NylasGrantConfig[] = grants.map((g) => ({
      grantId: g.grant_id,
      provider: g.provider,
      email: g.email,
      isPrimary: g.is_primary,
    }));

    return {
      ...member,
      nylasGrants,
      nylasGrantId: nylasGrants.find((g) => g.isPrimary)?.grantId ?? nylasGrants[0]?.grantId,
    };
  } catch (error) {
    logger.error(`Failed to enrich team member ${member.id} with Supabase grants:`, error);
    return member;
  }
}

/**
 * Enrich multiple team members in parallel.
 */
export async function enrichTeamMembers(members: TeamMember[]): Promise<TeamMember[]> {
  return Promise.all(members.map(enrichTeamMember));
}
