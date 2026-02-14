const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname);
const eventTypesPath = path.join(dataDir, 'event_types.json');
const bookingsPath = path.join(dataDir, 'bookings.json');

function readEventTypes() {
  try {
    const raw = fs.readFileSync(eventTypesPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function writeEventTypes(data) {
  fs.writeFileSync(eventTypesPath, JSON.stringify(data, null, 2), 'utf8');
}

function readBookings() {
  try {
    const raw = fs.readFileSync(bookingsPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function writeBookings(data) {
  fs.writeFileSync(bookingsPath, JSON.stringify(data, null, 2), 'utf8');
}

let eventTypeId = 1;
let bookingId = 1;

function initIds() {
  const et = readEventTypes();
  const bk = readBookings();
  if (et.length) eventTypeId = Math.max(...et.map((e) => e.id)) + 1;
  if (bk.length) bookingId = Math.max(...bk.map((b) => b.id)) + 1;
}
initIds();

const store = {
  eventTypes: {
    all() {
      return readEventTypes();
    },
    getBySlug(slug) {
      return readEventTypes().find((e) => e.slug === slug) || null;
    },
    getById(id) {
      return readEventTypes().find((e) => e.id === Number(id)) || null;
    },
    create(data) {
      const list = readEventTypes();
      if (list.some((e) => e.slug === data.slug)) throw new Error('Slug already exists');
      const row = {
        id: eventTypeId++,
        slug: data.slug,
        name: data.name,
        description: data.description || '',
        durationMinutes: data.durationMinutes ?? 30,
        allowRecurring: Boolean(data.allowRecurring),
        recurringCount: Math.max(1, data.recurringCount ?? 1),
        availability: Array.isArray(data.availability) ? data.availability : [],
      };
      list.push(row);
      writeEventTypes(list);
      return row;
    },
    update(id, data) {
      const list = readEventTypes();
      const idx = list.findIndex((e) => e.id === Number(id));
      if (idx === -1) return null;
      if (data.slug !== undefined && list.some((e) => e.id !== Number(id) && e.slug === data.slug)) throw new Error('Slug already exists');
      const row = list[idx];
      const updated = {
        ...row,
        slug: data.slug !== undefined ? data.slug : row.slug,
        name: data.name !== undefined ? data.name : row.name,
        description: data.description !== undefined ? data.description : row.description,
        durationMinutes: data.durationMinutes !== undefined ? data.durationMinutes : row.durationMinutes,
        allowRecurring: data.allowRecurring !== undefined ? Boolean(data.allowRecurring) : row.allowRecurring,
        recurringCount: data.recurringCount !== undefined ? Math.max(1, data.recurringCount) : row.recurringCount,
        availability: data.availability !== undefined ? data.availability : row.availability,
      };
      list[idx] = updated;
      writeEventTypes(list);
      return updated;
    },
  },
  bookings: {
    list() {
      return readBookings();
    },
    getByEventTypeAndDate(eventTypeId, dateStr) {
      return readBookings().filter((b) => b.event_type_id === eventTypeId && (b.start_time.startsWith(dateStr) || b.start_time.replace(' ', 'T').startsWith(dateStr)));
    },
    findOverlapping(eventTypeId, startTime, endTime) {
      const list = readBookings();
      const start = startTime.replace(' ', 'T');
      const end = endTime.replace(' ', 'T');
      return list.find((b) => {
        if (b.event_type_id !== eventTypeId) return false;
        const bStart = b.start_time.replace(' ', 'T');
        const bEnd = b.end_time.replace(' ', 'T');
        return (start < bEnd && end > bStart);
      });
    },
    insert(record) {
      const list = readBookings();
      const row = { id: bookingId++, ...record };
      list.push(row);
      writeBookings(list);
      return row;
    },
  },
};

module.exports = store;
