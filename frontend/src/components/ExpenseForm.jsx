import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { getCurrentDate } from "../utils/dates.js";

export default function ExpenseForm({ expense, onSave, onCancel }) {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    amount: expense?.amount ?? "",
    category_id: expense?.category_id ?? "",
    description: expense?.description ?? "",
    expense_date: expense?.expense_date ?? getCurrentDate()
  });
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/categories").then(setCategories).catch((err) => setError(err.message));
  }, []);

  async function addCategory() {
    setError("");
    try {
      const result = await api("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCategory })
      });
      setCategories((items) => [...items, result]);
      setForm((current) => ({ ...current, category_id: result.id }));
      setNewCategory("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be greater than ₹0.");
      return;
    }
    if (form.amount.split(".")[1]?.length > 2) {
      setError("Use no more than two decimal places.");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        ...form,
        amount,
        category_id: Number(form.category_id)
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <label>Amount (₹)
        <input type="number" min="0.01" step="0.01" required value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })} />
      </label>
      <label>Category
        <select required value={form.category_id}
          onChange={(event) => setForm({ ...form, category_id: event.target.value })}>
          <option value="">Choose a category</option>
          {categories.map((category) =>
            <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <div className="inline-form">
        <label className="grow">Add your own category
          <input value={newCategory} maxLength="60" placeholder="e.g. Books"
            onChange={(event) => setNewCategory(event.target.value)} />
        </label>
        <button className="button button-light" type="button" onClick={addCategory}
          disabled={!newCategory.trim()}>Add</button>
      </div>
      <label>Description
        <input value={form.description} maxLength="255" placeholder="Optional note"
          onChange={(event) => setForm({ ...form, description: event.target.value })} />
      </label>
      <label>Date
        <input type="date" required value={form.expense_date}
          onChange={(event) => setForm({ ...form, expense_date: event.target.value })} />
      </label>
      <div className="form-actions">
        <button className="button button-light" type="button" onClick={onCancel}>Cancel</button>
        <button className="button button-primary" disabled={busy}>
          {busy ? "Saving…" : expense ? "Save changes" : "Add expense"}
        </button>
      </div>
    </form>
  );
}
