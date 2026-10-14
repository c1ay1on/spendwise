import { useCallback, useEffect, useState } from "react";
import ExpenseForm from "../components/ExpenseForm.jsx";
import { api } from "../api/client.js";
import { getCurrentMonth } from "../utils/dates.js";

const money = (amount) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2
}).format(amount);

export default function Expenses() {
  const [month, setMonth] = useState(getCurrentMonth);
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ month });
      if (categoryId) query.set("category_id", categoryId);
      setExpenses(await api(`/api/expenses?${query.toString()}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [month, categoryId]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);
  useEffect(() => {
    api("/api/categories").then(setCategories).catch((err) => setError(err.message));
  }, []);

  async function saveExpense(values) {
    if (editing) await api(`/api/expenses/${editing.id}`, { method: "PUT", body: JSON.stringify(values) });
    else await api("/api/expenses", { method: "POST", body: JSON.stringify(values) });
    setEditing(null);
    setAdding(false);
    await loadExpenses();
  }

  async function removeExpense(expense) {
    if (!window.confirm(`Delete the ${money(expense.amount)} expense?`)) return;
    setError("");
    try {
      await api(`/api/expenses/${expense.id}`, { method: "DELETE" });
      await loadExpenses();
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadReceipt(expense, file) {
    setError("");
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setError("Receipt must be a JPG, PNG, or PDF file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Receipt must be 10 MB or smaller.");
      return;
    }
    try {
      const form = new FormData();
      form.append("receipt", file);
      await api(`/api/expenses/${expense.id}/receipt`, { method: "POST", body: form });
      await loadExpenses();
    } catch (err) {
      setError(err.message);
    }
  }

  async function viewReceipt(expense) {
    setError("");
    const receiptTab = window.open("about:blank", "_blank");
    if (!receiptTab) {
      setError("Allow pop-ups to open the receipt in a new tab.");
      return;
    }
    receiptTab.opener = null;
    try {
      const result = await api(`/api/expenses/${expense.id}/receipt`);
      receiptTab.location.replace(result.url);
    } catch (err) {
      receiptTab.close();
      setError(err.message);
    }
  }

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">KEEP EVERY PURCHASE IN VIEW</p><h1>Transactions</h1></div>
        <button className="button button-primary" onClick={() => { setEditing(null); setAdding(true); }}>+ Add expense</button>
      </header>
      <section className="panel filters">
        <label>Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
        <label>Category
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
      </section>
      {error && <p className="error-banner" role="alert">{error}</p>}
      {(adding || editing) && <section className="panel form-panel">
        <div className="panel-heading"><h2>{editing ? "Edit expense" : "Add an expense"}</h2></div>
        <ExpenseForm key={editing?.id || "new"} expense={editing}
          onSave={saveExpense} onCancel={() => { setAdding(false); setEditing(null); }} />
      </section>}
      <section className="panel transaction-panel">
        <div className="panel-heading"><div><h2>Expense history</h2><p className="muted">Newest transactions first</p></div></div>
        {loading ? <p className="loading">Loading transactions…</p>
          : expenses.length === 0 ? <div className="empty-state">
            <span className="empty-icon">↗</span><h3>No expenses found</h3>
            <p className="muted">Try another filter or add your first expense.</p>
          </div>
            : <div className="table-wrap"><table>
              <thead><tr><th>Expense</th><th>Category</th><th>Date</th><th className="align-right">Amount</th><th>Receipt</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{expenses.map((expense) => <tr key={expense.id}>
                <td><strong>{expense.description || expense.category_name}</strong>
                  {expense.description && <small>{expense.category_name}</small>}</td>
                <td><span className="category-pill">{expense.category_name}</span></td>
                <td>{expense.expense_date}</td>
                <td className="align-right amount-cell">{money(expense.amount)}</td>
                <td>{expense.has_receipt
                  ? <button className="text-link" onClick={() => viewReceipt(expense)}>View receipt</button>
                  : <label className="upload-link">Upload<input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                    onChange={(event) => { uploadReceipt(expense, event.target.files?.[0]); event.target.value = ""; }} /></label>}</td>
                <td><div className="row-actions">
                  <button className="text-link" onClick={() => { setAdding(false); setEditing(expense); }}>Edit</button>
                  <button className="text-link danger-text" onClick={() => removeExpense(expense)}>Delete</button>
                </div></td>
              </tr>)}</tbody>
            </table></div>}
      </section>
    </>
  );
}
