// UNIT test: calls one function directly. No HTTP, no database.
const { expect } = require('chai');
const validateProfileUpdate = require('../src/validateProfileUpdate');

describe('validateProfileUpdate (unit)', () => {
  describe('valid input', () => {
    it('accepts a name and a Venmo username, and trims spaces', () => {
      const result = validateProfileUpdate({ display_name: '  Pearl Lee  ', venmo_username: ' pearl-lee ' });

      expect(result.valid).to.equal(true);
      expect(result.error).to.equal(null);
      expect(result.cleaned).to.deep.equal({ display_name: 'Pearl Lee', venmo_username: 'pearl-lee' });
    });

    it('drops one leading @ from the Venmo username', () => {
      const result = validateProfileUpdate({ display_name: 'Pearl', venmo_username: '@pearl_lee' });

      expect(result.valid).to.equal(true);
      expect(result.cleaned.venmo_username).to.equal('pearl_lee');
    });

    it('treats a blank or missing Venmo username as "remove it" (null)', () => {
      expect(validateProfileUpdate({ display_name: 'Pearl', venmo_username: '   ' }).cleaned.venmo_username).to.equal(null);
      expect(validateProfileUpdate({ display_name: 'Pearl' }).cleaned.venmo_username).to.equal(null);
      expect(validateProfileUpdate({ display_name: 'Pearl', venmo_username: null }).cleaned.venmo_username).to.equal(null);
    });

    it('accepts a display name of exactly 100 characters (the VARCHAR(100) limit)', () => {
      expect(validateProfileUpdate({ display_name: 'A'.repeat(100) }).valid).to.equal(true);
    });
  });

  describe('invalid input', () => {
    it('rejects a missing, empty or whitespace-only display name', () => {
      for (const name of [undefined, '', '    ']) {
        const result = validateProfileUpdate({ display_name: name });
        expect(result.valid).to.equal(false);
        expect(result.error).to.equal('Display name is required');
        expect(result.cleaned).to.equal(null);
      }
    });

    it('rejects a display name longer than 100 characters', () => {
      const result = validateProfileUpdate({ display_name: 'A'.repeat(101) });

      expect(result.valid).to.equal(false);
      expect(result.error).to.equal('Display name must be 100 characters or fewer');
    });

    it('rejects a Venmo username with spaces or symbols', () => {
      expect(validateProfileUpdate({ display_name: 'Pearl', venmo_username: 'pearl lee' }).valid).to.equal(false);
      expect(validateProfileUpdate({ display_name: 'Pearl', venmo_username: 'pearl!lee' }).valid).to.equal(false);
      expect(validateProfileUpdate({ display_name: 'Pearl', venmo_username: '@@pearl' }).valid).to.equal(false);
    });

    it('rejects a Venmo username shorter than 5 or longer than 30 characters', () => {
      expect(validateProfileUpdate({ display_name: 'Pearl', venmo_username: 'abcd' }).valid).to.equal(false);
      expect(validateProfileUpdate({ display_name: 'Pearl', venmo_username: 'a'.repeat(31) }).valid).to.equal(false);
      expect(validateProfileUpdate({ display_name: 'Pearl', venmo_username: 'a'.repeat(30) }).valid).to.equal(true);
    });

    it('rejects input that is not an object, or fields that are not text', () => {
      expect(validateProfileUpdate(undefined).valid).to.equal(false);
      expect(validateProfileUpdate(null).valid).to.equal(false);
      expect(validateProfileUpdate('Pearl').valid).to.equal(false);
      expect(validateProfileUpdate({ display_name: 12345 }).valid).to.equal(false);
      expect(validateProfileUpdate({ display_name: 'Pearl', venmo_username: 12345 }).valid).to.equal(false);
    });
  });
});
