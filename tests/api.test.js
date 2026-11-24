const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../server');
const { seedDatabase } = require('../db/seed');

let server;
let baseUrl;

test.before(async () => {
  // Ensure fresh seed
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

// Helper for HTTP requests
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
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

test('API Health Check', async () => {
  const res = await request('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'healthy');
  assert.ok(res.body.stationsCount > 0);
});

test('GET /api/stations returns station list with metadata', async () => {
  const res = await request('/api/stations');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.count > 0);
});

test('GET /api/stations?search=Noida filters correctly', async () => {
  const res = await request('/api/stations?search=Noida');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.length > 0);
  const allMatch = res.body.data.every(
    (s) =>
      s.name.includes('Noida') ||
      s.address.includes('Noida') ||
      s.city.includes('Noida') ||
      s.area.includes('Noida')
  );
  assert.strictEqual(allMatch, true);
});

test('GET /api/stations with userLat and userLng calculates straight-line distance', async () => {
  // Test from Connaught Place coords
  const res = await request('/api/stations?userLat=28.6315&userLng=77.2167&sortBy=distance');
  assert.strictEqual(res.status, 200);
  const first = res.body.data[0];
  assert.ok(first.distance_km !== null);
  assert.strictEqual(first.distance_type, 'straight_line_estimate');
  // First item should be very close to Connaught Place
  assert.ok(first.distance_km <= 1.0);
});

test('GET /api/stations/:id retrieves station detail', async () => {
  const res = await request('/api/stations/1');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.id, 1);
  assert.ok(res.body.data.name);
  assert.ok(res.body.data.availability_status);
});

test('GET /api/stations/99999 returns 404 for unknown station', async () => {
  const res = await request('/api/stations/99999');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.success, false);
});

test('GET /api/stations/abc returns 400 for non-numeric ID', async () => {
  const res = await request('/api/stations/abc');
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
});

test('POST /api/stations validates input and rejects missing fields', async () => {
  const res = await request('/api/stations', {
    method: 'POST',
    body: {
      name: 'No Address Station'
      // missing address, city, area, lat, lng, etc.
    }
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
  assert.ok(Array.isArray(res.body.errors));
  assert.ok(res.body.errors.length > 0);
});

test('POST /api/stations validates coordinate bounds', async () => {
  const res = await request('/api/stations', {
    method: 'POST',
    body: {
      name: 'Out of bounds Station',
      address: '123 Fake Street',
      city: 'Delhi',
      area: 'Central',
      latitude: 195.0, // Invalid latitude > 90
      longitude: 77.0,
      availability_status: 'available'
    }
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
  assert.ok(res.body.errors.some((e) => e.includes('Latitude must be a valid number')));
});

test('POST /api/stations successfully creates new station record', async () => {
  const newStation = {
    name: 'Test Shell CNG - Whitefield',
    address: 'ITPL Main Road, Whitefield',
    city: 'Bengaluru',
    area: 'Whitefield',
    latitude: 12.9698,
    longitude: 77.7500,
    phone: '+91 80 1234 5678',
    opening_hours: '24 Hours Open',
    availability_status: 'available',
    pressure_status: 'high',
    pressure_bar: 200,
    estimated_wait_minutes: 10,
    source: 'Automated Test Case',
    is_demo: 1
  };

  const res = await request('/api/stations', {
    method: 'POST',
    body: newStation
  });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.name, newStation.name);
  assert.ok(res.body.data.id > 0);

  // Verify it exists in GET
  const getRes = await request(`/api/stations/${res.body.data.id}`);
  assert.strictEqual(getRes.status, 200);
  assert.strictEqual(getRes.body.data.name, newStation.name);

  // Clean up: delete test station
  const delRes = await request(`/api/stations/${res.body.data.id}`, { method: 'DELETE' });
  assert.strictEqual(delRes.status, 200);
});

test('PUT /api/stations/:id updates an existing station', async () => {
  const updateData = {
    name: 'IGL CNG Mother Station - Connaught Place (Updated)',
    address: 'Near Super Bazar, Outer Circle, Connaught Place',
    city: 'New Delhi',
    area: 'Connaught Place',
    latitude: 28.6315,
    longitude: 77.2167,
    availability_status: 'available',
    pressure_status: 'high',
    pressure_bar: 220,
    estimated_wait_minutes: 5,
    source: 'Admin Verified Test'
  };

  const res = await request('/api/stations/1', {
    method: 'PUT',
    body: updateData
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.name, updateData.name);
  assert.strictEqual(res.body.data.estimated_wait_minutes, 5);
});

test('PUT /api/stations/99999 returns 404 for updating non-existent station', async () => {
  const res = await request('/api/stations/99999', {
    method: 'PUT',
    body: {
      name: 'Non existent Station',
      address: 'Fake Address',
      city: 'Delhi',
      area: 'Center',
      latitude: 28.0,
      longitude: 77.0,
      availability_status: 'available'
    }
  });
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.success, false);
});

test('DELETE /api/stations/99999 returns 404', async () => {
  const res = await request('/api/stations/99999', {
    method: 'DELETE'
  });
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.success, false);
});

test('GET /api/stations/meta/stats returns correct operational metrics', async () => {
  const res = await request('/api/stations/meta/stats');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.totalStations >= 15);
  assert.ok(res.body.data.availableCount >= 0);
  assert.ok(res.body.data.unavailableCount >= 0);
  assert.ok(res.body.data.staleRecordsCount >= 0);
});

test('GET /api/chat/languages returns supported language list', async () => {
  const res = await request('/api/chat/languages');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.languages));
  assert.ok(res.body.languages.length >= 7);
  const hasHindi = res.body.languages.some(l => l.code === 'hi');
  const hasMarathi = res.body.languages.some(l => l.code === 'mr');
  assert.strictEqual(hasHindi, true);
  assert.strictEqual(hasMarathi, true);
});

