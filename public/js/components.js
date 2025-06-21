/**
 * Loads an HTML component from a specified path and injects it into a target element.
 * @param {string} componentPath - The path to the HTML component file (e.g., '/components/sidebar.html').
 * @param {string} targetElementId - The ID of the HTML element where the component should be injected.
 * @returns {Promise<void>} A promise that resolves when the component is loaded and injected, or rejects on error.
 */
async function loadComponent(componentPath, targetElementId) {
    const targetElement = document.getElementById(targetElementId);
    if (!targetElement) {
        console.log(`Target element with ID "${targetElementId}" not found, skipping component "${componentPath}".`);
        return Promise.resolve(); // Resolve instead of rejecting
    }

    try {
        // Use the base URL defined in the main HTML file if available, otherwise assume relative path
        const baseUrl = typeof baseurl !== 'undefined' ? baseurl : '.';
        const response = await fetch(`${baseUrl}${componentPath}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch component ${componentPath}: ${response.status} ${response.statusText}`);
        }        const html = await response.text();
        targetElement.innerHTML = html;
        console.log(`Component "${componentPath}" loaded into "#${targetElementId}".`);        // Apply i18n translations to the newly loaded component
        if (typeof updateContent === 'function') {
            console.log(`Applying i18n translations to component "${componentPath}"...`);
            updateContent();
        } else if (typeof i18next !== 'undefined' && i18next.isInitialized) {
            console.log(`Applying i18n translations to component "${componentPath}" (direct approach)...`);
            // Apply translations directly if updateContent is not available
            targetElement.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                if (i18next.exists(key)) {
                    element.innerHTML = i18next.t(key);
                }
            });
        } else {
            console.log(`i18n completely disabled for component "${componentPath}", skipping translations...`);
        }

        // Dispatch a custom event to signal completion
        const event = new CustomEvent('componentLoaded', { detail: { path: componentPath } });
        targetElement.dispatchEvent(event);        // Re-initialize any necessary scripts or event listeners for the loaded component
        // Example: If the sidebar has interactive elements initialized by another script
        if (componentPath === '/components/sidebar.html') {
            initializeSidebarScripts();
        }

    } catch (error) {
        console.error(`Error loading component "${componentPath}":`, error);
        targetElement.innerHTML = `<p class="error-message">Error loading component: ${componentPath}</p>`;
        return Promise.reject(error);
    }
}

