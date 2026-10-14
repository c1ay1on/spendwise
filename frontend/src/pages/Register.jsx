import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await register(form);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Link className="brand" to="/">SpendWise<span>.</span></Link>
        <h1>Create your account</h1>
        <p className="muted">Start understanding your spending.</p>
        {error && <p className="error-banner" role="alert">{error}</p>}
        <label>Name
          <input autoComplete="name" required maxLength="100" value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label>Email
          <input type="email" autoComplete="email" required value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label>Password (at least 8 characters)
          <input type="password" autoComplete="new-password" minLength="8" required value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </label>
        <button className="button button-primary button-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
        <p className="auth-foot">Already registered? <Link to="/login">Sign in</Link></p>
      </form>
    </main>
  );
}
