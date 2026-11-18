const { expect } = require('chai');
const C = require('../src/resources/js/calendar-core');

describe('calendar-core', () => {
  describe('monthGrid', () => {
    it('lays out October 2026 in 5 Sunday-first weeks (Oct 1 is a Thursday)', () => {
      const grid = C.monthGrid(2026, 9);
      expect(grid).to.have.length(5);
      grid.forEach((week) => expect(week).to.have.length(7));
      expect(grid[0][0].iso).to.equal('2026-09-27');
      expect(grid[0][4].iso).to.equal('2026-10-01');
      expect(grid[4][6].iso).to.equal('2026-10-31');
    });

    it('marks days outside the month', () => {
      const grid = C.monthGrid(2026, 9);
      expect(grid[0][0].inMonth).to.equal(false);
      expect(grid[0][4].inMonth).to.equal(true);
    });

    it('uses 6 weeks when the month needs them', () => {
      expect(C.monthGrid(2026, 7)).to.have.length(6); // Aug 2026 starts on Saturday
    });

    it('handles leap-year February', () => {
      const flat = [].concat(...C.monthGrid(2028, 1)).filter((c) => c.inMonth);
      expect(flat).to.have.length(29);
    });
  });

  describe('week helpers', () => {
    it('weekDays returns Sunday through Saturday', () => {
      const days = C.weekDays(new Date(2026, 9, 30)).map(C.toISO);
      expect(days[0]).to.equal('2026-10-25');
      expect(days[6]).to.equal('2026-10-31');
    });

    it('rangeFor covers exactly what each view displays', () => {
      const anchor = new Date(2026, 9, 30);
      expect(C.rangeFor('week', anchor)).to.deep.equal({ from: '2026-10-25', to: '2026-10-31' });
      expect(C.rangeFor('month', anchor)).to.deep.equal({ from: '2026-09-27', to: '2026-10-31' });
    });

    it('shiftAnchor moves by week or month and crosses year boundaries', () => {
      expect(C.toISO(C.shiftAnchor('week', new Date(2026, 9, 30), 1))).to.equal('2026-11-06');
      expect(C.toISO(C.shiftAnchor('month', new Date(2026, 0, 31), 1))).to.equal('2026-02-01');
      expect(C.toISO(C.shiftAnchor('month', new Date(2026, 0, 15), -1))).to.equal('2025-12-01');
    });

    it('titleFor formats month and week headings', () => {
      expect(C.titleFor('month', new Date(2026, 9, 5))).to.equal('October 2026');
      expect(C.titleFor('week', new Date(2026, 9, 30))).to.equal('Oct 25 \u2013 31, 2026');
      expect(C.titleFor('week', new Date(2026, 10, 30))).to.equal('Nov 29 \u2013 Dec 5, 2026');
      expect(C.titleFor('week', new Date(2026, 11, 31))).to.equal('Dec 27, 2026 \u2013 Jan 2, 2027');
    });
  });

  describe('dates and times', () => {
    it('parseISO and toISO round-trip', () => {
      expect(C.toISO(C.parseISO('2026-02-28'))).to.equal('2026-02-28');
    });

    it('formatTime converts 24h to 12h', () => {
      expect(C.formatTime('19:00')).to.equal('7:00 PM');
      expect(C.formatTime('00:05')).to.equal('12:05 AM');
      expect(C.formatTime('12:00')).to.equal('12:00 PM');
      expect(C.formatTime(null)).to.equal('');
    });

    it('formatDay gives weekday, month and day', () => {
      expect(C.formatDay('2026-10-30')).to.equal('Fri, Oct 30');
    });
  });

  describe('groupByDate', () => {
    it('groups by date and sorts each day by start time', () => {
      const map = C.groupByDate([
        { id: 1, date: '2026-10-02', startTime: '20:00' },
        { id: 2, date: '2026-10-02', startTime: '09:30' },
        { id: 3, date: '2026-10-09', startTime: '18:00' },
      ]);
      expect(map['2026-10-02'].map((e) => e.id)).to.deep.equal([2, 1]);
      expect(map['2026-10-09']).to.have.length(1);
      expect(map['2026-10-10']).to.equal(undefined);
    });
  });

  describe('rsvp and money', () => {
    it('adjustRsvp moves a vote without mutating the input', () => {
      const before = { going: 6, maybe: 1, no: 1 };
      const after = C.adjustRsvp(before, 'going', 'maybe');
      expect(after).to.deep.equal({ going: 5, maybe: 2, no: 1 });
      expect(before).to.deep.equal({ going: 6, maybe: 1, no: 1 });
    });

    it('adjustRsvp handles a first-time response', () => {
      expect(C.adjustRsvp({ going: 0, maybe: 0, no: 0 }, null, 'going')).to.deep.equal({ going: 1, maybe: 0, no: 0 });
    });

    it('estPerPerson matches the wireframe ($355 over 8 people = $44.38)', () => {
      const expenses = [{ amount: 240 }, { amount: 35 }, { amount: 80 }];
      expect(C.money(C.estPerPerson(expenses, 8))).to.equal('$44.38');
    });

    it('estPerPerson avoids float drift and divide-by-zero', () => {
      expect(C.estPerPerson([{ amount: 0.1 }, { amount: 0.2 }], 1)).to.equal(30);
      expect(C.estPerPerson([{ amount: 10 }], 0)).to.equal(0);
    });
  });
});

