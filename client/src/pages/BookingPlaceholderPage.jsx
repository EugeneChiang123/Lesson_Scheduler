import { theme } from '../styles/theme';

/**
 * Placeholder for "Cancel or edit this booking" link in confirmation emails.
 * Full cancel/edit flow will be implemented later.
 */
export default function BookingPlaceholderPage() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Manage booking</h1>
        <p style={styles.message}>Cancel or edit your booking — coming soon.</p>
        <p style={styles.muted}>
          For now, please contact your instructor if you need to change or cancel.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: theme.background,
  },
  card: {
    maxWidth: 420,
    padding: 32,
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    margin: '0 0 16px',
    color: theme.text,
  },
  message: {
    fontSize: 16,
    color: theme.text,
    margin: '0 0 12px',
    lineHeight: 1.5,
  },
  muted: {
    fontSize: 14,
    color: theme.muted,
    margin: 0,
    lineHeight: 1.5,
  },
};
