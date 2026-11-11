// Google Calendar wrapper. One private, app-owned calendar mirrors Tethr events.
// The Google client is injected, so tests never touch the network.

function buildBody(e, timeZone) {
  return {
    summary: '[' + e.circle + '] ' + e.title,
    location: e.location || undefined,
    start: { dateTime: e.date + 'T' + e.startTime + ':00', timeZone },
    end: { dateTime: e.date + 'T' + e.endTime + ':00', timeZone },
    extendedProperties: {
      private: { tethrEventId: String(e.id), tethrCircleId: String(e.circleId) },
    },
  };
}

function createGcal({ calendar, calendarId, timeZone = 'America/Denver' }) {
  return {
    async createEvent(e) {
      const res = await calendar.events.insert({ calendarId, requestBody: buildBody(e, timeZone) });
      return res.data.id;
    },
    async updateEvent(googleEventId, e) {
      await calendar.events.update({
        calendarId, eventId: googleEventId, requestBody: buildBody(e, timeZone),
      });
    },
    async deleteEvent(googleEventId) {
      await calendar.events.delete({ calendarId, eventId: googleEventId });
    },
  };
}

// Returns null when credentials are missing, so the app still works without Google.
function fromEnv(env = process.env) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID } = env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !GOOGLE_CALENDAR_ID) {
    return null;
  }
  const { google } = require('googleapis'); // loaded lazily so tests don't need it
  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return createGcal({
    calendar: google.calendar({ version: 'v3', auth }),
    calendarId: GOOGLE_CALENDAR_ID,
    timeZone: env.CALENDAR_TIMEZONE || 'America/Denver',
  });
}

module.exports = { createGcal, fromEnv, buildBody };