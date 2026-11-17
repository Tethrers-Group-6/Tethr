const express = require('express');
const computeSplits = require('../computeSplits');
const parseAmountToCents = require('../parseAmount');
const path = require('path');
// Which of these users belong to this circle? (one query for payer + participants)
const SQL_MEMBERS_AMONG = `
SELECT user_id
FROM circle_members
WHERE circle_id = $1 AND user_id = ANY($2)`;

const SQL_INSERT_EXPENSE = `
INSERT INTO expenses (circle_id, paid_by, name, total_amount, expense_date, split_type, note)
VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), 'equal', $6)
RETURNING expense_id`;

const SQL_INSERT_SPLIT = `
INSERT INTO expense_splits (expense_id, user_id, amount_owed)
VALUES ($1, $2, $3)`;

const toDollars = (cents) => (cents / 100).toFixed(2);

module.exports = function (db) {
    const router = express.Router();

    function currentUserID(req) {
        return req.session && req.session.user ? req.session.user.user_id : null;
    }


    // The page itself (same pattern as /circles in circles.js)
    router.get('/expenses', (req, res) => {
        if (!currentUserID(req)) {
            return res.redirect('/login');
        }
        res.sendFile(path.join(__dirname, '../views/expenses.html'));
    });


    // Add an expense, split equally among the chosen circle members
    router.post('/api/expenses', async (req, res) => {
        const payerId = currentUserID(req);
        if (!payerId) {
            return res.status(401).json({ error: 'Not logged in' });
        }

        // 1. Validate the shape of the input
        const { circleId, name, amount, expenseDate, note, participantIds } = req.body || {};
        const cleanName = typeof name === 'string' ? name.trim() : '';
        const totalCents = parseAmountToCents(amount);
        const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null;
        const validDate = expenseDate === undefined || expenseDate === null || expenseDate === ''
            || (typeof expenseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expenseDate)
                && !Number.isNaN(Date.parse(expenseDate)));

        if (
            !Number.isInteger(circleId) || circleId <= 0 ||
            cleanName.length === 0 || cleanName.length > 100 ||
            totalCents === null ||
            !validDate ||
            !Array.isArray(participantIds) || participantIds.length === 0 || participantIds.length > 50 ||
            !participantIds.every((id) => Number.isInteger(id) && id > 0)
        ) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        // The payer is always part of the split; Set removes duplicates
        const everyone = [...new Set([payerId, ...participantIds])];

        try {
            // 2 + 3. Payer and every participant must be members of this circle
            const rows = await db.any(SQL_MEMBERS_AMONG, [circleId, everyone]);
            const memberIds = new Set(rows.map((r) => r.user_id));

            if (!memberIds.has(payerId)) {
                return res.status(403).json({ error: 'You are not in this circle' });
            }
            if (!everyone.every((id) => memberIds.has(id))) {
                return res.status(400).json({ error: 'Everyone in the split must be in the circle' });
            }

            // 4. Do the math, then save the expense and ALL its splits or nothing
            const splits = computeSplits(totalCents, everyone);

            const expenseId = await db.tx(async (t) => {
                const { expense_id } = await t.one(SQL_INSERT_EXPENSE, [
                    circleId, payerId, cleanName, toDollars(totalCents), expenseDate || null, cleanNote,
                ]);
                for (const s of splits) {
                    await t.none(SQL_INSERT_SPLIT, [expense_id, s.userId, toDollars(s.amountCents)]);
                }
                return expense_id;
            });

            res.status(201).json({
                message: 'Expense added',
                expense: { id: expenseId, name: cleanName, totalCents, splits },
            });
        } catch (err) {
            console.error('POST /api/expenses failed:', err);
            res.status(500).json({ error: 'Could not add expense' });
        }
    });

    return router;
};