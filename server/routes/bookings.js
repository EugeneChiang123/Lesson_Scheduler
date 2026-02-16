const express = require('express');
const store = require('../db/store');
const { clampRecurringCount } = store;
const { getSlotsForDate } = require('./slots');

const router = express.Router();

// GET /api/bookings - list all (for instructor calendar)
router.get('/', async (req, res) => {
  try {
    const list = await store.bookings.list();
    const eventTypes = await store.eventTypes.all();
    const byEventId = Object.fromEntries(eventTypes.map((e) => [e.id, e]));
    const sorted = list.map((b) => {
      const et = byEventId[b.event_type_id];
      let recurringSession = null;
      if (b.recurring_group_id) {
        const group = list.filter((x) => x.recurring_group_id === b.recurring_group_id).sort((a, b2) => a.start_time.localeCompare(b2.start_time));
        const idx = group.findIndex((x) => x.id === b.id) + 1;
        recurringSession = { index: idx, total: group.length };
      }
      return {
        id: b.id,
        event_type_id: b.event_type_id,
        event_type_name: et ? et.name : null,
        start_time: b.start_time,
        end_time: b.end_time,
        first_name: b.first_name,
        last_name: b.last_name,
        full_name: `${b.first_name || ''} ${b.last_name || ''}`.trim(),
        email: b.email,
        phone: b.phone,
        recurring_group_id: b.recurring_group_id,
        recurring_session: recurringSession,
      };
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function addMinutes(isoStr, minutes) {
  const d = new Date(isoStr.replace(' ', 'T'));
  d.setMinutes(d.getMinutes() + minutes);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:00`;
}

// POST /api/bookings
router.post('/', async (req, res) => {
  try {
    const { eventTypeSlug, startTime, firstName, lastName, email, phone } = req.body;
    if (!eventTypeSlug || !startTime || !firstName || !lastName || !email || !phone) {
      return res.status(400).json({ error: 'eventTypeSlug, startTime, firstName, lastName, email, phone required' });
    }

    const eventType = await store.eventTypes.getBySlug(eventTypeSlug);
    if (!eventType) return res.status(404).json({ error: 'Event type not found' });

    const duration = eventType.durationMinutes || 30;
    const allowRecurring = Boolean(eventType.allowRecurring);
    const recurringCount = clampRecurringCount(eventType.recurringCount ?? 1);

    const startTimes = [startTime];
    if (allowRecurring && recurringCount > 1) {
      const first = new Date(startTime.replace(' ', 'T'));
      for (let i = 1; i < recurringCount; i++) {
        const next = new Date(first);
        next.setDate(next.getDate() + 7 * i);
        const y = next.getFullYear();
        const m = String(next.getMonth() + 1).padStart(2, '0');
        const d = String(next.getDate()).padStart(2, '0');
        const h = String(next.getHours()).padStart(2, '0');
        const min = String(next.getMinutes()).padStart(2, '0');
        startTimes.push(`${y}-${m}-${d} ${h}:${min}:00`);
      }
    }

    const recurringGroupId = allowRecurring && recurringCount > 1 ? `rg_${Date.now()}_${Math.random().toString(36).slice(2)}` : null;

    const now = new Date();
    for (const st of startTimes) {
      const slotStart = new Date(st.replace(' ', 'T'));
      if (slotStart <= now) {
        return res.status(400).json({ error: 'Cannot create booking in the past', requestedStart: st });
      }
    }

    // Ensure each startTime is an allowed slot for that date (from eventType.availability)
    for (const st of startTimes) {
      const normalized = st.replace(' ', 'T').substring(0, 19);
      const dateStr = normalized.substring(0, 10);
      const possibleSlots = getSlotsForDate(eventType, dateStr);
      if (!possibleSlots.includes(normalized)) {
        return res.status(400).json({ error: 'Requested time is not an available slot for this event type', requestedStart: normalized });
      }
    }

    // Build slots and insert atomically (transaction with row lock in Postgres, mutex in file store)
    // so two simultaneous requests for the same slot cannot both pass the conflict check.
    const slots = startTimes.map((st) => {
      const startNorm = st.includes('T') ? st.replace('T', ' ').substring(0, 19) : st;
      const endNorm = addMinutes(startNorm, duration);
      return { start_time: startNorm, end_time: endNorm };
    });
    const guest = { first_name: firstName, last_name: lastName, email, phone, recurring_group_id: recurringGroupId };
    const result = await store.bookings.createBatchIfNoConflict(eventType.id, slots, guest);

    if (result.conflict) {
      return res.status(409).json({ error: 'Slot no longer available', conflictingStart: result.conflictingStart });
    }

    res.status(201).json({
      success: true,
      count: result.created.length,
      recurringGroupId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