// Example of how to initialize scripts specific to the sidebar after it's loaded
// You might need to move sidebar-specific JS initializations here from other files
async function initializeSidebarScripts() {
    console.log('Initializing sidebar scripts...');    // Attach logout handlers defined in auth.js to any .logout elements within the sidebar
    if (typeof window.attachLogoutHandlers === 'function') {
        console.log('Attaching logout handlers from auth.js...');
        window.attachLogoutHandlers();
    } else if (typeof attachLogoutHandlers === 'function') {
        console.log('Attaching logout handlers from auth.js (global scope)...');
        attachLogoutHandlers();
    } else {
        console.warn('attachLogoutHandlers function from auth.js is not available yet. Will retry after a delay.');
        // Retry after a short delay to allow auth.js to load
        setTimeout(() => {
            if (typeof window.attachLogoutHandlers === 'function') {                console.log('Attaching logout handlers from auth.js (delayed)...');
                window.attachLogoutHandlers();
            } else if (typeof attachLogoutHandlers === 'function') {
                console.log('Attaching logout handlers from auth.js (delayed, global scope)...');
                attachLogoutHandlers();
            } else {
                console.warn('attachLogoutHandlers function is still not available after delay. Using fallback.');
                // Fallback: manually attach logout handlers
                console.log('Attempting fallback logout handler attachment...');
                const logoutElements = document.querySelectorAll('.logout, [data-action="logout"]');
                logoutElements.forEach(function(el) {
                    el.addEventListener('click', async function(e) {
                        e.preventDefault();
                        console.log('Fallback logout clicked...');
                        // Simple logout implementation
                        try {
                            localStorage.removeItem('authToken');
                            sessionStorage.removeItem('authToken');
                            window.location.href = './login.html';
                        } catch (error) {
                            console.error('Fallback logout error:', error);
                            window.location.href = './login.html';
                        }
                    });
                });
            }
        }, 500);
    }
    
    // Additional specific handler for sidebar logout button
    const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
    if (sidebarLogoutBtn) {
        console.log('Found sidebar logout button, adding specific handler...');
        sidebarLogoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Sidebar logout clicked...');
            if (typeof performLogoutProcess === 'function') {
                performLogoutProcess();
            } else {
                performLogout();
            }
        });
    }    // Initialize sidebar user data population
    await populateSidebarUserData();

    // Set up a periodic refresh for sidebar data (every 30 seconds)
    const sidebarRefreshInterval = setInterval(async () => {
        try {
            await populateSidebarUserData();
        } catch (error) {
            console.error('Error during periodic sidebar refresh:', error);
        }
    }, 30000);

    // Clean up interval when page is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearInterval(sidebarRefreshInterval);
        }
    });// Apply i18n translations to the newly loaded sidebar
    if (typeof updateContent === 'function') {
        console.log('Applying i18n translations to sidebar...');
        updateContent();
    } else if (typeof i18next !== 'undefined' && i18next.isInitialized) {
        console.log('Applying i18n translations to sidebar (direct approach)...');
        // Apply translations directly if updateContent is not available
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (i18next.exists(key)) {
                element.innerHTML = i18next.t(key);
            }
        });
    } else {
        console.log('i18n completely disabled for sidebar, skipping translations...');
    }

    // Explicitly add close button functionality after sidebar loads
    const closeButton = document.getElementById('sidebar-close-button');
    const sidebarElement = document.querySelector('.main-sidebar');
    const overlayElement = document.querySelector('.bg-overlay');

    if (closeButton && sidebarElement && overlayElement) {
        closeButton.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default anchor behavior
            event.stopPropagation(); // Stop the event from bubbling up to the document handler
            console.log('Sidebar close button clicked (handler in components.js)');
            sidebarElement.classList.remove('active');
            overlayElement.classList.remove('active');
        });
    } else {
        console.warn('Could not find sidebar close button, sidebar element, or overlay element during initialization.');
    }

    // Add any other sidebar-specific initializations below
    // ...
}

// Function to populate sidebar user data across all pages
async function populateSidebarUserData() {
    console.log('Populating sidebar user data...');
    
    // First check if sidebar elements exist
    const usernameEl = document.getElementById('dashboard-username');
    const refcodeEl = document.getElementById('dashboard-refcode');
    const userInitialsEl = document.getElementById('sidebar-user-initials');
    
    if (!usernameEl && !refcodeEl && !userInitialsEl) {
        console.log('Sidebar elements not found, skipping data population');
        return;
    }
    
    // Check if user is authenticated using multiple methods
    let authData = null;
    
    // Try isAuthenticated first (silent check)
    if (typeof isAuthenticated === 'function') {
        authData = isAuthenticated();
        console.log('Auth check via isAuthenticated:', authData);
    }
    
    // If that fails, try to get token directly
    if (!authData || !authData.token) {
        const token = localStorage.getItem('auth_token');
        if (token) {
            authData = { token: token };
            console.log('Auth check via localStorage token found');
        }
    }
    
    if (!authData || !authData.token) {
        console.warn('User not authenticated, skipping sidebar data population');
        // Set loading state
        if (usernameEl) usernameEl.textContent = 'Not logged in';
        if (userInitialsEl) userInitialsEl.textContent = 'GL'; // Guest Login
        if (refcodeEl) {
            const refcodeSpan = refcodeEl.querySelector('.ref-text');
            if (refcodeSpan) {
                refcodeSpan.textContent = 'REF: ------';
            }
        }
        return;
    }

    try {
        console.log('Fetching user profile for sidebar...');
        
        // Fetch user profile data using authenticated fetch
        const data = await fetchWithAuth('/api/user/profile');
        console.log('Sidebar profile API response:', data);

        if (data.success && data.user) {
            const user = data.user;
            
            // Update username
            if (usernameEl) {
                usernameEl.textContent = user.username || 'N/A';
                console.log('Updated sidebar username:', user.username);
            }
            
            // Update user initials
            if (userInitialsEl && user.username) {
                const initials = generateUserInitials(user.username);
                userInitialsEl.textContent = initials;
                console.log('Updated sidebar initials:', initials);
            }

            if (refcodeEl && user.referral_code) {
                // Update the referral code span content
                const refcodeSpan = refcodeEl.querySelector('.ref-text');
                if (refcodeSpan) {
                    refcodeSpan.textContent = `REF: ${user.referral_code}`;
                    console.log('Updated sidebar referral code:', user.referral_code);
                } else {
                    // Fallback if span structure not found
                    refcodeEl.textContent = `REFERRAL CODE: ${user.referral_code}`;
                }
                
                // Initialize copy functionality after data is loaded
                initializeReferralCodeCopy(user.referral_code);
            }
            
            console.log('Sidebar user data populated successfully');} else {
            console.error('Failed to fetch user profile for sidebar:', data.message);
            if (usernameEl) usernameEl.textContent = 'Error';
            if (userInitialsEl) userInitialsEl.textContent = 'ER';
            if (refcodeEl) {
                const refcodeSpan = refcodeEl.querySelector('.ref-text');
                if (refcodeSpan) {
                    refcodeSpan.textContent = 'REF: Error';
                } else {
                    refcodeEl.textContent = 'REFERRAL CODE: Error';
                }
            }
        }    } catch (error) {
        console.error('Error populating sidebar user data:', error);
        if (usernameEl) usernameEl.textContent = 'Error';
        if (userInitialsEl) userInitialsEl.textContent = 'ER';
        if (refcodeEl) {
            const refcodeSpan = refcodeEl.querySelector('.ref-text');
            if (refcodeSpan) {
                refcodeSpan.textContent = 'REF: Error';
            } else {
                refcodeEl.textContent = 'REFERRAL CODE: Error';
            }
        }
    }
}

