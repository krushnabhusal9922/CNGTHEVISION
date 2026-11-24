/**
 * CNG Connect — Driver Discovery Application Logic
 * Implements geolocation, Leaflet interactive map, filtering, sorting,
 * distance calculation transparency, and station profile views.
 */

// Global State
const appState = {
  stations: [],
  userCoords: null, // { latitude, longitude } or null
  activeCity: 'all',
  searchQuery: '',
  filters: {
    availability: 'all',
    pressure: 'all',
    maxWait: 'all',
    sortBy: 'default'
  },
  map: null,
  markersLayer: null,
  userMarker: null,
  selectedStationId: null
};

// DOM Elements
const elements = {
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  geoLocateBtn: document.getElementById('geoLocateBtn'),
  activeLocationPill: document.getElementById('activeLocationPill'),
  locLabelText: document.getElementById('locLabelText'),
  resetLocationBtn: document.getElementById('resetLocationBtn'),
  regionChips: document.querySelectorAll('.region-chip'),
  filterAvailability: document.getElementById('filterAvailability'),
  filterPressure: document.getElementById('filterPressure'),
  filterWaitTime: document.getElementById('filterWaitTime'),
  sortBy: document.getElementById('sortBy'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  stationsContainer: document.getElementById('stationsContainer'),
  resultsCountTitle: document.getElementById('resultsCountTitle'),
  resultsSubTitle: document.getElementById('resultsSubTitle'),
  activeSortNotice: document.getElementById('activeSortNotice'),
  loadingSkeleton: document.getElementById('loadingSkeleton'),
  emptyState: document.getElementById('emptyState'),
  emptyResetBtn: document.getElementById('emptyResetBtn'),
  errorState: document.getElementById('errorState'),
  errorMessageText: document.getElementById('errorMessageText'),
  retryFetchBtn: document.getElementById('retryFetchBtn'),
  toggleMapBtn: document.getElementById('toggleMapBtn'),
  toggleMapText: document.getElementById('toggleMapText'),
  mapSection: document.getElementById('mapSection'),
  headerStationCount: document.getElementById('headerStationCount'),
  headerStatsBtn: document.getElementById('headerStatsBtn'),
  tabHomeBtn: document.getElementById('tabHomeBtn'),
  tabDriverBtn: document.getElementById('tabDriverBtn'),
  tabAdminBtn: document.getElementById('tabAdminBtn'),
  brandLogoBtn: document.getElementById('brandLogoBtn'),
  homeView: document.getElementById('homeView'),
  driverView: document.getElementById('driverView'),
  adminView: document.getElementById('adminView'),
  // Hero Section
  heroSearchInput: document.getElementById('heroSearchInput'),
  heroSearchSubmitBtn: document.getElementById('heroSearchSubmitBtn'),
  heroNearMeBtn: document.getElementById('heroNearMeBtn'),
  heroMapBtn: document.getElementById('heroMapBtn'),
  heroCityChips: document.querySelectorAll('.hero-city-chip'),
  heroStatStations: document.getElementById('heroStatStations'),
  heroStatPressure: document.getElementById('heroStatPressure'),
  heroStatWait: document.getElementById('heroStatWait'),
  // Detail Modal
  stationDetailModal: document.getElementById('stationDetailModal'),
  closeDetailModalBtn: document.getElementById('closeDetailModalBtn'),
  detailDemoBadge: document.getElementById('detailDemoBadge'),
  detailStationName: document.getElementById('detailStationName'),
  detailAreaCity: document.getElementById('detailAreaCity'),
  detailAvailability: document.getElementById('detailAvailability'),
  detailAvailabilitySub: document.getElementById('detailAvailabilitySub'),
  detailPressure: document.getElementById('detailPressure'),
  detailPressureCategory: document.getElementById('detailPressureCategory'),
  detailWaitTime: document.getElementById('detailWaitTime'),
  detailDistance: document.getElementById('detailDistance'),
  detailFullAddress: document.getElementById('detailFullAddress'),
  detailCoords: document.getElementById('detailCoords'),
  detailHours: document.getElementById('detailHours'),
  detailPhone: document.getElementById('detailPhone'),
  detailSource: document.getElementById('detailSource'),
  detailLastUpdated: document.getElementById('detailLastUpdated'),
  detailFreshnessWarning: document.getElementById('detailFreshnessWarning'),
  detailDirectionsBtn: document.getElementById('detailDirectionsBtn'),
  detailAdminEditBtn: document.getElementById('detailAdminEditBtn')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEventListeners();
  fetchStations();
  fetchPlatformStats();
});

