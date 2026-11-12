# UAT Plan: Tethr (Team 6)

## 1. Scope
- Feature 1: Join a circle with an invite code (Dylan). As a user, I can join my friends' circle using a code they send me.
- Feature 2: Edit my profile (Pearl). As a user, I can change my display name and add my Venmo username so friends know who I am and how to pay me.
- Feature 3: The group calendar (name). As a user, I can see my groups' events in a month or week view, create an event for one of my groups, say whether I'm going, and add the event to my own calendar. 
- Feature 4: Register As a user, I can create a profile that saves my transactions, circles, and credentials.

## 2. Acceptance criteria

Register and log in:
- Submitting a complete, valid form creates the account, and I can then sign in with those details.
- Missing or invalid fields, or an email that is already registered, show a clear message naming the problem and no account is created.
- Signing in with a wrong password shows "Incorrect email or password" and does not let me in.
Join a circle:
- A valid code adds the circle to my list and confirms with a message naming it.
- A code that matches no circle shows a clear error and changes nothing.

Edit my profile:
- Saving a new display name and Venmo username shows "Profile saved." and the summary card shows the new values right away, and after a page refresh.
- Saving with a blank display name or an invalid Venmo username shows a clear message naming the problem field, and the saved profile does not change.

Create an event:
- Submitting a complete form closes the window and shows the new event on its date with the right group, time and location, and I am marked as going.
- An end time that is not after the start time shows "End time must be after start time." and nothing is added. A user with no groups sees "Join or create a group first." and cannot submit.
Month and week views:
- The page opens on the current month with today highlighted, and Previous, Next and Today change the period and the heading to match.
- Week view shows seven days with start times, shows "No events" on empty days, shows both months in the heading when the week crosses a month end, and moves one week at a time.
RSVP:
- Choosing Going, Maybe or Can't highlights only that button, updates the going/maybe/no counts right away, and is still selected after a page refresh.
- Changing my answer moves my vote instead of adding a second one.
Add to my calendar:
- "Add to Google Calendar" opens Google Calendar's new-event page already filled in with the title (starting with the group name), date, start and end time, and location.
- "Download .ics" saves a file that another calendar app (Apple Calendar or Outlook) opens with the same details.

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

### UAT-E1: Create an event, valid details
- Preconditions: logged in; member of the circle "Apartment Roommates"; on the Calendar page.
- Test data: group "Apartment Roommates"; name "Pizza night"; date: next Friday; 6:00 PM to 8:00 PM; location "Apt 204"
- Steps: 1. Click "+ New Event". 2. Choose "Apartment Roommates" in "Group". 3. Type Pizza night in "Event name". 4. Set the date to next Friday, "Start" to 6:00 PM and "End" to 8:00 PM. 5. Type Apt 204 in "Location (optional)". 6. Click "Create event".
- Expected: window closes; the calendar shows the month of that Friday; a "Pizza night" tag appears on that day; clicking it shows "Apartment Roommates", the time 6:00 PM - 8:00 PM, location "Apt 204", "RSVP (1 going, 0 maybe, 0 no)", and "Going" highlighted.
- Tester: planned T1 | Actual result: Not run | Status: Not run | Issues: None yet

### UAT-E2: Create an event, end time before start time
- Preconditions: logged in; on the Calendar page.
- Test data: group "Apartment Roommates"; name "Pizza night"; start 8:00 PM; end 6:00 PM
- Steps: 1. Click "+ New Event". 2. Choose the group and type Pizza night. 3. Set "Start" to 8:00 PM and "End" to 6:00 PM. 4. Click "Create event".
- Expected: window stays open and shows "End time must be after start time."; no new event appears on the calendar.
- Tester: planned T2 | Actual result: Not run | Status: Not run | Issues: None yet

