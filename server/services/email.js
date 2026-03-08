/**
 * Email service for booking confirmations. Uses Resend when RESEND_API_KEY is set.
 * From = EMAIL_FROM (system); Reply-To = professional's email.
 * On send failure we log and return { sent: false }; never throw so booking creation is not failed.
 */
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Lesson Scheduler <onboarding@resend.dev>';
/** When set (e.g. in dev), send all booking emails to this address instead of real recipients. Use your Resend account email to work around "only send to self" when no domain is verified. */
const EMAIL_DEV_OVERRIDE = (process.env.EMAIL_DEV_OVERRIDE || '').trim();

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function buildAddToCalendarUrl(eventName, startTimeIso, durationMinutes) {
  const start = new Date((startTimeIso || '').replace(' ', 'T'));
  const end = new Date(start.getTime() + (durationMinutes || 30) * 60 * 1000);
  const fmt = (d) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    return `${y}${m}${day}T${h}${min}${s}Z`;
  };
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventName || 'Booking',
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatStartTime(startTime) {
  const s = (startTime || '').replace(' ', 'T');
  const d = new Date(s.includes('Z') ? s : s + 'Z');
  return d.toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatStartDate(startTime) {
  const s = (startTime || '').replace(' ', 'T');
  const d = new Date(s.includes('Z') ? s : s + 'Z');
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/** Shared email layout: header, body slot, footer. Use wrapInLayout() to inject content. */
const EMAIL_LAYOUT = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Lesson Scheduler</title></head>
<body style="font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; background: #f5f5f5;">
  <div style="max-width: 560px; margin: 0 auto; padding: 24px; background: #fff;">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 18px; font-weight: 700; color: #111827;">Lesson Scheduler</span>
    </div>
    <div style="margin-bottom: 24px;">
{{BODY_CONTENT}}
    </div>
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
      <p style="margin: 0 0 8px 0;">Sent from {{BRAND_HTML}}</p>
      <p style="margin: 0;"><a href="{{REPORT_LINK}}" style="color: #0a7ea4;">Report this event</a></p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Wrap body content in the shared email layout (header + content + footer).
 * @param {string} bodyContent - Inner HTML (body-only fragment).
 * @param {string} [baseUrl] - App base URL for footer link; if set, "Lesson Scheduler" in footer is a link.
 * @returns {string} Full HTML document.
 */
function wrapInLayout(bodyContent, baseUrl = '') {
  const brandHtml = baseUrl ? `<a href="${baseUrl.replace(/\/$/, '')}" style="color: #0a7ea4;">Lesson Scheduler</a>` : 'Lesson Scheduler';
  const reportLink = baseUrl ? `${baseUrl.replace(/\/$/, '')}/booking/placeholder` : '#';
  return EMAIL_LAYOUT
    .replace('{{BODY_CONTENT}}', () => bodyContent || '')
    .replace('{{BRAND_HTML}}', brandHtml)
    .replace('{{REPORT_LINK}}', reportLink);
}

/** Client confirmation email body (fragment only; wrapped in layout by wrapInLayout). */
const CLIENT_HTML = `
  <h1 style="font-size: 20px; margin-bottom: 16px;">Booking confirmed</h1>
  <p>Hi {{clientName}},</p>
  <p>Your session with <strong>{{professionalName}}</strong> is confirmed.</p>
  <ul style="line-height: 1.8;">
    <li><strong>What:</strong> {{eventTypeName}}</li>
    <li><strong>When:</strong> {{startTime}} ({{durationMinutes}} min)</li>
    {{#location}}<li><strong>Where:</strong> {{location}}</li>{{/location}}
  </ul>
  <p><a href="{{addToCalendarLink}}" style="color: #0a7ea4;">Add to calendar</a></p>
  <p style="color: #6b7280; font-size: 14px;"><a href="{{manageLink}}">Cancel or edit this booking</a> (coming soon)</p>
`;

/** Professional "new booking" email body (fragment only; wrapped in layout by wrapInLayout). */
const PROFESSIONAL_HTML = `
  <h1 style="font-size: 20px; margin-bottom: 16px;">New booking</h1>
  <p>{{clientName}} has booked a session.</p>
  <ul style="line-height: 1.8;">
    <li><strong>Event:</strong> {{eventTypeName}}</li>
    <li><strong>When:</strong> {{startTime}} ({{durationMinutes}} min)</li>
    <li><strong>Client:</strong> {{clientName}} &lt;{{clientEmail}}&gt;</li>
    {{#location}}<li><strong>Where:</strong> {{location}}</li>{{/location}}
  </ul>
`;

/** Escape $ in replacement string so .replace() treats it literally */
function escapeReplacement(s) {
  return String(s).replace(/\$/g, '$$$$');
}

function fillTemplate(html, vars) {
  let out = html;
  for (const [k, v] of Object.entries(vars)) {
    const val = v != null ? String(v) : '';
    const open = escapeRegexLiteral(`{{#${k}}}`);
    const close = escapeRegexLiteral(`{{/${k}}}`);
    out = out.replace(new RegExp(`${open}([\\s\\S]*?)${close}`, 'g'), val ? '$1' : '');
  }
  for (const [k, v] of Object.entries(vars)) {
    const val = v != null ? escapeReplacement(String(v)) : '';
    out = out.replace(new RegExp(escapeRegexLiteral(`{{${k}}}`), 'g'), val);
  }
  return out;
}

function escapeRegexLiteral(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Send confirmation emails to client and professional after booking(s) created.
 * @param {object} opts
 * @param {object[]} opts.created - array of created booking rows (start_time, end_time, duration_minutes, first_name, last_name, email)
 * @param {object} opts.eventType - { name, durationMinutes, location, notificationTemplate? }
 * @param {object} opts.professional - { fullName, email, phone? }
 * @param {string} [opts.baseUrl] - site base URL for manage link (e.g. https://app.example.com)
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
async function sendBookingConfirmation(opts) {
  if (!resend) {
    return { sent: false, error: 'RESEND_API_KEY not set' };
  }
  const { created, eventType, professional, baseUrl = '' } = opts;
  if (!created || created.length === 0) {
    return { sent: false, error: 'Missing data' };
  }
  const first = created[0];
  const clientName = `${(first.first_name || '').trim()} ${(first.last_name || '').trim()}`.trim() || 'Guest';
  const clientEmail = (first.email || '').trim();
  const devOverride = EMAIL_DEV_OVERRIDE || null;
  if (!devOverride && !clientEmail && !(professional?.email)) {
    return { sent: false, error: 'Missing data' };
  }
  const startTime = first.start_time || first.startTime;
  const durationMinutes = first.duration_minutes ?? first.durationMinutes ?? eventType?.durationMinutes ?? 30;
  const eventName = eventType?.name || 'Session';
  const professionalName = professional?.fullName || professional?.full_name || 'Your host';
  const professionalPhone = professional?.phone != null ? String(professional.phone) : '';
  const location = eventType?.location || '';
  const addToCalendarLink = buildAddToCalendarUrl(eventName, startTime, durationMinutes);
  const manageLink = baseUrl ? `${baseUrl.replace(/\/$/, '')}/booking/placeholder` : '/booking/placeholder';

  const clientVars = {
    clientName,
    startTime: formatStartTime(startTime),
    startDate: formatStartDate(startTime),
    eventTypeName: eventName,
    professionalName,
    professionalEmail: professional?.email || '',
    professionalPhone,
    addToCalendarLink,
    location,
    durationMinutes,
    manageLink,
  };
  const proVars = {
    clientName,
    clientEmail,
    startTime: formatStartTime(startTime),
    eventTypeName: eventName,
    professionalName,
    location,
    durationMinutes,
  };

  const customClientHtml = (eventType?.notificationTemplate || '').trim();
  let clientBodyHtml;
  if (customClientHtml) {
    try {
      const filled = fillTemplate(customClientHtml, clientVars);
      clientBodyHtml = filled && filled.trim().length > 0 ? filled : fillTemplate(CLIENT_HTML, clientVars);
    } catch (err) {
      console.error('[email] Custom template failed, using default:', err.message);
      clientBodyHtml = fillTemplate(CLIENT_HTML, clientVars);
    }
  } else {
    clientBodyHtml = fillTemplate(CLIENT_HTML, clientVars);
  }
  const clientHtml = clientBodyHtml.includes('<html')
    ? clientBodyHtml
    : wrapInLayout(clientBodyHtml, baseUrl);
  const proBodyHtml = fillTemplate(PROFESSIONAL_HTML, proVars);
  const proHtml = wrapInLayout(proBodyHtml, baseUrl);
  const replyTo = professional?.email || undefined;
  const devTo = devOverride || null;
  const clientTo = devTo ? [devTo] : (clientEmail ? [clientEmail] : []);
  const proTo = devTo ? [devTo] : (professional?.email ? [professional.email] : []);

  try {
    const toClient = clientTo.length
      ? resend.emails.send({
          from: EMAIL_FROM,
          to: clientTo,
          ...(replyTo && { replyTo }),
          subject: devTo ? `[Dev] Booking confirmed: ${eventName} (to ${clientEmail})` : `Booking confirmed: ${eventName} with ${professionalName}`,
          html: clientHtml,
        })
      : Promise.resolve({ data: null, error: null });
    const toPro = proTo.length
      ? resend.emails.send({
          from: EMAIL_FROM,
          to: proTo,
          ...(replyTo && { replyTo }),
          subject: devTo ? `[Dev] New booking: ${clientName} – ${eventName}` : `New booking: ${clientName} – ${eventName}`,
          html: proHtml,
        })
      : Promise.resolve({ data: null, error: null });

    const [clientResult, proResult] = await Promise.all([toClient, toPro]);
    const err = clientResult?.error || proResult?.error;
    if (err) {
      const errMsg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      console.error('[email] Booking confirmation send failed:', errMsg);
      return { sent: false, error: errMsg };
    }
    return { sent: true };
  } catch (err) {
    console.error('[email] Booking confirmation error:', err);
    return { sent: false, error: err.message || String(err) };
  }
}

module.exports = { sendBookingConfirmation, buildAddToCalendarUrl, formatStartTime };
