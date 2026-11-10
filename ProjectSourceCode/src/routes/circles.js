const express = require('express');
const path = require('path');
const crypto = require('crypto');
const validateInviteCode = require('../validateInviteCode');

// Circles I belong to, with counts computed on the fly (they are not stored columns)
const SQL_MY_CIRCLES = `
SELECT c.circle_id AS id,
       c.name,
       c.invite_code,
       cm.role,
       (SELECT COUNT(*) FROM circle_members m WHERE m.circle_id = c.circle_id)::int AS member_count,
       (SELECT COUNT(*) FROM expenses e WHERE e.circle_id = c.circle_id)::int AS expense_count
FROM circles c
JOIN circle_members cm ON cm.circle_id = c.circle_id AND cm.user_id = $1
ORDER BY c.name`;

const SQL_FIND_BY_CODE = `
SELECT circle_id, name
FROM circles
WHERE UPPER(invite_code) = UPPER($1)`;

const SQL_IS_MEMBER = `
SELECT 1
FROM circle_members
WHERE circle_id = $1 AND user_id = $2`;

const SQL_ADD_MEMBER = `
INSERT INTO circle_members (circle_id, user_id, role)
VALUES ($1, $2, 'member')`;

module.exports = function (db) {
    const router = express.Router();

    function currentUserID(req) {
        return req.session && req.session.user ? req.session.user.user_id : null;
    }

    // The page itself (same pattern as /home in dashboard.js)
    router.get('/circles', (req, res) => {
        if (!currentUserID(req)) {
            return res.redirect('/login');
        }
        res.sendFile(path.join(__dirname, '../views/circles.html'));
    });

    // List my circles
    router.get('/api/circles', async (req, res) => {
        const userId = currentUserID(req);
        if (!userId) {
            return res.status(401).json({ error: 'Not logged in' });
        }

        try {
            const rows = await db.any(SQL_MY_CIRCLES, [userId]);
            res.json({
                circles: rows.map(r => ({
                    id: r.id,
                    name: r.name,
                    inviteCode: r.invite_code,
                    role: r.role,
                    memberCount: r.member_count,
                    expenseCount: r.expense_count
                }))
            });
        } catch (err) {
            console.error('GET /api/circles failed:', err);
            res.status(500).json({ error: 'Could not load circles' });
        }
    });

    // Join a circle with an invite code
    //   201 joined | 400 bad input | 401 not logged in | 404 unknown code | 409 already a member
    router.post('/api/circles/join', async (req, res) => {
        const userId = currentUserID(req);
        if (!userId) {
            return res.status(401).json({ error: 'Not logged in' });
        }

        const code = req.body && req.body.invite_code;
        if (!validateInviteCode(code)) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        try {
            const circle = await db.oneOrNone(SQL_FIND_BY_CODE, [code.trim()]);
            if (!circle) {
                return res.status(404).json({ error: 'Invalid invite code' });
            }

            const already = await db.oneOrNone(SQL_IS_MEMBER, [circle.circle_id, userId]);
            if (already) {
                return res.status(409).json({ error: 'You are already in this circle' });
            }

            await db.none(SQL_ADD_MEMBER, [circle.circle_id, userId]);
            res.status(201).json({
                message: 'Joined circle',
                circle: { id: circle.circle_id, name: circle.name }
            });
        } catch (err) {
            console.error('POST /api/circles/join failed:', err);
            res.status(500).json({ error: 'Could not join circle' });
        }
    });

    // Create a circle; the creator becomes its admin
    router.post('/api/circles', async (req, res) => {
        const userId = currentUserID(req);
        if (!userId) {
            return res.status(401).json({ error: 'Not logged in' });
        }

        const name = req.body && typeof req.body.name === 'string' ? req.body.name.trim() : '';
        if (!name || name.length > 100) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        const inviteCode = 'TETH-' + crypto.randomBytes(3).toString('hex').toUpperCase();

        try {
            // A transaction: either BOTH inserts happen or neither does
            const circle = await db.tx(async t => {
                const c = await t.one(
                    `INSERT INTO circles (name, invite_code, created_by)
                     VALUES ($1, $2, $3)
                     RETURNING circle_id, name, invite_code`,
                    [name, inviteCode, userId]
                );
                await t.none(
                    `INSERT INTO circle_members (circle_id, user_id, role)
                     VALUES ($1, $2, 'admin')`,
                    [c.circle_id, userId]
                );
                return c;
            });

            res.status(201).json({
                message: 'Circle created',
                circle: { id: circle.circle_id, name: circle.name, inviteCode: circle.invite_code }
            });
        } catch (err) {
            console.error('POST /api/circles failed:', err);
            res.status(500).json({ error: 'Could not create circle' });
        }
    });

    return router;
};
