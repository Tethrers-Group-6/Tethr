// Pure validation for the calendar API. No HTTP, no database: unit-testable,
// and the same functions are used by the routes in src/routes/events.js.
const STATUSES = ['going', 'maybe', 'no'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRealDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Accepts 7 or "7"; rejects true, [7], "7abc", 0, -1 and 1.5.
function toId(v) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 ? n : NaN;
}

function validateEvent(input) {
  const b = input || {};
  const errors = [];
  const circleId = toId(b.circleId);
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  const location = typeof b.location === 'string' ? b.location.trim() : '';
  const startOk = TIME_RE.test(b.startTime || '');
  const endOk = TIME_RE.test(b.endTime || '');

  if (Number.isNaN(circleId)) errors.push('Choose a group.');
  if (!title || title.length > 150) errors.push('Event name is required (150 characters max).');
  if (!isRealDate(b.date)) errors.push('Enter a valid date.');
  if (!startOk) errors.push('Enter a valid start time.');
  if (!endOk) errors.push('Enter a valid end time.');
  if (startOk && endOk && b.endTime <= b.startTime) errors.push('End time must be after start time.');
  if (location.length > 200) errors.push('Location is too long (200 characters max).');

  if (errors.length) return {valid: false, errors, value: null};
  return {
    valid: true,
    errors: [],
    value: {circleId, title, date: b.date, startTime: b.startTime, endTime: b.endTime, location: location || null},
  };
}

function validateRange(query) {
  const {from, to} = query || {};
  if (!isRealDate(from) || !isRealDate(to) || to < from) {
    return {valid: false, error: 'from and to must be valid dates (YYYY-MM-DD), with to on or after from.'};
  }
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 62) {
    return {valid: false, error: 'Date range is too large.'};
  }
  return {valid: true, value: {from, to}};
}

function validateRsvp(id, status) {
  const eventId = toId(id);
  if (Number.isNaN(eventId)) return {valid: false, error: 'Invalid event id.'};
  if (!STATUSES.includes(status)) return {valid: false, error: 'Status must be going, maybe, or no.'};
  return {valid: true, value: {eventId, status}};
}

module.exports = {validateEvent, validateRange, validateRsvp, isRealDate, toId, STATUSES};