// Setup Event Listeners
function setupEventListeners() {
  // Navigation Tabs
  if (elements.brandLogoBtn) {
    elements.brandLogoBtn.addEventListener('click', () => switchView('home'));
  }
  if (elements.tabHomeBtn) {
    elements.tabHomeBtn.addEventListener('click', () => switchView('home'));
  }
  if (elements.tabDriverBtn) {
    elements.tabDriverBtn.addEventListener('click', () => switchView('driver'));
  }
  if (elements.tabAdminBtn) {
    elements.tabAdminBtn.addEventListener('click', () => switchView('admin'));
  }

  // Hero Search Handlers
  if (elements.heroSearchSubmitBtn && elements.heroSearchInput) {
    const handleHeroSearch = () => {
      const q = elements.heroSearchInput.value.trim();
      if (q) {
        appState.searchQuery = q;
        if (elements.searchInput) {
          elements.searchInput.value = q;
          elements.clearSearchBtn.style.display = 'flex';
        }
      }
      switchView('driver');
      fetchStations();
    };

    elements.heroSearchSubmitBtn.addEventListener('click', handleHeroSearch);
    elements.heroSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleHeroSearch();
    });
  }

  if (elements.heroNearMeBtn) {
    elements.heroNearMeBtn.addEventListener('click', () => {
      switchView('driver');
      handleGeolocationRequest();
    });
  }

  if (elements.heroMapBtn) {
    elements.heroMapBtn.addEventListener('click', () => {
      switchView('driver');
      if (elements.mapSection && elements.mapSection.style.display === 'none') {
        elements.mapSection.style.display = 'block';
        elements.toggleMapText.textContent = 'Hide Map';
      }
      if (appState.map) {
        setTimeout(() => appState.map.invalidateSize(), 200);
      }
    });
  }

  // Hero City Chips
  elements.heroCityChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const city = chip.dataset.city;
      exploreCityStations(city);
    });
  });

  // Search input debounce
  let searchTimeout;
  elements.searchInput.addEventListener('input', (e) => {
    appState.searchQuery = e.target.value.trim();
    elements.clearSearchBtn.style.display = appState.searchQuery ? 'flex' : 'none';
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(fetchStations, 250);
  });

  elements.clearSearchBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    appState.searchQuery = '';
    elements.clearSearchBtn.style.display = 'none';
    fetchStations();
  });

  // Region Chips
  elements.regionChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      elements.regionChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      appState.activeCity = chip.dataset.city;
      fetchStations();
    });
  });

  // Geolocation
  elements.geoLocateBtn.addEventListener('click', handleGeolocationRequest);
  elements.resetLocationBtn.addEventListener('click', clearUserLocation);

  // Filters
  elements.filterAvailability.addEventListener('change', (e) => {
    appState.filters.availability = e.target.value;
    fetchStations();
  });

  elements.filterPressure.addEventListener('change', (e) => {
    appState.filters.pressure = e.target.value;
    fetchStations();
  });

  elements.filterWaitTime.addEventListener('change', (e) => {
    appState.filters.maxWait = e.target.value;
    fetchStations();
  });

  elements.sortBy.addEventListener('change', (e) => {
    appState.filters.sortBy = e.target.value;
    updateSortNotice();
    fetchStations();
  });

  elements.resetFiltersBtn.addEventListener('click', resetAllFilters);
  elements.emptyResetBtn.addEventListener('click', resetAllFilters);
  elements.retryFetchBtn.addEventListener('click', fetchStations);

  // Toggle Map
  elements.toggleMapBtn.addEventListener('click', () => {
    const isHidden = elements.mapSection.style.display === 'none';
    elements.mapSection.style.display = isHidden ? 'block' : 'none';
    elements.toggleMapText.textContent = isHidden ? 'Hide Map' : 'Show Map';
    if (isHidden && appState.map) {
      setTimeout(() => appState.map.invalidateSize(), 200);
    }
  });

  // Detail Modal Close
  elements.closeDetailModalBtn.addEventListener('click', closeStationDetailModal);
  elements.stationDetailModal.addEventListener('click', (e) => {
    if (e.target === elements.stationDetailModal) closeStationDetailModal();
  });

  elements.headerStatsBtn.addEventListener('click', () => {
    fetchPlatformStats(true);
  });

  // Detail Modal shortcut to Admin Edit
  elements.detailAdminEditBtn.addEventListener('click', () => {
    if (appState.selectedStationId) {
      closeStationDetailModal();
      switchView('admin');
      if (window.adminOpenEditModal) {
        window.adminOpenEditModal(appState.selectedStationId);
      }
    }
  });

  // Global Keyboard Navigation Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (elements.stationDetailModal && elements.stationDetailModal.style.display === 'flex') {
        closeStationDetailModal();
      }
      const adminModal = document.getElementById('stationFormModal');
      if (adminModal && adminModal.style.display === 'flex') {
        adminModal.style.display = 'none';
      }
      const authModal = document.getElementById('authModal');
      if (authModal && authModal.style.display === 'flex') {
        authModal.style.display = 'none';
      }
      const profileModal = document.getElementById('userProfileModal');
      if (profileModal && profileModal.style.display === 'flex') {
        profileModal.style.display = 'none';
      }
      const chatWidget = document.getElementById('aiChatWidget');
      if (chatWidget && chatWidget.style.display === 'flex') {
        chatWidget.style.display = 'none';
      }
      return;
    }

    // Focus search with '/' when not in input/textarea/select
    if (e.key === '/') {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag !== 'input' && activeTag !== 'textarea' && activeTag !== 'select') {
        e.preventDefault();
        switchView('driver');
        elements.searchInput?.focus();
      }
    }
  });
}

