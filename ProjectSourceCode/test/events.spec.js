const {expect} = require('chai');
const {randomUUID} = require('node:crypto');
const {db, assertTestDatabase} = require('./helpers/testDb');
const {createStore} = require('../src/services/calendarStore');

// Rules PostgreSQL itself enforces for events (src/init_data/create.sql). These hold even if a route
// or validator is bypassed or has a bug, so bad data cannot get in.
describe('Events: database rules (PostgreSQL)', () => {
  const run = randomUUID().slice(0, 8); // unique per run, so reruns never collide
  const created = {users: [], circles: []};
  let seq = 0;
  let user; let circle;

  const title = () => `Rules ${run} ${++seq}`;
  const insertEvent = (t, starts, ends, googleId = null, circleId = circle) => db.one(
    `INSERT INTO events (circle_id, created_by, title, starts_at, ends_at, google_event_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING event_id`,
    [circleId, user, t, starts, ends, googleId]).then((r) => r.event_id);
  const insertExpense = (circleId, eventId) => db.one(
    `INSERT INTO expenses (circle_id, paid_by, event_id, name, total_amount)
     VALUES ($1, $2, $3, 'Snacks', 12.50) RETURNING expense_id`, [circleId, user, eventId]).then((r) => r.expense_id);
  const n = (sql, params) => db.one(`SELECT COUNT(*)::int AS n ${sql}`, params).then((r) => r.n);
  const rejects = async (promise) => {
    try { await promise; } catch (err) { return err; }
    throw new Error('Expected the database to reject this');
  };
  async function addCircle() {
    const row = await db.one(
      'INSERT INTO circles (name, invite_code, created_by) VALUES ($1, $2, $3) RETURNING circle_id',
      [`Rules ${run}`, `R-${run}-${++seq}`, user]);
    created.circles.push(row.circle_id);
    await db.none("INSERT INTO circle_members (circle_id, user_id, role) VALUES ($1, $2, 'admin')", [row.circle_id, user]);
    return row.circle_id;
  }

  before(async () => {
    assertTestDatabase();
    user = (await db.one(
      'INSERT INTO users (display_name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
      ['rules', `lab10_rules_${run}@colorado.edu`, 'not-a-real-hash'])).user_id;
    created.users.push(user);
    circle = await addCircle();
  });

  // Targeted cleanup: only rows this run created (circles cascade to events, RSVPs, expenses).
  after(async () => {
    await db.none('DELETE FROM circles WHERE circle_id = ANY($1)', [created.circles]);
    await db.none('DELETE FROM users WHERE user_id = ANY($1)', [created.users]);
  });

  it('rejects an event that ends before, or exactly when, it starts', async () => {
    const t = title();
    const before = await rejects(insertEvent(t, '2031-07-01 20:00', '2031-07-01 19:00'));
    expect(before.code).to.equal('23514');
    expect(before.constraint).to.equal('chk_events_end_after_start');
    const equal = await rejects(insertEvent(t, '2031-07-01 20:00', '2031-07-01 20:00'));
    expect(equal.constraint).to.equal('chk_events_end_after_start');
    expect(await n('FROM events WHERE title = $1', [t])).to.equal(0);
  });

  it('accepts an event with no end time, and the store reports its end as null', async () => {
    const id = await insertEvent(title(), '2031-07-02 10:00', null);
    const event = await createStore(db).getEvent(user, id);
    expect(event).to.include({date: '2031-07-02', startTime: '10:00', synced: false});
    expect(event.endTime).to.equal(null);
  });

  it('keeps Google ids unique but allows any number of unsynced events', async () => {
    const gid = `lab10-${run}-dup`;
    await insertEvent(title(), '2031-07-03 10:00', '2031-07-03 11:00', gid);
    const dup = await rejects(insertEvent(title(), '2031-07-03 12:00', '2031-07-03 13:00', gid));
    expect(dup.code).to.equal('23505');
    await insertEvent(title(), '2031-07-03 14:00', '2031-07-03 15:00', null);
    await insertEvent(title(), '2031-07-03 16:00', '2031-07-03 17:00', null);
  });

  it('allows only going, maybe or no, and one RSVP per person per event', async () => {
    const id = await insertEvent(title(), '2031-07-04 10:00', '2031-07-04 11:00');
    const bad = await rejects(db.none("INSERT INTO event_rsvps (event_id, user_id, status) VALUES ($1, $2, 'yes')", [id, user]));
    expect(bad.code).to.equal('23514');
    await db.none("INSERT INTO event_rsvps (event_id, user_id, status) VALUES ($1, $2, 'going')", [id, user]);
    const twice = await rejects(db.none("INSERT INTO event_rsvps (event_id, user_id, status) VALUES ($1, $2, 'maybe')", [id, user]));
    expect(twice.code).to.equal('23505');
    expect(await n('FROM event_rsvps WHERE event_id = $1', [id])).to.equal(1);
  });

  it('deletes an event\u2019s RSVPs with the event', async () => {
    const id = await insertEvent(title(), '2031-07-05 10:00', '2031-07-05 11:00');
    await db.none("INSERT INTO event_rsvps (event_id, user_id, status) VALUES ($1, $2, 'going')", [id, user]);
    await db.none('DELETE FROM events WHERE event_id = $1', [id]);
    expect(await n('FROM event_rsvps WHERE event_id = $1', [id])).to.equal(0);
  });

  it('keeps expenses when their event is deleted, and clears the link', async () => {
    const id = await insertEvent(title(), '2031-07-06 10:00', '2031-07-06 11:00');
    const expenseId = await insertExpense(circle, id);
    await db.none('DELETE FROM events WHERE event_id = $1', [id]);
    const row = await db.one('SELECT event_id FROM expenses WHERE expense_id = $1', [expenseId]);
    expect(row.event_id).to.equal(null);
  });

  it('deletes a group\u2019s events, RSVPs and expenses when the group is deleted', async () => {
    const doomed = await addCircle();
    const id = await insertEvent(title(), '2031-07-07 10:00', '2031-07-07 11:00', null, doomed);
    await db.none("INSERT INTO event_rsvps (event_id, user_id, status) VALUES ($1, $2, 'going')", [id, user]);
    const expenseId = await insertExpense(doomed, id);

    await db.none('DELETE FROM circles WHERE circle_id = $1', [doomed]);

    expect(await n('FROM events WHERE circle_id = $1', [doomed])).to.equal(0);
    expect(await n('FROM event_rsvps WHERE event_id = $1', [id])).to.equal(0);
    expect(await n('FROM expenses WHERE expense_id = $1', [expenseId])).to.equal(0);
    expect(await n('FROM circle_members WHERE circle_id = $1', [doomed])).to.equal(0);
  });
});