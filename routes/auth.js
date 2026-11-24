const express = require('express');
const router = express.Router();
const {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  createSession,
  deleteSession,
  getUserFavorites,
  getUserFavoriteIds,
  addFavorite,
  removeFavorite,
  getStationById
} = require('../db/database');
const { requireAuth, authenticateToken } = require('../middleware/auth');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { name, email, password, role, phone, vehicle_type } = req.body;
    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.push('Full name must be at least 2 characters.');
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      errors.push('A valid email address is required.');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      errors.push('Password must be at least 6 characters long.');
    }

    const validRoles = ['driver', 'station_manager', 'admin'];
    const assignedRole = role && validRoles.includes(role) ? role : 'driver';

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const existing = findUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.'
      });
    }

    const user = createUser({
      name,
      email,
      password,
      role: assignedRole,
      phone: phone || null,
      vehicle_type: vehicle_type || 'Cab / Taxi'
    });

    const session = createSession(user.id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token: session.token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        vehicle_type: user.vehicle_type
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Failed to create account.' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const user = findUserByEmail(email);
    if (!user || !verifyPassword(password, user)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const session = createSession(user.id);

    res.json({
      success: true,
      message: 'Logged in successfully!',
      token: session.token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        vehicle_type: user.vehicle_type
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed due to a server error.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const favoriteIds = getUserFavoriteIds(req.user.id);
  res.json({
    success: true,
    user: req.user,
    favoriteIds
  });
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  if (req.token) {
    deleteSession(req.token);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/favorites
router.get('/favorites', requireAuth, (req, res) => {
  const favorites = getUserFavorites(req.user.id);
  res.json({
    success: true,
    count: favorites.length,
    data: favorites
  });
});

// POST /api/auth/favorites/:stationId
router.post('/favorites/:stationId', requireAuth, (req, res) => {
  const stationId = Number(req.params.stationId);
  const station = getStationById(stationId);
  if (!station) {
    return res.status(404).json({ success: false, message: 'Station not found.' });
  }

  addFavorite(req.user.id, stationId);
  res.json({
    success: true,
    message: 'Station added to your favorites.',
    stationId
  });
});

// DELETE /api/auth/favorites/:stationId
router.delete('/favorites/:stationId', requireAuth, (req, res) => {
  const stationId = Number(req.params.stationId);
  removeFavorite(req.user.id, stationId);
  res.json({
    success: true,
    message: 'Station removed from favorites.',
    stationId
  });
});

module.exports = router;
