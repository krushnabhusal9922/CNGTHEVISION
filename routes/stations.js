const express = require('express');
const router = express.Router();
const {
  getStations,
  getStationById,
  createStation,
  updateStation,
  deleteStation,
  getLocationsMetadata,
  getPlatformStats
} = require('../db/database');
const { seedDatabase } = require('../db/seed');
const {
  validateStationInput,
  validateStationQueryParams,
  validateStationIdParam
} = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

/**
 * Helper to enforce that if a user is authenticated, they cannot perform admin mutations
 * if their role is 'driver'. If no authentication header is supplied, allows demo operation
 * while marking record as demo.
 */
function authorizeAdminOrDemo(req, res, next) {
  if (req.user) {
    if (req.user.role === 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Drivers do not have permission to manage station records.'
      });
    }
  }
  next();
}

// GET /api/stations — List with filtering, sorting and straight-line distance calculation
router.get('/', validateStationQueryParams, (req, res) => {
  try {
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
      sortBy
    } = req.query;

    const stations = getStations({
      search,
      city,
      area,
      availability,
      pressure,
      maxWait,
      isDemo,
      userLat,
      userLng,
      sortBy
    });

    res.json({
      success: true,
      count: stations.length,
      filters: {
        search: search || null,
        city: city || null,
        area: area || null,
        availability: availability || null,
        pressure: pressure || null,
        maxWait: maxWait ? Number(maxWait) : null,
        isDemo: isDemo !== undefined ? isDemo : null,
        sortBy: sortBy || 'default',
        userCoordinates:
          userLat && userLng
            ? { latitude: Number(userLat), longitude: Number(userLng) }
            : null
      },
      data: stations
    });
  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve station records. Please try again later.'
    });
  }
});

// GET /api/stations/meta/locations — Distinct cities and areas metadata
router.get('/meta/locations', (req, res) => {
  try {
    const meta = getLocationsMetadata();
    res.json({
      success: true,
      data: meta
    });
  } catch (error) {
    console.error('Error fetching locations metadata:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve location metadata.'
    });
  }
});

// GET /api/stations/meta/stats — Platform telemetry statistics
router.get('/meta/stats', (req, res) => {
  try {
    const stats = getPlatformStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error calculating station stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve platform statistics.'
    });
  }
});

// POST /api/stations/reset-demo — Reset demo dataset helper
router.post('/reset-demo', authenticateToken, authorizeAdminOrDemo, (req, res) => {
  try {
    seedDatabase();
    const stations = getStations();
    res.json({
      success: true,
      message: 'Demo dataset successfully re-seeded.',
      count: stations.length
    });
  } catch (error) {
    console.error('Error resetting demo dataset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset demo dataset.'
    });
  }
});

// GET /api/stations/:id — Single station details
router.get('/:id', validateStationIdParam, (req, res) => {
  try {
    const id = req.stationId;
    const { userLat, userLng } = req.query;

    // Optional coordinate check
    if ((userLat && !userLng) || (!userLat && userLng)) {
      return res.status(400).json({
        success: false,
        message: 'Both userLat and userLng must be provided to compute distance.'
      });
    }

    const station = getStationById(id, userLat, userLng);

    if (!station) {
      return res.status(404).json({
        success: false,
        message: `Station with ID ${id} not found.`
      });
    }

    res.json({
      success: true,
      data: station
    });
  } catch (error) {
    console.error(`Error retrieving station #${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve station details.'
    });
  }
});

// POST /api/stations — Create station record
router.post('/', authenticateToken, authorizeAdminOrDemo, validateStationInput, (req, res) => {
  try {
    const payload = { ...req.body };

    // Tag source based on auth context if available
    if (req.user) {
      if (req.user.role === 'admin') {
        payload.source = payload.source || 'Admin Verified Entry';
        if (payload.is_demo === undefined) payload.is_demo = 0;
      } else if (req.user.role === 'station_manager') {
        payload.source = payload.source || 'Station Operator Telemetry';
        if (payload.is_demo === undefined) payload.is_demo = 0;
      }
    } else {
      payload.source = payload.source || 'Admin Demo Entry';
      if (payload.is_demo === undefined) payload.is_demo = 1;
    }

    const created = createStation(payload);
    res.status(201).json({
      success: true,
      message: 'Station record successfully created.',
      data: created
    });
  } catch (error) {
    console.error('Error creating station:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save station record to database.'
    });
  }
});

// PUT /api/stations/:id — Update existing station record
router.put('/:id', validateStationIdParam, authenticateToken, authorizeAdminOrDemo, validateStationInput, (req, res) => {
  try {
    const id = req.stationId;
    const updated = updateStation(id, req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Station with ID ${id} not found.`
      });
    }

    res.json({
      success: true,
      message: 'Station record successfully updated.',
      data: updated
    });
  } catch (error) {
    console.error(`Error updating station #${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to update station record in database.'
    });
  }
});

// DELETE /api/stations/:id — Delete station record
router.delete('/:id', validateStationIdParam, authenticateToken, authorizeAdminOrDemo, (req, res) => {
  try {
    const id = req.stationId;
    const success = deleteStation(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: `Station with ID ${id} not found.`
      });
    }

    res.json({
      success: true,
      message: `Station with ID ${id} was successfully deleted.`
    });
  } catch (error) {
    console.error(`Error deleting station #${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete station record from database.'
    });
  }
});

module.exports = router;
