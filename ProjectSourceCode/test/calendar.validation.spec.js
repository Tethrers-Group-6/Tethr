const {expect} = require('chai');
const {validateEvent, validateRange, validateRsvp, isRealDate, toId} = require('../src/validateEvent');

const valid = {
  circleId: 1, title: 'Dinner', date: '2026-10-30', startTime: '19:00', endTime: '20:00', location: 'Sushi Zanmai',
};

describe('Calendar validation (unit)', () => {
  describe('validateEvent', () => {
    it('accepts a complete event and returns clean values', () => {
      const r = validateEvent({...valid, circleId: '3', title: '  Dinner  ', location: '   '});
      expect(r.valid).to.equal(true);
      expect(r.value).to.deep.equal({
        circleId: 3, title: 'Dinner', date: '2026-10-30', startTime: '19:00', endTime: '20:00', location: null,
      });
    });

    it('rejects a missing title', () => {
      const r = validateEvent({...valid, title: '   '});
      expect(r.valid).to.equal(false);
      expect(r.errors).to.include('Event name is required (150 characters max).');
    });

    it('rejects an end time that is not after the start time', () => {
      expect(validateEvent({...valid, startTime: '20:00', endTime: '19:00'}).valid).to.equal(false);
      expect(validateEvent({...valid, startTime: '19:00', endTime: '19:00'}).valid).to.equal(false);
    });

    it('rejects impossible dates and malformed times', () => {
      expect(validateEvent({...valid, date: '2026-02-30'}).valid).to.equal(false);
      expect(validateEvent({...valid, date: '10/30/2026'}).valid).to.equal(false);
      expect(validateEvent({...valid, startTime: '7pm'}).valid).to.equal(false);
      expect(validateEvent({...valid, endTime: '25:00'}).valid).to.equal(false);
    });

    it('rejects group ids that are not positive whole numbers', () => {
      [undefined, null, 0, -1, 1.5, true, [1], '1abc', ''].forEach((circleId) => {
        expect(validateEvent({...valid, circleId}).valid, String(circleId)).to.equal(false);
      });
    });

    it('enforces length limits and handles a missing body', () => {
      expect(validateEvent({...valid, title: 'x'.repeat(151)}).valid).to.equal(false);
      expect(validateEvent({...valid, location: 'x'.repeat(201)}).valid).to.equal(false);
      expect(validateEvent(undefined).valid).to.equal(false);
    });

    it('reports every problem at once', () => {
      expect(validateEvent({}).errors).to.have.length.above(3);
    });
  });

  describe('validateRange', () => {
    it('accepts a normal month-sized range', () => {
      const r = validateRange({from: '2026-09-27', to: '2026-10-31'});
      expect(r).to.deep.equal({valid: true, value: {from: '2026-09-27', to: '2026-10-31'}});
    });

    it('rejects missing, malformed, reversed and oversized ranges', () => {
      [
        {}, {from: '2026-10-01'}, {from: 'bad', to: '2026-10-31'}, {from: '2026-02-30', to: '2026-03-05'},
        {from: '2026-10-31', to: '2026-10-01'}, {from: '2026-01-01', to: '2026-12-31'},
        {from: ['2026-10-01', '2026-10-02'], to: '2026-10-31'},
      ].forEach((q) => expect(validateRange(q).valid, JSON.stringify(q)).to.equal(false));
      expect(validateRange(undefined).valid).to.equal(false);
    });
  });

  describe('validateRsvp', () => {
    it('accepts going, maybe and no with a numeric id', () => {
      ['going', 'maybe', 'no'].forEach((status) => {
        expect(validateRsvp('7', status)).to.deep.equal({valid: true, value: {eventId: 7, status}});
      });
    });

    it('rejects unknown statuses and bad ids', () => {
      expect(validateRsvp('7', 'yes').valid).to.equal(false);
      expect(validateRsvp('7', undefined).valid).to.equal(false);
      expect(validateRsvp('abc', 'going').valid).to.equal(false);
      expect(validateRsvp('0', 'going').valid).to.equal(false);
    });
  });

  describe('helpers', () => {
    it('isRealDate understands leap years', () => {
      expect(isRealDate('2028-02-29')).to.equal(true);
      expect(isRealDate('2026-02-29')).to.equal(false);
      expect(isRealDate(20261030)).to.equal(false);
    });

    it('toId only accepts positive whole numbers', () => {
      expect(toId(7)).to.equal(7);
      expect(toId('7')).to.equal(7);
      expect(Number.isNaN(toId('7.5'))).to.equal(true);
    });
  });
});