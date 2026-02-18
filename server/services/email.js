/**
 * Email service for booking confirmations. Uses Resend when RESEND_API_KEY is set.
 * From = EMAIL_FROM (system); Reply-To = professional's email.
 * On send failure we log and return { sent: false }; never throw so booking creation is not failed.
 */
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Lesson Scheduler <onboarding@resend.dev>';

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

const CLIENT_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Booking confirmed</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
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
</body>
</html>
`;

const PROFESSIONAL_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New booking</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 20px; margin-bottom: 16px;">New booking</h1>
  <p>{{clientName}} has booked a session.</p>
  <ul style="line-height: 1.8;">
    <li><strong>Event:</strong> {{eventTypeName}}</li>
    <li><strong>When:</strong> {{startTime}} ({{durationMinutes}} min)</li>
    <li><strong>Client:</strong> {{clientName}} &lt;{{clientEmail}}&gt;</li>
    {{#location}}<li><strong>Where:</strong> {{location}}</li>{{/location}}
  </ul>
</body>
</html>
`;

function fillTemplate(html, vars) {
  let out = html;
  for (const [k, v] of Object.entries(vars)) {
    const val = v != null ? String(v) : '';
    out = out.replace(new RegExp(`{{#${k}}}([\\s\\S]*?){{/${k}}}`, 'g'), val ? '$1' : '');
  }
  for (const [k, v] of Object.entries(vars)) {
    const val = v != null ? String(v) : '';
    out = out.replace(new RegExp(`{{${k}}}`, 'g'), val);
  }
  return out;
}

/**
 * Send confirmation emails to client and professional after booking(s) created.
 * @param {object} opts
 * @param {object[]} opts.created - array of created booking rows (start_time, end_time, duration_minutes, first_name, last_name, email)
 * @param {object} opts.eventType - { name, durationMinutes, location }
 * @param {object} opts.professional - { fullName, email }
 * @param {string} [opts.baseUrl] - site base URL for manage link (e.g. https://app.example.com)
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
async function sendBookingConfirmation(opts) {
  if (!resend) {
    return { sent: false, error: 'RESEND_API_KEY not set' };
  }
  const { created, eventType, professional, baseUrl = '' } = opts;
  if (!created || created.length === 0 || !professional || !professional.email) {
    return { sent: false, error: 'Missing data' };
  }
  const first = created[0];
  const clientName = `${(first.first_name || '').trim()} ${(first.last_name || '').trim()}`.trim() || 'Guest';
  const clientEmail = (first.email || '').trim();
  const startTime = first.start_time || first.startTime;
  const durationMinutes = first.duration_minutes ?? first.durationMinutes ?? eventType?.durationMinutes ?? 30;
  const eventName = eventType?.name || 'Session';
  const professionalName = professional?.fullName || professional?.full_name || 'Your host';
  const location = eventType?.location || '';
  const addToCalendarLink = buildAddToCalendarUrl(eventName, startTime, durationMinutes);
  const manageLink = baseUrl ? `${baseUrl.replace(/\/$/, '')}/booking/placeholder` : '/booking/placeholder';

  const clientVars = {
    clientName,
    startTime: formatStartTime(startTime),
    eventTypeName: eventName,
    professionalName,
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

  const clientHtml = fillTemplate(CLIENT_HTML, clientVars);
  const proHtml = fillTemplate(PROFESSIONAL_HTML, proVars);
  const replyTo = professional.email;

  try {
    const toClient = clientEmail
      ? resend.emails.send({
          from: EMAIL_FROM,
          to: [clientEmail],
          replyTo,
          subject: `Booking confirmed: ${eventName} with ${professionalName}`,
          html: clientHtml,
        })
      : Promise.resolve({ data: null, error: null });
    const toPro = resend.emails.send({
      from: EMAIL_FROM,
      to: [professional.email],
      replyTo,
      subject: `New booking: ${clientName} – ${eventName}`,
      html: proHtml,
    });

    const [clientResult, proResult] = await Promise.all([toClient, toPro]);
    const err = clientResult?.error || proResult?.error;
    if (err) {
      console.error('[email] Booking confirmation send failed:', err);
      return { sent: false, error: err.message || String(err) };
    }
    return { sent: true };
  } catch (err) {
    console.error('[email] Booking confirmation error:', err);
    return { sent: false, error: err.message || String(err) };
  }
}

module.exports = { sendBookingConfirmation, buildAddToCalendarUrl, formatStartTime };
