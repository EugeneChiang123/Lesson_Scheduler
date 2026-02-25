const express = require('express');
const { DateTime } = require('luxon');
const store = require('../db/store');

const router = express.Router();

/** Slot start time in UTC as ISO string with Z so client and server parse as UTC. */
function toIsoUtc(dt) {
  return dt.toUTC().toISOString().slice(0, 19) + 'Z';
}

/**
 * Generate available slot start times for a date in the event type's time zone.
 * Returns array of UTC ISO-like strings ("YYYY-MM-DD HH:mm:ss") for the client.
 */
function getSlotsForDate(eventType, dateStr) {
  const duration = eventType.durationMinutes ?? 30;
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const tz = eventType.timeZone || eventType.time_zone || 'America/Los_Angeles';
  const availability = eventType.availability || [];
  const zone = DateTime.now().setZone(tz).zone;
  const dayStart = DateTime.fromISO(dateStr + 'T00:00:00', { zone });
  if (!dayStart.isValid) return [];
  // Luxon weekday: 1=Mon..7=Sun → we use 0=Sun,1=Mon..6=Sat to match client (SetupEventForm DAYS).
  const dayNum = dayStart.weekday % 7;
  const windows = availability.filter((a) => Number(a.day) === dayNum);
  if (windows.length === 0) return [];

  const slotSet = new Set();
  for (const w of windows) {
    const [startH, startM] = (w.start || '09:00').split(':').map(Number);
    const [endH, endM] = (w.end || '17:00').split(':').map(Number);
    let minutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    while (minutes + duration <= endMinutes) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      const localStart = dayStart.set({ hour: h, minute: m, second: 0, millisecond: 0 });
      if (localStart.isValid) slotSet.add(toIsoUtc(localStart));
      minutes += duration;
    }
  }
  const slots = [...slotSet];
  slots.sort();
  return slots;
}

// GET /api/event-types/:slug/slots?date=YYYY-MM-DD
router.get('/:slug/slots', async (req, res) => {
  try {
    const { slug } = req.params;
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) required' });

    const eventType = await store.eventTypes.getBySlug(slug);
    if (!eventType) return res.status(404).json({ error: 'Event type not found' });

    const tz = eventType.timeZone || eventType.time_zone || 'America/Los_Angeles';
    const zone = DateTime.now().setZone(tz).zone;
    const dayStart = DateTime.fromISO(date + 'T00:00:00', { zone });
    const dayEnd = dayStart.plus({ days: 1 });
    const utcStartIso = dayStart.toUTC().toISOString().slice(0, 19).replace('T', ' ');
    const utcEndIso = dayEnd.toUTC().toISOString().slice(0, 19).replace('T', ' ');

    const possibleSlots = getSlotsForDate(eventType, date);
    const bookedInRange = await store.bookings.getBookingsForEventTypeInRange(eventType.id, utcStartIso, utcEndIso);
    const duration = eventType.durationMinutes ?? 30;
    const now = DateTime.utc();

    const available = possibleSlots.filter((slotStart) => {
      const slotDt = DateTime.fromISO(slotStart, { zone: 'utc' });
      if (slotDt <= now) return false;
      const slotEnd = slotDt.plus({ minutes: duration });
      const overlaps = bookedInRange.some((b) => {
        const bStart = (b.start_time || '').replace(' ', 'T');
        const bEnd = (b.end_time || '').replace(' ', 'T');
        const bS = DateTime.fromISO(bStart.includes('Z') ? bStart : bStart + 'Z', { zone: 'utc' });
        const bE = DateTime.fromISO(bEnd.includes('Z') ? bEnd : bEnd + 'Z', { zone: 'utc' });
        return slotDt < bE && slotEnd > bS;
      });
      return !overlaps;
    });
    res.json(available);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.getSlotsForDate = getSlotsForDate;
