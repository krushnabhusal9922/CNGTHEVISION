const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// On serverless platforms like Vercel, the app root is read-only.
// Use os.tmpdir() when running under Vercel or AWS Lambda.
const DB_DIR = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  ? path.join(os.tmpdir(), 'cng_data')
  : path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'cng_connect.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
// Enforce SQLite Foreign Key constraints for relational data integrity
db.exec('PRAGMA foreign_keys = ON;');

// Fallback schema in case schema.sql is not bundled in serverless output
const FALLBACK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  area TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  phone TEXT,
  opening_hours TEXT,
  availability_status TEXT NOT NULL CHECK(availability_status IN ('available', 'unavailable', 'unknown', 'not_reported')),
  pressure_status TEXT CHECK(pressure_status IN ('high', 'medium', 'low', 'unknown')),
  pressure_bar REAL,
  estimated_wait_minutes INTEGER,
  source TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 1 CHECK(is_demo IN (0, 1)),
  last_updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'driver' CHECK(role IN ('driver', 'station_manager', 'admin')),
  phone TEXT,
  vehicle_type TEXT DEFAULT 'Cab / Taxi',
  created_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  station_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, station_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(station_id) REFERENCES stations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_stations_city ON stations(city);
CREATE INDEX IF NOT EXISTS idx_stations_area ON stations(area);
CREATE INDEX IF NOT EXISTS idx_stations_availability ON stations(availability_status);
CREATE INDEX IF NOT EXISTS idx_stations_coords ON stations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON user_favorites(user_id);
`;

// Initialize schema
function initSchema() {
  let schemaSql;
  try {
    schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  } catch (err) {
    schemaSql = FALLBACK_SCHEMA_SQL;
  }
  db.exec(schemaSql);
  seedInitialUsers();
}

// Calculate straight-line distance in km (Haversine formula)
function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (!Number.isFinite(nLat1) || !Number.isFinite(nLon1) || !Number.isFinite(nLat2) || !Number.isFinite(nLon2)) return null;

  // Strict coordinate boundary verification (-90..90 for latitude, -180..180 for longitude)
  if (nLat1 < -90 || nLat1 > 90 || nLat2 < -90 || nLat2 > 90) return null;
  if (nLon1 < -180 || nLon1 > 180 || nLon2 < -180 || nLon2 > 180) return null;

  // Identical point fast path
  if (nLat1 === nLat2 && nLon1 === nLon2) return 0.0;

  const R = 6371; // Earth radius in kilometers
  const dLat = (nLat2 - nLat1) * (Math.PI / 180);
  const dLon = (nLon2 - nLon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(nLat1 * (Math.PI / 180)) *
      Math.cos(nLat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  // Guard floating-point rounding exceeding 1
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

// Query stations with flexible filtering and sorting
function getStations(options = {}) {
  const {
    search,
    city,
    area,
    availability,
    pressure,
    maxWait,
    isDemo,
    userLat,
    userLng,
    sortBy = 'default'
  } = options;

  let query = 'SELECT * FROM stations WHERE 1=1';
  const params = [];

  if (search && typeof search === 'string' && search.trim()) {
    query += ' AND (name LIKE ? OR address LIKE ? OR area LIKE ? OR city LIKE ?)';
    const searchPattern = `%${search.trim()}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (city && typeof city === 'string' && city.trim() && city.toLowerCase() !== 'all') {
    query += ' AND LOWER(city) = LOWER(?)';
    params.push(city.trim());
  }

  if (area && typeof area === 'string' && area.trim() && area.toLowerCase() !== 'all') {
    query += ' AND LOWER(area) = LOWER(?)';
    params.push(area.trim());
  }

  if (availability && typeof availability === 'string' && availability.trim() && availability.toLowerCase() !== 'all') {
    query += ' AND availability_status = ?';
    params.push(availability.trim().toLowerCase());
  }

  if (pressure && typeof pressure === 'string' && pressure.trim() && pressure.toLowerCase() !== 'all') {
    query += ' AND pressure_status = ?';
    params.push(pressure.trim().toLowerCase());
  }

  if (maxWait != null && maxWait !== '' && !isNaN(Number(maxWait)) && Number(maxWait) >= 0) {
    query += ' AND (estimated_wait_minutes IS NOT NULL AND estimated_wait_minutes <= ?)';
    params.push(Math.floor(Number(maxWait)));
  }

  if (isDemo !== undefined && isDemo !== null && isDemo !== 'all') {
    const demoVal = (isDemo === 'true' || isDemo === true || isDemo === '1' || isDemo === 1) ? 1 : 0;
    query += ' AND is_demo = ?';
    params.push(demoVal);
  }

  const stmt = db.prepare(query);
  let rows = stmt.all(...params);

  // Parse numeric coordinates and validate bounds (-90..90, -180..180)
  const hasLat = userLat != null && userLat !== '' && !isNaN(Number(userLat));
  const hasLng = userLng != null && userLng !== '' && !isNaN(Number(userLng));
  const rawLat = hasLat ? Number(userLat) : null;
  const rawLng = hasLng ? Number(userLng) : null;
  const isValidCoords =
    rawLat !== null &&
    rawLng !== null &&
    rawLat >= -90 &&
    rawLat <= 90 &&
    rawLng >= -180 &&
    rawLng <= 180;

  const parsedUserLat = isValidCoords ? rawLat : null;
  const parsedUserLng = isValidCoords ? rawLng : null;

  rows = rows.map((row) => {
    let distanceKm = null;
    if (parsedUserLat != null && parsedUserLng != null) {
      distanceKm = calculateHaversineDistanceKm(
        parsedUserLat,
        parsedUserLng,
        row.latitude,
        row.longitude
      );
    }

    return {
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      area: row.area,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      phone: row.phone || null,
      opening_hours: row.opening_hours || null,
      availability_status: row.availability_status,
      pressure_status: row.pressure_status || 'unknown',
      pressure_bar: row.pressure_bar != null ? Number(row.pressure_bar) : null,
      estimated_wait_minutes: row.estimated_wait_minutes != null ? Number(row.estimated_wait_minutes) : null,
      source: row.source,
      is_demo: Boolean(row.is_demo),
      last_updated_at: row.last_updated_at,
      created_at: row.created_at,
      distance_km: distanceKm,
      distance_type: distanceKm !== null ? 'straight_line_estimate' : null
    };
  });

  // Sorting
  // Rule from specs: "Unknown values should not be treated as better than known values."
  // Distinguish unknown values honestly.
  if (sortBy === 'distance' && parsedUserLat != null && parsedUserLng != null) {
    rows.sort((a, b) => {
      if (a.distance_km === null && b.distance_km === null) return a.id - b.id;
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      const diff = a.distance_km - b.distance_km;
      return diff !== 0 ? diff : a.id - b.id;
    });
  } else if (sortBy === 'wait_time') {
    rows.sort((a, b) => {
      // Put stations with known wait time first, ascending. Stations with unknown wait time go to bottom.
      if (a.estimated_wait_minutes === null && b.estimated_wait_minutes === null) return a.id - b.id;
      if (a.estimated_wait_minutes === null) return 1;
      if (b.estimated_wait_minutes === null) return -1;
      const diff = a.estimated_wait_minutes - b.estimated_wait_minutes;
      return diff !== 0 ? diff : a.id - b.id;
    });
  } else if (sortBy === 'pressure') {
    const rankMap = { high: 3, medium: 2, low: 1, unknown: 0, null: 0 };
    rows.sort((a, b) => {
      const rankA = rankMap[a.pressure_status] || 0;
      const rankB = rankMap[b.pressure_status] || 0;
      if (rankB !== rankA) return rankB - rankA;
      // Tie breaker by pressure_bar if known
      const pDiff = (b.pressure_bar || 0) - (a.pressure_bar || 0);
      return pDiff !== 0 ? pDiff : a.id - b.id;
    });
  } else if (sortBy === 'availability') {
    const availRank = { available: 4, unknown: 3, not_reported: 2, unavailable: 1 };
    rows.sort((a, b) => {
      const diff = (availRank[b.availability_status] || 0) - (availRank[a.availability_status] || 0);
      return diff !== 0 ? diff : a.id - b.id;
    });
  } else if (sortBy === 'last_updated') {
    rows.sort((a, b) => new Date(b.last_updated_at) - new Date(a.last_updated_at));
  } else {
    // Default sorting: if distance available sort by distance, else available first then id
    if (parsedUserLat != null && parsedUserLng != null) {
      rows.sort((a, b) => {
        const distA = a.distance_km !== null ? a.distance_km : 99999;
        const distB = b.distance_km !== null ? b.distance_km : 99999;
        const diff = distA - distB;
        return diff !== 0 ? diff : a.id - b.id;
      });
    } else {
      const availRank = { available: 4, unknown: 3, not_reported: 2, unavailable: 1 };
      rows.sort((a, b) => {
        const diff = (availRank[b.availability_status] || 0) - (availRank[a.availability_status] || 0);
        if (diff !== 0) return diff;
        return a.id - b.id;
      });
    }
  }

  return rows;
}

