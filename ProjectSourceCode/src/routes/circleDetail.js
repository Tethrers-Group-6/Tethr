const express = require('express');
const path = require('path');
// The circle itself, but ONLY if the logged-in user is a member (membership check built in)
const SQL_CIRCLE = `
SELECT c.circle_id AS id, c.name, c.invite_code, cm.role
FROM circles c
JOIN circle_members cm ON cm.circle_id = c.circle_id AND cm.user_id = $2
WHERE c.circle_id = $1`;

const SQL_MEMBERS = `
SELECT u.user_id AS id, u.display_name AS name, cm.role
FROM circle_members cm
JOIN users u ON u.user_id = cm.user_id
WHERE cm.circle_id = $1
ORDER BY u.display_name`;

// Newest first. your_share_cents is NULL when you were not part of that expense.
const SQL_EXPENSES = `
SELECT e.expense_id AS id,
       e.name,
       ROUND(e.total_amount * 100)::int AS total_cents,
       e.paid_by,
       u.display_name AS paid_by_name,
       e.expense_date::text AS date,
       e.note,
       ROUND(s.amount_owed * 100)::int AS your_share_cents
FROM expenses e
JOIN users u ON u.user_id = e.paid_by
LEFT JOIN expense_splits s ON s.expense_id = e.expense_id AND s.user_id = $2
WHERE e.circle_id = $1
ORDER BY e.expense_date DESC, e.expense_id DESC
LIMIT 50`;

module.exports = function (db) {
    const router = express.Router();

    function currentUserID(req) {
        return req.session && req.session.user ? req.session.user.user_id : null;
    }


    // The page itself. The page's script then asks /api/circles/:id for the data.
    router.get('/circles/:id', (req, res) => {
        if (!currentUserID(req)) {
            return res.redirect('/login');
        }
        res.sendFile(path.join(__dirname, '../views/circle.html'));
    });


    // One circle: its details, its members, and its recent expenses
    router.get('/api/circles/:id', async (req, res) => {
        const userId = currentUserID(req);
        if (!userId) {
            return res.status(401).json({ error: 'Not logged in' });
        }

        // req.params are always strings, so check it really is a whole number first
        if (!/^\d{1,9}$/.test(req.params.id)) {
            return res.status(400).json({ error: 'Invalid circle id' });
        }
        const circleId = Number(req.params.id);

        try {
            const circle = await db.oneOrNone(SQL_CIRCLE, [circleId, userId]);
            if (!circle) {
                // Same answer whether it does not exist or you are not in it: do not leak which
                return res.status(404).json({ error: 'Circle not found' });
            }

            const [members, expenses] = await Promise.all([
                db.any(SQL_MEMBERS, [circleId]),
                db.any(SQL_EXPENSES, [circleId, userId]),
            ]);

            res.json({
                circle: { id: circle.id, name: circle.name, inviteCode: circle.invite_code, role: circle.role },
                me: { id: userId },
                members,
                expenses: expenses.map((e) => ({
                    id: e.id,
                    name: e.name,
                    totalCents: e.total_cents,
                    paidBy: e.paid_by,
                    paidByName: e.paid_by_name,
                    date: e.date,
                    note: e.note,
                    yourShareCents: e.your_share_cents,
                })),
            });
        } catch (err) {
            console.error('GET /api/circles/:id failed:', err);
            res.status(500).json({ error: 'Could not load circle' });
        }
    });

    return router;
};