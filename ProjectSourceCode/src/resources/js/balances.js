// Balances page: totals, People view (per friend, across circles), pending payments, full history.
// Data comes from GET /api/balances (src/routes/balances.js).

let usingSample = false;
let pendingAction = null;   // what the payment modal will save: { mode, circleId, userId, name, circleName, maxCents }


// helpers (same style as dashboard.js)

function parseLocalDate(str) {
    const [y, m, d] = String(str).split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatMoney(cents) {
    const abs = Math.abs(Math.round(cents)) / 100;
    return '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSigned(cents) {
    if (cents === 0) {
        return '$0.00';
    }
    return (cents > 0 ? '+' : '-') + formatMoney(cents);
}

function formatShortDate(str) {
    return parseLocalDate(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Cents to a plain "12.50" for inputs and links
function centsToInput(cents) {
    return (Math.abs(cents) / 100).toFixed(2);
}

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

function emptyItem(message) {
    return el('li', 'list-group-item text-body-secondary fst-italic', message);
}

// Opens Venmo with the person, amount and a note filled in. The user still has to hit Pay.
function venmoPayUrl(username, cents, note) {
    if (!username) {
        return null;
    }
    const params = new URLSearchParams({
        txn: 'pay',
        recipients: String(username).replace(/^@/, ''),
        amount: centsToInput(cents),
        note: note || 'Tethr'
    });
    return 'https://venmo.com/?' + params.toString();
}

// "Owes you $5.00" / "You owe $5.00" / "Settled"
function balanceText(cents) {
    if (cents > 0) {
        return { text: 'Owes you ' + formatMoney(cents), cls: 'pos' };
    }
    if (cents < 0) {
        return { text: 'You owe ' + formatMoney(cents), cls: 'neg' };
    }
    return { text: 'Settled', cls: '' };
}


// Sample Data (shown only when the API cannot be reached)

const SAMPLE_DATA = {
    me: { id: 0 },
    totals: { oweCents: 4510, owedCents: 3600 },
    people: [
        {
            id: 1, name: 'Dylan Carter', venmoUsername: 'dyca1234', netCents: -3810,
            circles: [
                { id: 1, name: 'Apartment Roommates', netCents: -4310 },
                { id: 4, name: 'CSCI 3308 Team 6', netCents: 500 }
            ]
        },
        { id: 3, name: 'Sneha Kopparapu', venmoUsername: 'snko1234', netCents: 3600, circles: [{ id: 2, name: 'Friday Night Group', netCents: 3600 }] },
        { id: 2, name: 'Mia Trabadela', venmoUsername: null, netCents: -700, circles: [{ id: 2, name: 'Friday Night Group', netCents: -700 }] }
    ],
    pending: {
        incoming: [{ id: 1, circleId: 1, circleName: 'Apartment Roommates', otherUserId: 6, otherName: 'Isha Shah', amountCents: 2000, date: '2026-11-15' }],
        outgoing: []
    },
    history: [
        { id: 'e1', title: 'Pizza and drinks', detail: 'Mia paid · Friday Night Group', amountCents: -787, date: '2026-11-17' },
        { id: 'p1', title: 'You paid Dylan Carter', detail: 'Payment confirmed · Apartment Roommates', amountCents: -2310, date: '2026-11-16' }
    ]
};


// Rendering

function renderTotals(totals) {
    const owe = totals.oweCents || 0;
    const owed = totals.owedCents || 0;
    const net = owed - owe;

    document.getElementById('total-owe').textContent = formatMoney(owe);
    document.getElementById('total-owed').textContent = formatMoney(owed);

    const netEl = document.getElementById('total-net');
    const netText = document.getElementById('total-net-text');
    netEl.textContent = formatMoney(net);
    netEl.classList.remove('pos', 'neg');

    if (net > 0) {
        netEl.classList.add('pos');
        netText.textContent = "You're owed overall";
    } else if (net < 0) {
        netEl.classList.add('neg');
        netText.textContent = 'You owe overall';
    } else {
        netText.textContent = "You're all settled up";
    }
}


function renderPending(pending) {
    const incoming = pending.incoming || [];
    const outgoing = pending.outgoing || [];
    const section = document.getElementById('pending-section');
    const list = document.getElementById('pending-list');
    list.replaceChildren();

    section.hidden = incoming.length === 0 && outgoing.length === 0;

    incoming.forEach(p => {
        const li = el('li', 'list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2');
        const left = el('span');
        left.append(
            el('strong', 'd-block', p.otherName + ' says they paid you ' + formatMoney(p.amountCents)),
            el('small', 'd-block text-body-secondary', p.circleName + ' · ' + formatShortDate(p.date))
        );

        const actions = el('span', 'd-flex gap-2');
        const confirm = el('button', 'btn btn-dark btn-sm', 'Confirm');
        confirm.type = 'button';
        confirm.setAttribute('aria-label', 'Confirm ' + formatMoney(p.amountCents) + ' from ' + p.otherName);
        confirm.addEventListener('click', () => paymentAction('POST', '/api/payments/' + p.id + '/confirm'));

        const decline = el('button', 'btn btn-outline-secondary btn-sm', "Didn't get it");
        decline.type = 'button';
        decline.setAttribute('aria-label', 'Decline ' + formatMoney(p.amountCents) + ' from ' + p.otherName);
        decline.addEventListener('click', () => paymentAction('DELETE', '/api/payments/' + p.id));

        actions.append(confirm, decline);
        li.append(left, actions);
        list.appendChild(li);
    });

    outgoing.forEach(p => {
        const li = el('li', 'list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2');
        const left = el('span');
        left.append(
            el('strong', 'd-block', 'You paid ' + p.otherName + ' ' + formatMoney(p.amountCents)),
            el('small', 'd-block text-body-secondary', 'Waiting for ' + p.otherName + ' to confirm · ' + p.circleName + ' · ' + formatShortDate(p.date))
        );

        const cancel = el('button', 'btn btn-outline-secondary btn-sm', 'Cancel');
        cancel.type = 'button';
        cancel.setAttribute('aria-label', 'Cancel payment to ' + p.otherName);
        cancel.addEventListener('click', () => paymentAction('DELETE', '/api/payments/' + p.id));

        li.append(left, cancel);
        list.appendChild(li);
    });
}


// One circle row inside a person: their balance there plus the right buttons
function circleRow(person, c) {
    const row = el('li', 'list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2 px-0');
    const bal = balanceText(c.netCents);

    const left = el('span');
    left.append(
        el('span', 'd-block', c.name),
        el('small', 'd-block fw-semibold ' + bal.cls, bal.text)
    );

    const actions = el('span', 'd-flex flex-wrap gap-2');

    if (c.netCents < 0) {
        // I owe them: pay on Venmo, then tell Tethr
        const url = venmoPayUrl(person.venmoUsername, c.netCents, 'Tethr: ' + c.name);
        if (url) {
            const venmo = el('a', 'btn btn-outline-primary btn-sm', 'Pay on Venmo');
            venmo.href = url;
            venmo.target = '_blank';
            venmo.rel = 'noopener';
            venmo.setAttribute('aria-label', 'Pay ' + person.name + ' ' + formatMoney(c.netCents) + ' on Venmo');
            actions.appendChild(venmo);
        }

        const paid = el('button', 'btn btn-dark btn-sm', 'Mark as paid');
        paid.type = 'button';
        paid.setAttribute('aria-label', 'Mark ' + c.name + ' as paid to ' + person.name);
        paid.addEventListener('click', () => openPaymentModal({
            mode: 'paid', circleId: c.id, userId: person.id, name: person.name, circleName: c.name, maxCents: -c.netCents
        }));
        actions.appendChild(paid);

    } else if (c.netCents > 0) {
        // They owe me: I can say I got paid
        const got = el('button', 'btn btn-outline-dark btn-sm', 'I got paid');
        got.type = 'button';
        got.setAttribute('aria-label', 'Record payment from ' + person.name + ' for ' + c.name);
        got.addEventListener('click', () => openPaymentModal({
            mode: 'received', circleId: c.id, userId: person.id, name: person.name, circleName: c.name, maxCents: c.netCents
        }));
        actions.appendChild(got);
    }

    row.append(left, actions);
    return row;
}


function renderPeople(people) {
    const list = document.getElementById('people-list');
    list.replaceChildren();

    if (people.length === 0) {
        list.appendChild(el('p', 'text-body-secondary fst-italic mb-0', "You're all settled up with everyone."));
        return;
    }

    people.forEach(person => {
        const item = el('div', 'list-group-item');
        const bal = balanceText(person.netCents);
        const panelId = 'person-' + person.id;

        const toggle = el('button', 'btn w-100 d-flex justify-content-between align-items-center gap-3 p-0 text-start border-0');
        toggle.type = 'button';
        toggle.setAttribute('data-bs-toggle', 'collapse');
        toggle.setAttribute('data-bs-target', '#' + panelId);
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', panelId);

        const who = el('span');
        const circleCount = person.circles.length;
        who.append(
            el('strong', 'd-block', person.name),
            el('small', 'd-block text-body-secondary', circleCount + (circleCount === 1 ? ' circle' : ' circles') +
                (person.venmoUsername ? ' · @' + person.venmoUsername : ''))
        );
        toggle.append(who, el('strong', 'text-nowrap ' + bal.cls, bal.text));

        const panel = el('div', 'collapse');
        panel.id = panelId;
        const circles = el('ul', 'list-group list-group-flush mt-2');
        person.circles.forEach(c => circles.appendChild(circleRow(person, c)));
        panel.appendChild(circles);

        item.append(toggle, panel);
        list.appendChild(item);
    });
}


function renderHistory(history) {
    const list = document.getElementById('history-list');
    list.replaceChildren();

    if (history.length === 0) {
        list.appendChild(emptyItem('No activity yet. Add an expense to get started.'));
        return;
    }

    history.forEach(t => {
        const li = el('li', 'list-group-item d-flex justify-content-between gap-3');
        const left = el('span');
        left.append(
            el('strong', 'd-block', t.title),
            el('small', 'd-block text-body-secondary', (t.detail ? t.detail + ' · ' : '') + formatShortDate(t.date))
        );

        const right = el('strong', 'text-nowrap ' + (t.amountCents >= 0 ? 'pos' : 'neg'), formatSigned(t.amountCents));
        right.setAttribute('aria-label', (t.amountCents >= 0 ? 'Plus ' : 'Minus ') + formatMoney(t.amountCents));

        li.append(left, right);
        list.appendChild(li);
    });
}


function render(data) {
    renderTotals(data.totals || {});
    renderPending(data.pending || {});
    renderPeople(data.people || []);
    renderHistory(data.history || []);
}


function showNotice(message) {
    const notice = document.getElementById('notice');
    notice.textContent = message;
    notice.hidden = false;
}


// Load

async function loadBalances() {
    try {
        const res = await fetch('/api/balances', { headers: { Accept: 'application/json' } });
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }
        if (!res.ok) {
            throw new Error('HTTP ' + res.status);
        }

        usingSample = false;
        document.getElementById('notice').hidden = true;
        render(await res.json());

    } catch (err) {
        console.warn('Balances fetch failed, using sample data.');
        usingSample = true;
        render(SAMPLE_DATA);
        showNotice('Showing sample data. The /api/balances endpoint could not be reached.');
    }
}


// Actions

async function sendJSON(method, url, body) {
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });

    let data = {};
    try {
        data = await res.json();
    } catch (e) {
        // response had no JSON body
    }
    return { ok: res.ok, status: res.status, data };
}