// Get single station by ID
function getStationById(id, userLat, userLng) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) return null;

  const stmt = db.prepare('SELECT * FROM stations WHERE id = ?');
  const row = stmt.get(numId);
  if (!row) return null;

  let distanceKm = null;
  const hasLat = userLat != null && userLat !== '' && !isNaN(Number(userLat));
  const hasLng = userLng != null && userLng !== '' && !isNaN(Number(userLng));
  const rawLat = hasLat ? Number(userLat) : null;
  const rawLng = hasLng ? Number(userLng) : null;
  const isValidCoords =
    rawLat !== null &&
    rawLng !== null &&
    rawLat >= -90 &&
    rawLat <= 90 &&
    rawLng >= -180 &&
    rawLng <= 180;

  if (isValidCoords) {
    distanceKm = calculateHaversineDistanceKm(
      rawLat,
      rawLng,
      row.latitude,
      row.longitude
    );
  }

  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    area: row.area,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    phone: row.phone || null,
    opening_hours: row.opening_hours || null,
    availability_status: row.availability_status,
    pressure_status: row.pressure_status || 'unknown',
    pressure_bar: row.pressure_bar != null ? Number(row.pressure_bar) : null,
    estimated_wait_minutes: row.estimated_wait_minutes != null ? Number(row.estimated_wait_minutes) : null,
    source: row.source,
    is_demo: Boolean(row.is_demo),
    last_updated_at: row.last_updated_at,
    created_at: row.created_at,
    distance_km: distanceKm,
    distance_type: distanceKm !== null ? 'straight_line_estimate' : null
  };
}

