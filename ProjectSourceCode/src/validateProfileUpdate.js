// Pure function: no HTTP, no database. That is what makes it unit-testable.
//
// Checks the fields a user can edit on their profile and returns a cleaned copy.
//   display_name   required; 1-100 characters after trimming (users.display_name is VARCHAR(100))
//   venmo_username optional; blank means "remove it". One leading @ is dropped, since people
//                  often type it. Otherwise 5-30 characters: letters, numbers, - and _ only
//                  (Venmo's own username rules).
//
// Returns { valid: true,  error: null, cleaned: { display_name, venmo_username } }
//      or { valid: false, error: '<message to show the user>', cleaned: null }

const VENMO_PATTERN = /^[A-Za-z0-9_-]{5,30}$/;

function invalid(error) {
  return { valid: false, error, cleaned: null };
}

function validateProfileUpdate(input) {
  if (!input || typeof input !== 'object') {
    return invalid('Invalid input');
  }

  // Display name
  if (typeof input.display_name !== 'string' || input.display_name.trim().length === 0) {
    return invalid('Display name is required');
  }
  const displayName = input.display_name.trim();
  if (displayName.length > 100) {
    return invalid('Display name must be 100 characters or fewer');
  }

  // Venmo username (optional)
  let venmo = input.venmo_username;
  if (venmo === undefined || venmo === null) {
    venmo = '';
  }
  if (typeof venmo !== 'string') {
    return invalid('Venmo username must be text');
  }
  venmo = venmo.trim().replace(/^@/, '');

  if (venmo !== '' && !VENMO_PATTERN.test(venmo)) {
    return invalid('Venmo username must be 5-30 letters, numbers, - or _ (no spaces)');
  }

  return {
    valid: true,
    error: null,
    cleaned: {
      display_name: displayName,
      venmo_username: venmo === '' ? null : venmo
    }
  };
}

module.exports = validateProfileUpdate;