// Confirm / decline / cancel a pending payment
async function paymentAction(method, url) {
    if (usingSample) {
        showNotice('This is sample data, so nothing was saved.');
        return;
    }

    try {
        const result = await sendJSON(method, url);
        if (result.status === 401) {
            window.location.href = '/login';
            return;
        }

        await loadBalances();
        showNotice(result.ok ? result.data.message : (result.data.error || 'Something went wrong. Please try again.'));

    } catch (err) {
        showNotice('Could not reach the server. Please try again.');
    }
}


function openPaymentModal(action) {
    pendingAction = action;
    document.getElementById('payment-error').hidden = true;

    const amount = document.getElementById('payment-amount');
    amount.value = centsToInput(action.maxCents);

    if (action.mode === 'paid') {
        document.getElementById('paymentLabel').textContent = 'Mark as Paid';
        document.getElementById('payment-summary').textContent =
            'You paid ' + action.name + ' for ' + action.circleName + '. They will be asked to confirm it.';
        document.getElementById('payment-submit').textContent = 'Mark as paid';
    } else {
        document.getElementById('paymentLabel').textContent = 'Record Payment';
        document.getElementById('payment-summary').textContent =
            action.name + ' paid you for ' + action.circleName + '. This counts right away.';
        document.getElementById('payment-submit').textContent = 'Save payment';
    }
    document.getElementById('payment-help').textContent =
        'Owed: ' + formatMoney(action.maxCents) + '. Change the amount for a partial payment.';

    bootstrap.Modal.getOrCreateInstance(document.getElementById('paymentModal')).show();
}


