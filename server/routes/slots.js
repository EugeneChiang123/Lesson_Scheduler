const express = require('express');
const store = require('../db/store');

const router = express.Router();

function addMinutesForSlots(isoStr, minutes) {
  const d = new Date(isoStr.replace(' ', 'T'));
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString().slice(0, 19);
}

function getSlotsForDate(eventType, dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  const duration = eventType.durationMinutes ?? 30;
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const availability = eventType.availability || [];
  const windows = availability.filter((a) => a.day === day);
  if (windows.length === 0) return [];

  const slotSet = new Set();
  for (const w of windows) {
    const [startH, startM] = w.start.split(':').map(Number);
    const [endH, endM] = w.end.split(':').map(Number);
    let minutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    while (minutes + duration <= endMinutes) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const startTime = `${dateStr}T${timeStr}:00`;
      slotSet.add(startTime);
      minutes += duration;
    }
  }
  const slots = [...slotSet];
  slots.sort();
  return slots;
}

// GET /api/event-types/:slug/slots?date=YYYY-MM-DD
router.get('/:slug/slots', (req, res) => {
  try {
    const { slug } = req.params;
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) required' });

    const eventType = store.eventTypes.getBySlug(slug);
    if (!eventType) return res.status(404).json({ error: 'Event type not found' });

    const possibleSlots = getSlotsForDate(eventType, date);
    const bookedOnDate = store.bookings.getBookingsOnDate(date);
    const duration = eventType.durationMinutes ?? 30;
    const now = new Date();
    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const available = possibleSlots.filter((slotStart) => {
      const start = slotStart.replace(' ', 'T');
      if (date === todayStr && new Date(start) <= now) return false;
      const slotEnd = addMinutesForSlots(start, duration);
      const overlaps = bookedOnDate.some((b) => {
        const bStart = b.start_time.replace(' ', 'T');
        const bEnd = b.end_time.replace(' ', 'T');
        return start < bEnd && slotEnd > bStart;
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
