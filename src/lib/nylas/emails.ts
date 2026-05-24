/**
 * Booking Email Templates
 * Email notifications for the scheduling system
 */

import { sendEmail, escapeHtml } from '@/lib/email';
import { LEAD_INBOX } from '@/consts';
import { logger } from '@/lib/logger';

// Brand colors — Multi-Family USA
const BRAND_COLOR = '#0F2544'; // Deep navy
const BRAND_COLOR_DARK = '#0A1B33'; // Darker navy for buttons/links
const BRAND_COLOR_LIGHT = '#F5B800'; // Amber accent

// Logo URL (must be absolute for emails)
// Note: Using PNG for email compatibility (WebP not widely supported in email clients)
const LOGO_URL = 'https://multifamily-usa.com/images/layout/logo.png';

// Scott and Aya get Cc'd on booking confirmation emails (pre- and post-confirm)
// and the internal LO notification.
const BOOKING_OVERSIGHT_CC = [...LEAD_INBOX];

function bookingOversightCcExcluding(...exclude: string[]): string[] {
  const excluded = new Set(exclude.filter(Boolean).map((e) => e.toLowerCase()));
  return BOOKING_OVERSIGHT_CC.filter((email) => !excluded.has(email.toLowerCase()));
}

interface BookingConfirmationEmailParams {
  to: string;
  guestName: string;
  serviceName: string;
  serviceDuration: number;
  teamMemberName: string;
  startTime: Date;
  timezone: string;
  confirmUrl: string;
  expiresAt: Date;
}

/**
 * Send booking confirmation email (requires user to click to confirm)
 */
