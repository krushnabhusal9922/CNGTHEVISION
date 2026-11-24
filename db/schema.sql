-- CNG Connect SQL Schema
-- Station records table with operational status, source and freshness metadata

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

-- Users table for Driver, Station Manager and Administrator authentication
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

-- Sessions table for token authentication
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User favorite stations
CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  station_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, station_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(station_id) REFERENCES stations(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stations_city ON stations(city);
CREATE INDEX IF NOT EXISTS idx_stations_area ON stations(area);
CREATE INDEX IF NOT EXISTS idx_stations_availability ON stations(availability_status);
CREATE INDEX IF NOT EXISTS idx_stations_coords ON stations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON user_favorites(user_id);
