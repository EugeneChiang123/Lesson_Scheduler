const express = require('express');
const store = require('../db/store');
const { clampRecurringCount } = store;
const { getSlotsForDate } = require('./slots');
const { sendBookingConfirmation } = require('../services/email');

const router = express.Router();

/** Single source of truth: raw booking → API response shape (event_type_name, full_name, recurring_session, notes, etc.) */
function enrichBooking(b, list, eventTypes) {
  const et = eventTypes.find((e) => e.id === b.event_type_id);
  let recurringSession = null;
  if (b.recurring_group_id && list) {
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
    duration_minutes: b.duration_minutes,
    first_name: b.first_name,
    last_name: b.last_name,
    full_name: `${b.first_name || ''} ${b.last_name || ''}`.trim(),
    email: b.email,
    phone: b.phone,
    recurring_group_id: b.recurring_group_id,
    recurring_session: recurringSession,
    notes: b.notes || '',
  };
}

// GET /api/bookings - list all for current professional (for instructor calendar)
router.get('/', async (req, res) => {
  try {
    const professionalId = req.professionalId;
    const list = await store.bookings.list(professionalId);
    const eventTypes = await store.eventTypes.all(professionalId);
    const enriched = list.map((b) => enrichBooking(b, list, eventTypes));
    const sorted = enriched.sort((a, b) => a.start_time.localeCompare(b.start_time));
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/:id - get one booking (for event edit page)
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const b = await store.bookings.getById(id);
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    const et = await store.eventTypes.getById(b.event_type_id);
    if (req.professionalId != null && et && et.professionalId !== req.professionalId) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const list = await store.bookings.list(req.professionalId);
    const eventTypes = await store.eventTypes.all(req.professionalId);
    const enriched = enrichBooking(b, list, eventTypes);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/bookings/:id - update one booking
router.patch('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await store.bookings.getById(id);
    if (!existing) return res.status(404).json({ error: 'Booking not found' });
    const et = await store.eventTypes.getById(existing.event_type_id);
    if (req.professionalId != null && et && et.professionalId !== req.professionalId) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const { startTime, endTime, durationMinutes, firstName, lastName, email, phone, notes } = req.body;
    if (firstName !== undefined && !firstName) return res.status(400).json({ error: 'firstName required' });
    if (lastName !== undefined && !lastName) return res.status(400).json({ error: 'lastName required' });
    if (email !== undefined && !email) return res.status(400).json({ error: 'email required' });

    let start_time = existing.start_time;
    if (startTime !== undefined) {
      const norm = startTime.replace(' ', 'T').substring(0, 19);
      start_time = norm.replace('T', ' ');
    }
    const existingDuration = existing.duration_minutes != null ? existing.duration_minutes : 30;

    let duration_minutes = existing.duration_minutes != null ? existing.duration_minutes : existingDuration;
    if (durationMinutes !== undefined) {
      const parsed = Number(durationMinutes);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({ error: 'durationMinutes must be a positive number' });
      }
      duration_minutes = Math.max(1, Math.round(parsed));
    }

    let end_time = existing.end_time;
    if (endTime !== undefined) {
      end_time = endTime.replace(' ', 'T').substring(0, 19).replace('T', ' ');
    } else if (durationMinutes !== undefined) {
      end_time = addMinutes(start_time, duration_minutes);
    } else if (start_time !== existing.start_time) {
      end_time = addMinutes(start_time, existingDuration);
    }

    if (durationMinutes === undefined && (start_time !== existing.start_time || end_time !== existing.end_time)) {
      const computed = Math.round((new Date(end_time.replace(' ', 'T')) - new Date(start_time.replace(' ', 'T'))) / 60000);
      duration_minutes = Math.max(1, computed) || existingDuration;
    }

    // Normalize to UTC ISO (with Z) so Postgres interprets both consistently; otherwise session TZ can mis-interpret start vs end.
    start_time = ensureUtcIso(start_time);
    end_time = ensureUtcIso(end_time);

    const data = {
      first_name: firstName !== undefined ? firstName : existing.first_name,
      last_name: lastName !== undefined ? lastName : existing.last_name,
      email: email !== undefined ? email : existing.email,
      phone: phone !== undefined ? phone : existing.phone,
      start_time,
      end_time,
      duration_minutes,
      notes: notes !== undefined ? notes : existing.notes,
    };
    const result = await store.bookings.updateIfNoConflict(id, data);
    if (result.notFound) return res.status(404).json({ error: 'Booking not found' });
    if (result.conflict) {
      return res.status(409).json({
        error: 'This time would overlap with another lesson',
        conflictingStart: result.conflictingStart,
      });
    }
    const updated = result.updated;
    const list = await store.bookings.list(req.professionalId);
    const eventTypes = await store.eventTypes.all(req.professionalId);
    const enriched = enrichBooking(updated, list, eventTypes);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bookings/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await store.bookings.getById(id);
    if (!existing) return res.status(404).json({ error: 'Booking not found' });
    const et = await store.eventTypes.getById(existing.event_type_id);
    if (req.professionalId != null && et && et.professionalId !== req.professionalId) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    await store.bookings.delete(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function addMinutes(isoStr, minutes) {
  const s = (isoStr || '').trim().replace(' ', 'T');
  const d = new Date(s.includes('Z') ? s : s + 'Z');
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 19) + 'Z';
}

/** Normalize time string to UTC ISO with Z so Postgres ::timestamptz interprets consistently. */
function ensureUtcIso(s) {
  if (!s || typeof s !== 'string') return s;
  const t = s.trim().replace(' ', 'T').substring(0, 19);
  const withZ = t.includes('Z') ? t : t + 'Z';
  const d = new Date(withZ);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 19) + 'Z';
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
      const s = (startTime || '').trim().replace(' ', 'T');
      const first = new Date(s.includes('Z') ? s : s + 'Z');
      for (let i = 1; i < recurringCount; i++) {
        const next = new Date(first.getTime() + 7 * i * 24 * 60 * 60 * 1000);
        startTimes.push(next.toISOString().slice(0, 19) + 'Z');
      }
    }

    const recurringGroupId = allowRecurring && recurringCount > 1 ? `rg_${Date.now()}_${Math.random().toString(36).slice(2)}` : null;

    const now = new Date();
    for (const st of startTimes) {
      const s = (st || '').trim().replace(' ', 'T');
      const slotStart = new Date(s.includes('Z') ? s : s + 'Z');
      if (slotStart <= now) {
        return res.status(400).json({ error: 'Cannot create booking in the past', requestedStart: st });
      }
    }

    // Ensure each startTime is an allowed slot for that date (from eventType.availability)
    for (const st of startTimes) {
      const normalized = (st || '').trim().replace(' ', 'T').substring(0, 19) + (st.includes('Z') ? 'Z' : '');
      const dateStr = normalized.substring(0, 10);
      const possibleSlots = getSlotsForDate(eventType, dateStr);
      if (!possibleSlots.includes(normalized)) {
        return res.status(400).json({ error: 'Requested time is not an available slot for this event type', requestedStart: normalized });
      }
    }

    // Build slots and insert atomically (transaction with row lock in Postgres, mutex in file store)
    // so two simultaneous requests for the same slot cannot both pass the conflict check.
    const slots = startTimes.map((st) => {
      const startNorm = (st || '').trim().replace(' ', 'T');
      const startUtc = startNorm.includes('Z') ? startNorm : startNorm.substring(0, 19) + 'Z';
      const endUtc = addMinutes(startUtc, duration);
      return { start_time: startUtc, end_time: endUtc, duration_minutes: duration };
    });
    let clientId = null;
    try {
      clientId = await store.clients.upsert({
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone != null ? String(phone).trim() : null,
      });
    } catch (err) {
      if (err.message !== 'Auth requires Postgres') throw err;
    }
    const guest = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      phone: phone != null ? String(phone).trim() : null,
      recurring_group_id: recurringGroupId,
      client_id: clientId,
    };
    const result = await store.bookings.createBatchIfNoConflict(eventType.id, slots, guest);

    if (result.conflict) {
      return res.status(409).json({ error: 'Slot no longer available', conflictingStart: result.conflictingStart });
    }

    let emailResult = { sent: false };
    const professionalId = eventType.professionalId ?? eventType.professional_id;
    console.log('[bookings] Booking created, professionalId:', professionalId ?? 'none');
    if (professionalId) {
      const professional = await store.professionals.getById(professionalId);
      if (!professional) {
        console.log('[bookings] Professional not found for id', professionalId, '- skipping email');
      } else {
        console.log('[bookings] Sending confirmation email to client and', professional.email);
      }
      const baseUrl = req.protocol && req.get('host') ? `${req.protocol}://${req.get('host')}` : process.env.BASE_URL || '';
      emailResult = await sendBookingConfirmation({
        created: result.created,
        eventType: {
          name: eventType.name,
          durationMinutes: eventType.durationMinutes ?? eventType.duration_minutes,
          location: eventType.location || '',
          notificationTemplate: eventType.notificationTemplate ?? eventType.notification_template ?? null,
        },
        professional: professional ? { fullName: professional.fullName ?? professional.full_name, email: professional.email, phone: professional.phone } : null,
        baseUrl,
      });
      if (emailResult.sent === false) {
        console.log('[bookings] Email result:', emailResult.error ?? 'failed');
      }
    } else {
      console.log('[bookings] No professionalId on event type - skipping email');
    }

    res.status(201).json({
      success: true,
      count: result.created.length,
      recurringGroupId,
      ...(emailResult.sent === false && { emailSent: false, emailError: emailResult.error }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
