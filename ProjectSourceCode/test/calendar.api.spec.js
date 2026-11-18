const chai = require('chai');
const chaiHttp = require('chai-http');
const express = require('express');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const mainApp = require('../index');
const createEventsRouter = require('../src/routes/events');

chai.use(chaiHttp);
const {expect} = chai;

const {db} = mainApp; // the same database connection index.js uses
// Checks the database the app is actually connected to, not just an environment variable.
const assertTestDatabase = () => {
  if (!/_test$/.test(db.$cn.database || '')) {
    throw new Error('Refusing to run database tests against a non-test database');
  }
};

// Mounts only the calendar router on a small app, so Google and the signed-in user can be replaced.
// Real PostgreSQL (the _test database, via index.js); Google is a fake because it is an external API.
function appWith(gcal) {
  const app = express();
  app.use(createEventsRouter(db, {
    gcal, // null = Google not configured
    getUserId: (req) => Number(req.get('x-test-user')) || null,
    viewsDir: path.join(__dirname, '../src/views'),
  }));
  return app;
}

describe('Calendar API integration (Express + PostgreSQL)', () => {
  const run = randomUUID().slice(0, 8); // unique per run, so reruns never collide
  const created = {users: [], circles: []};
  let seq = 0;
  let alice; let bob; let outsider; let friends; let secret;

  const as = (req, userId) => req.set('x-test-user', String(userId));
  const newEvent = (over = {}) => ({
    circleId: friends, title: `Dinner ${run} ${++seq}`, date: '2031-03-14',
    startTime: '19:00', endTime: '20:30', location: 'Sushi Zanmai', ...over,
  });
  const fakeGcal = () => {
    const calls = [];
    return {calls, createEvent: async (e) => { calls.push(e); return `lab10-${run}-${++seq}`; }};
  };

  async function addUser(name) {
    const row = await db.one(
      'INSERT INTO users (display_name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
      [name, `lab10_cal_${name}_${run}@colorado.edu`, 'not-a-real-hash']);
    created.users.push(row.user_id);
    return row.user_id;
  }
  async function addCircle(name, creator, members) {
    const row = await db.one(
      'INSERT INTO circles (name, invite_code, created_by) VALUES ($1, $2, $3) RETURNING circle_id',
      [name, `L10-${run}-${++seq}`, creator]);
    created.circles.push(row.circle_id);
    await db.none("INSERT INTO circle_members (circle_id, user_id, role) VALUES ($1, $2, 'admin')", [row.circle_id, creator]);
    for (const m of members) {
      await db.none("INSERT INTO circle_members (circle_id, user_id, role) VALUES ($1, $2, 'member')", [row.circle_id, m]);
    }
    return row.circle_id;
  }
  const insertEvent = (circleId, creator, title, starts, ends) => db.one(
    'INSERT INTO events (circle_id, created_by, title, starts_at, ends_at) VALUES ($1, $2, $3, $4, $5) RETURNING event_id',
    [circleId, creator, title, starts, ends]).then((r) => r.event_id);
  const countEvents = (circleId) =>
    db.one('SELECT COUNT(*)::int AS n FROM events WHERE circle_id = $1', [circleId]).then((r) => r.n);
  const rsvpRows = (eventId, userId) =>
    db.any('SELECT status FROM event_rsvps WHERE event_id = $1 AND user_id = $2', [eventId, userId]);

  before(async () => {
    assertTestDatabase();
    alice = await addUser('alice');
    bob = await addUser('bob');
    outsider = await addUser('outsider');
    friends = await addCircle(`Friends ${run}`, alice, [bob]);
    secret = await addCircle(`Secret ${run}`, outsider, []);
  });

  // Targeted cleanup: only rows this run created. Deleting circles cascades to
  // memberships, events, RSVPs and expenses; users go last.
  after(async () => {
    await db.none('DELETE FROM circles WHERE circle_id = ANY($1)', [created.circles]);
    await db.none('DELETE FROM users WHERE user_id = ANY($1)', [created.users]);
  });

  describe('authentication', () => {
    it('rejects an anonymous request and creates nothing', async () => {
      const before = await countEvents(friends);
      const res = await chai.request(appWith(null)).post('/api/events').send(newEvent());
      expect(res).to.have.status(401);
      expect(await countEvents(friends)).to.equal(before);
    });
  });

  describe('GET /api/events/circles', () => {
    it('returns only the caller\u2019s groups', async () => {
      const a = await as(chai.request(appWith(null)).get('/api/events/circles'), alice);
      expect(a).to.have.status(200);
      expect(a.body).to.deep.equal([{id: friends, name: `Friends ${run}`}]);
      const o = await as(chai.request(appWith(null)).get('/api/events/circles'), outsider);
      expect(o.body).to.deep.equal([{id: secret, name: `Secret ${run}`}]);
    });
  });

  describe('POST /api/events', () => {
    it('creates one event, RSVPs the creator and syncs it to Google', async () => {
      const gcal = fakeGcal();
      const body = newEvent();
      const res = await as(chai.request(appWith(gcal)).post('/api/events'), alice).send(body);

      expect(res).to.have.status(201);
      expect(res.body).to.include({
        title: body.title, circle: `Friends ${run}`, date: '2031-03-14',
        startTime: '19:00', endTime: '20:30', synced: true, myStatus: 'going',
      });
      expect(res.body.rsvp).to.deep.equal({going: 1, maybe: 0, no: 0});

      const rows = await db.any(
        `SELECT circle_id, created_by, location, google_calendar_id,
                to_char(starts_at, 'YYYY-MM-DD HH24:MI') AS starts, to_char(ends_at, 'YYYY-MM-DD HH24:MI') AS ends
         FROM events WHERE title = $1`, [body.title]);
      expect(rows).to.have.lengthOf(1);
      expect(rows[0]).to.include({
        circle_id: friends, created_by: alice, location: 'Sushi Zanmai',
        starts: '2031-03-14 19:00', ends: '2031-03-14 20:30',
      });
      expect(rows[0].google_calendar_id).to.match(new RegExp(`^lab10-${run}-`));
      expect((await rsvpRows(res.body.id, alice))).to.deep.equal([{status: 'going'}]);
      expect(gcal.calls).to.have.lengthOf(1);
      expect(gcal.calls[0]).to.include({id: res.body.id, title: body.title, circle: `Friends ${run}`});
    });

    it('rejects invalid input with 400 and saves nothing', async () => {
      const gcal = fakeGcal();
      const before = await countEvents(friends);
      const bad = [
        newEvent({title: '   '}), newEvent({circleId: 'abc'}), newEvent({date: '2031-02-30'}),
        newEvent({startTime: '20:00', endTime: '19:00'}), newEvent({endTime: '25:00'}),
      ];
      for (const body of bad) {
        const res = await as(chai.request(appWith(gcal)).post('/api/events'), alice).send(body);
        expect(res, JSON.stringify(body)).to.have.status(400);
        expect(res.body.error).to.be.a('string');
      }
      expect(await countEvents(friends)).to.equal(before);
      expect(gcal.calls).to.have.lengthOf(0);
    });

    it('returns 403 for a group the user is not in and saves nothing', async () => {
      const gcal = fakeGcal();
      const res = await as(chai.request(appWith(gcal)).post('/api/events'), alice)
        .send(newEvent({circleId: secret}));
      expect(res).to.have.status(403);
      expect(await countEvents(secret)).to.equal(0);
      expect(gcal.calls).to.have.lengthOf(0);
    });

    it('still saves the event, unsynced, when Google fails', async () => {
      const quiet = console.error;
      console.error = () => {};
      try {
        const gcal = {createEvent: async () => { throw new Error('quota exceeded'); }};
        const body = newEvent();
        const res = await as(chai.request(appWith(gcal)).post('/api/events'), alice).send(body);
        expect(res).to.have.status(201);
        expect(res.body.synced).to.equal(false);
        const row = await db.one('SELECT google_calendar_id FROM events WHERE title = $1', [body.title]);
        expect(row.google_calendar_id).to.equal(null);
      } finally {
        console.error = quiet;
      }
    });

    it('works when Google is not configured', async () => {
      const body = newEvent();
      const res = await as(chai.request(appWith(null)).post('/api/events'), alice).send(body);
      expect(res).to.have.status(201);
      expect(res.body.synced).to.equal(false);
    });
  });

  describe('GET /api/events', () => {
    let brunch;
    before(async () => {
      brunch = await insertEvent(friends, alice, `Brunch ${run}`, '2031-04-05 10:00', '2031-04-05 11:00');
      await insertEvent(friends, alice, `Game night ${run}`, '2031-04-02 20:00', '2031-04-02 22:00');
      await insertEvent(secret, outsider, `Hidden ${run}`, '2031-04-03 12:00', '2031-04-03 13:00');
      await db.none("INSERT INTO event_rsvps (event_id, user_id, status) VALUES ($1, $2, 'going'), ($1, $3, 'no')", [brunch, alice, bob]);
      await db.none(
        "INSERT INTO expenses (circle_id, paid_by, event_id, name, total_amount) VALUES ($1, $2, $3, 'Brunch', 42.50)",
        [friends, alice, brunch]);
    });

    const list = (userId, from, to) =>
      as(chai.request(appWith(null)).get(`/api/events?from=${from}&to=${to}`), userId);

    it('returns the group\u2019s events in date order with RSVPs, the caller\u2019s status and expenses', async () => {
      const res = await list(bob, '2031-04-01', '2031-04-30');
      expect(res).to.have.status(200);
      expect(res.body.map((e) => e.title)).to.deep.equal([`Game night ${run}`, `Brunch ${run}`]);
      const b = res.body[1];
      expect(b.rsvp).to.deep.equal({going: 1, maybe: 0, no: 1});
      expect(b.myStatus).to.equal('no');
      expect(b.expenses).to.deep.equal([{name: 'Brunch', amount: 42.5}]);
      expect(b).to.include({date: '2031-04-05', startTime: '10:00', endTime: '11:00', circle: `Friends ${run}`});
    });

    it('never shows events from groups the caller is not in', async () => {
      const mine = await list(alice, '2031-04-01', '2031-04-30');
      expect(mine.body.map((e) => e.title)).to.not.include(`Hidden ${run}`);
      const theirs = await list(outsider, '2031-04-01', '2031-04-30');
      expect(theirs.body.map((e) => e.title)).to.deep.equal([`Hidden ${run}`]);
    });

    it('returns an empty list outside the requested range', async () => {
      const res = await list(alice, '2031-05-01', '2031-05-31');
      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal([]);
    });

    it('rejects a bad range with 400', async () => {
      const res = await list(alice, '2031-04-30', '2031-04-01');
      expect(res).to.have.status(400);
    });
  });

  describe('POST /api/events/:id/rsvp', () => {
    let eventId;
    before(async () => {
      eventId = await insertEvent(friends, alice, `Ski trip ${run}`, '2031-06-07 08:00', '2031-06-07 18:00');
    });
    const rsvp = (userId, id, status) =>
      as(chai.request(appWith(null)).post(`/api/events/${id}/rsvp`), userId).send({status});

    it('saves a status and updates it in place (one row per person)', async () => {
      const first = await rsvp(bob, eventId, 'maybe');
      expect(first).to.have.status(200);
      expect(await rsvpRows(eventId, bob)).to.deep.equal([{status: 'maybe'}]);

      const second = await rsvp(bob, eventId, 'no');
      expect(second).to.have.status(200);
      expect(await rsvpRows(eventId, bob)).to.deep.equal([{status: 'no'}]);
    });

    it('returns 404 for a non-member and saves nothing', async () => {
      const res = await rsvp(outsider, eventId, 'going');
      expect(res).to.have.status(404);
      expect(await rsvpRows(eventId, outsider)).to.have.lengthOf(0);
    });

    it('returns 400 for an unknown status or a bad id and saves nothing', async () => {
      expect(await rsvp(alice, eventId, 'yes')).to.have.status(400);
      expect(await rsvp(alice, 'abc', 'going')).to.have.status(400);
      expect(await rsvpRows(eventId, alice)).to.have.lengthOf(0);
    });
  });

  describe('GET /events page', () => {
    it('redirects a signed-out visitor to /login', async () => {
      const res = await chai.request(appWith(null)).get('/events').redirects(0);
      expect(res).to.have.status(302);
      expect(res).to.have.header('location', '/login');
    });

    it('renders the calendar page for a signed-in user', async () => {
      const res = await as(chai.request(appWith(null)).get('/events'), alice);
      expect(res).to.have.status(200);
      expect(res).to.be.html;
      expect(res.text).to.include('id="event-form"');
    });
  });
});