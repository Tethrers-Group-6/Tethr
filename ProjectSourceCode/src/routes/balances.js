const express = require('express');
const path = require('path');
const summarizeBalances = require('../summarizeBalances');
const validatePayment = require('../validatePayment');

const MY_CIRCLES = `(
SELECT circle_id
FROM circle_members
WHERE user_id = $1
)`;

// One row per (friend, circle) with what we owe each other there.
// cents > 0 means they owe me, cents < 0 means I owe them.
// Same four money sources as the dashboard, so the two pages always agree.
const SQL_BALANCES = `
WITH ledger AS (
    -- expenses I paid: everyone's share is owed to me
    SELECT s.user_id AS other_user, e.circle_id, s.amount_owed AS amt
    FROM expenses e
    JOIN expense_splits s ON s.expense_id = e.expense_id
    WHERE e.paid_by = $1 AND s.user_id <> $1

    UNION ALL
    -- expenses someone else paid: my share is owed to them
    SELECT e.paid_by, e.circle_id, -s.amount_owed
    FROM expenses e
    JOIN expense_splits s ON s.expense_id = e.expense_id
    WHERE s.user_id = $1 AND e.paid_by <> $1

    UNION ALL
    -- confirmed payments I made reduce what I owe
    SELECT p.to_user, p.circle_id, p.amount
    FROM payments p
    WHERE p.from_user = $1 AND p.status = 'confirmed'

    UNION ALL
    -- confirmed payments I received reduce what I am owed
    SELECT p.from_user, p.circle_id, -p.amount
    FROM payments p
    WHERE p.to_user = $1 AND p.status = 'confirmed'
)
SELECT l.other_user AS user_id,
       u.display_name,
       u.venmo_username,
       l.circle_id,
       c.name AS circle_name,
       ROUND(SUM(l.amt) * 100)::int AS cents
FROM ledger l
JOIN users u ON u.user_id = l.other_user
JOIN circles c ON c.circle_id = l.circle_id
WHERE l.circle_id IN ${MY_CIRCLES}
GROUP BY l.other_user, u.display_name, u.venmo_username, l.circle_id, c.name`;

// Payments someone logged that the receiver has not confirmed yet
const SQL_PENDING = `
SELECT p.payment_id AS id,
       p.circle_id,
       c.name AS circle_name,
       p.from_user,
       f.display_name AS from_name,
       p.to_user,
       t.display_name AS to_name,
       ROUND(p.amount * 100)::int AS cents,
       to_char(p.created_at, 'YYYY-MM-DD') AS on_date
FROM payments p
JOIN circles c ON c.circle_id = p.circle_id
JOIN users f ON f.user_id = p.from_user
JOIN users t ON t.user_id = p.to_user
WHERE p.status = 'pending'
  AND (p.from_user = $1 OR p.to_user = $1)
  AND p.circle_id IN ${MY_CIRCLES}
ORDER BY p.created_at DESC, p.payment_id DESC`;

// Full history: every expense I am part of and every confirmed payment, newest first.
// (The dashboard shows the top 5 of this list; its "See All" link comes here.)
const SQL_HISTORY = `
SELECT * FROM (
    SELECT
        'e' || e.expense_id AS id,
        e.name AS title,
        (CASE WHEN e.paid_by = $1 THEN 'You paid' ELSE u.display_name || ' paid' END) || ' · ' || c.name AS detail,
        (CASE
            WHEN e.paid_by = $1 THEN
                ROUND(COALESCE((SELECT SUM(s.amount_owed) FROM expense_splits s WHERE s.expense_id = e.expense_id AND s.user_id <> $1), 0) * 100)
            ELSE -ROUND(COALESCE((SELECT s.amount_owed FROM expense_splits s WHERE s.expense_id = e.expense_id AND s.user_id = $1), 0) * 100)
        END)::int AS amount_cents,
        to_char(e.expense_date, 'YYYY-MM-DD') AS on_date,
        e.expense_id AS sort_id
    FROM expenses e
    JOIN circles c ON c.circle_id = e.circle_id
    JOIN users u ON u.user_id = e.paid_by
    WHERE e.circle_id IN ${MY_CIRCLES}

    UNION ALL

    SELECT
        'p' || p.payment_id,
        CASE WHEN p.to_user = $1 THEN f.display_name || ' paid you' ELSE 'You paid ' || t.display_name END,
        'Payment confirmed · ' || c.name,
        (CASE WHEN p.to_user = $1 THEN ROUND(p.amount * 100) ELSE -ROUND(p.amount * 100) END)::int,
        to_char(p.created_at, 'YYYY-MM-DD'),
        p.payment_id
    FROM payments p
    JOIN users f ON f.user_id = p.from_user
    JOIN users t ON t.user_id = p.to_user
    JOIN circles c ON c.circle_id = p.circle_id
    WHERE p.status = 'confirmed' AND (p.from_user = $1 OR p.to_user = $1)
      AND p.circle_id IN ${MY_CIRCLES}
) r
WHERE r.amount_cents <> 0
ORDER BY r.on_date DESC, r.sort_id DESC
LIMIT 100`;

