// Dual Authentication System
// Allows simultaneous login to both client and admin panels

// Token storage keys
const CLIENT_TOKEN_KEY = 'client_auth_token';
const ADMIN_TOKEN_KEY = 'admin_auth_token';
const USER_DATA_KEY = 'user_data';

/**
 * Enhanced authentication utilities for dual panel access
 */
class DualAuth {
    
    /**
     * Store authentication token based on user role
     * @param {string} token - JWT token
     * @param {Object} userData - User data object
     * @param {string} panelType - 'client' or 'admin'
     */
    static storeAuth(token, userData, panelType = 'client') {
        const tokenKey = panelType === 'admin' ? ADMIN_TOKEN_KEY : CLIENT_TOKEN_KEY;
        
        // Store the token for the specific panel
        localStorage.setItem(tokenKey, token);
        
        // Store user data with panel context
        const existingUserData = this.getUserData() || {};
        existingUserData[panelType] = userData;
        localStorage.setItem(USER_DATA_KEY, JSON.stringify(existingUserData));
        
        console.log(`Auth stored for ${panelType} panel`);
    }
    
    /**
     * Get authentication token for specific panel
     * @param {string} panelType - 'client' or 'admin'
     * @returns {string|null} Token or null if not found
     */
    static getToken(panelType = 'client') {
        const tokenKey = panelType === 'admin' ? ADMIN_TOKEN_KEY : CLIENT_TOKEN_KEY;
        return localStorage.getItem(tokenKey);
    }
    
    /**
     * Get user data for specific panel
     * @param {string} panelType - 'client' or 'admin' 
     * @returns {Object|null} User data or null if not found
     */
    static getUserData(panelType = null) {
        const userData = localStorage.getItem(USER_DATA_KEY);
        if (!userData) return null;
        
        try {
            const parsed = JSON.parse(userData);
            return panelType ? parsed[panelType] : parsed;
        } catch (error) {
            console.error('Error parsing user data:', error);
            return null;
        }
    }
    
    /**
     * Check if user is authenticated for specific panel
     * @param {string} panelType - 'client' or 'admin'
     * @returns {boolean} True if authenticated
     */
    static isAuthenticated(panelType = 'client') {
        const token = this.getToken(panelType);
        if (!token) return false;
        
        // Check token expiration
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Date.now() / 1000;
            
            if (payload.exp && payload.exp < currentTime) {
                this.clearAuth(panelType);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error checking token:', error);
            this.clearAuth(panelType);
            return false;
        }
    }
    
    /**
     * Check if user has admin role and is authenticated for admin panel
     * @returns {boolean} True if admin authenticated
     */
    static isAdminAuthenticated() {
        if (!this.isAuthenticated('admin')) return false;
        
        const userData = this.getUserData('admin');
        return userData && userData.role === 'admin';
    }
    
    /**
     * Clear authentication for specific panel
     * @param {string} panelType - 'client' or 'admin'
     */
    static clearAuth(panelType = 'client') {
        const tokenKey = panelType === 'admin' ? ADMIN_TOKEN_KEY : CLIENT_TOKEN_KEY;
        
        // Remove token
        localStorage.removeItem(tokenKey);
        
        // Update user data
        const userData = this.getUserData() || {};
        delete userData[panelType];
        
        if (Object.keys(userData).length === 0) {
            localStorage.removeItem(USER_DATA_KEY);
        } else {
            localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
        }
        
        console.log(`Auth cleared for ${panelType} panel`);
    }
    
    /**
     * Clear all authentication data
     */
    static clearAllAuth() {
        localStorage.removeItem(CLIENT_TOKEN_KEY);
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem(USER_DATA_KEY);
        console.log('All auth data cleared');
    }
    
    /**
     * Get authentication status for both panels
     * @returns {Object} Status object with client and admin authentication status
     */
    static getAuthStatus() {
        return {
            client: {
                authenticated: this.isAuthenticated('client'),
                userData: this.getUserData('client')
            },
            admin: {
                authenticated: this.isAdminAuthenticated(),
                userData: this.getUserData('admin')
            }
        };
    }
    
    /**
     * Enhanced authentication check with dual panel support
     * @param {Object} options - Configuration options
     * @param {string} options.panelType - 'client' or 'admin'
     * @param {boolean} options.adminRequired - Whether admin role is required
     * @param {string} options.redirectPath - Custom redirect path
     * @param {boolean} options.silent - Whether to suppress notifications
     * @returns {Object|null} User data if authenticated, null if redirected
     */
    static checkAuthentication(options = {}) {
        const {
            panelType = 'client',
            adminRequired = false,
            redirectPath = 'login.html',
            silent = false
        } = options;
        
        // For admin panel, always require admin role
        const requireAdmin = panelType === 'admin' || adminRequired;
        
        if (requireAdmin && !this.isAdminAuthenticated()) {
            if (!silent && typeof showNotification === 'function') {
                showNotification('Admin authentication required. Redirecting to login.', 'error');
            }
            setTimeout(() => {
                window.location.href = redirectPath;
            }, silent ? 0 : 1000);
            return null;
        } else if (!requireAdmin && !this.isAuthenticated(panelType)) {
            if (!silent && typeof showNotification === 'function') {
                showNotification('Authentication required. Redirecting to login.', 'error');
            }
            setTimeout(() => {
                window.location.href = redirectPath;
            }, silent ? 0 : 1000);
            return null;
        }
        
        return this.getUserData(panelType);
    }
    
    /**
     * Make authenticated API request with appropriate token
     * @param {string} url - API endpoint URL
     * @param {Object} options - Fetch options
     * @param {string} panelType - 'client' or 'admin'
     * @returns {Promise} Fetch promise
     */
    static async authenticatedFetch(url, options = {}, panelType = 'client') {
        const token = this.getToken(panelType);
        
        if (!token) {
            throw new Error(`No ${panelType} token available`);
        }
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };
        
        return fetch(url, {
            ...options,
            headers
        });
    }
}

// Export for use in other files
window.DualAuth = DualAuth;

// Backward compatibility functions
window.getDualAuthStatus = () => DualAuth.getAuthStatus();
window.clearDualAuth = (panelType) => DualAuth.clearAuth(panelType);
