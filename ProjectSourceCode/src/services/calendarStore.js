// All SQL for the calendar. `db` is a pg-promise style object (any/one/oneOrNone/none),
// so tests can pass a fake

const EVENT_SELECT = `
  SELECT e.event_id AS id, e.circle_id AS "circleId", c.name AS circle, e.title, e.location,
         to_char(e.starts_at, 'YYYY-MM-DD') AS date,
         to_char(e.starts_at, 'HH24:MI') AS "startTime",
         to_char(e.ends_at, 'HH24:MI') AS "endTime",
         (e.google_event_id IS NOT NULL) AS synced,
         json_build_object(
           'going', COUNT(r.user_id) FILTER (WHERE r.status = 'going'),
           'maybe', COUNT(r.user_id) FILTER (WHERE r.status = 'maybe'),
           'no',    COUNT(r.user_id) FILTER (WHERE r.status = 'no')
         ) AS rsvp,
         MAX(r.status) FILTER (WHERE r.user_id = $1) AS "myStatus",
         COALESCE((SELECT json_agg(json_build_object('name', x.name, 'amount', x.total_amount)
                                   ORDER BY x.expense_id)
                   FROM expenses x WHERE x.event_id = e.event_id), '[]') AS expenses
  FROM events e
  JOIN circles c ON c.circle_id = e.circle_id
  JOIN circle_members m ON m.circle_id = e.circle_id AND m.user_id = $1
  LEFT JOIN event_rsvps r ON r.event_id = e.event_id`;
const EVENT_GROUP = ' GROUP BY e.event_id, c.name ORDER BY e.starts_at';

function createStore(db) {
  return {
    listCircles(userId) {
      return db.any(
        `SELECT c.circle_id AS id, c.name
         FROM circles c JOIN circle_members m ON m.circle_id = c.circle_id
         WHERE m.user_id = $1 ORDER BY c.name`, [userId]);
    },

    async isMember(userId, circleId) {
      const row = await db.oneOrNone(
        'SELECT 1 AS ok FROM circle_members WHERE user_id = $1 AND circle_id = $2', [userId, circleId]);
      return !!row;
    },

    // Only events in circles the user belongs to; from/to are inclusive dates.
    listEvents(userId, from, to) {
      return db.any(
        `${EVENT_SELECT} WHERE e.starts_at >= $2::date AND e.starts_at < $3::date + 1${EVENT_GROUP}`,
        [userId, from, to]);
    },

    getEvent(userId, eventId) {
      return db.oneOrNone(`${EVENT_SELECT} WHERE e.event_id = $2::int${EVENT_GROUP}`, [userId, eventId]);
    },

    createEvent({ circleId, userId, title, location, date, startTime, endTime }) {
      return db.one(
        `INSERT INTO events (circle_id, created_by, title, location, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5::timestamp, $6::timestamp) RETURNING event_id AS id`,
        [circleId, userId, title, location, `${date} ${startTime}`, `${date} ${endTime}`]);
    },

    setGoogleId(eventId, googleEventId) {
      return db.none('UPDATE events SET google_event_id = $2 WHERE event_id = $1', [eventId, googleEventId]);
    },

    // Returns null unless the user belongs to the event's circle.
    setRsvp(userId, eventId, status) {
      return db.oneOrNone(
        `INSERT INTO event_rsvps (event_id, user_id, status)
         SELECT e.event_id, $1::int, $3::varchar
         FROM events e
         JOIN circle_members m ON m.circle_id = e.circle_id AND m.user_id = $1::int
         WHERE e.event_id = $2::int
         ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status
         RETURNING status`, [userId, eventId, status]);
    },
  };
}

module.exports = { createStore };