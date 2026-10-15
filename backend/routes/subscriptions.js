
const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const wrap = require('../utils/asyncHandler');
const { isValidDate } = require('../utils/dates');
const { parseAmount, parseId } = require('../utils/validate');

function addPeriod(dateString, recurrence) {
  const d = new Date(`${dateString}T00:00:00Z`);
  const originalDay = d.getUTCDate();
  d.setUTCDate(1);
  if (recurrence === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(originalDay, last));
  return d.toISOString().slice(0, 10);
}
function today() { return new Date().toISOString().slice(0, 10); }
function validRecurrence(v) { return v === 'monthly' || v === 'yearly'; }

async function generatePayments(userId) {
  const [subs] = await pool.query(
    `SELECT id, amount, recurrence, next_due_date FROM subscriptions
      WHERE user_id = ? AND active = 1`, [userId]);
  const horizon = new Date();
  horizon.setUTCMonth(horizon.getUTCMonth() + 6);
  const horizonDate = horizon.toISOString().slice(0, 10);
  for (const sub of subs) {
    let due = String(sub.next_due_date).slice(0, 10);
    // Cap generation to avoid runaway loops if data is malformed.
    for (let i = 0; i < 120 && due <= horizonDate; i++) {
      await pool.query(
        `INSERT IGNORE INTO subscription_payments
          (subscription_id, due_date, expected_amount, status)
         VALUES (?, ?, ?, 'pending')`, [sub.id, due, sub.amount]);
      due = addPeriod(due, sub.recurrence);
    }
  }
}

async function getPayment(userId, id) {
  const [rows] = await pool.query(
    `SELECT p.id, p.subscription_id, s.name, s.category_id, c.name AS category_name,
            p.due_date, p.expected_amount, p.actual_amount, p.status, p.expense_id, p.paid_at,
            s.recurrence
       FROM subscription_payments p
       JOIN subscriptions s ON s.id = p.subscription_id
       JOIN categories c ON c.id = s.category_id
      WHERE p.id = ? AND s.user_id = ?`, [id, userId]);
  return rows[0] || null;
}

router.get('/', auth, wrap(async (req, res) => {
  await generatePayments(req.user.id);
  const [subscriptions] = await pool.query(
    `SELECT s.id, s.name, s.amount, s.category_id, c.name AS category_name,
            s.recurrence, s.next_due_date, s.active, s.created_at
       FROM subscriptions s JOIN categories c ON c.id = s.category_id
      WHERE s.user_id = ? ORDER BY s.active DESC, s.next_due_date ASC, s.name`,
    [req.user.id]);
  const [payments] = await pool.query(
    `SELECT p.id, p.subscription_id, s.name, s.category_id, c.name AS category_name,
            p.due_date, p.expected_amount, p.actual_amount, p.status, p.expense_id, p.paid_at
       FROM subscription_payments p
       JOIN subscriptions s ON s.id = p.subscription_id
       JOIN categories c ON c.id = s.category_id
      WHERE s.user_id = ?
      ORDER BY CASE p.status WHEN 'pending' THEN 0 WHEN 'paid' THEN 1 ELSE 2 END,
               p.due_date ASC`, [req.user.id]);
  const [totals] = await pool.query(
    `SELECT COALESCE(SUM(expected_amount), 0) AS pending_total,
            COUNT(*) AS pending_count
       FROM subscription_payments p JOIN subscriptions s ON s.id = p.subscription_id
      WHERE s.user_id = ? AND p.status = 'pending'
        AND DATE_FORMAT(p.due_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
    [req.user.id]);
  res.json({
    subscriptions,
    payments,
    summary: { pending_this_month: Number(totals[0].pending_total), pending_count: Number(totals[0].pending_count) }
  });
}));

router.post('/', auth, wrap(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const amount = parseAmount(req.body?.amount);
  const categoryId = parseId(req.body?.category_id);
  const recurrence = req.body?.recurrence || 'monthly';
  const dueDate = req.body?.next_due_date;
  if (!name || name.length > 100) return res.status(400).json({ error: 'Name is required (max 100 characters)' });
  if (amount === null) return res.status(400).json({ error: 'Amount must be greater than 0, with at most 2 decimals' });
  if (!categoryId) return res.status(400).json({ error: 'A category is required' });
  if (!validRecurrence(recurrence)) return res.status(400).json({ error: 'Recurrence must be monthly or yearly' });
  if (!isValidDate(dueDate) || dueDate < today()) return res.status(400).json({ error: 'Next due date must be today or a future date (YYYY-MM-DD)' });
  const [cats] = await pool.query('SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)', [categoryId, req.user.id]);
  if (!cats.length) return res.status(400).json({ error: 'Unknown category_id' });
  const [result] = await pool.query(
    `INSERT INTO subscriptions (user_id, name, amount, category_id, recurrence, next_due_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.user.id, name, amount, categoryId, recurrence, dueDate]);
  await generatePayments(req.user.id);
  res.status(201).json({ id: result.insertId, name, amount, category_id: categoryId, recurrence, next_due_date: dueDate, active: 1 });
}));

