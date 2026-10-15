
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";

const money = (v) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(v || 0));
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ name: "", amount: "", category_id: "", recurrence: "monthly", next_due_date: today() });

export default function Subscriptions() {
  const [data, setData] = useState({ subscriptions: [], payments: [], summary: { pending_this_month: 0, pending_count: 0 } });
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [actualAmount, setActualAmount] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [result, cats] = await Promise.all([api("/api/subscriptions"), api("/api/categories")]);
      setData(result); setCategories(cats);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/subscriptions", { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount), category_id: Number(form.category_id) }) });
      setForm(emptyForm()); setAdding(false); setNotice("Subscription added. Upcoming payments have been generated."); await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function confirmPayment(payment) {
    const input = window.prompt(`Confirm payment for ${payment.name}. Actual amount (₹):`, String(payment.expected_amount));
    if (input === null) return;
    if (!(Number(input) > 0)) { setError("Enter an actual amount greater than zero."); return; }
    setError(""); setNotice("");
    try {
      await api(`/api/subscriptions/payments/${payment.id}/confirm`, { method: "POST", body: JSON.stringify({ actual_amount: Number(input) }) });
      setNotice(`${payment.name} was recorded as an expense.`); await load();
    } catch (e) { setError(e.message); }
  }
  async function dismiss(payment) {
    if (!window.confirm(`Dismiss the ${payment.name} payment due ${String(payment.due_date).slice(0,10)}? No expense will be recorded.`)) return;
    setError(""); setNotice("");
    try { await api(`/api/subscriptions/payments/${payment.id}/dismiss`, { method: "POST" }); setNotice("Payment dismissed without recording an expense."); await load(); }
    catch (e) { setError(e.message); }
  }
  async function saveEdit(event) {
    event.preventDefault(); if (!editingPayment) return;
    setError(""); setNotice("");
    try {
      await api(`/api/subscriptions/payments/${editingPayment.id}`, { method: "PUT", body: JSON.stringify({ expected_amount: Number(editingPayment.expected_amount), due_date: editingPayment.due_date }) });
      setEditingPayment(null); setNotice("Pending payment updated."); await load();
    } catch (e) { setError(e.message); }
  }
  const pending = data.payments.filter(p => p.status === "pending");
  return <>
    <header className="page-header">
      <div><p className="eyebrow">STAY AHEAD OF RECURRING COSTS</p><h1>Subscriptions</h1></div>
      <button className="button button-primary" onClick={() => setAdding(v => !v)}>{adding ? "Cancel" : "+ Add subscription"}</button>
    </header>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {notice && <p className="success-banner" role="status">{notice}</p>}
    <div className="summary-grid subscription-summary">
      <div className="summary-card"><p>Pending this month</p><strong>{money(data.summary.pending_this_month)}</strong></div>
      <div className="summary-card"><p>Payments awaiting confirmation</p><strong>{data.summary.pending_count}</strong></div>
      <div className="summary-card"><p>Active subscriptions</p><strong>{data.subscriptions.filter(s => Boolean(s.active)).length}</strong></div>
      <div className="summary-card"><p>Recorded payments</p><strong>{data.payments.filter(p => p.status === "paid").length}</strong></div>
    </div>
    {adding && <section className="panel form-panel subscription-form">
      <div className="panel-heading"><div><h2>Add a subscription or bill</h2><p className="muted">Upcoming payments stay pending until you confirm them.</p></div></div>
      <form className="form-stack" onSubmit={create}>
        <label>Name<input required maxLength="100" value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="e.g. Streaming service" /></label>
        <label>Expected amount (₹)<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({...form, amount:e.target.value})} /></label>
        <label>Category<select required value={form.category_id} onChange={e => setForm({...form, category_id:e.target.value})}><option value="">Select category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Recurrence<select value={form.recurrence} onChange={e => setForm({...form, recurrence:e.target.value})}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
        <label>Next due date<input required type="date" min={today()} value={form.next_due_date} onChange={e => setForm({...form, next_due_date:e.target.value})} /></label>
        <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save subscription"}</button>
      </form>
    </section>}
    {editingPayment && <section className="panel form-panel"><h2>Edit pending payment</h2><form className="form-stack" onSubmit={saveEdit}>
      <label>Expected amount (₹)<input type="number" min="0.01" step="0.01" required value={editingPayment.expected_amount} onChange={e => setEditingPayment({...editingPayment, expected_amount:e.target.value})} /></label>
      <label>Due date<input type="date" required value={String(editingPayment.due_date).slice(0,10)} onChange={e => setEditingPayment({...editingPayment, due_date:e.target.value})} /></label>
      <div className="form-actions"><button className="button button-primary">Save changes</button><button type="button" className="button button-light" onClick={() => setEditingPayment(null)}>Cancel</button></div>
    </form></section>}
    <section className="panel transaction-panel">
      <div className="panel-heading"><div><h2>Upcoming payments</h2><p className="muted">Confirm only after the payment has actually gone through.</p></div></div>
      {loading ? <p className="loading">Loading subscriptions…</p> : pending.length === 0 ? <div className="empty-state"><span className="empty-icon">↻</span><h3>No pending payments</h3><p className="muted">Add a subscription to start tracking upcoming bills.</p></div>
      : <div className="table-wrap"><table><thead><tr><th>Payment</th><th>Category</th><th>Due date</th><th className="align-right">Expected</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {pending.map(p => <tr key={p.id}><td><strong>{p.name}</strong></td><td><span className="category-pill">{p.category_name}</span></td><td>{String(p.due_date).slice(0,10)}</td><td className="align-right amount-cell">{money(p.expected_amount)}</td><td><span className="category-pill">Pending</span></td><td><div className="form-actions"><button className="text-link" onClick={() => confirmPayment(p)}>Confirm</button><button className="text-link" onClick={() => setEditingPayment({...p, due_date:String(p.due_date).slice(0,10)})}>Edit</button><button className="text-link" onClick={() => dismiss(p)}>Dismiss</button></div></td></tr>)}
      </tbody></table></div>}
    </section>
    <section className="panel transaction-panel subscription-list"><div className="panel-heading"><div><h2>Your subscriptions</h2><p className="muted">Recurring rules used to generate future payment reminders.</p></div></div>
      {data.subscriptions.length === 0 ? <p className="muted">No subscriptions added yet.</p> : <div className="table-wrap"><table><thead><tr><th>Name</th><th>Category</th><th>Frequency</th><th className="align-right">Amount</th><th>Next due</th><th>Status</th></tr></thead><tbody>{data.subscriptions.map(s => <tr key={s.id}><td><strong>{s.name}</strong></td><td>{s.category_name}</td><td>{s.recurrence}</td><td className="align-right amount-cell">{money(s.amount)}</td><td>{String(s.next_due_date).slice(0,10)}</td><td>{s.active ? "Active" : "Paused"}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
