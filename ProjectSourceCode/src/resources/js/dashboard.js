const MAX_RECENT = 5;
const MAX_UPCOMING = 5;
const TOP_CIRCLES = 2;


// helpers

function toISODate(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
}


// Returns date offset by n days from today, only used for sample data
function offsetDate(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return toISODate(d);
}


// Parse date as local date
function parseLocalDate(str) {
    const [y, m, d] = String(str).split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatMoney(cents) {
    const abs = Math.abs(Math.round(cents)) / 100;
    return '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Signed numbers for activity
function formatSigned(cents) {
    if (cents === 0) {
        return '$0.00';
    }

    return (cents > 0 ? '+' : '-') + formatMoney(cents);
}

function formatShortDate(str) {
    return parseLocalDate(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric'});
}


function el(tag, className, text) {
    const node = document.createElement(tag);
    if(className) {
        node.className = className;
    }

    if(text !== undefined) {
        node.textContent = text;
    }

    return node;
}


function emptyItem(message) {
    return el('li', 'list-group-item text-body-secondary fst-italic', message);
}



// Sample Data

const SAMPLE_DATA = {
  user: { name: 'Jane Doe' },
  totals: { oweCents: 8450, owedCents: 12700 },
  transactions: [
    { id: 1, title: 'Dinner at Chipotle', detail: 'Emma added an expense · Roommates', amountCents: -1450, date: offsetDate(-1) },
    { id: 2, title: 'Weekly groceries', detail: 'You paid · Apartment 204', amountCents: 4200, date: offsetDate(-2) },
    { id: 3, title: 'Uber to airport', detail: 'Julia added an expense · Spring Break', amountCents: -1125, date: offsetDate(-3) },
    { id: 4, title: 'Sophie paid you', detail: 'Payment confirmed · Friday Night', amountCents: 2000, date: offsetDate(-4) },
    { id: 5, title: 'Internet bill', detail: 'Recurring · Roommates', amountCents: -1500, date: offsetDate(-5) },
    { id: 6, title: 'Concert tickets', detail: 'You paid · Friday Night', amountCents: 3600, date: offsetDate(-9) }
  ],
  events: [
    { id: 1, title: "Sophie's Birthday", circleName: 'Friday Night Group', date: offsetDate(3), kind: 'event' },
    { id: 2, title: 'Rent due', circleName: 'Apartment 204', date: offsetDate(6), kind: 'bill' },
    { id: 3, title: 'Ski trip deposit', circleName: 'Spring Break Trip', date: offsetDate(12), kind: 'event' }
  ],
  circles: [
    { id: 1, name: 'Apartment Roommates', memberCount: 4, balanceCents: -3200 },
    { id: 2, name: 'Friday Night Group', memberCount: 8, balanceCents: 4500 },
    { id: 3, name: 'Spring Break Trip', memberCount: 6, balanceCents: 0 },
    { id: 4, name: 'CSCI 3308 Team 6', memberCount: 6, balanceCents: 800 }
  ]
};


// Data Selection

function selectRecent(transactions) {
    return [...transactions]
        .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date))
        .slice(0, MAX_RECENT);
}


function selectUpcoming(events, today = new Date()) {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return events
        .filter(e => parseLocalDate(e.date) >= start)
        .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date))
        .slice(0, MAX_UPCOMING);
}


// Top circles, which are the two with largest balance
function selectTopCircles(circles) {
    return [...circles]
        .sort((a, b) => Math.abs(b.balanceCents) - Math.abs(a.balanceCents))
        .slice(0, TOP_CIRCLES);
}


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


function renderRecent(transactions) {
    const list = document.getElementById('recent-list');
    list.replaceChildren();
    const items = selectRecent(transactions);

    if (items.length === 0) {
        list.appendChild(emptyItem('No transactions yet. Add an expense to get started.'));
        return;
    }

    items.forEach(t => {
        const li = el('li', 'list-group-item d-flex justify-content-between gap-3');
        const left = el('span');
        left.append(
            el('strong', 'd-block', t.title),
            el('small', 'd-block text-body-secondary', (t.detail ? t.detail + ' \u00b7 ' : '') + formatShortDate(t.date))
        );

        const right = el('strong', 'text-nowrap ' + (t.amountCents >= 0 ? 'pos' : 'neg'), formatSigned(t.amountCents));
        right.setAttribute('aria-label', (t.amountCents >= 0 ? 'Plus ' : 'Minus ') + formatMoney(t.amountCents));

        li.append(left, right);
        list.appendChild(li);
    });
}

function renderUpcoming(events) {
    const list = document.getElementById('upcoming-list');
    list.replaceChildren();
    const items = selectUpcoming(events);

    if (items.length === 0) {
        list.appendChild(emptyItem('Nothing coming up.'));
        return;
    }

    items.forEach(e => {
        const li = el('li', 'list-group-item d-flex align-items-center gap-3');
        const when = el('time', 'date-chip', formatShortDate(e.date));
        when.dateTime = e.date;
        const body = el('span');

        body.append(
            el('strong', 'd-block', e.title),
            el('small', 'd-block text-body-secondary', (e.kind === 'bill' ? 'Bill \u00b7 ' : 'Event \u00b7 ') + e.circleName)
        );

        li.append(when, body);
        list.appendChild(li);
    });
}


