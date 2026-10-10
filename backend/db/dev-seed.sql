-- DEV ONLY. Never run on RDS. Assumes user id 1 exists.
SET @uid = 1;
SET @m = CAST(DATE_FORMAT(CURDATE(), '%Y-%m-01') AS DATE);
INSERT INTO expenses (user_id, category_id, amount, description, expense_date) VALUES
(@uid, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Food'),          250.00,  'Lunch',        DATE_ADD(@m, INTERVAL 1 DAY)),
(@uid, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Transport'),     120.50,  'Auto fare',    DATE_ADD(@m, INTERVAL 2 DAY)),
(@uid, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Rent'),         8000.00,  'Monthly rent', DATE_ADD(@m, INTERVAL 3 DAY)),
(@uid, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Food'),          340.00,  'Groceries',    DATE_ADD(@m, INTERVAL 5 DAY)),
(@uid, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Entertainment'), 499.00,  'Movie',        DATE_ADD(@m, INTERVAL 8 DAY));

INSERT INTO budgets (user_id, month, amount)
VALUES (@uid, DATE_FORMAT(CURDATE(), '%Y-%m'), 10000.00)
ON DUPLICATE KEY UPDATE amount = 10000.00;
