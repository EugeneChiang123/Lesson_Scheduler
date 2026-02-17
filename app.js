/**
 * Vercel Express entry: export the app so Vercel runs it for every request.
 * This makes /api/* (and all routes) hit our Express app instead of 404.
 * See: https://vercel.com/docs/frameworks/backend/express
 */
module.exports = require('./server/app');
