// API INTEGRATION tests for GET /api/circles/:id (details + members + expense feed).
const chai = require('chai');
const chaiHttp = require('chai-http');
const express = require('express');
const crypto = require('node:crypto');
const pgp = require('pg-promise')();
const circleDetailRouter = require('../src/routes/circleDetail');

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
  app.use(circleDetailRouter(db));
  return app;
}

after(() => {
  pgp.end();
});

describe('GET /api/circles/:id (integration)', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  let alice;     // in the circle, paid the expense, is in the split
  let bob;       // in the circle, is in the split
  let carol;     // in the circle, NOT in the split
  let outsider;  // not in the circle
  let circle;

  async function createUser(label) {
    return db.one(
      `INSERT INTO users (display_name, email, password_hash)
       VALUES ($1, $2, 'not-a-real-hash')
       RETURNING user_id`,
      [`Test ${label}`, `detail_${label}_${tag}@example.com`]
    );
  }

  before(async () => {
    alice = await createUser('alice');
    bob = await createUser('bob');
    carol = await createUser('carol');
    outsider = await createUser('outsider');
    circle = await db.one(
      `INSERT INTO circles (name, invite_code, created_by)
       VALUES ($1, $2, $3) RETURNING circle_id, name`,
      [`Detail Circle ${tag}`, `TST-${tag.toUpperCase()}`, alice.user_id]
    );
    await db.none(
      `INSERT INTO circle_members (circle_id, user_id, role) VALUES
         ($1, $2, 'admin'), ($1, $3, 'member'), ($1, $4, 'member')`,
      [circle.circle_id, alice.user_id, bob.user_id, carol.user_id]
    );
    const expense = await db.one(
      `INSERT INTO expenses (circle_id, paid_by, name, total_amount, split_type)
       VALUES ($1, $2, 'Test dinner', 40.00, 'equal') RETURNING expense_id`,
      [circle.circle_id, alice.user_id]
    );
    await db.none(
      `INSERT INTO expense_splits (expense_id, user_id, amount_owed) VALUES ($1, $2, 20.00), ($1, $3, 20.00)`,
      [expense.expense_id, alice.user_id, bob.user_id]
    );
  });

  // Delete ONLY what this file created (deleting the circle cascades to members and expenses)
  after(async () => {
    await db.none('DELETE FROM circles WHERE circle_id = $1', [circle.circle_id]);
    await db.none('DELETE FROM users WHERE user_id = ANY($1)', [
      [alice.user_id, bob.user_id, carol.user_id, outsider.user_id],
    ]);
  });

  it('returns the circle, its members, and its expenses for a member (positive case)', async () => {
    const res = await chai.request(makeApp(bob.user_id)).get(`/api/circles/${circle.circle_id}`);

    expect(res).to.have.status(200);
    expect(res.body.circle.name).to.equal(circle.name);
    expect(res.body.circle.role).to.equal('member');
    expect(res.body.me.id).to.equal(bob.user_id);
    expect(res.body.members.map((m) => m.id)).to.have.members([alice.user_id, bob.user_id, carol.user_id]);

    expect(res.body.expenses).to.have.length(1);
    const expense = res.body.expenses[0];
    expect(expense.name).to.equal('Test dinner');
    expect(expense.totalCents).to.equal(4000);
    expect(expense.paidBy).to.equal(alice.user_id);
    expect(expense.yourShareCents).to.equal(2000);
  });

  it('reports your share as null when you were not part of the expense', async () => {
    const res = await chai.request(makeApp(carol.user_id)).get(`/api/circles/${circle.circle_id}`);

    expect(res).to.have.status(200);
    expect(res.body.expenses[0].yourShareCents).to.equal(null);
  });

  it('returns 404 to a user who is not in the circle', async () => {
    const res = await chai.request(makeApp(outsider.user_id)).get(`/api/circles/${circle.circle_id}`);

    expect(res).to.have.status(404);
    expect(res.body).to.not.have.property('members');
  });

  it('returns 404 for a circle that does not exist', async () => {
    const res = await chai.request(makeApp(alice.user_id)).get('/api/circles/999999999');

    expect(res).to.have.status(404);
  });

  it('returns 400 for an id that is not a number', async () => {
    const res = await chai.request(makeApp(alice.user_id)).get('/api/circles/abc');

    expect(res).to.have.status(400);
  });

  it('rejects a logged-out visitor with 401', async () => {
    const res = await chai.request(makeApp(null)).get(`/api/circles/${circle.circle_id}`);

    expect(res).to.have.status(401);
  });

  describe('the page GET /circles/:id', () => {
    it('serves the HTML page to a logged-in user', async () => {
      const res = await chai.request(makeApp(bob.user_id)).get(`/circles/${circle.circle_id}`);

      expect(res).to.have.status(200);
      expect(res).to.be.html;
    });

    it('redirects a logged-out visitor to /login', async () => {
      const res = await chai.request(makeApp(null)).get(`/circles/${circle.circle_id}`).redirects(0);

      expect(res).to.have.status(302);
      expect(res).to.redirectTo(/\/login$/);
    });
  });


});