import { LEAD_INBOX } from '@/consts';

/** Scott + Aya — deduplicated with any extra recipients (e.g. assigned LO). */
export function leadNotificationRecipients(
  ...additional: (string | undefined | null)[]
): string[] {
  return [...additional, ...LEAD_INBOX]
    .filter((email): email is string => Boolean(email))
    .filter(
      (email, index, arr) =>
        arr.findIndex((e) => e.toLowerCase() === email.toLowerCase()) === index,
    );
}

/** CC list for lead emails where someone else is the primary To. */
export function leadOversightCc(...exclude: (string | undefined | null)[]): string[] {
  const excluded = new Set(
    exclude.filter(Boolean).map((email) => email!.toLowerCase()),
  );
  return LEAD_INBOX.filter((email) => !excluded.has(email.toLowerCase()));
}