// Switch between Home, Driver, and Admin views
function switchView(view) {
  // Update Tab active classes
  if (elements.tabHomeBtn) elements.tabHomeBtn.classList.toggle('active', view === 'home');
  if (elements.tabDriverBtn) elements.tabDriverBtn.classList.toggle('active', view === 'driver');
  if (elements.tabAdminBtn) elements.tabAdminBtn.classList.toggle('active', view === 'admin');

  // Toggle View Panels
  if (elements.homeView) elements.homeView.style.display = view === 'home' ? 'block' : 'none';
  if (elements.driverView) elements.driverView.style.display = view === 'driver' ? 'flex' : 'none';
  if (elements.adminView) elements.adminView.style.display = view === 'admin' ? 'flex' : 'none';

  if (view === 'driver') {
    if (appState.map) {
      setTimeout(() => appState.map.invalidateSize(), 200);
    }
  } else if (view === 'admin') {
    if (window.checkAdminViewAccess) {
      window.checkAdminViewAccess();
    }
    if (window.loadAdminStations) {
      window.loadAdminStations();
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Explore city from homepage cards or chips
function exploreCityStations(city) {
  appState.activeCity = city;
  elements.regionChips.forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.city === city);
  });
  switchView('driver');
  fetchStations();
}
window.exploreCityStations = exploreCityStations;