export async function sendBookingConfirmationEmail(params: BookingConfirmationEmailParams) {
  const {
    to,
    guestName,
    serviceName,
    serviceDuration,
    teamMemberName,
    startTime,
    timezone,
    confirmUrl,
    expiresAt,
  } = params;

  const formattedDate = startTime.toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });

  const formattedTime = startTime.toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });

  const expiresFormatted = expiresAt.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });

  // Use team member name in subject
  const subject = `Confirm Your ${serviceName} with ${teamMemberName}`;
  const ccList = bookingOversightCcExcluding(to);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Logo -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; background-color: #ffffff;">
              <a href="https://multifamily-usa.com" style="display: inline-block;">
                <img src="${LOGO_URL}" alt="Multi-Family USA" width="160" style="max-width: 160px; height: auto;" />
              </a>
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background-color: ${BRAND_COLOR}; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Confirm Your Booking
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">
                Hi ${escapeHtml(guestName)},
              </p>

              <p style="margin: 0 0 24px; font-size: 16px; color: #374151;">
                Thank you for scheduling a <strong>${escapeHtml(serviceName)}</strong> with ${escapeHtml(teamMemberName)}.
                Please confirm your booking by clicking the button below.
              </p>

              <!-- Booking Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                      Booking Details
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Service</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                          <span style="color: #111827; font-size: 14px; font-weight: 500;">${serviceName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Duration</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                          <span style="color: #111827; font-size: 14px; font-weight: 500;">${serviceDuration} minutes</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">With</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                          <span style="color: #111827; font-size: 14px; font-weight: 500;">${teamMemberName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Date</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                          <span style="color: #111827; font-size: 14px; font-weight: 500;">${formattedDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Time</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="color: #111827; font-size: 14px; font-weight: 500;">${formattedTime} (${timezone})</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${confirmUrl}" style="display: inline-block; background-color: ${BRAND_COLOR_DARK}; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                      Confirm My Booking
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; font-size: 14px; color: #92400e;">
                      <strong>Important:</strong> This confirmation link expires on ${expiresFormatted}.
                      If you don't confirm by then, you'll need to book again.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280;">
                If you didn't request this booking, you can safely ignore this email.
              </p>

              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${confirmUrl}" style="color: ${BRAND_COLOR_DARK}; word-break: break-all;">${confirmUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                ${teamMemberName}
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Multi-Family USA
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Hi ${guestName},

Thank you for scheduling a ${serviceName} with ${teamMemberName}.

BOOKING DETAILS:
- Service: ${serviceName}
- Duration: ${serviceDuration} minutes
- With: ${teamMemberName}
- Date: ${formattedDate}
- Time: ${formattedTime} (${timezone})

Please confirm your booking by visiting:
${confirmUrl}

IMPORTANT: This confirmation link expires on ${expiresFormatted}.
If you don't confirm by then, you'll need to book again.

If you didn't request this booking, you can safely ignore this email.

---
${teamMemberName}
Multi-Family USA
  `.trim();

  await sendEmail({
    to,
    cc: ccList,
    subject,
    html,
    text,
  });
}

interface BookingConfirmedEmailParams {
  to: string;
  guestName: string;
  serviceName: string;
  serviceDuration: number;
  teamMemberName: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  meetingLink?: string;
  calendarLinks: {
    google: string;
    outlook: string;
    ical: string;
  };
  /** Token for cancel/reschedule self-service links */
  token?: string;
}

/**
 * Send email after booking is confirmed (with calendar invite details)
 */
export async function sendBookingConfirmedEmail(params: BookingConfirmedEmailParams) {
  const {
    to,
    guestName,
    serviceName,
    serviceDuration,
    teamMemberName,
    startTime,
    timezone,
    meetingLink,
    calendarLinks,
    token,
  } = params;

  const formattedDate = startTime.toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });

  const formattedTime = startTime.toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });

  const subject = `Confirmed: ${serviceName} with ${teamMemberName}`;
  const ccList = bookingOversightCcExcluding(to);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Logo -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; background-color: #ffffff;">
              <a href="https://multifamily-usa.com" style="display: inline-block;">
                <img src="${LOGO_URL}" alt="Multi-Family USA" width="160" style="max-width: 160px; height: auto;" />
              </a>
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background-color: #059669; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Booking Confirmed!
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">
                Hi ${escapeHtml(guestName)},
              </p>

              <p style="margin: 0 0 24px; font-size: 16px; color: #374151;">
                Your <strong>${escapeHtml(serviceName)}</strong> with ${escapeHtml(teamMemberName)} is confirmed!
                Use the buttons below to add this meeting to your calendar.
              </p>

              <!-- Booking Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; margin-bottom: 24px; border: 1px solid #bbf7d0;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #166534; font-size: 14px;">📅 ${formattedDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #166534; font-size: 14px;">🕐 ${formattedTime} (${serviceDuration} min)</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #166534; font-size: 14px;">👤 ${teamMemberName}</span>
                        </td>
                      </tr>
                      ${meetingLink ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #166534; font-size: 14px;">🔗 <a href="${meetingLink}" style="color: #059669;">Join Video Call</a></span>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Add to Calendar - Made Prominent -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; margin-bottom: 24px; border: 1px solid #bfdbfe;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #1e40af;">
                      Add to Your Calendar
                    </p>
                    <p style="margin: 0 0 16px; font-size: 13px; color: #3b82f6;">
                      Click a button below to add this meeting to your calendar
                    </p>
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding-right: 8px; width: 33%;">
                          <a href="${calendarLinks.google}" style="display: block; background-color: #4285f4; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 12px 8px; border-radius: 6px; text-align: center;">
                            Google
                          </a>
                        </td>
                        <td style="padding-right: 8px; width: 33%;">
                          <a href="${calendarLinks.outlook}" style="display: block; background-color: #0078d4; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 12px 8px; border-radius: 6px; text-align: center;">
                            Outlook
                          </a>
                        </td>
                        <td style="width: 33%;">
                          <a href="${calendarLinks.ical}" style="display: block; background-color: #374151; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 12px 8px; border-radius: 6px; text-align: center;">
                            Apple/iCal
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${token ? `
              <!-- Manage Booking -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #374151;">
                      Need to make changes?
                    </p>
                    <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280;">
                      You can reschedule or cancel your appointment at any time.
                    </p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right: 8px;">
                          <a href="https://multifamily-usa.com/book/reschedule?token=${encodeURIComponent(token)}" style="display: inline-block; background-color: ${BRAND_COLOR_DARK}; color: #ffffff; font-size: 13px; font-weight: 500; text-decoration: none; padding: 10px 20px; border-radius: 6px;">
                            Reschedule
                          </a>
                        </td>
                        <td>
                          <a href="https://multifamily-usa.com/book/cancel?token=${encodeURIComponent(token)}" style="display: inline-block; background-color: #ffffff; color: #374151; font-size: 13px; font-weight: 500; text-decoration: none; padding: 10px 20px; border-radius: 6px; border: 1px solid #d1d5db;">
                            Cancel
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : `
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                Need to reschedule or cancel? Reply to this email and we'll help you out.
              </p>
              `}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                ${teamMemberName}
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Multi-Family USA
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Hi ${guestName},

