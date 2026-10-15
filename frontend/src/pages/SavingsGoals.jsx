import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";

const money = (amount) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2
}).format(Number(amount || 0));

const blankGoal = { name: "", target_amount: "", target_date: "", monthly_contribution: "" };

export default function SavingsGoals() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(blankGoal);
  const [contributions, setContributions] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const result = await api("/api/goals");
    setData(result);
  }, []);

  useEffect(() => {
    let active = true;
    api("/api/goals")
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function createGoal(event) {
    event.preventDefault();
    setError(""); setNotice("");
    if (!form.name.trim() || !(Number(form.target_amount) > 0)) {
      setError("Enter a goal name and a target amount greater than ₹0.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          target_amount: Number(form.target_amount),
          target_date: form.target_date || null,
          monthly_contribution: form.monthly_contribution ? Number(form.monthly_contribution) : null
        })
      });
      setForm(blankGoal);
      setShowForm(false);
      await refresh();
      setNotice("Savings goal created.");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function addContribution(event, goalId) {
    event.preventDefault();
    const amount = Number(contributions[goalId]);
    setError(""); setNotice("");
    if (!(amount > 0)) {
      setError("Enter a contribution greater than ₹0.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/goals/${goalId}/contributions`, {
        method: "POST", body: JSON.stringify({ amount })
      });
      setContributions((old) => ({ ...old, [goalId]: "" }));
      await refresh();
      setNotice("Savings contribution recorded. It is not added as an expense.");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const goals = data?.goals || [];
  const budget = data?.monthly_budget;
  const totalTarget = goals.reduce((sum, goal) => sum + Number(goal.target_amount || 0), 0);
  const totalSaved = goals.reduce((sum, goal) => sum + Number(goal.saved || 0), 0);

  return <>
    <header className="page-header goals-page-header">
      <div>
        <p className="eyebrow">MAKE YOUR PLANS HAPPEN</p>
        <h1>Savings Goals</h1>
        <p className="muted goals-intro">Set a target, build the habit, and track your progress.</p>
      </div>
      <button className="button button-primary" onClick={() => { setShowForm(!showForm); setError(""); }}>
        {showForm ? "Cancel" : "+ Create goal"}
      </button>
    </header>

    {error && <p className="error-banner" role="alert">{error}</p>}
    {notice && <p className="success-banner" role="status">{notice}</p>}

    {showForm && <section className="panel form-panel goals-form-panel">
      <div className="panel-heading"><div><h2>Create a savings goal</h2><p className="muted">Your contributions are kept separate from expenses.</p></div></div>
      <form className="form-stack goals-form-grid" onSubmit={createGoal}>
        <label>Goal name<input value={form.name} maxLength={100} placeholder="e.g. New bike" onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
        <label>Target amount (₹)<input type="number" min="0.01" step="0.01" value={form.target_amount} placeholder="30000" onChange={e => setForm({ ...form, target_amount: e.target.value })} required /></label>
        <label>Target date (optional)<input type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} /></label>
        <label>Planned monthly saving (₹)<input type="number" min="0.01" step="0.01" value={form.monthly_contribution} placeholder="e.g. 2500" onChange={e => setForm({ ...form, monthly_contribution: e.target.value })} /></label>
        <div className="form-actions goals-form-actions"><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Create goal"}</button></div>
      </form>
    </section>}

    <section className="summary-grid goals-summary-grid">
      <SummaryCard title="Total saved" value={money(totalSaved)} />
      <SummaryCard title="Total goal targets" value={money(totalTarget)} />
      <SummaryCard title="Available this month" value={budget ? money(budget.available_to_spend) : "—"} />
      <SummaryCard title="Monthly contributions" value={budget ? money(budget.contributed) : "—"} />
    </section>

    {budget && <section className="panel goals-budget-panel">
      <div className="progress-copy">
        <div><h2>Monthly spending allowance</h2><p className="muted">Budget minus expenses and savings contributions for {budget.month}.</p></div>
        <strong>{money(budget.available_to_spend)} left</strong>
      </div>
      <div className="goals-budget-details">
        <span>Budget <strong>{money(budget.budget)}</strong></span>
        <span>Spent <strong>{money(budget.spent)}</strong></span>
        <span>Saved this month <strong>{money(budget.contributed)}</strong></span>
      </div>
    </section>}

    <div className="goals-list-heading"><div><h2>Your goals</h2><p className="muted">Keep track of each milestone.</p></div><span className="goals-count">{goals.length} {goals.length === 1 ? "goal" : "goals"}</span></div>

    {loading ? <p className="loading">Loading your savings goals…</p> : goals.length === 0 ?
      <section className="panel empty-state goals-empty"><span className="empty-icon">＋</span><h2>Your next milestone starts here</h2><p>Create your first goal and start setting money aside.</p><button className="button button-primary" onClick={() => setShowForm(true)}>Create your first goal</button></section> :
      <section className="goals-grid">{goals.map(goal => {
        const progress = Math.min(100, Math.max(0, Number(goal.progress_percent || 0)));
        return <article className="panel goal-card" key={goal.id}>
          <div className="goal-card-top"><div className="goal-symbol">◎</div><span className={`goal-status ${goal.status}`}>{goal.status}</span></div>
          <h2 className="goal-name">{goal.name}</h2>
          <p className="muted">Target {goal.target_date ? new Date(`${goal.target_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "date not set"}</p>
          <div className="goal-amounts"><strong>{money(goal.saved)}</strong><span>of {money(goal.target_amount)}</span></div>
          <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div>
          <div className="goal-progress-meta"><span>{progress}% complete</span><span>{money(goal.remaining)} to go</span></div>
          <div className="goal-card-footer">
            <div><small>Planned monthly</small><strong>{goal.monthly_contribution ? money(goal.monthly_contribution) : "Not set"}</strong></div>
            <div><small>Estimated completion</small><strong>{goal.estimated_completion_date ? new Date(`${goal.estimated_completion_date}T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "Not available"}</strong></div>
          </div>
          {goal.status === "active" && <form className="inline-form goal-contribution-form" onSubmit={event => addContribution(event, goal.id)}>
            <label className="grow">Add savings (₹)<input type="number" min="0.01" step="0.01" value={contributions[goal.id] || ""} onChange={e => setContributions(old => ({ ...old, [goal.id]: e.target.value }))} placeholder="Amount" required /></label>
            <button className="button button-primary" disabled={busy}>Add</button>
          </form>}
        </article>;
      })}</section>}
  </>;
}

function SummaryCard({ title, value }) {
  return <div className="summary-card"><p>{title}</p><strong>{value}</strong></div>;
}
