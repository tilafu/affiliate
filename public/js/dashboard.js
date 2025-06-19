// Function to ensure i18n content is updated with correct translations
function updatePageTranslations() {
    // Use the simplified fallback text conversion system
    if (typeof updateContent === 'function') {
        updateContent();
        console.log('Updated page translations using fallback text conversion');
    } else {
        console.warn('updateContent function not available');
    }
}

// Function to initialize dashboard logic (fetching data, setting up listeners)
async function initializeDashboard() {
    // Check if SimpleAuth is available
    if (typeof SimpleAuth === 'undefined') {
        console.warn('SimpleAuth not available yet, using fallback authentication');
        
        // Use fallback authentication check
        const authData = isAuthenticated();
        if (!authData) {
            console.log('No authentication data, using default dashboard');
            return;
        }
        
        // Use fetchWithAuth as fallback
        return initializeDashboardWithFallback(authData);
    }
    
    // Use silent authentication check to avoid redirects
    const authData = isAuthenticated();
    if (!authData) {
        console.log('No authentication data, using default dashboard');
        return; // Don't redirect, just use default data
    }

    console.log('Dashboard authData:', authData);
    console.log('Token from authData:', authData.token ? `${authData.token.substring(0, 10)}...` : 'no token');

    const usernameEl = document.getElementById('dashboard-username');
    const refcodeEl = document.getElementById('dashboard-refcode');
    const balancesEl = document.getElementById('dashboard-balances');

    // Try to use cached data first
    const cachedUserData = localStorage.getItem('user_data');    try {        
        console.log('Making API call to /api/user/profile');
        
        // Use SimpleAuth if available, otherwise use fetchWithAuth
        const response = typeof SimpleAuth !== 'undefined' ? 
                        await SimpleAuth.authenticatedFetch('/api/user/profile') :
                        await fetchWithAuth('/api/user/profile');
        
        console.log('Profile API response status:', response.status);
        
        const data = await response.json();
        console.log('Profile API response data:', data);

        if (data.success && data.user) {
            const user = data.user;
            if (usernameEl) usernameEl.textContent = user.username;
            if (refcodeEl) refcodeEl.textContent = `REFERRAL CODE: ${user.referral_code}`;              console.log('Making API call to /api/user/balances');
              
              // Fetch balances separately for real-time accuracy
            const balancesResponse = typeof SimpleAuth !== 'undefined' ? 
                                   await SimpleAuth.authenticatedFetch('/api/user/balances') :
                                   await fetchWithAuth('/api/user/balances');
            
            console.log('Balances API response status:', balancesResponse.status);
            
            const balancesData = await balancesResponse.json();
            console.log('Balances API response data:', balancesData);
            
            if (balancesData.success && balancesEl) {
                const mainBalance = parseFloat(balancesData.balances.main_balance || 0).toFixed(2);
                const commissionBalance = parseFloat(balancesData.balances.commission_balance || 0).toFixed(2);
                balancesEl.innerHTML = `Main: <strong>${mainBalance}</strong> USDT | Commission: <strong>${commissionBalance}</strong> USDT`;
            }// Update localStorage cache
            localStorage.setItem('user_data', JSON.stringify(user));
            
            // Update membership tier display
            updateMembershipTier(user.tier || 'bronze');
              // Fetch additional data sequentially to avoid race conditions
            try {
                // Fetch and update drive progress
                await fetchDriveProgress();
            } catch (error) {
                console.error('Error fetching drive progress:', error);
                if (error.message.includes('authentication')) {
                    showNotification('Drive progress requires authentication. Please login.', 'warning');
                }
            }
            
            try {
                // Fetch and update transaction balances
                await updateTransactionBalances();
            } catch (error) {
                console.error('Error updating transaction balances:', error);
                if (error.message.includes('authentication')) {
                    showNotification('Transaction data requires authentication. Please login.', 'warning');
                }
            }
            
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
        showNotification('Error loading dashboard data', 'error');        // Use cached data as fallback
        if (cachedUserData) {
            try {
                const user = JSON.parse(cachedUserData);
                if (usernameEl) usernameEl.textContent = user.username;
                if (refcodeEl) refcodeEl.textContent = `REFERRAL CODE: ${user.referral_code}`;
                if (balancesEl) balancesEl.innerHTML = 'Balance: Using cached data';
                
                // Try to update tier from cached data
                updateMembershipTier(user.tier || 'bronze');
            } catch (e) {
                console.error('Error parsing cached user data:', e);
            }
        }
    }
}

// Fallback initialization function for when SimpleAuth is not available
async function initializeDashboardWithFallback(authData) {
    console.log('Using fallback dashboard initialization');
    
    const usernameEl = document.getElementById('dashboard-username');
    const refcodeEl = document.getElementById('dashboard-refcode');
    const balancesEl = document.getElementById('dashboard-balances');

    // Try to use cached data first
    const cachedUserData = localStorage.getItem('user_data');

    try {
        // Use fetchWithAuth as fallback
        const response = await fetchWithAuth('/api/user/profile');
        const data = await response.json();
        
        if (data.success && data.user) {
            const user = data.user;
            if (usernameEl) usernameEl.textContent = user.username;
            if (refcodeEl) refcodeEl.textContent = `REFERRAL CODE: ${user.referral_code}`;
            
            // Fetch balances separately
            try {
                const balancesResponse = await fetchWithAuth('/api/user/balances');
                const balancesData = await balancesResponse.json();
                
                if (balancesData.success && balancesEl) {
                    const mainBalance = parseFloat(balancesData.balances.main_balance || 0).toFixed(2);
                    const commissionBalance = parseFloat(balancesData.balances.commission_balance || 0).toFixed(2);
                    balancesEl.innerHTML = `Main: <strong>${mainBalance}</strong> USDT | Commission: <strong>${commissionBalance}</strong> USDT`;
                }
            } catch (error) {
                console.error('Error fetching balances:', error);
            }
            
            // Update localStorage cache
            localStorage.setItem('user_data', JSON.stringify(user));
            
            // Update membership tier display
            updateMembershipTier(user.tier || 'bronze');
        }
    } catch (error) {
        console.error('Error in fallback dashboard initialization:', error);
        
        // Use cached data as fallback
        if (cachedUserData) {
            try {
                const user = JSON.parse(cachedUserData);
                if (usernameEl) usernameEl.textContent = user.username;
                if (refcodeEl) refcodeEl.textContent = `REFERRAL CODE: ${user.referral_code}`;
                if (balancesEl) balancesEl.innerHTML = 'Balance: Using cached data';
                
                updateMembershipTier(user.tier || 'bronze');
            } catch (e) {
                console.error('Error parsing cached user data:', e);
            }
        }
    }
}

// Wait for the DOM and then potentially wait for the sidebar component
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard script loaded');
    
    // Apply simplified i18n text conversion immediately
    updatePageTranslations();
    
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');

    if (sidebarPlaceholder) {
        // If the sidebar placeholder exists, wait for the component to load
        sidebarPlaceholder.addEventListener('componentLoaded', (event) => {
            if (event.detail.path === '/components/sidebar.html') {
                console.log('Sidebar component loaded, initializing dashboard.');
                
                // Update translations again after sidebar loads
                updatePageTranslations();
                
                // Initialize dashboard after sidebar loads
                initializeDashboard();
            }
        });
    } else {
        // If there's no sidebar placeholder, initialize immediately
        console.warn('Sidebar placeholder not found, initializing dashboard immediately.');
        initializeDashboard();
    }
});

