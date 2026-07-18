import { createClient } from '@supabase/supabase-js';

function readEnv(name: string): string | undefined {
  const fromImportMeta =
    typeof import.meta !== 'undefined' ? import.meta.env?.[name] : undefined;
  const fromProcess =
    typeof process !== 'undefined' ? process.env[name] : undefined;
  return fromImportMeta || fromProcess;
}

export function getServerSupabase() {
  const url = readEnv('PUBLIC_SUPABASE_URL');
  const serviceKey = readEnv('SUPABASE_SERVICE_KEY');
  if (!url || !serviceKey) {
    throw new Error('Supabase server configuration missing');
  }
  return createClient(url, serviceKey);
}

export function isSupabaseConfigured() {
  const url = readEnv('PUBLIC_SUPABASE_URL');
  return (
    !!url &&
    (!!readEnv('PUBLIC_SUPABASE_ANON_KEY') || !!readEnv('SUPABASE_SERVICE_KEY'))
  );
}
