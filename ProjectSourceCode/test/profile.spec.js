// API INTEGRATION tests for the Profile routes: HTTP -> Express router -> real PostgreSQL.
//
// Login is not needed. routes/profile.js only checks req.session.user.user_id, so each
// test builds a tiny Express app that puts a user on the session (a stand-in for login)
// and mounts the REAL profile router on it. Same approach as circles.spec.js.
const chai = require('chai');
const chaiHttp = require('chai-http');
const express = require('express');
const crypto = require('node:crypto');
const pgp = require('pg-promise')();
const profileRouter = require('../src/routes/profile');

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
  app.use(profileRouter(db));
  return app;
}

// Root hook: close this file's connection pool after all tests finish
after(() => {
  pgp.end();
});

describe('Profile API (integration)', () => {
  // Unique per run, so a run never collides with leftovers or with seed data
  const tag = crypto.randomUUID().slice(0, 8);
  const ORIGINAL_NAME = `Profile Tester ${tag}`;
  const ORIGINAL_VENMO = `tester-${tag}`;
  let user;
  let circle;

  async function readUser() {
    return db.one(
      'SELECT display_name, venmo_username FROM users WHERE user_id = $1',
      [user.user_id]
    );
  }

  // Arrange: one user who is in one circle (created once, removed in after())
  before(async () => {
    user = await db.one(
      `INSERT INTO users (display_name, email, password_hash, venmo_username)
       VALUES ($1, $2, 'not-a-real-hash', $3)
       RETURNING user_id`,
      [ORIGINAL_NAME, `profile_${tag}@example.com`, ORIGINAL_VENMO]
    );
    circle = await db.one(
      `INSERT INTO circles (name, invite_code, created_by)
       VALUES ($1, $2, $3)
       RETURNING circle_id`,
      [`Profile Circle ${tag}`, `PRF-${tag.toUpperCase()}`, user.user_id]
    );
    await db.none(
      `INSERT INTO circle_members (circle_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [circle.circle_id, user.user_id]
    );
  });

  // Put the user back the way before() made them, so tests stay independent
  afterEach(async () => {
    await db.none(
      'UPDATE users SET display_name = $2, venmo_username = $3 WHERE user_id = $1',
      [user.user_id, ORIGINAL_NAME, ORIGINAL_VENMO]
    );
  });

  // Clean up: delete ONLY the rows this file created (never truncate a table)
  after(async () => {
    await db.none('DELETE FROM circles WHERE created_by = $1', [user.user_id]); // cascades to members
    await db.none('DELETE FROM users WHERE user_id = $1', [user.user_id]);
  });

  describe('GET /api/profile', () => {
    it('POSITIVE: returns the logged-in user\'s profile with their circle count', async () => {
      const res = await chai.request(makeApp(user.user_id)).get('/api/profile');

      expect(res).to.have.status(200);
      expect(res).to.be.json;
      expect(res.body.profile.id).to.equal(user.user_id);
      expect(res.body.profile.displayName).to.equal(ORIGINAL_NAME);
      expect(res.body.profile.email).to.equal(`profile_${tag}@example.com`);
      expect(res.body.profile.venmoUsername).to.equal(ORIGINAL_VENMO);
      expect(res.body.profile.circleCount).to.equal(1);
      expect(res.body.profile.memberSince).to.be.a('string');
    });

    it('never sends the password hash to the browser', async () => {
      const res = await chai.request(makeApp(user.user_id)).get('/api/profile');

      expect(res).to.have.status(200);
      expect(res.body.profile).to.not.have.property('password_hash');
      expect(res.body.profile).to.not.have.property('passwordHash');
      expect(JSON.stringify(res.body)).to.not.include('not-a-real-hash');
    });

    it('NEGATIVE: rejects a logged-out visitor with 401', async () => {
      const res = await chai.request(makeApp(null)).get('/api/profile');

      expect(res).to.have.status(401);
      expect(res.body.error).to.equal('Not logged in');
    });

    it('NEGATIVE: returns 404 when the session points to an account that no longer exists', async () => {
      const res = await chai.request(makeApp(2147483647)).get('/api/profile');

      expect(res).to.have.status(404);
      expect(res.body.error).to.equal('Profile not found');
    });
  });

  describe('PUT /api/profile', () => {
    it('POSITIVE: updates the name and Venmo username and saves them to the database', async () => {
      const res = await chai.request(makeApp(user.user_id))
        .put('/api/profile')
        .send({ display_name: '  New Name  ', venmo_username: '@new-venmo' });

      expect(res).to.have.status(200);
      expect(res.body.message).to.equal('Profile updated');
      expect(res.body.profile.displayName).to.equal('New Name');
      expect(res.body.profile.venmoUsername).to.equal('new-venmo');

      const row = await readUser();
      expect(row.display_name).to.equal('New Name');
      expect(row.venmo_username).to.equal('new-venmo');
    });

    it('POSITIVE: a blank Venmo username removes it (stored as NULL)', async () => {
      const res = await chai.request(makeApp(user.user_id))
        .put('/api/profile')
        .send({ display_name: ORIGINAL_NAME, venmo_username: '' });

      expect(res).to.have.status(200);
      expect(res.body.profile.venmoUsername).to.equal(null);
      expect((await readUser()).venmo_username).to.equal(null);
    });

    it('NEGATIVE: a blank display name is rejected with 400 and nothing changes', async () => {
      const res = await chai.request(makeApp(user.user_id))
        .put('/api/profile')
        .send({ display_name: '   ', venmo_username: 'should-not-save' });

      expect(res).to.have.status(400);
      expect(res.body.error).to.equal('Display name is required');

      const row = await readUser();
      expect(row.display_name).to.equal(ORIGINAL_NAME);
      expect(row.venmo_username).to.equal(ORIGINAL_VENMO);
    });

    it('NEGATIVE: an invalid Venmo username is rejected with 400 and nothing changes', async () => {
      const res = await chai.request(makeApp(user.user_id))
        .put('/api/profile')
        .send({ display_name: 'Changed Name', venmo_username: 'has spaces' });

      expect(res).to.have.status(400);
      expect(res.body.error).to.match(/^Venmo username/);

      const row = await readUser();
      expect(row.display_name).to.equal(ORIGINAL_NAME);
      expect(row.venmo_username).to.equal(ORIGINAL_VENMO);
    });

    it('NEGATIVE: a logged-out visitor gets 401 and nothing changes', async () => {
      const res = await chai.request(makeApp(null))
        .put('/api/profile')
        .send({ display_name: 'Hacker', venmo_username: 'hacker-name' });

      expect(res).to.have.status(401);
      expect((await readUser()).display_name).to.equal(ORIGINAL_NAME);
    });
  });

  describe('GET /profile (page)', () => {
    it('redirects a logged-out visitor to /login', async () => {
      const res = await chai.request(makeApp(null)).get('/profile').redirects(0);

      expect(res).to.have.status(302);
      expect(res).to.have.header('location', '/login');
    });

    it('serves the profile page to a logged-in user', async () => {
      const res = await chai.request(makeApp(user.user_id)).get('/profile');

      expect(res).to.have.status(200);
      expect(res).to.be.html;
      expect(res.text).to.include('id="profile-form"');
    });
  });
});