// Function to load components after i18n is ready
function loadInitialComponents() {
    console.log('Components.js: loadInitialComponents called');
    
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    if (sidebarPlaceholder) {
        console.log('Components.js: Found sidebar placeholder, loading sidebar...');
        loadComponent('/components/sidebar.html', 'sidebar-placeholder')
            .then(() => {
                console.log('Components.js: Sidebar loaded successfully');
            })
            .catch(err => {
                console.error("Components.js: Sidebar loading failed:", err);
            });
    } else {
        console.warn('Components.js: No sidebar placeholder found in DOM');
    }
      // Add similar checks for other components like header or footer if needed
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (headerPlaceholder) {
        console.log('Components.js: Found header placeholder, loading header...');
        loadComponent('/components/header.html', 'header-placeholder')
            .then(() => {
                console.log('Components.js: Header loaded successfully');
            })
            .catch(err => {
                console.error("Components.js: Header loading failed:", err);
            });
    }
    
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) {
        console.log('Components.js: Found footer placeholder, loading footer...');
        loadComponent('/components/footer.html', 'footer-placeholder')
            .then(() => {
                console.log('Components.js: Footer loaded successfully');
            })
            .catch(err => {
                console.error("Components.js: Footer loading failed:", err);
            });
    }
}

/**
 * Loads the footer component
 */
async function loadFooter() {
    const footerTarget = document.getElementById('footer-placeholder');
    
    if (footerTarget) {
        return loadComponent('/components/footer.html', 'footer-placeholder');
    } else {
        console.log('No footer placeholder found, skipping...');
        return Promise.resolve();
    }
}

/**
 * Loads the standard header navigation component
 */
async function loadHeaderNavigation() {
    // Check which header element exists and use the appropriate one
    const headerTarget = document.getElementById('header-navigation') ? 'header-navigation' : 'header-navigation-placeholder';
    
    // Only load if the target element exists
    if (document.getElementById(headerTarget)) {
        return loadComponent('/components/header-navigation.html', headerTarget);
    } else {
        console.log('No header navigation target found, skipping...');
        return Promise.resolve();
    }
}

/**
 * Loads the standard footer navigation component
 */
