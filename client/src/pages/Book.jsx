import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { theme } from '../styles/theme';
import { formatDuration } from '../utils/formatDuration';

const API = '/api';

function getTimeZoneLabel() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const timeStr = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: tz });
    const region = tz.replace(/_/g, ' ');
    return `${region} (${timeStr})`;
  } catch {
    return '';
  }
}

function useMediaQuery(query) {
  const [match, setMatch] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : true));
  useEffect(() => {
    const m = window.matchMedia(query);
    setMatch(m.matches);
    const handler = (e) => setMatch(e.matches);
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, [query]);
  return match;
}

function buildAddToCalendarUrl(eventName, startTimeIso, durationMinutes) {
  const start = new Date(startTimeIso.replace(' ', 'T'));
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}${m}${day}T${h}${min}${s}`;
  };
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventName,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function Book() {
  const { eventTypeSlug } = useParams();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [eventType, setEventType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorDebug, setErrorDebug] = useState(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    setErrorDebug(null);
    fetch(`${API}/event-types/${eventTypeSlug}`)
      .then(async (r) => {
        if (r.ok) return r.json();
        const body = await r.json().catch(() => ({}));
        const msg = body.error || `Request failed (${r.status})`;
        setErrorDebug(body.debug || null);
        throw new Error(msg);
      })
      .then(setEventType)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventTypeSlug]);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    fetch(`${API}/event-types/${eventTypeSlug}/slots?date=${dateStr}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSlots)
      .finally(() => setSlotsLoading(false));
  }, [eventTypeSlug, selectedDate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedSlot || !eventType) return;
    setSubmitting(true);
    setSubmitError(null);
    fetch(`${API}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventTypeSlug,
        startTime: selectedSlot,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d.error || 'Booking failed')));
        return r.json();
      })
      .then(() => setSuccess(true))
      .catch((e) => setSubmitError(e.message))
      .finally(() => setSubmitting(false));
  };

  if (loading) return <div style={styles.page}>Loading…</div>;
  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.errorTitle}>Error: {error}</div>
          <div style={styles.errorDetail}>
            Requested event type: <code>{eventTypeSlug}</code>
          </div>
          {errorDebug && (
            <div style={{ ...styles.errorDetail, marginTop: 8, fontFamily: 'monospace', fontSize: 12 }}>
              Debug (from server): <code>{JSON.stringify(errorDebug)}</code>
            </div>
          )}
          <div style={styles.errorHint}>
            If you just created this event and opened the link in a new window or later, the booking link may not see it yet on serverless deployments (data is not shared between requests). Try using the same browser session or use a deployment with persistent storage. To fix this permanently: set <code>POSTGRES_URL</code> (or <code>DATABASE_URL</code>) in your deployment environment and run the database migration (<code>npm run db:migrate-pg</code>). See README or ARCHITECTURE.
          </div>
        </div>
      </div>
    );
  }
  if (!eventType) return null;

  const formatSlot = (s) => {
    const d = new Date(s.replace(' ', 'T'));
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  if (success) {
    const calendarUrl = buildAddToCalendarUrl(
      eventType.name,
      selectedSlot.replace(' ', 'T'),
      eventType.durationMinutes || 30
    );
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={isDesktop ? styles.twoCol : styles.singleCol}>
            <EventSummaryCard eventType={eventType} sticky={isDesktop} />
            <div style={styles.rightCol}>
              <div style={styles.successBlock}>
                <div style={styles.successIcon}>✓</div>
                <h2 style={styles.successTitle}>You're scheduled</h2>
                <p style={styles.successText}>
                  Your booking has been confirmed. We'll see you then.
                </p>
                <a
                  href={calendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.addToCalendar}
                >
                  Add to calendar
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={isDesktop ? styles.twoCol : styles.singleCol}>
          <EventSummaryCard eventType={eventType} sticky={isDesktop} />
          <div style={styles.rightCol}>
            {!selectedDate ? (
              <CalendarStep
                viewMonth={viewMonth}
                setViewMonth={setViewMonth}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
              />
            ) : !selectedSlot ? (
              <SlotsStep
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                slots={slots}
                slotsLoading={slotsLoading}
                setSelectedSlot={setSelectedSlot}
                formatSlot={formatSlot}
              />
            ) : (
              <FormStep
                selectedSlot={selectedSlot}
                setSelectedSlot={setSelectedSlot}
                formatSlot={formatSlot}
                form={form}
                setForm={setForm}
                handleSubmit={handleSubmit}
                submitting={submitting}
                submitError={submitError}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventSummaryCard({ eventType, sticky = true }) {
  return (
    <div style={{ ...styles.summaryCard, ...(sticky ? styles.summaryCardSticky : {}) }}>
      <h1 style={styles.summaryName}>{eventType.name}</h1>
      <p style={styles.summaryMeta}>
        <span style={styles.metaIcon}>🕐</span> {formatDuration(eventType.durationMinutes)}
      </p>
      {eventType.description && (
        <p style={styles.summaryDesc}>{eventType.description}</p>
      )}
      {eventType.allowRecurring && eventType.recurringCount > 1 && (
        <p style={styles.summaryRecurring}>
          You're booking {eventType.recurringCount} weekly sessions at this time.
        </p>
      )}
    </div>
  );
}

function CalendarStep({ viewMonth, setViewMonth, selectedDate, setSelectedDate }) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));
  const monthTitle = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const isSelected = (d) =>
    selectedDate &&
    selectedDate.getFullYear() === d.getFullYear() &&
    selectedDate.getMonth() === d.getMonth() &&
    selectedDate.getDate() === d.getDate();

  const timeZoneLabel = getTimeZoneLabel();

  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>Select a Date & Time</h2>
      <div style={styles.monthNav}>
        <button type="button" style={styles.monthNavBtn} onClick={prevMonth} aria-label="Previous month">
          ‹
        </button>
        <span style={styles.monthNavTitle}>{monthTitle}</span>
        <button type="button" style={styles.monthNavBtn} onClick={nextMonth} aria-label="Next month">
          ›
        </button>
      </div>
      <div style={styles.weekdayRow}>
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
          <span key={d} style={styles.weekday}>{d}</span>
        ))}
      </div>
      <div style={styles.grid}>
        {Array.from({ length: firstDay }, (_, i) => (
          <span key={`e-${i}`} style={styles.empty} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = new Date(year, month, i + 1);
          const past = d < today;
          const selected = isSelected(d);
          return (
            <button
              key={i}
              type="button"
              style={{
                ...styles.day,
                ...(past ? styles.dayPast : {}),
                ...(selected ? styles.daySelected : {}),
              }}
              disabled={past}
              onClick={() => setSelectedDate(d)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      {timeZoneLabel && (
        <div style={styles.timeZoneRow}>
          <span style={styles.timeZoneLabel}>Time zone</span>
          <span style={styles.timeZoneValue}>🌐 {timeZoneLabel}</span>
        </div>
      )}
    </section>
  );
}

function SlotsStep({
  selectedDate,
  setSelectedDate,
  slots,
  slotsLoading,
  setSelectedSlot,
  formatSlot,
}) {
  return (
    <section style={styles.section}>
      <button
        type="button"
        style={styles.back}
        onClick={() => setSelectedDate(null)}
      >
        ‹ Change date
      </button>
      <h2 style={styles.sectionTitle}>
        {selectedDate.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })}
      </h2>
      <p style={styles.sectionSub}>Choose a time</p>
      {slotsLoading ? (
        <p style={styles.muted}>Loading times…</p>
      ) : slots.length === 0 ? (
        <p style={styles.noSlots}>No available times this day.</p>
      ) : (
        <div style={styles.slotList}>
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              style={styles.slotChip}
              onClick={() => setSelectedSlot(s)}
            >
              {formatSlot(s)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function FormStep({
  selectedSlot,
  setSelectedSlot,
  formatSlot,
  form,
  setForm,
  handleSubmit,
  submitting,
  submitError,
}) {
  return (
    <section style={styles.section}>
      <button
        type="button"
        style={styles.back}
        onClick={() => setSelectedSlot(null)}
      >
        ‹ Change time
      </button>
      <p style={styles.selectedTime}>{formatSlot(selectedSlot)}</p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          <span style={styles.labelText}>First name</span>
          <input
            required
            placeholder="John"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          <span style={styles.labelText}>Last name</span>
          <input
            required
            placeholder="Doe"
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          <span style={styles.labelText}>Email</span>
          <input
            type="email"
            required
            placeholder="john@example.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          <span style={styles.labelText}>Phone</span>
          <input
            type="tel"
            required
            placeholder="+1 234 567 8900"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            style={styles.input}
          />
        </label>
        {submitError && <p style={styles.submitError}>{submitError}</p>}
        <button type="submit" disabled={submitting} style={styles.submit}>
          {submitting ? 'Scheduling…' : 'Schedule event'}
        </button>
      </form>
    </section>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: theme.background,
    padding: '24px 16px',
  },
  card: {
    background: theme.cardBg,
    borderRadius: theme.borderRadiusLg,
    boxShadow: theme.shadowCard,
    border: `1px solid ${theme.border}`,
    maxWidth: 960,
    margin: '0 auto',
    padding: 28,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#b91c1c',
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: theme.muted,
    marginBottom: 12,
  },
  errorHint: {
    fontSize: 13,
    color: theme.muted,
    lineHeight: 1.5,
    maxWidth: 480,
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 320px) 1fr',
    gap: 40,
    alignItems: 'start',
  },
  singleCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  rightCol: { minWidth: 0 },
  summaryCard: {
    background: 'transparent',
    padding: 0,
  },
  summaryCardSticky: { position: 'sticky', top: 24 },
  summaryName: { margin: '0 0 12px', fontSize: 22, fontWeight: 600, color: theme.text },
  summaryDesc: { color: theme.muted, margin: '0 0 12px', fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  summaryMeta: { color: theme.muted, fontSize: 14, margin: 0, display: 'flex', alignItems: 'center', gap: 6 },
  metaIcon: { fontSize: 16 },
  summaryRecurring: { color: theme.primary, fontSize: 14, margin: '12px 0 0' },
  section: { margin: 0 },
  sectionTitle: { fontSize: 18, fontWeight: 600, margin: '0 0 16px', color: theme.text },
  sectionSub: { fontSize: 14, color: theme.muted, margin: '0 0 16px' },
  monthNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    background: theme.cardBg,
    cursor: 'pointer',
    fontSize: 20,
    color: theme.text,
  },
  monthNavTitle: { fontSize: 16, fontWeight: 600, color: theme.text },
  weekdayRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4,
    marginBottom: 8,
  },
  weekday: { fontSize: 11, color: theme.muted, textAlign: 'center', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 },
  empty: {},
  day: {
    aspectRatio: 1,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    background: theme.cardBg,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: theme.text,
  },
  dayPast: { opacity: 0.4, cursor: 'not-allowed', background: theme.background },
  daySelected: { background: theme.primary, color: '#fff', borderColor: theme.primary },
  timeZoneRow: { marginTop: 20, paddingTop: 16, borderTop: `1px solid ${theme.border}` },
  timeZoneLabel: { display: 'block', fontSize: 12, fontWeight: 500, color: theme.muted, marginBottom: 4 },
  timeZoneValue: { fontSize: 14, color: theme.text },
  back: {
    background: 'none',
    border: 'none',
    color: theme.primary,
    cursor: 'pointer',
    marginBottom: 16,
    padding: 0,
    fontSize: 14,
  },
  muted: { color: theme.muted, fontSize: 14 },
  noSlots: { color: theme.muted, fontSize: 14 },
  slotList: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  slotChip: {
    padding: '10px 18px',
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    background: theme.cardBg,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: theme.text,
  },
  selectedTime: { fontWeight: 600, fontSize: 16, margin: '0 0 20px', color: theme.text },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  label: { display: 'flex', flexDirection: 'column', gap: 6 },
  labelText: { fontSize: 14, fontWeight: 500, color: theme.text },
  input: {
    padding: '10px 12px',
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    fontSize: 15,
  },
  submitError: { color: '#dc2626', fontSize: 14, margin: 0 },
  submit: {
    padding: 14,
    background: theme.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 15,
    marginTop: 4,
  },
  successBlock: { textAlign: 'center', padding: '8px 0' },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#d1fae5',
    color: '#059669',
    fontSize: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    fontWeight: 600,
  },
  successTitle: { margin: '0 0 8px', fontSize: 22, fontWeight: 600, color: theme.text },
  successText: { color: theme.muted, margin: '0 0 20px', fontSize: 15 },
  addToCalendar: {
    display: 'inline-block',
    color: theme.primary,
    fontWeight: 600,
    fontSize: 14,
    textDecoration: 'none',
  },
};
