import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

const Budget = lazy(() => import("./pages/Budget.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Expenses = lazy(() => import("./pages/Expenses.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const Forecasts = lazy(() => import("./pages/Forecasts.jsx"));

export default function App() {
  return (
    <Suspense fallback={<p className="centered">Loading SpendWise…</p>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="budget" element={<Budget />} />
	    <Route path="forecasts" element={<Forecasts />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
