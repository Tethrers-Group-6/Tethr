const express = require('express');
const path = require('path');
const validateProfileUpdate = require('../validateProfileUpdate');

// My profile, plus how many circles I am in (computed, not a stored column)
const SQL_PROFILE = `
SELECT u.user_id,
       u.display_name,
       u.email,
       u.venmo_username,
       u.created_at,
       (SELECT COUNT(*) FROM circle_members cm WHERE cm.user_id = u.user_id)::int AS circle_count
FROM users u
WHERE u.user_id = $1`;

const SQL_UPDATE_PROFILE = `
UPDATE users
SET display_name = $2,
    venmo_username = $3
WHERE user_id = $1
RETURNING user_id`;

// Shape sent to the browser. password_hash is never selected, so it can never leak.
function toProfile(row) {
    return {
        id: row.user_id,
        displayName: row.display_name,
        email: row.email,
        venmoUsername: row.venmo_username,
        memberSince: row.created_at,
        circleCount: row.circle_count
    };
}

module.exports = function (db) {
    const router = express.Router();

    function currentUserID(req) {
        return req.session && req.session.user ? req.session.user.user_id : null;
    }

    // The page itself (same pattern as /circles and /home)
    router.get('/profile', (req, res) => {
        if (!currentUserID(req)) {
            return res.redirect('/login');
        }
        res.sendFile(path.join(__dirname, '../views/profile.html'));
    });

    // Read my profile
    //   200 profile | 401 not logged in | 404 account no longer exists
    router.get('/api/profile', async (req, res) => {
        const userId = currentUserID(req);
        if (!userId) {
            return res.status(401).json({ error: 'Not logged in' });
        }

        try {
            const row = await db.oneOrNone(SQL_PROFILE, [userId]);
            if (!row) {
                return res.status(404).json({ error: 'Profile not found' });
            }
            res.json({ profile: toProfile(row) });
        } catch (err) {
            console.error('GET /api/profile failed:', err);
            res.status(500).json({ error: 'Could not load profile' });
        }
    });

    // Update my display name and Venmo username (email is the login, so it is not editable here)
    //   200 updated | 400 bad input (message says which field) | 401 not logged in | 404 no account
    router.put('/api/profile', async (req, res) => {
        const userId = currentUserID(req);
        if (!userId) {
            return res.status(401).json({ error: 'Not logged in' });
        }

        const check = validateProfileUpdate(req.body);
        if (!check.valid) {
            return res.status(400).json({ error: check.error });
        }

        try {
            const updated = await db.oneOrNone(SQL_UPDATE_PROFILE, [
                userId,
                check.cleaned.display_name,
                check.cleaned.venmo_username
            ]);
            if (!updated) {
                return res.status(404).json({ error: 'Profile not found' });
            }

            // Keep the session's copy of the name in sync, if login stores one there
            if (req.session.user.display_name !== undefined) {
                req.session.user.display_name = check.cleaned.display_name;
            }

            const row = await db.one(SQL_PROFILE, [userId]);
            res.json({ message: 'Profile updated', profile: toProfile(row) });
        } catch (err) {
            console.error('PUT /api/profile failed:', err);
            res.status(500).json({ error: 'Could not update profile' });
        }
    });

    return router;
};
