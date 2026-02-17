/**
 * Vercel serverless catch-all for /api/*. Rewrites send /api/:path* here;
 * Vercel may pass the path as query param. Restore req.url so Express routes match.
 */
const app = require('../server/app');

module.exports = (req, res) => {
  const pathSegment = req.query.path;
  if (pathSegment != null && typeof pathSegment === 'string') {
    const qs = req.url && req.url.includes('?') ? req.url.replace(/^[^?]*\?/, '') : '';
    const other = qs.replace(/(^|&)path=[^&]*/g, '').replace(/^&|&$/g, '');
    req.url = '/api/' + pathSegment + (other ? '?' + other : '');
  }
  return app(req, res);
};
