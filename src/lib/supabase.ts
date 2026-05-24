import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;

export function getClientSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase client configuration missing');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export function getServerSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase server configuration missing');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export function isSupabaseConfigured() {
  return !!SUPABASE_URL && (!!SUPABASE_ANON_KEY || !!SUPABASE_SERVICE_KEY);
}
