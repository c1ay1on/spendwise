
const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const wrap = require('../utils/asyncHandler');
const { isValidDate, currentMonth, monthRange } = require('../utils/dates');
const { parseAmount, parseId } = require('../utils/validate');

function validateGoal(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const targetAmount = parseAmount(body.target_amount);
  const monthlyContribution =
    body.monthly_contribution == null || body.monthly_contribution === ''
      ? null
      : parseAmount(body.monthly_contribution);

  const targetDate = body.target_date || null;

  if (!name || name.length > 100) {
    return { error: 'Goal name is required (maximum 100 characters)' };
  }
  if (targetAmount === null) {
    return { error: 'target_amount must be greater than 0, with at most 2 decimals' };
  }
  if (body.monthly_contribution != null &&
      body.monthly_contribution !== '' &&
      monthlyContribution === null) {
    return { error: 'monthly_contribution must be greater than 0, with at most 2 decimals' };
  }
  if (targetDate !== null && !isValidDate(targetDate)) {
    return { error: 'target_date must be a valid date (YYYY-MM-DD)' };
  }

  return {
    values: { name, targetAmount, monthlyContribution, targetDate }
  };
}

async function getGoal(userId, goalId) {
  const [rows] = await pool.query(
    `SELECT g.id, g.name, g.target_amount, g.target_date,
            g.monthly_contribution, g.status, g.created_at,
            COALESCE(SUM(c.amount), 0) AS saved
       FROM savings_goals g
       LEFT JOIN goal_contributions c ON c.goal_id = g.id
      WHERE g.id = ? AND g.user_id = ?
      GROUP BY g.id`,
    [goalId, userId]
  );

  return rows[0] ? formatGoal(rows[0]) : null;
}

function formatGoal(row) {
  const target = Number(row.target_amount);
  const saved = Number(row.saved);
  const remaining = Math.max(0, Math.round((target - saved) * 100) / 100);
  const monthly = row.monthly_contribution == null
    ? null
    : Number(row.monthly_contribution);

  let estimatedCompletionDate = null;
  if (remaining === 0) {
    estimatedCompletionDate = new Date().toISOString().slice(0, 10);
  } else if (monthly > 0) {
    const months = Math.ceil(remaining / monthly);
    const now = new Date();
    now.setUTCDate(1);
    now.setUTCMonth(now.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth() + 1, 0
    )).getUTCDate();
    now.setUTCDate(lastDay);
    estimatedCompletionDate = now.toISOString().slice(0, 10);
  }

  let requiredMonthlyContribution = null;
  if (remaining > 0 && row.target_date) {
    const today = new Date();
    const targetDate = new Date(`${row.target_date}T00:00:00Z`);
    const months = Math.max(
      1,
      (targetDate.getUTCFullYear() - today.getUTCFullYear()) * 12 +
      targetDate.getUTCMonth() - today.getUTCMonth()
    );
    requiredMonthlyContribution = Math.ceil((remaining / months) * 100) / 100;
  }

  return {
    id: row.id,
    name: row.name,
    target_amount: target,
    target_date: row.target_date,
    monthly_contribution: monthly,
    status: row.status,
    saved,
    remaining,
    progress_percent: Math.min(100, Math.round((saved / target) * 1000) / 10),
    estimated_completion_date: estimatedCompletionDate,
    required_monthly_contribution: requiredMonthlyContribution,
    created_at: row.created_at
  };
}

