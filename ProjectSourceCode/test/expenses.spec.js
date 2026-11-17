// API INTEGRATION tests for POST /api/expenses: HTTP -> Express router -> real PostgreSQL.
// Same approach as circles.spec.js: a tiny Express app puts a user on the session
// (a stand-in for login) and mounts the REAL expenses router.
const chai = require('chai');
const chaiHttp = require('chai-http');
const express = require('express');
const crypto = require('node:crypto');
const pgp = require('pg-promise')();
const expensesRouter = require('../src/routes/expenses');

chai.use(chaiHttp);
const { expect } = chai;

// Safety check: only ever run against a throwaway database whose name ends in _test
const database = process.env.POSTGRES_DB;
if (!database || !database.endsWith('_test')) {
  throw new Error('Tests require POSTGRES_DB to end in _test. See .env.test.example');
}

const db = pgp({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  database,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

// userId = who is "logged in". Pass null to simulate a logged-out visitor.
function makeApp(userId) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (userId) {
      req.session = { user: { user_id: userId } };
    }
    next();
  });
  app.use(expensesRouter(db));
  return app;
}

// Root hook: close the database connection pool after all tests finish
after(() => {
  pgp.end();
});

describe('POST /api/expenses (integration)', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  let payer;     // in the circle
  let friend1;   // in the circle
  let friend2;   // in the circle
  let outsider;  // NOT in the circle
  let circle;

  async function createUser(label) {
    return db.one(
      `INSERT INTO users (display_name, email, password_hash)
       VALUES ($1, $2, 'not-a-real-hash')
       RETURNING user_id`,
      [`Test ${label}`, `expenses_${label}_${tag}@example.com`]
    );
  }

  // The Arrange step every test shares
  function validBody(overrides = {}) {
    return {
      circleId: circle.circle_id,
      name: 'Pizza and drinks',
      amount: '31.51',
      participantIds: [friend1.user_id, friend2.user_id],
      ...overrides,
    };
  }

  async function countExpenses() {
    const row = await db.one('SELECT COUNT(*)::int AS n FROM expenses WHERE circle_id = $1', [circle.circle_id]);
    return row.n;
  }

  before(async () => {
    payer = await createUser('payer');
    friend1 = await createUser('friend1');
    friend2 = await createUser('friend2');
    outsider = await createUser('outsider');
    circle = await db.one(
      `INSERT INTO circles (name, invite_code, created_by)
       VALUES ($1, $2, $3) RETURNING circle_id`,
      [`Expense Circle ${tag}`, `TST-${tag.toUpperCase()}`, payer.user_id]
    );
    for (const u of [payer, friend1, friend2]) {
      await db.none(
        `INSERT INTO circle_members (circle_id, user_id, role) VALUES ($1, $2, 'member')`,
        [circle.circle_id, u.user_id]
      );
    }
  });

  // Each test starts with no expenses in the circle
  afterEach(async () => {
    await db.none('DELETE FROM expenses WHERE circle_id = $1', [circle.circle_id]); // cascades to splits
  });

  // Delete ONLY what this file created (deleting the circle cascades to members and expenses)
  after(async () => {
    const ids = [payer.user_id, friend1.user_id, friend2.user_id, outsider.user_id];
    await db.none('DELETE FROM circles WHERE circle_id = $1', [circle.circle_id]);
    await db.none('DELETE FROM users WHERE user_id = ANY($1)', [ids]);
  });

  it('creates the expense and splits it, including the payer (positive case)', async () => {
    const res = await chai.request(makeApp(payer.user_id)).post('/api/expenses').send(validBody());

    expect(res).to.have.status(201);
    expect(res.body.expense.totalCents).to.equal(3151);

    // The database really holds it: 3151 cents across 3 people = 1051, 1050, 1050
    const expense = await db.one('SELECT * FROM expenses WHERE expense_id = $1', [res.body.expense.id]);
    expect(expense.paid_by).to.equal(payer.user_id);
    expect(expense.split_type).to.equal('equal');
    expect(expense.total_amount).to.equal('31.51');

    const splits = await db.any(
      'SELECT user_id, amount_owed FROM expense_splits WHERE expense_id = $1 ORDER BY user_id',
      [res.body.expense.id]
    );
    expect(splits).to.have.length(3);
    const owedCents = splits.map((s) => Math.round(Number(s.amount_owed) * 100));
    expect(owedCents.reduce((a, b) => a + b, 0)).to.equal(3151);
    expect(splits.map((s) => s.user_id)).to.include(payer.user_id);
  });

  it('records the logged-in user as the payer, not someone the client names', async () => {
    const res = await chai.request(makeApp(payer.user_id))
      .post('/api/expenses')
      .send(validBody({ paid_by: friend1.user_id, paidBy: friend1.user_id }));

    expect(res).to.have.status(201);
    const expense = await db.one('SELECT paid_by FROM expenses WHERE expense_id = $1', [res.body.expense.id]);
    expect(expense.paid_by).to.equal(payer.user_id);
  });

  it('does not double-count the payer if they list themselves', async () => {
    const res = await chai.request(makeApp(payer.user_id))
      .post('/api/expenses')
      .send(validBody({ amount: '30.00', participantIds: [payer.user_id, friend1.user_id] }));

    expect(res).to.have.status(201);
    expect(res.body.expense.splits).to.have.length(2);
  });

  it('rejects a participant who is not in the circle with 400 and saves nothing', async () => {
    const res = await chai.request(makeApp(payer.user_id))
      .post('/api/expenses')
      .send(validBody({ participantIds: [friend1.user_id, outsider.user_id] }));

    expect(res).to.have.status(400);
    expect(await countExpenses()).to.equal(0);
  });

  it('rejects a user who is not in the circle with 403', async () => {
    const res = await chai.request(makeApp(outsider.user_id))
      .post('/api/expenses')
      .send(validBody());

    expect(res).to.have.status(403);
    expect(await countExpenses()).to.equal(0);
  });

  it('rejects bad input with 400 (amount, name, participants, circle)', async () => {
    const bad = [
      { amount: 'abc' },
      { amount: '0' },
      { amount: '1.234' },
      { name: '   ' },
      { participantIds: [] },
      { participantIds: 'nope' },
      { circleId: 'not-a-number' },
      { expenseDate: '2026-13-45' },
    ];
    for (const override of bad) {
      const res = await chai.request(makeApp(payer.user_id)).post('/api/expenses').send(validBody(override));
      expect(res, JSON.stringify(override)).to.have.status(400);
    }
    expect(await countExpenses()).to.equal(0);
  });

  it('rejects a logged-out visitor with 401', async () => {
    const res = await chai.request(makeApp(null)).post('/api/expenses').send(validBody());

    expect(res).to.have.status(401);
    expect(await countExpenses()).to.equal(0);
  });
});