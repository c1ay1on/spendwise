-- SpendWise schema. Runs on EVERY deploy: it must be safe to run repeatedly.
-- Never use DROP or TRUNCATE in this file.

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Savings goals created by individual users.
CREATE TABLE IF NOT EXISTS savings_goals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  target_amount DECIMAL(10,2) NOT NULL,
  target_date DATE NULL,
  monthly_contribution DECIMAL(10,2) NULL,
  status ENUM('active', 'completed', 'archived')
    NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_savings_goals_user_status (user_id, status),

  CONSTRAINT chk_savings_goal_target
    CHECK (target_amount > 0),

  CONSTRAINT fk_savings_goals_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Individual contributions reserved for savings goals.
CREATE TABLE IF NOT EXISTS goal_contributions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  goal_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  contribution_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_goal_contributions_goal_date
    (goal_id, contribution_date),

  CONSTRAINT chk_goal_contribution_amount
    CHECK (amount > 0),

  CONSTRAINT fk_goal_contributions_goal
    FOREIGN KEY (goal_id) REFERENCES savings_goals(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- user_id NULL = default category visible to everyone
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  name VARCHAR(50) NOT NULL,
  UNIQUE KEY uq_category_user_name (user_id, name),
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  expense_date DATE NOT NULL,
  receipt_key VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_expenses_user_date (user_id, expense_date),
  CONSTRAINT chk_expenses_amount CHECK (amount > 0),
  CONSTRAINT fk_expenses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One overall budget per user per month. month is 'YYYY-MM'.
CREATE TABLE IF NOT EXISTS budgets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  month CHAR(7) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  UNIQUE KEY uq_budget_user_month (user_id, month),
  CONSTRAINT chk_budgets_amount CHECK (amount > 0),
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Recurring subscriptions/bills and their individual due payments.
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category_id INT NOT NULL,
  recurrence ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  next_due_date DATE NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_subscriptions_user_active (user_id, active),
  CONSTRAINT chk_subscription_amount CHECK (amount > 0),
  CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_subscriptions_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subscription_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL,
  due_date DATE NOT NULL,
  expected_amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','paid','dismissed') NOT NULL DEFAULT 'pending',
  actual_amount DECIMAL(10,2) NULL,
  expense_id INT NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subscription_due (subscription_id, due_date),
  UNIQUE KEY uq_subscription_payment_expense (expense_id),
  KEY idx_subscription_payments_status_due (status, due_date),
  CONSTRAINT chk_subscription_payment_expected CHECK (expected_amount > 0),
  CONSTRAINT chk_subscription_payment_actual CHECK (actual_amount IS NULL OR actual_amount > 0),
  CONSTRAINT fk_subscription_payments_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_subscription_payments_expense FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Default categories. INSERT IGNORE would NOT prevent duplicates here (NULL user_ids
-- never collide in a unique key), so we check with NOT EXISTS instead.
INSERT INTO categories (user_id, name)
SELECT NULL, v.name
FROM (
  SELECT 'Food' AS name
  UNION ALL SELECT 'Transport'
  UNION ALL SELECT 'Rent'
  UNION ALL SELECT 'Utilities'
  UNION ALL SELECT 'Shopping'
  UNION ALL SELECT 'Health'
  UNION ALL SELECT 'Entertainment'
  UNION ALL SELECT 'Other'
) v
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.user_id IS NULL AND c.name = v.name
);