async function loadFooterNavigation() {
    // Check which footer element exists and use the appropriate one
    const footerTarget = document.getElementById('footer-navigation') ? 'footer-navigation' : 'footer-navigation-placeholder';
    
    // Only load if the target element exists
    if (document.getElementById(footerTarget)) {
        // Ensure sticky footer CSS is loaded
        if (!document.querySelector('link[href*="sticky-footer.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = './css/sticky-footer.css';
            document.head.appendChild(link);
        }
        
        return loadComponent('/components/footer-navigation.html', footerTarget);
    } else {
        console.log('No footer navigation target found, skipping...');
        return Promise.resolve();
    }
}

/**
 * Loads all standard navigation components
 */
async function loadStandardNavigation() {
    try {
        const promises = [];
        
        // Check which sidebar element exists and use the appropriate one
        const sidebarTarget = document.getElementById('sidebar-container') ? 'sidebar-container' : 
                             document.getElementById('sidebar-placeholder') ? 'sidebar-placeholder' : null;
        
        if (sidebarTarget) {
            promises.push(loadComponent('/components/sidebar.html', sidebarTarget));
        } else {
            console.log('No sidebar target found, skipping sidebar component...');
        }
          // Add header and footer navigation
        promises.push(loadHeaderNavigation());
        promises.push(loadFooterNavigation());
        
        // Add footer component
        promises.push(loadFooter());
          await Promise.all(promises);
        console.log('All standard navigation components loaded successfully');
        
        // Refresh sidebar user data after loading (only if sidebar was loaded)
        if (sidebarTarget) {
            // Multiple attempts to ensure sidebar data loads
            setTimeout(async () => {
                console.log('First attempt to populate sidebar data...');
                await populateSidebarUserData();
            }, 300);
            
            setTimeout(async () => {
                console.log('Second attempt to populate sidebar data...');
                await populateSidebarUserData();
            }, 1000);
            
            // Set up refresh function for external use
            if (typeof window.refreshSidebarUserData === 'function') {
                setTimeout(() => {
                    window.refreshSidebarUserData();
                }, 1500);
            }
        }
    } catch (error) {
        console.error('Error loading standard navigation components:', error);
    }
}

// Automatically load components when both DOM and i18n are ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Components.js: DOM loaded, checking i18n status...');
    
    // Check if i18n is completely disabled (no updateContent function and no i18next)
    if (typeof updateContent === 'undefined' && typeof i18next === 'undefined') {
        console.log('Components.js: i18n completely disabled, loading components immediately...');
        loadInitialComponents();
        return;
    }
    
    // Check if i18n is already ready (for the disabled i18n system, check if updateContent function exists)
    if ((typeof i18next !== 'undefined' && i18next.isInitialized) || 
        (typeof updateContent === 'function')) {
        console.log('Components.js: i18n ready, loading components immediately...');
        loadInitialComponents();
    } else {
        console.log('Components.js: Waiting for i18nReady event...');
        // Wait for i18n to be ready
        window.addEventListener('i18nReady', () => {
            console.log('Components.js: i18nReady event received, loading components...');
            loadInitialComponents();
        });
        
        // Fallback: if i18nReady event doesn't fire within 1 second, load anyway
        setTimeout(() => {
            if (document.getElementById('sidebar-placeholder') && 
                document.getElementById('sidebar-placeholder').innerHTML === '') {
                console.warn('Components.js: Loading components without i18n ready confirmation (fallback)');
                loadInitialComponents();
            }
        }, 1000);
    }
});

