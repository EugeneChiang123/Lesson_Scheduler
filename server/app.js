const express = require('express');
const cors = require('cors');
const path = require('path');

const eventTypesRouter = require('./routes/eventTypes');
const slotsRouter = require('./routes/slots');
const bookingsRouter = require('./routes/bookings');

const app = express();

app.use(cors());
app.use(express.json());

// So you can verify on Vercel: GET /api/health → { store: "postgres" | "file" }
app.get('/api/health', (req, res) => {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  res.json({ store: url ? 'postgres' : 'file' });
});

app.use('/api/event-types', slotsRouter);
app.use('/api/event-types', eventTypesRouter);
app.use('/api/bookings', bookingsRouter);

if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// On Vercel, this app receives every request; serve SPA for non-API routes
if (process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

module.exports = app;
