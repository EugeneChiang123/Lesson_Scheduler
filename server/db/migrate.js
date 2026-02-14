const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname);
const eventTypesPath = path.join(dataDir, 'event_types.json');
const bookingsPath = path.join(dataDir, 'bookings.json');

if (!fs.existsSync(eventTypesPath)) {
  fs.writeFileSync(eventTypesPath, '[]', 'utf8');
  console.log('Created event_types.json');
}
if (!fs.existsSync(bookingsPath)) {
  fs.writeFileSync(bookingsPath, '[]', 'utf8');
  console.log('Created bookings.json');
}
console.log('Migration complete.');