// Insert new station
function createStation(data) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO stations (
      name, address, city, area, latitude, longitude,
      phone, opening_hours, availability_status, pressure_status,
      pressure_bar, estimated_wait_minutes, source, is_demo,
      last_updated_at, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
  `);

  const pressureBar =
    data.pressure_bar !== undefined && data.pressure_bar !== null && data.pressure_bar !== ''
      ? Number(data.pressure_bar)
      : null;

  // Unavailable stations do not have an active queue wait time
  let estimatedWait =
    data.estimated_wait_minutes !== undefined && data.estimated_wait_minutes !== null && data.estimated_wait_minutes !== ''
      ? Number(data.estimated_wait_minutes)
      : null;
  if (data.availability_status === 'unavailable') {
    estimatedWait = null;
  }

  const result = stmt.run(
    String(data.name).trim(),
    String(data.address).trim(),
    String(data.city).trim(),
    String(data.area).trim(),
    Number(data.latitude),
    Number(data.longitude),
    data.phone ? String(data.phone).trim() : null,
    data.opening_hours ? String(data.opening_hours).trim() : null,
    String(data.availability_status).trim().toLowerCase(),
    data.pressure_status ? String(data.pressure_status).trim().toLowerCase() : 'unknown',
    pressureBar,
    estimatedWait,
    data.source ? String(data.source).trim() : 'Admin Entry',
    data.is_demo !== undefined ? (data.is_demo ? 1 : 0) : 1,
    data.last_updated_at ? new Date(data.last_updated_at).toISOString() : now,
    now
  );

  return getStationById(result.lastInsertRowid);
}

// Update station
function updateStation(id, data) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) return null;

  const existing = getStationById(numId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE stations SET
      name = ?,
      address = ?,
      city = ?,
      area = ?,
      latitude = ?,
      longitude = ?,
      phone = ?,
      opening_hours = ?,
      availability_status = ?,
      pressure_status = ?,
      pressure_bar = ?,
      estimated_wait_minutes = ?,
      source = ?,
      is_demo = ?,
      last_updated_at = ?
    WHERE id = ?
  `);

  const availStatus = data.availability_status !== undefined
    ? String(data.availability_status).trim().toLowerCase()
    : existing.availability_status;

  let waitMinutes = existing.estimated_wait_minutes;
  if (data.estimated_wait_minutes !== undefined) {
    waitMinutes = data.estimated_wait_minutes !== null && data.estimated_wait_minutes !== ''
      ? Number(data.estimated_wait_minutes)
      : null;
  }
  if (availStatus === 'unavailable') {
    waitMinutes = null;
  }

  let pressureBar = existing.pressure_bar;
  if (data.pressure_bar !== undefined) {
    pressureBar = data.pressure_bar !== null && data.pressure_bar !== ''
      ? Number(data.pressure_bar)
      : null;
  }

  stmt.run(
    data.name !== undefined ? String(data.name).trim() : existing.name,
    data.address !== undefined ? String(data.address).trim() : existing.address,
    data.city !== undefined ? String(data.city).trim() : existing.city,
    data.area !== undefined ? String(data.area).trim() : existing.area,
    data.latitude !== undefined ? Number(data.latitude) : existing.latitude,
    data.longitude !== undefined ? Number(data.longitude) : existing.longitude,
    data.phone !== undefined ? (data.phone ? String(data.phone).trim() : null) : existing.phone,
    data.opening_hours !== undefined ? (data.opening_hours ? String(data.opening_hours).trim() : null) : existing.opening_hours,
    availStatus,
    data.pressure_status !== undefined ? String(data.pressure_status).trim().toLowerCase() : existing.pressure_status,
    pressureBar,
    waitMinutes,
    data.source !== undefined ? String(data.source).trim() : existing.source,
    data.is_demo !== undefined ? (data.is_demo ? 1 : 0) : (existing.is_demo ? 1 : 0),
    data.last_updated_at ? new Date(data.last_updated_at).toISOString() : now,
    numId
  );

  return getStationById(numId);
}

