/**
 * CNG Connect — Administrator Management Module
 * Implements CRUD actions, client & server validation handling,
 * role-based authorization verification, modal dialog workflows, and demo dataset reset actions.
 */

// Admin State
const adminState = {
  stations: [],
  searchFilter: ''
};

// DOM references
const adminElements = {
  adminView: document.getElementById('adminView'),
  adminAuthGate: document.getElementById('adminAuthGate'),
  adminAuthGateTitle: document.getElementById('adminAuthGateTitle'),
  adminAuthGateText: document.getElementById('adminAuthGateText'),
  adminNoticeText: document.getElementById('adminNoticeText'),
  adminTableBody: document.getElementById('adminTableBody'),
  adminTableCount: document.getElementById('adminTableCount'),
  adminSearchInput: document.getElementById('adminSearchInput'),
  openAddStationModalBtn: document.getElementById('openAddStationModalBtn'),
  resetDemoBtn: document.getElementById('resetDemoBtn'),
  // Form Modal
  stationFormModal: document.getElementById('stationFormModal'),
  closeFormModalBtn: document.getElementById('closeFormModalBtn'),
  cancelFormBtn: document.getElementById('cancelFormBtn'),
  stationForm: document.getElementById('stationForm'),
  formModalTitle: document.getElementById('formModalTitle'),
  formErrorBanner: document.getElementById('formErrorBanner'),
  // Fields
  formStationId: document.getElementById('formStationId'),
  formName: document.getElementById('formName'),
  formAddress: document.getElementById('formAddress'),
  formCity: document.getElementById('formCity'),
  formArea: document.getElementById('formArea'),
  formLatitude: document.getElementById('formLatitude'),
  formLongitude: document.getElementById('formLongitude'),
  formAvailability: document.getElementById('formAvailability'),
  formPressureStatus: document.getElementById('formPressureStatus'),
  formPressureBar: document.getElementById('formPressureBar'),
  formWaitMinutes: document.getElementById('formWaitMinutes'),
  formHours: document.getElementById('formHours'),
  formPhone: document.getElementById('formPhone'),
  formSource: document.getElementById('formSource'),
  formIsDemo: document.getElementById('formIsDemo')
};

// Initialize Admin Handlers
document.addEventListener('DOMContentLoaded', () => {
  setupAdminListeners();
});

function setupAdminListeners() {
  if (adminElements.openAddStationModalBtn) {
    adminElements.openAddStationModalBtn.addEventListener('click', openAddModal);
  }

  if (adminElements.closeFormModalBtn) {
    adminElements.closeFormModalBtn.addEventListener('click', closeFormModal);
  }

  if (adminElements.cancelFormBtn) {
    adminElements.cancelFormBtn.addEventListener('click', closeFormModal);
  }

  if (adminElements.stationFormModal) {
    adminElements.stationFormModal.addEventListener('click', (e) => {
      if (e.target === adminElements.stationFormModal) closeFormModal();
    });
  }

  if (adminElements.stationForm) {
    adminElements.stationForm.addEventListener('submit', handleFormSubmit);
  }

  if (adminElements.resetDemoBtn) {
    adminElements.resetDemoBtn.addEventListener('click', handleResetDemo);
  }

  if (adminElements.adminSearchInput) {
    adminElements.adminSearchInput.addEventListener('input', (e) => {
      adminState.searchFilter = e.target.value.toLowerCase().trim();
      renderAdminTable();
    });
  }
}

/**
 * Verifies authorization for the Admin Portal view
 */
