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
        }

        const html = await response.text();
        targetElement.innerHTML = html;
        console.log(`Component "${componentPath}" loaded into "#${targetElementId}".`);

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
function initializeSidebarScripts() {
    console.log('Initializing sidebar scripts...');
    // Add event listeners or run functions needed for the sidebar here

    // Logout functionality: listen to click event on #logout-btn (inside sidebar)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (event) => {
            event.preventDefault();
            console.log('Logging out via #logout-btn (from components.js)...');
            // Assuming clearAuthData and redirectToLogin are globally available (e.g., from main.js or auth.js)
            if (typeof clearAuthData === 'function') {
                clearAuthData(); // Clears token and user data from localStorage
            } else {
                console.warn('clearAuthData function not found. Manually clearing storage.');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
            }
            if (typeof redirectToLogin === 'function') {
                redirectToLogin(); // Redirects to login page
            } else {
                console.warn('redirectToLogin function not found. Manually redirecting.');
                window.location.href = 'login.html';
            }
        });
    } else {
        console.warn('Sidebar logout button (#logout-btn) not found during initialization.');
    }

    // Add any other sidebar-specific initializations below
    // ...
}

// Automatically load the sidebar if a placeholder exists
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('sidebar-placeholder')) {
        loadComponent('/components/sidebar.html', 'sidebar-placeholder')
            .catch(err => console.error("Sidebar loading failed:", err));
    }
    // Add similar checks for other components like header or footer if needed
    // if (document.getElementById('header-placeholder')) {
    //     loadComponent('/components/header.html', 'header-placeholder');
    // }
});
