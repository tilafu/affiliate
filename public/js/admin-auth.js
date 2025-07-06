/**
 * Admin Authentication Module
 * Handles admin authentication, session management, and security
 */

// Immediately check if user is authenticated
document.addEventListener('DOMContentLoaded', () => {
  // Check if this is an admin page that requires authentication
  if (!window.location.pathname.includes('admin-login.html')) {
    checkAdminAuth();
  }
  
  // Set up logout functionality if the button exists
  const logoutBtn = document.querySelector('.logout-btn') || document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logoutAdmin();
    });
  }
  
  // Add CSRF token meta tag if it doesn't exist
  if (!document.querySelector('meta[name="csrf-token"]')) {
    const metaTag = document.createElement('meta');
    metaTag.name = 'csrf-token';
    metaTag.content = generateCSRFToken();
    document.head.appendChild(metaTag);
  }
});

/**
 * Check if admin is authenticated
 * If not, redirect to login page
 */
function checkAdminAuth() {
  try {
    const adminToken = localStorage.getItem('adminToken');
    
    if (!adminToken) {
      console.warn('No admin token found');
      redirectToLogin();
      return;
    }
    
    // Verify token with backend
    fetch('/api/admin/verify-token', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (!response.ok) {
        console.warn('Token verification failed:', response.status);
        redirectToLogin();
        return null;
      }
      return response.json();
    })
    .then(data => {
      if (!data || !data.authenticated) {
        console.warn('Session not authenticated or expired');
        redirectToLogin();
        return;
      }
      
      // Update admin username if element exists
      const usernameElement = document.getElementById('adminUsername');
      if (usernameElement && data.username) {
        usernameElement.textContent = data.username;
      }
    })
    .catch(error => {
      console.error('Auth check failed:', error);
      redirectToLogin();
    });
  } catch (error) {
    console.error('Error in checkAdminAuth:', error);
    redirectToLogin();
  }
}

/**
 * Logout admin user
 */
function logoutAdmin() {
  const adminToken = localStorage.getItem('adminToken');
  
  // Call logout endpoint
  fetch('/api/admin/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  })
  .finally(() => {
    // Clear local storage and redirect to login
    localStorage.removeItem('adminToken');
    redirectToLogin();
  });
}

/**
 * Redirect to login page with return URL
 */
function redirectToLogin() {
  console.error('Authentication required');
  
  // Get the current URL to use as a return URL after login
  const currentUrl = encodeURIComponent(window.location.href);
  
  // Clear the token since it's invalid or expired
  localStorage.removeItem('adminToken');
  
  // Redirect to the login page with a return URL
  window.location.href = `/admin-login.html?returnUrl=${currentUrl}`;
}

/**
 * Generate a random CSRF token
 */
function generateCSRFToken() {
  return Array(32)
    .fill(0)
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join('');
}

/**
 * Get admin token from local storage
 */
function getAdminToken() {
  return localStorage.getItem('adminToken');
}

/**
 * Check if user has admin role
 */
function isAdmin() {
  const adminToken = localStorage.getItem('adminToken');
  return !!adminToken;
}
