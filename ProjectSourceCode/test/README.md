# Testing: Circles

## How to run
From ProjectSourceCode/:

    cp .env.test.example .env.test
    docker compose -p tethr-tests -f docker-compose.test.yaml up --abort-on-container-exit --exit-code-from tests
    docker compose -p tethr-tests -f docker-compose.test.yaml down

Reset the test database completely (deletes test data only):

    docker compose -p tethr-tests -f docker-compose.test.yaml down --volumes

## Tools
Mocha (test runner), Chai (assertions), Chai HTTP (sends requests to the Express app).

## Route contract
| Route | Request | Success | Failure cases |
|---|---|---|---|
| GET /api/circles | logged in | 200, { circles: [...] } with name, inviteCode, role, memberCount, expenseCount | 401 { error: "Not logged in" } |
| POST /api/circles/join | JSON { invite_code } | 201, { message: "Joined circle", circle } and one new circle_members row (role "member") | 400 "Invalid input" (missing or empty code); 401 not logged in; 404 "Invalid invite code"; 409 "You are already in this circle" |
| POST /api/circles | JSON { name } | 201, { message: "Circle created", circle } with a TETH-XXXXXX code; creator saved as "admin" | 400 "Invalid input" (blank name); 401 not logged in |

## What is tested
- Unit (test/validation.spec.js, 5 tests): validateInviteCode, no HTTP or database.
- Integration (test/circles.spec.js, 11 tests): HTTP -> Express router -> real PostgreSQL. Each failure case also checks that nothing was inserted.

## Login is stubbed
These tests do not use a real login. Each test builds a small Express app that sets
req.session.user itself, then mounts the real circles router. Real login is not covered here.

## Cleanup and repeatability
- Tests only run against a database whose name ends in _test (checked at startup).
- Each run creates its own users and circle with a random tag, so runs never collide.
- afterEach removes rows a single test created; after() removes everything the file created.
- Only rows the tests created are deleted. No table is ever truncated.
- The suite was run twice in a row with no manual changes, and both runs passed.

## Results
Container tethr-tests-db-test-1 Healthy 
tests-1    | npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
tests-1    | npm warn deprecated glob@8.1.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
tests-1    | npm warn deprecated superagent@8.1.2: Please upgrade to superagent v10.2.2+, see release notes at https://github.com/forwardemail/superagent/releases/tag/v10.2.2 - maintenance is supported by Forward Email @ https://forwardemail.net
tests-1    | 
tests-1    | added 214 packages, and audited 215 packages in 6s
tests-1    | 
tests-1    | 46 packages are looking for funding
tests-1    |   run `npm fund` for details
tests-1    | 
tests-1    | 4 vulnerabilities (3 moderate, 1 high)
tests-1    | 
tests-1    | To address issues that do not require attention, run:
tests-1    |   npm audit fix
tests-1    | 
tests-1    | To address all issues (including breaking changes), run:
tests-1    |   npm audit fix --force
tests-1    | 
tests-1    | Run `npm audit` for details.
tests-1    | npm notice
tests-1    | npm notice New major version of npm available! 11.19.0 -> 12.2.2
tests-1    | npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.2
tests-1    | npm notice To update run: npm install -g npm@12.2.2
tests-1    | npm notice
tests-1    | 
tests-1    | > tethr@1.0.0 test
tests-1    | > mocha --exit
tests-1    | 
tests-1    | 
tests-1    | 
tests-1    |   Circles API (integration)
tests-1    |     GET /api/circles
tests-1    |        lists the circle for a member, with counts and role
tests-1    |        does not list circles the user has not joined
tests-1    |        rejects a logged-out visitor with 401
tests-1    |     POST /api/circles/join
tests-1    |        POSITIVE: a valid code adds exactly one member row
tests-1    |        accepts the code in lowercase (the lookup is case-insensitive)
tests-1    |        NEGATIVE: an unknown code is rejected with 404 and nothing is inserted
tests-1    |        NEGATIVE: a missing invite_code is rejected with 400
tests-1    |        NEGATIVE: joining a circle you are already in returns 409 and adds no second row
tests-1    |        NEGATIVE: a logged-out visitor gets 401 and nothing is inserted
tests-1    |     POST /api/circles (create)
tests-1    |        POSITIVE: creates the circle and makes the creator its admin
tests-1    |        NEGATIVE: a blank name is rejected with 400 and no circle is created
tests-1    | 
tests-1    |   validateInviteCode (unit)
tests-1    |      accepts a normal invite code
tests-1    |      accepts a code that is exactly 20 characters (the VARCHAR(20) limit)
tests-1    |      rejects a code longer than 20 characters
tests-1    |      rejects an empty or whitespace-only code
tests-1    |      rejects a missing code or a non-string value
tests-1    | 
tests-1    | 
tests-1    |   16 passing (61ms)
tests-1    | 
tests-1 exited with code 0







