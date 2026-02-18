import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { theme } from '../styles/theme';
import { getBasePath } from '../utils/basePath';
import { useApi } from '../api';

function parseDateTime(startTime, endTime) {
  const s = (startTime || '').replace(' ', 'T').substring(0, 19);
  const e = (endTime || '').replace(' ', 'T').substring(0, 19);
  const start = s ? new Date(s) : null;
  const end = e ? new Date(e) : null;
  const dateStr = start ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}` : '';
  const timeStr = start ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` : '';
  return { dateStr, timeStr, start, end };
}

export default function EventEditPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = getBasePath(location.pathname);
  const bookingsPath = `${basePath}/bookings`;
  const { apiFetch } = useApi();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    dateStr: '',
    timeStr: '',
    durationMinutes: 30,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [overlapError, setOverlapError] = useState(null);

  useEffect(() => {
    apiFetch(`/bookings/${bookingId}`)
      .then((r) => {
        if (!r.ok) {
          if (r.status === 404) return null;
          return r.json().then((d) => Promise.reject(new Error(d.error || 'Failed')));
        }
        return r.json();
      })
      .then((data) => {
        if (!data) {
          navigate(bookingsPath, { replace: true });
          return;
        }
        setBooking(data);
        const { dateStr, timeStr } = parseDateTime(data.start_time, data.end_time);
        const durationMinutes = data.duration_minutes != null ? data.duration_minutes : 30;
        setForm({
          dateStr,
          timeStr,
          durationMinutes,
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          email: data.email || '',
          phone: data.phone || '',
          notes: data.notes || '',
        });
        setOverlapError(null);
      })
      .catch(() => navigate(bookingsPath, { replace: true }))
      .finally(() => setLoading(false));
  }, [bookingId, navigate, apiFetch]);

  const handleSave = () => {
    if (!booking) return;
    setOverlapError(null);
    const { firstName, lastName, email, dateStr, timeStr, durationMinutes, phone, notes } = form;
    if (!firstName.trim()) {
      alert('First name is required');
      return;
    }
    if (!lastName.trim()) {
      alert('Last name is required');
      return;
    }
    if (!email.trim()) {
      alert('Email is required');
      return;
    }
    if (!dateStr || !timeStr) {
      alert('Date and time are required');
      return;
    }
    const startTime = `${dateStr}T${timeStr}:00`;
    const existingStart = (booking.start_time || '').replace(' ', 'T').substring(0, 19);
    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone != null ? String(phone).trim() : '',
      notes: notes != null ? String(notes) : '',
    };
    if (startTime !== existingStart) payload.startTime = startTime;
    if (durationMinutes !== booking.duration_minutes) payload.durationMinutes = durationMinutes;
    setSaving(true);
    apiFetch(`/bookings/${bookingId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
      .then((r) => {
        if (!r.ok) {
          return r.json().then((d) => Promise.reject({ status: r.status, error: d.error, conflictingStart: d.conflictingStart }));
        }
        return r.json();
      })
      .then(() => navigate(bookingsPath))
      .catch((e) => {
        if (e.status === 409) {
          setOverlapError(e.error || 'This time would overlap with another lesson. Try a shorter duration or a different time.');
          apiFetch(`/bookings/${bookingId}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
              if (data) {
                const { dateStr, timeStr } = parseDateTime(data.start_time, data.end_time);
                const durationMinutes = data.duration_minutes != null ? data.duration_minutes : 30;
                setBooking(data);
                setForm({
                  dateStr,
                  timeStr,
                  durationMinutes,
                  firstName: data.first_name || '',
                  lastName: data.last_name || '',
                  email: data.email || '',
                  phone: data.phone || '',
                  notes: data.notes || '',
                });
              }
            })
            .catch(() => {});
        } else {
          alert(e.error || e.message || 'Failed to save');
        }
        setSaving(false);
      });
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (!booking) return;
    setDeleting(true);
    apiFetch(`/bookings/${bookingId}`, { method: 'DELETE' })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d.error || 'Failed')));
      })
      .then(() => navigate(bookingsPath))
      .catch((e) => {
        alert(e.message);
        setDeleting(false);
      });
  };

  if (loading || !booking) return <div style={styles.page}>Loading…</div>;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Edit event</h1>

      <section style={styles.card}>
        {booking.event_type_name && (
          <div style={styles.context}>
            <strong>{booking.event_type_name}</strong>
            {booking.recurring_session && (
              <span style={styles.recurringBadge}>
                Session {booking.recurring_session.index} of {booking.recurring_session.total}
              </span>
            )}
          </div>
        )}

        <div style={styles.field}>
          <label>Date</label>
          <input
            type="date"
            value={form.dateStr}
            onChange={(e) => setForm((f) => ({ ...f, dateStr: e.target.value }))}
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label>Time</label>
          <input
            type="time"
            value={form.timeStr}
            onChange={(e) => setForm((f) => ({ ...f, timeStr: e.target.value }))}
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label>Duration (minutes)</label>
          <select
            value={form.durationMinutes}
            onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
            style={styles.input}
          >
            {[15, 30, 45, 60].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </div>
        {overlapError && (
          <div style={styles.errorBox}>{overlapError}</div>
        )}
        <div style={styles.field}>
          <label>First name</label>
          <input
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label>Last name</label>
          <input
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label>Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label>Notes (additional details)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            style={styles.input}
          />
        </div>

        <div style={styles.actions}>
          <button type="button" style={styles.primaryBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link to={bookingsPath} style={styles.cancelLink}>Cancel</Link>
        </div>

        <div style={styles.deleteSection}>
          <button
            type="button"
            style={styles.deleteBtn}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : confirmDelete ? 'Confirm delete' : 'Delete event'}
          </button>
          {confirmDelete && !deleting && (
            <button
              type="button"
              style={styles.cancelLink}
              onClick={() => setConfirmDelete(false)}
            >
              Keep event
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: { maxWidth: 640 },
  title: { margin: '0 0 24px', fontSize: 22, fontWeight: 600, color: theme.text },
  card: {
    background: theme.cardBg,
    borderRadius: theme.borderRadiusLg,
    padding: 24,
    boxShadow: theme.shadowCard,
    border: `1px solid ${theme.border}`,
  },
  context: { marginBottom: 20, fontSize: 14, color: theme.muted },
  recurringBadge: { marginLeft: 8, color: theme.primary, fontWeight: 500 },
  field: { marginBottom: 16 },
  label: { display: 'block', marginBottom: 4, fontSize: 14 },
  input: {
    width: '100%',
    padding: 10,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
  },
  actions: { display: 'flex', gap: 12, marginTop: 24, alignItems: 'center' },
  primaryBtn: {
    padding: '10px 20px',
    background: theme.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    fontWeight: 600,
  },
  cancelLink: { color: theme.muted, textDecoration: 'none', marginLeft: 8 },
  errorBox: {
    marginBottom: 16,
    padding: 12,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: theme.borderRadius,
    color: '#b91c1c',
    fontSize: 14,
  },
  deleteSection: { marginTop: 32, paddingTop: 24, borderTop: `1px solid ${theme.border}` },
  deleteBtn: {
    padding: '8px 16px',
    background: '#fff',
    color: '#b91c1c',
    border: '1px solid #b91c1c',
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    fontSize: 14,
  },
};
