const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
