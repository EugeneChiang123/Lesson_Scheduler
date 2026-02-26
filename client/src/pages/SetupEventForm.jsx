import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { theme } from '../styles/theme';
import { getBasePath } from '../utils/basePath';
import { useApi } from '../api';
const DAYS = [{ id: 0, label: 'Sun' }, { id: 1, label: 'Mon' }, { id: 2, label: 'Tue' }, { id: 3, label: 'Wed' }, { id: 4, label: 'Thu' }, { id: 5, label: 'Fri' }, { id: 6, label: 'Sat' }];

const emptyForm = {
  slug: '',
  name: '',
  description: '',
  durationMinutes: 30,
  location: '',
  allowRecurring: false,
  recurringCount: 4,
  availability: [],
};

export default function SetupEventForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = getBasePath(location.pathname);
  const { apiFetch } = useApi();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    apiFetch(`/event-types/id/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found'))))
      .then((et) => {
        setForm({
          slug: et.slug,
          name: et.name,
          description: et.description || '',
          durationMinutes: et.durationMinutes ?? 30,
          location: et.location ?? '',
          allowRecurring: et.allowRecurring ?? false,
          recurringCount: et.recurringCount ?? 4,
          availability: Array.isArray(et.availability) ? et.availability : [],
        });
      })
      .catch(() => navigate(basePath))
      .finally(() => setLoading(false));
  }, [id, isEdit, navigate, apiFetch, basePath]);

  const addWindow = (day) => {
    setForm((f) => ({
      ...f,
      availability: [...f.availability, { day, start: '09:00', end: '17:00' }],
    }));
  };

  const updateWindow = (index, field, value) => {
    setForm((f) => ({
      ...f,
      availability: f.availability.map((w, i) => (i === index ? { ...w, [field]: value } : w)),
    }));
  };

  const removeWindow = (index) => {
    setForm((f) => ({ ...f, availability: f.availability.filter((_, i) => i !== index) }));
  };

  const save = () => {
    const payload = { ...form, availability: form.availability };
    setSaving(true);
    const promise = isEdit
      ? apiFetch(`/event-types/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : apiFetch('/event-types', { method: 'POST', body: JSON.stringify(payload) });
    promise
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(new Error(d.error || 'Failed')))))
      .then(() => navigate(basePath))
      .catch((e) => { alert(e.message); setSaving(false); });
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  if (loading) return <div style={styles.page}>Loading…</div>;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>{isEdit ? 'Edit event type' : 'New event type'}</h1>

      <section style={styles.card}>
        <div style={styles.field}>
          <label>Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. 30 min intro"
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label>URL slug</label>
          <input
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase() }))}
            placeholder="30min-intro"
            style={styles.input}
            readOnly={isEdit}
          />
          {form.slug && <p style={styles.urlPreview}>Booking URL: {baseUrl}/book/{form.slug}</p>}
        </div>
        <div style={styles.field}>
          <label>Description (shown to student)</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
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
            {[15, 30, 45, 60].map((n) => (
              <option key={n} value={n}>{n} min</option>
            ))}
          </select>
        </div>
        <div style={styles.field}>
          <label>Location</label>
          <input
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="e.g. Room 3, Zoom link"
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.checkLabel}>
            <input
              type="checkbox"
              checked={form.allowRecurring}
              onChange={(e) => setForm((f) => ({ ...f, allowRecurring: e.target.checked }))}
            />
            Allow recurring bookings (student gets multiple sessions at same time each week)
          </label>
        </div>
        {form.allowRecurring && (
          <div style={styles.field}>
            <label>Number of repeated bookings</label>
            <input
              type="number"
              min={2}
              max={52}
              value={form.recurringCount}
              onChange={(e) => setForm((f) => ({ ...f, recurringCount: Math.min(52, Math.max(2, Number(e.target.value) || 2)) }))}
              style={styles.input}
            />
            <p style={styles.hint}>Student will be booked for this many weekly sessions in a row.</p>
          </div>
        )}
        <div style={styles.field}>
          <label>Weekly availability</label>
          {form.availability.length === 0 && <p style={styles.hint}>Add time windows per weekday.</p>}
          {DAYS.map((d) => (
            <div key={d.id} style={styles.dayRow}>
              <span style={styles.dayLabel}>{d.label}</span>
              <button type="button" style={styles.smallBtn} onClick={() => addWindow(d.id)}>+ Add</button>
            </div>
          ))}
          {form.availability.map((w, i) => (
            <div key={i} style={styles.windowRow}>
              <span style={styles.dayLabel}>{DAYS.find((d) => d.id === w.day)?.label ?? w.day}</span>
              <input
                type="time"
                value={w.start}
                onChange={(e) => updateWindow(i, 'start', e.target.value)}
                style={styles.timeInput}
              />
              <span>–</span>
              <input
                type="time"
                value={w.end}
                onChange={(e) => updateWindow(i, 'end', e.target.value)}
                style={styles.timeInput}
              />
              <button type="button" style={styles.smallBtn} onClick={() => removeWindow(i)}>Remove</button>
            </div>
          ))}
        </div>
        <div style={styles.actions}>
          <button type="button" style={styles.primaryBtn} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link to={basePath} style={styles.cancelLink}>Cancel</Link>
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: { maxWidth: 640 },
  title: { margin: `0 0 ${theme.spacing[24]}px`, fontSize: theme.fontSize.title, fontWeight: 600, color: theme.text },
  card: {
    background: theme.cardBg,
    borderRadius: theme.borderRadiusLg,
    padding: theme.spacing[24],
    boxShadow: theme.shadowCard,
    border: `1px solid ${theme.border}`,
  },
  field: { marginBottom: theme.spacing[16] },
  label: { display: 'block', marginBottom: theme.spacing[4], fontSize: theme.fontSize.base },
  input: {
    width: '100%',
    padding: theme.spacing[10],
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    transition: theme.transition,
  },
  checkLabel: { display: 'flex', alignItems: 'center', gap: theme.spacing[8], cursor: 'pointer' },
  urlPreview: { fontSize: theme.fontSize.sm, color: theme.muted, marginTop: theme.spacing[4] },
  hint: { color: theme.muted, fontSize: theme.fontSize.base, marginTop: theme.spacing[4] },
  dayRow: { display: 'flex', alignItems: 'center', gap: theme.spacing[8], marginBottom: theme.spacing[4] },
  dayLabel: { width: 36 },
  windowRow: { display: 'flex', alignItems: 'center', gap: theme.spacing[8], marginBottom: theme.spacing[8] },
  timeInput: {
    padding: theme.spacing[6],
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    transition: theme.transition,
  },
  smallBtn: {
    padding: `${theme.spacing[4]}px ${theme.spacing[8]}px`,
    fontSize: theme.fontSize.sm,
    background: theme.secondaryBg,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    transition: theme.transition,
  },
  actions: { display: 'flex', gap: theme.spacing[12], marginTop: theme.spacing[16], alignItems: 'center' },
  primaryBtn: {
    padding: `${theme.spacing[10]}px ${theme.spacing[20]}px`,
    background: theme.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    fontWeight: 600,
    transition: theme.transition,
  },
  cancelLink: { color: theme.muted, textDecoration: 'none', transition: theme.transition },
};
