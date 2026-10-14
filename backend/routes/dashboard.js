
const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const wrap = require('../utils/asyncHandler');
const { isValidMonth, currentMonth, monthRange } = require('../utils/dates');
const { buildSummary } = require('../services/calc');

function previousMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, '0')}`;
}

function daysInMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function elapsedDays(month) {
  const now = new Date();
  const todayMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, '0')}`;

  if (month < todayMonth) return daysInMonth(month);
  if (month > todayMonth) return 0;

  return now.getDate();
}

router.get('/summary', auth, wrap(async (req, res) => {
  const month = req.query.month || currentMonth();

  if (!isValidMonth(month)) {
    return res.status(400).json({ error: 'month must be YYYY-MM' });
  }

  const uid = req.user.id;
  const { start, end } = monthRange(month);
  const prevMonth = previousMonth(month);
  const prevRange = monthRange(prevMonth);

  const [
    [budgetRows],
    [totalRows],
    [byCategory],
    [daily],
    [previousRows],
    [recentExpenses]
  ] = await Promise.all([
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
      `SELECT c.id AS category_id, c.name AS category_name,
              SUM(e.amount) AS total
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
    ),

    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
         FROM expenses
        WHERE user_id = ? AND expense_date >= ? AND expense_date < ?`,
      [uid, prevRange.start, prevRange.end]
    ),

    pool.query(
      `SELECT e.id, e.amount, e.description, e.expense_date,
              c.name AS category_name
         FROM expenses e
         JOIN categories c ON c.id = e.category_id
        WHERE e.user_id = ? AND e.expense_date >= ? AND e.expense_date < ?
        ORDER BY e.expense_date DESC, e.id DESC
        LIMIT 5`,
      [uid, start, end]
    )
  ]);

  const summary = buildSummary({
    month,
    budget: budgetRows[0] ? budgetRows[0].amount : null,
    totalSpent: totalRows[0].total,
    byCategory,
    daily
  });

  const totalSpent = Number(summary.total_spent);
  const previousSpent = Number(previousRows[0].total);
  const elapsed = elapsedDays(month);
  const totalDays = daysInMonth(month);

  // Forecast only the selected month using its average daily spending.
  const forecast = elapsed > 0
    ? Math.round((totalSpent / elapsed) * totalDays * 100) / 100
    : null;

  const previousDifference =
    Math.round((totalSpent - previousSpent) * 100) / 100;

  let comparisonPercent = null;
  if (previousSpent > 0) {
    comparisonPercent =
      Math.round((previousDifference / previousSpent) * 1000) / 10;
  } else if (totalSpent > 0) {
    comparisonPercent = null;
  } else {
    comparisonPercent = 0;
  }

  const largestExpense = recentExpenses.reduce(
    (largest, expense) =>
      !largest || Number(expense.amount) > Number(largest.amount)
        ? expense
        : largest,
    null
  );

  res.json({
    ...summary,

    comparison: {
      previous_month: prevMonth,
      previous_spent: Math.round(previousSpent * 100) / 100,
      difference: previousDifference,
      percent_change: comparisonPercent
    },

    forecast: {
      estimated_month_end: forecast,
      elapsed_days: elapsed,
      total_days: totalDays
    },

    insights: {
      top_category: summary.by_category[0] || null,
      largest_expense: largestExpense
        ? {
            ...largestExpense,
            amount: Number(largestExpense.amount)
          }
        : null
    },

    recent_expenses: recentExpenses.map((expense) => ({
      ...expense,
      amount: Number(expense.amount)
    }))
  });
}));

module.exports = router;
