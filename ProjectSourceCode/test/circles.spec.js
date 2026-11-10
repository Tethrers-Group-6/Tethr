// API INTEGRATION tests for the Circles routes: HTTP -> Express router -> real PostgreSQL.
//
// Login is not needed. routes/circles.js only checks req.session.user.user_id, so each
// test builds a tiny Express app that puts a user on the session (a stand-in for login)
// and mounts the REAL circles router on it.
const chai = require('chai');
const chaiHttp = require('chai-http');
const express = require('express');
const crypto = require('node:crypto');
const pgp = require('pg-promise')();
const circlesRouter = require('../src/routes/circles');

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
  app.use(circlesRouter(db));
  return app;
}

// Root hook: close the database connection pool after all tests finish
after(() => {
  pgp.end();
});

describe('Circles API (integration)', () => {
  // Unique per run, so a run never collides with leftovers or with seed data
  const tag = crypto.randomUUID().slice(0, 8);
  const inviteCode = `TST-${tag.toUpperCase()}`;
  let owner;   // already in the circle, as its admin
  let joiner;  // not in the circle yet
  let circle;

  async function createUser(label) {
    return db.one(
      `INSERT INTO users (display_name, email, password_hash)
       VALUES ($1, $2, 'not-a-real-hash')
       RETURNING user_id`,
      [`Test ${label}`, `circles_${label}_${tag}@example.com`]
    );
  }

  async function countMembers(circleId, userId) {
    const row = await db.one(
      'SELECT COUNT(*)::int AS n FROM circle_members WHERE circle_id = $1 AND user_id = $2',
      [circleId, userId]
    );
    return row.n;
  }

  // Arrange: a fixture the tests share (created once, removed in after())
  before(async () => {
    owner = await createUser('owner');
    joiner = await createUser('joiner');
    circle = await db.one(
      `INSERT INTO circles (name, invite_code, created_by)
       VALUES ($1, $2, $3)
       RETURNING circle_id, name`,
      [`Test Circle ${tag}`, inviteCode, owner.user_id]
    );
    await db.none(
      `INSERT INTO circle_members (circle_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [circle.circle_id, owner.user_id]
    );
  });

  // Undo whatever a single test did, so tests stay independent of each other
  afterEach(async () => {
    await db.none('DELETE FROM circles WHERE created_by = $1', [joiner.user_id]);
    await db.none('DELETE FROM circle_members WHERE user_id = $1', [joiner.user_id]);
  });

  // Clean up: delete ONLY the rows this file created (never truncate a table)
  after(async () => {
    const ids = [owner.user_id, joiner.user_id];
    await db.none('DELETE FROM circles WHERE created_by = ANY($1)', [ids]); // cascades to members
    await db.none('DELETE FROM users WHERE user_id = ANY($1)', [ids]);
  });

  describe('GET /api/circles', () => {
    it('lists the circle for a member, with counts and role', async () => {
      const res = await chai.request(makeApp(owner.user_id)).get('/api/circles');

      expect(res).to.have.status(200);
      const mine = res.body.circles.find(c => c.id === circle.circle_id);
      expect(mine).to.not.equal(undefined);
      expect(mine.name).to.equal(circle.name);
      expect(mine.inviteCode).to.equal(inviteCode);
      expect(mine.role).to.equal('admin');
      expect(mine.memberCount).to.equal(1);
      expect(mine.expenseCount).to.equal(0);
    });

    it('does not list circles the user has not joined', async () => {
      const res = await chai.request(makeApp(joiner.user_id)).get('/api/circles');

      expect(res).to.have.status(200);
      expect(res.body.circles).to.deep.equal([]);
    });

    it('rejects a logged-out visitor with 401', async () => {
      const res = await chai.request(makeApp(null)).get('/api/circles');

      expect(res).to.have.status(401);
      expect(res.body.error).to.equal('Not logged in');
    });
  });

  describe('POST /api/circles/join', () => {
    it('POSITIVE: a valid code adds exactly one member row', async () => {
      const res = await chai.request(makeApp(joiner.user_id))
        .post('/api/circles/join')
        .send({ invite_code: inviteCode });

      expect(res).to.have.status(201);
      expect(res.body.message).to.equal('Joined circle');
      expect(res.body.circle.name).to.equal(circle.name);

      const rows = await db.any(
        'SELECT role FROM circle_members WHERE circle_id = $1 AND user_id = $2',
        [circle.circle_id, joiner.user_id]
      );
      expect(rows).to.have.lengthOf(1);
      expect(rows[0].role).to.equal('member');
    });

    it('accepts the code in lowercase (the lookup is case-insensitive)', async () => {
      const res = await chai.request(makeApp(joiner.user_id))
        .post('/api/circles/join')
        .send({ invite_code: inviteCode.toLowerCase() });

      expect(res).to.have.status(201);
      expect(await countMembers(circle.circle_id, joiner.user_id)).to.equal(1);
    });

    it('NEGATIVE: an unknown code is rejected with 404 and nothing is inserted', async () => {
      const res = await chai.request(makeApp(joiner.user_id))
        .post('/api/circles/join')
        .send({ invite_code: 'NOPE-000' });

      expect(res).to.have.status(404);
      expect(res.body.error).to.equal('Invalid invite code');

      const row = await db.one(
        'SELECT COUNT(*)::int AS n FROM circle_members WHERE user_id = $1',
        [joiner.user_id]
      );
      expect(row.n).to.equal(0);
    });

    it('NEGATIVE: a missing invite_code is rejected with 400', async () => {
      const res = await chai.request(makeApp(joiner.user_id))
        .post('/api/circles/join')
        .send({});

      expect(res).to.have.status(400);
      expect(res.body.error).to.equal('Invalid input');
      expect(await countMembers(circle.circle_id, joiner.user_id)).to.equal(0);
    });

    it('NEGATIVE: joining a circle you are already in returns 409 and adds no second row', async () => {
      const res = await chai.request(makeApp(owner.user_id))
        .post('/api/circles/join')
        .send({ invite_code: inviteCode });

      expect(res).to.have.status(409);
      expect(res.body.error).to.equal('You are already in this circle');
      expect(await countMembers(circle.circle_id, owner.user_id)).to.equal(1);
    });

    it('NEGATIVE: a logged-out visitor gets 401 and nothing is inserted', async () => {
      const res = await chai.request(makeApp(null))
        .post('/api/circles/join')
        .send({ invite_code: inviteCode });

      expect(res).to.have.status(401);
      const row = await db.one(
        'SELECT COUNT(*)::int AS n FROM circle_members WHERE circle_id = $1',
        [circle.circle_id]
      );
      expect(row.n).to.equal(1); // still just the owner
    });
  });

  describe('POST /api/circles (create)', () => {
    it('POSITIVE: creates the circle and makes the creator its admin', async () => {
      const res = await chai.request(makeApp(joiner.user_id))
        .post('/api/circles')
        .send({ name: `Created ${tag}` });

      expect(res).to.have.status(201);
      expect(res.body.circle.name).to.equal(`Created ${tag}`);
      expect(res.body.circle.inviteCode).to.match(/^TETH-[0-9A-F]{6}$/);

      const circles = await db.any(
        'SELECT circle_id, invite_code FROM circles WHERE created_by = $1',
        [joiner.user_id]
      );
      expect(circles).to.have.lengthOf(1);
      expect(circles[0].invite_code).to.equal(res.body.circle.inviteCode);

      const members = await db.any(
        'SELECT role FROM circle_members WHERE circle_id = $1 AND user_id = $2',
        [circles[0].circle_id, joiner.user_id]
      );
      expect(members).to.have.lengthOf(1);
      expect(members[0].role).to.equal('admin');
    });

    it('NEGATIVE: a blank name is rejected with 400 and no circle is created', async () => {
      const res = await chai.request(makeApp(joiner.user_id))
        .post('/api/circles')
        .send({ name: '   ' });

      expect(res).to.have.status(400);
      expect(res.body.error).to.equal('Invalid input');

      const row = await db.one(
        'SELECT COUNT(*)::int AS n FROM circles WHERE created_by = $1',
        [joiner.user_id]
      );
      expect(row.n).to.equal(0);
    });
  });
});