// How many of these two people are in the circle (2 means both are)
const SQL_BOTH_MEMBERS = `
SELECT COUNT(*)::int AS n
FROM circle_members
WHERE circle_id = $1 AND user_id IN ($2, $3)`;

// What $3 owes $2 inside circle $1, in cents (negative means $2 owes $3).
// Only confirmed payments count here; pending ones are subtracted separately.
const SQL_PAIR_BALANCE = `
SELECT COALESCE(ROUND(SUM(amt) * 100), 0)::int AS cents
FROM (
    SELECT s.amount_owed AS amt
    FROM expenses e
    JOIN expense_splits s ON s.expense_id = e.expense_id
    WHERE e.circle_id = $1 AND e.paid_by = $2 AND s.user_id = $3

    UNION ALL
    SELECT -s.amount_owed
    FROM expenses e
    JOIN expense_splits s ON s.expense_id = e.expense_id
    WHERE e.circle_id = $1 AND e.paid_by = $3 AND s.user_id = $2

    UNION ALL
    SELECT p.amount
    FROM payments p
    WHERE p.circle_id = $1 AND p.from_user = $2 AND p.to_user = $3 AND p.status = 'confirmed'

    UNION ALL
    SELECT -p.amount
    FROM payments p
    WHERE p.circle_id = $1 AND p.from_user = $3 AND p.to_user = $2 AND p.status = 'confirmed'
) x`;

// Money $3 says they already sent $2 in circle $1 that $2 has not confirmed yet
const SQL_PENDING_SUM = `
SELECT COALESCE(ROUND(SUM(amount) * 100), 0)::int AS cents
FROM payments
WHERE circle_id = $1 AND to_user = $2 AND from_user = $3 AND status = 'pending'`;

const SQL_INSERT_PAYMENT = `
INSERT INTO payments (circle_id, from_user, to_user, amount, status)
VALUES ($1, $2, $3, $4, $5)
RETURNING payment_id`;

// A payment, but only if I am one of the two people in it
const SQL_MY_PAYMENT = `
SELECT payment_id, from_user, to_user, status
FROM payments
WHERE payment_id = $1 AND (from_user = $2 OR to_user = $2)`;

const toDollars = (cents) => (cents / 100).toFixed(2);

function toPending(row, userId) {
    const incoming = row.to_user === userId;
    return {
        id: row.id,
        circleId: row.circle_id,
        circleName: row.circle_name,
        otherUserId: incoming ? row.from_user : row.to_user,
        otherName: incoming ? row.from_name : row.to_name,
        amountCents: row.cents,
        date: row.on_date,
    };
}

