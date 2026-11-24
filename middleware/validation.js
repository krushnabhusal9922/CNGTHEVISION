// Input and query validation middleware for CNG Connect Station operations

const VALID_AVAILABILITIES = ['available', 'unavailable', 'unknown', 'not_reported'];
const VALID_PRESSURES = ['high', 'medium', 'low', 'unknown'];
const VALID_SORT_OPTIONS = ['default', 'distance', 'wait_time', 'pressure', 'availability', 'last_updated'];

/**
 * Validates request body for creating or updating a station record
 */
function validateStationInput(req, res, next) {
  const {
    name,
    address,
    city,
    area,
    latitude,
    longitude,
    availability_status,
    pressure_status,
    pressure_bar,
    estimated_wait_minutes,
    phone,
    opening_hours,
    source,
    is_demo
  } = req.body;

  const errors = [];

  // Required field checks
  if (!name || typeof name !== 'string' || name.trim().length < 3) {
    errors.push('Station name is required and must be at least 3 characters long.');
  } else if (name.trim().length > 150) {
    errors.push('Station name must not exceed 150 characters.');
  }

  if (!address || typeof address !== 'string' || address.trim().length < 3) {
    errors.push('Station address is required and must be at least 3 characters long.');
  } else if (address.trim().length > 250) {
    errors.push('Station address must not exceed 250 characters.');
  }

  if (!city || typeof city !== 'string' || city.trim().length < 2) {
    errors.push('City is required and must be at least 2 characters long.');
  } else if (city.trim().length > 100) {
    errors.push('City must not exceed 100 characters.');
  }

  if (!area || typeof area !== 'string' || area.trim().length < 2) {
    errors.push('Area / locality is required and must be at least 2 characters long.');
  } else if (area.trim().length > 100) {
    errors.push('Area must not exceed 100 characters.');
  }

  // Latitude validation (-90.0 to 90.0)
  if (latitude === undefined || latitude === null || latitude === '') {
    errors.push('Latitude is required.');
  } else {
    const lat = Number(latitude);
    if (!Number.isFinite(lat) || lat < -90.0 || lat > 90.0) {
      errors.push('Latitude must be a valid number between -90.0 and 90.0.');
    }
  }

  // Longitude validation (-180.0 to 180.0)
  if (longitude === undefined || longitude === null || longitude === '') {
    errors.push('Longitude is required.');
  } else {
    const lng = Number(longitude);
    if (!Number.isFinite(lng) || lng < -180.0 || lng > 180.0) {
      errors.push('Longitude must be a valid number between -180.0 and 180.0.');
    }
  }

  // Availability status validation
  if (!availability_status || !VALID_AVAILABILITIES.includes(String(availability_status).trim().toLowerCase())) {
    errors.push(`Availability status is required and must be one of: ${VALID_AVAILABILITIES.join(', ')}.`);
  }

  // Pressure status validation
  if (pressure_status) {
    if (!VALID_PRESSURES.includes(String(pressure_status).trim().toLowerCase())) {
      errors.push(`Pressure status must be one of: ${VALID_PRESSURES.join(', ')}.`);
    }
  }

  // Pressure bar validation (0 to 500 bar)
  if (pressure_bar !== undefined && pressure_bar !== null && pressure_bar !== '') {
    const pBar = Number(pressure_bar);
    if (!Number.isFinite(pBar) || pBar < 0 || pBar > 500) {
      errors.push('Pressure in bar must be a positive number up to 500 bar.');
    }
  }

  // Wait minutes validation (0 to 600 minutes)
  if (estimated_wait_minutes !== undefined && estimated_wait_minutes !== null && estimated_wait_minutes !== '') {
    const waitMins = Number(estimated_wait_minutes);
    if (!Number.isInteger(waitMins) || waitMins < 0 || waitMins > 600) {
      errors.push('Estimated wait minutes must be a positive integer (0 to 600) or left empty if unknown.');
    }
  }

  // Optional string fields length validation
  if (phone !== undefined && phone !== null && phone !== '') {
    if (typeof phone !== 'string' || phone.trim().length > 50) {
      errors.push('Phone number must not exceed 50 characters.');
    }
  }

  if (opening_hours !== undefined && opening_hours !== null && opening_hours !== '') {
    if (typeof opening_hours !== 'string' || opening_hours.trim().length > 100) {
      errors.push('Opening hours must not exceed 100 characters.');
    }
  }

  if (source !== undefined && source !== null && source !== '') {
    if (typeof source !== 'string' || source.trim().length > 200) {
      errors.push('Source description must not exceed 200 characters.');
    }
  }

  if (is_demo !== undefined && is_demo !== null) {
    const validDemoVals = [0, 1, true, false, '0', '1', 'true', 'false'];
    if (!validDemoVals.includes(is_demo)) {
      errors.push('is_demo must be 1, 0, true, or false.');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid station data provided.',
      errors
    });
  }

  next();
}