function checkAdminViewAccess() {
  const user = window.authState?.user;
  const isAuthorized = user && (user.role === 'admin' || user.role === 'station_manager');

  if (!user) {
    // Unauthenticated: show gate banner
    if (adminElements.adminAuthGate) {
      adminElements.adminAuthGate.style.display = 'block';
      if (adminElements.adminAuthGateTitle) {
        adminElements.adminAuthGateTitle.textContent = 'Administrator Authorization Required';
      }
      if (adminElements.adminAuthGateText) {
        adminElements.adminAuthGateText.textContent =
          'You are browsing in guest mode. Adding, editing, or deleting stations requires an authenticated Administrator or Station Operator session.';
      }
    }
    if (adminElements.openAddStationModalBtn) adminElements.openAddStationModalBtn.disabled = true;
    if (adminElements.resetDemoBtn) adminElements.resetDemoBtn.disabled = true;
  } else if (user.role === 'driver') {
    // Driver role: read-only warning
    if (adminElements.adminAuthGate) {
      adminElements.adminAuthGate.style.display = 'block';
      if (adminElements.adminAuthGateTitle) {
        adminElements.adminAuthGateTitle.textContent = 'Driver Account — Read-Only Mode';
      }
      if (adminElements.adminAuthGateText) {
        adminElements.adminAuthGateText.textContent =
          `Signed in as ${user.name} (Driver). Driver accounts can view station telemetry but cannot modify records. Switch to an Administrator or Operator account to edit.`;
      }
    }
    if (adminElements.openAddStationModalBtn) adminElements.openAddStationModalBtn.disabled = true;
    if (adminElements.resetDemoBtn) adminElements.resetDemoBtn.disabled = true;
  } else {
    // Authorized: admin or station_manager
    if (adminElements.adminAuthGate) {
      adminElements.adminAuthGate.style.display = 'none';
    }
    if (adminElements.openAddStationModalBtn) adminElements.openAddStationModalBtn.disabled = false;
    if (adminElements.resetDemoBtn) adminElements.resetDemoBtn.disabled = false;
    if (adminElements.adminNoticeText) {
      const roleTitle = user.role === 'admin' ? 'Administrator' : 'Station Operator';
      adminElements.adminNoticeText.innerHTML =
        `<strong>Authenticated Session:</strong> ${escapeHtml(user.name)} (${roleTitle}). Station changes are validated against strict coordinate boundaries and schema rules.`;
    }
  }
}

// 1-Click quick demo login helpers
window.loginAsDemoAdmin = async function() {
  if (window.login) {
    await window.login('admin@cngconnect.in', 'Admin@123');
    checkAdminViewAccess();
    loadAdminStations();
  }
};

window.loginAsDemoManager = async function() {
  if (window.login) {
    await window.login('manager@igl.in', 'Manager@123');
    checkAdminViewAccess();
    loadAdminStations();
  }
};

// Helper to attach authorization header if user is logged in
function getAdminHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('cng_auth_token') || (window.authState ? window.authState.token : null);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Load stations for admin table
async function loadAdminStations() {
  try {
    const res = await fetch('/api/stations');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    adminState.stations = json.data || [];
    renderAdminTable();
  } catch (err) {
    console.error('Failed to load admin stations:', err);
    if (window.showToast) window.showToast('Failed to load stations in admin portal.', 'error');
  }
}

