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
tests-1    |       ✔ lists the circle for a member, with counts and role
tests-1    |       ✔ does not list circles the user has not joined
tests-1    |       ✔ rejects a logged-out visitor with 401
tests-1    |     POST /api/circles/join
tests-1    |       ✔ POSITIVE: a valid code adds exactly one member row
tests-1    |       ✔ accepts the code in lowercase (the lookup is case-insensitive)
tests-1    |       ✔ NEGATIVE: an unknown code is rejected with 404 and nothing is inserted
tests-1    |       ✔ NEGATIVE: a missing invite_code is rejected with 400
tests-1    |       ✔ NEGATIVE: joining a circle you are already in returns 409 and adds no second row
tests-1    |       ✔ NEGATIVE: a logged-out visitor gets 401 and nothing is inserted
tests-1    |     POST /api/circles (create)
tests-1    |       ✔ POSITIVE: creates the circle and makes the creator its admin
tests-1    |       ✔ NEGATIVE: a blank name is rejected with 400 and no circle is created
tests-1    | 
tests-1    |   validateInviteCode (unit)
tests-1    |     ✔ accepts a normal invite code
tests-1    |     ✔ accepts a code that is exactly 20 characters (the VARCHAR(20) limit)
tests-1    |     ✔ rejects a code longer than 20 characters
tests-1    |     ✔ rejects an empty or whitespace-only code
tests-1    |     ✔ rejects a missing code or a non-string value
tests-1    | 
tests-1    | 
tests-1    |   16 passing (61ms)
tests-1    | 
tests-1 exited with code 0







## Not covered yet
- /register and /login tests (another teammate's feature)
- Circle balances (not implemented yet)