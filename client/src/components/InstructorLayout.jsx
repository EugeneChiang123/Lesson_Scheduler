import { Outlet, Link, useLocation } from 'react-router-dom';
import { theme } from '../styles/theme';
import { getBasePath } from '../utils/basePath';

export default function InstructorLayout() {
  const location = useLocation();
  const path = location.pathname;
  const basePath = getBasePath(path);

  const isScheduling = path === basePath || path.startsWith(`${basePath}/new`) || path.includes('/edit');
  const isBookings = path === `${basePath}/bookings` || path.startsWith(`${basePath}/bookings/`);

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
    padding: `${theme.spacing[20]}px ${theme.spacing[16]}px`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing[16],
  },
  brand: {
    fontSize: theme.fontSize.xl,
    fontWeight: 700,
    color: theme.text,
    textDecoration: 'none',
    padding: `${theme.spacing[4]}px 0`,
    transition: theme.transition,
  },
  createBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${theme.spacing[10]}px ${theme.spacing[16]}px`,
    background: theme.primary,
    color: '#fff',
    textDecoration: 'none',
    borderRadius: theme.borderRadius,
    fontWeight: 600,
    fontSize: theme.fontSize.base,
    transition: theme.transition,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing[4],
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing[10],
    padding: `${theme.spacing[10]}px ${theme.spacing[12]}px`,
    borderRadius: theme.borderRadius,
    color: theme.text,
    textDecoration: 'none',
    fontSize: theme.fontSize.base,
    fontWeight: 500,
    transition: theme.transition,
  },
  navItemActive: {
    background: theme.navActiveBg,
    color: theme.primary,
  },
  navIcon: {
    fontSize: theme.fontSize.lg,
  },
  main: {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing[24],
  },
};
