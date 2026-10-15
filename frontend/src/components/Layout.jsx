import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AIAssistant from "./AIAssistant.jsx";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/">SpendWise<span>.</span></NavLink>
        <nav aria-label="Main navigation">
          <NavLink to="/">Overview</NavLink>
          <NavLink to="/expenses">Transactions</NavLink>
          <NavLink to="/budget">Monthly budget</NavLink>
	  <NavLink to="/forecasts">Forecasts</NavLink>
	  <NavLink to="/goals">Savings Goals</NavLink>
          <NavLink to="/subscriptions">Subscriptions</NavLink>
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{user?.name?.[0]?.toUpperCase() || "S"}</span>
          <span className="user-name">{user?.name}</span>
          <button className="link-button" onClick={signOut}>Log out</button>
        </div>
      </aside>
      <main className="main-content"><Outlet /></main><AIAssistant />
    </div>
  );
}