// List goals and calculate this month's available-to-spend amount.
router.get('/', auth, wrap(async (req, res) => {
  const uid = req.user.id;
  const month = currentMonth();
  const { start, end } = monthRange(month);

  const [goalRows] = await pool.query(
    `SELECT g.id, g.name, g.target_amount, g.target_date,
            g.monthly_contribution, g.status, g.created_at,
            COALESCE(SUM(c.amount), 0) AS saved
       FROM savings_goals g
       LEFT JOIN goal_contributions c ON c.goal_id = g.id
      WHERE g.user_id = ? AND g.status != 'archived'
      GROUP BY g.id
      ORDER BY g.created_at DESC`,
    [uid]
  );

  const [[budgetRows], [expenseRows], [contributionRows]] = await Promise.all([
    pool.query(
      'SELECT amount FROM budgets WHERE user_id = ? AND month = ?',
      [uid, month]
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
         FROM expenses
        WHERE user_id = ? AND expense_date >= ? AND expense_date < ?`,
      [uid, start, end]
    ),
    pool.query(
      `SELECT COALESCE(SUM(c.amount), 0) AS total
         FROM goal_contributions c
         JOIN savings_goals g ON g.id = c.goal_id
        WHERE g.user_id = ? AND c.contribution_date >= ?
          AND c.contribution_date < ?`,
      [uid, start, end]
    )
  ]);

  const budget = budgetRows[0] ? Number(budgetRows[0].amount) : null;
  const spent = Number(expenseRows[0].total);
  const contributedThisMonth = Number(contributionRows[0].total);

  res.json({
    goals: goalRows.map(formatGoal),
    monthly_budget: {
      month,
      budget,
      spent,
      contributed: contributedThisMonth,
      available_to_spend: budget === null
        ? null
        : Math.round((budget - spent - contributedThisMonth) * 100) / 100
    }
  });
}));

// Create a goal.
router.post('/', auth, wrap(async (req, res) => {
  const { error, values } = validateGoal(req.body);
  if (error) return res.status(400).json({ error });

  const [result] = await pool.query(
    `INSERT INTO savings_goals
       (user_id, name, target_amount, target_date, monthly_contribution)
     VALUES (?, ?, ?, ?, ?)`,
    [
      req.user.id,
      values.name,
      values.targetAmount,
      values.targetDate,
      values.monthlyContribution
    ]
  );

  res.status(201).json(await getGoal(req.user.id, result.insertId));
}));

// Update goal details or archive it.
router.put('/:id', auth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid goal id' });

  const existing = await getGoal(req.user.id, id);
  if (!existing) return res.status(404).json({ error: 'Goal not found' });

  if (req.body.status === 'archived') {
    await pool.query(
      `UPDATE savings_goals SET status = 'archived'
        WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    return res.json({ ...existing, status: 'archived' });
  }

  const { error, values } = validateGoal(req.body);
  if (error) return res.status(400).json({ error });

  await pool.query(
    `UPDATE savings_goals
        SET name = ?, target_amount = ?, target_date = ?,
            monthly_contribution = ?,
            status = CASE
              WHEN ? >= (SELECT COALESCE(SUM(amount), 0)
                           FROM goal_contributions
                          WHERE goal_id = ?) THEN 'completed'
              ELSE 'active'
            END
      WHERE id = ? AND user_id = ?`,
    [
      values.name,
      values.targetAmount,
      values.targetDate,
      values.monthlyContribution,
      values.targetAmount,
      id,
      id,
      req.user.id
    ]
  );

  res.json(await getGoal(req.user.id, id));
}));

// Add money reserved toward a goal; this does not create an expense.
router.post('/:id/contributions', auth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid goal id' });

  const amount = parseAmount(req.body?.amount);
  if (amount === null) {
    return res.status(400).json({
      error: 'amount must be greater than 0, with at most 2 decimals'
    });
  }

  const contributionDate = req.body?.contribution_date ||
    new Date().toISOString().slice(0, 10);

  if (!isValidDate(contributionDate)) {
    return res.status(400).json({
      error: 'contribution_date must be a valid date (YYYY-MM-DD)'
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [goals] = await connection.query(
      `SELECT id, target_amount, status
         FROM savings_goals
        WHERE id = ? AND user_id = ?
        FOR UPDATE`,
      [id, req.user.id]
    );

    if (!goals.length || goals[0].status === 'archived') {
      await connection.rollback();
      return res.status(404).json({ error: 'Active goal not found' });
    }

    const [[totals]] = await connection.query(
      `SELECT COALESCE(SUM(amount), 0) AS saved
         FROM goal_contributions WHERE goal_id = ?`,
      [id]
    );

    const remaining = Number(goals[0].target_amount) - Number(totals.saved);
    if (amount > remaining + 0.001) {
      await connection.rollback();
      return res.status(400).json({
        error: `Contribution exceeds the remaining goal amount of ${Math.max(0, remaining).toFixed(2)}`
      });
    }

    await connection.query(
      `INSERT INTO goal_contributions (goal_id, amount, contribution_date)
       VALUES (?, ?, ?)`,
      [id, amount, contributionDate]
    );

    const newSaved = Number(totals.saved) + amount;
    const status = newSaved >= Number(goals[0].target_amount)
      ? 'completed'
      : 'active';

    await connection.query(
      'UPDATE savings_goals SET status = ? WHERE id = ?',
      [status, id]
    );

    await connection.commit();
    res.status(201).json(await getGoal(req.user.id, id));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

module.exports = router;
