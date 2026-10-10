const path = require('path');
const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// In production, Nginx serves the site and the API from the same origin, so CORS is only for local dev.
if (process.env.NODE_ENV !== 'production') app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Local dev only: serve receipts saved on disk when there is no S3 bucket.
if (!process.env.S3_BUCKET) {
  app.use('/api/dev-uploads', express.static(path.join(__dirname, 'uploads')));
}

app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/expenses', require('./routes/receipts'));   // /api/expenses/:id/receipt
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler. NEVER console.log the whole error object: database errors can contain user data.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 10 MB)' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(`${req.method} ${req.path} failed:`, err.code || err.name);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`SpendWise API listening on 127.0.0.1:${PORT}`);
  pool.query('SELECT 1')
    .then(() => console.log('Database connection OK'))
    .catch((e) => console.error('Database connection FAILED:', e.code || e.message));
});
