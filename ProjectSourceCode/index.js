const express = require('express');
const session = require('express-session');
const path = require('path');
const pgp = require('pg-promise')();

const app = express();

// [Lab 10] Tests must never touch a development database: refuse unless the name ends in _test.
const database = process.env.POSTGRES_DB || 'users_db';
if (process.env.NODE_ENV === 'test' && !database.endsWith('_test')) {
  throw new Error('Tests require a database name ending in _test');
}

const db = pgp({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: 5432,
  database: process.env.POSTGRES_DB || 'users_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'pwd'
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false
}));

// CSS and client JS
app.use('/resources', express.static(path.join(__dirname, 'src/resources')));

// [Lab 10] Sample route used by the welcome test
app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});

// Dashboard: serves /home and /api/dashboard
app.use(require('./src/routes/dashboard')(db));

// Circles: serves /circles and /api/circles
app.use(require('./src/routes/circles')(db));

// Profile: serves /profile and /api/profile
app.use(require('./src/routes/profile')(db));

// Events: serves /events and /api/events
app.use(require('./src/routes/events')(db));

// Temporary: each remaining page just serves its HTML file until its route file exists
const pages = {
  '/balances': 'balances.html',
  '/circle': 'circleIndividual.html',
  '/expenses': 'expenses.html',
  '/login': 'login.html',
  '/register': 'register.html'
};
Object.entries(pages).forEach(([url, file]) => {
  app.get(url, (req, res) => res.sendFile(path.join(__dirname, 'src/views', file)));
});

if (require.main === module) {
  app.listen(3000, () => console.log('Server listening on http://localhost:3000'));
}

// [Lab 10] Exposed so tests use the same app and the same database pool the routes use
app.db = db;
app.pgp = pgp;

module.exports = app;
