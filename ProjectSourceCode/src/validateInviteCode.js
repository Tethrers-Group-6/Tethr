// Pure function: no HTTP, no database. That is what makes it unit-testable.
// An invite code is valid if it is a non-empty string of at most 20 characters
// (circles.invite_code is VARCHAR(20) in create.sql).
function validateInviteCode(code) {
  return (
    typeof code === 'string' &&
    code.trim().length > 0 &&
    code.trim().length <= 20
  );
}

module.exports = validateInviteCode;
