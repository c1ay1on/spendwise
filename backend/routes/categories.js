const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const wrap = require('../utils/asyncHandler');

router.get('/', auth, wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, (user_id IS NULL) AS is_default
       FROM categories
      WHERE user_id IS NULL OR user_id = ?
      ORDER BY is_default DESC, name`,
    [req.user.id]
  );
  res.json(rows.map((r) => ({ id: r.id, name: r.name, is_default: Boolean(r.is_default) })));
}));

router.post('/', auth, wrap(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 50) {
    return res.status(400).json({ error: 'Category name is required (max 50 characters)' });
  }
  const [dupes] = await pool.query(
    'SELECT id FROM categories WHERE name = ? AND (user_id IS NULL OR user_id = ?)',
    [name, req.user.id]
  );
  if (dupes.length) return res.status(409).json({ error: 'Category already exists' });
  const [result] = await pool.query('INSERT INTO categories (user_id, name) VALUES (?, ?)', [req.user.id, name]);
  res.status(201).json({ id: result.insertId, name, is_default: false });
}));

module.exports = router;
