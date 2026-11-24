const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../server');
const { seedDatabase } = require('../db/seed');

let server;
let baseUrl;

test.before(async () => {
  seedDatabase();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

test('POST /api/auth/login works for seeded Driver demo user', async () => {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'driver@cngconnect.in',
      password: 'Driver@123'
    }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.user.role, 'driver');
  assert.ok(res.body.token, 'Token should be returned');
});

test('POST /api/auth/login rejects invalid password', async () => {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'driver@cngconnect.in',
      password: 'WrongPassword'
    }
  });

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.success, false);
});

test('POST /api/auth/register creates a new user and returns session token', async () => {
  const randomEmail = `testuser_${Date.now()}@testcng.in`;
  const res = await request('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Vikas Patel',
      email: randomEmail,
      password: 'SecretPassword123',
      role: 'driver',
      phone: '+91 99000 11223',
      vehicle_type: 'Auto Rickshaw (3-Wheeler)'
    }
  });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.user.name, 'Vikas Patel');
  assert.ok(res.body.token);

  // Duplicate registration with same email should return 409
  const dupRes = await request('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Vikas Patel',
      email: randomEmail,
      password: 'SecretPassword123'
    }
  });
  assert.strictEqual(dupRes.status, 409);
});

test('GET /api/auth/me returns profile for authenticated user and protects endpoint', async () => {
  // Without token
  const unauthRes = await request('/api/auth/me');
  assert.strictEqual(unauthRes.status, 401);

  // Log in to get token
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@cngconnect.in',
      password: 'Admin@123'
    }
  });
  const token = loginRes.body.token;

  // With Bearer token
  const authRes = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(authRes.status, 200);
  assert.strictEqual(authRes.body.user.role, 'admin');
  assert.strictEqual(authRes.body.user.email, 'admin@cngconnect.in');
});

test('User can add, list, and delete station favorites', async () => {
  // Login as driver
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'driver@cngconnect.in',
      password: 'Driver@123'
    }
  });
  const token = loginRes.body.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Add station 1 to favorites
  const addRes = await request('/api/auth/favorites/1', {
    method: 'POST',
    headers: authHeaders
  });
  assert.strictEqual(addRes.status, 200);
  assert.strictEqual(addRes.body.success, true);

  // Get favorites list
  const listRes = await request('/api/auth/favorites', {
    headers: authHeaders
  });
  assert.strictEqual(listRes.status, 200);
  assert.ok(listRes.body.data.some((s) => s.id === 1));

  // Remove station 1 from favorites
  const delRes = await request('/api/auth/favorites/1', {
    method: 'DELETE',
    headers: authHeaders
  });
  assert.strictEqual(delRes.status, 200);
  assert.strictEqual(delRes.body.success, true);
});

test('POST /api/auth/logout invalidates token', async () => {
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'driver@cngconnect.in',
      password: 'Driver@123'
    }
  });
  const token = loginRes.body.token;

  const logoutRes = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(logoutRes.status, 200);

  // Me request should now be unauthorized
  const meRes = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(meRes.status, 401);
});
