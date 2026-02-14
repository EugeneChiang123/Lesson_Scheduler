const express = require('express');
const store = require('../db/store');

const router = express.Router();

// GET /api/event-types - list all (instructor UI)
router.get('/', async (req, res) => {
  try {
    const rows = await store.eventTypes.all();
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
    const { slug, name, description, durationMinutes, allowRecurring, recurringCount, availability } = req.body;
    if (!slug || !name) return res.status(400).json({ error: 'slug and name required' });
    const row = await store.eventTypes.create({
      slug,
      name: name || '',
      description: description || '',
      durationMinutes: durationMinutes ?? 30,
      allowRecurring: Boolean(allowRecurring),
      recurringCount: recurringCount ?? 1,
      availability: availability || [],
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
    const { slug, name, description, durationMinutes, allowRecurring, recurringCount, availability } = req.body;
    const updated = await store.eventTypes.update(id, {
      slug,
      name,
      description,
      durationMinutes,
      allowRecurring,
      recurringCount,
      availability,
    });
    res.json(updated);
  } catch (err) {
    if (err.message === 'Slug already exists') return res.status(409).json({ error: 'Slug already exists' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
