/**
 * Auth middleware: verify Clerk Bearer token, resolve or create professional, attach to req.
 * Use on routes that require a logged-in professional.
 */
const { verifyToken } = require('@clerk/backend');

const store = require('../db/store');

function getBearerToken(req) {
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== 'string') return null;
  const parts = auth.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

/**
 * Middleware that requires a valid Clerk session and attaches req.professional and req.professionalId.
 * On success: next(). On failure: 401 or 503 (if store has no professionals, e.g. file store).
 */
async function requireProfessional(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b637c938-aa6e-494b-9311-7c4ae502ce18', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '0faeff',
      },
      body: JSON.stringify({
        sessionId: '0faeff',
        runId: 'initial',
        hypothesisId: 'H1',
        location: 'server/middleware/auth.js:secretKeyMissing',
        message: 'CLERK_SECRET_KEY missing when requiring professional',
        data: {
          hasToken: Boolean(token),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    return res.status(500).json({ error: 'Server auth not configured' });
  }

  let payload;
  try {
    const result = await verifyToken(token, { secretKey });
    payload = result;
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b637c938-aa6e-494b-9311-7c4ae502ce18', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '0faeff',
      },
      body: JSON.stringify({
        sessionId: '0faeff',
        runId: 'initial',
        hypothesisId: 'H2',
        location: 'server/middleware/auth.js:verifyTokenError',
        message: 'verifyToken failed in requireProfessional',
        data: {
          hasToken: Boolean(token),
          errorName: err && err.name ? String(err.name).substring(0, 100) : null,
          errorMessage: err && err.message ? String(err.message).substring(0, 200) : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const clerk_user_id = payload.sub;
  if (!clerk_user_id) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (!store.professionals) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b637c938-aa6e-494b-9311-7c4ae502ce18', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '0faeff',
      },
      body: JSON.stringify({
        sessionId: '0faeff',
        runId: 'initial',
        hypothesisId: 'H3',
        location: 'server/middleware/auth.js:noProfessionalsStore',
        message: 'store.professionals missing when requiring professional',
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    return res.status(503).json({ error: 'Auth requires Postgres' });
  }

  let professional = await store.professionals.getByClerkId(clerk_user_id);
  if (!professional) {
    try {
      const email = payload.email || payload.primary_email || '';
      const full_name = [payload.first_name, payload.last_name].filter(Boolean).join(' ') || payload.name || '';
      professional = await store.professionals.create({
        clerk_user_id,
        email: String(email).substring(0, 255),
        full_name: String(full_name).substring(0, 255),
        profile_slug: undefined,
        time_zone: 'America/Los_Angeles',
      });
    } catch (err) {
      if (err.message && err.message.includes('Postgres')) {
        return res.status(503).json({ error: 'Auth requires Postgres' });
      }
      return res.status(500).json({ error: err.message || 'Failed to create professional' });
    }
  }

  req.professional = professional;
  req.professionalId = professional.id;
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/b637c938-aa6e-494b-9311-7c4ae502ce18', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '0faeff',
    },
    body: JSON.stringify({
      sessionId: '0faeff',
      runId: 'initial',
      hypothesisId: 'H4',
      location: 'server/middleware/auth.js:requireProfessionalSuccess',
      message: 'requireProfessional succeeded',
      data: {
        professionalId: professional && professional.id,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log
  next();
}

/**
 * Use for /api/event-types: require auth unless GET /:slug or GET /:slug/slots (public booking).
 * When mounted at /api/event-types, req.path is e.g. "/", "/id/1", "/30min-intro", "/30min-intro/slots".
 */
function requireProfessionalUnlessPublicEventTypes(req, res, next) {
  const parts = req.path.split('/').filter(Boolean);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/b637c938-aa6e-494b-9311-7c4ae502ce18', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '0faeff',
    },
    body: JSON.stringify({
      sessionId: '0faeff',
      runId: 'initial',
      hypothesisId: 'H5',
      location: 'server/middleware/auth.js:requireProfessionalUnlessPublicEventTypes',
      message: 'requireProfessionalUnlessPublicEventTypes evaluated',
      data: {
        method: req.method,
        path: req.path,
        partsLength: parts.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  if (req.method !== 'GET') return requireProfessional(req, res, next);
  if (parts.length === 1) return next();
  if (parts.length === 2 && parts[1] === 'slots') return next();
  return requireProfessional(req, res, next);
}

/** Use for /api/bookings: require auth unless POST (public booking). */
function requireProfessionalUnlessPost(req, res, next) {
  if (req.method === 'POST') return next();
  return requireProfessional(req, res, next);
}

module.exports = { requireProfessional, requireProfessionalUnlessPublicEventTypes, requireProfessionalUnlessPost, getBearerToken };
