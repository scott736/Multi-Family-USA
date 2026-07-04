import { logger } from '@/lib/logger';
import type { TeamMember } from '@/lib/nylas/types';
import { getServerSupabase, isSupabaseConfigured } from '@/lib/supabase';

export interface FormLeadRecord {
  name: string;
  email: string;
  phone: string;
  propertyValue: number;
  loanAmount: number;
  monthlyRent: number;
  fico: number;
  state: string;
  purpose: string;
  propertyType: string;
  timeline: string;
  sourcePage?: string;
  sourceContext?: string;
  score?: number;
  scoreTier?: string;
  metadata?: Record<string, unknown>;
}

export interface PersistFormLeadOptions {
  isPartial?: boolean;
  lang?: 'en' | 'es';
}

export async function persistFormLead(
  lead: FormLeadRecord,
  assignedTo: TeamMember,
  options?: PersistFormLeadOptions,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    const supabase = getServerSupabase();

    const payload: Record<string, unknown> = {
      name: lead.name,
      email: lead.email.toLowerCase().trim(),
      phone: lead.phone,
      property_value: lead.propertyValue,
      loan_amount: lead.loanAmount,
      monthly_rent: lead.monthlyRent,
      fico: lead.fico,
      state: lead.state,
      purpose: lead.purpose,
      property_type: lead.propertyType,
      timeline: lead.timeline,
      source_page: lead.sourcePage ?? null,
      source_context: lead.sourceContext ?? null,
      assigned_officer_id: assignedTo.id,
      assigned_officer_name: assignedTo.name,
      assigned_officer_email: assignedTo.email,
      lang: options?.lang ?? 'en',
    };

    if (lead.score !== undefined) payload.lead_score = lead.score;
    if (lead.scoreTier) payload.lead_score_tier = lead.scoreTier;

    const metadata = {
      ...(lead.metadata ?? {}),
      ...(options?.isPartial ? { isPartial: true } : {}),
    };
    if (Object.keys(metadata).length > 0) payload.metadata = metadata;

    const { error } = await supabase.from('form_leads').insert(payload);

    if (error) {
      logger.error('Failed to persist form lead to Supabase', error);
    }
  } catch (err) {
    logger.error('Supabase form lead persistence unavailable', err);
  }
}