// Remove the old i18next language change listener since it's no longer available

/**
 * Fetch and update the drive progress on the dashboard
 */
async function fetchDriveProgress() {    try {
        console.log('Making API call to /api/user/drive-progress');
        
        const response = typeof SimpleAuth !== 'undefined' ? 
                        await SimpleAuth.authenticatedFetch('/api/user/drive-progress') :
                        await fetchWithAuth('/api/user/drive-progress');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Drive progress API response:', data);        if (data && data.success) {
            // Update the "Completed" counter
            const completedEl = document.querySelector('[data-i18n="completedWorkingDays"]');
            if (completedEl) {
                const completedCount = data.total_working_days || 0;
                completedEl.setAttribute('data-i18n-options', `{"count": ${completedCount}}`);
                completedEl.innerHTML = `<b>Completed (${completedCount})</b>`;
            }
            
            // Update the progress bar and text
            const progressTextEl = document.querySelector('[data-i18n="progressWorkingDays"]');
            const progressBarEl = document.querySelector('.progress-bar.bg-info');
            
            if (progressTextEl && progressBarEl) {
                const completed = data.weekly?.progress || 0;
                const total = data.weekly?.total || 7;
                
                progressTextEl.setAttribute('data-i18n-options', `{"completed": ${completed}, "total": ${total}}`);
                progressTextEl.textContent = `Progress (${completed}/${total})`;
                
                const percentage = Math.min(Math.round((completed / total) * 100), 100);
                progressBarEl.style.width = `${percentage}%`;
                
                // Add a tooltip to show more details if needed
                progressBarEl.setAttribute('title', `${percentage}% of weekly goal completed`);
                
                // Add a visual effect for today's completion
                if (data.today?.is_working_day) {
                    // Add a small badge or indicator that today's quota is complete
                    const workingDaysDescEl = document.querySelector('[data-i18n="workingDaysDescription"]');
                    if (workingDaysDescEl) {
                        workingDaysDescEl.innerHTML += '<span class="badge bg-success ms-2">Today Complete!</span>';
                    }
                }
            }
            
            console.log('Drive progress updated successfully');
        } else {
            console.error('Failed to fetch drive progress:', data ? (data.info || data.message || 'Unknown error') : 'No data returned');
        }    } catch (error) {
        console.error('Failed to fetch drive progress:', error.message || 'Unknown error');
        console.error('Drive progress error details:', error);
    }
}

