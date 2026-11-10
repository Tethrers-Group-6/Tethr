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


// Sample Data (shown only if /api/circles cannot be reached)

const SAMPLE_DATA = {
    circles: [
        { id: 1, name: 'Apartment Roommates', inviteCode: 'TETH-AB12CD', role: 'admin', memberCount: 4, expenseCount: 3 },
        { id: 2, name: 'Friday Night Group', inviteCode: 'TETH-9F3E21', role: 'member', memberCount: 8, expenseCount: 1 },
        { id: 3, name: 'CSCI 3308 Team 6', inviteCode: 'TETH-77C0DE', role: 'member', memberCount: 6, expenseCount: 0 }
    ]
};


// Page state: the full list from the server. Search filters a copy, never this.
let allCircles = [];


// Data Selection (pure function, no DOM, so it can be unit tested)

function filterCircles(circles, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) {
        return circles;
    }

    return circles.filter(c => c.name.toLowerCase().includes(q));
}


// Rendering

function showNotice(message) {
    const notice = document.getElementById('notice');
    notice.textContent = message;
    notice.hidden = false;
}


function hideNotice() {
    document.getElementById('notice').hidden = true;
}


function renderCircles() {
    const list = document.getElementById('circles-list');
    list.replaceChildren();

    if (allCircles.length === 0) {
        const col = el('div', 'col-12');
        const card = el('article', 'border rounded p-3 text-center');
        card.id = 'circles-empty';
        card.appendChild(el('p', 'mb-0', "You're not in any circles yet. Create one or join with an invite code."));
        col.appendChild(card);
        list.appendChild(col);
        return;
    }

    const items = filterCircles(allCircles, document.getElementById('circle-search').value);

    if (items.length === 0) {
        const col = el('div', 'col-12');
        col.appendChild(el('p', 'text-body-secondary fst-italic', 'No circles match your search.'));
        list.appendChild(col);
        return;
    }

    items.forEach(c => {
        const col = el('div', 'col-md-6');
        const card = el('article', 'border rounded h-100 p-3 bg-white');

        const code = el('span', 'font-monospace', c.inviteCode);
        const codeLine = el('p', 'small text-body-secondary mb-2');
        codeLine.append('Invite code: ', code);

        const open = el('a', 'btn btn-outline-dark btn-sm', 'Open');
        open.href = '/circles/' + encodeURIComponent(c.id);
        open.setAttribute('aria-label', 'Open ' + c.name);

        card.append(
            el('h2', 'h5 mb-0', c.name),
            el('p', 'small text-body-secondary mb-1',
                c.memberCount + (c.memberCount === 1 ? ' member' : ' members') +
                ' · ' + c.expenseCount + (c.expenseCount === 1 ? ' expense' : ' expenses')),
            codeLine,
            open
        );

        col.appendChild(card);
        list.appendChild(col);
    });
}


// Load

async function loadCircles() {
    try {
        const res = await fetch('/api/circles', { headers: { Accept: 'application/json' } });
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!res.ok) {
            throw new Error('HTTP ' + res.status);
        }

        const data = await res.json();
        allCircles = data.circles || [];
        renderCircles();

    } catch (err) {
        console.warn('Circles fetch failed, using sample data.');
        allCircles = SAMPLE_DATA.circles;
        showNotice('Showing sample data. The /api/circles endpoint could not be reached.');
        renderCircles();
    }
}


// Forms

// POST a JSON body. Returns { ok, status, data } for any HTTP status instead of throwing,
// because 400/404/409 are expected outcomes the UI needs to show to the user.
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
        showNotice(successMessage(result.data));
        await loadCircles();

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
    document.getElementById('circle-search').addEventListener('input', renderCircles);

    // Clear any old error whenever a modal is opened again
    document.getElementById('joinCircleModal').addEventListener('show.bs.modal', () => {
        document.getElementById('join-error').hidden = true;
    });
    document.getElementById('newCircleModal').addEventListener('show.bs.modal', () => {
        document.getElementById('new-error').hidden = true;
    });

    loadCircles();
}


if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = { filterCircles };
}