/**
 * Validates query parameters for GET /api/stations
 */
function validateStationQueryParams(req, res, next) {
  const { userLat, userLng, maxWait, availability, pressure, sortBy, search, city, area } = req.query;
  const errors = [];

  // Coordinate pairs validation
  const hasLat = userLat !== undefined && userLat !== null && userLat !== '';
  const hasLng = userLng !== undefined && userLng !== null && userLng !== '';

  if (hasLat && !hasLng) {
    errors.push('userLng is required when userLat is provided.');
  } else if (!hasLat && hasLng) {
    errors.push('userLat is required when userLng is provided.');
  } else if (hasLat && hasLng) {
    const lat = Number(userLat);
    const lng = Number(userLng);
    if (!Number.isFinite(lat) || lat < -90.0 || lat > 90.0) {
      errors.push('userLat must be a valid number between -90.0 and 90.0.');
    }
    if (!Number.isFinite(lng) || lng < -180.0 || lng > 180.0) {
      errors.push('userLng must be a valid number between -180.0 and 180.0.');
    }
  }

  // maxWait validation
  if (maxWait !== undefined && maxWait !== null && maxWait !== '') {
    const mw = Number(maxWait);
    if (!Number.isFinite(mw) || mw < 0 || mw > 600) {
      errors.push('maxWait must be a positive number between 0 and 600.');
    }
  }

  // Filter validations
  if (availability && availability !== 'all') {
    if (!VALID_AVAILABILITIES.includes(String(availability).trim().toLowerCase())) {
      errors.push(`availability must be 'all' or one of: ${VALID_AVAILABILITIES.join(', ')}.`);
    }
  }

  if (pressure && pressure !== 'all') {
    if (!VALID_PRESSURES.includes(String(pressure).trim().toLowerCase())) {
      errors.push(`pressure must be 'all' or one of: ${VALID_PRESSURES.join(', ')}.`);
    }
  }

  if (sortBy && sortBy !== 'default') {
    if (!VALID_SORT_OPTIONS.includes(String(sortBy).trim())) {
      errors.push(`sortBy must be one of: ${VALID_SORT_OPTIONS.join(', ')}.`);
    }
  }

  // Search string lengths
  if (search && typeof search === 'string' && search.length > 100) {
    errors.push('search parameter must not exceed 100 characters.');
  }
  if (city && typeof city === 'string' && city.length > 100) {
    errors.push('city parameter must not exceed 100 characters.');
  }
  if (area && typeof area === 'string' && area.length > 100) {
    errors.push('area parameter must not exceed 100 characters.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid query parameters provided.',
      errors
    });
  }

  next();
}

/**
 * Validates that station ID in route parameters is a positive integer
 */
function validateStationIdParam(req, res, next) {
  const rawId = req.params.id;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0 || String(id) !== String(rawId).trim()) {
    return res.status(400).json({
      success: false,
      message: 'Station ID must be a positive integer.'
    });
  }

  req.stationId = id;
  next();
}

module.exports = {
  validateStationInput,
  validateStationQueryParams,
  validateStationIdParam
};