function circleBalanceText(cents) {
    if (cents > 0) {
        return { text: 'Owed ' + formatMoney(cents), cls: 'pos' };
    }

    if (cents < 0) {
        return { text: 'You owe ' + formatMoney(cents), cls: 'neg' };
    }

    return {text: 'Settled', cls: ''}
}


function renderCircles(circles) {
    const list = document.getElementById('circles-list');
    list.replaceChildren();
    const items = selectTopCircles(circles);

    if (items.length === 0) {
        const li = el('div', 'col-12');
        const card = el('article', 'border rounded p-3');
        const create = el('button', 'btn btn-primary btn-sm me-2', '+ New Circle');
        create.type = 'button';
        create.setAttribute('data-bs-toggle', 'modal');
        create.setAttribute('data-bs-target', '#newCircleModal');
        const join = el('button', 'btn btn-outline-primary btn-sm', 'Join with Code');
        join.type = 'button';
        join.setAttribute('data-bs-toggle', 'modal');
        join.setAttribute('data-bs-target', '#joinCircleModal');
        const actions = el('p', 'mb-0');
        actions.append(create, join);
        card.append(el('p', 'text-body-secondary fst-italic', 'You are not in any circles yet.'), actions);
        li.appendChild(card);
        list.appendChild(li);
        
        return;
    }

    items.forEach(c => {
        const li = el('div', 'col-md-6');
        const card = el('article', 'border rounded h-100 p-3');
        const bal = circleBalanceText(c.balanceCents);

        const open = el('a', 'btn btn-outline-primary btn-sm align-self-start', 'Open');
        open.href = '/circles/' + encodeURIComponent(c.id);
        open.setAttribute('aria-label', 'Open ' + c.name);

        card.append(
            el('h3', 'h5 mb-0', c.name),
            el('p', 'small text-body-secondary mb-0', c.memberCount + ' members'),
            el('p', 'fw-bold my-2 ' + bal.cls, bal.text),
            open
        );
        li.appendChild(card);
        list.appendChild(li);
    });
}


function render(data, usingSample) {
    const name = data.user && data.user.name ? data.user.name : '';
    document.getElementById('welcome').textContent = name? 'Welcome back, ' + name : 'Welcome back';

    const notice = document.getElementById('notice');
    if (usingSample) {
        notice.textContent = 'Showing sample data. The /api/dashboard endpoint could not be reached.';
        notice.hidden = false;

    } else {
        notice.hidden = true;
    }

    renderTotals(data.totals || {});
    renderRecent(data.transactions || []);
    renderUpcoming(data.events || []);
    renderCircles(data.circles || []);
}


// Load

async function loadDashboard() {
    try {
        const res = await fetch('/api/dashboard', { headers: { Accept: 'application/json'} });
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!res.ok) {
            throw new Error('HTTP ' + res.status);
        }

        render(await res.json(), false);

    } catch (err) {
        console.warn('Dashboard fetch failed, using sample data.');
        render(SAMPLE_DATA, true);
    }
}


function showNotice(message) {
    const notice = document.getElementById('notice');
    notice.textContent = message;
    notice.hidden = false;
}


// Forms

async function postJSON(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body)
    });

    let data = {};
    try {
        data = await res.json();
    } catch (e) {
        // response had no JSON body
    }

    return { ok: res.ok, status: res.status, data: data };
}


function closeModal(id) {
    const modal = bootstrap.Modal.getInstance(document.getElementById(id));
    if (modal) {
        modal.hide();
    }
}


function showFormError(id, message) {
    const box = document.getElementById(id);
    box.textContent = message;
    box.hidden = false;
}


// Shared by both forms: run the POST, then either show the error or finish
async function submitForm(event, { url, body, errorId, inputId, modalId, successMessage }) {
    event.preventDefault();
    document.getElementById(errorId).hidden = true;

    try {
        const result = await postJSON(url, body());

        if (result.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!result.ok) {
            showFormError(errorId, result.data.error || 'Something went wrong. Please try again.');
            return;
        }

        document.getElementById(inputId).value = '';
        closeModal(modalId);
        await loadDashboard();
        showNotice(successMessage(result.data));

    } catch (err) {
        showFormError(errorId, 'Could not reach the server. Please try again.');
    }
}


function handleJoin(event) {
    return submitForm(event, {
        url: '/api/circles/join',
        body: () => ({ invite_code: document.getElementById('invite-code').value }),
        errorId: 'join-error',
        inputId: 'invite-code',
        modalId: 'joinCircleModal',
        successMessage: data => 'Joined ' + data.circle.name + '!'
    });
}


function handleCreate(event) {
    return submitForm(event, {
        url: '/api/circles',
        body: () => ({ name: document.getElementById('circle-name').value }),
        errorId: 'new-error',
        inputId: 'circle-name',
        modalId: 'newCircleModal',
        successMessage: data => 'Created ' + data.circle.name + '. Invite code: ' + data.circle.inviteCode
    });
}


function init() {
    document.getElementById('join-circle-form').addEventListener('submit', handleJoin);
    document.getElementById('new-circle-form').addEventListener('submit', handleCreate);
 
    // Clear any old error whenever a modal is opened again
    document.getElementById('joinCircleModal').addEventListener('show.bs.modal', () => {
        document.getElementById('join-error').hidden = true;
    });
    document.getElementById('newCircleModal').addEventListener('show.bs.modal', () => {
        document.getElementById('new-error').hidden = true;
    });
 
    loadDashboard();
}


if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', loadDashboard);
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = { selectRecent, selectUpcoming, selectTopCircles, formatMoney, formatSigned };
}