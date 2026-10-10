const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const wrap = require('../utils/asyncHandler');
const { isValidMonth, isValidDate, monthRange } = require('../utils/dates');
const { parseAmount, parseId } = require('../utils/validate');
const { deleteReceipt } = require('../services/storage');

const EXPENSE_SELECT = `
  SELECT e.id, e.amount, e.category_id, c.name AS category_name, e.description,
         e.expense_date, (e.receipt_key IS NOT NULL) AS has_receipt, e.created_at
    FROM expenses e
    JOIN categories c ON c.id = e.category_id`;

const toExpense = (r) => ({ ...r, has_receipt: Boolean(r.has_receipt) });

async function getExpense(userId, id) {
  const [rows] = await pool.query(`${EXPENSE_SELECT} WHERE e.id = ? AND e.user_id = ?`, [id, userId]);
  return rows[0] ? toExpense(rows[0]) : null;
}

// Returns { error } or { values }
async function validateBody(body, userId) {
  body = body || {};
  const amount = parseAmount(body.amount);
  if (amount === null) return { error: 'amount must be greater than 0, with at most 2 decimals' };
  const categoryId = parseId(body.category_id);
  if (!categoryId) return { error: 'category_id is required' };
  if (!isValidDate(body.expense_date)) return { error: 'expense_date must be a valid date (YYYY-MM-DD)' };
  const description = body.description == null ? '' : String(body.description).trim();
  if (description.length > 255) return { error: 'description must be at most 255 characters' };

  const [cats] = await pool.query(
    'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)',
    [categoryId, userId]
  );
  if (!cats.length) return { error: 'Unknown category_id' };

  return { values: { amount, categoryId, description, expenseDate: body.expense_date } };
}

router.get('/', auth, wrap(async (req, res) => {
  const where = ['e.user_id = ?'];
  const params = [req.user.id];
  if (req.query.month) {
    if (!isValidMonth(req.query.month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
    const { start, end } = monthRange(req.query.month);
    where.push('e.expense_date >= ? AND e.expense_date < ?');
    params.push(start, end);
  }
  if (req.query.category_id) {
    const categoryId = parseId(req.query.category_id);
    if (!categoryId) return res.status(400).json({ error: 'category_id must be a number' });
    where.push('e.category_id = ?');
    params.push(categoryId);
  }
  // 'where' only ever contains the fixed strings above; user values always go through '?'
  const [rows] = await pool.query(
    `${EXPENSE_SELECT} WHERE ${where.join(' AND ')} ORDER BY e.expense_date DESC, e.id DESC`,
    params
  );
  res.json(rows.map(toExpense));
}));

router.post('/', auth, wrap(async (req, res) => {
  const { error, values } = await validateBody(req.body, req.user.id);
  if (error) return res.status(400).json({ error });
  const [result] = await pool.query(
    `INSERT INTO expenses (user_id, category_id, amount, description, expense_date)
     VALUES (?, ?, ?, ?, ?)`,
    [req.user.id, values.categoryId, values.amount, values.description, values.expenseDate]
  );
  res.status(201).json(await getExpense(req.user.id, result.insertId));
}));

router.put('/:id', auth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id || !(await getExpense(req.user.id, id))) return res.status(404).json({ error: 'Expense not found' });
  const { error, values } = await validateBody(req.body, req.user.id);
  if (error) return res.status(400).json({ error });

  await pool.query(
    `UPDATE expenses
        SET category_id = ?, amount = ?, description = ?, expense_date = ?
      WHERE id = ? AND user_id = ?`,
    [values.categoryId, values.amount, values.description, values.expenseDate, id, req.user.id]
  );
  res.json(await getExpense(req.user.id, id));
}));

router.delete('/:id', auth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Expense not found' });

  const [rows] = await pool.query('SELECT receipt_key FROM expenses WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Expense not found' });

  await pool.query('DELETE FROM expenses WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (rows[0].receipt_key) {
    try {
      await deleteReceipt(rows[0].receipt_key);
    } catch (e) {
      console.error('Receipt cleanup failed:', e.name);
    }
  }
  res.status(204).end();
}));

module.exports = router;
