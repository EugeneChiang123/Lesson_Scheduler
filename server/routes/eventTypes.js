const express = require('express');
const store = require('../db/store');

const router = express.Router();

// GET /api/event-types - list all for current professional (instructor UI)
router.get('/', async (req, res) => {
  try {
    const professionalId = req.professionalId;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b637c938-aa6e-494b-9311-7c4ae502ce18', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '0faeff',
      },
      body: JSON.stringify({
        sessionId: '0faeff',
        runId: 'initial',
        hypothesisId: 'H6',
        location: 'server/routes/eventTypes.js:getAll',
        message: 'GET /api/event-types handler invoked',
        data: {
          hasProfessionalId: professionalId != null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    const rows = await store.eventTypes.all(professionalId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/event-types/id/:id - get one by id (instructor edit) — must be before /:slug
router.get('/id/:id', async (req, res) => {
  try {
    const row = await store.eventTypes.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Event type not found' });
    if (req.professionalId != null && row.professionalId !== req.professionalId) {
      return res.status(404).json({ error: 'Event type not found' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/event-types/:slug - public details for booking page
router.get('/:slug', async (req, res) => {
  try {
    const row = await store.eventTypes.getBySlug(req.params.slug);
    if (!row) return res.status(404).json({ error: 'Event type not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/event-types - create
router.post('/', async (req, res) => {
  try {
    const professionalId = req.professionalId;
    if (professionalId == null) return res.status(401).json({ error: 'Authorization required' });
    const { slug, name, description, durationMinutes, allowRecurring, recurringCount, availability, location, time_zone, timeZone, price_dollars, priceDollars } = req.body;
    if (!slug || !name) return res.status(400).json({ error: 'slug and name required' });
    const row = await store.eventTypes.create({
      professional_id: professionalId,
      slug,
      name: name || '',
      description: description || '',
      durationMinutes: durationMinutes ?? 30,
      allowRecurring: Boolean(allowRecurring),
      recurringCount: recurringCount ?? 1,
      availability: availability || [],
      location: location != null ? location : '',
      time_zone: time_zone || timeZone,
      price_dollars: price_dollars ?? priceDollars,
    });
    res.status(201).json(row);
  } catch (err) {
    if (err.message === 'Slug already exists') return res.status(409).json({ error: 'Slug already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/event-types/:id - update
router.patch('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await store.eventTypes.getById(id);
    if (!existing) return res.status(404).json({ error: 'Event type not found' });
    if (req.professionalId != null && existing.professionalId !== req.professionalId) {
      return res.status(404).json({ error: 'Event type not found' });
    }
    const { slug, name, description, durationMinutes, allowRecurring, recurringCount, availability, location, time_zone, timeZone, price_dollars, priceDollars } = req.body;
    const updated = await store.eventTypes.update(id, {
      slug,
      name,
      description,
      durationMinutes,
      allowRecurring,
      recurringCount,
      availability,
      location,
      time_zone: time_zone ?? timeZone,
      price_dollars: price_dollars ?? priceDollars,
    });
    res.json(updated);
  } catch (err) {
    if (err.message === 'Slug already exists') return res.status(409).json({ error: 'Slug already exists' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
