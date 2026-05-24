-- Pending Bookings Table for DSCR Authority Scheduling
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS pending_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  service_id TEXT NOT NULL,
  team_member_id TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  notes TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  duration_override INTEGER,
  meeting_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,

  -- Index for fast token lookups
  CONSTRAINT pending_bookings_token_idx UNIQUE (token)
);

-- Index for finding pending bookings by email (for rate limiting)
CREATE INDEX IF NOT EXISTS pending_bookings_email_status_idx
ON pending_bookings (guest_email, status);

-- Index for cleanup of expired bookings
CREATE INDEX IF NOT EXISTS pending_bookings_expires_at_idx
ON pending_bookings (expires_at)
WHERE status = 'pending';

-- Row Level Security (optional but recommended)
ALTER TABLE pending_bookings ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access" ON pending_bookings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE pending_bookings IS 'Stores booking requests that require email confirmation before being added to calendars';

-- Form Leads Table for DSCR Authority lead capture
CREATE TABLE IF NOT EXISTS form_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  property_value NUMERIC NOT NULL,
  loan_amount NUMERIC NOT NULL,
  monthly_rent NUMERIC NOT NULL,
  fico INTEGER NOT NULL,
  state TEXT NOT NULL,
  purpose TEXT NOT NULL,
  property_type TEXT NOT NULL,
  timeline TEXT NOT NULL,
  source_page TEXT,
  source_context TEXT,
  assigned_officer_id TEXT NOT NULL,
  assigned_officer_name TEXT NOT NULL,
  assigned_officer_email TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS form_leads_email_idx ON form_leads (email);
CREATE INDEX IF NOT EXISTS form_leads_created_at_idx ON form_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS form_leads_assigned_officer_idx ON form_leads (assigned_officer_id);

ALTER TABLE form_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access on form_leads" ON form_leads
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE form_leads IS 'Lead-form submissions from /api/lead for CRM follow-up';
