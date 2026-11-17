// helpers

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
        node.className = className;
    }

    if (text !== undefined) {
        node.textContent = text;
    }

    return node;
}


// Pure functions (no DOM, so they can be unit tested)

// 9240 -> "$92.40"
function formatCents(cents) {
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(cents);
    return sign + '$' + Math.floor(abs / 100).toLocaleString('en-US') + '.' + String(abs % 100).padStart(2, '0');
}


// "2026-11-15" -> "Nov 15". Built from the text on purpose: new Date("2026-11-15") is
// read as UTC midnight and can show the previous day in US time zones.
function formatDate(isoDate) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = String(isoDate).split('-');
    const month = months[Number(parts[1]) - 1];
    return month ? month + ' ' + Number(parts[2]) : String(isoDate);
}


// How an expense affects ME: { text, className }
//   I paid        -> others owe me (total minus my own share)
//   I was in it   -> I owe my share to the payer
//   I was not in  -> no effect
function describeExpense(expense, myId) {
    if (expense.paidBy === myId) {
        const owedToMe = expense.totalCents - (expense.yourShareCents || 0);
        return { text: 'You are owed ' + formatCents(owedToMe), className: 'pos' };
    }

    if (expense.yourShareCents !== null) {
        return { text: 'You owe ' + formatCents(expense.yourShareCents), className: 'neg' };
    }

    return { text: 'Not involved', className: 'text-body-secondary' };
}


// "/circles/3" -> 3, anything else -> null
function circleIdFromPath(pathname) {
    const match = /^\/circles\/(\d+)\/?$/.exec(pathname);
    return match ? Number(match[1]) : null;
}


// Rendering

function showError(message) {
    const box = document.getElementById('error');
    box.textContent = message;
    box.hidden = false;
}


function renderMembers(members, myId) {
    const list = document.getElementById('member-list');
    list.replaceChildren();

    members.forEach(m => {
        const item = el('li', 'list-group-item d-flex justify-content-between align-items-center px-0');
        item.appendChild(el('span', '', m.id === myId ? m.name + ' (you)' : m.name));

        if (m.role === 'admin') {
            item.appendChild(el('span', 'small text-body-secondary', 'admin'));
        }

        list.appendChild(item);
    });
}


function renderExpenses(expenses, myId) {
    const list = document.getElementById('expense-list');
    list.replaceChildren();

    if (expenses.length === 0) {
        list.appendChild(el('li', 'list-group-item px-0 text-body-secondary fst-italic', 'No expenses yet. Add the first one!'));
        return;
    }

    expenses.forEach(e => {
        const effect = describeExpense(e, myId);
        const payer = e.paidBy === myId ? 'You' : e.paidByName;

        const left = el('div');
        left.appendChild(el('div', 'fw-semibold', e.name));
        left.appendChild(el('div', 'small text-body-secondary', payer + ' paid · ' + formatDate(e.date)));
        if (e.note) {
            left.appendChild(el('div', 'small text-body-secondary fst-italic', e.note));
        }

        const right = el('div', 'text-end');
        right.appendChild(el('div', 'fw-semibold', formatCents(e.totalCents)));
        right.appendChild(el('div', 'small ' + effect.className, effect.text));

        const item = el('li', 'list-group-item d-flex justify-content-between align-items-start gap-3 px-0');
        item.append(left, right);
        list.appendChild(item);
    });
}


function renderCircle(data) {
    document.title = data.circle.name;
    document.getElementById('circle-name').textContent = data.circle.name;

    const invite = document.getElementById('invite-line');
    invite.replaceChildren('Invite code: ', el('span', 'font-monospace', data.circle.inviteCode));
    invite.hidden = false;

    const add = document.getElementById('add-expense');
    add.href = '/expenses?circle=' + encodeURIComponent(data.circle.id);
    add.hidden = false;

    renderMembers(data.members, data.me.id);
    renderExpenses(data.expenses, data.me.id);
}


// Load

async function loadCircle() {
    const id = circleIdFromPath(window.location.pathname);
    if (id === null) {
        document.getElementById('circle-name').textContent = 'Circle';
        showError('That is not a valid circle address.');
        return;
    }

    try {
        const res = await fetch('/api/circles/' + id, { headers: { Accept: 'application/json' } });

        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (res.status === 404) {
            document.getElementById('circle-name').textContent = 'Circle not found';
            showError('That circle does not exist, or you are not a member of it.');
            return;
        }

        if (!res.ok) {
            throw new Error('HTTP ' + res.status);
        }

        renderCircle(await res.json());

    } catch (err) {
        document.getElementById('circle-name').textContent = 'Circle';
        showError('Could not load this circle. Please refresh the page.');
    }
}


if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', loadCircle);
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = { formatCents, formatDate, describeExpense, circleIdFromPath };
}