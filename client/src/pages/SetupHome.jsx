import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../styles/theme';
import { formatAvailability } from '../utils/formatAvailability';

const API = '/api';

function formatDuration(minutes) {
  if (minutes >= 60) return `${minutes / 60} hr.`;
  return `${minutes} min.`;
}

export default function SetupHome() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(null);

  useEffect(() => {
    fetch(`${API}/event-types`)
      .then((r) => r.json())
      .then(setList)
      .finally(() => setLoading(false));
  }, []);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const searchLower = search.trim().toLowerCase();
  const filtered = searchLower
    ? list.filter(
        (et) =>
          (et.name || '').toLowerCase().includes(searchLower) ||
          (et.slug || '').toLowerCase().includes(searchLower)
      )
    : list;

  const copyUrl = (slug) => {
    const url = `${baseUrl}/book/${slug}`;
    navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard'));
    setMenuOpen(null);
  };

  const closeMenu = () => setMenuOpen(null);

  useEffect(() => {
    if (menuOpen != null) {
      const handler = () => closeMenu();
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [menuOpen]);

  return (
    <div style={styles.page}>
      <div style={styles.toolbar}>
        <h1 style={styles.title}>Scheduling</h1>
        <div style={styles.toolbarRight}>
          <input
            type="search"
            placeholder="Search event types"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.search}
          />
          <Link to="/setup/new" style={styles.createBtn}>+ Create</Link>
        </div>
      </div>

      <div style={styles.context}>
        <span style={styles.contextLabel}>Your event types</span>
      </div>

      {loading ? (
        <p style={styles.loading}>Loading…</p>
      ) : filtered.length === 0 ? (
        <section style={styles.card}>
          <p style={styles.empty}>
            {searchLower ? 'No event types match your search.' : 'No event types yet.'}
          </p>
          {searchLower ? (
            <button
              type="button"
              style={styles.createLink}
              onClick={() => setSearch('')}
            >
              Clear search
            </button>
          ) : (
            <Link to="/setup/new" style={styles.createLink}>
              Create your first event
            </Link>
          )}
        </section>
      ) : (
        <div style={styles.cardList}>
          {filtered.map((et) => (
            <div key={et.id} style={styles.eventCard}>
              <div style={styles.cardMain}>
                <strong style={styles.cardName}>{et.name}</strong>
                <div style={styles.cardMeta}>
                  <span>{formatDuration(et.durationMinutes || 30)}</span>
                  <span>One-on-One</span>
                  <span>{formatAvailability(et.availability)}</span>
                </div>
                {et.allowRecurring && et.recurringCount > 1 && (
                  <span style={styles.recurringBadge}>
                    Recurring ({et.recurringCount} sessions)
                  </span>
                )}
              </div>
              <div style={styles.cardActions}>
                <button
                  type="button"
                  style={styles.previewBtn}
                  onClick={() => window.open(`${baseUrl}/book/${et.slug}`, '_blank')}
                  title="Open booking page"
                >
                  Open
                </button>
                <button
                  type="button"
                  style={styles.copyBtn}
                  onClick={() => copyUrl(et.slug)}
                  title="Copy link"
                >
                  🔗 Copy link
                </button>
                <div style={styles.menuWrap}>
                  <button
                    type="button"
                    style={styles.menuBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === et.id ? null : et.id);
                    }}
                    aria-label="More options"
                  >
                    ⋮
                  </button>
                  {menuOpen === et.id && (
                    <div style={styles.menu} onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/setup/${et.id}/edit`}
                        style={styles.menuItem}
                        onClick={closeMenu}
                      >
                        Edit
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 800 },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  },
  title: { margin: 0, fontSize: 22, fontWeight: 600, color: theme.text },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: 12 },
  search: {
    padding: '8px 12px',
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    fontSize: 14,
    width: 200,
  },
  createBtn: {
    padding: '8px 16px',
    background: theme.primary,
    color: '#fff',
    textDecoration: 'none',
    borderRadius: theme.borderRadius,
    fontWeight: 600,
    fontSize: 14,
  },
  context: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  contextLabel: { fontSize: 14, fontWeight: 500, color: theme.text },
  loading: { color: theme.muted },
  card: {
    background: theme.cardBg,
    borderRadius: theme.borderRadiusLg,
    padding: 28,
    boxShadow: theme.shadowCard,
    border: `1px solid ${theme.border}`,
  },
  empty: { color: theme.muted, marginBottom: 12 },
  createLink: {
    color: theme.primary,
    fontWeight: 600,
    textDecoration: 'none',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    font: 'inherit',
  },
  cardList: { display: 'flex', flexDirection: 'column', gap: 12 },
  eventCard: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    padding: 16,
    background: theme.cardBg,
    borderRadius: theme.borderRadiusLg,
    border: `1px solid ${theme.border}`,
    boxShadow: theme.shadow,
  },
  cardMain: { flex: 1, minWidth: 0 },
  cardName: { display: 'block', fontSize: 16, marginBottom: 8 },
  cardMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px 16px',
    fontSize: 14,
    color: theme.muted,
  },
  recurringBadge: {
    display: 'inline-block',
    fontSize: 12,
    color: theme.primary,
    fontWeight: 500,
    marginTop: 6,
  },
  cardActions: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  previewBtn: {
    padding: '6px 12px',
    background: '#f3f4f6',
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    fontSize: 14,
    color: theme.primary,
  },
  copyBtn: {
    padding: '6px 12px',
    background: '#f3f4f6',
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    fontSize: 14,
  },
  menuWrap: { position: 'relative' },
  menuBtn: {
    padding: '6px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    fontSize: 18,
    color: theme.muted,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    background: theme.cardBg,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    boxShadow: theme.shadow,
    padding: 4,
    zIndex: 10,
  },
  menuItem: {
    display: 'block',
    padding: '8px 12px',
    color: theme.text,
    textDecoration: 'none',
    fontSize: 14,
    borderRadius: 4,
  },
};
