/**
 * Vercel serverless catch-all: every /api/* request is handled by the Express app.
 * This ensures booking, setup, slots, and calendar API calls work when deployed.
 */
const app = require('../server/app');

module.exports = (req, res) => {
  // #region agent log
  const path = req.url || (req.path ?? 'unknown');
  fetch('http://127.0.0.1:7242/ingest/b637c938-aa6e-494b-9311-7c4ae502ce18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/[[...path]].js',message:'API request',data:{path,method:req.method},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  return app(req, res);
};
