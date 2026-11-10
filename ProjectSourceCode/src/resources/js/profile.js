// Sample Data (shown only if /api/profile cannot be reached)

const SAMPLE_PROFILE = {
    id: 1,
    displayName: 'Sample User',
    email: 'sample@colorado.edu',
    venmoUsername: 'sample-user',
    memberSince: '2026-09-01T00:00:00.000Z',
    circleCount: 3
};


// Page state: the last profile the server sent. Cancel restores the form from this.
let currentProfile = null;


// Formatting (pure functions, no DOM, so they can be unit tested)

function initialsFor(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return '?';
    }
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
}


function formatMemberSince(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}


// Rendering

function showNotice(message) {
    const notice = document.getElementById('notice');
    notice.textContent = message;
    notice.hidden = false;
}


function showFormError(message) {
    const box = document.getElementById('form-error');
    box.textContent = message;
    box.hidden = false;
}


function renderProfile(profile) {
    document.getElementById('profile-initials').textContent = initialsFor(profile.displayName);
    document.getElementById('profile-name').textContent = profile.displayName;
    document.getElementById('profile-email').textContent = profile.email;
    document.getElementById('profile-circles').textContent = String(profile.circleCount);
    document.getElementById('profile-since').textContent = formatMemberSince(profile.memberSince);

    const venmo = document.getElementById('profile-venmo');
    venmo.replaceChildren();
    if (profile.venmoUsername) {
        const link = document.createElement('a');
        link.href = 'https://venmo.com/u/' + encodeURIComponent(profile.venmoUsername);
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = '@' + profile.venmoUsername;
        venmo.className = 'col-7';
        venmo.appendChild(link);
    } else {
        venmo.className = 'col-7 text-body-secondary fst-italic';
        venmo.textContent = 'Not added yet';
    }

    fillForm(profile);
}


function fillForm(profile) {
    document.getElementById('display-name').value = profile.displayName;
    document.getElementById('venmo-username').value = profile.venmoUsername || '';
    document.getElementById('email').value = profile.email;
}


// Load

async function loadProfile() {
    try {
        const res = await fetch('/api/profile', { headers: { Accept: 'application/json' } });
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!res.ok) {
            throw new Error('HTTP ' + res.status);
        }

        const data = await res.json();
        currentProfile = data.profile;
        renderProfile(currentProfile);

    } catch (err) {
        console.warn('Profile fetch failed, using sample data.');
        currentProfile = SAMPLE_PROFILE;
        showNotice('Showing sample data. The /api/profile endpoint could not be reached.');
        renderProfile(currentProfile);
    }
}


// Save

async function handleSave(event) {
    event.preventDefault();
    document.getElementById('form-error').hidden = true;
    document.getElementById('notice').hidden = true;

    const saveButton = document.getElementById('save-button');
    saveButton.disabled = true;

    try {
        const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                display_name: document.getElementById('display-name').value,
                venmo_username: document.getElementById('venmo-username').value
            })
        });

        let data = {};
        try {
            data = await res.json();
        } catch (e) {
            // response had no JSON body
        }

        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!res.ok) {
            showFormError(data.error || 'Something went wrong. Please try again.');
            return;
        }

        currentProfile = data.profile;
        renderProfile(currentProfile);
        showNotice('Profile saved.');

    } catch (err) {
        showFormError('Could not reach the server. Please try again.');
    } finally {
        saveButton.disabled = false;
    }
}


function handleReset() {
    document.getElementById('form-error').hidden = true;
    if (currentProfile) {
        fillForm(currentProfile);
    }
}


function init() {
    document.getElementById('profile-form').addEventListener('submit', handleSave);
    document.getElementById('reset-button').addEventListener('click', handleReset);
    loadProfile();
}


if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initialsFor, formatMemberSince };
}