/**
 * Update the membership tier section based on user's current tier
 * @param {string} tier - User's membership tier (bronze, silver, gold, platinum)
 */
function updateMembershipTier(tier) {
    console.log(`Updating membership display for tier: ${tier}`);
    
    // Default to bronze if tier is not provided
    tier = tier || 'bronze';
    
    // Define tier-specific information
    const tierInfo = {        bronze: {
            displayName: 'Bronze Member',
            imageSrc: './assets/uploads/packages/bronze_665c04ea981d91717306602.PNG',
            commissionPerData: 1.0,
            commissionMergeData: 3.0,
            dataLimit: 40,
            setsPerDay: 2,
            withdrawalLimit: 25000,
            withdrawalTimes: 1,
            handlingFee: 0
        },
        silver: {
            displayName: 'Silver Member',
            imageSrc: './assets/uploads/packages/silver_665c0568227141717306728.PNG',
            commissionPerData: 1.2,
            commissionMergeData: 3.5,
            dataLimit: 40,
            setsPerDay: 2,
            withdrawalLimit: 35000,
            withdrawalTimes: 1,
            handlingFee: 0
        },
        gold: {
            displayName: 'Gold Member',
            imageSrc: './assets/uploads/packages/gold_665c05eea02a21717306862.PNG',
            commissionPerData: 1.5,
            commissionMergeData: 4.5,
            dataLimit: 45,
            setsPerDay: 2,
            withdrawalLimit: 50000,
            withdrawalTimes: 2,
            handlingFee: 0
        },
        platinum: {
            displayName: 'Platinum Member',
            imageSrc: './assets/uploads/packages/platinum_665c064b7faf81717306955.PNG',
            commissionPerData: 2.0,
            commissionMergeData: 5.0,
            dataLimit: 50,
            setsPerDay: 2,
            withdrawalLimit: 75000,
            withdrawalTimes: 3,
            handlingFee: 0
        }
    };
    
    // Get tier data
    const currentTier = tierInfo[tier.toLowerCase()] || tierInfo.bronze;
    
    // Update the DOM elements
    const tierImage = document.querySelector('.flex.justify-between.items-center img');
    const tierTitle = document.querySelector('[data-i18n="eliteMemberTitle"]');
    const commissionPerData = document.querySelector('[data-i18n="eliteMemberCommissionPerData"]');
    const commissionMergeData = document.querySelector('[data-i18n="eliteMemberCommissionMergeData"]');
    const dataLimit = document.querySelector('[data-i18n="eliteMemberDataLimit"]');
    const withdrawalLimit = document.querySelector('[data-i18n="eliteMemberWithdrawalLimit"]');
    const withdrawalTimes = document.querySelector('[data-i18n="eliteMemberWithdrawalTimes"]');
    const handlingFee = document.querySelector('[data-i18n="eliteMemberHandlingFee"]');
    
    // Update image source
    if (tierImage) {
        tierImage.src = currentTier.imageSrc;
        tierImage.alt = currentTier.displayName;
    }
      // Update tier information with fallback text
    if (tierTitle) {
        tierTitle.textContent = currentTier.displayName;
    }
      // Update commission per data
    if (commissionPerData) {
        commissionPerData.textContent = `● ${currentTier.commissionPerData}% commission per data`;
    }
    
    // Update commission for merge data
    if (commissionMergeData) {
        commissionMergeData.textContent = `● ${currentTier.commissionMergeData}% commission for merge data`;
    }
    
    // Update data limit
    if (dataLimit) {
        dataLimit.textContent = `● Limited to ${currentTier.dataLimit} data per set, ${currentTier.setsPerDay} sets of data everyday`;
    }
    
    // Update withdrawal limit
    if (withdrawalLimit) {
        withdrawalLimit.textContent = `● withdrawal limit: ${currentTier.withdrawalLimit} USDT`;
    }
    
    // Update withdrawal times
    if (withdrawalTimes) {
        withdrawalTimes.textContent = `● ${currentTier.withdrawalTimes} times of withdrawal`;
    }
    
    // Update handling fee
    if (handlingFee) {
        handlingFee.textContent = `● ${currentTier.handlingFee}% handling fee`;
    }
      // If i18next is initialized, update translations
    if (window.i18next && window.i18next.isInitialized) {
        updatePageTranslations();
    }
    
    // Add a badge or visual indicator for the tier level
    const membershipHeader = document.querySelector('[data-i18n="tierMembershipHeader"]');
    if (membershipHeader) {
        // Remove any existing badges
        const existingBadge = membershipHeader.querySelector('.tier-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        // Create and add a new badge
        const badge = document.createElement('span');
        badge.className = `tier-badge badge ms-2 bg-${tier.toLowerCase()}`;
        badge.textContent = tier.charAt
        badge.style.marginLeft = '5px';
        badge.style.fontSize = '10px';
        
        // Set badge color based on tier
        switch(tier.toLowerCase()) {
            case 'bronze':
                badge.style.backgroundColor = '#CD7F32';
                break;
            case 'silver':
                badge.style.backgroundColor = '#C0C0C0';
                badge.style.color = '#333';
                break;
            case 'gold':
                badge.style.backgroundColor = '#FFD700';
                badge.style.color = '#333';
                break;
            case 'platinum':
                badge.style.backgroundColor = '#E5E4E2';
                badge.style.color = '#333';
                break;
        }
        
        // Insert after the "Tier Membership" text but before the "View more" link
        const viewMoreLink = membershipHeader.querySelector('span');
        if (viewMoreLink) {
            membershipHeader.insertBefore(badge, viewMoreLink);
        } else {
            membershipHeader.appendChild(badge);
        }
    }
}

/**
 * Function to update the Current Transaction section with real balance data
 */
async function updateTransactionBalances() {
    try {
        console.log('Making API calls for transaction balances');
        
        // Fetch current balance (main balance)
        const balancesResponse = typeof SimpleAuth !== 'undefined' ? 
                               await SimpleAuth.authenticatedFetch('/api/user/balances') :
                               await fetchWithAuth('/api/user/balances');
        
        // Fetch total withdrawals
        const withdrawalsResponse = typeof SimpleAuth !== 'undefined' ? 
                                  await SimpleAuth.authenticatedFetch('/api/user/withdrawals') :
                                  await fetchWithAuth('/api/user/withdrawals');

        const balancesData = await balancesResponse.json();
        const withdrawalsData = await withdrawalsResponse.json();
        
        console.log('Balances data:', balancesData);
        console.log('Withdrawals data:', withdrawalsData);

        // Update Current Balance (main balance)
        const depositBalanceEl = document.getElementById('depositBalance');
        if (depositBalanceEl && balancesData.success) {
            const mainBalance = parseFloat(balancesData.balances?.main_balance || 0);
            depositBalanceEl.textContent = `$${mainBalance.toFixed(2)}`;
            console.log('Updated current balance:', mainBalance);
        }

        // Update Withdrawals
        const withdrawBalanceEl = document.getElementById('withdrawBalance');
        if (withdrawBalanceEl && withdrawalsData.success) {
            const totalWithdrawals = parseFloat(withdrawalsData.totalWithdrawals || 0);
            withdrawBalanceEl.textContent = `$${totalWithdrawals.toFixed(2)}`;
            console.log('Updated total withdrawals:', totalWithdrawals);
        }

        // Update the transaction limit display if available
        const transactionLimitEl = document.querySelector('.section-header .text-muted');
        if (transactionLimitEl && balancesData.success) {
            const mainBalance = parseFloat(balancesData.balances?.main_balance || 0);
            const limit = 25000; // You can make this dynamic based on user tier
            transactionLimitEl.textContent = `$${mainBalance.toFixed(2)} / $${limit.toLocaleString()}`;
        }

    } catch (error) {
        console.error('Error updating transaction balances:', error);
        
        // Set fallback values on error
        const depositBalanceEl = document.getElementById('depositBalance');
        const withdrawBalanceEl = document.getElementById('withdrawBalance');
        
        if (depositBalanceEl) depositBalanceEl.textContent = '$0.00';
        if (withdrawBalanceEl) withdrawBalanceEl.textContent = '$0.00';
    }
}

/**
 * Set up periodic refresh of transaction balances
 */
function setupTransactionBalanceRefresh() {
    const authData = isAuthenticated();
    if (!authData) return;

    // Refresh transaction balances every 30 seconds
    setInterval(async () => {
        await updateTransactionBalances(authData.token);
    }, 30000);
}

// Start the refresh when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Set up periodic refresh after a short delay
    setTimeout(setupTransactionBalanceRefresh, 2000);
});

