const app = require('./app');
const PORT = process.env.PORT || 3001;

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API running at http://localhost:${PORT}`);
  });
}
