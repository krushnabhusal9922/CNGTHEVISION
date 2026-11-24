/**
 * CNG Connect — User Authentication, Profiles & Favorites State Management
 */

const authState = {
  user: null,
  token: localStorage.getItem('cng_auth_token') || null,
  favoriteIds: new Set()
};

// DOM references for Auth
const authElements = {
  // Navigation elements
  navGuestControls: document.getElementById('navGuestControls'),
  navUserControls: document.getElementById('navUserControls'),
  navLoginBtn: document.getElementById('navLoginBtn'),
  navRegisterBtn: document.getElementById('navRegisterBtn'),
  navUserMenuBtn: document.getElementById('navUserMenuBtn'),
  navUserNameText: document.getElementById('navUserNameText'),
  navUserRoleBadge: document.getElementById('navUserRoleBadge'),
  userDropdownMenu: document.getElementById('userDropdownMenu'),
  dropdownProfileBtn: document.getElementById('dropdownProfileBtn'),
  dropdownFavoritesBtn: document.getElementById('dropdownFavoritesBtn'),
  dropdownLogoutBtn: document.getElementById('dropdownLogoutBtn'),

  // Auth Modal
  authModal: document.getElementById('authModal'),
  closeAuthModalBtn: document.getElementById('closeAuthModalBtn'),
  authTabLogin: document.getElementById('authTabLogin'),
  authTabRegister: document.getElementById('authTabRegister'),
  authLoginFormWrapper: document.getElementById('authLoginFormWrapper'),
  authRegisterFormWrapper: document.getElementById('authRegisterFormWrapper'),

  // Forms
  loginForm: document.getElementById('loginForm'),
  loginEmailInput: document.getElementById('loginEmailInput'),
  loginPasswordInput: document.getElementById('loginPasswordInput'),
  loginErrorBanner: document.getElementById('loginErrorBanner'),
  switchToRegisterBtn: document.getElementById('switchToRegisterBtn'),

  registerForm: document.getElementById('registerForm'),
  registerNameInput: document.getElementById('registerNameInput'),
  registerEmailInput: document.getElementById('registerEmailInput'),
  registerPhoneInput: document.getElementById('registerPhoneInput'),
  registerVehicleInput: document.getElementById('registerVehicleInput'),
  registerRoleInput: document.getElementById('registerRoleInput'),
  registerPasswordInput: document.getElementById('registerPasswordInput'),
  registerConfirmPasswordInput: document.getElementById('registerConfirmPasswordInput'),
  registerErrorBanner: document.getElementById('registerErrorBanner'),
  switchToLoginBtn: document.getElementById('switchToLoginBtn'),

  // Demo Quick-Login Buttons
  demoDriverBtn: document.getElementById('demoDriverBtn'),
  demoAdminBtn: document.getElementById('demoAdminBtn'),
  demoManagerBtn: document.getElementById('demoManagerBtn'),

  // User Profile Modal
  userProfileModal: document.getElementById('userProfileModal'),
  closeProfileModalBtn: document.getElementById('closeProfileModalBtn'),
  profileModalName: document.getElementById('profileModalName'),
  profileModalEmail: document.getElementById('profileModalEmail'),
  profileModalPhone: document.getElementById('profileModalPhone'),
  profileModalRole: document.getElementById('profileModalRole'),
  profileModalVehicle: document.getElementById('profileModalVehicle'),
  profileModalCreated: document.getElementById('profileModalCreated'),
  profileFavoritesList: document.getElementById('profileFavoritesList'),
  profileModalLogoutBtn: document.getElementById('profileModalLogoutBtn')
};

// Initialize Auth
async function initAuth() {
  setupAuthEventListeners();

  if (authState.token) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      const data = await res.json();
      if (data.success && data.user) {
        authState.user = data.user;
        authState.favoriteIds = new Set(data.favoriteIds || []);
        updateAuthUI();
      } else {
        clearAuth();
      }
    } catch (err) {
      console.warn('Auth verification failed:', err);
      clearAuth();
    }
  } else {
    updateAuthUI();
  }
}

