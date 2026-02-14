import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const API = '/api';

export default function Book() {
  const { eventTypeSlug } = useParams();
  const [eventType, setEventType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    fetch(`${API}/event-types/${eventTypeSlug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found'))))
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
  if (error) return <div style={styles.page}>Error: {error}</div>;
  if (!eventType) return null;

  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2 style={styles.successTitle}>You’re booked</h2>
          <p>Your booking has been confirmed. We’ll see you then.</p>
        </div>
      </div>
    );
  }

  const month = selectedDate ? selectedDate.getMonth() : new Date().getMonth();
  const year = selectedDate ? selectedDate.getFullYear() : new Date().getFullYear();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatSlot = (s) => {
    const d = new Date(s.replace(' ', 'T'));
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.name}>{eventType.name}</h1>
        {eventType.description && <p style={styles.desc}>{eventType.description}</p>}
        <p style={styles.meta}>{eventType.durationMinutes} min</p>
        {eventType.allowRecurring && eventType.recurringCount > 1 && (
          <p style={styles.recurring}>You’re booking {eventType.recurringCount} weekly sessions at this time.</p>
        )}

        {!selectedDate ? (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Select a day</h2>
            <div style={styles.calendar}>
              <div style={styles.weekdayRow}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <span key={d} style={styles.weekday}>{d}</span>
                ))}
              </div>
              <div style={styles.grid}>
                {Array.from({ length: firstDay }, (_, i) => (
                  <span key={`e-${i}`} style={styles.empty} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = new Date(year, month, i + 1);
                  const isPast = d < today;
                  return (
                    <button
                      key={i}
                      type="button"
                      style={{ ...styles.day, ...(isPast ? styles.dayPast : {}) }}
                      disabled={isPast}
                      onClick={() => setSelectedDate(d)}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : !selectedSlot ? (
          <section style={styles.section}>
            <button type="button" style={styles.back} onClick={() => setSelectedDate(null)}>← Change day</button>
            <h2 style={styles.sectionTitle}>
              {selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </h2>
            {slotsLoading ? (
              <p>Loading slots…</p>
            ) : slots.length === 0 ? (
              <p style={styles.noSlots}>No available slots this day.</p>
            ) : (
              <div style={styles.slotGrid}>
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    style={styles.slotBtn}
                    onClick={() => setSelectedSlot(s)}
                  >
                    {formatSlot(s)}
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section style={styles.section}>
            <button type="button" style={styles.back} onClick={() => setSelectedSlot(null)}>← Change time</button>
            <p style={styles.selectedTime}>{formatSlot(selectedSlot)}</p>
            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>
                First name *
                <input
                  required
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  style={styles.input}
                />
              </label>
              <label style={styles.label}>
                Last name *
                <input
                  required
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  style={styles.input}
                />
              </label>
              <label style={styles.label}>
                Email *
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  style={styles.input}
                />
              </label>
              <label style={styles.label}>
                Phone *
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  style={styles.input}
                />
              </label>
              {submitError && <p style={styles.submitError}>{submitError}</p>}
              <button type="submit" disabled={submitting} style={styles.submit}>
                {submitting ? 'Booking…' : 'Confirm booking'}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 480, margin: '0 auto', padding: 24 },
  card: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  name: { margin: '0 0 8px', fontSize: 22 },
  desc: { color: '#555', margin: '0 0 8px', whiteSpace: 'pre-wrap' },
  meta: { color: '#666', fontSize: 14, margin: '0 0 16px' },
  recurring: { color: '#0a7ea4', fontSize: 14, margin: '0 0 16px' },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 16, margin: '0 0 12px' },
  back: { background: 'none', border: 'none', color: '#0a7ea4', cursor: 'pointer', marginBottom: 12, padding: 0 },
  calendar: { marginTop: 8 },
  weekdayRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 },
  weekday: { fontSize: 12, color: '#666', textAlign: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 },
  empty: {},
  day: { aspectRatio: 1, border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14 },
  dayPast: { opacity: 0.4, cursor: 'not-allowed' },
  noSlots: { color: '#666' },
  slotGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  slotBtn: { padding: '10px 16px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' },
  selectedTime: { fontWeight: 600, marginBottom: 16 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 },
  input: { padding: 10, border: '1px solid #ccc', borderRadius: 8 },
  submitError: { color: '#c00', fontSize: 14 },
  submit: { padding: 12, background: '#0a7ea4', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  successTitle: { margin: '0 0 8px', color: '#0a7ea4' },
};