// Render Admin Table
function renderAdminTable() {
  const tbody = adminElements.adminTableBody;
  if (!tbody) return;

  const user = window.authState?.user;
  const isAuthorized = user && (user.role === 'admin' || user.role === 'station_manager');

  let filtered = adminState.stations;
  if (adminState.searchFilter) {
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(adminState.searchFilter) ||
        s.city.toLowerCase().includes(adminState.searchFilter) ||
        s.area.toLowerCase().includes(adminState.searchFilter)
    );
  }

  adminElements.adminTableCount.textContent = `Showing ${filtered.length} of ${adminState.stations.length} stations`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
          No stations match "${escapeHtml(adminState.searchFilter)}"
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((s) => {
      const isStale = window.checkIsStale ? window.checkIsStale(s.last_updated_at) : false;
      const lastUp = new Date(s.last_updated_at).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const actionButtons = isAuthorized
        ? `
          <div class="table-action-btns">
            <button class="btn btn-outline btn-sm" onclick="adminOpenEditModal(${s.id})">Edit</button>
            <button class="btn-danger-sm" onclick="adminDeleteStation(${s.id}, '${escapeHtml(s.name)}')">Delete</button>
          </div>
        `
        : `
          <div class="table-action-btns">
            <button class="btn btn-outline btn-sm" onclick="window.openStationDetailModal(${s.id})">View</button>
            <span style="font-size: 0.72rem; color: #94a3b8; font-style: italic;">Locked</span>
          </div>
        `;

      return `
        <tr>
          <td><strong style="color: #64748b;">#${s.id}</strong></td>
          <td>
            <strong>${escapeHtml(s.name)}</strong>
            <div style="font-size: 0.75rem; color: #64748b;">${escapeHtml(s.area)}, ${escapeHtml(s.city)}</div>
          </td>
          <td>
            <span class="status-badge ${s.availability_status}">
              ${formatStatusName(s.availability_status)}
            </span>
          </td>
          <td>
            ${s.pressure_bar ? `<strong>${s.pressure_bar} bar</strong>` : `<span style="color:#94a3b8; font-style:italic;">${escapeHtml(s.pressure_status || 'unknown')}</span>`}
          </td>
          <td>
            ${s.estimated_wait_minutes != null ? `${s.estimated_wait_minutes} mins` : `<span style="color:#94a3b8; font-style:italic;">Unknown</span>`}
          </td>
          <td>
            <span style="font-size: 0.75rem;">${escapeHtml(s.source)}</span>
            ${s.is_demo ? `<br/><span class="cue-tag cue-demo" style="font-size:0.65rem;">Sample Demo</span>` : `<br/><span class="cue-tag cue-verified" style="font-size:0.65rem;">✓ Verified</span>`}
          </td>
          <td>
            <span style="font-size: 0.75rem;">${lastUp}</span>
            ${isStale ? `<br/><span class="cue-tag cue-stale" style="font-size:0.65rem;">⚠️ Stale (>4h)</span>` : ''}
          </td>
          <td style="text-align: right;">
            ${actionButtons}
          </td>
        </tr>
      `;
    })
    .join('');
}

// Open Add Station Modal
function openAddModal() {
  const user = window.authState?.user;
  if (!user || (user.role !== 'admin' && user.role !== 'station_manager')) {
    if (window.showToast) {
      window.showToast('Please sign in as Administrator or Station Operator to add stations.', 'warning');
    }
    if (window.openAuthModal) window.openAuthModal('login');
    return;
  }

  clearFormErrors();
  adminElements.stationForm.reset();
  adminElements.formStationId.value = '';
  adminElements.formModalTitle.textContent = 'Add New CNG Station';
  adminElements.formSource.value = user.role === 'admin' ? 'Admin Verified Entry' : 'Station Operator Telemetry';
  adminElements.formIsDemo.checked = false;
  adminElements.stationFormModal.style.display = 'flex';
}

// Open Edit Station Modal
async function adminOpenEditModal(stationId) {
  const user = window.authState?.user;
  if (!user || (user.role !== 'admin' && user.role !== 'station_manager')) {
    if (window.showToast) {
      window.showToast('Please sign in as Administrator or Station Operator to edit stations.', 'warning');
    }
    if (window.openAuthModal) window.openAuthModal('login');
    return;
  }

  clearFormErrors();
  adminElements.stationForm.reset();
  adminElements.formModalTitle.textContent = `Edit Station #${stationId}`;

  let station = adminState.stations.find((s) => s.id === stationId);
  if (!station) {
    try {
      const res = await fetch(`/api/stations/${stationId}`);
      if (res.ok) {
        const payload = await res.json();
        station = payload.data;
      }
    } catch (e) {
      if (window.showToast) window.showToast('Could not load station for editing.', 'error');
      return;
    }
  }

  if (!station) return;

  // Populate form fields
  adminElements.formStationId.value = station.id;
  adminElements.formName.value = station.name || '';
  adminElements.formAddress.value = station.address || '';
  adminElements.formCity.value = station.city || '';
  adminElements.formArea.value = station.area || '';
  adminElements.formLatitude.value = station.latitude || '';
  adminElements.formLongitude.value = station.longitude || '';
  adminElements.formAvailability.value = station.availability_status || 'available';
  adminElements.formPressureStatus.value = station.pressure_status || 'unknown';
  adminElements.formPressureBar.value = station.pressure_bar != null ? station.pressure_bar : '';
  adminElements.formWaitMinutes.value = station.estimated_wait_minutes != null ? station.estimated_wait_minutes : '';
  adminElements.formHours.value = station.opening_hours || '';
  adminElements.formPhone.value = station.phone || '';
  adminElements.formSource.value = station.source || 'Admin Verified Entry';
  adminElements.formIsDemo.checked = Boolean(station.is_demo);

  adminElements.stationFormModal.style.display = 'flex';
}

