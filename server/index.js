const app = require('./app');
const PORT = process.env.PORT || 3001;

if (!process.env.VERCEL) {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`API running at http://127.0.0.1:${PORT}`);
  });
}