Your ${serviceName} with ${teamMemberName} is confirmed!

BOOKING DETAILS:
- Date: ${formattedDate}
- Time: ${formattedTime} (${serviceDuration} min)
- With: ${teamMemberName}
${meetingLink ? `- Video Call: ${meetingLink}` : ''}

ADD TO YOUR CALENDAR:
Use one of these links to add this meeting to your calendar:
- Google Calendar: ${calendarLinks.google}
- Outlook: ${calendarLinks.outlook}
- Apple/iCal: ${calendarLinks.ical}

${token ? `NEED TO MAKE CHANGES?
- Reschedule: https://multifamily-usa.com/book/reschedule?token=${encodeURIComponent(token)}
- Cancel: https://multifamily-usa.com/book/cancel?token=${encodeURIComponent(token)}` : `Need to reschedule or cancel? Reply to this email and we'll help you out.`}

---
${teamMemberName}
Multi-Family USA
  `.trim();

  await sendEmail({
    to,
    cc: ccList,
    subject,
    html,
    text,
  });
}

// ============================================================================
// Post-Booking Welcome Series (3 emails, deferred via Elastic Email TimeOffset)
// ============================================================================

interface WelcomeSeriesParams {
  to: string;
  guestName: string;
  teamMemberName: string;
  serviceName: string;
  serviceDuration: number;
  startTime: Date;
  timezone: string;
  meetingLink?: string;
}

/**
 * Schedule the 3-email post-booking welcome series.
 * Uses Elastic Email's Options.TimeOffset (minutes-in-the-future, max 35 days)
 * to defer each send at the provider level.
 *
 * Email 1: "What to have ready" — sent 1 hour after booking confirmation
 * Email 2: "How we've helped investors like you" — sent 24 hours after (skipped if call is within 24h)
 * Email 3: "Your call is in 1 hour" — sent 1 hour before the call
 *
 * Returns the provider MessageIDs for potential cancellation/tracking.
 */
export async function scheduleWelcomeSeries(params: WelcomeSeriesParams): Promise<{ emailIds: string[] }> {
  const { to, guestName, teamMemberName, startTime, timezone } = params;
  const emailIds: string[] = [];

  const now = new Date();
  const callTime = new Date(startTime);
  const hoursUntilCall = (callTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Email 1: 1 hour after now
  const email1Time = new Date(now.getTime() + 60 * 60 * 1000);
  // Only send if at least 2 hours before call (so it arrives before the reminder)
  if (hoursUntilCall > 2) {
    try {
      const result = await sendWelcomeEmail1({
        ...params,
        scheduledAt: email1Time.toISOString(),
      });
      if (result?.id) emailIds.push(result.id);
    } catch (err) {
      logger.error('Welcome series email 1 scheduling failed:', err);
    }
  }

  // Email 2: 24 hours after now (skip if call is within 24 hours)
  if (hoursUntilCall > 26) {
    const email2Time = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    try {
      const result = await sendWelcomeEmail2({
        ...params,
        scheduledAt: email2Time.toISOString(),
      });
      if (result?.id) emailIds.push(result.id);
    } catch (err) {
      logger.error('Welcome series email 2 scheduling failed:', err);
    }
  }

  // Email 3: 1 hour before the call.
  // Keep the original 72-hour outer bound — beyond that we'd rather re-trigger
  // the reminder closer to the call (future work) than stash it at the provider.
  const email3Time = new Date(callTime.getTime() - 60 * 60 * 1000);
  const minutesUntilEmail3 = (email3Time.getTime() - now.getTime()) / (1000 * 60);
  if (minutesUntilEmail3 > 90 && minutesUntilEmail3 < 72 * 60) {
    try {
      const result = await sendWelcomeEmail3({
        ...params,
        scheduledAt: email3Time.toISOString(),
      });
      if (result?.id) emailIds.push(result.id);
    } catch (err) {
      logger.error('Welcome series email 3 scheduling failed:', err);
    }
  }

  return { emailIds };
}

/**
 * Welcome Email 1: "What to have ready for your strategy call"
 * Sent 1 hour after booking confirmation.
 */
async function sendWelcomeEmail1(params: WelcomeSeriesParams & { scheduledAt: string }) {
  const { to, guestName, teamMemberName, startTime, timezone, scheduledAt } = params;

  const formattedDate = startTime.toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: timezone,
  });
  const formattedTime = startTime.toLocaleTimeString('en-CA', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone,
  });

  const subject = 'What to have ready for your strategy call';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 24px 40px; text-align: center;">
              <a href="https://multifamily-usa.com"><img src="${LOGO_URL}" alt="Multi-Family USA" width="160" style="max-width: 160px; height: auto;" /></a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #374151;">
                Hi ${escapeHtml(guestName)},
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; color: #374151;">
                Looking forward to speaking with you on <strong>${formattedDate}</strong> at <strong>${formattedTime}</strong>.
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">
                To make sure we get the most out of our time together, here's what's helpful to have on hand — even a rough idea of any of these will make the conversation more productive:
              </p>

              <!-- If you have a property -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; margin-bottom: 16px; border: 1px solid #bbf7d0;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #166534;">If you have a specific property in mind:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.8;">
                      <li>The address or listing link</li>
                      <li>Purchase price (or asking price)</li>
                      <li>Estimated rental income (or current rents)</li>
                      <li>Your down payment budget</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- If exploring -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; margin-bottom: 20px; border: 1px solid #bfdbfe;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #1e40af;">If you're exploring your options:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.8;">
                      <li>The type of property you're interested in (single-family, 2–4 unit, small multifamily, short-term rental, mixed-use)</li>
                      <li>The U.S. markets or states you're targeting</li>
                      <li>Your current portfolio size (zero is a great starting point)</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 16px; color: #374151;">
                You don't need all of this — any context helps. And if you're truly just exploring, that's completely fine too. These calls are designed to give you clarity regardless of where you're at.
              </p>
              <p style="margin: 0 0 0; font-size: 14px; color: #6b7280;">
                If anything changes before our call, you can reschedule or cancel directly from your confirmation email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 4px; font-size: 14px; color: #374151;">Talk soon,</p>
              <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #374151;">${escapeHtml(teamMemberName)}</p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Multi-Family USA &middot; <a href="https://multifamily-usa.com" style="color: #9ca3af;">multifamily-usa.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = `Hi ${guestName},

