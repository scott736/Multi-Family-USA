import { teamMembers } from '@/lib/nylas/config';
import type { TeamMember } from '@/lib/nylas/types';

const GRANT_ENV_BY_MEMBER: Record<string, string> = {
  scott: 'NYLAS_GRANT_SCOTT',
  aya: 'NYLAS_GRANT_AYA',
};

function readEnv(name: string): string | undefined {
  const value =
    (import.meta.env[name] as string | undefined) ||
    (typeof process !== 'undefined' ? process.env[name] : undefined);
  return value?.trim() || undefined;
}

export function getTeamMemberById(id: string): TeamMember | undefined {
  return teamMembers.find((member) => member.id === id);
}

export function getGrantIdForTeamMember(memberId: string): string | undefined {
  const member = getTeamMemberById(memberId);
  if (!member) return undefined;

  const envKey = GRANT_ENV_BY_MEMBER[memberId];
  if (envKey) {
    const envGrant = readEnv(envKey);
    if (envGrant) return envGrant;
  }

  if (member.nylasGrantId) return member.nylasGrantId;

  const primaryGrant = member.nylasGrants?.find((grant) => grant.isPrimary) ?? member.nylasGrants?.[0];
  return primaryGrant?.grantId;
}

export function hasCalendarGrant(memberId: string): boolean {
  return !!getGrantIdForTeamMember(memberId);
}