// Helper function to generate user initials properly
function generateUserInitials(username) {
    if (!username) return 'U';
    
    // Remove extra spaces and split by space
    const nameParts = username.trim().split(/\s+/).filter(part => part.length > 0);
    
    if (nameParts.length === 0) return 'U';
    
    if (nameParts.length === 1) {
        // Single word username - take first 2 characters
        const name = nameParts[0];
        return name.length >= 2 ? name.substring(0, 2).toUpperCase() : name.toUpperCase();
    } else {
        // Multiple words - take first letter of each word (max 2)
        return nameParts.slice(0, 2).map(name => name[0]).join('').toUpperCase();
    }
}

// Make it globally available
window.generateUserInitials = generateUserInitials;

// Check if SimpleAuth is available and retry if needed
function checkAndInitializeDashboard() {
    if (typeof SimpleAuth !== 'undefined') {
        console.log('SimpleAuth is now available, initializing dashboard');
        initializeDashboard();
    } else if (typeof fetchWithAuth === 'function') {
        console.log('Using fallback authentication for dashboard');
        const authData = isAuthenticated();
        if (authData) {
            initializeDashboardWithFallback(authData);
        }
    } else {
        console.warn('No authentication system available, will retry in 500ms');
        setTimeout(checkAndInitializeDashboard, 500);
    }
}

// Make functions globally available
window.checkAndInitializeDashboard = checkAndInitializeDashboard;
window.initializeDashboard = initializeDashboard;
