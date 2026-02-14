/**
 * Vercel serverless catch-all: every /api/* request is handled by the Express app.
 * This ensures booking, setup, slots, and calendar API calls work when deployed.
 */
const app = require('../server/app');

module.exports = (req, res) => app(req, res);
