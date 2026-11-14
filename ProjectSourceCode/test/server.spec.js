const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../app');
const {db, pgp} = require('../src/db');
const bcrypt = require('bcryptjs');

chai.use(chaiHttp);
const {expect} = chai;

// Root hook: close the shared database pool after all tests in this process.
// Keep other suites in this file or reuse these imports in separate files.
after(() => {
  pgp.end();
});

describe('Welcome route', () => {
  it('returns the default welcome message', async () => {
    const res = await chai.request(app).get('/welcome');
    expect(res).to.have.status(200);
    expect(res.body).to.deep.equal({
      status: 'success',
      message: 'Welcome!',
    });
  });
});

// Add your registration tests below.
describe('POST /register', () => {
  const { randomUUID } = require('node:crypto');
  const testUser = {
    display_name: 'Lab Ten User',
    email: `lab10_${randomUUID()}@colorado.edu`,
    password: 'TestPassword123!',
  };

  afterEach(async () => {
    await db.none('DELETE FROM users WHERE email = $1', [testUser.email]);
  });

  it('creates exactly one user for valid input', async () => {
    const res = await chai.request(app).post('/register').send(testUser);

    expect(res).to.have.status(201);
    expect(res.body.message).to.equal('Registration successful');

    const rows = await db.any(
      'SELECT display_name, password_hash FROM users WHERE email = $1',
      [testUser.email]
    );
    expect(rows).to.have.lengthOf(1);
    expect(rows[0].display_name).to.equal(testUser.display_name);
    expect(await bcrypt.compare(testUser.password, rows[0].password_hash)).to.equal(true);
  });

  it('rejects a missing password and saves nothing', async () => {
    const { password, ...noPassword } = testUser;
    const res = await chai.request(app).post('/register').send(noPassword);

    expect(res).to.have.status(400);
    expect(res.body.error).to.equal('Password must be at least 8 characters');

    const rows = await db.any('SELECT user_id FROM users WHERE email = $1', [testUser.email]);
    expect(rows).to.have.lengthOf(0);
  });
});