router.put('/payments/:id', auth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid payment id' });
  const payment = await getPayment(req.user.id, id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status !== 'pending') return res.status(409).json({ error: 'Only pending payments can be edited' });
  const amount = req.body?.expected_amount == null ? Number(payment.expected_amount) : parseAmount(req.body.expected_amount);
  const dueDate = req.body?.due_date == null ? String(payment.due_date).slice(0, 10) : req.body.due_date;
  if (amount === null || !(amount > 0)) return res.status(400).json({ error: 'Expected amount must be greater than 0' });
  if (!isValidDate(dueDate)) return res.status(400).json({ error: 'Due date must be YYYY-MM-DD' });
  await pool.query('UPDATE subscription_payments SET expected_amount = ?, due_date = ? WHERE id = ? AND status = "pending"', [amount, dueDate, id]);
  res.json(await getPayment(req.user.id, id));
}));

router.post('/payments/:id/confirm', auth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid payment id' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT p.*, s.user_id, s.category_id, s.name
         FROM subscription_payments p JOIN subscriptions s ON s.id = p.subscription_id
        WHERE p.id = ? AND s.user_id = ? FOR UPDATE`, [id, req.user.id]);
    const p = rows[0];
    if (!p) { await connection.rollback(); return res.status(404).json({ error: 'Payment not found' }); }
    if (p.status !== 'pending') { await connection.rollback(); return res.status(409).json({ error: 'Payment is no longer pending' }); }
    const amount = req.body?.actual_amount == null || req.body.actual_amount === ''
      ? Number(p.expected_amount) : parseAmount(req.body.actual_amount);
    if (amount === null || !(amount > 0)) { await connection.rollback(); return res.status(400).json({ error: 'Actual amount must be greater than 0' }); }
    const expenseDate = req.body?.expense_date || today();
    if (!isValidDate(expenseDate)) { await connection.rollback(); return res.status(400).json({ error: 'Expense date must be YYYY-MM-DD' }); }
    const [expense] = await connection.query(
      `INSERT INTO expenses (user_id, category_id, amount, description, expense_date)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, p.category_id, amount, `${p.name} subscription`, expenseDate]);
    await connection.query(
      `UPDATE subscription_payments SET status = 'paid', actual_amount = ?, expense_id = ?, paid_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'`, [amount, expense.insertId, id]);
    await connection.commit();
    res.json(await getPayment(req.user.id, id));
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally { connection.release(); }
}));

router.post('/payments/:id/dismiss', auth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid payment id' });
  const payment = await getPayment(req.user.id, id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status !== 'pending') return res.status(409).json({ error: 'Only pending payments can be dismissed' });
  await pool.query(`UPDATE subscription_payments SET status = 'dismissed' WHERE id = ? AND status = 'pending'`, [id]);
  res.json(await getPayment(req.user.id, id));
}));

router.put('/:id', auth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid subscription id' });
  const [rows] = await pool.query('SELECT id FROM subscriptions WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'Subscription not found' });
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const amount = parseAmount(req.body?.amount);
  const categoryId = parseId(req.body?.category_id);
  const recurrence = req.body?.recurrence;
  const dueDate = req.body?.next_due_date;
  const active = req.body?.active === false || req.body?.active === 0 ? 0 : 1;
  if (!name || name.length > 100 || amount === null || !categoryId || !validRecurrence(recurrence) || !isValidDate(dueDate))
    return res.status(400).json({ error: 'Valid name, amount, category, recurrence and due date are required' });
  const [cats] = await pool.query('SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)', [categoryId, req.user.id]);
  if (!cats.length) return res.status(400).json({ error: 'Unknown category_id' });
  await pool.query(`UPDATE subscriptions SET name=?, amount=?, category_id=?, recurrence=?, next_due_date=?, active=? WHERE id=? AND user_id=?`,
    [name, amount, categoryId, recurrence, dueDate, active, id, req.user.id]);
  res.json({ id, name, amount, category_id: categoryId, recurrence, next_due_date: dueDate, active });
}));

module.exports = router;