### UAT-E3: Create an event, account with no groups
- Preconditions: logged in with a new account that has not joined any circle; on the Calendar page.
- Test data: none
- Steps: 1. Click "+ New Event".
- Expected: window shows "Join or create a group first." and the "Create event" button cannot be clicked.
- Tester: planned T2 | Actual result: Not run | Status: Not run | Issues: None yet

### UAT-E4: Month view, open and move around
- Preconditions: logged in; at least two events this month and one next month.
- Test data: none
- Steps: 1. Open the Calendar page. 2. Note the heading and today's date. 3. Click the next arrow. 4. Click "Today".
- Expected: step 2 shows the current month and year with today's date highlighted; step 3 shows next month's heading and its event; step 4 returns to the current month.
- Tester: planned T1 | Actual result: Not run | Status: Not run | Issues: None yet

### UAT-E5: Week view, empty days and month boundary
- Preconditions: logged in; at least one event this week.
- Test data: a week that crosses a month end (for example the week containing the 1st)
- Steps: 1. Click "Week". 2. Read the heading. 3. Find a day with no events. 4. Click the next arrow, then the previous arrow. 5. Move to a week that crosses a month end and read the heading.
- Expected: seven days are listed and events show their start times; empty days read "No events"; the next and previous arrows move exactly one week; the heading for a week that crosses a month end names both months (for example "Nov 29 - Dec 5, 2026").
- Tester: planned T2 | Actual result: Not run | Status: Not run | Issues: None yet

### UAT-E6: RSVP, choose Maybe
- Preconditions: logged in; the event "Pizza night" exists and I am marked Going.
- Test data: event "Pizza night"
- Steps: 1. Click the "Pizza night" tag. 2. Click "Maybe". 3. Refresh the page and click the "Pizza night" tag again.
- Expected: after step 2 only "Maybe" is highlighted and the heading changes from "RSVP (1 going, 0 maybe, 0 no)" to "RSVP (0 going, 1 maybe, 0 no)"; after step 3 "Maybe" is still highlighted.
- Tester: planned T1 | Actual result: Not run | Status: Not run | Issues: None yet

### UAT-E7: RSVP, change my answer
- Preconditions: logged in; my answer to "Pizza night" is Maybe.
- Test data: event "Pizza night"
- Steps: 1. Click the "Pizza night" tag. 2. Click "Can't". 3. Refresh the page and click the tag again.
- Expected: after step 2 only "Can't" is highlighted and the heading reads "RSVP (0 going, 0 maybe, 1 no)", so the total number of answers did not grow; after step 3 the same answer is still shown.
- Tester: planned T2 | Actual result: Not run | Status: Not run | Issues: None yet

### UAT-E8: Add to Google Calendar
- Preconditions: logged in; signed in to Google in the same browser; the event "Pizza night" (Apartment Roommates, 6:00 PM to 8:00 PM, Apt 204) exists.
- Test data: event "Pizza night"
- Steps: 1. Click the "Pizza night" tag. 2. Click "Add to Google Calendar". 3. In the new Google Calendar tab, click "Save".
- Expected: a new tab opens showing the title "[Apartment Roommates] Pizza night", the right date, 6:00 PM to 8:00 PM, and location "Apt 204"; after "Save" the event appears on the tester's own Google Calendar.
- Tester: planned T1 | Actual result: Not run | Status: Not run | Issues: None yet

### UAT-E9: Download an .ics file
- Preconditions: logged in; the event "Pizza night" exists; Apple Calendar or Outlook is installed on the tester's laptop.
- Test data: event "Pizza night"
- Steps: 1. Click the "Pizza night" tag. 2. Click "Download .ics (Apple, Outlook)". 3. Open the downloaded file.
- Expected: a file named pizza-night.ics downloads; the calendar app offers to add an event with the same title, date, time and location.
- Tester: planned T2 | Actual result: Not run | Status: Not run | Issues: None yet


(Teammates add their test cases below, with their own ID prefix, e.g. UAT-R1.)

## 6. Results
Actual results, status and issues stay "Not run" until the testing milestone.