function closeFormModal() {
  adminElements.stationFormModal.style.display = 'none';
  clearFormErrors();
}

// Form Submission Handler with Client-Side Validation
async function handleFormSubmit(e) {
  e.preventDefault();
  clearFormErrors();

  const user = window.authState?.user;
  if (!user || (user.role !== 'admin' && user.role !== 'station_manager')) {
    showFormErrors(['Authorization required: You must be signed in as Administrator or Station Operator to save changes.']);
    return;
  }

  const id = adminElements.formStationId.value;
  const isEdit = Boolean(id);

  // Client-side validation checks matching backend schema
  const clientErrors = [];
  const name = adminElements.formName.value.trim();
  const address = adminElements.formAddress.value.trim();
  const city = adminElements.formCity.value.trim();
  const area = adminElements.formArea.value.trim();
  const rawLat = adminElements.formLatitude.value.trim();
  const rawLng = adminElements.formLongitude.value.trim();
  const lat = parseFloat(rawLat);
  const lng = parseFloat(rawLng);

  if (!name || name.length < 3) clientErrors.push('Station name must be at least 3 characters.');
  else if (name.length > 150) clientErrors.push('Station name must not exceed 150 characters.');

  if (!address || address.length < 3) clientErrors.push('Address must be at least 3 characters.');
  else if (address.length > 250) clientErrors.push('Address must not exceed 250 characters.');

  if (!city || city.length < 2) clientErrors.push('City must be at least 2 characters.');
  else if (city.length > 100) clientErrors.push('City must not exceed 100 characters.');

  if (!area || area.length < 2) clientErrors.push('Area / locality must be at least 2 characters.');
  else if (area.length > 100) clientErrors.push('Area must not exceed 100 characters.');

  if (rawLat === '' || isNaN(lat) || !isFinite(lat) || lat < -90.0 || lat > 90.0) {
    clientErrors.push('Latitude must be a valid coordinate between -90.0 and 90.0.');
  }

  if (rawLng === '' || isNaN(lng) || !isFinite(lng) || lng < -180.0 || lng > 180.0) {
    clientErrors.push('Longitude must be a valid coordinate between -180.0 and 180.0.');
  }

  // Pressure bar validation
  const rawPressure = adminElements.formPressureBar.value.trim();
  let pressureBarVal = null;
  if (rawPressure !== '') {
    const pb = parseFloat(rawPressure);
    if (isNaN(pb) || pb < 0 || pb > 500) {
      clientErrors.push('Pressure in bar must be a positive number between 0 and 500.');
    } else {
      pressureBarVal = pb;
    }
  }

  // Wait minutes validation
  const rawWait = adminElements.formWaitMinutes.value.trim();
  let waitMinutesVal = null;
  if (rawWait !== '') {
    const wm = parseInt(rawWait, 10);
    if (isNaN(wm) || wm < 0 || wm > 600) {
      clientErrors.push('Estimated wait minutes must be a positive integer between 0 and 600.');
    } else {
      waitMinutesVal = wm;
    }
  }

  const availStatus = adminElements.formAvailability.value;
  // If unavailable, queue wait is not applicable
  if (availStatus === 'unavailable') {
    waitMinutesVal = null;
  }

  if (clientErrors.length > 0) {
    showFormErrors(clientErrors);
    return;
  }

  const payload = {
    name,
    address,
    city,
    area,
    latitude: lat,
    longitude: lng,
    availability_status: availStatus,
    pressure_status: adminElements.formPressureStatus.value,
    pressure_bar: pressureBarVal,
    estimated_wait_minutes: waitMinutesVal,
    opening_hours: adminElements.formHours.value.trim() || null,
    phone: adminElements.formPhone.value.trim() || null,
    source: adminElements.formSource.value.trim() || (user.role === 'admin' ? 'Admin Verified Entry' : 'Station Operator Telemetry'),
    is_demo: adminElements.formIsDemo.checked ? 1 : 0
  };

  const endpoint = isEdit ? `/api/stations/${id}` : '/api/stations';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(endpoint, {
      method,
      headers: getAdminHeaders(),
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!res.ok) {
      if (result.errors && Array.isArray(result.errors)) {
        showFormErrors(result.errors);
      } else {
        showFormErrors([result.message || 'Server rejected station record.']);
      }
      return;
    }

    // Success!
    closeFormModal();
    if (window.showToast) {
      window.showToast(isEdit ? 'Station record updated successfully!' : 'New station created successfully!', 'success');
    }

    // Refresh views
    loadAdminStations();
    if (window.fetchStations) window.fetchStations();
  } catch (error) {
    console.error('Error submitting station form:', error);
    showFormErrors(['Network or server communication error. Please try again.']);
  }
}