module.exports = function (db) {
    const router = express.Router();

    function currentUserID(req) {
        return req.session && req.session.user ? req.session.user.user_id : null;
    }

    function parseId(raw) {
        return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
    }

    // Shared by both "record a payment" routes.
    //   debtorId owes creditorId. The new payment goes debtor -> creditor with the given status.
    //   It may not be more than what is still owed after pending payments.
    async function recordPayment(req, res, { iAmPayer, status, message }) {
        const userId = currentUserID(req);
        if (!userId) {
            return res.status(401).json({ error: 'Not logged in' });
        }

        const check = validatePayment(req.body);
        if (!check.valid) {
            return res.status(400).json({ error: check.error });
        }
        const { circleId, userId: otherId, cents } = check.cleaned;
        if (otherId === userId) {
            return res.status(400).json({ error: 'You cannot pay yourself' });
        }

        const debtorId = iAmPayer ? userId : otherId;
        const creditorId = iAmPayer ? otherId : userId;

        try {
            const result = await db.tx(async (t) => {
                const members = await t.one(SQL_BOTH_MEMBERS, [circleId, userId, otherId]);
                if (members.n !== 2) {
                    return { status: 404, body: { error: 'Circle not found' } };
                }

                const owed = await t.one(SQL_PAIR_BALANCE, [circleId, creditorId, debtorId]);
                const pending = await t.one(SQL_PENDING_SUM, [circleId, creditorId, debtorId]);
                const remaining = owed.cents - pending.cents;

                if (remaining <= 0) {
                    return {
                        status: 409,
                        body: { error: pending.cents > 0
                            ? 'A payment for this is already waiting to be confirmed'
                            : 'Nothing is owed here' },
                    };
                }
                if (cents > remaining) {
                    return { status: 400, body: { error: `That is more than the $${toDollars(remaining)} owed` } };
                }

                const row = await t.one(SQL_INSERT_PAYMENT, [circleId, debtorId, creditorId, toDollars(cents), status]);
                return { status: 201, body: { message, payment: { id: row.payment_id, status } } };
            });

            res.status(result.status).json(result.body);
        } catch (err) {
            console.error(`POST ${req.path} failed:`, err);
            res.status(500).json({ error: 'Could not record payment' });
        }
    }


    // The page itself (same pattern as /home and /profile)
    router.get('/balances', (req, res) => {
        if (!currentUserID(req)) {
            return res.redirect('/login');
        }
        res.sendFile(path.join(__dirname, '../views/balances.html'));
    });


    // Everything the Balances page shows
    //   200 { me, totals, people, pending: { incoming, outgoing }, history } | 401 not logged in
    router.get('/api/balances', async (req, res) => {
        const userId = currentUserID(req);
        if (!userId) {
            return res.status(401).json({ error: 'Not logged in' });
        }

        try {
            const [rows, pending, history] = await Promise.all([
                db.any(SQL_BALANCES, [userId]),
                db.any(SQL_PENDING, [userId]),
                db.any(SQL_HISTORY, [userId]),
            ]);

            const summary = summarizeBalances(rows.map((r) => ({
                userId: r.user_id,
                name: r.display_name,
                venmoUsername: r.venmo_username,
                circleId: r.circle_id,
                circleName: r.circle_name,
                cents: r.cents,
            })));

            res.json({
                me: { id: userId },
                totals: summary.totals,
                people: summary.people,
                pending: {
                    incoming: pending.filter((p) => p.to_user === userId).map((p) => toPending(p, userId)),
                    outgoing: pending.filter((p) => p.from_user === userId).map((p) => toPending(p, userId)),
                },
                history: history.map((h) => ({
                    id: h.id,
                    title: h.title,
                    detail: h.detail,
                    amountCents: h.amount_cents,
                    date: h.on_date,
                })),
            });
        } catch (err) {
            console.error('GET /api/balances failed:', err);
            res.status(500).json({ error: 'Could not load balances' });
        }
    });


    // I paid someone outside the app (Venmo, cash). Waits for THEM to confirm.
    //   JSON { circle_id, user_id (who I paid), amount }
    //   201 pending payment | 400 bad input or too much | 401 | 404 circle/person | 409 nothing owed
    router.post('/api/payments', (req, res) =>
        recordPayment(req, res, { iAmPayer: true, status: 'pending', message: 'Payment recorded' }));


    // Someone paid me. I am the one receiving it, so it counts right away.
    //   JSON { circle_id, user_id (who paid me), amount }
    //   201 confirmed payment | same failures as above
    router.post('/api/payments/received', (req, res) =>
        recordPayment(req, res, { iAmPayer: false, status: 'confirmed', message: 'Payment confirmed' }));


    // Confirm a pending payment someone sent me. Only the receiver can confirm.
    //   200 confirmed | 400 bad id | 401 | 403 not the receiver | 404 not found | 409 already confirmed
    router.post('/api/payments/:id/confirm', async (req, res) => {
        const userId = currentUserID(req);
        if (!userId) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        const paymentId = parseId(req.params.id);
        if (!paymentId) {
            return res.status(400).json({ error: 'Invalid payment id' });
        }

        try {
            const payment = await db.oneOrNone(SQL_MY_PAYMENT, [paymentId, userId]);
            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }
            if (payment.to_user !== userId) {
                return res.status(403).json({ error: 'Only the person who got paid can confirm' });
            }
            if (payment.status === 'confirmed') {
                return res.status(409).json({ error: 'Payment is already confirmed' });
            }

            await db.none(`UPDATE payments SET status = 'confirmed' WHERE payment_id = $1`, [paymentId]);
            res.json({ message: 'Payment confirmed' });
        } catch (err) {
            console.error('POST /api/payments/:id/confirm failed:', err);
            res.status(500).json({ error: 'Could not confirm payment' });
        }
    });


    // Remove a pending payment: the sender cancels it, or the receiver says it never arrived.
    // Confirmed payments are history and cannot be removed.
    //   200 removed | 400 bad id | 401 | 404 not found | 409 already confirmed
    router.delete('/api/payments/:id', async (req, res) => {
        const userId = currentUserID(req);
        if (!userId) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        const paymentId = parseId(req.params.id);
        if (!paymentId) {
            return res.status(400).json({ error: 'Invalid payment id' });
        }

        try {
            const payment = await db.oneOrNone(SQL_MY_PAYMENT, [paymentId, userId]);
            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }
            if (payment.status === 'confirmed') {
                return res.status(409).json({ error: 'Confirmed payments cannot be removed' });
            }

            await db.none('DELETE FROM payments WHERE payment_id = $1', [paymentId]);
            res.json({ message: payment.from_user === userId ? 'Payment canceled' : 'Payment declined' });
        } catch (err) {
            console.error('DELETE /api/payments/:id failed:', err);
            res.status(500).json({ error: 'Could not remove payment' });
        }
    });

    return router;
};
