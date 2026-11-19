// UNIT tests for the Balances page logic: no HTTP, no database.
//   summarizeBalances  (src/summarizeBalances.js)  builds the People view and totals
//   validatePayment    (src/validatePayment.js)    checks a "record a payment" request
//   venmoPayUrl        (src/resources/js/balances.js) builds the "Pay on Venmo" link
const { expect } = require('chai');
const summarizeBalances = require('../src/summarizeBalances');
const validatePayment = require('../src/validatePayment');
const { venmoPayUrl } = require('../src/resources/js/balances');

describe('summarizeBalances (unit)', () => {
  const row = (userId, circleId, cents, extra = {}) => ({
    userId,
    name: `User ${userId}`,
    venmoUsername: null,
    circleId,
    circleName: `Circle ${circleId}`,
    cents,
    ...extra,
  });

  it('combines one friend across circles and nets their balance', () => {
    const result = summarizeBalances([row(1, 10, -1000), row(1, 20, 400)]);

    expect(result.people).to.have.length(1);
    expect(result.people[0].netCents).to.equal(-600);
    expect(result.people[0].circles.map((c) => c.id)).to.deep.equal([10, 20]);
    expect(result.totals).to.deep.equal({ oweCents: 600, owedCents: 0 });
  });

  it('totals what I owe and what I am owed separately', () => {
    const result = summarizeBalances([row(1, 10, -1000), row(2, 10, 2500)]);

    expect(result.totals).to.deep.equal({ oweCents: 1000, owedCents: 2500 });
  });

  it('drops settled circles and people, and sorts by biggest balance', () => {
    const result = summarizeBalances([row(1, 10, 0), row(2, 10, 300), row(3, 10, -900), row(4, 10, 500), row(4, 20, -500)]);

    // person 4 nets to 0 but still has open balances in two circles, so they stay
    expect(result.people.map((p) => p.id)).to.deep.equal([3, 2, 4]);
    expect(result.people.find((p) => p.id === 4).netCents).to.equal(0);
  });

  it('strips a leading @ from Venmo usernames', () => {
    const result = summarizeBalances([row(1, 10, 100, { venmoUsername: '@pele1234' })]);

    expect(result.people[0].venmoUsername).to.equal('pele1234');
  });

  it('handles no rows', () => {
    expect(summarizeBalances([])).to.deep.equal({ totals: { oweCents: 0, owedCents: 0 }, people: [] });
    expect(summarizeBalances(undefined).people).to.deep.equal([]);
  });
});

describe('validatePayment (unit)', () => {
  it('POSITIVE: accepts numbers or strings and returns cents', () => {
    const result = validatePayment({ circle_id: 3, user_id: '7', amount: '12.5' });

    expect(result.valid).to.equal(true);
    expect(result.cleaned).to.deep.equal({ circleId: 3, userId: 7, cents: 1250 });
  });

  it('NEGATIVE: rejects a missing body', () => {
    expect(validatePayment(null).valid).to.equal(false);
  });

  it('NEGATIVE: rejects bad ids', () => {
    expect(validatePayment({ circle_id: 0, user_id: 1, amount: '5' }).error).to.equal('Pick a circle');
    expect(validatePayment({ circle_id: 1, user_id: 'abc', amount: '5' }).error).to.equal('Pick a person');
  });

  it('NEGATIVE: rejects zero, negative, and 3-decimal amounts', () => {
    ['0', '-5', '1.234', '', 'ten'].forEach((amount) => {
      expect(validatePayment({ circle_id: 1, user_id: 2, amount }).valid, amount).to.equal(false);
    });
  });
});

describe('venmoPayUrl (unit)', () => {
  it('fills in the person, amount and note', () => {
    const url = new URL(venmoPayUrl('@dyca1234', -2310, 'Tethr: Roommates'));

    expect(url.searchParams.get('txn')).to.equal('pay');
    expect(url.searchParams.get('recipients')).to.equal('dyca1234');
    expect(url.searchParams.get('amount')).to.equal('23.10');
    expect(url.searchParams.get('note')).to.equal('Tethr: Roommates');
  });

  it('returns null when the person has no Venmo username', () => {
    expect(venmoPayUrl(null, 500)).to.equal(null);
  });
});