// Geolocation Handling
function handleGeolocationRequest() {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser.', 'error');
    return;
  }

  showToast('Locating your position...', 'info');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      appState.userCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      elements.activeLocationPill.style.display = 'inline-flex';
      elements.locLabelText.textContent = `Near You (${position.coords.latitude.toFixed(2)}, ${position.coords.longitude.toFixed(2)})`;
      
      // Auto-set sort to distance if default
      if (elements.sortBy.value === 'default') {
        elements.sortBy.value = 'distance';
        appState.filters.sortBy = 'distance';
      }

      updateUserMapMarker();
      showToast('Location activated. Calculating straight-line distances.', 'success');
      fetchStations();
    },
    (error) => {
      let msg = 'Location access was not granted.';
      if (error.code === error.PERMISSION_DENIED) {
        msg = 'Location permission denied. You can search manually by city or area.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        msg = 'Location information is unavailable.';
      } else if (error.code === error.TIMEOUT) {
        msg = 'Location request timed out. Please try manual search.';
      }
      showToast(msg, 'error');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function clearUserLocation() {
  appState.userCoords = null;
  elements.activeLocationPill.style.display = 'none';
  if (appState.userMarker && appState.map) {
    appState.map.removeLayer(appState.userMarker);
    appState.userMarker = null;
  }
  showToast('Location cleared. Manual search mode active.', 'info');
  fetchStations();
}

function resetAllFilters() {
  elements.searchInput.value = '';
  appState.searchQuery = '';
  elements.clearSearchBtn.style.display = 'none';

  elements.regionChips.forEach((c) => c.classList.remove('active'));
  document.querySelector('.region-chip[data-city="all"]')?.classList.add('active');
  appState.activeCity = 'all';

  elements.filterAvailability.value = 'all';
  appState.filters.availability = 'all';

  elements.filterPressure.value = 'all';
  appState.filters.pressure = 'all';

  elements.filterWaitTime.value = 'all';
  appState.filters.maxWait = 'all';

  elements.sortBy.value = 'default';
  appState.filters.sortBy = 'default';

  updateSortNotice();
  fetchStations();
}

function updateSortNotice() {
  const mapLabel = {
    default: 'Best Fit / Recommended',
    distance: 'Straight-Line Distance (Closest First)',
    wait_time: 'Shortest Waiting Time First',
    pressure: 'Highest Pressure First',
    availability: 'Available Stations First',
    last_updated: 'Recently Updated Telemetry'
  };
  elements.activeSortNotice.textContent = `Sorted by: ${mapLabel[appState.filters.sortBy] || 'Default'}`;
}

// Fetch Stations from REST API
async function fetchStations() {
  showLoading();

  try {
    const params = new URLSearchParams();
    if (appState.searchQuery) params.append('search', appState.searchQuery);
    if (appState.activeCity && appState.activeCity !== 'all') params.append('city', appState.activeCity);
    if (appState.filters.availability !== 'all') params.append('availability', appState.filters.availability);
    if (appState.filters.pressure !== 'all') params.append('pressure', appState.filters.pressure);
    if (appState.filters.maxWait !== 'all') params.append('maxWait', appState.filters.maxWait);
    if (appState.filters.sortBy !== 'default') params.append('sortBy', appState.filters.sortBy);

    if (appState.userCoords) {
      params.append('userLat', appState.userCoords.latitude);
      params.append('userLng', appState.userCoords.longitude);
    }

    const response = await fetch(`/api/stations?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const result = await response.json();
    appState.stations = result.data || [];
    renderStations(appState.stations);
    updateMapMarkers(appState.stations);
  } catch (error) {
    console.error('Error fetching stations:', error);
    showError(error.message);
  }
}

// Fetch Platform Stats
async function fetchPlatformStats(showNotification = false) {
  try {
    const res = await fetch('/api/stations/meta/stats');
    if (res.ok) {
      const data = await res.json();
      const stats = data.data;
      if (elements.headerStationCount) {
        elements.headerStationCount.textContent = `${stats.totalStations} Stations (${stats.availableCount} Available)`;
      }
      const sumTotal = document.getElementById('summaryTotalCount');
      if (sumTotal) sumTotal.textContent = stats.totalStations;
      const sumAvail = document.getElementById('summaryAvailCount');
      if (sumAvail) sumAvail.textContent = stats.availableCount;

      if (showNotification) {
        showToast(
          `Platform Summary: ${stats.totalStations} stations total, ${stats.availableCount} available, ${stats.staleRecordsCount} with stale telemetry (>4h).`,
          'info'
        );
      }
    }
  } catch (e) {
    // Non-critical
  }
}

// Select Station with Bidirectional Map & Card Visual Synchronization
function selectStation(stationId, options = { panMap: true, scrollList: true }) {
  appState.selectedStationId = stationId;

  // 1. Update Card Highlights
  document.querySelectorAll('.station-card').forEach((c) => {
    c.classList.remove('highlighted-card');
    const badge = c.querySelector('.selected-indicator-badge');
    if (badge) badge.style.display = 'none';
  });

  const targetCard = document.getElementById(`station-card-${stationId}`);
  if (targetCard) {
    targetCard.classList.add('highlighted-card');
    const badge = targetCard.querySelector('.selected-indicator-badge');
    if (badge) badge.style.display = 'inline-flex';

    if (options.scrollList) {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // 2. Update Map Markers & Popups
  if (appState.map && appState.markersLayer) {
    appState.markersLayer.eachLayer((marker) => {
      const markerEl = marker.getElement ? marker.getElement() : null;
      const pinEl = markerEl ? markerEl.querySelector('.cng-map-pin') : null;

      if (marker.stationId === stationId) {
        if (pinEl) pinEl.classList.add('active-pin');
        marker.openPopup();
        if (options.panMap && marker.getLatLng) {
          appState.map.panTo(marker.getLatLng(), { animate: true });
        }
      } else if (pinEl) {
        pinEl.classList.remove('active-pin');
      }
    });
  }
}
window.selectStation = selectStation;

// Render Station Cards
function renderStations(stations) {
  hideLoading();

  if (!stations || stations.length === 0) {
    elements.stationsContainer.style.display = 'none';
    elements.emptyState.style.display = 'flex';
    elements.resultsCountTitle.textContent = 'No Stations Found';
    elements.resultsSubTitle.textContent = 'Adjust search parameters to find stations.';
    return;
  }

  elements.emptyState.style.display = 'none';
  elements.stationsContainer.style.display = 'grid';
  elements.resultsCountTitle.textContent = `${stations.length} CNG Station${stations.length > 1 ? 's' : ''}`;
  elements.resultsSubTitle.textContent = appState.userCoords
    ? 'Distances computed via Haversine straight-line formula'
    : 'Showing verified demo network stations';

  elements.stationsContainer.innerHTML = stations.map((s) => buildStationCardHtml(s)).join('');

  // Add click handlers & keyboard accessibility
  stations.forEach((s) => {
    const card = document.getElementById(`station-card-${s.id}`);
    if (card) {
      // Card selection on click
      card.addEventListener('click', (e) => {
        // Only select if not clicking view profile or directions
        if (!e.target.closest('.btn-view-details') && !e.target.closest('a') && !e.target.closest('.fav-btn')) {
          selectStation(s.id, { panMap: true, scrollList: false });
        }
      });

      const viewBtn = card.querySelector('.btn-view-details');
      viewBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        openStationDetailModal(s.id);
      });

      // Pan to map on card hover/focus
      card.addEventListener('mouseenter', () => selectStation(s.id, { panMap: true, scrollList: false }));
      card.addEventListener('focus', () => selectStation(s.id, { panMap: true, scrollList: false }));

      // Keyboard activation for card
      card.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === card) {
          e.preventDefault();
          openStationDetailModal(s.id);
        }
      });
    }
  });

  // Re-highlight currently selected station if present
  if (appState.selectedStationId) {
    selectStation(appState.selectedStationId, { panMap: false, scrollList: false });
  }
}

// Build Station Card HTML
function buildStationCardHtml(station) {
  const availStatus = station.availability_status;
  const availLabel = formatAvailabilityLabel(availStatus);

  // Pressure info
  let pressureDisplay = 'Unknown';
  let pressureClass = 'val-unknown';
  let pressureSub = 'Telemetry not reported';
  if (station.pressure_bar != null) {
    pressureDisplay = `${station.pressure_bar} bar`;
    pressureClass = station.pressure_bar >= 200 ? 'val-green' : station.pressure_bar >= 160 ? 'val-amber' : 'val-red';
    pressureSub = station.pressure_bar >= 200 ? 'Peak (≥200 bar)' : station.pressure_bar >= 160 ? 'Moderate pressure' : 'Low (<160 bar)';
  } else if (station.pressure_status && station.pressure_status !== 'unknown') {
    pressureDisplay = `${capitalize(station.pressure_status)} Press.`;
    pressureClass = station.pressure_status === 'high' ? 'val-green' : 'val-amber';
    pressureSub = 'Estimated category';
  }

  // Wait time info
  let waitDisplay = 'Unknown';
  let waitClass = 'val-unknown';
  let waitSub = 'Queue flux unknown';
  if (availStatus === 'unavailable') {
    waitDisplay = 'N/A';
    waitClass = 'val-red';
    waitSub = 'Station closed';
  } else if (station.estimated_wait_minutes != null) {
    waitDisplay = `~${station.estimated_wait_minutes} mins`;
    waitClass = station.estimated_wait_minutes <= 15 ? 'val-green' : station.estimated_wait_minutes <= 30 ? 'val-amber' : 'val-red';
    waitSub = station.estimated_wait_minutes <= 15 ? 'Minimal queue' : station.estimated_wait_minutes <= 30 ? 'Moderate queue' : 'Heavy queue';
  }

  // Distance info (explicit straight-line label)
  let distanceDisplay = '<span class="val-unknown">GPS needed</span>';
  if (station.distance_km != null) {
    distanceDisplay = `${station.distance_km} km`;
  }

  // Freshness check
  const isStale = checkIsStale(station.last_updated_at);
  const timeAgoStr = formatRelativeTime(station.last_updated_at);

  // Directions URL (Google Maps or OpenStreetMap)
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`;

  // Favorite button
  const isFav = window.authState?.favoriteIds?.has(station.id);
  const favBtnHtml = `
    <button type="button" class="fav-btn ${isFav ? 'active' : ''}" data-station-id="${station.id}" onclick="window.toggleFavoriteStation(${station.id}, event)" title="${isFav ? 'Remove from favorites' : 'Save to favorites'}" aria-label="Favorite station">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  `;

  const isSelected = appState.selectedStationId === station.id;

  return `
    <article class="station-card ${isSelected ? 'highlighted-card' : ''}" id="station-card-${station.id}" tabindex="0" role="region" aria-label="${escapeHtml(station.name)}">
      <!-- Active selection badge -->
      <div class="selected-indicator-badge" style="display: ${isSelected ? 'inline-flex' : 'none'};">
        <span class="selected-pin-icon">📍</span>
        <span>Selected on Map</span>
      </div>

      <div class="station-card-header">
        <div class="card-title-wrap">
          <h3 class="station-card-title">${escapeHtml(station.name)}</h3>
          <p class="station-location-sub">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>${escapeHtml(station.area)}, ${escapeHtml(station.city)}</span>
          </p>
        </div>
        <div class="card-header-badges">
          ${favBtnHtml}
          <span class="status-badge ${availStatus}">${availLabel}</span>
        </div>
      </div>

      <!-- Telemetry Metrics Grid -->
      <div class="card-metrics-row">
        <!-- Distance -->
        <div class="card-metric-col">
          <div class="metric-micro-header">
            <span class="metric-micro-icon">🧭</span>
            <span class="metric-micro-label">Distance</span>
          </div>
          <span class="metric-micro-val" title="Haversine straight-line estimate">${distanceDisplay}</span>
          <span class="metric-micro-sub">Straight-line est.</span>
        </div>

        <!-- Pressure -->
        <div class="card-metric-col">
          <div class="metric-micro-header">
            <span class="metric-micro-icon">⚡</span>
            <span class="metric-micro-label">Pressure</span>
          </div>
          <span class="metric-micro-val ${pressureClass}">${pressureDisplay}</span>
          <span class="metric-micro-sub">${pressureSub}</span>
        </div>

        <!-- Wait Queue -->
        <div class="card-metric-col">
          <div class="metric-micro-header">
            <span class="metric-micro-icon">⏱️</span>
            <span class="metric-micro-label">Est. Queue</span>
          </div>
          <span class="metric-micro-val ${waitClass}">${waitDisplay}</span>
          <span class="metric-micro-sub">${waitSub}</span>
        </div>
      </div>

      <!-- Provenance & Freshness Tags -->
      <div class="card-meta-cues">
        <div class="cues-left">
          <span class="cue-tag" title="Last reported telemetry timestamp">
            🕒 ${timeAgoStr}
          </span>
          ${isStale ? `<span class="cue-tag cue-stale" title="Record updated over 4 hours ago">⚠️ Stale (>4h)</span>` : ''}
        </div>
        <div class="cues-right">
          ${station.is_demo 
            ? `<span class="cue-tag cue-demo" title="Fixed sample demonstration dataset">Sample Demo</span>` 
            : `<span class="cue-tag cue-verified" title="Registered verified network pump">✓ Verified</span>`}
        </div>
      </div>

      <!-- Actions -->
      <div class="card-actions">
        <button type="button" class="btn btn-outline btn-view-details">
          <span>View Profile</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" title="Open navigation destination in Google Maps">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <span>Directions</span>
        </a>
      </div>
    </article>
  `;
}

// Station Profile / Detail Modal
async function openStationDetailModal(stationId) {
  appState.selectedStationId = stationId;

  // Find in state or fetch fresh
  let station = appState.stations.find((s) => s.id === stationId);
  if (!station) {
    try {
      const res = await fetch(`/api/stations/${stationId}`);
      if (res.ok) {
        const payload = await res.json();
        station = payload.data;
      }
    } catch (e) {
      showToast('Could not load station details.', 'error');
      return;
    }
  }

  if (!station) return;

  // Demo / Verified status badge
  if (elements.detailDemoBadge) {
    if (station.is_demo) {
      elements.detailDemoBadge.textContent = 'Sample Demo';
      elements.detailDemoBadge.className = 'badge-demo cue-demo';
      elements.detailDemoBadge.style.display = 'inline-block';
    } else {
      elements.detailDemoBadge.textContent = '✓ Verified Station';
      elements.detailDemoBadge.className = 'badge-demo cue-verified';
      elements.detailDemoBadge.style.display = 'inline-block';
    }
  }

  // Populate Modal Fields
  elements.detailStationName.textContent = station.name;
  elements.detailAreaCity.textContent = `${station.area}, ${station.city}`;
  elements.detailFullAddress.textContent = station.address;
  elements.detailCoords.textContent = `Latitude: ${station.latitude.toFixed(5)}, Longitude: ${station.longitude.toFixed(5)}`;

  // Availability
  const availStatus = station.availability_status;
  elements.detailAvailability.textContent = formatAvailabilityLabel(availStatus);
  elements.detailAvailability.className = `metric-value ${availStatus === 'available' ? 'val-green' : availStatus === 'unavailable' ? 'val-red' : 'val-amber'}`;
  elements.detailAvailabilitySub.textContent =
    availStatus === 'available'
      ? 'Active dispensing reported'
      : availStatus === 'unavailable'
      ? 'Out of gas or maintenance'
      : 'Telemetry pending verification';

  // Pressure
  if (station.pressure_bar != null) {
    elements.detailPressure.textContent = `${station.pressure_bar} bar`;
    elements.detailPressureCategory.textContent = `${capitalize(station.pressure_status || 'measured')} Pressure Level`;
  } else if (station.pressure_status && station.pressure_status !== 'unknown') {
    elements.detailPressure.textContent = `${capitalize(station.pressure_status)}`;
    elements.detailPressureCategory.textContent = 'Estimated category';
  } else {
    elements.detailPressure.textContent = 'Unknown';
    elements.detailPressureCategory.textContent = 'Telemetry not reported';
  }

  // Wait time
  if (availStatus === 'unavailable') {
    elements.detailWaitTime.textContent = 'N/A';
  } else if (station.estimated_wait_minutes != null) {
    elements.detailWaitTime.textContent = `${station.estimated_wait_minutes} mins`;
  } else {
    elements.detailWaitTime.textContent = 'Unknown';
  }

  // Straight line distance
  if (station.distance_km != null) {
    elements.detailDistance.textContent = `${station.distance_km} km (Straight-line est.)`;
  } else {
    elements.detailDistance.textContent = 'Grant GPS for estimate';
  }

  // Operating details
  elements.detailHours.textContent = station.opening_hours || 'Operating hours not provided';
  elements.detailPhone.textContent = station.phone || 'Phone number not available';

  // Telemetry & Source
  elements.detailSource.textContent = station.source || 'Standard Registry Entry';
  elements.detailLastUpdated.textContent = new Date(station.last_updated_at).toLocaleString();

  // Freshness alert
  const isStale = checkIsStale(station.last_updated_at);
  elements.detailFreshnessWarning.style.display = isStale ? 'block' : 'none';

  // Directions Link
  elements.detailDirectionsBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`;

  // Show Modal
  elements.stationDetailModal.style.display = 'flex';
}

function closeStationDetailModal() {
  elements.stationDetailModal.style.display = 'none';
  appState.selectedStationId = null;
}

// Leaflet Map Initialization & Sync
function initMap() {
  try {
    if (typeof L === 'undefined') {
      console.warn('Leaflet library failed to load. Falling back to list-only mode.');
      showMapFallback();
      return;
    }

    // Centered initially around Delhi NCR / National perspective
    appState.map = L.map('cngMap', {
      center: [28.6139, 77.209],
      zoom: 11,
      scrollWheelZoom: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(appState.map);

    appState.markersLayer = L.layerGroup().addTo(appState.map);
  } catch (err) {
    console.warn('Error initializing map:', err);
    showMapFallback();
  }
}

function showMapFallback() {
  const fallback = document.getElementById('mapFallback');
  if (fallback) fallback.style.display = 'block';
  const canvas = document.getElementById('cngMap');
  if (canvas) canvas.style.display = 'none';
}

function updateMapMarkers(stations) {
  if (!appState.map || !appState.markersLayer) return;

  appState.markersLayer.clearLayers();

  if (!stations || stations.length === 0) return;

  const bounds = L.latLngBounds();

  stations.forEach((s) => {
    if (s.latitude && s.longitude) {
      const pinClass = s.availability_status;
      const customIcon = L.divIcon({
        className: 'custom-leaflet-pin',
        html: `<div class="cng-map-pin ${pinClass}" title="${escapeHtml(s.name)}">⛽</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });

      const marker = L.marker([s.latitude, s.longitude], { icon: customIcon });

      const popupContent = `
        <div style="font-family: var(--font-body); min-width: 180px;">
          <strong style="font-size: 0.9rem; display:block; margin-bottom: 2px;">${escapeHtml(s.name)}</strong>
          <span style="font-size: 0.75rem; color: #64748b; display:block; margin-bottom: 6px;">${escapeHtml(s.area)}, ${escapeHtml(s.city)}</span>
          <div style="font-size: 0.78rem; margin-bottom: 8px;">
            Status: <strong>${formatAvailabilityLabel(s.availability_status)}</strong><br/>
            Pressure: <strong>${s.pressure_bar ? s.pressure_bar + ' bar' : 'Unknown'}</strong><br/>
            Wait: <strong>${s.estimated_wait_minutes != null ? s.estimated_wait_minutes + ' mins' : 'Unknown'}</strong>
          </div>
          <button onclick="openStationDetailModal(${s.id})" style="background:#059669; color:#fff; border:none; border-radius:4px; padding:4px 8px; font-size:0.75rem; cursor:pointer; width:100%; font-weight:600;">
            View Station Profile
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.stationId = s.id;

      // Sync map marker click to card in list
      marker.on('click', () => {
        selectStation(s.id, { panMap: false, scrollList: true });
      });

      appState.markersLayer.addLayer(marker);
      bounds.extend([s.latitude, s.longitude]);
    }
  });

  if (appState.userCoords) {
    bounds.extend([appState.userCoords.latitude, appState.userCoords.longitude]);
  }

  if (bounds.isValid()) {
    appState.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
}

function updateUserMapMarker() {
  if (!appState.map || !appState.userCoords) return;

  if (appState.userMarker) {
    appState.map.removeLayer(appState.userMarker);
  }

  const userIcon = L.divIcon({
    className: 'user-pin-wrapper',
    html: '<div class="user-map-pin" title="Your Current Location"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  appState.userMarker = L.marker(
    [appState.userCoords.latitude, appState.userCoords.longitude],
    { icon: userIcon }
  ).addTo(appState.map);

  appState.userMarker.bindPopup('<strong>Your Location</strong><br>Straight-line distances measured from here.');
}

function highlightStationOnMap(stationId) {
  selectStation(stationId, { panMap: true, scrollList: false });
}

// UI Helpers
function showLoading() {
  elements.loadingSkeleton.style.display = 'grid';
  elements.stationsContainer.style.display = 'none';
  elements.emptyState.style.display = 'none';
  elements.errorState.style.display = 'none';
}

function hideLoading() {
  elements.loadingSkeleton.style.display = 'none';
}

function showError(msg) {
  hideLoading();
  elements.stationsContainer.style.display = 'none';
  elements.emptyState.style.display = 'none';
  elements.errorState.style.display = 'flex';
  elements.errorMessageText.textContent = msg || 'Could not connect to CNG station database.';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatAvailabilityLabel(status) {
  switch (status) {
    case 'available': return '🟢 Available';
    case 'unavailable': return '🔴 Unavailable';
    case 'unknown': return '🟡 Unknown';
    case 'not_reported': return '⚪ Not Reported';
    default: return status || 'Unknown';
  }
}

function checkIsStale(isoDateString) {
  if (!isoDateString) return true;
  const updatedTime = new Date(isoDateString).getTime();
  if (isNaN(updatedTime)) return true;
  const staleThresholdMs = 4 * 60 * 60 * 1000; // 4 hours
  return Date.now() - updatedTime > staleThresholdMs;
}

function formatRelativeTime(isoDateString) {
  if (!isoDateString) return 'Time unknown';
  const updatedTime = new Date(isoDateString).getTime();
  if (isNaN(updatedTime)) return 'Time unknown';
  const diffSec = Math.floor((Date.now() - updatedTime) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Expose globals for onclicks & admin
window.appState = appState;
window.openStationDetailModal = openStationDetailModal;
window.fetchStations = fetchStations;
window.checkIsStale = checkIsStale;
window.renderStationCards = renderStations;
window.switchView = switchView;
window.showToast = showToast;
