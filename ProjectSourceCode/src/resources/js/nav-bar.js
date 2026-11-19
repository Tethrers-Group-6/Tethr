// Shared navbar behavior. Include on any page that has the navbar:
//   <script src="../resources/js/nav.js"></script>

// Ends the session on the server, then goes to the login page.
async function logout() {
    try {
        await fetch('/logout', { method: 'POST', headers: { Accept: 'application/json' } });
    } catch (err) {
        // Even if the request fails, send the person to the login page
    }

    window.location.href = '/login';
}


function initNav() {
    const button = document.getElementById('logout-button');
    if (button) {
        button.addEventListener('click', logout);
    }
}


if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initNav);
}