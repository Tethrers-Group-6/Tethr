// Calendar page: rendering and events only. Date math lives in calendar-core.js.
(function () {
  const C = window.CalendarCore;
  const $ = (id) => document.getElementById(id);
  const state = { view: 'month', anchor: new Date(), circle: '', events: [], circles: [], selectedId: null };
  let loadToken = 0;
  const TIME_ZONE = 'America/Denver'; // keep in sync with CALENDAR_TIMEZONE in .env

  const cal = $('calendar'), detail = $('detail'), label = $('range-label'), statusEl = $('status');
  const filter = $('circle-filter'), dialog = $('event-dialog'), form = $('event-form');
  const formError = $('form-error'), submitBtn = $('submit'), circleSelect = $('f-circle');

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function api(path, opts) {
    const o = Object.assign({ credentials: 'same-origin' }, opts || {});
    if (o.body) { o.headers = { 'Content-Type': 'application/json' }; o.body = JSON.stringify(o.body); }
    return fetch(path, o).then((res) => res.json().catch(() => ({})).then((data) => {
      if (!res.ok) { const err = new Error(data.error || 'Request failed.'); err.status = res.status; throw err; }
      return data;
    }));
  }

  const visible = () => state.events.filter((e) => !state.circle || String(e.circleId) === state.circle);
  const selected = () => state.events.filter((e) => e.id === state.selectedId)[0] || null;

  function chip(e, withTime) {
    return '<button type="button" class="chip c' + (e.circleId % 4) + '" data-id="' + e.id +
      '" aria-pressed="' + (e.id === state.selectedId) + '" title="' + esc(e.title + ' (' + e.circle + ')') + '">' +
      (withTime ? '<span class="t">' + C.formatTime(e.startTime) + '</span> ' : '') + esc(e.title) + '</button>';
  }

  function renderMonth() {
    const byDate = C.groupByDate(visible());
    const today = C.toISO(new Date());
    let html = '<div class="weekdays">' + C.DAYS.map((d) => '<span>' + d + '</span>').join('') + '</div><div class="grid">';
    C.monthGrid(state.anchor.getFullYear(), state.anchor.getMonth()).forEach((week) => week.forEach((cell) => {
      const isToday = cell.iso === today;
      html += '<div class="cell' + (cell.inMonth ? '' : ' other') + (isToday ? ' today' : '') + '"' +
        (isToday ? ' aria-current="date"' : '') + '><span class="num">' + cell.date.getDate() + '</span>' +
        (byDate[cell.iso] || []).map((e) => chip(e, false)).join('') + '</div>';
    }));
    cal.innerHTML = html + '</div>';
  }

  function renderWeek() {
    const byDate = C.groupByDate(visible());
    const today = C.toISO(new Date());
    let html = '<div class="grid week">';
    C.weekDays(state.anchor).forEach((d) => {
      const iso = C.toISO(d), evs = byDate[iso] || [];
      html += '<div class="daycol' + (iso === today ? ' today' : '') + '"' + (iso === today ? ' aria-current="date"' : '') + '>' +
        '<div class="dayhead"><span>' + C.DAYS[d.getDay()] + '</span><strong>' + d.getDate() + '</strong></div>' +
        (evs.length ? evs.map((e) => chip(e, true)).join('') : '<p class="none">No events</p>') + '</div>';
    });
    cal.innerHTML = html + '</div>';
  }

  function renderDetail() {
    const e = selected();
    if (!e || visible().indexOf(e) === -1) {
      detail.innerHTML = '<p class="empty">Select an event to see its details, RSVP, and expenses.</p>';
      return;
    }
    const r = e.rsvp, people = r.going + r.maybe + r.no;
    const rows = (e.expenses || []).map((x) =>
      '<li><span>' + esc(x.name) + '</span><strong>' + C.money(Math.round(x.amount * 100)) + '</strong></li>').join('');
    const btn = (s, text) => '<button type="button" class="btn" data-rsvp="' + s + '" aria-pressed="' + (e.myStatus === s) + '">' + text + '</button>';
    detail.innerHTML =
      '<h2>' + esc(e.title) + '</h2>' +
      '<p class="when">' + C.formatDay(e.date) + ', ' + C.formatTime(e.startTime) +
        (e.endTime ? ' \u2013 ' + C.formatTime(e.endTime) : '') + ' \u00b7 ' + esc(e.circle) + '</p>' +
      (e.location ? '<h3>Location</h3><p>' + esc(e.location) + '</p>' : '') +
      '<h3>RSVP (' + r.going + ' going, ' + r.maybe + ' maybe, ' + r.no + ' no)</h3>' +
      '<div class="avatars" aria-hidden="true">' + '<span></span>'.repeat(r.going) + '</div>' +
      '<div class="rsvp" role="group" aria-label="Your RSVP">' + btn('going', 'Going') + btn('maybe', 'Maybe') + btn('no', 'Can\u2019t') + '</div>' +
      '<h3>Event expenses</h3>' +
      (rows ? '<ul class="expenses">' + rows + '</ul>' : '<p class="empty">No expenses yet.</p>') +
      (rows ? '<div class="estimate"><span>Est. per person:</span><span>' + C.money(C.estPerPerson(e.expenses, people)) + '</span></div>' : '<div class="estimate"></div>') +
      '<div class="stack">' +
        '<a class="btn block" href="/expenses/new?event=' + e.id + '">+ Add Expense to Event</a>' +
        '<a class="btn btn-blue block" href="' + esc(C.googleCalendarUrl(e, TIME_ZONE)) + '" target="_blank" rel="noopener noreferrer"' +
          ' aria-label="Add to Google Calendar (opens in a new tab)">Add to Google Calendar</a>' +
        '<button type="button" class="btn block" data-ics="1">Download .ics (Apple, Outlook)</button>' +
      '</div>' +
      '<p class="sync">' + (e.synced ? 'Synced to Google Calendar' : 'Not synced to Google Calendar yet') + '</p>';
  }

  function render() {
    label.textContent = C.titleFor(state.view, state.anchor);
    document.querySelectorAll('[data-view]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === state.view)));
    (state.view === 'week' ? renderWeek : renderMonth)();
    renderDetail();
  }

  function load() {
    const range = C.rangeFor(state.view, state.anchor), token = ++loadToken;
    statusEl.textContent = 'Loading events\u2026';
    return api('/api/calendar/events?from=' + range.from + '&to=' + range.to)
      .then((data) => { if (token === loadToken) { state.events = data; statusEl.textContent = ''; } })
      .catch((err) => {
        if (token !== loadToken) return;
        state.events = [];
        statusEl.textContent = err.status === 401 ? 'Please log in to see your calendar.' : 'Events could not be loaded. Try again.';
      })
      .then(() => { if (token === loadToken) render(); });
  }

  function loadCircles() {
    return api('/api/calendar/circles').then((rows) => {
      state.circles = rows;
      const opts = rows.map((c) => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('');
      filter.innerHTML = '<option value="">All groups</option>' + opts;
      circleSelect.innerHTML = rows.length ? opts : '<option value="">No groups yet</option>';
    }).catch(() => {});
  }

  // Navigation and view controls
  const go = (n) => { state.anchor = C.shiftAnchor(state.view, state.anchor, n); load(); };
  $('prev').addEventListener('click', () => go(-1));
  $('next').addEventListener('click', () => go(1));
  $('today').addEventListener('click', () => { state.anchor = new Date(); load(); });
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    state.view = b.getAttribute('data-view'); load();
  }));
  filter.addEventListener('change', () => { state.circle = filter.value; render(); });

  cal.addEventListener('click', (ev) => {
    const c = ev.target.closest('.chip');
    if (!c) return;
    state.selectedId = Number(c.getAttribute('data-id'));
    render();
  });

  function downloadIcs(e) {
    const url = URL.createObjectURL(new Blob([C.buildIcs(e)], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = C.icsFilename(e);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // RSVP: update immediately, undo if the server rejects it
  detail.addEventListener('click', (ev) => {
    const e = selected();
    if (e && ev.target.closest('[data-ics]')) { downloadIcs(e); return; }
    const b = ev.target.closest('[data-rsvp]');
    if (!b || !e) return;
    const next = b.getAttribute('data-rsvp'), prev = e.myStatus;
    if (prev === next) return;
    const before = e.rsvp;
    e.rsvp = C.adjustRsvp(before, prev, next); e.myStatus = next;
    renderDetail();
    api('/api/calendar/events/' + e.id + '/rsvp', { method: 'POST', body: { status: next } })
      .catch(() => {
        e.rsvp = before; e.myStatus = prev; renderDetail();
        statusEl.textContent = 'Your RSVP did not save. Try again.';
      });
  });

  // New event dialog
  $('new-event').addEventListener('click', () => {
    form.reset();
    formError.textContent = state.circles.length ? '' : 'Join or create a group first.';
    submitBtn.disabled = !state.circles.length;
    const e = selected();
    $('f-date').value = e ? e.date : C.toISO(new Date());
    if (state.circle) circleSelect.value = state.circle;
    dialog.showModal();
    $('f-title').focus();
  });
  $('cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog.close(); });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    formError.textContent = '';
    submitBtn.disabled = true;
    api('/api/calendar/events', {
      method: 'POST',
      body: {
        circleId: Number(circleSelect.value), title: $('f-title').value, date: $('f-date').value,
        startTime: $('f-start').value, endTime: $('f-end').value, location: $('f-location').value,
      },
    }).then((created) => {
      dialog.close();
      state.circle = ''; filter.value = '';
      state.anchor = C.parseISO(created.date);
      state.selectedId = created.id;
      return load();
    }).catch((err) => { formError.textContent = err.message; })
      .then(() => { submitBtn.disabled = !state.circles.length; });
  });

  loadCircles().then(load);
})();