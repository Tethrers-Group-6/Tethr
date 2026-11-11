# Tethr

## App Description
Tethr is a web application that brings a friend group's shared money and shared plans into one place. Today, groups of college students, roommates, and travel companions juggle several tools at once: Venmo for payments, group chats for tracking who owes what, and separate calendars for coordinating plans. Tethr replaces that patchwork with persistent private groups called Circles, where members can log expenses, see balances, and plan events together. 
Inside a Circle, users post an expense, record who paid, and tag the people who owe money. Expenses can be split equally, by custom dollar amounts, or by percentage, and every user's balance updates automatically. A dashboard shows the total a user owes and is owed across all of their Circles, while a People view combines balances with each individual friend across groups. Recurring charges such as rent, utilities, and streaming subscriptions can be set to repeat on a schedule, with reminders sent before they are due. Payments are settled outside the app through links to services like Venmo and then confirmed in Tethr. What sets Tethr apart is that planning and spending live together. Each Circle has a shared calendar for birthdays, dinners, trips, and other events, with RSVP tracking, and expenses can be attached directly to an event. A group planning a ski trip, for example, can create the event, track who is coming, split the Airbnb deposit and groceries, and settle up afterward without switching apps. The goal is a single, clear picture of what a group is doing and what everyone owes. 

## Vision Statement
For college students, roommates, and friend groups who constantly share costs and make plans together 
but track them across scattered apps and group chats. Tethr is a shared expense and planning app that 
keeps every group's balances, bills, and events in one place so friends always know who owes what and 
what's coming up. Unlike Splitwise, our product connects expense splitting with a shared group 
calendar, so the money and the plans behind it stay together. 
**Keeping friends connected by making shared money and shared plans effortless.**


## Project Directory
```
Tethr/
├── MilestoneSubmissions/
│   ├── Release_Notes.md
│   └── Team6_Tethr_Project_Proposal.pdf
├── ProjectSourceCode/
│   ├── .env.test.example
│   ├── .gitignore
│   ├── docker-compose.yaml
│   ├── docker-compose.test.yaml
│   ├── index.js
│   ├── package.json
│   ├── package-lock.json
│   ├── src/
│   │   ├── init_data/
│   │   │   ├── create.sql
│   │   │   └── insert.sql
│   │   ├── resources/
│   │   │   ├── css/
│   │   │   │   ├── events.css
│   │   │   │   └── styles.css
│   │   │   ├── img/
│   │   │   │   └── Tethr Logo.png
│   │   │   └── js/
│   │   │       ├── calendar-core.js
│   │   │       ├── circles.js
│   │   │       ├── dashboard.js
│   │   │       ├── events.js
│   │   │       ├── profile.js
│   │   │       └── ...
│   │   ├── routes/
│   │   │   ├── balances.js
│   │   │   ├── circles.js
│   │   │   ├── dashboard.js
│   │   │   ├── events.js
│   │   │   ├── expenses.js
│   │   │   ├── login.js
│   │   │   ├── profile.js
│   │   │   └── register.js
│   │   ├── services/
│   │   │   ├── calendarStore.js
│   │   │   └── gcal.js
│   │   ├── views/
│   │   │   ├── balances.html
│   │   │   ├── circles.html
│   │   │   ├── dashboard.html
│   │   │   ├── events.html
│   │   │   ├── expenses.html
│   │   │   ├── login.html
│   │   │   ├── profile.html
│   │   │   └── register.html
│   │   ├── validateEvent.js
│   │   ├── validateInviteCode.js
│   │   └── validateProfileUpdate.js
│   └── test/
│       ├── README.md
│       ├── circles.spec.js
│       ├── events.spec.js
│       ├── login.spec.js
│       ├── profile.spec.js
│       ├── profileValidation.spec.js
│       ├── server.spec.js
│       ├── validation.spec.js
│       └── ...
├── README.md
└── TeamMeetingLogs/
    └── MeetingLog.md
```
