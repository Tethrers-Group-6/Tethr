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


// Turn what the user typed into the JSON the server expects.
// The amount stays TEXT ("92.40"): the server converts it to cents, never the browser.
function buildPayload(values) {
    const payload = {
        circleId: Number(values.circleId),
        name: String(values.name || '').trim(),
        amount: String(values.amount || '').replace(/[$,\s]/g, ''),
        participantIds: (values.participantIds || []).map(Number)
    };

    if (values.expenseDate) {
        payload.expenseDate = values.expenseDate;
    }

    const note = String(values.note || '').trim();
    if (note) {
        payload.note = note;
    }

    return payload;
}


// Page state

let myId = null;
let membersById = {};


// Rendering

function showNotice(message) {
    const notice = document.getElementById('notice');
    notice.textContent = message;
    notice.hidden = false;
}


function showError(message) {
    const box = document.getElementById('form-error');
    box.textContent = message;
    box.hidden = false;
}


function clearMessages() {
    document.getElementById('notice').hidden = true;
    document.getElementById('form-error').hidden = true;
    document.getElementById('result').hidden = true;
}


function todayLocalISO() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + month + '-' + day;
}


function renderParticipants(members) {
    const box = document.getElementById('participants');
    box.replaceChildren();

    members.forEach(m => {
        const isMe = m.id === myId;
        const row = el('div', 'form-check');

        const input = el('input', 'form-check-input');
        input.type = 'checkbox';
        input.id = 'member-' + m.id;
        input.value = m.id;
        input.checked = true;
        input.disabled = isMe;

        const label = el('label', 'form-check-label', isMe ? m.name + ' (you)' : m.name);
        label.htmlFor = input.id;

        row.append(input, label);
        box.appendChild(row);
    });
}


function renderResult(expense, circleId) {
    document.getElementById('result-title').textContent =
        'Added ' + expense.name + ' (' + formatCents(expense.totalCents) + ')';

    const list = document.getElementById('result-splits');
    list.replaceChildren();
    expense.splits.forEach(s => {
        const person = membersById[s.userId];
        const name = s.userId === myId ? 'You' : (person ? person.name : 'Member ' + s.userId);
        list.appendChild(el('li', '', name + ': ' + formatCents(s.amountCents)));
    });

    document.getElementById('result-link').href = '/circles/' + encodeURIComponent(circleId);
    document.getElementById('result').hidden = false;
}


// Load

// Redirects to /login and returns null on 401, so callers can just stop
async function getJSON(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 401) {
        window.location.href = '/login';
        return null;
    }

    if (!res.ok) {
        throw new Error('HTTP ' + res.status);
    }

    return res.json();
}


async function loadMembers(circleId) {
    try {
        const data = await getJSON('/api/circles/' + encodeURIComponent(circleId));
        if (!data) {
            return;
        }

        myId = data.me.id;
        membersById = {};
        data.members.forEach(m => { membersById[m.id] = m; });
        renderParticipants(data.members);

    } catch (err) {
        showError('Could not load the members of that circle.');
    }
}


async function loadCircles() {
    try {
        const data = await getJSON('/api/circles');
        if (!data) {
            return;
        }

        const select = document.getElementById('circle');
        select.replaceChildren();

        if (data.circles.length === 0) {
            showNotice('You are not in any circles yet. Create or join one first.');
            document.getElementById('submit-btn').disabled = true;
            return;
        }

        data.circles.forEach(c => {
            const option = el('option', '', c.name);
            option.value = c.id;
            select.appendChild(option);
        });

        // /expenses?circle=3 preselects that circle (used by the circle page's button)
        const wanted = new URLSearchParams(window.location.search).get('circle');
        if (wanted && data.circles.some(c => String(c.id) === wanted)) {
            select.value = wanted;
        }

        await loadMembers(select.value);

    } catch (err) {
        showError('Could not load your circles. Please refresh the page.');
    }
}


// Submit

function readForm() {
    const checked = document.querySelectorAll('#participants input:checked');
    return {
        circleId: document.getElementById('circle').value,
        name: document.getElementById('name').value,
        amount: document.getElementById('amount').value,
        expenseDate: document.getElementById('expense-date').value,
        note: document.getElementById('note').value,
        participantIds: Array.from(checked).map(box => box.value)
    };
}


async function handleSubmit(event) {
    event.preventDefault();
    clearMessages();

    const payload = buildPayload(readForm());

    if (payload.participantIds.length < 2) {
        showError('Pick at least one other person to split with.');
        return;
    }

    const button = document.getElementById('submit-btn');
    button.disabled = true;

    try {
        const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }

        let data = {};
        try {
            data = await res.json();
        } catch (e) {
            // response had no JSON body
        }

        if (!res.ok) {
            showError(data.error || 'Something went wrong. Please try again.');
            return;
        }

        renderResult(data.expense, payload.circleId);
        document.getElementById('name').value = '';
        document.getElementById('amount').value = '';
        document.getElementById('note').value = '';

    } catch (err) {
        showError('Could not reach the server. Please try again.');

    } finally {
        button.disabled = false;
    }
}


function init() {
    document.getElementById('expense-date').value = todayLocalISO();
    document.getElementById('expense-form').addEventListener('submit', handleSubmit);
    document.getElementById('circle').addEventListener('change', event => {
        clearMessages();
        loadMembers(event.target.value);
    });

    loadCircles();
}


if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = { formatCents, buildPayload };
}