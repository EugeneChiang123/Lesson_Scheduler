import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

const API = '/api';
const DAYS = [{ id: 0, label: 'Sun' }, { id: 1, label: 'Mon' }, { id: 2, label: 'Tue' }, { id: 3, label: 'Wed' }, { id: 4, label: 'Thu' }, { id: 5, label: 'Fri' }, { id: 6, label: 'Sat' }];

const emptyForm = {
  slug: '',
  name: '',
  description: '',
  durationMinutes: 30,
  allowRecurring: false,
  recurringCount: 4,
  availability: [],
};

export default function SetupEventForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    fetch(`${API}/event-types/id/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found'))))
      .then((et) => {
        setForm({
          slug: et.slug,
          name: et.name,
          description: et.description || '',
          durationMinutes: et.durationMinutes ?? 30,
          allowRecurring: et.allowRecurring ?? false,
          recurringCount: et.recurringCount ?? 4,
          availability: Array.isArray(et.availability) ? et.availability : [],
        });
      })
      .catch(() => navigate('/setup'))
      .finally(() => setLoading(false));
  }, [id, isEdit, navigate]);

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
      ? fetch(`${API}/event-types/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : fetch(`${API}/event-types`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    promise
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(new Error(d.error || 'Failed')))))
      .then(() => navigate('/setup'))
      .catch((e) => { alert(e.message); setSaving(false); });
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  if (loading) return <div style={styles.page}>Loading…</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <Link to="/setup" style={styles.backLink}>← Back to events</Link>
        <h1 style={styles.title}>{isEdit ? 'Edit event type' : 'New event type'}</h1>
      </header>

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
          <Link to="/setup" style={styles.cancelLink}>Cancel</Link>
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: { maxWidth: 640, margin: '0 auto', padding: 24 },
  header: { marginBottom: 24 },
  backLink: { color: '#0a7ea4', textDecoration: 'none', marginBottom: 8, display: 'inline-block' },
  title: { margin: 0, fontSize: 24 },
  card: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  field: { marginBottom: 16 },
  label: { display: 'block', marginBottom: 4, fontSize: 14 },
  input: { width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 8 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  urlPreview: { fontSize: 12, color: '#666', marginTop: 4 },
  hint: { color: '#666', fontSize: 14, marginTop: 4 },
  dayRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  dayLabel: { width: 36 },
  windowRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  timeInput: { padding: 6, border: '1px solid #ccc', borderRadius: 6 },
  smallBtn: { padding: '4px 8px', fontSize: 12, background: '#f0f0f0', border: 'none', borderRadius: 6, cursor: 'pointer' },
  actions: { display: 'flex', gap: 12, marginTop: 16, alignItems: 'center' },
  primaryBtn: { padding: '10px 20px', background: '#0a7ea4', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  cancelLink: { color: '#666', textDecoration: 'none' },
};
