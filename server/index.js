const express = require('express');
const cors = require('cors');
const path = require('path');

const eventTypesRouter = require('./routes/eventTypes');
const slotsRouter = require('./routes/slots');
const bookingsRouter = require('./routes/bookings');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/event-types', slotsRouter);
app.use('/api/event-types', eventTypesRouter);
app.use('/api/bookings', bookingsRouter);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`API running at http://127.0.0.1:${PORT}`);
});