Looking forward to speaking with you on ${formattedDate} at ${formattedTime}.

To make sure we get the most out of our time together, here's what's helpful to have on hand:

IF YOU HAVE A SPECIFIC PROPERTY IN MIND:
- The address or listing link
- Purchase price (or asking price)
- Estimated rental income (or current rents)
- Your down payment budget

IF YOU'RE EXPLORING YOUR OPTIONS:
- The type of property you're interested in
- The U.S. markets or states you're targeting
- Your current portfolio size (zero is a great starting point)

You don't need all of this — any context helps. If you're truly just exploring, that's completely fine too.

If anything changes, you can reschedule or cancel from your confirmation email.

Talk soon,
${teamMemberName}
Multi-Family USA
https://multifamily-usa.com`.trim();

  return sendEmail({ to, subject, html, text, scheduledAt });
}

/**
 * Welcome Email 2: "How we've helped investors like you"
 * Sent 24 hours after booking (skipped if call is within 24h).
 */
async function sendWelcomeEmail2(params: WelcomeSeriesParams & { scheduledAt: string }) {
  const { to, guestName, teamMemberName, scheduledAt } = params;

  const subject = "How we've helped investors like you";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 24px 40px; text-align: center;">
              <a href="https://multifamily-usa.com"><img src="${LOGO_URL}" alt="Multi-Family USA" width="160" style="max-width: 160px; height: auto;" /></a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #374151;">
                Hi ${escapeHtml(guestName)},
              </p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #374151;">
                Your strategy call is coming up — here's a quick primer on how US commercial multifamily financing works, so you can come prepared with the questions that matter most to your deal.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${BRAND_COLOR};">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 6px; font-size: 15px; font-weight: 600; color: #111827;">Qualify on the property, not your W-2</p>
                    <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">
                      Multifamily lenders underwrite 5+ unit deals using NOI, DSCR, debt yield, and leverage together — not personal income alone. Proceeds are usually set by whichever metric is most constraining after lender adjustments.
                    </p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${BRAND_COLOR};">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 6px; font-size: 15px; font-weight: 600; color: #111827;">LLC titling, no Fannie cap</p>
                    <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">
                      Close directly in your LLC with a personal guarantee. No 10-property cap. Portfolio lenders routinely do 20, 40, even 100+ loans for the same investor — a door Fannie Mae closes at ten.
                    </p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid ${BRAND_COLOR};">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 6px; font-size: 15px; font-weight: 600; color: #111827;">Pricing that rewards a strong deal</p>
                    <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">
                      Agency, bridge, bank, and debt-fund options price differently by business plan and asset quality. Strong files with durable NOI and clear execution timelines usually get faster term sheets and better structure.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 16px; color: #374151;">
                Every deal is different — that's exactly what we'll dig into on your call. ${escapeHtml(teamMemberName)} will walk through the options that fit your specific goals.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 4px; font-size: 14px; color: #374151;">See you soon,</p>
              <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #374151;">The Multi-Family USA Team</p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Multi-Family USA &middot; <a href="https://multifamily-usa.com" style="color: #9ca3af;">multifamily-usa.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = `Hi ${guestName},

Your strategy call is coming up — here's a quick primer on how US commercial multifamily financing works, so you can come prepared with the questions that matter most to your deal.

UNDERWRITE NOI, DSCR, AND DEBT YIELD TOGETHER:
Multifamily lenders size 5+ unit deals on property cash flow and leverage constraints. Proceeds are usually set by whichever metric is most binding after lender adjustments.

MATCH THE PRODUCT TO THE BUSINESS PLAN:
Agency, bridge, bank, and debt-fund paths differ on proceeds, flexibility, and timing. Bring in-place and stabilized NOI views plus downside sensitivity to your call.

PRICING THAT REWARDS A STRONG DEAL:
Agency, bridge, bank, and debt-fund options price differently by business plan and asset quality. We help you compare rate, fees, prepay, and timing across realistic lender fits.

Every deal is different — that's exactly what we'll dig into on your call. ${teamMemberName} will walk through the options that fit your specific goals.

See you soon,
The Multi-Family USA Team
https://multifamily-usa.com`.trim();

  return sendEmail({ to, subject, html, text, scheduledAt });
}

