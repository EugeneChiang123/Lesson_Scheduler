/**
 * Professionals API: GET /me, PATCH /me.
 * All routes require auth (requireProfessional middleware applied in app.js).
 */
const express = require('express');
const store = require('../db/store');

const router = express.Router();

const RESERVED_SLUGS = new Set([
  'book', 'setup', 'api', 'auth', 'sign-in', 'sign-up', 'health', 'login', 'logout',
  'signin', 'signup', 'new', 'edit', 'bookings',
]);

/** GET /api/professionals/me - current professional */
router.get('/me', (req, res) => {
  const pro = req.professional;
  if (!pro) return res.status(404).json({ error: 'Professional not found' });
  res.json(pro);
});

/** PATCH /api/professionals/me - update full_name, profile_slug, time_zone */
router.patch('/me', async (req, res) => {
  try {
    const { full_name, profile_slug, time_zone } = req.body;
    const pro = req.professional;
    if (!pro) return res.status(404).json({ error: 'Professional not found' });

    if (profile_slug !== undefined) {
      const slug = String(profile_slug).trim().toLowerCase();
      if (!slug) return res.status(400).json({ error: 'profile_slug required when provided' });
      if (RESERVED_SLUGS.has(slug)) {
        return res.status(400).json({ error: 'That URL slug is reserved' });
      }
      if (slug !== pro.profileSlug) {
        const existing = await store.professionals.getByProfileSlug(slug);
        if (existing && existing.id !== pro.id) {
          return res.status(409).json({ error: 'Profile slug already in use' });
        }
        try {
          await store.slug_redirects.insert({
            old_slug: pro.profileSlug,
            professional_id: pro.id,
          });
        } catch (err) {
          if (err.code === '23505') return res.status(409).json({ error: 'Old slug already redirects' });
          throw err;
        }
      }
    }

    const updates = {};
    if (full_name !== undefined) updates.full_name = String(full_name).substring(0, 255);
    if (profile_slug !== undefined) updates.profile_slug = String(profile_slug).trim().toLowerCase();
    if (time_zone !== undefined) updates.time_zone = String(time_zone).substring(0, 63);

    if (Object.keys(updates).length === 0) {
      return res.json(pro);
    }

    const updated = await store.professionals.update(pro.id, updates);
    if (!updated) return res.status(404).json({ error: 'Professional not found' });
    res.json(updated);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Profile slug already in use' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
