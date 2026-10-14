import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login({ email, password });
      navigate(location.state?.from?.pathname || "/", { replace: true });
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
        <h1>Welcome back</h1>
        <p className="muted">Sign in to see how your money is moving.</p>
        {error && <p className="error-banner" role="alert">{error}</p>}
        <label>Email
          <input type="email" autoComplete="email" required value={email}
            onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>Password
          <input type="password" autoComplete="current-password" required value={password}
            onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button className="button button-primary button-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="auth-foot">New to SpendWise? <Link to="/register">Create an account</Link></p>
      </form>
    </main>
  );
}
