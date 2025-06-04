// Central authentication management for the frontend
// This file provides reusable authentication utilities

/**
 * Central authentication check function
 * @param {Object} options - Configuration options
 * @param {boolean} options.adminRequired - Whether admin role is required
 * @param {string} options.redirectPath - Custom redirect path (default: 'login.html')
 * @param {boolean} options.silent - Whether to suppress notifications
 * @returns {Object|null} User data if authenticated, null if redirected
 */
function checkAuthentication(options = {}) {
    const {
        adminRequired = false,
        redirectPath = 'login.html',
        silent = false
    } = options;

    // Get token from localStorage
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
        if (!silent && typeof showNotification === 'function') {
            showNotification('Authentication required. Redirecting to login.', 'error');
        }
        setTimeout(() => {
            window.location.href = redirectPath;
        }, silent ? 0 : 1000);
        return null;
    }

    // Parse token to check expiration and role
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
          // Check if token is expired
        if (payload.exp && payload.exp < currentTime) {
            // Preserve drive session data before clearing localStorage
            const driveSessionData = localStorage.getItem('current_drive_session');
            
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            
            // Restore drive session data after clearing auth data
            if (driveSessionData) {
                localStorage.setItem('current_drive_session', driveSessionData);
            }
            
            if (!silent && typeof showNotification === 'function') {
                showNotification('Session expired. Please login again.', 'error');
            }
            setTimeout(() => {
                window.location.href = redirectPath;
            }, silent ? 0 : 1000);
            return null;
        }

        // Get user data from localStorage for role checking
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        
        // Check admin requirement
        if (adminRequired && userData.role !== 'admin') {
            if (!silent && typeof showNotification === 'function') {
                showNotification('Admin access required.', 'error');
            }
            setTimeout(() => {
                window.location.href = 'login.html';
            }, silent ? 0 : 1000);
            return null;
        }

        // Return user data if authentication successful
        return {
            token,
            user: userData,
            isAdmin: userData.role === 'admin'
        };    } catch (error) {
        console.error('Error parsing token:', error);
        // Preserve drive session data before clearing localStorage
        const driveSessionData = localStorage.getItem('current_drive_session');
        
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        
        // Restore drive session data after clearing auth data
        if (driveSessionData) {
            localStorage.setItem('current_drive_session', driveSessionData);
        }
        
        if (!silent && typeof showNotification === 'function') {
            showNotification('Invalid authentication data. Please login again.', 'error');
        }
        setTimeout(() => {
            window.location.href = redirectPath;
        }, silent ? 0 : 1000);
        return null;
    }
}

/**
 * Quick authentication check for protected pages
 * @param {boolean} adminRequired - Whether admin role is required
 * @returns {Object|null} User data if authenticated, null if redirected
 */
function requireAuth(adminRequired = false) {
    return checkAuthentication({ 
        adminRequired,
        silent: false
    });
}

/**
 * Silent authentication check (no notifications)
 * @param {boolean} adminRequired - Whether admin role is required
 * @returns {Object|null} User data if authenticated, null if not
 */
function isAuthenticated(adminRequired = false) {
    return checkAuthentication({ 
        adminRequired,
        silent: true
    });
}

/**
 * Check if current user has admin privileges
 * @returns {boolean} True if user is admin
 */
function isAdmin() {
    const authData = isAuthenticated();
    return authData && authData.isAdmin;
}

/**
 * Clear authentication data and redirect to login
 * @param {string} message - Optional logout message
 */
function clearAuthAndRedirect(message = 'Logged out successfully.') {
    // Preserve drive session data before clearing localStorage
    const driveSessionData = localStorage.getItem('current_drive_session');
    
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    
    // Restore drive session data after clearing auth data
    if (driveSessionData) {
        localStorage.setItem('current_drive_session', driveSessionData);
    }
    
    if (typeof showNotification === 'function') {
        showNotification(message, 'success');
    }
    
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1000);
}

/**
 * Enhanced fetchWithAuth that uses centralized auth checking
 * This extends the existing fetchWithAuth with better error handling
 */
function enhancedFetchWithAuth(url, options = {}) {
    // Check authentication before making request
    const authData = isAuthenticated();
    if (!authData) {
        return Promise.reject(new Error('Not authenticated'));
    }

    // Use the existing fetchWithAuth function if available
    if (typeof fetchWithAuth === 'function') {
        return fetchWithAuth(url, options);
    }

    // Fallback implementation
    const token = authData.token;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
    };

    return fetch(`${API_BASE_URL || ''}${url}`, {
        ...options,
        headers,
    }).then(response => {
        if (response.status === 401) {
            clearAuthAndRedirect('Session expired. Please login again.');
            throw new Error('Unauthorized');
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.json();
    });
}

// Make functions available globally
window.checkAuthentication = checkAuthentication;
window.requireAuth = requireAuth;
window.isAuthenticated = isAuthenticated;
window.isAdmin = isAdmin;
window.clearAuthAndRedirect = clearAuthAndRedirect;
window.enhancedFetchWithAuth = enhancedFetchWithAuth;
