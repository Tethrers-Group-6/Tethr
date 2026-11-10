# UAT Plan: Tethr (Team 6)

## 1. Scope
- Feature 1: Join a circle with an invite code (Dylan). As a user, I can join my friends' circle using a code they send me.
- Feature 2: (teammate fills in)
- Feature 3: (teammate fills in)

## 2. Acceptance criteria
Join a circle:
- A valid code adds the circle to my list and confirms with a message naming it.
- A code that matches no circle shows a clear error and changes nothing.

(Teammates add their criteria below.)

## 3. Environment
Localhost via docker compose up; Chrome (latest) on a laptop. Commit tested: (record when executing)

## 4. Testers
Intended users: college students who split costs with friends or roommates. Planned testers: T1, T2 (classmates outside the team if possible; note it as a limitation if team members act as proxies). Coordinator: (name)

## 5. Test cases

### UAT-C1: Join a circle, valid code
- Preconditions: logged in; circle "Friday Night Group" with code TETH-204 exists; tester is not a member.
- Test data: TETH-204
- Steps: 1. Open the Circles page. 2. Click "Join with Code". 3. Type TETH-204. 4. Click "Join Circle".
- Expected: window closes; banner says "Joined Friday Night Group!"; a "Friday Night Group" card appears in the list.
- Tester: planned T1 | Actual result: Not run | Status: Not run | Issues: None yet

### UAT-C2: Join a circle, unknown code
- Preconditions: logged in, on the Circles page.
- Test data: NOPE-000
- Steps: 1. Click "Join with Code". 2. Type NOPE-000. 3. Click "Join Circle".
- Expected: window stays open and shows "Invalid invite code"; no new card appears.
- Tester: planned T2 | Actual result: Not run | Status: Not run | Issues: None yet

(Teammates add their test cases below, with their own ID prefix, e.g. UAT-R1.)

## 6. Results
Actual results, status and issues stay "Not run" until the testing milestone.