const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = function (db) {const router = express.Router();

    router.post('/login', async (req, res) => {
        const body = req.body || {};
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        try {
            const user = await db.oneOrNone(
                'SELECT user_id, display_name, password_hash FROM users WHERE email = $1',
                [email]
            );

            if (!user || !(await bcrypt.compare(password, user.password_hash))) {
                return res.status(401).json({ error: 'Incorrect email or password' });
            }

            req.session.user = { user_id: user.user_id, display_name: user.display_name };
            res.json({ message: 'Login successful' });
        } catch (err) {
            console.error('POST /login failed:', err);
            res.status(500).json({ error: 'Could not log in' });
        }
    });

    router.post('/logout', (req, res) => {
        req.session.destroy(() => res.json({ message: 'Logged out' }));
    });

    return router;
};