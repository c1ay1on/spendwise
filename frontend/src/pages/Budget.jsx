import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { getCurrentMonth } from "../utils/dates.js";

const money = (amount) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2
}).format(amount);

export default function Budget() {
  const [month, setMonth] = useState(getCurrentMonth);
  const [amount, setAmount] = useState("");
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      api(`/api/budgets?month=${encodeURIComponent(month)}`),
      api(`/api/dashboard/summary?month=${encodeURIComponent(month)}`)
    ]).then(([budget, data]) => {
      if (!active) return;
      setAmount(budget.amount == null ? "" : String(budget.amount));
      setSummary(data);
    }).catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month]);

  async function save(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!(Number(amount) > 0)) {
      setError("Budget must be greater than ₹0.");
      return;
    }
    if (amount.split(".")[1]?.length > 2) {
      setError("Use no more than two decimal places.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/budgets", {
        method: "PUT",
        body: JSON.stringify({ month, amount: Number(amount) })
      });
      const latest = await api(`/api/dashboard/summary?month=${encodeURIComponent(month)}`);
      setSummary(latest);
      setNotice("Your monthly budget is saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const progress = summary?.percent_used == null ? 0 : Math.min(Math.max(summary.percent_used, 0), 100);
  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">PLAN AHEAD WITH CONFIDENCE</p><h1>Monthly budget</h1></div>
        <label className="month-picker">Choose month
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </header>
      {error && <p className="error-banner" role="alert">{error}</p>}
      {notice && <p className="success-banner" role="status">{notice}</p>}
      {loading ? <p className="loading">Loading budget…</p> : <div className="budget-layout">
        <section className="panel budget-form-panel">
          <p className="eyebrow">YOUR MONTHLY LIMIT</p>
          <h2>Set your budget</h2>
          <p className="muted">One overall spending target for {month}. You can update it anytime.</p>
          <form className="form-stack" onSubmit={save}>
            <label>Budget amount (₹)
              <input type="number" min="0.01" step="0.01" required value={amount}
                onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 25000" />
            </label>
            <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save budget"}</button>
          </form>
        </section>
        <section className="panel budget-status">
          <div className="budget-status-icon">₹</div>
          <p className="eyebrow">THIS MONTH SO FAR</p>
          <h2>{summary?.budget == null ? "No budget yet" : money(summary.remaining)}</h2>
          <p className="muted">{summary?.budget == null
            ? "Set an amount to start tracking your remaining budget."
            : `${money(summary.total_spent)} spent from ${money(summary.budget)}`}</p>
          {summary?.budget != null && <>
            <div className={`progress-track ${summary.alert}`} role="progressbar"
              aria-valuenow={summary.percent_used} aria-valuemin="0" aria-valuemax="100">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-labels"><span>{summary.percent_used.toFixed(0)}% used</span>
              <span>{money(summary.budget)} budget</span></div>
            {summary.alert !== "none" && <div className={`alert-banner ${summary.alert} compact`}>
              {summary.alert === "over" ? "You are over budget." : "You are approaching your budget limit."}
            </div>}
          </>}
        </section>
      </div>}
    </>
  );
}