// Fallback logout function
async function performLogout() {
    console.log('Performing logout...');
    
    // Show modern confirmation dialog
    const confirmed = await showConfirmDialog(
        'You will be signed out of your account. Any unsaved changes may be lost.',
        'Sign Out',
        {
            confirmText: 'Sign Out',
            cancelText: 'Cancel',
            type: 'warning'
        }
    );
    
    if (confirmed) {
        try {
            // Get token before clearing
            const token = localStorage.getItem('auth_token');
            
            // Preserve drive session data before clearing localStorage
            const driveSessionData = localStorage.getItem('current_drive_session');
            
            // Clear authentication data
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            
            // Restore drive session data after clearing auth data
            if (driveSessionData) {
                localStorage.setItem('current_drive_session', driveSessionData);
            }
            
            // Attempt server-side logout if token exists
            if (token && typeof API_BASE_URL !== 'undefined') {
                fetch(`${API_BASE_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                })
                .then(response => response.json())
                .then(data => {
                    console.log('Server-side logout response:', data);
                })
                .catch(error => {
                    console.warn('Server-side logout failed (continuing with client-side logout):', error);
                });
            }
            
            // Show notification if available
            if (typeof showNotification === 'function') {
                if (window.i18next && window.i18next.isInitialized) {
                    showNotification(i18next.t('logoutSuccessNotification') || 'Logout successful!', 'success');
                } else {
                    showNotification('Logout successful!', 'success');
                }
                // Redirect after a short delay to allow notification to show
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1000);
            } else {
                // Redirect immediately if no notification
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Error during logout:', error);
            // Force redirect even if there's an error
            window.location.href = 'login.html';
        }
    }
}

/**
 * Initialize referral code copy functionality
 */
function initializeReferralCodeCopy(referralCode) {
    const refcodeEl = document.getElementById('dashboard-refcode');
    
    if (refcodeEl && referralCode) {
        // Remove any existing click listeners to avoid duplicates
        const newRefcodeEl = refcodeEl.cloneNode(true);
        refcodeEl.parentNode.replaceChild(newRefcodeEl, refcodeEl);
        
        // Add click listener to the entire referral code element
        newRefcodeEl.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Sidebar referral code clicked, copying:', referralCode);
            
            if (typeof copyToClipboard === 'function') {
                const success = await copyToClipboard(referralCode, 'Referral code copied to clipboard!');
                
                if (success) {
                    // Visual feedback - temporarily change the icon
                    const copyIcon = newRefcodeEl.querySelector('.ref-copy-icon');
                    if (copyIcon) {
                        const originalClass = copyIcon.className;
                        copyIcon.className = 'fas fa-check ref-copy-icon';
                        copyIcon.style.color = '#28a745';
                        
                        setTimeout(() => {
                            copyIcon.className = originalClass;
                            copyIcon.style.color = '';
                        }, 2000);
                    }
                }
            } else {
                console.error('copyToClipboard function not available');
                if (typeof showNotification === 'function') {
                    showNotification('Copy functionality not available', 'error');
                }
            }
        });
        
        // Also add hover effect
        newRefcodeEl.style.cursor = 'pointer';
        newRefcodeEl.title = 'Click to copy referral code';
        
        console.log('Referral code copy functionality initialized for sidebar');
    }
}

// Function to generate user initials (fallback if not available globally)
function generateUserInitials(username) {
    if (!username) return 'U';
    
    // Check if the global function exists
    if (typeof window.generateUserInitials === 'function') {
        return window.generateUserInitials(username);
    }    
    // Fallback implementation
    const parts = username.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    } else {
        return username.substring(0, 2).toUpperCase();
    }
}

// Function to refresh sidebar user data (can be called externally)
window.refreshSidebarUserData = async function() {
    console.log('Refreshing sidebar user data...');
    await populateSidebarUserData();
};

// Debug function to manually trigger sidebar refresh
window.debugSidebarRefresh = async function() {
    console.log('=== DEBUG: Manual sidebar refresh triggered ===');
    
    // Check if sidebar is loaded
    const sidebarEl = document.querySelector('.main-sidebar');
    if (!sidebarEl) {
        console.log('Sidebar not loaded yet');
        return;
    }
    
    // Check authentication
    const token = localStorage.getItem('auth_token');
    console.log('Auth token exists:', !!token);
    
    // Check if elements exist
    const usernameEl = document.getElementById('dashboard-username');
    const refcodeEl = document.getElementById('dashboard-refcode');
    const userInitialsEl = document.getElementById('sidebar-user-initials');
    
    console.log('Sidebar elements found:', {
        username: !!usernameEl,
        refcode: !!refcodeEl,
        initials: !!userInitialsEl
    });
    
    // Trigger refresh
    await populateSidebarUserData();
    
    console.log('=== DEBUG: Manual sidebar refresh completed ===');
};
