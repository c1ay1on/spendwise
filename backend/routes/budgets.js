const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const wrap = require('../utils/asyncHandler');
const { isValidMonth, currentMonth } = require('../utils/dates');
const { parseAmount } = require('../utils/validate');

router.get('/', auth, wrap(async (req, res) => {
  const month = req.query.month || currentMonth();
  if (!isValidMonth(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
  const [rows] = await pool.query('SELECT amount FROM budgets WHERE user_id = ? AND month = ?', [req.user.id, month]);
  res.json({ month, amount: rows[0] ? Number(rows[0].amount) : null });
}));

router.put('/', auth, wrap(async (req, res) => {
  const { month, amount } = req.body || {};
  if (!isValidMonth(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
  const value = parseAmount(amount);
  if (value === null) return res.status(400).json({ error: 'amount must be greater than 0, with at most 2 decimals' });
  
  await pool.query(
    `INSERT INTO budgets (user_id, month, amount) VALUES (?, ?, ?) AS new_row
     ON DUPLICATE KEY UPDATE amount = new_row.amount`,
    [req.user.id, month, value]
  );
  res.json({ month, amount: value });
}));

module.exports = router;
