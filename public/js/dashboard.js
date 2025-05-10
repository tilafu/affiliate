// Function to ensure i18n content is updated with correct translations
function updatePageTranslations() {
    // Only run if i18next is available and initialized
    if (window.i18next && window.i18next.isInitialized) {
        // Call the global updateContent function from i18n.js
        if (typeof updateContent === 'function') {
            updateContent();
            console.log('Updated page translations');
        } else {
            console.warn('updateContent function not available');
        }
    } else {
        console.warn('i18next not initialized yet');
    }
}

// Function to initialize dashboard logic (fetching data, setting up listeners)
async function initializeDashboard() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const usernameEl = document.getElementById('dashboard-username');
    const refcodeEl = document.getElementById('dashboard-refcode');
    const balancesEl = document.getElementById('dashboard-balances');

    // Try to use cached data first
    const cachedUserData = localStorage.getItem('user_data');

    try {
        // Fetch fresh data
        const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && data.user) {
            const user = data.user;
            if (usernameEl) usernameEl.textContent = user.username;
            if (refcodeEl) refcodeEl.textContent = `REFERRAL CODE: ${user.referral_code}`;
            
            // Fetch balances separately for real-time accuracy
            const balancesResponse = await fetch(`${API_BASE_URL}/api/user/balances`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const balancesData = await balancesResponse.json();
            
            if (balancesData.success && balancesEl) {
                const mainBalance = parseFloat(balancesData.balances.main_balance || 0).toFixed(2);
                const commissionBalance = parseFloat(balancesData.balances.commission_balance || 0).toFixed(2);
                balancesEl.innerHTML = `Main: <strong>${mainBalance}</strong> USDT | Commission: <strong>${commissionBalance}</strong> USDT`;
            }

            // Update localStorage cache
            localStorage.setItem('user_data', JSON.stringify(user));
        } else {
            console.error('Profile API call failed:', data.message);
            showNotification(data.message || 'Failed to load profile data.', 'error');
            if (!cachedUserData) {
                if (usernameEl) usernameEl.textContent = 'Error';
                if (refcodeEl) refcodeEl.textContent = 'REFERRAL CODE: Error';
                if (balancesEl) balancesEl.innerHTML = 'Balance: Error';
            }
        }
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Error loading dashboard data', 'error');
        // Use cached data as fallback
        if (cachedUserData) {
            try {
                const user = JSON.parse(cachedUserData);
                if (usernameEl) usernameEl.textContent = user.username;
                if (refcodeEl) refcodeEl.textContent = `REFERRAL CODE: ${user.referral_code}`;
                if (balancesEl) balancesEl.innerHTML = 'Balance: Using cached data';
            } catch (e) {
                console.error('Error parsing cached user data:', e);
            }
        }
    }
}

// Wait for the DOM and then potentially wait for the sidebar component
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard script loaded');
    
    // Initialize i18n if not already initialized
    if (typeof initI18next === 'function' && window.i18next && !window.i18next.isInitialized) {
        initI18next().then(() => {
            console.log('i18next initialized');
            // After i18next initializes, update translations
            updatePageTranslations();
        });
    } else if (window.i18next && window.i18next.isInitialized) {
        // If already initialized, just update translations
        console.log('i18next already initialized, updating translations');
        updatePageTranslations();
    }
    
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');

    if (sidebarPlaceholder) {
        // If the sidebar placeholder exists, wait for the component to load
        sidebarPlaceholder.addEventListener('componentLoaded', (event) => {
            if (event.detail.path === '/components/sidebar.html') {
                console.log('Sidebar component loaded, initializing dashboard.');
                
                // Setup language switcher after sidebar loads
                const langSwitcher = document.getElementById('language-switcher');
                if (langSwitcher) {
                    // Set initial value
                    langSwitcher.value = i18next.language || 'en';
                    
                    // Add change event listener
                    langSwitcher.addEventListener('change', (e) => {
                        setLanguage(e.target.value);
                    });
                }
                
                // Update translations again after sidebar loads
                updatePageTranslations();
                
                initializeDashboard();
            }
        });
    } else {
        // If there's no sidebar placeholder, initialize immediately
        console.warn('Sidebar placeholder not found, initializing dashboard immediately.');
        initializeDashboard();
    }
});

// Add language change event listener
if (window.i18next) {
    window.i18next.on('languageChanged', () => {
        console.log('Language changed, updating translations');
        updatePageTranslations();
    });
}
