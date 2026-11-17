-- =====================================================================
-- DEV SEED DATA. Runs right after create.sql, which drops and recreates every
-- table, so ids are always handed out as 1, 2, 3... in the order rows are inserted.
-- The ids written in the comments and in the foreign-key columns below depend on that.
--
-- All six users share one DEV-ONLY password:   tethr-dev-1
-- Log in with any of the emails below (for example dyca1234@colorado.edu).
-- =====================================================================

-- Users: 1 Dylan, 2 Mia, 3 Sneha, 4 Jose, 5 Pearl, 6 Isha
INSERT INTO users (display_name, email, password_hash, venmo_username) VALUES
  ('Dylan Carter',    'dyca1234@colorado.edu', '$2b$10$1whN.kosvBXaJtOzvW1PqOKmbIKcC1ToZHefsdtTAbjzYzdOoK5R2', '@dyca1234'),
  ('Mia Trabadela',   'mitr1234@colorado.edu', '$2b$10$1whN.kosvBXaJtOzvW1PqOKmbIKcC1ToZHefsdtTAbjzYzdOoK5R2', '@mitr1234'),
  ('Sneha Kopparapu', 'snko1234@colorado.edu', '$2b$10$1whN.kosvBXaJtOzvW1PqOKmbIKcC1ToZHefsdtTAbjzYzdOoK5R2', '@snko1234'),
  ('Jose Caraveo',    'joca1234@colorado.edu', '$2b$10$1whN.kosvBXaJtOzvW1PqOKmbIKcC1ToZHefsdtTAbjzYzdOoK5R2', '@joca1234'),
  ('Pearl Lee',       'pele1234@colorado.edu', '$2b$10$1whN.kosvBXaJtOzvW1PqOKmbIKcC1ToZHefsdtTAbjzYzdOoK5R2', '@pele1234'),
  ('Isha Shah',       'issh1234@colorado.edu', '$2b$10$1whN.kosvBXaJtOzvW1PqOKmbIKcC1ToZHefsdtTAbjzYzdOoK5R2', '@issh1234');

-- Circles: 1 Apartment Roommates, 2 Friday Night Group, 3 Spring Break Trip, 4 CSCI 3308 Team 6
-- Dylan is NOT in Friday Night Group on purpose: join it with the code TETH-204
INSERT INTO circles (name, invite_code, created_by) VALUES
  ('Apartment Roommates', 'TETH-ROOM01', 1),
  ('Friday Night Group',  'TETH-204',    2),
  ('Spring Break Trip',   'TETH-SPRING', 1),
  ('CSCI 3308 Team 6',    'TETH-3308T6', 6);

INSERT INTO circle_members (circle_id, user_id, role) VALUES
  (1, 1, 'admin'), (1, 5, 'member'), (1, 6, 'member'), (1, 3, 'member'),
  (2, 2, 'admin'), (2, 3, 'member'), (2, 4, 'member'), (2, 5, 'member'),
  (3, 1, 'admin'), (3, 2, 'member'), (3, 4, 'member'), (3, 6, 'member'),
  (4, 6, 'admin'), (4, 1, 'member'), (4, 2, 'member'), (4, 3, 'member'), (4, 4, 'member'), (4, 5, 'member');

-- Events: 1 Ski trip, 2 Mia's birthday dinner, 3 Apartment cleaning day
INSERT INTO events (circle_id, created_by, title, location, starts_at) VALUES
  (3, 1, 'Ski trip',               'Breckenridge, CO',        (CURRENT_DATE + 20) + TIME '08:00'),
  (2, 2, 'Mia''s birthday dinner', 'Sushi Zanmai, Pearl St',  (CURRENT_DATE + 3)  + TIME '19:00'),
  (1, 1, 'Apartment cleaning day', 'The apartment',           (CURRENT_DATE + 5)  + TIME '14:00');

