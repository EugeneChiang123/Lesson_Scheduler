const express = require('express');
const store = require('../db/store');

const router = express.Router();

function getSlotsForDate(eventType, dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  const duration = eventType.durationMinutes ?? 30;
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const availability = eventType.availability || [];
  const windows = availability.filter((a) => a.day === day);
  if (windows.length === 0) return [];

  const slots = [];
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
      slots.push(startTime);
      minutes += duration;
    }
  }
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
    const booked = store.bookings.getByEventTypeAndDate(eventType.id, date);
    const bookedSet = new Set(booked.map((b) => b.start_time.replace(' ', 'T')));
    const available = possibleSlots.filter((s) => !bookedSet.has(s));
    res.json(available);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.getSlotsForDate = getSlotsForDate;