// Event Listeners
function setupAuthEventListeners() {
  // Nav buttons
  if (authElements.navLoginBtn) {
    authElements.navLoginBtn.addEventListener('click', () => openAuthModal('login'));
  }
  if (authElements.navRegisterBtn) {
    authElements.navRegisterBtn.addEventListener('click', () => openAuthModal('register'));
  }
  if (authElements.closeAuthModalBtn) {
    authElements.closeAuthModalBtn.addEventListener('click', closeAuthModal);
  }

  // Backdrop click to close modals
  if (authElements.authModal) {
    authElements.authModal.addEventListener('click', (e) => {
      if (e.target === authElements.authModal) closeAuthModal();
    });
  }
  if (authElements.userProfileModal) {
    authElements.userProfileModal.addEventListener('click', (e) => {
      if (e.target === authElements.userProfileModal) closeProfileModal();
    });
  }

  // Tab switching inside auth modal
  if (authElements.authTabLogin) {
    authElements.authTabLogin.addEventListener('click', () => setAuthTab('login'));
  }
  if (authElements.authTabRegister) {
    authElements.authTabRegister.addEventListener('click', () => setAuthTab('register'));
  }
  if (authElements.switchToRegisterBtn) {
    authElements.switchToRegisterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setAuthTab('register');
    });
  }
  if (authElements.switchToLoginBtn) {
    authElements.switchToLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setAuthTab('login');
    });
  }

  // Demo Login Buttons
  if (authElements.demoDriverBtn) {
    authElements.demoDriverBtn.addEventListener('click', () => {
      login('driver@cngconnect.in', 'Driver@123');
    });
  }
  if (authElements.demoAdminBtn) {
    authElements.demoAdminBtn.addEventListener('click', () => {
      login('admin@cngconnect.in', 'Admin@123');
    });
  }
  if (authElements.demoManagerBtn) {
    authElements.demoManagerBtn.addEventListener('click', () => {
      login('manager@igl.in', 'Manager@123');
    });
  }

  // Submit Login
  if (authElements.loginForm) {
    authElements.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = authElements.loginEmailInput.value.trim();
      const password = authElements.loginPasswordInput.value;
      if (!email || !password) {
        showLoginError('Please enter both email and password.');
        return;
      }
      await login(email, password);
    });
  }

  // Submit Register
  if (authElements.registerForm) {
    authElements.registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = authElements.registerNameInput.value.trim();
      const email = authElements.registerEmailInput.value.trim();
      const phone = authElements.registerPhoneInput.value.trim();
      const vehicle_type = authElements.registerVehicleInput.value;
      const role = authElements.registerRoleInput.value;
      const password = authElements.registerPasswordInput.value;
      const confirmPassword = authElements.registerConfirmPasswordInput.value;

      if (!name || !email || !password) {
        showRegisterError('Name, email, and password are required.');
        return;
      }
      if (password !== confirmPassword) {
        showRegisterError('Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        showRegisterError('Password must be at least 6 characters long.');
        return;
      }

      await register({ name, email, phone, vehicle_type, role, password });
    });
  }

  // User Dropdown toggle
  if (authElements.navUserMenuBtn) {
    authElements.navUserMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = authElements.userDropdownMenu.style.display === 'block';
      authElements.userDropdownMenu.style.display = isVisible ? 'none' : 'block';
    });
  }

  // Close dropdown on outside click
  document.addEventListener('click', () => {
    if (authElements.userDropdownMenu) {
      authElements.userDropdownMenu.style.display = 'none';
    }
  });

  // Dropdown menu actions
  if (authElements.dropdownProfileBtn) {
    authElements.dropdownProfileBtn.addEventListener('click', openProfileModal);
  }
  if (authElements.dropdownFavoritesBtn) {
    authElements.dropdownFavoritesBtn.addEventListener('click', () => {
      openProfileModal();
      // Scroll to favorites list
      if (authElements.profileFavoritesList) {
        authElements.profileFavoritesList.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
  if (authElements.dropdownLogoutBtn) {
    authElements.dropdownLogoutBtn.addEventListener('click', logout);
  }
  if (authElements.closeProfileModalBtn) {
    authElements.closeProfileModalBtn.addEventListener('click', closeProfileModal);
  }
  if (authElements.profileModalLogoutBtn) {
    authElements.profileModalLogoutBtn.addEventListener('click', () => {
      closeProfileModal();
      logout();
    });
  }
}

// Modal open/close
function openAuthModal(tab = 'login') {
  setAuthTab(tab);
  if (authElements.authModal) {
    authElements.authModal.style.display = 'flex';
  }
}

function closeAuthModal() {
  if (authElements.authModal) {
    authElements.authModal.style.display = 'none';
  }
  hideAuthErrors();
}

function setAuthTab(tab) {
  hideAuthErrors();
  if (tab === 'register') {
    authElements.authTabRegister.classList.add('active');
    authElements.authTabLogin.classList.remove('active');
    authElements.authRegisterFormWrapper.style.display = 'block';
    authElements.authLoginFormWrapper.style.display = 'none';
  } else {
    authElements.authTabLogin.classList.add('active');
    authElements.authTabRegister.classList.remove('active');
    authElements.authLoginFormWrapper.style.display = 'block';
    authElements.authRegisterFormWrapper.style.display = 'none';
  }
}

function showLoginError(msg) {
  if (authElements.loginErrorBanner) {
    authElements.loginErrorBanner.textContent = msg;
    authElements.loginErrorBanner.style.display = 'block';
  }
}

function showRegisterError(msg) {
  if (authElements.registerErrorBanner) {
    authElements.registerErrorBanner.textContent = msg;
    authElements.registerErrorBanner.style.display = 'block';
  }
}

function hideAuthErrors() {
  if (authElements.loginErrorBanner) authElements.loginErrorBanner.style.display = 'none';
  if (authElements.registerErrorBanner) authElements.registerErrorBanner.style.display = 'none';
}

// Authentication API calls
async function login(email, password) {
  hideAuthErrors();
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      authState.token = data.token;
      authState.user = data.user;
      localStorage.setItem('cng_auth_token', data.token);

      // Fetch user favorites
      await loadUserFavorites();

      updateAuthUI();
      closeAuthModal();
      window.showToast?.(`Welcome back, ${data.user.name}! 👋`, 'success');

      // Refresh stations UI to reflect favorite hearts
      if (window.renderStationCards && window.appState?.stations) {
        window.renderStationCards(window.appState.stations);
      }

      if (window.checkAdminViewAccess) {
        window.checkAdminViewAccess();
      }

      if (window.checkAdminViewAccess) {
        window.checkAdminViewAccess();
      }
    } else {
      showLoginError(data.message || 'Login failed. Please check credentials.');
    }
  } catch (err) {
    showLoginError('Network error during login. Please try again.');
  }
}

async function register(userData) {
  hideAuthErrors();
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      authState.token = data.token;
      authState.user = data.user;
      authState.favoriteIds = new Set();
      localStorage.setItem('cng_auth_token', data.token);

      updateAuthUI();
      closeAuthModal();
      window.showToast?.(`Account created! Welcome to CNG Connect, ${data.user.name}! 🎉`, 'success');

      if (window.renderStationCards && window.appState?.stations) {
        window.renderStationCards(window.appState.stations);
      }

      if (window.checkAdminViewAccess) {
        window.checkAdminViewAccess();
      }
    } else {
      const errorMsg = data.errors ? data.errors.join(' ') : (data.message || 'Failed to register.');
      showRegisterError(errorMsg);
    }
  } catch (err) {
    showRegisterError('Network error during registration. Please try again.');
  }
}

