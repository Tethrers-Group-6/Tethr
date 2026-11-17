const { expect } = require('chai');
const parseAmountToCents = require('../src/parseAmount');

describe('parseAmountToCents (unit)', () => {
  it('converts dollars and cents to integer cents', () => {
    expect(parseAmountToCents('92.40')).to.equal(9240);
    expect(parseAmountToCents('5')).to.equal(500);
    expect(parseAmountToCents('0.5')).to.equal(50);
  });

  it('avoids floating-point error (1.15 * 100 is 114.99999999999999)', () => {
    expect(parseAmountToCents('1.15')).to.equal(115);
  });

  it('trims whitespace and accepts a number', () => {
    expect(parseAmountToCents(' 7.10 ')).to.equal(710);
    expect(parseAmountToCents(12.5)).to.equal(1250);
  });

  it('returns null for zero, negative, or non-numeric input', () => {
    for (const bad of ['0', '0.00', '-3', 'abc', '', '1e3', '.5', null, undefined, {}]) {
      expect(parseAmountToCents(bad)).to.equal(null);
    }
  });

  it('returns null for more than 2 decimal places', () => {
    expect(parseAmountToCents('1.234')).to.equal(null);
  });
});