// Delete station
function deleteStation(id) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) return false;

  const existing = getStationById(numId);
  if (!existing) return false;

  const stmt = db.prepare('DELETE FROM stations WHERE id = ?');
  stmt.run(numId);
  return true;
}

// Get distinct cities and areas for search filters
function getLocationsMetadata() {
  const cities = db.prepare('SELECT DISTINCT city FROM stations ORDER BY city ASC').all().map(r => r.city);
  const areas = db.prepare('SELECT DISTINCT area, city FROM stations ORDER BY area ASC').all();
  return { cities, areas };
}

// ==========================================
// USER AUTHENTICATION & SESSIONS HELPERS
// ==========================================

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createUser(userData) {
  const { name, email, password, role = 'driver', phone = null, vehicle_type = 'Cab / Taxi' } = userData;
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO users (name, email, password_hash, salt, role, phone, vehicle_type, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    name.trim(),
    email.trim().toLowerCase(),
    passwordHash,
    salt,
    role,
    phone ? phone.trim() : null,
    vehicle_type ? vehicle_type.trim() : 'Cab / Taxi',
    now,
    null
  );

  return findUserById(result.lastInsertRowid);
}

function findUserByEmail(email) {
  if (!email) return null;
  const stmt = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)');
  return stmt.get(email.trim());
}

function findUserById(id) {
  if (!id) return null;
  const stmt = db.prepare('SELECT id, name, email, role, phone, vehicle_type, created_at, last_login_at FROM users WHERE id = ?');
  return stmt.get(Number(id));
}

function verifyPassword(password, user) {
  if (!password || !user || !user.salt || !user.password_hash) return false;
  const hashed = hashPassword(password, user.salt);
  return hashed === user.password_hash;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  const createdAt = now.toISOString();

  const stmt = db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(token, Number(userId), expiresAt, createdAt);

  // Update last_login_at
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(createdAt, Number(userId));

  return { token, expiresAt };
}

function validateSession(token) {
  if (!token) return null;
  try {
    const stmt = db.prepare(`
      SELECT s.token, s.expires_at, u.id, u.name, u.email, u.role, u.phone, u.vehicle_type, u.created_at, u.last_login_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ?
    `);
    const row = stmt.get(token);
    if (!row) return null;

    if (new Date(row.expires_at) < new Date()) {
      deleteSession(token);
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      phone: row.phone,
      vehicle_type: row.vehicle_type,
      created_at: row.created_at,
      last_login_at: row.last_login_at
    };
  } catch (err) {
    return null;
  }
}

