// server/middleware/auth.js
const jwt = require('jsonwebtoken')

/**
 * Express middleware — verifies the JWT in the Authorization header.
 * Attaches req.user = { id, username } if valid; returns 401 otherwise.
 *
 * Usage: router.get('/protected', requireAuth, handler)
 *
 * Interview note: middleware runs before the route handler. FastAPI uses
 * Depends() for the same pattern. Both approaches mean you can't forget to
 * protect a route — you have to opt in to protection explicitly.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' })
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { id: payload.sub, username: payload.username }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = { requireAuth }
