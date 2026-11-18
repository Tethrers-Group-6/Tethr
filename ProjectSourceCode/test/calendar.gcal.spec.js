const { expect } = require('chai');
const { createGcal, fromEnv, buildBody } = require('../src/services/gcal');

function fakeCalendar() {
  const calls = [];
  return {
    calls,
    events: {
      insert: async (args) => { calls.push(['insert', args]); return { data: { id: 'g123' } }; },
      update: async (args) => { calls.push(['update', args]); return { data: {} }; },
      delete: async (args) => { calls.push(['delete', args]); return {}; },
    },
  };
}

const event = {
  id: 7, circleId: 3, circle: 'Friday Night Group', title: 'Sophie\u2019s Birthday',
  location: 'Sushi Zanmai, Pearl St', date: '2026-10-30', startTime: '19:00', endTime: '21:00',
};

describe('gcal service', () => {
  it('buildBody maps an event to a Google Calendar resource', () => {
    const body = buildBody(event, 'America/Denver');
    expect(body.summary).to.equal('[Friday Night Group] Sophie\u2019s Birthday');
    expect(body.start).to.deep.equal({ dateTime: '2026-10-30T19:00:00', timeZone: 'America/Denver' });
    expect(body.end).to.deep.equal({ dateTime: '2026-10-30T21:00:00', timeZone: 'America/Denver' });
    expect(body.extendedProperties.private).to.deep.equal({ tethrEventId: '7', tethrCircleId: '3' });
  });

  it('omits location when there is none', () => {
    expect(buildBody({ ...event, location: null }, 'UTC').location).to.equal(undefined);
  });

  it('createEvent inserts into the configured calendar and returns the Google id', async () => {
    const calendar = fakeCalendar();
    const gcal = createGcal({ calendar, calendarId: 'cal@group.calendar.google.com' });
    const id = await gcal.createEvent(event);
    expect(id).to.equal('g123');
    expect(calendar.calls[0][0]).to.equal('insert');
    expect(calendar.calls[0][1].calendarId).to.equal('cal@group.calendar.google.com');
    expect(calendar.calls[0][1].requestBody.start.timeZone).to.equal('America/Denver');
  });

  it('updateEvent and deleteEvent target the right Google event', async () => {
    const calendar = fakeCalendar();
    const gcal = createGcal({ calendar, calendarId: 'cal', timeZone: 'UTC' });
    await gcal.updateEvent('g123', event);
    await gcal.deleteEvent('g123');
    expect(calendar.calls[0][1].eventId).to.equal('g123');
    expect(calendar.calls[0][1].requestBody.start.timeZone).to.equal('UTC');
    expect(calendar.calls[1]).to.deep.equal(['delete', { calendarId: 'cal', eventId: 'g123' }]);
  });

  it('propagates Google errors so the caller can decide what to do', async () => {
    const calendar = { events: { insert: async () => { throw new Error('quota'); } } };
    const gcal = createGcal({ calendar, calendarId: 'cal' });
    let caught;
    try { await gcal.createEvent(event); } catch (e) { caught = e; }
    expect(caught.message).to.equal('quota');
  });

  it('fromEnv returns null when credentials are missing', () => {
    expect(fromEnv({})).to.equal(null);
    expect(fromEnv({ GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b', GOOGLE_CALENDAR_ID: 'c' })).to.equal(null);
  });
});