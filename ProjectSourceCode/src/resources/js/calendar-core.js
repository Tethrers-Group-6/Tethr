// Pure calendar logic: no DOM, no network. Loaded by the browser (window.CalendarCore)
// and by mocha tests (require), so the same code is what gets tested.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CalendarCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function startOfWeek(d) { return addDays(d, -d.getDay()); }

  // Weeks (arrays of 7 cells) covering the month, Sunday-first.
  function monthGrid(year, month) {
    var first = new Date(year, month, 1);
    var count = new Date(year, month + 1, 0).getDate();
    var weeks = Math.ceil((first.getDay() + count) / 7);
    var start = startOfWeek(first), grid = [];
    for (var w = 0; w < weeks; w++) {
      var row = [];
      for (var i = 0; i < 7; i++) {
        var date = addDays(start, w * 7 + i);
        row.push({ date: date, iso: toISO(date), inMonth: date.getMonth() === month });
      }
      grid.push(row);
    }
    return grid;
  }

  function weekDays(anchor) {
    var s = startOfWeek(anchor), out = [];
    for (var i = 0; i < 7; i++) out.push(addDays(s, i));
    return out;
  }

  // Inclusive ISO date range the page must fetch for a view.
  function rangeFor(view, anchor) {
    if (view === 'week') {
      var d = weekDays(anchor);
      return { from: toISO(d[0]), to: toISO(d[6]) };
    }
    var g = monthGrid(anchor.getFullYear(), anchor.getMonth());
    return { from: g[0][0].iso, to: g[g.length - 1][6].iso };
  }

  function shiftAnchor(view, anchor, n) {
    if (view === 'week') return addDays(anchor, 7 * n);
    return new Date(anchor.getFullYear(), anchor.getMonth() + n, 1);
  }

  function titleFor(view, anchor) {
    if (view !== 'week') return MONTHS[anchor.getMonth()] + ' ' + anchor.getFullYear();
    var s = startOfWeek(anchor), e = addDays(s, 6);
    var sm = MONTHS[s.getMonth()].slice(0, 3), em = MONTHS[e.getMonth()].slice(0, 3);
    if (s.getFullYear() !== e.getFullYear()) {
      return sm + ' ' + s.getDate() + ', ' + s.getFullYear() + ' \u2013 ' + em + ' ' + e.getDate() + ', ' + e.getFullYear();
    }
    if (s.getMonth() === e.getMonth()) return sm + ' ' + s.getDate() + ' \u2013 ' + e.getDate() + ', ' + e.getFullYear();
    return sm + ' ' + s.getDate() + ' \u2013 ' + em + ' ' + e.getDate() + ', ' + e.getFullYear();
  }

  // { 'YYYY-MM-DD': [events sorted by startTime] }
  function groupByDate(events) {
    var map = {};
    events.forEach(function (e) { (map[e.date] = map[e.date] || []).push(e); });
    Object.keys(map).forEach(function (k) {
      map[k].sort(function (a, b) { return a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0; });
    });
    return map;
  }

  function formatTime(t) { // '19:00' -> '7:00 PM'
    if (!t) return '';
    var p = t.split(':'), h = +p[0];
    return (h % 12 || 12) + ':' + p[1] + ' ' + (h >= 12 ? 'PM' : 'AM');
  }

  function formatDay(iso) { // '2026-10-30' -> 'Fri, Oct 30'
    var d = parseISO(iso);
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
  }

  function adjustRsvp(counts, prev, next) {
    var out = { going: counts.going, maybe: counts.maybe, no: counts.no };
    if (prev) out[prev]--;
    out[next]++;
    return out;
  }

  function money(cents) { return '$' + (cents / 100).toFixed(2); }

  // Event expenses split across everyone who responded, in whole cents.
  function estPerPerson(expenses, people) {
    if (!people || people < 1) return 0;
    var total = expenses.reduce(function (s, x) { return s + Math.round(x.amount * 100); }, 0);
    return Math.round(total / people);
  }

  // ---- "Add to my calendar" helpers ----
  function stamp(iso, t) { return iso.replace(/-/g, '') + 'T' + t.replace(':', '') + '00'; } // 20261030T190000

  // Events saved without an end time default to one hour, capped at 23:59.
  function endTimeOf(e) {
    if (e.endTime) return e.endTime;
    var p = e.startTime.split(':'), h = +p[0] + 1;
    return h > 23 ? '23:59' : pad(h) + ':' + p[1];
  }
  function eventTitle(e) { return '[' + e.circle + '] ' + e.title; }
  function eventNotes(e) { return 'Tethr event \u00b7 Group: ' + e.circle; }

  // Pre-filled Google Calendar "create event" page (not part of the Calendar API).
  function googleCalendarUrl(e, timeZone) {
    var q = [
      'action=TEMPLATE',
      'text=' + encodeURIComponent(eventTitle(e)),
      'dates=' + stamp(e.date, e.startTime) + '/' + stamp(e.date, endTimeOf(e)),
      'details=' + encodeURIComponent(eventNotes(e)),
      'ctz=' + encodeURIComponent(timeZone || 'America/Denver')
    ];
    if (e.location) q.push('location=' + encodeURIComponent(e.location));
    return 'https://calendar.google.com/calendar/render?' + q.join('&');
  }

  function icsEscape(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
  function utf8Len(ch) {
    var cp = ch.codePointAt(0);
    return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  // RFC 5545: lines are at most 75 octets; continuation lines start with a space.
  function foldLine(line) {
    var out = [], cur = '', bytes = 0;
    Array.from(line).forEach(function (ch) {
      var b = utf8Len(ch);
      if (bytes + b > 75) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; }
      else { cur += ch; bytes += b; }
    });
    out.push(cur);
    return out.join('\r\n');
  }
  function utcStamp(d) {
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
      pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  }

  // Times are "floating" (no zone), so the viewer's calendar app shows them as local time.
  function buildIcs(e, now) {
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tethr//Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:tethr-event-' + e.id + '@tethr',
      'DTSTAMP:' + utcStamp(now || new Date()),
      'DTSTART:' + stamp(e.date, e.startTime),
      'DTEND:' + stamp(e.date, endTimeOf(e)),
      'SUMMARY:' + icsEscape(eventTitle(e))
    ];
    if (e.location) lines.push('LOCATION:' + icsEscape(e.location));
    lines.push('DESCRIPTION:' + icsEscape(eventNotes(e)), 'END:VEVENT', 'END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
  }

  function icsFilename(e) {
    var slug = String(e.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return (slug || 'event') + '.ics';
  }

  return {
    MONTHS: MONTHS, DAYS: DAYS, toISO: toISO, parseISO: parseISO, addDays: addDays,
    startOfWeek: startOfWeek, monthGrid: monthGrid, weekDays: weekDays, rangeFor: rangeFor,
    shiftAnchor: shiftAnchor, titleFor: titleFor, groupByDate: groupByDate,
    formatTime: formatTime, formatDay: formatDay, adjustRsvp: adjustRsvp,
    money: money, estPerPerson: estPerPerson,
    googleCalendarUrl: googleCalendarUrl, buildIcs: buildIcs, icsFilename: icsFilename, endTimeOf: endTimeOf
  };
});