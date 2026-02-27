import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { theme } from '../styles/theme';
import { formatAvailability } from '../utils/formatAvailability';
import { formatDuration } from '../utils/formatDuration';
import { getBasePath } from '../utils/basePath';
import { useApi } from '../api';

export default function SetupHome() {
  const location = useLocation();
  const basePath = getBasePath(location.pathname);
  const { apiFetch } = useApi();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(null);

  useEffect(() => {
    apiFetch('/event-types')
      .then((r) => r.json())
      .then(setList)
      .finally(() => setLoading(false));
  }, [apiFetch]);

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
          <Link to={`${basePath}/new`} style={styles.createBtn}>+ Create</Link>
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
            <Link to={`${basePath}/new`} style={styles.createLink}>
              Create your first event
            </Link>
          )}
        </section>
      ) : (
        <div style={styles.cardList}>
          {filtered.map((et) => (
            <div key={et.id} style={styles.eventCard} data-card-hover>
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
                <a
                  href={`${baseUrl}/book/${et.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...styles.previewBtn, textDecoration: 'none' }}
                  title="Open booking page"
                >
                  Open
                </a>
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
                        to={`${basePath}/${et.id}/edit`}
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
    gap: theme.spacing[16],
    marginBottom: theme.spacing[24],
  },
  title: { margin: 0, fontSize: theme.fontSize.title, fontWeight: 600, color: theme.text },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: theme.spacing[12] },
  search: {
    padding: `${theme.spacing[8]}px ${theme.spacing[12]}px`,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    fontSize: theme.fontSize.base,
    width: 200,
    transition: theme.transition,
  },
  createBtn: {
    padding: `${theme.spacing[8]}px ${theme.spacing[16]}px`,
    background: theme.primary,
    color: '#fff',
    textDecoration: 'none',
    borderRadius: theme.borderRadius,
    fontWeight: 600,
    fontSize: theme.fontSize.base,
    transition: theme.transition,
  },
  context: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing[12],
    marginBottom: theme.spacing[20],
  },
  contextLabel: { fontSize: theme.fontSize.base, fontWeight: 500, color: theme.text },
  loading: { color: theme.muted },
  card: {
    background: theme.cardBg,
    borderRadius: theme.borderRadiusLg,
    padding: theme.spacing[28],
    boxShadow: theme.shadowCard,
    border: `1px solid ${theme.border}`,
  },
  empty: { color: theme.muted, marginBottom: theme.spacing[12] },
  createLink: {
    color: theme.primary,
    fontWeight: 600,
    textDecoration: 'none',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    font: 'inherit',
    transition: theme.transition,
  },
  cardList: { display: 'flex', flexDirection: 'column', gap: theme.spacing[12] },
  eventCard: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing[16],
    padding: theme.spacing[16],
    background: theme.cardBg,
    borderRadius: theme.borderRadiusLg,
    border: `1px solid ${theme.border}`,
    boxShadow: theme.shadow,
    transition: theme.transition,
  },
  cardMain: { flex: 1, minWidth: 0 },
  cardName: { display: 'block', fontSize: theme.fontSize.lg, marginBottom: theme.spacing[8] },
  cardMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: `${theme.spacing[8]}px ${theme.spacing[16]}px`,
    fontSize: theme.fontSize.base,
    color: theme.muted,
  },
  recurringBadge: {
    display: 'inline-block',
    fontSize: theme.fontSize.sm,
    color: theme.primary,
    fontWeight: 500,
    marginTop: theme.spacing[6],
  },
  cardActions: { display: 'flex', alignItems: 'center', gap: theme.spacing[8], flexShrink: 0 },
  previewBtn: {
    padding: `${theme.spacing[6]}px ${theme.spacing[12]}px`,
    background: theme.secondaryBg,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    fontSize: theme.fontSize.base,
    color: theme.primary,
    transition: theme.transition,
  },
  copyBtn: {
    padding: `${theme.spacing[6]}px ${theme.spacing[12]}px`,
    background: theme.secondaryBg,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    fontSize: theme.fontSize.base,
    transition: theme.transition,
  },
  menuWrap: { position: 'relative' },
  menuBtn: {
    padding: `${theme.spacing[6]}px ${theme.spacing[10]}px`,
    background: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    fontSize: theme.fontSize.xl,
    color: theme.muted,
    transition: theme.transition,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: theme.spacing[4],
    background: theme.cardBg,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    boxShadow: theme.shadow,
    padding: theme.spacing[4],
    zIndex: 10,
  },
  menuItem: {
    display: 'block',
    padding: `${theme.spacing[8]}px ${theme.spacing[12]}px`,
    color: theme.text,
    textDecoration: 'none',
    fontSize: theme.fontSize.base,
    borderRadius: theme.borderRadius,
    transition: theme.transition,
  },
};