async function handlePaymentSubmit(event) {
    event.preventDefault();
    const errorBox = document.getElementById('payment-error');
    errorBox.hidden = true;

    if (!pendingAction) {
        return;
    }
    if (usingSample) {
        errorBox.textContent = 'This is sample data, so nothing can be saved.';
        errorBox.hidden = false;
        return;
    }

    const url = pendingAction.mode === 'paid' ? '/api/payments' : '/api/payments/received';

    try {
        const result = await sendJSON('POST', url, {
            circle_id: pendingAction.circleId,
            user_id: pendingAction.userId,
            amount: document.getElementById('payment-amount').value
        });

        if (result.status === 401) {
            window.location.href = '/login';
            return;
        }
        if (!result.ok) {
            errorBox.textContent = result.data.error || 'Something went wrong. Please try again.';
            errorBox.hidden = false;
            return;
        }

        bootstrap.Modal.getOrCreateInstance(document.getElementById('paymentModal')).hide();
        const message = result.data.message;
        pendingAction = null;
        await loadBalances();
        showNotice(message + '.');

    } catch (err) {
        errorBox.textContent = 'Could not reach the server. Please try again.';
        errorBox.hidden = false;
    }
}


function init() {
    document.getElementById('payment-form').addEventListener('submit', handlePaymentSubmit);
    loadBalances();
}


if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { venmoPayUrl, balanceText, formatMoney, formatSigned };
}
