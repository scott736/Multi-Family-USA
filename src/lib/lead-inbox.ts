import { LEAD_INBOX } from '@/consts';

/** Scott + Aya — deduplicated with any extra recipients (e.g. assigned LO). */
function leadNotificationRecipients(
  ...additional: (string | undefined | null)[]
): string[] {
  const recipients: string[] = [];
  const seen = new Set<string>();
  for (const email of [...additional, ...LEAD_INBOX]) {
    if (!email) continue;
    const normalized = email.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    recipients.push(email);
  }
  return recipients;
}

/** CC list for lead emails where someone else is the primary To. */
export function leadOversightCc(...exclude: (string | undefined | null)[]): string[] {
  const excluded = new Set<string>();
  for (const email of exclude) {
    if (!email) continue;
    excluded.add(email.toLowerCase());
  }
  return LEAD_INBOX.filter((email) => !excluded.has(email.toLowerCase()));
}
