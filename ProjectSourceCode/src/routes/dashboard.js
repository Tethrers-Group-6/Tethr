const express = require('express');
const path = require('path');

// One row per money transaction
    // other_user = the person, circle_id, amt(+owe me, -owe them)
const LEDGER = `
WITH ledger AS (
    SELECT l.*
    FROM (
        -- expenses I paid: everyone's share is owed to me
        SELECT s.user_id AS other_user, e.circle_id, s.amount AS amt
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
    ) l

    WHERE l.circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = $1)
)`;


const MY_CIRCLES = `(
SELECT circle_id
FROM circle_members
WHERE user_id = $1
)`;


const SQL_USER = `(
SELECT display_name
FROM users
WHERE user_id = $1
)`;


const SQL_TOTALS = `${LEDGER}
SELECT
    COALESCE(ROUND(SUM(GREATEST(net, 0)) * 100), 0)::int AS owed_cents,
    COALESCE(ROUND(SUM(GREATEST(-net, 0)) * 100), 0)::int AS owe_cents
FROM (SELECT other_user, SUM(amt) AS net FROM ledger GROUP BY other_user) t`;


// Top two circles by size of balance(owed or owe)
const SQL_TOP_CIRCLES = `${LEDGER}
SELECT c.circle_id AS id, c.name,
    (SELECT COUNT(*) FROM circle_members m2 WHERE m2.circle_id = c.circle_id) AS member_count,
    COALESCE(ROUND(SUMl.amt) * 100), 0)::int AS balance_cents
FROM circles c
JOIN circle_members m ON m.circle_id = c.circle_id AND m.user_id = $1
LEFT JOIN ledger l on l.circle_id = c.circle_id
GROUP BY c.circle_id, c.name
ORDER BY ABS(COALESCE(SUM(l.amt), 0)) DESC, c.name
LIMIT 2`;


// Recent activity: expenses, confirmed payments, newest top
const SQL_RECENT_ACTIVITY = `
SELECT * FROM (
    SELECT
    'e' || e.expense_id AS id,
    e.name AS title,
    (CASE WHEN e.paid_by = $1 THEN 'You paid' ELSE u.display_name || ' paid' END) || ' · ' || c.name AS detail,
    (CASE
        WHEN e.paid_by = $1 THEN
            ROUND(COALESCE((SELECT SUM(s.amount_owed) FROM expense.splits s WHERE s.expense_id = e.expense_id AND s.user_id <> $1), 0) * 100)
            ELSE -ROUND(COALESCE((SELECT s.amount_owed FROM expense_splits s WHERE s.expense_id = e.expense_id  AND s.user_id = $1), 0) * 100)
        END)::int AS amount_cents
    to_char(e.expense_date, 'YYYY-MM-DD') AS on_date
FROM expenses e
JOIN circles c ON c.circle_id = e.circle_id
JOIN users u ON u.user_id = e.paid_by
WHERE e.circle_id IN ${MY_CIRCLES}

UNION ALL

SELECT
    'p' || p.payment_id,
    CASE WHEN p.to_user = $1 THEN f.display_name || ' paid you' ELSE 'You paid ' || t.display_name END,
    'Payment confirmed · ' || c.name,
    CASE WHEN p.to_user = $1 THEN ROUND(p.amount * 100) ELSE -ROUND(p.amount * 100) END)::int,
    to_char(p.created_at, 'YYYY-MM-DD')
    FROM payments p
    JOIN users u ON u.user_id = p.from_user
    JOIN users t ON t.user_id = p.to_user
    JOIN circles c ON c.circle_id = p.circle_id
    WHERE p.status = 'confirmed' AND (p.from_user = $1 OR p.to_user = $1)
) r
WHERE r.amount_cents <> 0
ORDER BY r.on_date DESC
LIMIT 5`;


// Upcoming: events and recurring expenses
const SQL_UPCOMING = `
SELECT * FROM (
    SELECT
        'e' || ev.event_id AS id,
        ev.title,
        c.name AS circle_name,
        to_char(ev.starts_at, 'YYYY-MM-DD') AS on_date,
        'event' AS kind
    FROM events ev
    JOIN circles c ON c.circle_id = ev.circle_id
    WHERE ev.starts_at >= CURRENT_DATE AND ev.circle_id IN ${MY_CIRCLES}

    UNION ALL

    SELECT
        'b' || b.bill_id,
        b.name,
        c.name,
        to_char(b.next_due_date, 'YYYY-MM-DD'),
        'bill'
    FROM recurring_bills b
    JOIN circles c ON c.circle_id = b.circle_id
    WHERE b.next_due_date >= CURRENT_DATE AND b.circle_id IN ${MY_CIRCLES}
) u
ORDER BY u.on_date
LIMIT 5`;


module.exports = function (db) {
    const router = express.Router();

    router.use('/resources', express.static(path.join(__dirname, '../resources')));

    function currentUserID(req) {
        return req.session && req.session.user ? req.session.user_id : null;
    }

    router.get('/home', (req, res) => {
        if(!currentUserID(req)) {
            return res.redirect('/login');
        }

        res.sendFile(path.join(__dirname, '../views/dashboard.html'));
    });

    router.get('/api/dashboard', async(req, res) => {
        const userId = currentUserID(req);
        if (!userId) {
            return res.status(401).json({ error: 'Not logged in' });
        }

        try {
            const [user, totals, circles, recent, upcoming] = await Promise.all([
                db.oneOrNone(SQL_USER, [userId]),
                db.one(SQL_TOTALS, [userId]),
                db.any(SQL_TOP_CIRCLES, [userId]),
                db.any(SQL_RECENT_ACTIVITY, [userId]),
                db.any(SQL_UPCOMING, [userId])
            ]);

            res.json({
                user: { name: user ? user.display_name : ''},
                totals: { oweCents: totals.owe_cents, owedCents: totals.owed_cents },
                transactions: recent.map(r => ({
                    id: r.id,
                    title: r.title,
                    detail: r.detail,
                    amountCents: r.amount_cents,
                    date: r.on_date
            })),

            events: upcoming.map(r => ({
                id: r.id,
                title: r.title,
                circleName: r.circle_name,
                date: r.on_date,
                kind: r.kind
            })),

            circles: circles.map(r => ({
                id: r.id,
                name: r.name,
                memberCount: r.member_count,
                balanceCents: r.balance_cents
            }))
        });
    } catch (err) {
        console.error('GET /api/dashboard failed:', err);
        res.status(500).json({ error: 'Could not load dashboard' });
    }
    });

    return router;
}