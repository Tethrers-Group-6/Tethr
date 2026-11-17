const { expect } = require('chai');
const computeSplits = require('../src/computeSplits');

const sum = (splits) => splits.reduce((total, s) => total + s.amountCents, 0);

describe('computeSplits (unit)', () => {
  it('splits evenly when the total divides exactly', () => {
    const result = computeSplits(9240, [1, 5, 6, 3]);
    expect(result.map((s) => s.amountCents)).to.deep.equal([2310, 2310, 2310, 2310]);
  });

  it('gives the leftover cents to the first people (3151 across 4)', () => {
    const result = computeSplits(3151, [2, 3, 4, 5]);
    expect(result.map((s) => s.amountCents)).to.deep.equal([788, 788, 788, 787]);
  });

  it('always adds up to exactly the total', () => {
    for (const [total, n] of [[1, 3], [100, 3], [1000, 7], [99999, 12]]) {
      const ids = Array.from({ length: n }, (_, i) => i + 1);
      expect(sum(computeSplits(total, ids))).to.equal(total);
    }
  });

  it('keeps each person with the matching userId', () => {
    const result = computeSplits(1000, [10, 20, 30]);
    expect(result.map((s) => s.userId)).to.deep.equal([10, 20, 30]);
    expect(result.map((s) => s.amountCents)).to.deep.equal([334, 333, 333]);
  });

  it('gives the whole amount to a single participant', () => {
    expect(computeSplits(500, [1])).to.deep.equal([{ userId: 1, amountCents: 500 }]);
  });

  it('rejects a zero, negative, or non-integer total', () => {
    for (const bad of [0, -5, 10.5, '100', NaN]) {
      expect(() => computeSplits(bad, [1, 2])).to.throw('totalCents must be a positive integer');
    }
  });

  it('rejects an empty participant list', () => {
    expect(() => computeSplits(100, [])).to.throw('need at least one participant');
  });

  it('rejects duplicate participants', () => {
    expect(() => computeSplits(100, [1, 1])).to.throw('participants must be unique');
  });
});