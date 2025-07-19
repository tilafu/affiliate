# Authentication System Documentation

## Overview

The authentication system has been updated to properly handle authentication failures by redirecting users to the login page. The system includes multiple layers of protection and monitoring.

## Key Components

### 1. Core Authentication (`auth-check.js`)
- **checkAuthentication()**: Main authentication checking function
- **requireAuth()**: Quick auth check for protected pages
- **isAuthenticated()**: Silent auth check
- **clearAuthAndRedirect()**: Logout function with redirect

### 2. Enhanced Guard System (`auth-guard.js`)
- **authGuard()**: Comprehensive page protection
- **protectPage()**: Enhanced protection with monitoring
- **requireUserAuth()**: Basic user authentication
- **requireAdminAuth()**: Admin-only authentication

### 3. API Request Handling (`main.js`)
- **fetchWithAuth()**: Authenticated API requests
- **handle401Error()**: Global 401 error handler

## Authentication Flow

1. **Page Load**: Authentication is checked immediately
2. **Token Validation**: JWT tokens are parsed and validated
3. **Role Checking**: Admin requirements are verified
4. **Redirect on Failure**: Automatic redirect to login page
5. **Monitoring**: Periodic checks for session validity

## How to Protect Pages

### Basic User Page Protection
```javascript
document.addEventListener('DOMContentLoaded', async function() {
    const authResult = await requireUserAuth('My Page Name');
    if (!authResult) {
        return; // User will be redirected
    }
    
    // Page initialization code here
});
```

### Admin Page Protection
```javascript
document.addEventListener('DOMContentLoaded', async function() {
    const authResult = await requireAdminAuth('Admin Panel');
    if (!authResult) {
        return; // User will be redirected to admin-login.html
    }
    
    // Admin page initialization code here
});
```

### Enhanced Protection with Monitoring
```javascript
document.addEventListener('DOMContentLoaded', async function() {
    const authResult = await protectPage({
        requireAdmin: false,
        pageTitle: 'Account Page',
        enableMonitoring: true,
        monitoringInterval: 5, // Check every 5 minutes
        onAuthSuccess: function(authData) {
            console.log('Authentication successful');
            // Initialize page content
        },
        onAuthFailure: function() {
            console.log('Authentication failed');
            // Cleanup before redirect
        }
    });
});
```

## 404 Page Setup

The 404 page (`404.html`) is already properly configured with:
- Redirect button to `home.html`
- Navigation links to `home.html`
- Automatic redirect functionality

## Authentication Failures

When authentication fails, the system will:

1. **Show Notification**: User-friendly message about the failure
2. **Log Details**: Console logs for debugging
3. **Clear Invalid Data**: Remove corrupted tokens
4. **Redirect**: Automatic redirect to login page
5. **Preserve Data**: Keep non-auth data (like drive sessions)

## Redirect Scenarios

| Scenario | Redirect Target | Delay |
|----------|----------------|-------|
| No token | login.html | 1 second |
| Expired token | login.html | 1 second |
| Invalid token | login.html | 1 second |
| Missing admin role | login.html (or admin-login.html) | 1 second |
| API 401 error | login.html | Immediate |

## Testing

Use the test page `auth-test.html` to verify:
1. Authentication checks work properly
2. Redirects function correctly
3. API calls handle 401 errors
4. Monitoring detects expired sessions

## Implementation Examples

### Account Page (account.html)
```html
<script src="./js/auth-check.js"></script>
<script src="./js/auth-guard.js"></script>
<script>
document.addEventListener('DOMContentLoaded', async function() {
    const authResult = await protectPage({
        requireAdmin: false,
        pageTitle: 'Account Page',
        enableMonitoring: true
    });
    
    if (authResult) {
        // Load page content
        await loadStandardNavigation();
    }
});
</script>
```

### API Calls
```javascript
// All API calls should use fetchWithAuth or authenticatedFetch
fetchWithAuth('/api/user/profile')
    .then(data => {
        // Handle success
    })
    .catch(error => {
        // 401 errors will trigger automatic redirect
        console.error('API error:', error);
    });
```

## Monitoring

The system includes automatic session monitoring:
- Checks token validity every 5 minutes (configurable)
- Detects expired sessions automatically
- Provides early warning before expiration
- Handles background session renewal

## Debugging

Enable debug mode by opening browser console:
```javascript
// Check current auth status
debugAuthStatus();

// Test authentication manually
console.log(isAuthenticated());
console.log(requireAuth());
```

## Security Features

1. **JWT Validation**: Tokens are parsed and validated
2. **Expiration Checking**: Automatic expiration detection
3. **Role Verification**: Admin role checking
4. **Secure Cleanup**: Safe token removal
5. **Session Monitoring**: Continuous session validity checks
6. **Error Handling**: Comprehensive 401 error management

## Notes

- The authentication system is now in **production mode** with redirects enabled
- All previous debug mode restrictions have been removed
- Users will be automatically redirected on authentication failures
- The 404 page correctly redirects to the home page
- Session monitoring helps prevent unexpected logouts