describe('calendar-core: add to my calendar', () => {
  const event = {
    id: 5, circle: 'Friday Night Group', title: 'Sophie\u2019s Birthday', location: 'Sushi Zanmai, Pearl St',
    date: '2026-10-30', startTime: '19:00', endTime: '21:00',
  };

  describe('googleCalendarUrl', () => {
    const params = (e, tz) => new URL(C.googleCalendarUrl(e, tz)).searchParams;

    it('builds a Google Calendar template link with the event details', () => {
      const url = new URL(C.googleCalendarUrl(event));
      expect(url.origin + url.pathname).to.equal('https://calendar.google.com/calendar/render');
      const p = url.searchParams;
      expect(p.get('action')).to.equal('TEMPLATE');
      expect(p.get('text')).to.equal('[Friday Night Group] Sophie\u2019s Birthday');
      expect(p.get('dates')).to.equal('20261030T190000/20261030T210000');
      expect(p.get('location')).to.equal('Sushi Zanmai, Pearl St');
      expect(p.get('ctz')).to.equal('America/Denver');
    });

    it('uses the time zone it is given', () => {
      expect(params(event, 'America/New_York').get('ctz')).to.equal('America/New_York');
    });

    it('omits location when there is none', () => {
      expect(params({ ...event, location: null }).has('location')).to.equal(false);
    });

    it('survives characters that would break a query string', () => {
      const p = params({ ...event, title: 'Pizza & Games #1 = fun?', location: 'A&B Cafe' });
      expect(p.get('text')).to.equal('[Friday Night Group] Pizza & Games #1 = fun?');
      expect(p.get('location')).to.equal('A&B Cafe');
    });

    it('defaults to a one-hour event when there is no end time, capped at 23:59', () => {
      expect(params({ ...event, endTime: null }).get('dates')).to.equal('20261030T190000/20261030T200000');
      expect(params({ ...event, startTime: '23:30', endTime: null }).get('dates')).to.equal('20261030T233000/20261030T235900');
    });
  });

  describe('buildIcs', () => {
    const NOW = new Date(Date.UTC(2026, 9, 10, 15, 30, 5));
    const lines = (e) => C.buildIcs(e, NOW).split('\r\n');

    it('produces a valid single-event calendar with CRLF line endings', () => {
      const ics = C.buildIcs(event, NOW);
      expect(ics.endsWith('\r\n')).to.equal(true);
      expect(ics).to.not.match(/[^\r]\n/);
      const l = lines(event);
      expect(l[0]).to.equal('BEGIN:VCALENDAR');
      expect(l).to.include('VERSION:2.0');
      expect(l).to.include('BEGIN:VEVENT');
      expect(l).to.include('END:VEVENT');
      expect(l[l.length - 2]).to.equal('END:VCALENDAR');
    });

    it('includes a stable UID, UTC timestamp, and floating start/end times', () => {
      const l = lines(event);
      expect(l).to.include('UID:tethr-event-5@tethr');
      expect(l).to.include('DTSTAMP:20261010T153005Z');
      expect(l).to.include('DTSTART:20261030T190000');
      expect(l).to.include('DTEND:20261030T210000');
    });

    it('escapes commas, semicolons, backslashes and newlines', () => {
      const l = lines({ ...event, title: 'a, b; c', location: 'Room 1\nBuilding \\ 2' });
      expect(l).to.include('SUMMARY:[Friday Night Group] a\\, b\\; c');
      expect(l).to.include('LOCATION:Room 1\\nBuilding \\\\ 2');
    });

    it('omits LOCATION when there is none', () => {
      expect(lines({ ...event, location: null }).some((x) => x.startsWith('LOCATION'))).to.equal(false);
    });

    it('folds long lines to 75 octets without losing text', () => {
      const long = { ...event, title: 'Caf\u00e9 \u2019party\u2019 '.repeat(20) };
      const out = C.buildIcs(long, NOW);
      out.split('\r\n').forEach((line) => expect(Buffer.byteLength(line, 'utf8')).to.be.at.most(75));
      const unfolded = out.replace(/\r\n /g, '');
      expect(unfolded).to.include('SUMMARY:[Friday Night Group] ' + long.title.replace(/,/g, '\\,'));
    });
  });

  describe('icsFilename', () => {
    it('makes a safe file name from the title', () => {
      expect(C.icsFilename({ title: 'Sophie\u2019s Birthday!' })).to.equal('sophie-s-birthday.ics');
      expect(C.icsFilename({ title: '???' })).to.equal('event.ics');
    });
  });
});

