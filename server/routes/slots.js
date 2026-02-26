const express = require('express');
const { DateTime } = require('luxon');
const store = require('../db/store');

const router = express.Router();

/** Slot start time in UTC as ISO string with Z so client and server parse as UTC. */
function toIsoUtc(dt) {
  if (!dt || !dt.isValid) return null;
  const iso = dt.toUTC().toISO({ suppressMilliseconds: true });
  if (iso == null) return null;
  return iso.slice(0, 19) + 'Z';
}

/**
 * Generate available slot start times for a date in the event type's time zone.
 * Returns array of UTC ISO-like strings ("YYYY-MM-DD HH:mm:ss") for the client.
 */
function getSlotsForDate(eventType, dateStr) {
  const duration = eventType.durationMinutes ?? eventType.duration_minutes ?? 30;
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const tz = eventType.timeZone || eventType.time_zone || 'America/Los_Angeles';
  const availability = Array.isArray(eventType.availability) ? eventType.availability : [];
  const zone = DateTime.now().setZone(tz).zone;
  const dayStart = DateTime.fromISO(dateStr + 'T00:00:00', { zone });
  if (!dayStart.isValid) return [];
  // Luxon weekday: 1=Mon..7=Sun → we use 0=Sun,1=Mon..6=Sat to match client (SetupEventForm DAYS).
  const dayNum = dayStart.weekday % 7;
  const windows = availability.filter((a) => {
    const d = Number(a.day);
    const storedDay = (d === 7 ? 0 : d);
    return storedDay === dayNum;
  });
  if (windows.length === 0) {
    if (availability.length > 0) {
      console.warn('[slots] No windows for date: date=%s tz=%s weekday=%s dayNum=%s availability.days=%s', dateStr, tz, dayStart.weekday, dayNum, availability.map((a) => a.day).join(','));
    }
    return [];
  }

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
      const iso = toIsoUtc(localStart);
      if (iso) slotSet.add(iso);
      minutes += duration;
    }
  }
  const slots = [...slotSet];
  slots.sort();
  return slots;
}

// GET /api/event-types/:slug/slots?date=YYYY-MM-DD
router.get('/:slug/slots', async (req, res) => {
  const { slug } = req.params;
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) required' });

  let eventType;
  try {
    eventType = await store.eventTypes.getBySlug(slug);
  } catch (e) {
    console.error('[slots] getBySlug error:', e);
    return res.status(500).json({ error: 'Failed to load event type', details: e.message });
  }
  if (!eventType) return res.status(404).json({ error: 'Event type not found' });

  try {
    const tz = eventType.timeZone || eventType.time_zone || 'America/Los_Angeles';
    const zone = DateTime.now().setZone(tz).zone;
    const dayStart = DateTime.fromISO(date + 'T00:00:00', { zone });
    if (!dayStart.isValid) {
      return res.status(400).json({ error: 'Invalid date or time zone', details: dayStart.invalidReason || 'unknown' });
    }
    const dayEnd = dayStart.plus({ days: 1 });
    const utcStart = dayStart.toUTC();
    const utcEnd = dayEnd.toUTC();
    const utcStartIso = (utcStart.toISO({ suppressMilliseconds: true }) || '').slice(0, 19).replace('T', ' ');
    const utcEndIso = (utcEnd.toISO({ suppressMilliseconds: true }) || '').slice(0, 19).replace('T', ' ');

    let possibleSlots;
    try {
      possibleSlots = getSlotsForDate(eventType, date);
    } catch (e) {
      console.error('[slots] getSlotsForDate error:', e);
      possibleSlots = [];
    }
    possibleSlots = Array.isArray(possibleSlots) ? possibleSlots : [];

    let bookedInRange;
    try {
      bookedInRange = await store.bookings.getBookingsForEventTypeInRange(eventType.id, utcStartIso, utcEndIso);
    } catch (e) {
      console.error('[slots] getBookingsForEventTypeInRange error:', e);
      bookedInRange = [];
    }
    bookedInRange = Array.isArray(bookedInRange) ? bookedInRange : [];

    const duration = eventType.durationMinutes ?? eventType.duration_minutes ?? 30;
    const now = DateTime.utc();

    const available = possibleSlots.filter((slotStart) => {
      try {
        const slotDt = DateTime.fromISO(slotStart, { zone: 'utc' });
        if (!slotDt.isValid || slotDt <= now) return false;
        const slotEnd = slotDt.plus({ minutes: duration });
        const overlaps = bookedInRange.some((b) => {
          const bStart = (b.start_time || '').trim().replace(' ', 'T').substring(0, 19);
          const bEnd = (b.end_time || '').trim().replace(' ', 'T').substring(0, 19);
          if (!bStart || !bEnd || bStart.length < 19 || bEnd.length < 19) return false;
          const bS = DateTime.fromISO(bStart.includes('Z') ? bStart : bStart + 'Z', { zone: 'utc' });
          const bE = DateTime.fromISO(bEnd.includes('Z') ? bEnd : bEnd + 'Z', { zone: 'utc' });
          if (!bS.isValid || !bE.isValid) return false;
          return slotDt < bE && slotEnd > bS;
        });
        return !overlaps;
      } catch (_) {
        return false;
      }
    });
    res.json(available);
  } catch (err) {
    console.error('[slots] Error:', err);
    res.status(500).json({ error: err.message, stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined });
  }
});

module.exports = router;
module.exports.getSlotsForDate = getSlotsForDate;
