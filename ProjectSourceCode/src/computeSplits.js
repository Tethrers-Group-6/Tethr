// Splits a total (in integer cents) equally among participants.
// Returns [{ userId, amountCents }] whose amounts add up EXACTLY to totalCents.
function computeSplits(totalCents, userIds) {
    if (!Number.isInteger(totalCents) || totalCents <= 0) {
      throw new Error('totalCents must be a positive integer');
    }
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('need at least one participant');
    }
    if (new Set(userIds).size !== userIds.length) {
      throw new Error('participants must be unique');
    }
  
    const base = Math.floor(totalCents / userIds.length);  // everyone's guaranteed share
    const leftover = totalCents % userIds.length;          // cents left over (0 .. n-1)
  
    // The first `leftover` people each pay one extra cent.
    return userIds.map((userId, i) => ({
      userId,
      amountCents: base + (i < leftover ? 1 : 0),
    }));
  }
  
  module.exports = computeSplits;