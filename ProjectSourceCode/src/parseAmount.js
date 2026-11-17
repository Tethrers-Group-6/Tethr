// Turns a dollar amount typed by a user ("92.40", "5", "0.5") into integer cents.
// Returns null when it is not a valid positive amount with at most 2 decimals.
// Works on the TEXT with a pattern, because 1.15 * 100 === 114.99999999999999 in JavaScript.
function parseAmountToCents(input) {
    if (typeof input === 'number') {
      input = String(input);
    }
    if (typeof input !== 'string') {
      return null;
    }
    const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(input.trim());
    if (!match) {
      return null;
    }
    const dollars = Number(match[1]);
    const cents = Number((match[2] || '').padEnd(2, '0'));
    const total = dollars * 100 + cents;
    return total > 0 ? total : null;
  }
  
  module.exports = parseAmountToCents;