async function logout() {
  if (authState.token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });
    } catch (err) {
      console.warn('Logout network error:', err);
    }
  }

  clearAuth();
  updateAuthUI();
  if (window.checkAdminViewAccess) {
    window.checkAdminViewAccess();
  }
  window.showToast?.('You have been logged out.', 'info');

  // If in admin view and user is not admin, switch to home
  if (window.switchView) {
    window.switchView('home');
  }

  // Refresh stations to clear favorites
  if (window.renderStationCards && window.appState?.stations) {
    window.renderStationCards(window.appState.stations);
  }
}

function clearAuth() {
  authState.user = null;
  authState.token = null;
  authState.favoriteIds.clear();
  localStorage.removeItem('cng_auth_token');
}

async function loadUserFavorites() {
  if (!authState.token) return;
  try {
    const res = await fetch('/api/auth/favorites', {
      headers: { 'Authorization': `Bearer ${authState.token}` }
    });
    const data = await res.json();
    if (data.success && data.data) {
      authState.favoriteIds = new Set(data.data.map(s => s.id));
    }
  } catch (err) {
    console.warn('Failed to load favorites:', err);
  }
}

// Favorite Toggle
async function toggleFavoriteStation(stationId, event) {
  if (event) event.stopPropagation();

  if (!authState.user) {
    window.showToast?.('Please log in to save stations to your favorites.', 'info');
    openAuthModal('login');
    return;
  }

  const id = Number(stationId);
  const isFav = authState.favoriteIds.has(id);

  try {
    if (isFav) {
      const res = await fetch(`/api/auth/favorites/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });
      if (res.ok) {
        authState.favoriteIds.delete(id);
        window.showToast?.('Removed from your favorites.', 'info');
      }
    } else {
      const res = await fetch(`/api/auth/favorites/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });
      if (res.ok) {
        authState.favoriteIds.add(id);
        window.showToast?.('Added to your favorite stations! ❤️', 'success');
      }
    }

    // Update heart icons in station cards
    document.querySelectorAll(`.fav-btn[data-station-id="${id}"]`).forEach(btn => {
      btn.classList.toggle('active', !isFav);
      btn.setAttribute('aria-label', !isFav ? 'Remove from favorites' : 'Add to favorites');
      btn.innerHTML = !isFav
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    });
  } catch (err) {
    window.showToast?.('Could not update favorites. Try again.', 'error');
  }
}