INSERT INTO event_rsvps (event_id, user_id, status) VALUES
  (1, 1, 'going'), (1, 2, 'going'), (1, 4, 'maybe'), (1, 6, 'no'),
  (2, 2, 'going'), (2, 3, 'going'), (2, 4, 'maybe'), (2, 5, 'going'),
  (3, 1, 'going'), (3, 5, 'going'), (3, 6, 'maybe'), (3, 3, 'going');

-- Recurring bills: 1 Internet, 2 Rent
INSERT INTO recurring_bills (circle_id, paid_by, name, amount, frequency, next_due_date, remind_days_before) VALUES
  (1, 5, 'Internet', 60.00,   'monthly', CURRENT_DATE + 8,  3),
  (1, 1, 'Rent',     3200.00, 'monthly', CURRENT_DATE + 14, 5);

-- Expenses 1-9
INSERT INTO expenses (circle_id, paid_by, event_id, recurring_bill_id, name, total_amount, expense_date, split_type, note) VALUES
  (1, 1, NULL, NULL, 'Weekly groceries',          92.40, CURRENT_DATE - 2, 'equal',  NULL),
  (1, 5, NULL, 1,    'Internet (Nov)',            60.00, CURRENT_DATE - 5, 'equal',  'Recurring bill'),
  (1, 6, NULL, NULL, 'Cleaning supplies',         24.00, CURRENT_DATE - 7, 'custom', 'Not an even split'),
  (1, 1, NULL, NULL, 'Dinner at sushi',           80.00, CURRENT_DATE - 9, 'equal',  NULL),
  (3, 2, 1,    NULL, 'Airbnb deposit',           240.00, CURRENT_DATE - 4, 'equal',  'Attached to the ski trip'),
  (3, 4, NULL, NULL, 'Groceries for the trip',    45.00, CURRENT_DATE - 3, 'equal',  NULL),
  (2, 3, NULL, NULL, 'Concert tickets',          144.00, CURRENT_DATE - 6, 'equal',  NULL),
  (2, 2, NULL, NULL, 'Pizza and drinks',          31.51, CURRENT_DATE - 1, 'equal',  'Cents do not divide evenly: 7.88 + 7.88 + 7.88 + 7.87'),
  (4, 6, NULL, NULL, 'Poster board and supplies', 18.00, CURRENT_DATE - 8, 'equal',  NULL);

-- Each expense's splits add up to exactly its total (the database does NOT check this for you)
INSERT INTO expense_splits (expense_id, user_id, amount_owed) VALUES
  (1, 1, 23.10), (1, 5, 23.10), (1, 6, 23.10), (1, 3, 23.10),   -- 92.40
  (2, 1, 15.00), (2, 5, 15.00), (2, 6, 15.00), (2, 3, 15.00),   -- 60.00
  (3, 1, 10.00), (3, 5,  4.00), (3, 6,  6.00), (3, 3,  4.00),   -- 24.00 (custom)
  (4, 1, 20.00), (4, 5, 20.00), (4, 6, 20.00), (4, 3, 20.00),   -- 80.00
  (5, 1, 60.00), (5, 2, 60.00), (5, 4, 60.00), (5, 6, 60.00),   -- 240.00
  (6, 1, 11.25), (6, 2, 11.25), (6, 4, 11.25), (6, 6, 11.25),   -- 45.00
  (7, 2, 36.00), (7, 3, 36.00), (7, 4, 36.00), (7, 5, 36.00),   -- 144.00
  (8, 2,  7.88), (8, 3,  7.88), (8, 4,  7.88), (8, 5,  7.87),   -- 31.51
  (9, 1,  3.00), (9, 2,  3.00), (9, 3,  3.00), (9, 4,  3.00), (9, 5, 3.00), (9, 6, 3.00);  -- 18.00

-- Payments: Pearl paid Dylan (confirmed), Isha says she paid Dylan (still pending), Dylan paid Mia (confirmed)
INSERT INTO payments (circle_id, from_user, to_user, amount, status) VALUES
  (1, 5, 1, 23.10, 'confirmed'),
  (1, 6, 1, 20.00, 'pending'),
  (3, 1, 2, 60.00, 'confirmed');