describe('calendar-core: sample data', () => {
  const today = new Date(2026, 10, 12);
  const sample = C.sampleData(today);

  it('dates are relative to today, including one event in the past', () => {
    const dates = sample.events.map((e) => e.date).sort();
    expect(dates[0]).to.equal('2026-11-10');
    expect(dates[dates.length - 1]).to.equal('2026-11-21');
    expect(C.sampleData(new Date(2027, 0, 5)).events.some((e) => e.date === '2027-01-06')).to.equal(true);
  });

  it('every event has the fields the page uses, and a group that exists', () => {
    const ids = sample.events.map((e) => e.id);
    expect(new Set(ids).size).to.equal(ids.length);
    sample.events.forEach((e) => {
      expect(e.date, e.title).to.match(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.startTime, e.title).to.match(/^\d{2}:\d{2}$/);
      expect(e.rsvp).to.have.all.keys('going', 'maybe', 'no');
      expect(e.expenses).to.be.an('array');
      expect(sample.circles.find((c) => c.id === e.circleId).name).to.equal(e.circle);
    });
  });

  it('every event builds a Google Calendar link and an .ics file', () => {
    sample.events.forEach((e) => {
      const p = new URL(C.googleCalendarUrl(e)).searchParams;
      expect(p.get('text'), e.title).to.equal('[' + e.circle + '] ' + e.title);
      expect(p.get('dates'), e.title).to.match(/^\d{8}T\d{6}\/\d{8}T\d{6}$/);
      const ics = C.buildIcs(e, new Date(Date.UTC(2026, 10, 12)));
      expect(ics).to.include('BEGIN:VEVENT').and.to.include('DTSTART:' + e.date.replace(/-/g, '') + 'T');
    });
  });

  it('covers the awkward cases the buttons must handle', () => {
    const find = (title) => sample.events.find((e) => e.title === title);
    expect(find('Pizza & Games #1').endTime).to.equal(null);          // no end time
    expect(new URL(C.googleCalendarUrl(find('Pizza & Games #1'))).searchParams.get('text'))
      .to.equal('[CSCI 3308 Team 6] Pizza & Games #1');               // & and # survive
    expect(find('Game night').location).to.equal(null);               // no location
    expect(new URL(C.googleCalendarUrl(find('Game night'))).searchParams.has('location')).to.equal(false);
    expect(find('Sophie\u2019s Birthday').date).to.equal(find('Game night').date); // same-day events
    expect(sample.events.some((e) => e.synced)).to.equal(true);
    expect(sample.events.some((e) => !e.synced)).to.equal(true);
    const bday = find('Sophie\u2019s Birthday');
    expect(C.money(C.estPerPerson(bday.expenses, 8))).to.equal('$44.38');
  });
});