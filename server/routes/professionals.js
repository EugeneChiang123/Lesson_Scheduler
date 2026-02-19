/**
 * Professionals API: GET /me, PATCH /me (auth required).
 * Public: GET /by-slug/:slug, GET /reserved-slugs (mounted without auth in app.js).
 */
const express = require('express');
const store = require('../db/store');

const router = express.Router();

/** Reserved path segments; used for profile_slug validation and client route guard. */
const RESERVED_SLUGS = new Set([
  'book', 'booking', 'bookings', 'setup', 'api', 'auth', 'sign-in', 'sign-up', 'health', 'login', 'logout',
  'signin', 'signup', 'new', 'edit',
]);

/** Public router: no auth. Mount first under /api/professionals. */
const publicRouter = express.Router();

/** GET /api/professionals/reserved-slugs - list reserved path segments */
publicRouter.get('/reserved-slugs', (req, res) => {
  res.json({ slugs: [...RESERVED_SLUGS] });
});

/** GET /api/professionals/by-slug/:slug - resolve slug for redirect or dashboard */
publicRouter.get('/by-slug/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) return res.status(404).json({ error: 'Not found' });
    if (RESERVED_SLUGS.has(slug)) return res.status(404).json({ error: 'Reserved path' });

    const redirectTo = await store.slug_redirects.getRedirect(slug);
    if (redirectTo) return res.json({ redirectTo: `/${redirectTo}` });

    const pro = await store.professionals.getByProfileSlug(slug);
    if (pro) return res.json({ profileSlug: pro.profileSlug });

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
module.exports.publicRouter = publicRouter;
