const { expect } = require('chai');
const validateRegistration = require('../src/validateRegistration');

describe('validateRegistration (unit)', () => {
  it('rejects a missing password', () => {
    const result = validateRegistration({ display_name: 'Test User', email: 'test@colorado.edu' });
    expect(result.valid).to.equal(false); // I expect result.valid to equal false
    expect(result.error).to.equal('Password must be at least 8 characters');
  });
});