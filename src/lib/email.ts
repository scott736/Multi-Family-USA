import { sendElasticEmail } from '@/lib/elastic-email';

interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  scheduledAt?: string;
}

export async function sendEmail(options: SendEmailOptions) {
  const cc = options.cc === undefined
    ? undefined
    : Array.isArray(options.cc) ? options.cc : [options.cc];

  return sendElasticEmail({
    to: options.to,
    cc,
    subject: options.subject,
    html: options.html,
    text: options.text,
    from: options.from,
    replyTo: options.replyTo,
    scheduledAt: options.scheduledAt,
  });
}

export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
