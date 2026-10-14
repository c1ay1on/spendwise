import { mockRequest } from "./mock.js";

const TOKEN_KEY = "spendwise_token";
const useMockApi =
  import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API === "true";

export async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  if (useMockApi) {
    response = await mockRequest(path, { ...options, headers });
  } else {
    response = await fetch(path, { ...options, headers });
  }

  if (response.status === 401 && token) {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event("spendwise:logout"));
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
