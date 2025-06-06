/**
 * Loads an HTML component from a specified path and injects it into a target element.
 * @param {string} componentPath - The path to the HTML component file (e.g., '/components/sidebar.html').
 * @param {string} targetElementId - The ID of the HTML element where the component should be injected.
 * @returns {Promise<void>} A promise that resolves when the component is loaded and injected, or rejects on error.
 */
async function loadComponent(componentPath, targetElementId) {
    const targetElement = document.getElementById(targetElementId);
    if (!targetElement) {
        console.error(`Target element with ID "${targetElementId}" not found.`);
        return Promise.reject(new Error(`Target element not found: ${targetElementId}`));
    }

    try {
        // Use the base URL defined in the main HTML file if available, otherwise assume relative path
        const baseUrl = typeof baseurl !== 'undefined' ? baseurl : '.';
        const response = await fetch(`${baseUrl}${componentPath}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch component ${componentPath}: ${response.status} ${response.statusText}`);
        }        const html = await response.text();
        targetElement.innerHTML = html;
        console.log(`Component "${componentPath}" loaded into "#${targetElementId}".`);

        // Apply i18n translations to the newly loaded component
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
        }

        // Dispatch a custom event to signal completion
        const event = new CustomEvent('componentLoaded', { detail: { path: componentPath } });
        targetElement.dispatchEvent(event);

        // Re-initialize any necessary scripts or event listeners for the loaded component
        // Example: If the sidebar has interactive elements initialized by another script
        if (typeof initializeSidebarScripts === 'function') {
            initializeSidebarScripts(); // You might need to create this function
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
    console.log('Initializing sidebar scripts...');

    // Attach logout handlers defined in auth.js to any .logout elements within the sidebar
    if (typeof window.attachLogoutHandlers === 'function') {
        console.log('Attaching logout handlers from auth.js...');
        window.attachLogoutHandlers();
    } else {
        console.error('attachLogoutHandlers function from auth.js is not available globally.');
    }    // Initialize sidebar user data population
    await populateSidebarUserData();

    // Apply i18n translations to the newly loaded sidebar
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
        console.warn('i18next not available or not initialized when loading sidebar');
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
    
    // Check if user is authenticated
    const authData = typeof requireAuth === 'function' ? requireAuth() : null;
    if (!authData || !authData.token) {
        console.warn('User not authenticated, skipping sidebar data population');
        return;
    }

    const usernameEl = document.getElementById('dashboard-username');
    const refcodeEl = document.getElementById('dashboard-refcode');    try {
        // Fetch user profile data
        const response = await fetch(`${window.API_BASE_URL || API_BASE_URL}/api/user/profile`, {
            headers: { 'Authorization': `Bearer ${authData.token}` }
        });
        const data = await response.json();

        if (data.success && data.user) {
            const user = data.user;
            if (usernameEl) usernameEl.textContent = user.username || 'N/A';
            if (refcodeEl) refcodeEl.textContent = `REFERRAL CODE: ${user.referral_code || 'N/A'}`;
            
            console.log('Sidebar user data populated successfully');
        } else {
            console.error('Failed to fetch user profile for sidebar:', data.message);
            if (usernameEl) usernameEl.textContent = 'Error';
            if (refcodeEl) refcodeEl.textContent = 'REFERRAL CODE: Error';
        }
    } catch (error) {
        console.error('Error populating sidebar user data:', error);
        if (usernameEl) usernameEl.textContent = 'Error';
        if (refcodeEl) refcodeEl.textContent = 'REFERRAL CODE: Error';
    }
}

// Function to load components after i18n is ready
function loadInitialComponents() {
    if (document.getElementById('sidebar-placeholder')) {
        loadComponent('/components/sidebar.html', 'sidebar-placeholder')
            .catch(err => console.error("Sidebar loading failed:", err));
    }
    // Add similar checks for other components like header or footer if needed
    // if (document.getElementById('header-placeholder')) {
    //     loadComponent('/components/header.html', 'header-placeholder');
    // }
}

// Automatically load components when both DOM and i18n are ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if i18n is already ready
    if (typeof i18next !== 'undefined' && i18next.isInitialized) {
        loadInitialComponents();
    } else {
        // Wait for i18n to be ready
        window.addEventListener('i18nReady', () => {
            loadInitialComponents();
        });
        
        // Fallback: if i18nReady event doesn't fire within 1 second, load anyway
        setTimeout(() => {
            if (document.getElementById('sidebar-placeholder') && 
                document.getElementById('sidebar-placeholder').innerHTML === '') {
                console.warn('Loading components without i18n ready confirmation');
                loadInitialComponents();
            }
        }, 1000);
    }
});
