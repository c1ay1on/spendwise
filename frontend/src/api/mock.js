const DB_KEY = "spendwise_mock_data";
const TOKEN_KEY = "spendwise_token";
const DEFAULT_CATEGORIES = [
  { id: 1, name: "Food", is_default: true },
  { id: 2, name: "Transport", is_default: true },
  { id: 3, name: "Shopping", is_default: true },
  { id: 4, name: "Bills", is_default: true },
  { id: 5, name: "Other", is_default: true }
];

function freshDb() {
  return { users: [], categories: [], expenses: [], budgets: [] };
}

function readDb() {
  try {
    return { ...freshDb(), ...JSON.parse(localStorage.getItem(DB_KEY) || "{}") };
  } catch {
    return freshDb();
  }
}

function writeDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function reply(status, data) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function monthOf(date) {
  return date.slice(0, 7);
}

export async function mockRequest(path, options = {}) {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const method = (options.method || "GET").toUpperCase();
  const url = new URL(path, window.location.origin);
  const route = url.pathname;
  const parts = route.split("/").filter(Boolean);
  const db = readDb();
  const token = localStorage.getItem(TOKEN_KEY);
  const user = db.users.find((item) => item.token === token);
  const body = options.body && typeof options.body === "string"
    ? JSON.parse(options.body)
    : {};

  if (route === "/api/health" && method === "GET") {
    return reply(200, { status: "ok" });
  }

  if (route === "/api/auth/register" && method === "POST") {
    if (!body.name || !body.email || !body.password || body.password.length < 8) {
      return reply(400, { error: "Name, valid email, and a password of at least 8 characters are required." });
    }
    if (db.users.some((item) => item.email.toLowerCase() === body.email.toLowerCase())) {
      return reply(409, { error: "An account with this email already exists." });
    }
    const newUser = {
      id: Date.now(),
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      password: body.password,
      token: `mock-${crypto.randomUUID()}`
    };
    db.users.push(newUser);
    writeDb(db);
    return reply(201, {
      token: newUser.token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email }
    });
  }

  if (route === "/api/auth/login" && method === "POST") {
    const found = db.users.find((item) => item.email === (body.email || "").toLowerCase()
      && item.password === body.password);
    if (!found) return reply(401, { error: "Email or password is incorrect." });
    return reply(200, {
      token: found.token,
      user: { id: found.id, name: found.name, email: found.email }
    });
  }

  if (!user) return reply(401, { error: "Please log in." });

  if (route === "/api/auth/me" && method === "GET") {
    return reply(200, { user: { id: user.id, name: user.name, email: user.email } });
  }

  if (route === "/api/categories" && method === "GET") {
    return reply(200, [...DEFAULT_CATEGORIES, ...db.categories.filter((item) => item.user_id === user.id)
      .map(({ id, name }) => ({ id, name, is_default: false }))]);
  }

  if (route === "/api/categories" && method === "POST") {
    const name = (body.name || "").trim();
    if (!name) return reply(400, { error: "Category name is required." });
    const nameTaken = DEFAULT_CATEGORIES.some((item) =>
      item.name.toLowerCase() === name.toLowerCase()
    ) || db.categories.some((item) =>
      item.user_id === user.id && item.name.toLowerCase() === name.toLowerCase()
    );
    if (nameTaken) return reply(409, { error: "This category already exists." });
    const id = Date.now();
    db.categories.push({ id, name, user_id: user.id });
    writeDb(db);
    return reply(201, { id, name, is_default: false });
  }

  if (route === "/api/expenses" && method === "GET") {
    let expenses = db.expenses.filter((item) => item.user_id === user.id);
    const month = url.searchParams.get("month");
    const categoryId = url.searchParams.get("category_id");
    if (month) expenses = expenses.filter((item) => monthOf(item.expense_date) === month);
    if (categoryId) expenses = expenses.filter((item) => item.category_id === Number(categoryId));
    return reply(200, expenses.sort((a, b) =>
      b.expense_date.localeCompare(a.expense_date) || b.created_at.localeCompare(a.created_at)
    ).map(({ user_id, ...item }) => item));
  }

  if (route === "/api/expenses" && method === "POST") {
    const category = [...DEFAULT_CATEGORIES, ...db.categories.filter((item) =>
      item.user_id === user.id)].find((item) => item.id === Number(body.category_id));
    if (!(Number(body.amount) > 0) || !/^\d+(\.\d{1,2})?$/.test(String(body.amount))
      || !category || !/^\d{4}-\d{2}-\d{2}$/.test(body.expense_date || "")) {
      return reply(400, { error: "Enter a valid amount, category, and date." });
    }
    const item = {
      id: Date.now(),
      amount: Number(Number(body.amount).toFixed(2)),
      category_id: Number(body.category_id),
      category_name: category.name,
      description: body.description || "",
      expense_date: body.expense_date,
      has_receipt: false,
      created_at: new Date().toISOString(),
      user_id: user.id
    };
    db.expenses.push(item);
    writeDb(db);
    const { user_id, ...publicItem } = item;
    return reply(201, publicItem);
  }

  if (parts[1] === "expenses" && parts[2]) {
    const id = Number(parts[2]);
    const item = db.expenses.find((expense) => expense.id === id && expense.user_id === user.id);
    if (!item) return reply(404, { error: "Expense not found." });
    if (parts[3] === "receipt" && method === "POST") {
      const form = options.body;
      const file = form instanceof FormData ? form.get("receipt") : null;
      if (!file) return reply(400, { error: "Choose a receipt file." });
      item.has_receipt = true;
      item.mock_receipt_name = file.name;
      writeDb(db);
      return reply(200, { has_receipt: true });
    }
    if (parts[3] === "receipt" && method === "GET") {
      return item.has_receipt
        ? reply(200, { url: `data:text/plain,Mock%20receipt%3A%20${encodeURIComponent(item.mock_receipt_name || "receipt")}` })
        : reply(404, { error: "No receipt is attached to this expense." });
    }
    if (method === "PUT") {
      const category = [...DEFAULT_CATEGORIES, ...db.categories.filter((entry) =>
        entry.user_id === user.id)].find((entry) => entry.id === Number(body.category_id));
      if (!(Number(body.amount) > 0) || !/^\d+(\.\d{1,2})?$/.test(String(body.amount))
        || !category || !/^\d{4}-\d{2}-\d{2}$/.test(body.expense_date || "")) {
        return reply(400, { error: "Enter a valid amount, category, and date." });
      }
      Object.assign(item, {
        amount: Number(Number(body.amount).toFixed(2)),
        category_id: Number(body.category_id),
        category_name: category.name,
        description: body.description || "",
        expense_date: body.expense_date
      });
      writeDb(db);
      const { user_id, ...publicItem } = item;
      return reply(200, publicItem);
    }
    if (method === "DELETE") {
      db.expenses = db.expenses.filter((expense) => expense.id !== id || expense.user_id !== user.id);
      writeDb(db);
      return reply(204, null);
    }
  }

  if (route === "/api/budgets" && method === "GET") {
    const month = url.searchParams.get("month") || "";
    const budget = db.budgets.find((item) => item.user_id === user.id && item.month === month);
    return reply(200, { month, amount: budget ? budget.amount : null });
  }

  if (route === "/api/budgets" && method === "PUT") {
    if (!/^\d{4}-\d{2}$/.test(body.month) || !(Number(body.amount) > 0)
      || !/^\d+(\.\d{1,2})?$/.test(String(body.amount))) {
      return reply(400, { error: "Enter a valid month and budget greater than zero." });
    }
    let budget = db.budgets.find((item) => item.user_id === user.id && item.month === body.month);
    if (budget) budget.amount = Number(Number(body.amount).toFixed(2));
    else {
      budget = { user_id: user.id, month: body.month, amount: Number(Number(body.amount).toFixed(2)) };
      db.budgets.push(budget);
    }
    writeDb(db);
    return reply(200, { month: budget.month, amount: budget.amount });
  }

  if (route === "/api/dashboard/summary" && method === "GET") {
    const month = url.searchParams.get("month") || "";
    const expenses = db.expenses.filter((item) => item.user_id === user.id
      && monthOf(item.expense_date) === month);
    const budget = db.budgets.find((item) => item.user_id === user.id && item.month === month);
    const total = expenses.reduce((sum, item) => sum + item.amount, 0);
    const grouped = new Map();
    const daily = new Map();
    expenses.forEach((item) => {
      grouped.set(item.category_id, (grouped.get(item.category_id) || 0) + item.amount);
      daily.set(item.expense_date, (daily.get(item.expense_date) || 0) + item.amount);
    });
    const amount = budget ? budget.amount : null;
    const percent = amount === null ? null : amount === 0 ? 0 : total / amount * 100;
    return reply(200, {
      month,
      budget: amount,
      total_spent: Number(total.toFixed(2)),
      remaining: amount === null ? null : Number((amount - total).toFixed(2)),
      percent_used: percent === null ? null : Number(percent.toFixed(2)),
      alert: percent === null || percent < 80 ? "none" : percent <= 100 ? "warning" : "over",
      by_category: [...grouped].map(([category_id, sum]) => ({
        category_id,
        category_name: [...DEFAULT_CATEGORIES, ...db.categories]
          .find((category) => category.id === category_id)?.name || "Other",
        total: Number(sum.toFixed(2))
      })),
      daily: [...daily].sort(([a], [b]) => a.localeCompare(b))
        .map(([date, sum]) => ({ date, total: Number(sum.toFixed(2)) }))
    });
  }

  return reply(404, { error: "Mock route not implemented." });
}
