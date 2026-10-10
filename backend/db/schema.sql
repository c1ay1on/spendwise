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