## Not covered yet
- /register and /login tests (another teammate's feature)
- Circle balances (not implemented yet)

---

# Testing: Profile

Runs with the same commands as above (all `test/*.spec.js` files run together).

## Route contract
| Route | Request | Success | Failure cases |
|---|---|---|---|
| GET /profile | logged in | 200, the profile page (HTML) | 302 redirect to /login when logged out |
| GET /api/profile | logged in | 200, { profile: { id, displayName, email, venmoUsername, memberSince, circleCount } }. Never includes the password hash. | 401 { error: "Not logged in" }; 404 "Profile not found" (session points to a deleted account) |
| PUT /api/profile | JSON { display_name, venmo_username } | 200, { message: "Profile updated", profile } and the users row is updated | 400 with a message naming the field (blank or 100+ character name; bad Venmo username); 401 not logged in; 404 no account |

Field rules (src/validateProfileUpdate.js):
- display_name: required, 1-100 characters after trimming (users.display_name is VARCHAR(100)).
- venmo_username: optional. A blank value removes it (stored as NULL). One leading @ is dropped. Otherwise 5-30 letters, numbers, - or _.
- email is the login, so it is not editable on this page.

## What is tested
- Unit (test/profileValidation.spec.js, 9 tests): validateProfileUpdate, no HTTP or database. The PUT route uses this same function before it touches the database.
- Integration (test/profile.spec.js, 11 tests): HTTP -> Express router -> real PostgreSQL.
  - GET: returns the right profile and circle count; never returns the password hash; 401 logged out; 404 deleted account.
  - PUT: valid update is saved to the database; blank Venmo clears it; blank name, bad Venmo username and logged-out requests are rejected and the database row is unchanged.
  - Page: logged-out visitors are redirected to /login; logged-in users get the HTML page.
- Login is stubbed the same way as the Circles tests.

## Cleanup and repeatability
- Each run creates one user (and one circle for the circle count) with a random tag.
- afterEach puts that user's name and Venmo username back, so every test starts from the same state.
- after() deletes only that user and circle. No table is truncated.
- The full suite (Circles + Profile, 36 tests) passed twice in a row, and the test database was empty afterward.

# Testing: Events
 
Runs with the same commands as above (all `test/*.spec.js` files run together).
 
## Route contract
| Route | Request | Success | Failure cases |
|---|---|---|---|
| GET /events | logged in | 200, the calendar page (HTML) | 302 redirect to /login when logged out |
| GET /api/events/circles | logged in | 200, [ { id, name } ] for the groups the user belongs to | 401 { error: "Please log in." } |
| GET /api/events?from=&to= | logged in; dates as YYYY-MM-DD | 200, an array of events with title, circle, date, startTime, endTime, rsvp counts, myStatus, expenses, synced. Only events in the user's own groups. | 400 (missing, invalid, reversed, or over-62-day range); 401 not logged in |
| POST /api/events | JSON { circleId, title, date, startTime, endTime, location } | 201, the saved event, one new events row, the creator saved as "going", and google_event_id set when Google sync works (still 201 with synced: false if Google fails) | 400 with a message naming the problem; 401 not logged in; 403 "You are not a member of that group." |
| POST /api/events/:id/rsvp | JSON { status } | 200, { status } and one event_rsvps row per person, updated in place | 400 (status not going, maybe or no, or a bad id); 401 not logged in; 404 "Event not found." (no such event, or the user is not in its group) |
 
Field rules (src/validateEvent.js):
- circleId: a positive whole number (7 or "7"), and the user must belong to that group.
- title: required, 1-150 characters after trimming (events.title is VARCHAR(150)).
- date: a real calendar date, YYYY-MM-DD.
- startTime and endTime: HH:MM, 24-hour. The end must be after the start (events are single-day).
- location: optional, up to 200 characters. A blank value is stored as NULL.
- from and to (list): valid dates, to is not before from, at most 62 days apart.
## What is tested
- Unit (46 tests, no HTTP or database):
  - test/calendar.validation.spec.js (13 tests): validateEvent, validateRange, validateRsvp. The routes use these same functions before they touch the database.
  - test/calendar.core.spec.js (27 tests): month and week grids, which dates each view fetches, RSVP count changes, cost per person, the Google Calendar link, and the .ics file.
  - test/calendar.gcal.spec.js (6 tests): the Google Calendar wrapper, using a fake Google client (no network).
- Integration:
  - test/calendar.api.spec.js (16 tests): HTTP -> Express router -> real PostgreSQL, with Google replaced by a fake.
    - POSITIVE: creating an event checks the response, exactly one events row, the creator RSVP "going", and the saved Google id. Listing returns events in date order with RSVP counts and expenses. An RSVP is saved and then updated in place.
    - NEGATIVE: every rejection (400, 401, 403, 404) also checks that nothing was inserted. Users never see events from groups they are not in. A Google failure still saves the event, unsynced.
    - Page: logged-out visitors are redirected to /login; logged-in users get the HTML page.
  - test/calendar.app.spec.js (8 tests): the real app from index.js. Every URL events.js calls is mounted behind login (a 404 would mean the page and server disagree), /events redirects to /login, every /resources file events.html links to is served, and the session lookup finds the user id.
  - test/events.spec.js (7 tests): rules the database enforces on its own: an event cannot end before it starts, Google ids are unique, RSVP values and one-RSVP-per-person, and the delete rules (RSVPs go with their event, expenses are kept, a deleted group takes its events with it).
## Login is stubbed
calendar.api.spec.js does not use a real login. It builds a small Express app that mounts the real calendar router and
identifies the user with a test header (x-test-user). calendar.app.spec.js only checks that logged-out requests get 401
on the real app. Real login is not covered here.
 
## Cleanup and repeatability
- Tests only run against a database whose name ends in _test: index.js refuses to start otherwise (NODE_ENV=test), and each database test file also checks the database it is connected to before writing anything.
- Each run creates its own users and groups with a random tag, so runs never collide.
- after() deletes the groups the file created (which also deletes their events, RSVPs and expenses), then its users.
- Only rows the tests created are deleted. No table is ever truncated.
- Every test uses the connection from index.js (app.db); the root hook in server.spec.js closes it, so the suite ends without --exit.
- The full suite (78 tests) passed twice in a row on a local PostgreSQL 16, and the test database was empty afterward. Repeat it with the Docker commands above before submitting.
## Results
Run locally on PostgreSQL 16 with `npm test` (not in Docker). Replace with your Docker output from the commands above.
 
```
db-test-1  | The files belonging to this database system will be owned by user "postgres".
db-test-1  | This user must also own the server process.
db-test-1  | 
db-test-1  | The database cluster will be initialized with locale "en_US.utf8".
db-test-1  | The default database encoding has accordingly been set to "UTF8".
db-test-1  | The default text search configuration will be set to "english".
db-test-1  | 
db-test-1  | Data page checksums are disabled.
db-test-1  | 
db-test-1  | fixing permissions on existing directory /var/lib/postgresql/data ... ok
db-test-1  | creating subdirectories ... ok
db-test-1  | selecting dynamic shared memory implementation ... posix
db-test-1  | selecting default max_connections ... 100
db-test-1  | selecting default shared_buffers ... 128MB
db-test-1  | selecting default time zone ... Etc/UTC
db-test-1  | creating configuration files ... ok
db-test-1  | running bootstrap script ... ok
db-test-1  | performing post-bootstrap initialization ... ok
db-test-1  | syncing data to disk ... ok
db-test-1  | 
db-test-1  | 
db-test-1  | Success. You can now start the database server using:
db-test-1  | 
db-test-1  |     pg_ctl -D /var/lib/postgresql/data -l logfile start
db-test-1  | 
db-test-1  | initdb: warning: enabling "trust" authentication for local connections
db-test-1  | You can change this by editing pg_hba.conf or using the option -A, or
db-test-1  | --auth-local and --auth-host, the next time you run initdb.
db-test-1  | waiting for server to start....2026-11-11 07:21:19.749 UTC [48] LOG:  starting PostgreSQL 14.24 (Debian 14.24-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
db-test-1  | 2026-11-11 07:21:19.752 UTC [48] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
db-test-1  | 2026-11-11 07:21:19.775 UTC [49] LOG:  database system was shut down at 2026-11-11 07:21:19 UTC
db-test-1  | 2026-11-11 07:21:19.817 UTC [48] LOG:  database system is ready to accept connections
db-test-1  |  done
db-test-1  | server started
db-test-1  | CREATE DATABASE
db-test-1  | 
db-test-1  | 
db-test-1  | /usr/local/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/create.sql
db-test-1  | psql:/docker-entrypoint-initdb.d/create.sql:1: NOTICE:  table "event_rsvps" does not exist, skipping
db-test-1  | DROP TABLE
db-test-1  | psql:/docker-entrypoint-initdb.d/create.sql:2: NOTICE:  table "payments" does not exist, skipping
db-test-1  | DROP TABLE
db-test-1  | DROP TABLE
db-test-1  | psql:/docker-entrypoint-initdb.d/create.sql:3: NOTICE:  table "expense_splits" does not exist, skipping
db-test-1  | DROP TABLE
db-test-1  | psql:/docker-entrypoint-initdb.d/create.sql:4: NOTICE:  table "expenses" does not exist, skipping
db-test-1  | psql:/docker-entrypoint-initdb.d/create.sql:5: NOTICE:  table "recurring_bills" does not exist, skipping
db-test-1  | DROP TABLE
db-test-1  | psql:/docker-entrypoint-initdb.d/create.sql:6: NOTICE:  table "events" does not exist, skipping
db-test-1  | DROP TABLE
db-test-1  | psql:/docker-entrypoint-initdb.d/create.sql:7: NOTICE:  table "circle_members" does not exist, skipping
db-test-1  | DROP TABLE
db-test-1  | psql:/docker-entrypoint-initdb.d/create.sql:8: NOTICE:  table "circles" does not exist, skipping
db-test-1  | DROP TABLE
db-test-1  | DROP TABLE
db-test-1  | psql:/docker-entrypoint-initdb.d/create.sql:9: NOTICE:  table "users" does not exist, skipping
db-test-1  | CREATE TABLE
db-test-1  | CREATE TABLE
db-test-1  | CREATE TABLE
db-test-1  | CREATE TABLE
db-test-1  | CREATE TABLE
db-test-1  | CREATE TABLE
db-test-1  | CREATE TABLE
db-test-1  | CREATE TABLE
db-test-1  | CREATE TABLE
db-test-1  | 
db-test-1  | 
db-test-1  | waiting for server to shut down...2026-11-11 07:21:20.500 UTC [48] LOG:  received fast shutdown request
db-test-1  | .2026-11-11 07:21:20.503 UTC [48] LOG:  aborting any active transactions
db-test-1  | 2026-11-11 07:21:20.507 UTC [48] LOG:  background worker "logical replication launcher" (PID 55) exited with exit code 1
db-test-1  | 2026-11-11 07:21:20.507 UTC [50] LOG:  shutting down
db-test-1  | 2026-11-11 07:21:20.595 UTC [48] LOG:  database system is shut down
db-test-1  |  done
db-test-1  | server stopped
db-test-1  | 
db-test-1  | PostgreSQL init process complete; ready for start up.
db-test-1  | 
db-test-1  | 2026-11-11 07:21:20.645 UTC [1] LOG:  starting PostgreSQL 14.24 (Debian 14.24-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
db-test-1  | 2026-11-11 07:21:20.648 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432
db-test-1  | 2026-11-11 07:21:20.649 UTC [1] LOG:  listening on IPv6 address "::", port 5432
db-test-1  | 2026-11-11 07:21:20.655 UTC [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
db-test-1  | 2026-11-11 07:21:20.665 UTC [65] LOG:  database system was shut down at 2026-11-11 07:21:20 UTC
db-test-1  | 2026-11-11 07:21:20.701 UTC [1] LOG:  database system is ready to accept connections
Container tethr-tests-db-test-1 Healthy 
tests-1    | npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
tests-1    | npm warn deprecated glob@8.1.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
tests-1    | npm warn deprecated superagent@8.1.2: Please upgrade to superagent v10.2.2+, see release notes at https://github.com/forwardemail/superagent/releases/tag/v10.2.2 - maintenance is supported by Forward Email @ https://forwardemail.net
tests-1    | npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
tests-1    | 
tests-1    | added 491 packages, and audited 492 packages in 11s
tests-1    | 
tests-1    | 86 packages are looking for funding
tests-1    |   run `npm fund` for details
tests-1    | 
tests-1    | 22 vulnerabilities (1 low, 20 moderate, 1 high)
tests-1    | 
tests-1    | To address all issues (including breaking changes), run:
tests-1    |   npm audit fix --force
tests-1    | 
tests-1    | Run `npm audit` for details.
tests-1    | npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
tests-1    | npm warn install-scripts   @parcel/watcher@2.6.0 (install: node scripts/build-from-source.js)
tests-1    | npm warn install-scripts
tests-1    | npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.
tests-1    | npm notice
tests-1    | npm notice New major version of npm available! 11.19.0 -> 12.2.2
tests-1    | npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.2
tests-1    | npm notice To update run: npm install -g npm@12.2.2
tests-1    | npm notice
tests-1    | 
tests-1    | > tethr@1.0.0 test
tests-1    | > mocha --exit
tests-1    | 
tests-1    | 
tests-1    |  Exception during run: Error: Cannot find module './helpers/testDb'
tests-1    | Require stack:
tests-1    | - /repository/test/events.spec.js
tests-1    |     at Module._resolveFilename (node:internal/modules/cjs/loader:1564:15)
tests-1    |     at wrapResolveFilename (node:internal/modules/cjs/loader:1118:27)
tests-1    |     at defaultResolveImplForCJSLoading (node:internal/modules/cjs/loader:1142:10)
tests-1    |     at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1169:12)
tests-1    |     at Module._load (node:internal/modules/cjs/loader:1341:5)
tests-1    |     at wrapModuleLoad (node:internal/modules/cjs/loader:261:19)
tests-1    |     at Module.require (node:internal/modules/cjs/loader:1674:12)
tests-1    |     at require (node:internal/modules/helpers:157:16)
tests-1    |     at Object.<anonymous> (/repository/test/events.spec.js:3:34)
tests-1    |     at Module._compile (node:internal/modules/cjs/loader:1929:14)
tests-1    |     at Object..js (node:internal/modules/cjs/loader:2060:10)
tests-1    |     at Module.load (node:internal/modules/cjs/loader:1651:32)
tests-1    |     at Module._load (node:internal/modules/cjs/loader:1443:12)
tests-1    |     at wrapModuleLoad (node:internal/modules/cjs/loader:261:19)
tests-1    |     at loadCJSModuleWithModuleLoad (node:internal/modules/esm/translators:372:15)
tests-1    |     at ModuleWrap.<anonymous> (node:internal/modules/esm/translators:244:9)
tests-1    |     at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
tests-1    |     at async node:internal/modules/esm/loader:647:26
tests-1    |     at async formattedImport (/repository/node_modules/mocha/lib/nodejs/esm-utils.js:9:14)
tests-1    |     at async exports.requireOrImport (/repository/node_modules/mocha/lib/nodejs/esm-utils.js:42:28)
tests-1    |     at async exports.loadFilesAsync (/repository/node_modules/mocha/lib/nodejs/esm-utils.js:100:20)
tests-1    |     at async singleRun (/repository/node_modules/mocha/lib/cli/run-helpers.js:162:3)
tests-1    |     at async exports.handler (/repository/node_modules/mocha/lib/cli/run.js:375:5) {
tests-1    |   code: 'MODULE_NOT_FOUND',
tests-1    |   requireStack: [ '/repository/test/events.spec.js' ]
tests-1    | }
tests-1 exited with code 1
```
 
## Not covered yet
- The calendar page itself (src/resources/js/events.js): month/week buttons, the New Event window and RSVP clicks run in the browser and are covered by the UAT plan, not by automated tests
- Real Google Calendar sync (tests use a fake Google client)
- Real login (login is another teammate's feature)
- Editing and deleting events (not implemented yet)
