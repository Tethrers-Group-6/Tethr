const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; //Need to add actual email,
                                                    // and check for valid email & domain

function invalid(error) { return { valid: false, error, cleaned: null }; }

function validateRegistration(input) {
    if (!input || typeof input !== 'object') {
        return invalid('Invalid input');
    }

    const display_name = typeof input.display_name === 'string' ? input.display_name.trim() : '';
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';

    if (!display_name) return invalid('Display name is required');
    if (display_name.length > 100) return invalid('Display name must be 100 characters or fewer');
    if (!EMAIL_PATTERN.test(email)) return invalid('A valid email is required');
    if (password.length < 8) return invalid('Password must be at least 8 characters');
    if (password.length > 20) return invalid('Password must be 20 characters or fewer');

    //NOTE: Need to add feature of password not containing name, personal info (birthday, etc.)
    // NOTE: What if there is additional fields in the inputted object, check for no additional fields


    return { valid: true, error: null, cleaned: { display_name, email, password } };
}

module.exports = validateRegistration;

