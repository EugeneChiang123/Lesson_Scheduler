import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API = '/api';

function parseDt(str) {
  const s = (str || '').replace(' ', 'T').substring(0, 19);
  return s ? new Date(s) : null;
}

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStartOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getEndOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default function BookingsCalendar() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('month');
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    fetch(`${API}/bookings`)
      .then((r) => r.json())
      .then(setBookings)
      .finally(() => setLoading(false));
  }, []);

  const bookingsWithDates = bookings.map((b) => ({
    ...b,
    start: parseDt(b.start_time),
    end: parseDt(b.end_time),
  })).filter((b) => b.start && b.end);

  const goPrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const title = () => {
    if (viewMode === 'month') return currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (viewMode === 'week') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getBookingsForDay = (dayStart) => {
    const key = dateKey(dayStart);
    return bookingsWithDates.filter((b) => dateKey(b.start) === key);
  };

  const getBookingsForWeek = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return bookingsWithDates.filter((b) => b.start >= start && b.start < end);
  };

  const getBookingsForDayView = () => getBookingsForDay(currentDate);

  if (loading) return <div style={styles.page}>Loading…</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <Link to="/setup" style={styles.backLink}>← Back to events</Link>
        <h1 style={styles.title}>Bookings</h1>
      </header>

      <div style={styles.toolbar}>
        <div style={styles.nav}>
          <button type="button" style={styles.navBtn} onClick={goPrev} aria-label="Previous">‹</button>
          <button type="button" style={styles.todayBtn} onClick={goToday}>Today</button>
          <button type="button" style={styles.navBtn} onClick={goNext} aria-label="Next">›</button>
        </div>
        <span style={styles.titleText}>{title()}</span>
        <div style={styles.viewToggle}>
          {['day', 'week', 'month'].map((v) => (
            <button
              key={v}
              type="button"
              style={{ ...styles.viewBtn, ...(viewMode === v ? styles.viewBtnActive : {}) }}
              onClick={() => setViewMode(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'month' && (
        <MonthView currentDate={currentDate} bookings={bookingsWithDates} getBookingsForDay={getBookingsForDay} />
      )}
      {viewMode === 'week' && (
        <WeekView currentDate={currentDate} bookings={getBookingsForWeek()} />
      )}
      {viewMode === 'day' && (
        <DayView currentDate={currentDate} bookings={getBookingsForDayView()} />
      )}
    </div>
  );
}

function MonthView({ currentDate, getBookingsForDay }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const firstDay = first.getDay();
  const daysInMonth = last.getDate();
  const prevMonth = new Date(year, month, 0);
  const prevDays = prevMonth.getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    const d = prevDays - firstDay + 1 + i;
    cells.push({ day: d, date: new Date(year, month - 1, d), isOther: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: new Date(year, month, d), isOther: false });
  }
  const remaining = 42 - cells.length;
  for (let i = 0; i < remaining; i++) {
    cells.push({ day: i + 1, date: new Date(year, month + 1, i + 1), isOther: true });
  }

  return (
    <section style={styles.calendar}>
      <div style={styles.weekdayRow}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} style={styles.weekdayCell}>{d}</div>
        ))}
      </div>
      <div style={styles.grid}>
        {cells.map((cell, i) => {
          const dayBookings = getBookingsForDay(cell.date);
          return (
            <div
              key={i}
              style={{
                ...styles.dayCell,
                ...(cell.isOther ? styles.dayCellOther : {}),
              }}
            >
              <span style={styles.dayNum}>{cell.day}</span>
              {dayBookings.map((b) => (
                <div key={b.id} style={styles.monthEvent} title={`${b.full_name} ${b.start_time}`}>
                  {b.full_name}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WeekView({ currentDate, bookings }) {
  const start = new Date(currentDate);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getBookingsForDayAndHour = (day, hour) => {
    const dayStart = new Date(day);
    dayStart.setHours(hour, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(hour + 1, 0, 0, 0);
    return bookings.filter((b) => {
      const bDay = dateKey(b.start);
      const dDay = dateKey(day);
      if (bDay !== dDay) return false;
      const h = b.start.getHours();
      return h === hour;
    });
  };

  return (
    <section style={styles.weekSection}>
      <div style={styles.weekGrid}>
        <div style={styles.weekTimeCol}>
          {hours.map((h) => (
            <div key={h} style={styles.weekTimeCell}>{h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`}</div>
          ))}
        </div>
        {days.map((day) => (
          <div key={day.getTime()} style={styles.weekDayCol}>
            <div style={styles.weekDayHeader}>{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</div>
            {hours.map((hour) => {
              const evs = getBookingsForDayAndHour(day, hour);
              return (
                <div key={hour} style={styles.weekCell}>
                  {evs.map((b) => (
                    <div key={b.id} style={styles.weekEvent} title={b.start_time}>
                      {b.full_name}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function DayView({ currentDate, bookings }) {
  const dayBookings = bookings.sort((a, b) => a.start - b.start);
  const lessonsToday = dayBookings.length;

  return (
    <section style={styles.daySection}>
      <div style={styles.daySummary}>
        {lessonsToday === 0 ? 'No lessons today' : `${lessonsToday} lesson${lessonsToday !== 1 ? 's' : ''} today`}
      </div>
      <div style={styles.dayList}>
        {dayBookings.map((b) => (
          <div key={b.id} style={styles.dayEvent}>
            <div style={styles.dayEventTime}>
              {b.start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              {' – '}
              {b.end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </div>
            <div style={styles.dayEventName}>{b.full_name}</div>
            {b.event_type_name && <div style={styles.dayEventType}>{b.event_type_name}</div>}
            {b.recurring_session && (
              <div style={styles.dayEventRecurring}>
                Session {b.recurring_session.index} of {b.recurring_session.total}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

const BORDER = '#e5e7eb';
const PRIMARY = '#0a7ea4';
const MUTED = '#6b7280';

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f9fafb',
    maxWidth: 960,
    margin: '0 auto',
    padding: '24px 20px',
  },
  header: { marginBottom: 28 },
  backLink: { color: PRIMARY, textDecoration: 'none', marginBottom: 10, display: 'inline-block', fontSize: 14 },
  title: { margin: 0, fontSize: 24, fontWeight: 600, color: '#111' },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  nav: { display: 'flex', gap: 8 },
  navBtn: {
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    background: '#fff',
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 18,
    color: '#374151',
  },
  todayBtn: {
    padding: '8px 16px',
    background: '#fff',
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
  },
  titleText: { fontWeight: 600, flex: 1, fontSize: 16, color: '#111' },
  viewToggle: { display: 'flex', gap: 6 },
  viewBtn: {
    padding: '8px 16px',
    background: '#fff',
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
  },
  viewBtnActive: { background: PRIMARY, color: '#fff', borderColor: PRIMARY },
  calendar: {
    background: '#fff',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    border: `1px solid ${BORDER}`,
  },
  weekdayRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 },
  weekdayCell: { fontSize: 12, fontWeight: 600, color: MUTED, padding: '6px 4px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 },
  dayCell: {
    minHeight: 88,
    padding: 8,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    background: '#fafafa',
  },
  dayCellOther: { background: '#f5f5f5', color: '#9ca3af' },
  dayNum: { fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' },
  monthEvent: {
    fontSize: 12,
    padding: '4px 6px',
    background: '#eff6ff',
    color: '#1e40af',
    borderRadius: 6,
    marginBottom: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  weekSection: {
    background: '#fff',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    border: `1px solid ${BORDER}`,
    overflowX: 'auto',
  },
  weekGrid: { display: 'flex', minWidth: 720 },
  weekTimeCol: { width: 52, flexShrink: 0 },
  weekTimeCell: { height: 44, fontSize: 12, color: MUTED },
  weekDayCol: { flex: 1, minWidth: 90 },
  weekDayHeader: { height: 36, fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#374151' },
  weekCell: { height: 44, borderTop: `1px solid ${BORDER}`, fontSize: 12 },
  weekEvent: {
    padding: '4px 6px',
    background: '#eff6ff',
    color: '#1e40af',
    borderRadius: 6,
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  daySection: {
    background: '#fff',
    borderRadius: 12,
    padding: 28,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    border: `1px solid ${BORDER}`,
  },
  daySummary: { fontSize: 15, color: MUTED, marginBottom: 20, fontWeight: 500 },
  dayList: { display: 'flex', flexDirection: 'column', gap: 12 },
  dayEvent: {
    padding: 16,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    background: '#fafafa',
  },
  dayEventTime: { fontSize: 13, color: MUTED, marginBottom: 6 },
  dayEventName: { fontWeight: 600, marginBottom: 2, fontSize: 15, color: '#111' },
  dayEventType: { fontSize: 14, color: MUTED },
  dayEventRecurring: { fontSize: 13, color: PRIMARY, marginTop: 6, fontWeight: 500 },
};
