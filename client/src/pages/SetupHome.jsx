import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API = '/api';

export default function SetupHome() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/event-types`)
      .then((r) => r.json())
      .then(setList)
      .finally(() => setLoading(false));
  }, []);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const copyUrl = (slug) => {
    const url = `${baseUrl}/book/${slug}`;
    navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard'));
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <Link to="/" style={styles.homeLink}>← Public site</Link>
        <h1 style={styles.title}>Instructor</h1>
        <p style={styles.subtitle}>Your event types and booking links</p>
      </header>

      <div style={styles.topActions}>
        <Link to="/setup/new" style={styles.createBtn}>Create new event</Link>
        <Link to="/setup/bookings" style={styles.bookingsLink}>View bookings</Link>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : list.length === 0 ? (
        <section style={styles.card}>
          <p style={styles.empty}>No event types yet.</p>
          <Link to="/setup/new" style={styles.createLink}>Create your first event</Link>
        </section>
      ) : (
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Event types</h2>
          <ul style={styles.list}>
            {list.map((et) => (
              <li key={et.id} style={styles.listItem}>
                <div style={styles.itemMain}>
                  <strong style={styles.itemName}>{et.name}</strong>
                  <span style={styles.itemMeta}>{et.durationMinutes} min</span>
                  {et.allowRecurring && et.recurringCount > 1 && (
                    <span style={styles.recurringBadge}>Recurring ({et.recurringCount} sessions)</span>
                  )}
                  <code style={styles.slug}>{baseUrl}/book/{et.slug}</code>
                </div>
                <div style={styles.itemActions}>
                  <button type="button" style={styles.copyBtn} onClick={() => copyUrl(et.slug)}>Copy link</button>
                  <Link to={`/setup/${et.id}/edit`} style={styles.editLink}>Edit</Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 640, margin: '0 auto', padding: 24 },
  header: { marginBottom: 24 },
  homeLink: { color: '#0a7ea4', textDecoration: 'none', marginBottom: 8, display: 'inline-block' },
  title: { margin: 0, fontSize: 24 },
  subtitle: { margin: '4px 0 0', color: '#666', fontSize: 14 },
  topActions: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  createBtn: { display: 'inline-block', padding: '10px 20px', background: '#0a7ea4', color: '#fff', textDecoration: 'none', borderRadius: 8, fontWeight: 600 },
  bookingsLink: { display: 'inline-block', padding: '10px 20px', background: '#f0f0f0', color: '#1a1a1a', textDecoration: 'none', borderRadius: 8, fontWeight: 600 },
  card: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  cardTitle: { margin: '0 0 16px', fontSize: 18 },
  empty: { color: '#666', marginBottom: 12 },
  createLink: { color: '#0a7ea4', fontWeight: 600, textDecoration: 'none' },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 0', borderBottom: '1px solid #eee', gap: 16 },
  itemMain: { flex: 1, minWidth: 0 },
  itemName: { display: 'block', marginBottom: 4 },
  itemMeta: { fontSize: 14, color: '#666', marginRight: 8 },
  recurringBadge: { fontSize: 12, color: '#0a7ea4', fontWeight: 500 },
  slug: { display: 'block', fontSize: 12, color: '#666', marginTop: 6, wordBreak: 'break-all' },
  itemActions: { display: 'flex', gap: 8, flexShrink: 0 },
  copyBtn: { padding: '6px 12px', background: '#f0f0f0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  editLink: { padding: '6px 12px', background: '#eee', color: '#1a1a1a', textDecoration: 'none', borderRadius: 6, fontSize: 14 },
};