// UI State Synchronization
function updateAuthUI() {
  const isAuth = !!authState.user;

  if (authElements.navGuestControls) {
    authElements.navGuestControls.style.display = isAuth ? 'none' : 'flex';
  }
  if (authElements.navUserControls) {
    authElements.navUserControls.style.display = isAuth ? 'flex' : 'none';
  }

  if (isAuth && authState.user) {
    const u = authState.user;
    if (authElements.navUserNameText) {
      authElements.navUserNameText.textContent = u.name.split(' ')[0];
    }
    if (authElements.navUserRoleBadge) {
      let roleLabel = 'Driver';
      if (u.role === 'admin') roleLabel = 'Admin';
      else if (u.role === 'station_manager') roleLabel = 'Operator';
      authElements.navUserRoleBadge.textContent = roleLabel;
      authElements.navUserRoleBadge.className = `role-pill role-${u.role}`;
    }
  }
}

// Profile Modal View
async function openProfileModal() {
  if (!authState.user) return;
  const u = authState.user;

  if (authElements.profileModalName) authElements.profileModalName.textContent = u.name;
  if (authElements.profileModalEmail) authElements.profileModalEmail.textContent = u.email;
  if (authElements.profileModalPhone) authElements.profileModalPhone.textContent = u.phone || 'Not specified';
  if (authElements.profileModalRole) {
    authElements.profileModalRole.textContent = u.role === 'admin' ? 'System Administrator' : (u.role === 'station_manager' ? 'Station Partner / Operator' : 'CNG Driver / Commuter');
  }
  if (authElements.profileModalVehicle) authElements.profileModalVehicle.textContent = u.vehicle_type || 'Cab / Taxi';
  if (authElements.profileModalCreated) {
    authElements.profileModalCreated.textContent = u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active Member';
  }

  // Load and render favorite stations
  if (authElements.profileFavoritesList) {
    authElements.profileFavoritesList.innerHTML = '<div class="loading-spinner">Loading favorites...</div>';
    try {
      const res = await fetch('/api/auth/favorites', {
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        authElements.profileFavoritesList.innerHTML = data.data.map(st => `
          <div class="fav-station-card">
            <div class="fav-station-info">
              <h4>${escapeHtml(st.name)}</h4>
              <p>${escapeHtml(st.area)}, ${escapeHtml(st.city)} • <span class="status-badge ${st.availability_status}">${capitalize(st.availability_status)}</span></p>
            </div>
            <div class="fav-station-actions">
              <button class="btn btn-sm btn-outline" onclick="window.viewFavoriteDetails(${st.id})">View</button>
              <button class="btn btn-sm btn-danger-ghost" onclick="window.toggleFavoriteStation(${st.id}); window.openProfileModal();">Remove</button>
            </div>
          </div>
        `).join('');
      } else {
        authElements.profileFavoritesList.innerHTML = '<p class="empty-hint">No saved stations yet. Click the heart ❤️ icon on any station card to save it for quick access.</p>';
      }
    } catch (err) {
      authElements.profileFavoritesList.innerHTML = '<p class="empty-hint">Failed to load favorite stations.</p>';
    }
  }

  if (authElements.userProfileModal) {
    authElements.userProfileModal.style.display = 'flex';
  }
}

function closeProfileModal() {
  if (authElements.userProfileModal) {
    authElements.userProfileModal.style.display = 'none';
  }
}

function viewFavoriteDetails(id) {
  closeProfileModal();
  if (window.switchView) window.switchView('driver');
  if (window.openStationDetailModal) window.openStationDetailModal(id);
}

// Helper utilities
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Expose globals
window.authState = authState;
window.initAuth = initAuth;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.toggleFavoriteStation = toggleFavoriteStation;
window.viewFavoriteDetails = viewFavoriteDetails;
window.logout = logout;

// Run on load
document.addEventListener('DOMContentLoaded', initAuth);
