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
             // Tier elements from dashboard.html
             const tierNameEl = document.getElementById('dashboard-tier-name');
             const tierImageEl = document.getElementById('dashboard-tier-image');
             const tierDetailsEl = document.getElementById('dashboard-tier-details');
             // Balances element (might be elsewhere or not used)
             const balancesEl = document.getElementById('dashboard-balances');

             if (!usernameEl || !refcodeEl || !tierNameEl || !tierImageEl || !tierDetailsEl) {
                 console.error('Essential dashboard elements (username, refcode, or tier info) not found after component load.');
                 return; // Stop if essential elements are missing
             }

             // --- Update UI Function ---
             function updateUI(userData) {
                 // Update sidebar elements
                 usernameEl.textContent = userData.username || 'N/A';
                 refcodeEl.textContent = `REFERRAL CODE: ${userData.referral_code || 'N/A'}`;

                 // Update balances (if element exists)
                 if (balancesEl && userData.accounts) {
                     const mainBalance = userData.accounts.main?.balance ?? 'N/A';
                     const trainingBalance = userData.accounts.training?.balance ?? 'N/A';
                     balancesEl.textContent = `Main: $${mainBalance} | Training: $${trainingBalance}`;
                 } else if (balancesEl) {
                     balancesEl.textContent = 'Balances: N/A';
                 }

                 // Update Tier Information (assuming API provides these fields)
                 // TODO: Adjust property names (tier_name, tier_image_path, tier_benefits_html) if needed based on actual API response
                 tierNameEl.textContent = userData.tier_name || 'Tier N/A'; // e.g., "Gold Member"
                 if (userData.tier_image_path) {
                     tierImageEl.src = userData.tier_image_path; // e.g., "./assets/uploads/packages/gold_....PNG"
                     tierImageEl.alt = `${userData.tier_name || 'Tier'} Image`;
                 } else {
                     tierImageEl.src = './assets/uploads/packages/bronze_665c04ea981d91717306602.PNG'; // Default image
                     tierImageEl.alt = 'Default Tier Image';
                 }
                 // Assuming tier_benefits_html contains the <p> tag with the list items
                 tierDetailsEl.innerHTML = userData.tier_benefits_html || '<p>Benefits not available.</p>';
             }

             // Check for cached user data (for faster initial load)
             const cachedUserData = JSON.parse(localStorage.getItem('user_data'));
             if (cachedUserData) {
                 console.log('Using cached user data');
                 updateUI(cachedUserData);
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
                  updateUI(user); // Update UI with fresh data

                  // Update localStorage cache
                  localStorage.setItem('user_data', JSON.stringify(user));
              } else {
                  console.error('Profile API call failed:', data.message);
                  showNotification(data.message || 'Failed to load profile data.', 'error');
                  // Don't overwrite cached data if API fails
                  if (!cachedUserData) {
                      usernameEl.textContent = 'Error';
                      refcodeEl.textContent = 'REFERRAL CODE: Error';
                      if (balancesEl) balancesEl.textContent = 'Balances: Error';
                      tierNameEl.textContent = 'Tier Error';
                      tierDetailsEl.innerHTML = '<p>Could not load tier benefits.</p>';
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
                  tierNameEl.textContent = 'Tier Error';
                  tierDetailsEl.innerHTML = '<p>Could not load tier benefits.</p>';
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
