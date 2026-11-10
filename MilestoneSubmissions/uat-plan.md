# UAT Plan: Tethr (Team 6)

## 1. Scope
- Feature 1: Join a circle with an invite code (Dylan). As a user, I can join my friends' circle using a code they send me.
- Feature 2: Edit my profile (Pearl). As a user, I can change my display name and add my Venmo username so friends know who I am and how to pay me.
- Feature 3: (teammate fills in)

## 2. Acceptance criteria
Join a circle:
- A valid code adds the circle to my list and confirms with a message naming it.
- A code that matches no circle shows a clear error and changes nothing.

Edit my profile:
- Saving a new display name and Venmo username shows "Profile saved." and the summary card shows the new values right away, and after a page refresh.
- Saving with a blank display name or an invalid Venmo username shows a clear message naming the problem field, and the saved profile does not change.

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

### UAT-P1: Edit profile, valid changes
- Preconditions: logged in as a tester account with display name "Test User" and no Venmo username; on the Profile page.
- Test data: display name "Test User 2"; Venmo username "@tethr-tester"
- Steps: 1. Clear "Display name" and type Test User 2. 2. Type @tethr-tester in "Venmo username". 3. Click "Save Changes". 4. Refresh the page.
- Expected: "Profile saved." appears; the card shows "Test User 2" with initials "TU" and Venmo "@tethr-tester" (a link to venmo.com); after refreshing, the same values are still shown.
- Tester: planned T1 | Actual result: Not run | Status: Not run | Issues: None yet

### UAT-P2: Edit profile, invalid input
- Preconditions: logged in, on the Profile page, display name currently "Test User 2".
- Test data: (a) display name left blank; (b) display name "Test User 3" with Venmo username "tethr tester" (contains a space)
- Steps: 1. Clear "Display name" and click "Save Changes". 2. Type Test User 3 in "Display name", type tethr tester in "Venmo username", and click "Save Changes". 3. Click "Cancel", then refresh the page.
- Expected: step 1 shows "Display name is required"; step 2 shows "Venmo username must be 5-30 letters, numbers, - or _ (no spaces)"; after step 3 the profile still shows "Test User 2" and the previous Venmo username.
- Tester: planned T2 | Actual result: Not run | Status: Not run | Issues: None yet

(Teammates add their test cases below, with their own ID prefix, e.g. UAT-R1.)

## 6. Results
Actual results, status and issues stay "Not run" until the testing milestone.