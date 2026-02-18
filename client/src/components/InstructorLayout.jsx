import { Outlet, Link, useLocation } from 'react-router-dom';
import { theme } from '../styles/theme';
import { getBasePath } from '../utils/basePath';

export default function InstructorLayout() {
  const location = useLocation();
  const path = location.pathname;
  const basePath = getBasePath(path);

  const isScheduling = path === basePath || path.startsWith(`${basePath}/new`) || path.includes('/edit');
  const isBookings = path === `${basePath}/bookings`;

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <Link to="/" style={styles.brand}>Lesson Scheduler</Link>
        <Link to={`${basePath}/new`} style={styles.createBtn}>+ Create</Link>
        <nav style={styles.nav}>
          <Link
            to={basePath}
            style={{
              ...styles.navItem,
              ...(isScheduling ? styles.navItemActive : {}),
            }}
          >
            <span style={styles.navIcon}>🔗</span>
            Scheduling
          </Link>
          <Link
            to={`${basePath}/bookings`}
            style={{
              ...styles.navItem,
              ...(isBookings ? styles.navItemActive : {}),
            }}
          >
            <span style={styles.navIcon}>📅</span>
            Bookings
          </Link>
        </nav>
      </aside>
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: theme.background,
  },
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: theme.cardBg,
    borderRight: `1px solid ${theme.border}`,
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    color: theme.text,
    textDecoration: 'none',
    padding: '4px 0',
  },
  createBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 16px',
    background: theme.primary,
    color: '#fff',
    textDecoration: 'none',
    borderRadius: theme.borderRadius,
    fontWeight: 600,
    fontSize: 14,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: theme.borderRadius,
    color: theme.text,
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
  },
  navItemActive: {
    background: '#eff6ff',
    color: theme.primary,
  },
  navIcon: {
    fontSize: 16,
  },
  main: {
    flex: 1,
    overflow: 'auto',
    padding: 24,
  },
};