// Delete Station Handler
async function adminDeleteStation(stationId, stationName) {
  const user = window.authState?.user;
  if (!user || (user.role !== 'admin' && user.role !== 'station_manager')) {
    if (window.showToast) {
      window.showToast('Authorization required: You must be signed in as Administrator or Station Operator to delete stations.', 'error');
    }
    return;
  }

  const confirmed = confirm(`Are you sure you want to permanently delete station:\n"${stationName}" (ID #${stationId})?\n\nThis cannot be undone.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/stations/${stationId}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    const result = await res.json();

    if (!res.ok) {
      if (window.showToast) window.showToast(result.message || 'Failed to delete station.', 'error');
      return;
    }

    if (window.showToast) window.showToast(`Station #${stationId} deleted successfully.`, 'success');

    // Refresh views
    loadAdminStations();
    if (window.fetchStations) window.fetchStations();
  } catch (err) {
    console.error('Error deleting station:', err);
    if (window.showToast) window.showToast('Network error while deleting station.', 'error');
  }
}

// Reset Demo Dataset Handler
async function handleResetDemo() {
  const user = window.authState?.user;
  if (!user || (user.role !== 'admin' && user.role !== 'station_manager')) {
    if (window.showToast) {
      window.showToast('Authorization required: Please sign in as Administrator to reset demo data.', 'error');
    }
    return;
  }

  const confirmed = confirm(
    'Reset all station records to the original 15 sample demo stations?\n\nAny added or edited test records will be refreshed.'
  );
  if (!confirmed) return;

  try {
    const res = await fetch('/api/stations/reset-demo', {
      method: 'POST',
      headers: getAdminHeaders()
    });
    const result = await res.json();

    if (!res.ok) {
      if (window.showToast) window.showToast(result.message || 'Failed to reset demo dataset.', 'error');
      return;
    }

    if (window.showToast) window.showToast('Demo dataset successfully restored to 15 stations.', 'success');

    loadAdminStations();
    if (window.fetchStations) window.fetchStations();
  } catch (err) {
    console.error('Error resetting demo dataset:', err);
    if (window.showToast) window.showToast('Network error while resetting demo data.', 'error');
  }
}

// Form Error Display
function showFormErrors(errorList) {
  const banner = adminElements.formErrorBanner;
  if (!banner) return;
  banner.style.display = 'block';
  banner.innerHTML = `<strong>Please correct the following:</strong><ul style="margin-top: 0.25rem; padding-left: 1.25rem;">${errorList
    .map((e) => `<li>${escapeHtml(e)}</li>`)
    .join('')}</ul>`;
}

function clearFormErrors() {
  const banner = adminElements.formErrorBanner;
  if (banner) {
    banner.style.display = 'none';
    banner.innerHTML = '';
  }
}

function formatStatusName(status) {
  switch (status) {
    case 'available': return 'Available';
    case 'unavailable': return 'Unavailable';
    case 'unknown': return 'Unknown';
    case 'not_reported': return 'Not Reported';
    default: return status;
  }
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

// Expose globals for window event triggers
window.adminOpenEditModal = adminOpenEditModal;
window.adminDeleteStation = adminDeleteStation;
window.loadAdminStations = loadAdminStations;
window.checkAdminViewAccess = checkAdminViewAccess;
