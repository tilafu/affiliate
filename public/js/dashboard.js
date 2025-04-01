document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard script loaded');
    const token = getToken(); // From main.js

    if (!token) {
        console.log('No token found, redirecting to login.');
        window.location.href = 'login.html';
        return;
    }

    // Elements to update
    const usernameEl = document.getElementById('dashboard-username');
    const refcodeEl = document.getElementById('dashboard-refcode');
    const balancesEl = document.getElementById('dashboard-balances');

    // Attempt to load data from localStorage first for faster display (optional)
    const cachedUserData = JSON.parse(localStorage.getItem('user_data'));
    if (cachedUserData) {
        console.log('Using cached user data');
        usernameEl.textContent = cachedUserData.username || 'N/A';
        refcodeEl.textContent = `REFERRAL CODE: ${cachedUserData.referralCode || 'N/A'}`;
        // Note: Balances might be stale, fetch fresh data below
        if (cachedUserData.accounts) {
             const mainBalance = cachedUserData.accounts.main?.balance ?? 'N/A';
             // Training balance might not exist if fetched during login after cap reached
             const trainingBalance = cachedUserData.accounts.training?.balance ?? 'N/A'; 
             balancesEl.textContent = `Main: $${mainBalance} | Training: $${trainingBalance}`;
        } else {
             balancesEl.textContent = 'Balances: N/A';
        }
    } else {
        console.log('No cached user data found.');
    }

    // Fetch fresh user data from the backend
    try {
        console.log('Fetching user profile data...');
        // We need to create this endpoint on the backend
        const response = await fetchWithAuth('/user/profile'); // Using fetchWithAuth from main.js

        if (!response.ok) {
            // fetchWithAuth already handles 401 redirect
            // Handle other errors (e.g., 404, 500)
            console.error(`Error fetching profile: ${response.status}`);
            showNotification(`Error loading profile (${response.status})`, 'error');
             if (!cachedUserData) { // Show error state if no cache
                 usernameEl.textContent = 'Error';
                 refcodeEl.textContent = 'REFERRAL CODE: Error';
                 balancesEl.textContent = 'Balances: Error';
             }
            return; 
        }

        const data = await response.json();
        console.log('Profile API response:', data);

        if (data.success && data.user) {
            const user = data.user;
            // Update UI with fresh data
            usernameEl.textContent = user.username;
            refcodeEl.textContent = `REFERRAL CODE: ${user.referral_code}`; // Use snake_case from DB
             const mainBalance = user.accounts?.main?.balance ?? 'N/A';
             const trainingBalance = user.accounts?.training?.balance ?? 'N/A';
             balancesEl.textContent = `Main: $${mainBalance} | Training: $${trainingBalance}`;

            // Update localStorage cache
            localStorage.setItem('user_data', JSON.stringify(user)); 
        } else {
            console.error('Profile API call failed:', data.message);
            showNotification(data.message || 'Failed to load profile data.', 'error');
             if (!cachedUserData) {
                 usernameEl.textContent = 'Error';
                 refcodeEl.textContent = 'REFERRAL CODE: Error';
                 balancesEl.textContent = 'Balances: Error';
             }
        }
    } catch (error) {
        // Network errors or fetchWithAuth errors (like 401) are caught here
        console.error('Error in dashboard setup:', error);
        // Notification might have already been shown by fetchWithAuth
         if (!cachedUserData && error.message !== 'Unauthorized') { // Avoid double notification on 401
             showNotification('Could not load dashboard data.', 'error');
             usernameEl.textContent = 'Error';
             refcodeEl.textContent = 'REFERRAL CODE: Error';
             balancesEl.textContent = 'Balances: Error';
         }
    }
});

// Add logout functionality (example)
document.addEventListener('DOMContentLoaded', () => {
    const logoutLink = document.querySelector('a[href="logout.html"]'); // Find logout link
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            console.log('Logging out...');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            showNotification('Logged out successfully.', 'success', 2000);
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        });
    }
});
