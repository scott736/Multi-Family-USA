import { logger } from '@/lib/logger';
import { getServerSupabase, isSupabaseConfigured } from '@/lib/supabase';

export interface AnalysisEmailRecord {
  email: string;
  analysisType: string;
  analysisSummary: Record<string, string | number>;
  lang: 'en' | 'es';
  sourcePage?: string;
}

export async function persistAnalysisEmail(record: AnalysisEmailRecord): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    const supabase = getServerSupabase();

    const { error } = await supabase.from('analysis_emails').insert({
      email: record.email.toLowerCase().trim(),
      analysis_type: record.analysisType,
      analysis_summary: record.analysisSummary,
      lang: record.lang,
      source_page: record.sourcePage ?? null,
    });

    if (error) {
      logger.error('Failed to persist analysis email to Supabase', error);
    }
  } catch (err) {
    logger.error('Supabase analysis email persistence unavailable', err);
  }
}
