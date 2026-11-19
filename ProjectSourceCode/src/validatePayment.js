// Pure function: no HTTP, no database. That is what makes it unit-testable.
//
// Checks the body of a "record a payment" request from the Balances page.
//   circle_id  required, positive whole number
//   user_id    required, positive whole number (the OTHER person in the payment)
//   amount     required, dollars like "12.50" or 12.5, more than 0, at most 2 decimals
//
// Whether the circle exists, whether both people are in it, and whether the amount
// is more than what is owed all need the database, so the route checks those.
//
// Returns { valid: true,  error: null, cleaned: { circleId, userId, cents } }
//      or { valid: false, error: '...', cleaned: null }
const parseAmountToCents = require('./parseAmount');

function isId(value) {
  return Number.isInteger(value) && value > 0 && value <= 999999999;
}

function toId(value) {
  if (typeof value === 'string' && /^\d{1,9}$/.test(value.trim())) {
    return Number(value.trim());
  }
  return value;
}

function validatePayment(input) {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Invalid input', cleaned: null };
  }

  const circleId = toId(input.circle_id);
  if (!isId(circleId)) {
    return { valid: false, error: 'Pick a circle', cleaned: null };
  }

  const userId = toId(input.user_id);
  if (!isId(userId)) {
    return { valid: false, error: 'Pick a person', cleaned: null };
  }

  const cents = parseAmountToCents(input.amount);
  if (cents === null) {
    return { valid: false, error: 'Enter an amount more than $0 with at most 2 decimals', cleaned: null };
  }

  return { valid: true, error: null, cleaned: { circleId, userId, cents } };
}

module.exports = validatePayment;
