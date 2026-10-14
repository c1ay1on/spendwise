import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import { api } from "../api/client.js";
import { getCurrentMonth } from "../utils/dates.js";

const COLORS = ["#5c61d6", "#41a58d", "#f0a64b", "#e57070", "#8290a6", "#ad76c8"];
const money = (amount) => amount == null ? "—" : new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2
}).format(amount);
export default function Dashboard() {
  const [month, setMonth] = useState(getCurrentMonth);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api(`/api/dashboard/summary?month=${encodeURIComponent(month)}`)
      .then((data) => { if (active) setSummary(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month]);

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">YOUR MONEY, MADE CLEAR</p><h1>Overview</h1></div>
        <label className="month-picker">Month
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </header>
      {error && <p className="error-banner" role="alert">{error}</p>}
      {loading && <p className="loading">Loading your summary…</p>}
      {!loading && summary && (
        <>
          {summary.alert !== "none" && (
            <div className={`alert-banner ${summary.alert}`} role="status">
              {summary.alert === "over"
                ? `You are over budget by ${money(Math.abs(summary.remaining))}.`
                : `You have used ${summary.percent_used.toFixed(0)}% of this month's budget.`}
            </div>
          )}
          <section className="summary-grid" aria-label="Monthly summary">
            <SummaryCard title="Monthly budget" value={money(summary.budget)} />
            <SummaryCard title="Total spent" value={money(summary.total_spent)} />
            <SummaryCard title="Remaining" value={money(summary.remaining)} />
            <SummaryCard title="Budget used" value={summary.percent_used == null ? "Set a budget" : `${summary.percent_used.toFixed(0)}%`} />
          </section>
          <BudgetProgress summary={summary} />
          <section className="chart-grid">
            <div className="panel chart-panel">
              <div className="panel-heading"><div><h2>Spending by category</h2><p className="muted">Where it went this month</p></div></div>
              {summary.by_category.length === 0
                ? <EmptyChart>No expenses for this month yet.</EmptyChart>
                : <div className="chart-area">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={summary.by_category} dataKey="total" nameKey="category_name"
                        innerRadius={65} outerRadius={96} paddingAngle={3}>
                        {summary.by_category.map((entry, index) =>
                          <Cell key={entry.category_id} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => money(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="legend">
                    {summary.by_category.map((item, index) =>
                      <li key={item.category_id}><span style={{ background: COLORS[index % COLORS.length] }} />
                        {item.category_name}<strong>{money(item.total)}</strong></li>)}
                  </ul>
                </div>}
            </div>
            <div className="panel chart-panel">
              <div className="panel-heading"><div><h2>Daily spending</h2><p className="muted">Your daily totals</p></div></div>
              {summary.daily.length === 0
                ? <EmptyChart>No daily activity to chart yet.</EmptyChart>
                : <div className="chart-area">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={summary.daily} margin={{ top: 10, right: 4, left: 0, bottom: 32 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(value) => value.slice(8)} angle={-45} textAnchor="end" />
                      <YAxis tickFormatter={(value) => `₹${value}`} width={58} />
                      <Tooltip labelFormatter={(value) => value} formatter={(value) => money(value)} />
                      <Bar dataKey="total" fill="#5c61d6" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>}
            </div>
          </section>
          <div className="dashboard-footer">
            <p>Want to review individual purchases?</p>
            <Link className="button button-light" to="/expenses">View transactions</Link>
          </div>
        </>
      )}
    </>
  );
}

function SummaryCard({ title, value }) {
  return <div className="summary-card"><p>{title}</p><strong>{value}</strong></div>;
}

function BudgetProgress({ summary }) {
  if (summary.budget == null) {
    return <div className="panel progress-panel">
      <div><h2>No budget set for this month</h2><p className="muted">Add one to track how much you have left.</p></div>
      <Link to="/budget" className="button button-primary">Set a budget</Link>
    </div>;
  }
  const width = Math.min(Math.max(summary.percent_used || 0, 0), 100);
  return <div className="panel progress-panel">
    <div className="progress-copy"><div><h2>Monthly budget progress</h2>
      <p className="muted">{money(summary.total_spent)} spent of {money(summary.budget)}</p></div>
      <Link to="/budget" className="text-link">Edit budget</Link></div>
    <div className={`progress-track ${summary.alert}`} role="progressbar"
      aria-valuenow={summary.percent_used} aria-valuemin="0" aria-valuemax="100">
      <span style={{ width: `${width}%` }} />
    </div>
  </div>;
}

function EmptyChart({ children }) {
  return <div className="empty-chart"><span className="empty-icon">◌</span><p>{children}</p></div>;
}
