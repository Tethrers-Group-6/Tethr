const express = require('express');
const bcrypt = require('bcryptjs');
const validateRegistration = require('../validateRegistration');

module.exports = function (db) {
    const router = express.Router();

    router.post('/register', async (req, res) => {
        const check = validateRegistration(req.body);
        if (!check.valid) {
            return res.status(400).json({ error: check.error }); // 400: Password is invalid:
        }

        const { display_name, email, password } = check.cleaned;
        try {
            const hash = await bcrypt.hash(password, 10);
            await db.none(
                'INSERT INTO users (display_name, email, password_hash) VALUES ($1, $2, $3)',
                [display_name, email, hash]
            );
            res.status(201).json({ message: 'Registration successful' }); 
        } catch (err) {
            if (err.code === '23505') {
                return res.status(409).json({ error: 'Email already registered' }); // 400: Email already registered
            }
            console.error('POST /register failed:', err);
            res.status(500).json({ error: 'Could not register, please try again later' }); // 500: Server is down, database is incorrect. etc.
        }
    });

    return router;
};
