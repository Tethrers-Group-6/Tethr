// API INTEGRATION tests for the Balances routes: HTTP -> Express router -> real PostgreSQL.
//
// Login is stubbed the same way as profile.spec.js and circles.spec.js: each test builds a
// tiny Express app that puts a user on the session and mounts the REAL balances router.
const chai = require('chai');
const chaiHttp = require('chai-http');
const express = require('express');
const crypto = require('node:crypto');
const pgp = require('pg-promise')();
const balancesRouter = require('../src/routes/balances');

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
  app.use(balancesRouter(db));
  return app;
}

after(() => {
  pgp.end();
});

describe('Balances API (integration)', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  let alice;     // paid for dinner in the circle
  let bob;       // owes Alice $20.00 for dinner
  let carol;     // in the circle, owes Alice $20.00 too
  let outsider;  // not in the circle
  let circle;

  async function createUser(label, venmo = null) {
    return db.one(
      `INSERT INTO users (display_name, email, password_hash, venmo_username)
       VALUES ($1, $2, 'not-a-real-hash', $3)
       RETURNING user_id`,
      [`Test ${label} ${tag}`, `balances_${label}_${tag}@example.com`, venmo]
    );
  }

  async function paymentsBetween(fromId, toId) {
    return db.any(
      'SELECT amount::text, status FROM payments WHERE circle_id = $1 AND from_user = $2 AND to_user = $3',
      [circle.circle_id, fromId, toId]
    );
  }

  // Arrange: Alice paid $60 for dinner, split three ways with Bob and Carol
  before(async () => {
    alice = await createUser('alice', '@alice-' + tag);
    bob = await createUser('bob');
    carol = await createUser('carol');
    outsider = await createUser('outsider');

    circle = await db.one(
      `INSERT INTO circles (name, invite_code, created_by)
       VALUES ($1, $2, $3)
       RETURNING circle_id`,
      [`Balances Circle ${tag}`, `BAL-${tag.toUpperCase()}`, alice.user_id]
    );
    await db.none(
      `INSERT INTO circle_members (circle_id, user_id, role)
       VALUES ($1, $2, 'admin'), ($1, $3, 'member'), ($1, $4, 'member')`,
      [circle.circle_id, alice.user_id, bob.user_id, carol.user_id]
    );

    const expense = await db.one(
      `INSERT INTO expenses (circle_id, paid_by, name, total_amount)
       VALUES ($1, $2, 'Dinner', 60.00)
       RETURNING expense_id`,
      [circle.circle_id, alice.user_id]
    );
    await db.none(
      `INSERT INTO expense_splits (expense_id, user_id, amount_owed)
       VALUES ($1, $2, 20.00), ($1, $3, 20.00), ($1, $4, 20.00)`,
      [expense.expense_id, alice.user_id, bob.user_id, carol.user_id]
    );
  });

  // Each test starts with no payments
  afterEach(async () => {
    await db.none('DELETE FROM payments WHERE circle_id = $1', [circle.circle_id]);
  });

  // Clean up: delete ONLY the rows this file created
  after(async () => {
    await db.none('DELETE FROM circles WHERE circle_id = $1', [circle.circle_id]); // cascades
    await db.none('DELETE FROM users WHERE user_id IN ($1:csv)', [[alice.user_id, bob.user_id, carol.user_id, outsider.user_id]]);
  });

  describe('GET /api/balances', () => {
    it('POSITIVE: shows Alice who owes her, per person and per circle', async () => {
      const res = await chai.request(makeApp(alice.user_id)).get('/api/balances');

      expect(res).to.have.status(200);
      expect(res.body.totals).to.deep.equal({ oweCents: 0, owedCents: 4000 });
      expect(res.body.people).to.have.length(2);
      const bobRow = res.body.people.find((p) => p.id === bob.user_id);
      expect(bobRow.netCents).to.equal(2000);
      expect(bobRow.circles).to.deep.equal([{ id: circle.circle_id, name: `Balances Circle ${tag}`, netCents: 2000 }]);
      expect(res.body.history.map((h) => h.title)).to.include('Dinner');
    });

    it('POSITIVE: shows Bob what he owes, with Alice\'s Venmo (no @)', async () => {
      const res = await chai.request(makeApp(bob.user_id)).get('/api/balances');

      expect(res).to.have.status(200);
      expect(res.body.totals).to.deep.equal({ oweCents: 2000, owedCents: 0 });
      expect(res.body.people).to.have.length(1);
      expect(res.body.people[0].id).to.equal(alice.user_id);
      expect(res.body.people[0].venmoUsername).to.equal('alice-' + tag);
    });

    it('shows an outsider nothing from the circle', async () => {
      const res = await chai.request(makeApp(outsider.user_id)).get('/api/balances');

      expect(res).to.have.status(200);
      expect(res.body.people).to.deep.equal([]);
      expect(res.body.history).to.deep.equal([]);
    });

    it('NEGATIVE: 401 when not logged in', async () => {
      const res = await chai.request(makeApp(null)).get('/api/balances');
      expect(res).to.have.status(401);
    });
  });

  describe('POST /api/payments (I paid someone)', () => {
    it('POSITIVE: records a pending payment that does not change balances yet', async () => {
      const res = await chai.request(makeApp(bob.user_id))
        .post('/api/payments')
        .send({ circle_id: circle.circle_id, user_id: alice.user_id, amount: '20.00' });

      expect(res).to.have.status(201);
      expect(res.body.payment.status).to.equal('pending');
      expect(await paymentsBetween(bob.user_id, alice.user_id)).to.deep.equal([{ amount: '20.00', status: 'pending' }]);

      const bal = await chai.request(makeApp(bob.user_id)).get('/api/balances');
      expect(bal.body.totals.oweCents).to.equal(2000);
      expect(bal.body.pending.outgoing).to.have.length(1);

      const aliceView = await chai.request(makeApp(alice.user_id)).get('/api/balances');
      expect(aliceView.body.pending.incoming[0].otherUserId).to.equal(bob.user_id);
    });

    it('NEGATIVE: 400 when paying more than owed, nothing saved', async () => {
      const res = await chai.request(makeApp(bob.user_id))
        .post('/api/payments')
        .send({ circle_id: circle.circle_id, user_id: alice.user_id, amount: '25' });

      expect(res).to.have.status(400);
      expect(await paymentsBetween(bob.user_id, alice.user_id)).to.deep.equal([]);
    });

    it('NEGATIVE: 409 when a pending payment already covers it', async () => {
      const app = makeApp(bob.user_id);
      await chai.request(app).post('/api/payments').send({ circle_id: circle.circle_id, user_id: alice.user_id, amount: '20' });
      const res = await chai.request(app).post('/api/payments').send({ circle_id: circle.circle_id, user_id: alice.user_id, amount: '1' });

      expect(res).to.have.status(409);
    });

    it('NEGATIVE: 409 when you do not owe them (Alice cannot "pay" Bob)', async () => {
      const res = await chai.request(makeApp(alice.user_id))
        .post('/api/payments')
        .send({ circle_id: circle.circle_id, user_id: bob.user_id, amount: '5' });

      expect(res).to.have.status(409);
    });

    it('NEGATIVE: 404 when the other person is not in the circle', async () => {
      const res = await chai.request(makeApp(bob.user_id))
        .post('/api/payments')
        .send({ circle_id: circle.circle_id, user_id: outsider.user_id, amount: '5' });

      expect(res).to.have.status(404);
    });

    it('NEGATIVE: 400 for bad input and paying yourself', async () => {
      const app = makeApp(bob.user_id);
      const bad = await chai.request(app).post('/api/payments').send({ circle_id: circle.circle_id, user_id: alice.user_id, amount: '-3' });
      const self = await chai.request(app).post('/api/payments').send({ circle_id: circle.circle_id, user_id: bob.user_id, amount: '3' });

      expect(bad).to.have.status(400);
      expect(self).to.have.status(400);
    });

    it('NEGATIVE: 401 when not logged in', async () => {
      const res = await chai.request(makeApp(null)).post('/api/payments').send({});
      expect(res).to.have.status(401);
    });
  });

  describe('POST /api/payments/received (someone paid me)', () => {
    it('POSITIVE: a partial payment counts right away', async () => {
      const res = await chai.request(makeApp(alice.user_id))
        .post('/api/payments/received')
        .send({ circle_id: circle.circle_id, user_id: carol.user_id, amount: '5.50' });

      expect(res).to.have.status(201);
      expect(await paymentsBetween(carol.user_id, alice.user_id)).to.deep.equal([{ amount: '5.50', status: 'confirmed' }]);

      const carolView = await chai.request(makeApp(carol.user_id)).get('/api/balances');
      expect(carolView.body.totals.oweCents).to.equal(1450);
      expect(carolView.body.history.map((h) => h.title)).to.include(`You paid Test alice ${tag}`);
    });

    it('NEGATIVE: Bob cannot claim Alice paid him', async () => {
      const res = await chai.request(makeApp(bob.user_id))
        .post('/api/payments/received')
        .send({ circle_id: circle.circle_id, user_id: alice.user_id, amount: '5' });

      expect(res).to.have.status(409);
      expect(await paymentsBetween(alice.user_id, bob.user_id)).to.deep.equal([]);
    });
  });

  describe('POST /api/payments/:id/confirm and DELETE /api/payments/:id', () => {
    async function bobPaysAlice() {
      const res = await chai.request(makeApp(bob.user_id))
        .post('/api/payments')
        .send({ circle_id: circle.circle_id, user_id: alice.user_id, amount: '20' });
      return res.body.payment.id;
    }

    it('POSITIVE: the receiver confirms, and Bob is settled up', async () => {
      const id = await bobPaysAlice();
      const res = await chai.request(makeApp(alice.user_id)).post(`/api/payments/${id}/confirm`);

      expect(res).to.have.status(200);
      const bobView = await chai.request(makeApp(bob.user_id)).get('/api/balances');
      expect(bobView.body.totals).to.deep.equal({ oweCents: 0, owedCents: 0 });
      expect(bobView.body.people).to.deep.equal([]);
      expect(bobView.body.pending.outgoing).to.deep.equal([]);
    });

    it('NEGATIVE: the sender cannot confirm their own payment', async () => {
      const id = await bobPaysAlice();
      const res = await chai.request(makeApp(bob.user_id)).post(`/api/payments/${id}/confirm`);

      expect(res).to.have.status(403);
      expect(await paymentsBetween(bob.user_id, alice.user_id)).to.deep.equal([{ amount: '20.00', status: 'pending' }]);
    });

    it('NEGATIVE: someone not in the payment gets 404', async () => {
      const id = await bobPaysAlice();
      const res = await chai.request(makeApp(carol.user_id)).post(`/api/payments/${id}/confirm`);

      expect(res).to.have.status(404);
    });

    it('NEGATIVE: confirming twice gives 409', async () => {
      const id = await bobPaysAlice();
      await chai.request(makeApp(alice.user_id)).post(`/api/payments/${id}/confirm`);
      const res = await chai.request(makeApp(alice.user_id)).post(`/api/payments/${id}/confirm`);

      expect(res).to.have.status(409);
    });

    it('POSITIVE: the receiver can decline a pending payment', async () => {
      const id = await bobPaysAlice();
      const res = await chai.request(makeApp(alice.user_id)).delete(`/api/payments/${id}`);

      expect(res).to.have.status(200);
      expect(res.body.message).to.equal('Payment declined');
      expect(await paymentsBetween(bob.user_id, alice.user_id)).to.deep.equal([]);
    });

    it('POSITIVE: the sender can cancel a pending payment', async () => {
      const id = await bobPaysAlice();
      const res = await chai.request(makeApp(bob.user_id)).delete(`/api/payments/${id}`);

      expect(res).to.have.status(200);
      expect(res.body.message).to.equal('Payment canceled');
    });

    it('NEGATIVE: confirmed payments cannot be removed', async () => {
      const id = await bobPaysAlice();
      await chai.request(makeApp(alice.user_id)).post(`/api/payments/${id}/confirm`);
      const res = await chai.request(makeApp(bob.user_id)).delete(`/api/payments/${id}`);

      expect(res).to.have.status(409);
    });

    it('NEGATIVE: 400 for a non-numeric id', async () => {
      const res = await chai.request(makeApp(alice.user_id)).post('/api/payments/abc/confirm');
      expect(res).to.have.status(400);
    });
  });
});
