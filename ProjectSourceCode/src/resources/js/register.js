document.getElementById('register-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const box = document.getElementById('form-error');
    box.hidden = true;

    try {
        const res = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                display_name: document.getElementById('display-name').value,
                email: document.getElementById('email').value,
                password: document.getElementById('password').value
            })
        });

        let data = {};
        try {
            data = await res.json();
        } catch (e) {
            // response had no JSON body
        }

        if (!res.ok) {
            box.textContent = data.error || 'Something went wrong. Please try again.';
            box.hidden = false;
            return;
        }
        window.location.href = '/login';
    } catch (err) {
        box.textContent = 'Could not reach the server. Please try again.';
        box.hidden = false;
    }
});