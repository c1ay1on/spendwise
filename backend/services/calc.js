const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// percentUsed is unrounded. none < 80%, warning 80%..100% inclusive, over > 100%.
function alertLevel(percentUsed) {
  if (percentUsed === null || percentUsed === undefined) return 'none';
  if (percentUsed > 100) return 'over';
  if (percentUsed >= 80) return 'warning';
  return 'none';
}

function calcBudgetStatus(budget, spent) {
  const totalSpent = round2(Number(spent) || 0);
  if (budget === null || budget === undefined) {
    return { budget: null, total_spent: totalSpent, remaining: null, percent_used: null, alert: 'none' };
  }
  const b = Number(budget);
  const raw = (totalSpent / b) * 100;
  return {
    budget: round2(b),
    total_spent: totalSpent,
    remaining: round2(b - totalSpent),
    percent_used: Math.round(raw * 10) / 10,
    alert: alertLevel(raw)
  };
}

function buildSummary({ month, budget, totalSpent, byCategory, daily }) {
  return {
    month,
    ...calcBudgetStatus(budget, totalSpent),
    by_category: byCategory.map((r) => ({
      category_id: r.category_id,
      category_name: r.category_name,
      total: round2(Number(r.total))
    })),
    daily: daily.map((r) => ({ date: r.date, total: round2(Number(r.total)) }))
  };
}

module.exports = { round2, alertLevel, calcBudgetStatus, buildSummary };
