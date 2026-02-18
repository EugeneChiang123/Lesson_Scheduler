const express = require('express');
const cors = require('cors');
const path = require('path');

const store = require('./db/store');
const { requireProfessional, requireProfessionalUnlessPublicEventTypes, requireProfessionalUnlessPost } = require('./middleware/auth');
const eventTypesRouter = require('./routes/eventTypes');
const slotsRouter = require('./routes/slots');
const bookingsRouter = require('./routes/bookings');
const professionalsModule = require('./routes/professionals');
const professionalsRouter = professionalsModule;
const professionalsPublicRouter = professionalsModule.publicRouter;

const app = express();

app.use(cors());
app.use(express.json());

// So you can verify on Vercel: GET /api/health → { store: "postgres" | "file" }
app.get('/api/health', (req, res) => {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  res.json({ store: url ? 'postgres' : 'file' });
});

// Public professional routes (no auth): by-slug, reserved-slugs
app.use('/api/professionals', professionalsPublicRouter);
app.use('/api/professionals', requireProfessional, professionalsRouter);

app.use('/api/event-types', requireProfessionalUnlessPublicEventTypes, slotsRouter);
app.use('/api/event-types', requireProfessionalUnlessPublicEventTypes, eventTypesRouter);
app.use('/api/bookings', requireProfessionalUnlessPost, bookingsRouter);

// Serve static and SPA; 301 redirect old profile slugs to current (single-segment paths only)
function serveSpa(distPath) {
  app.use(express.static(distPath));
  app.get('/:slug', async (req, res, next) => {
    const slug = req.params.slug;
    if (!slug || slug.includes('/')) return next();
    try {
      const redirectTo = await store.slug_redirects.getRedirect(slug);
      if (redirectTo) return res.redirect(301, `/${redirectTo}`);
    } catch (_) { /* ignore */ }
    next();
  });
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  serveSpa(path.join(__dirname, '../client/dist'));
}

if (process.env.VERCEL) {
  serveSpa(path.join(__dirname, '../client/dist'));
}

module.exports = app;
