DROP TABLE IF EXISTS event_rsvps CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS expense_splits CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS recurring_bills CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS circle_members CASCADE;
DROP TABLE IF EXISTS circles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  user_id        SERIAL PRIMARY KEY,
  display_name   VARCHAR(100) NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  venmo_username VARCHAR(100),
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE circles (
  circle_id   SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  invite_code VARCHAR(20) NOT NULL UNIQUE,
  created_by  INT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_circles_created_by FOREIGN KEY (created_by) REFERENCES users (user_id)
);

CREATE TABLE circle_members (
  circle_id INT NOT NULL,
  user_id   INT NOT NULL,
  role      VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_circle_members PRIMARY KEY (circle_id, user_id),
  CONSTRAINT fk_cm_circle FOREIGN KEY (circle_id) REFERENCES circles (circle_id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT chk_cm_role CHECK (role IN ('admin', 'member'))
);

CREATE TABLE events (
  event_id   SERIAL PRIMARY KEY,
  circle_id  INT NOT NULL,
  created_by INT NOT NULL,
  title      VARCHAR(150) NOT NULL,
  location   VARCHAR(200),
  starts_at  TIMESTAMP NOT NULL,
  CONSTRAINT fk_events_circle FOREIGN KEY (circle_id) REFERENCES circles (circle_id) ON DELETE CASCADE,
  CONSTRAINT fk_events_created_by FOREIGN KEY (created_by) REFERENCES users (user_id)
);

CREATE TABLE event_rsvps (
  event_id INT NOT NULL,
  user_id  INT NOT NULL,
  status   VARCHAR(10) NOT NULL DEFAULT 'maybe',
  CONSTRAINT pk_event_rsvps PRIMARY KEY (event_id, user_id),
  CONSTRAINT fk_rsvp_event FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE CASCADE,
  CONSTRAINT fk_rsvp_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT chk_rsvp_status CHECK (status IN ('going', 'maybe', 'no'))
);

CREATE TABLE recurring_bills (
  bill_id            SERIAL PRIMARY KEY,
  circle_id          INT NOT NULL,
  paid_by            INT NOT NULL,
  name               VARCHAR(100) NOT NULL,
  amount             NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  frequency          VARCHAR(10) NOT NULL,
  next_due_date      DATE NOT NULL,
  remind_days_before INT NOT NULL DEFAULT 3,
  CONSTRAINT fk_bills_circle FOREIGN KEY (circle_id) REFERENCES circles (circle_id) ON DELETE CASCADE,
  CONSTRAINT fk_bills_paid_by FOREIGN KEY (paid_by) REFERENCES users (user_id),
  CONSTRAINT chk_bills_frequency CHECK (frequency IN ('weekly', 'monthly', 'yearly'))
);

CREATE TABLE expenses (
  expense_id        SERIAL PRIMARY KEY,
  circle_id         INT NOT NULL,
  paid_by           INT NOT NULL,
  event_id          INT,
  recurring_bill_id INT,
  name              VARCHAR(150) NOT NULL,
  total_amount      NUMERIC(10,2) NOT NULL CHECK (total_amount > 0),
  expense_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  split_type        VARCHAR(12) NOT NULL DEFAULT 'equal',
  note              TEXT,
  CONSTRAINT fk_exp_circle FOREIGN KEY (circle_id) REFERENCES circles (circle_id) ON DELETE CASCADE,
  CONSTRAINT fk_exp_paid_by FOREIGN KEY (paid_by) REFERENCES users (user_id),
  CONSTRAINT fk_exp_event FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE SET NULL,
  CONSTRAINT fk_exp_bill FOREIGN KEY (recurring_bill_id) REFERENCES recurring_bills (bill_id) ON DELETE SET NULL,
  CONSTRAINT chk_exp_split_type CHECK (split_type IN ('equal', 'custom', 'percentage'))
);

CREATE TABLE expense_splits (
  expense_id  INT NOT NULL,
  user_id     INT NOT NULL,
  amount_owed NUMERIC(10,2) NOT NULL CHECK (amount_owed >= 0),
  CONSTRAINT pk_expense_splits PRIMARY KEY (expense_id, user_id),
  CONSTRAINT fk_split_expense FOREIGN KEY (expense_id) REFERENCES expenses (expense_id) ON DELETE CASCADE,
  CONSTRAINT fk_split_user FOREIGN KEY (user_id) REFERENCES users (user_id)
);

CREATE TABLE payments (
  payment_id SERIAL PRIMARY KEY,
  circle_id  INT NOT NULL,
  from_user  INT NOT NULL,
  to_user    INT NOT NULL,
  amount     NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status     VARCHAR(10) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_pay_circle FOREIGN KEY (circle_id) REFERENCES circles (circle_id) ON DELETE CASCADE,
  CONSTRAINT fk_pay_from FOREIGN KEY (from_user) REFERENCES users (user_id),
  CONSTRAINT fk_pay_to FOREIGN KEY (to_user) REFERENCES users (user_id),
  CONSTRAINT chk_pay_status CHECK (status IN ('pending', 'confirmed')),
  CONSTRAINT chk_pay_different_users CHECK (from_user <> to_user)
);