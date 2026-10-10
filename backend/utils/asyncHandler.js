// Lets async route handlers pass their errors to the global error handler.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
