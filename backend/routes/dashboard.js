const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const wrap = require('../utils/asyncHandler');
const { isValidMonth, currentMonth, monthRange } = require('../utils/dates');
const { buildSummary } = require('../services/calc');

router.get('/summary', auth, wrap(async (req, res) => {
  const month = req.query.month || currentMonth();
  if (!isValidMonth(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });

  const { start, end } = monthRange(month);
  const uid = req.user.id;

  const [[budgetRows], [totalRows], [byCategory], [daily]] = await Promise.all([
    pool.query('SELECT amount FROM budgets WHERE user_id = ? AND month = ?', [uid, month]),

    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
         FROM expenses
        WHERE user_id = ? AND expense_date >= ? AND expense_date < ?`,
      [uid, start, end]
    ),

    pool.query(
      `SELECT c.id AS category_id, c.name AS category_name, SUM(e.amount) AS total
         FROM expenses e
         JOIN categories c ON c.id = e.category_id
        WHERE e.user_id = ? AND e.expense_date >= ? AND e.expense_date < ?
        GROUP BY c.id, c.name
        ORDER BY total DESC`,
      [uid, start, end]
    ),

    pool.query(
      `SELECT e.expense_date AS date, SUM(e.amount) AS total
         FROM expenses e
        WHERE e.user_id = ? AND e.expense_date >= ? AND e.expense_date < ?
        GROUP BY e.expense_date
        ORDER BY e.expense_date`,
      [uid, start, end]
    )
  ]);

  res.json(buildSummary({
    month,
    budget: budgetRows[0] ? budgetRows[0].amount : null,
    totalSpent: totalRows[0].total,
    byCategory,
    daily
  }));
}));

module.exports = router;
