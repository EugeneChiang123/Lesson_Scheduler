import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Lesson Scheduler</h1>
        <p style={styles.subtitle}>Book lessons with your instructor in one click.</p>
      </header>
      <main style={styles.main}>
        <p style={styles.hint}>Use your instructor’s booking link to pick a time, or go to setup to create event types.</p>
        <div style={styles.actions}>
          <Link to="/setup" style={styles.setupLink}>Instructor setup</Link>
          <span style={styles.or}>or</span>
          <Link to="/book/30min-intro" style={styles.bookLink}>Book (example: 30min-intro)</Link>
        </div>
      </main>
    </div>
  );
}

const styles = {
  page: { maxWidth: 560, margin: '0 auto', padding: 24 },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 700, margin: '0 0 8px' },
  subtitle: { margin: 0, color: '#555' },
  main: { marginTop: 24 },
  hint: { color: '#666', marginBottom: 16 },
  actions: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  setupLink: { color: '#0a7ea4', fontWeight: 600, textDecoration: 'none' },
  bookLink: { color: '#0a7ea4', fontWeight: 600, textDecoration: 'none' },
  or: { color: '#888', fontSize: 14 },
};
