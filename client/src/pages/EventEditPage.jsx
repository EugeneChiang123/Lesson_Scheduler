import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { theme } from '../styles/theme';

const API = '/api';

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
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    dateStr: '',
    timeStr: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  });

  useEffect(() => {
    fetch(`${API}/bookings/${bookingId}`)
      .then((r) => {
        if (!r.ok) {
          if (r.status === 404) return null;
          return r.json().then((d) => Promise.reject(new Error(d.error || 'Failed')));
        }
        return r.json();
      })
      .then((data) => {
        if (!data) {
          navigate('/setup/bookings', { replace: true });
          return;
        }
        setBooking(data);
        const { dateStr, timeStr } = parseDateTime(data.start_time, data.end_time);
        setForm({
          dateStr,
          timeStr,
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          email: data.email || '',
          phone: data.phone || '',
          notes: data.notes || '',
        });
      })
      .catch(() => navigate('/setup/bookings', { replace: true }))
      .finally(() => setLoading(false));
  }, [bookingId, navigate]);

  const handleSave = () => {
    if (!booking) return;
    const { firstName, lastName, email, dateStr, timeStr, phone, notes } = form;
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
    setSaving(true);
    fetch(`${API}/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone != null ? String(phone).trim() : '',
        startTime,
        notes: notes != null ? String(notes) : '',
      }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d.error || 'Failed')));
        return r.json();
      })
      .then(() => navigate('/setup/bookings'))
      .catch((e) => {
        alert(e.message);
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
    fetch(`${API}/bookings/${bookingId}`, { method: 'DELETE' })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d.error || 'Failed')));
      })
      .then(() => navigate('/setup/bookings'))
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
          <Link to="/setup/bookings" style={styles.cancelLink}>Cancel</Link>
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
