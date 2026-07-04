import { logger } from '@/lib/logger';
import { getServerSupabase, isSupabaseConfigured } from '@/lib/supabase';

export interface ChecklistLeadRecord {
  email: string;
  checklistId: string;
  checklistTitle?: string;
  lang: 'en' | 'es';
  sourcePage?: string;
}

export async function persistChecklistLead(lead: ChecklistLeadRecord): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    const supabase = getServerSupabase();

    const { error } = await supabase.from('checklist_leads').insert({
      email: lead.email.toLowerCase().trim(),
      checklist_id: lead.checklistId,
      checklist_title: lead.checklistTitle ?? null,
      lang: lead.lang,
      source_page: lead.sourcePage ?? null,
    });

    if (error) {
      logger.error('Failed to persist checklist lead to Supabase', error);
    }
  } catch (err) {
    logger.error('Supabase checklist lead persistence unavailable', err);
  }
}
