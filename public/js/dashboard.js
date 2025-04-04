// Function to initialize dashboard logic (fetching data, setting up listeners)
async function initializeDashboard() {
    console.log('Initializing dashboard logic...');
    const token = getToken(); // From main.js

    if (!token) {
        console.log('No token found, redirecting to login.');
        window.location.href = 'login.html'; // Redirect if no token
        return;
    }

    // Get elements AFTER sidebar is loaded
    const usernameEl = document.getElementById('dashboard-username');
    const refcodeEl = document.getElementById('dashboard-refcode');
    const balancesEl = document.getElementById('dashboard-balances'); // Assuming this is outside the sidebar

    if (!usernameEl || !refcodeEl) {
        console.error('Sidebar elements (username/refcode) not found after component load.');
        return; // Stop if essential elements are missing
    }

     // Check for cached user data (for faster initial load)
     const cachedUserData = JSON.parse(localStorage.getItem('user_data'));
     if (cachedUserData) {
         console.log('Using cached user data');
         usernameEl.textContent = cachedUserData.username || 'N/A';
         refcodeEl.textContent = `REFERRAL CODE: ${cachedUserData.referral_code || 'N/A'}`; // Use correct property name
         if (balancesEl && cachedUserData.accounts) { // Check if balancesEl exists
             const mainBalance = cachedUserData.accounts.main?.balance ?? 'N/A';
             const trainingBalance = cachedUserData.accounts.training?.balance ?? 'N/A';
             balancesEl.textContent = `Main: $${mainBalance} | Training: $${trainingBalance}`;
         } else if (balancesEl) {
             balancesEl.textContent = 'Balances: N/A';
         }
     } else {
         console.log('No cached user data found.');
     }

     // Fetch fresh user data from the backend
     try {
         console.log('Fetching user profile data...');
         const data = await fetchWithAuth('/api/user/profile'); // Corrected path
         console.log('Profile API response:', data);

         if (data.success && data.user) {
             const user = data.user;
             usernameEl.textContent = user.username;
             refcodeEl.textContent = `REFERRAL CODE: ${user.referral_code}`;
             if (balancesEl) { // Check if balancesEl exists
                 const mainBalance = user.accounts?.main?.balance ?? 'N/A';
                 const trainingBalance = user.accounts?.training?.balance ?? 'N/A';
                 balancesEl.textContent = `Main: $${mainBalance} | Training: $${trainingBalance}`;
             }

             // Update localStorage cache
             localStorage.setItem('user_data', JSON.stringify(user));
         } else {
             console.error('Profile API call failed:', data.message);
             showNotification(data.message || 'Failed to load profile data.', 'error');
             if (!cachedUserData) {
                 usernameEl.textContent = 'Error';
                 refcodeEl.textContent = 'REFERRAL CODE: Error';
                 if (balancesEl) balancesEl.textContent = 'Balances: Error';
             }
         }
     } catch (error) {
         console.error('Error fetching profile data:', error);
         // Only show error if we have no cached data (avoid duplicate notifications on 401)
         if (!cachedUserData && error.message !== 'Unauthorized') {
             showNotification('Could not load dashboard data.', 'error');
             usernameEl.textContent = 'Error';
             refcodeEl.textContent = 'REFERRAL CODE: Error';
             if (balancesEl) balancesEl.textContent = 'Balances: Error';
         }
     }

    // --- Logout functionality (ensure it's attached after sidebar loads) ---
    // Note: If attachLogoutHandlers is defined globally (e.g., in main.js),
    // it might be better called from initializeSidebarScripts in components.js
    const logoutLink = document.querySelector('a[href="logout.html"]'); // Still might be outside sidebar
     if (logoutLink) {
         logoutLink.addEventListener('click', (e) => {
             e.preventDefault();
             console.log('Logging out via logout.html link...');
             localStorage.removeItem('auth_token');
             localStorage.removeItem('user_data');
             showNotification('Logged out successfully.', 'success', 2000);
             window.location.href = 'login.html';
         });
     }
}

// Wait for the DOM and then potentially wait for the sidebar component
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard script loaded');
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');

    if (sidebarPlaceholder) {
        // If the sidebar placeholder exists, wait for the component to load
        sidebarPlaceholder.addEventListener('componentLoaded', (event) => {
            if (event.detail.path === '/components/sidebar.html') {
                console.log('Sidebar component loaded, initializing dashboard.');
                initializeDashboard();
            }
        });
    } else {
        // If there's no sidebar placeholder, initialize immediately (e.g., for login page)
        // Although this script is dashboard.js, this handles edge cases.
        console.warn('Sidebar placeholder not found, initializing dashboard immediately.');
        initializeDashboard();
    }
});