/**
 * Welcome Email 3: "Your strategy call is in 1 hour"
 * Sent 1 hour before the call.
 */
async function sendWelcomeEmail3(params: WelcomeSeriesParams & { scheduledAt: string }) {
  const { to, guestName, teamMemberName, serviceDuration, startTime, timezone, meetingLink, scheduledAt } = params;

  const formattedDate = startTime.toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: timezone,
  });
  const formattedTime = startTime.toLocaleTimeString('en-CA', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone,
  });

  const subject = 'Your strategy call is in 1 hour';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 24px 40px; text-align: center;">
              <a href="https://multifamily-usa.com"><img src="${LOGO_URL}" alt="Multi-Family USA" width="160" style="max-width: 160px; height: auto;" /></a>
            </td>
          </tr>
          <tr>
            <td style="background-color: #059669; padding: 24px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">
                Your Call Is in 1 Hour
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #374151;">
                Hi ${escapeHtml(guestName)},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">
                Quick reminder — your strategy call with ${escapeHtml(teamMemberName)} is in about an hour.
              </p>

              <!-- Meeting Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; margin-bottom: 20px; border: 1px solid #bbf7d0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding: 6px 0;"><span style="color: #166534; font-size: 14px;">📅 <strong>${formattedDate}</strong></span></td></tr>
                      <tr><td style="padding: 6px 0;"><span style="color: #166534; font-size: 14px;">🕐 <strong>${formattedTime}</strong> (${serviceDuration} min)</span></td></tr>
                      <tr><td style="padding: 6px 0;"><span style="color: #166534; font-size: 14px;">👤 <strong>${escapeHtml(teamMemberName)}</strong></span></td></tr>
                      ${meetingLink ? `<tr><td style="padding: 6px 0;"><span style="color: #166534; font-size: 14px;">🔗 <a href="${meetingLink}" style="color: #059669; font-weight: 600;">Join Video Call</a></span></td></tr>` : `<tr><td style="padding: 6px 0;"><span style="color: #166534; font-size: 14px;">📞 We'll call you at the number you provided.</span></td></tr>`}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 15px; color: #374151;">
                If you have a property address or any numbers you've been running, have those handy. Otherwise, just come with your questions — that's what this call is for.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 4px; font-size: 14px; color: #374151;">See you shortly,</p>
              <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #374151;">${escapeHtml(teamMemberName)}</p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Multi-Family USA &middot; <a href="https://multifamily-usa.com" style="color: #9ca3af;">multifamily-usa.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = `Hi ${guestName},