test('POST /api/chat returns grounded response in English', async () => {
  const res = await request('/api/chat', {
    method: 'POST',
    body: {
      message: 'Find high pressure stations in Delhi',
      language: 'en'
    }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.reply.includes('station'));
  assert.strictEqual(res.body.data.language, 'en');
});

test('POST /api/chat returns grounded response in Hindi', async () => {
  const res = await request('/api/chat', {
    method: 'POST',
    body: {
      message: 'मुंबई में सीएनजी स्टेशन',
      language: 'hi'
    }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.reply.length > 0);
  assert.strictEqual(res.body.data.language, 'hi');
});

test('POST /api/chat rejects empty message with 400', async () => {
  const res = await request('/api/chat', {
    method: 'POST',
    body: {
      message: '',
      language: 'en'
    }
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
});

test('POST /api/chat returns spokenText for voice assistant TTS', async () => {
  const res = await request('/api/chat', {
    method: 'POST',
    body: {
      message: 'Find high pressure stations in Delhi',
      language: 'en'
    }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.spokenText);
  assert.strictEqual(typeof res.body.data.spokenText, 'string');
  assert.ok(res.body.data.spokenText.length > 10);
});

test('POST /api/chat parses voice map command and returns TOGGLE_MAP action', async () => {
  const res = await request('/api/chat', {
    method: 'POST',
    body: {
      message: 'open interactive map',
      language: 'en'
    }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.deepStrictEqual(res.body.data.action, { type: 'TOGGLE_MAP', state: 'show' });
});

test('POST /api/chat parses voice navigation command for admin and home', async () => {
  const adminRes = await request('/api/chat', {
    method: 'POST',
    body: {
      message: 'open admin dashboard',
      language: 'en'
    }
  });
  assert.strictEqual(adminRes.status, 200);
  assert.strictEqual(adminRes.body.data.action.type, 'NAVIGATE');
  assert.strictEqual(adminRes.body.data.action.view, 'admin');

  const homeRes = await request('/api/chat', {
    method: 'POST',
    body: {
      message: 'go to home',
      language: 'en'
    }
  });
  assert.strictEqual(homeRes.status, 200);
  assert.strictEqual(homeRes.body.data.action.type, 'NAVIGATE');
  assert.strictEqual(homeRes.body.data.action.view, 'home');
});

test('GET /api/stations query parameter validation rejects invalid coordinates and filters', async () => {
  // Latitude out of bounds
  const badLatRes = await request('/api/stations?userLat=195.0&userLng=77.0');
  assert.strictEqual(badLatRes.status, 400);
  assert.strictEqual(badLatRes.body.success, false);
  assert.ok(badLatRes.body.errors.some(e => e.includes('userLat must be a valid number')));

  // userLat without userLng
  const missingLngRes = await request('/api/stations?userLat=28.6');
  assert.strictEqual(missingLngRes.status, 400);
  assert.strictEqual(missingLngRes.body.success, false);
  assert.ok(missingLngRes.body.errors.some(e => e.includes('userLng is required')));

  // Negative maxWait
  const negWaitRes = await request('/api/stations?maxWait=-10');
  assert.strictEqual(negWaitRes.status, 400);
  assert.strictEqual(negWaitRes.body.success, false);

  // Invalid availability
  const badAvailRes = await request('/api/stations?availability=bogus_status');
  assert.strictEqual(badAvailRes.status, 400);
  assert.strictEqual(badAvailRes.body.success, false);

  // Invalid sortBy
  const badSortRes = await request('/api/stations?sortBy=unknown_sort');
  assert.strictEqual(badSortRes.status, 400);
  assert.strictEqual(badSortRes.body.success, false);
});

test('GET /api/stations/:id parameter validation rejects non-integer and non-positive IDs', async () => {
  const floatIdRes = await request('/api/stations/1.5');
  assert.strictEqual(floatIdRes.status, 400);
  assert.strictEqual(floatIdRes.body.success, false);

  const zeroIdRes = await request('/api/stations/0');
  assert.strictEqual(zeroIdRes.status, 400);
  assert.strictEqual(zeroIdRes.body.success, false);

  const negIdRes = await request('/api/stations/-5');
  assert.strictEqual(negIdRes.status, 400);
  assert.strictEqual(negIdRes.body.success, false);
});

test('POST /api/stations validates all coordinate boundaries rigorously', async () => {
  const basePayload = {
    name: 'Boundary Test Station',
    address: '123 Border Road',
    city: 'New Delhi',
    area: 'Border Area',
    availability_status: 'available'
  };

  // Latitude > 90
  const latHigh = await request('/api/stations', {
    method: 'POST',
    body: { ...basePayload, latitude: 90.01, longitude: 77.0 }
  });
  assert.strictEqual(latHigh.status, 400);
  assert.ok(latHigh.body.errors.some(e => e.includes('Latitude must be a valid number')));

  // Latitude < -90
  const latLow = await request('/api/stations', {
    method: 'POST',
    body: { ...basePayload, latitude: -90.01, longitude: 77.0 }
  });
  assert.strictEqual(latLow.status, 400);

  // Longitude > 180
  const lngHigh = await request('/api/stations', {
    method: 'POST',
    body: { ...basePayload, latitude: 28.0, longitude: 180.01 }
  });
  assert.strictEqual(lngHigh.status, 400);
  assert.ok(lngHigh.body.errors.some(e => e.includes('Longitude must be a valid number')));

  // Longitude < -180
  const lngLow = await request('/api/stations', {
    method: 'POST',
    body: { ...basePayload, latitude: 28.0, longitude: -180.01 }
  });
  assert.strictEqual(lngLow.status, 400);
});

test('Station values preserve explicit unknown and unreported states without fabrication', async () => {
  // Station #5 in seed dataset is Dwarka with status 'unknown' and null telemetry
  const res = await request('/api/stations/5');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.availability_status, 'unknown');
  assert.strictEqual(res.body.data.estimated_wait_minutes, null);
  assert.strictEqual(res.body.data.pressure_status, 'unknown');
  assert.strictEqual(res.body.data.pressure_bar, null);
  assert.strictEqual(res.body.data.is_demo, true);
  assert.ok(res.body.data.source.includes('Sample Demo Dataset'));

  // Station #7 in seed dataset is Adani Total with status 'not_reported'
  const res7 = await request('/api/stations/7');
  assert.strictEqual(res7.status, 200);
  assert.strictEqual(res7.body.data.availability_status, 'not_reported');
  assert.strictEqual(res7.body.data.estimated_wait_minutes, null);
  assert.strictEqual(res7.body.data.phone, null);
});

test('Role-based station authorization: drivers cannot mutate, admins can', async () => {
  // 1. Log in as driver
  const driverLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'driver@cngconnect.in', password: 'Driver@123' }
  });
  assert.strictEqual(driverLogin.status, 200);
  const driverToken = driverLogin.body.token;

  // Driver attempts to POST a station -> 403 Forbidden
  const driverPostRes = await request('/api/stations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${driverToken}` },
    body: {
      name: 'Unauthorized Station by Driver',
      address: 'Driver Street',
      city: 'Delhi',
      area: 'Central',
      latitude: 28.6,
      longitude: 77.2,
      availability_status: 'available'
    }
  });
  assert.strictEqual(driverPostRes.status, 403);
  assert.strictEqual(driverPostRes.body.success, false);

  // Driver attempts to DELETE station -> 403 Forbidden
  const driverDelRes = await request('/api/stations/1', {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${driverToken}` }
  });
  assert.strictEqual(driverDelRes.status, 403);

  // 2. Log in as admin
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@cngconnect.in', password: 'Admin@123' }
  });
  assert.strictEqual(adminLogin.status, 200);
  const adminToken = adminLogin.body.token;

  // Admin attempts to POST a station -> 201 Created
  const adminPostRes = await request('/api/stations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: {
      name: 'Authorized Admin Station',
      address: 'Admin Boulevard',
      city: 'New Delhi',
      area: 'Connaught Place',
      latitude: 28.63,
      longitude: 77.22,
      availability_status: 'available',
      pressure_status: 'high',
      pressure_bar: 215,
      estimated_wait_minutes: 8
    }
  });
  assert.strictEqual(adminPostRes.status, 201);
  assert.strictEqual(adminPostRes.body.success, true);
  assert.strictEqual(adminPostRes.body.data.source, 'Admin Verified Entry');
  assert.strictEqual(adminPostRes.body.data.is_demo, false);

  // Clean up created station
  const cleanupRes = await request(`/api/stations/${adminPostRes.body.data.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(cleanupRes.status, 200);
});



