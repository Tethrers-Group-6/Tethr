const chai = require('chai');
const chaiHttp = require('chai-http');
const fs = require('node:fs');
const path = require('node:path');
const app = require('../index');
const {sessionUserId} = require('../src/routes/events');

chai.use(chaiHttp);
const {expect} = chai;

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

// Catches the lab's "form posts to /players_info/post but the server has /player_info/post" bug:
// every URL the calendar page calls must exist on the real application.
describe('Calendar wiring in the real app', () => {
  const frontend = read('src/resources/js/events.js');
  const endpoints = [
    {method: 'get', url: '/api/events/circles', usedAs: "'/api/events/circles'"},
    {method: 'get', url: '/api/events?from=2026-10-01&to=2026-10-31', usedAs: "'/api/events?from='"},
    {method: 'post', url: '/api/events', usedAs: "'/api/events'"},
    {method: 'post', url: '/api/events/1/rsvp', usedAs: "'/api/events/' + e.id + '/rsvp'"},
  ];

  endpoints.forEach(({method, url, usedAs}) => {
    it(`${method.toUpperCase()} ${url.split('?')[0]} is called by events.js and mounted behind login`, async () => {
      expect(frontend, 'events.js no longer calls this URL').to.include(usedAs);
      const res = await chai.request(app)[method](url).send({});
      expect(res, 'a 404 means the page and server disagree on the URL').to.have.status(401);
    });
  });

  it('redirects /events to /login when signed out', async () => {
    const res = await chai.request(app).get('/events').redirects(0);
    expect(res).to.have.status(302);
    expect(res).to.have.header('location', '/login');
  });

  it('serves every /resources file that events.html links to', async () => {
    const html = read('src/views/events.html');
    const links = [...html.matchAll(/(?:href|src)="(\/resources\/[^"]+)"/g)].map((m) => m[1]);
    expect(links).to.have.length.above(1);
    for (const link of links) {
      const res = await chai.request(app).get(link);
      expect(res, link).to.have.status(200);
    }
  });
});

describe('Calendar login check (session)', () => {
  it('finds the user id in the common session shapes', () => {
    expect(sessionUserId({session: {user: {user_id: 4}}})).to.equal(4);
    expect(sessionUserId({session: {user: {id: '5'}}})).to.equal(5);
    expect(sessionUserId({session: {userId: 6}})).to.equal(6);
  });

  it('treats a missing or empty session as signed out', () => {
    expect(sessionUserId({})).to.equal(null);
    expect(sessionUserId({session: {}})).to.equal(null);
    expect(sessionUserId({session: {user: {user_id: 'abc'}}})).to.equal(null);
    expect(sessionUserId({session: {user: {user_id: 0}}})).to.equal(null);
  });
});