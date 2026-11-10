// UNIT test: calls one function directly. No HTTP, no database.
const { expect } = require('chai');
const validateInviteCode = require('../src/validateInviteCode');

describe('validateInviteCode (unit)', () => {
  it('accepts a normal invite code', () => {
    expect(validateInviteCode('TETH-204')).to.equal(true);
  });

  it('accepts a code that is exactly 20 characters (the VARCHAR(20) limit)', () => {
    expect(validateInviteCode('A'.repeat(20))).to.equal(true);
  });

  it('rejects a code longer than 20 characters', () => {
    expect(validateInviteCode('A'.repeat(21))).to.equal(false);
  });

  it('rejects an empty or whitespace-only code', () => {
    expect(validateInviteCode('')).to.equal(false);
    expect(validateInviteCode('   ')).to.equal(false);
  });

  it('rejects a missing code or a non-string value', () => {
    expect(validateInviteCode(undefined)).to.equal(false);
    expect(validateInviteCode(null)).to.equal(false);
    expect(validateInviteCode(12345)).to.equal(false);
    expect(validateInviteCode({})).to.equal(false);
  });
});