Quick reminder — your strategy call with ${teamMemberName} is in about an hour.

WHEN: ${formattedDate} at ${formattedTime}
DURATION: ${serviceDuration} minutes
${meetingLink ? `JOIN HERE: ${meetingLink}` : `We'll call you at the number you provided.`}

If you have a property address or any numbers you've been running, have those handy. Otherwise, just come with your questions — that's what this call is for.

See you shortly,
${teamMemberName}
Multi-Family USA`.trim();

  return sendEmail({ to, subject, html, text, scheduledAt });
}

// ============================================================================
// Internal Notification Emails
// ============================================================================

interface BookingNotificationEmailParams {
  teamMemberEmail: string;
  teamMemberName: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  serviceName: string;
  serviceDuration: number;
  startTime: Date;
  timezone: string;
  meetingType?: string;
  meetingLink?: string;
}

/**
 * Send internal notification email when a booking is confirmed.
 * Primary recipient: assigned loan officer.
 * Cc: Scott and Aya for oversight (confirmed bookings only — not lead-form
 * submissions).
 */
export async function sendBookingNotificationEmail(params: BookingNotificationEmailParams) {
  const {
    teamMemberEmail,
    teamMemberName,
    guestName,
    guestEmail,
    guestPhone,
    notes,
    serviceName,
    serviceDuration,
    startTime,
    timezone,
    meetingType,
    meetingLink,
  } = params;

  const formattedDate = startTime.toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });

  const formattedTime = startTime.toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });

  const meetingTypeLabel = meetingType === 'phone' ? 'Phone Call'
    : meetingType === 'zoom' ? 'Zoom'
    : meetingType === 'meet' ? 'Google Meet'
    : 'Microsoft Teams';

  // Cc admins for oversight, but exclude the LO if they happen to share an
  // address with one of the admin inboxes — most providers reject duplicate
  // recipients in the same send.
  const ccList = bookingOversightCcExcluding(teamMemberEmail);

  const subject = `New Booking: ${serviceName} with ${guestName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Logo -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; background-color: #ffffff;">
              <a href="https://multifamily-usa.com" style="display: inline-block;">
                <img src="${LOGO_URL}" alt="Multi-Family USA" width="160" style="max-width: 160px; height: auto;" />
              </a>
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background-color: ${BRAND_COLOR}; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                New Booking Confirmed
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; font-size: 16px; color: #374151;">
                A new <strong>${serviceName}</strong> has been confirmed for <strong>${teamMemberName}</strong>.
              </p>

              <!-- Lead Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; margin-bottom: 24px; border: 1px solid #bfdbfe;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                      Lead Details
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Name:</span>
                          <span style="color: #111827; font-size: 14px; font-weight: 500; margin-left: 8px;">${escapeHtml(guestName)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Email:</span>
                          <a href="mailto:${escapeHtml(guestEmail)}" style="color: #2563eb; font-size: 14px; font-weight: 500; margin-left: 8px;">${escapeHtml(guestEmail)}</a>
                        </td>
                      </tr>
                      ${guestPhone ? `
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Phone:</span>
                          <span style="color: #111827; font-size: 14px; font-weight: 500; margin-left: 8px;">${escapeHtml(guestPhone)}</span>
                        </td>
                      </tr>
                      ` : ''}
                      ${notes ? `
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Notes:</span>
                          <span style="color: #111827; font-size: 14px; margin-left: 8px;">${escapeHtml(notes)}</span>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Booking Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                      Booking Details
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Service</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                          <span style="color: #111827; font-size: 14px; font-weight: 500;">${serviceName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Duration</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                          <span style="color: #111827; font-size: 14px; font-weight: 500;">${serviceDuration} minutes</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Assigned To</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                          <span style="color: #111827; font-size: 14px; font-weight: 500;">${teamMemberName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Date</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                          <span style="color: #111827; font-size: 14px; font-weight: 500;">${formattedDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Time</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                          <span style="color: #111827; font-size: 14px; font-weight: 500;">${formattedTime} (${timezone})</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Meeting Type</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="color: #111827; font-size: 14px; font-weight: 500;">${meetingTypeLabel}</span>
                        </td>
                      </tr>
                      ${meetingLink ? `
                      <tr>
                        <td colspan="2" style="padding: 12px 0 0;">
                          <a href="${meetingLink}" style="color: #2563eb; font-size: 14px; font-weight: 500;">Join Video Call</a>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Multi-Family USA &middot; Booking Notification
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
NEW BOOKING CONFIRMED

A new ${serviceName} has been confirmed for ${teamMemberName}.

LEAD DETAILS:
- Name: ${guestName}
- Email: ${guestEmail}
${guestPhone ? `- Phone: ${guestPhone}` : ''}
${notes ? `- Notes: ${notes}` : ''}

BOOKING DETAILS:
- Service: ${serviceName}
- Duration: ${serviceDuration} minutes
- Assigned To: ${teamMemberName}
- Date: ${formattedDate}
- Time: ${formattedTime} (${timezone})
- Meeting Type: ${meetingTypeLabel}
${meetingLink ? `- Video Call: ${meetingLink}` : ''}

---
Multi-Family USA - Booking Notification
  `.trim();

  await sendEmail({
    to: teamMemberEmail,
    cc: ccList,
    subject,
    html,
    text,
    replyTo: guestEmail,
  });
}