function deleteSession(token) {
  if (!token) return;
  try {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  } catch (err) {}
}

function seedInitialUsers() {
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (!row || row.count === 0) {
      const defaultUsers = [
        {
          name: 'System Administrator',
          email: 'admin@cngconnect.in',
          password: 'Admin@123',
          role: 'admin',
          phone: '+91 11 9988 7766',
          vehicle_type: 'Operations Patrol'
        },
        {
          name: 'Rajesh Sharma',
          email: 'driver@cngconnect.in',
          password: 'Driver@123',
          role: 'driver',
          phone: '+91 98765 43210',
          vehicle_type: 'Cab / Taxi (Dzire CNG)'
        },
        {
          name: 'IGL Station Manager',
          email: 'manager@igl.in',
          password: 'Manager@123',
          role: 'station_manager',
          phone: '+91 98111 22334',
          vehicle_type: 'Station Operator'
        }
      ];

      for (const u of defaultUsers) {
        createUser(u);
      }
    }
  } catch (err) {
    console.error('[Auth] Error seeding users:', err.message);
  }
}

function getUserFavorites(userId) {
  try {
    const stmt = db.prepare(`
      SELECT s.*, uf.created_at as favorited_at
      FROM user_favorites uf
      JOIN stations s ON uf.station_id = s.id
      WHERE uf.user_id = ?
      ORDER BY uf.created_at DESC
    `);
    return stmt.all(Number(userId));
  } catch (err) {
    return [];
  }
}

function getUserFavoriteIds(userId) {
  try {
    const stmt = db.prepare('SELECT station_id FROM user_favorites WHERE user_id = ?');
    return stmt.all(Number(userId)).map(r => r.station_id);
  } catch (err) {
    return [];
  }
}

function addFavorite(userId, stationId) {
  const now = new Date().toISOString();
  try {
    db.prepare('INSERT OR IGNORE INTO user_favorites (user_id, station_id, created_at) VALUES (?, ?, ?)')
      .run(Number(userId), Number(stationId), now);
    return true;
  } catch (err) {
    return false;
  }
}

function removeFavorite(userId, stationId) {
  try {
    db.prepare('DELETE FROM user_favorites WHERE user_id = ? AND station_id = ?')
      .run(Number(userId), Number(stationId));
    return true;
  } catch (err) {
    return false;
  }
}

function getPlatformStats() {
  const counts = db.prepare(`
    SELECT
      COUNT(*) as totalStations,
      SUM(CASE WHEN availability_status = 'available' THEN 1 ELSE 0 END) as availableCount,
      SUM(CASE WHEN availability_status = 'unavailable' THEN 1 ELSE 0 END) as unavailableCount,
      SUM(CASE WHEN availability_status IN ('unknown', 'not_reported') THEN 1 ELSE 0 END) as unknownOrUnreportedCount,
      SUM(CASE WHEN is_demo = 1 THEN 1 ELSE 0 END) as demoRecordsCount
    FROM stations
  `).get();

  const staleThresholdMs = 4 * 60 * 60 * 1000;
  const now = Date.now();
  const rows = db.prepare('SELECT last_updated_at FROM stations').all();
  const staleCount = rows.filter(s => {
    const updatedTime = new Date(s.last_updated_at).getTime();
    return isNaN(updatedTime) || (now - updatedTime) > staleThresholdMs;
  }).length;

  return {
    totalStations: counts.totalStations || 0,
    availableCount: counts.availableCount || 0,
    unavailableCount: counts.unavailableCount || 0,
    unknownOrUnreportedCount: counts.unknownOrUnreportedCount || 0,
    staleRecordsCount: staleCount,
    demoRecordsCount: counts.demoRecordsCount || 0
  };
}

// Initialize on startup
initSchema();

module.exports = {
  db,
  initSchema,
  calculateHaversineDistanceKm,
  getStations,
  getStationById,
  createStation,
  updateStation,
  deleteStation,
  getLocationsMetadata,
  getPlatformStats,
  // User auth exports
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  createSession,
  validateSession,
  deleteSession,
  getUserFavorites,
  getUserFavoriteIds,
  addFavorite,
  removeFavorite
};

