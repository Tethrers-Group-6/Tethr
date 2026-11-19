// Pure function: no HTTP, no database. That is what makes it unit-testable.
//
// Turns one row per (friend, circle) into the People view on the Balances page.
//
// Input rows (all amounts are integer cents, from MY point of view):
//   { userId, name, venmoUsername, circleId, circleName, cents }
//   cents > 0  -> they owe me in that circle
//   cents < 0  -> I owe them in that circle
//
// Returns:
//   {
//     totals: { oweCents, owedCents },
//     people: [{ id, name, venmoUsername, netCents, circles: [{ id, name, netCents }] }]
//   }
//
// Totals use each friend's NET across all circles (same math as the dashboard), so
// "owe $10 in one circle, owed $4 in another" counts as owing that friend $6.
// Circles where we are even are dropped, and so is anyone we are fully settled with.
// People with the biggest balance come first; ties are sorted by name.

function summarizeBalances(rows) {
  const byPerson = new Map();

  (rows || []).forEach((row) => {
    const cents = Number(row.cents) || 0;
    if (cents === 0) {
      return;
    }

    if (!byPerson.has(row.userId)) {
      byPerson.set(row.userId, {
        id: row.userId,
        name: row.name,
        venmoUsername: cleanVenmo(row.venmoUsername),
        netCents: 0,
        circles: [],
      });
    }

    const person = byPerson.get(row.userId);
    person.netCents += cents;
    person.circles.push({ id: row.circleId, name: row.circleName, netCents: cents });
  });

  const people = [...byPerson.values()];
  people.forEach((p) => p.circles.sort(byBiggestThenName));
  people.sort(byBiggestThenName);

  let oweCents = 0;
  let owedCents = 0;
  people.forEach((p) => {
    if (p.netCents > 0) {
      owedCents += p.netCents;
    } else {
      oweCents += -p.netCents;
    }
  });

  return { totals: { oweCents, owedCents }, people };
}

function byBiggestThenName(a, b) {
  return Math.abs(b.netCents) - Math.abs(a.netCents) || String(a.name).localeCompare(String(b.name));
}

// Some saved usernames start with "@". Venmo links need it without.
function cleanVenmo(username) {
  if (typeof username !== 'string') {
    return null;
  }
  const trimmed = username.trim().replace(/^@/, '');
  return trimmed === '' ? null : trimmed;
}

module.exports = summarizeBalances;
