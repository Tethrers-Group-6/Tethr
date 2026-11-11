// Calendar router, mounted in index.js as:  app.use(require('./src/routes/events')(db));
// Tests can pass options to replace what the app normally supplies:
//   require('./src/routes/events')(db, { gcal, getUserId, viewsDir })
const express = require('express');
const path = require('path');
const {createStore} = require('../services/calendarStore');
const {fromEnv} = require('../services/gcal');
const {validateEvent, validateRange, validateRsvp} = require('../validateEvent');

// ---- middleware: validate, then hand clean input to the handler ----
function checkRange(req, res, next) {
  const r = validateRange(req.query);
  if (!r.valid) return res.status(400).json({error: r.error});
  req.range = r.value;
  next();
}

function checkEventBody(req, res, next) {
  const r = validateEvent(req.body);
  if (!r.valid) return res.status(400).json({error: r.errors[0], errors: r.errors});
  req.eventInput = r.value;
  next();
}

function checkRsvp(req, res, next) {
  const r = validateRsvp(req.params.id, req.body && req.body.status);
  if (!r.valid) return res.status(400).json({error: r.error});
  req.rsvpInput = r.value;
  next();
}

// Finds the logged-in user's id in the session. Handles the common shapes; if your login
// stores it somewhere else, change it here (it is the only place the calendar reads it).
function sessionUserId(req) {
  const s = req.session;
  if (!s) return null;
  const u = s.user || {};
  const id = Number(u.user_id || u.id || u.userId || s.user_id || s.userId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function createEventsRouter({db, gcal = null, getUserId, viewsDir} = {}) {
  if (!db) throw new Error('createEventsRouter: db is required');
  if (typeof getUserId !== 'function') throw new Error('createEventsRouter: getUserId is required');
  const data = createStore(db);
  const router = express.Router();

  const requireUser = (req, res, next) => {
    const id = getUserId(req);
    if (!id) return res.status(401).json({error: 'Please log in.'});
    req.userId = id;
    next();
  };
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  router.use('/api/events', express.json(), requireUser);

  router.get('/api/events/circles', wrap(async (req, res) => {
    res.json(await data.listCircles(req.userId));
  }));

  router.get('/api/events', checkRange, wrap(async (req, res) => {
    res.json(await data.listEvents(req.userId, req.range.from, req.range.to));
  }));

  router.post('/api/events', checkEventBody, wrap(async (req, res) => {
    const input = req.eventInput;
    if (!(await data.isMember(req.userId, input.circleId))) {
      return res.status(403).json({error: 'You are not a member of that group.'});
    }
    const {id} = await data.createEvent({...input, userId: req.userId});
    await data.setRsvp(req.userId, id, 'going'); // the creator is going by default
    let event = await data.getEvent(req.userId, id);

    // The event is already saved; a Google outage must not make creation fail.
    if (gcal) {
      try {
        const googleId = await gcal.createEvent(event);
        await data.setGoogleId(id, googleId);
        event = {...event, synced: true};
      } catch (err) {
        console.error('Google Calendar sync failed:', err.message);
      }
    }
    res.status(201).json(event);
  }));

  router.post('/api/events/:id/rsvp', checkRsvp, wrap(async (req, res) => {
    const {eventId, status} = req.rsvpInput;
    const row = await data.setRsvp(req.userId, eventId, status);
    if (!row) return res.status(404).json({error: 'Event not found.'});
    res.json(row);
  }));

  if (viewsDir) {
    router.get('/events', (req, res) => {
      if (!getUserId(req)) return res.redirect('/login');
      res.sendFile(path.join(viewsDir, 'events.html'));
    });
  }

  router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error(err);
    res.status(500).json({error: 'Something went wrong.'});
  });

  return router;
}

// What index.js calls: (db). Defaults: Google sync from the environment (off when not configured),
// the logged-in user from the session, and the views folder next to this one.
module.exports = (db, options = {}) => createEventsRouter({
  db,
  gcal: 'gcal' in options ? options.gcal : fromEnv(),
  getUserId: options.getUserId || sessionUserId,
  viewsDir: options.viewsDir || path.join(__dirname, '../views'),
});
module.exports.sessionUserId = sessionUserId;
module.exports.middleware = {checkRange, checkEventBody, checkRsvp};