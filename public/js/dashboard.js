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

/**
 * Simple notification function that uses alert for now
 * Normally would use a nicer toast or popup
 */
function showNotification(message, type = 'info') {
    console.log(`[${type}] ${message}`);
    
    // Check if jQuery dialog is available first
    if (typeof $(document).dialog === 'function') {
        $(document).dialog({
            infoText: message,
            autoClose: 3000,
            type: type === 'error' ? 'notice' : 'success'
        });
    } else {
        // Fallback to alert for simplicity
        alert(message);
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
            }            // Update localStorage cache
            localStorage.setItem('user_data', JSON.stringify(user));
            
            // Update membership tier display
            updateMembershipTier(user.tier || 'bronze');
            
            // Fetch and update drive progress
            await fetchDriveProgress(token);
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

/**
 * Fetch and update the drive progress on the dashboard
 */
async function fetchDriveProgress(token) {
    if (!token) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/drive/progress`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.code === 0) {
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
                const completed = data.weekly.progress || 0;
                const total = data.weekly.total || 7;
                
                progressTextEl.setAttribute('data-i18n-options', `{"completed": ${completed}, "total": ${total}}`);
                progressTextEl.textContent = `Progress (${completed}/${total})`;
                
                const percentage = Math.min(Math.round((completed / total) * 100), 100);
                progressBarEl.style.width = `${percentage}%`;
                
                // Add a tooltip to show more details if needed
                progressBarEl.setAttribute('title', `${percentage}% of weekly goal completed`);
                
                // Add a visual effect for today's completion
                if (data.today.is_working_day) {
                    // Add a small badge or indicator that today's quota is complete
                    const workingDaysDescEl = document.querySelector('[data-i18n="workingDaysDescription"]');
                    if (workingDaysDescEl) {
                        workingDaysDescEl.innerHTML += '<span class="badge bg-success ms-2">Today Complete!</span>';
                    }
                }
            }
            
            console.log('Drive progress updated successfully');
        } else {
            console.error('Failed to fetch drive progress:', data.info);
        }    } catch (error) {
        console.error('Error fetching drive progress:', error);
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
    const tierInfo = {
        bronze: {
            displayName: 'Bronze Member',
            imageSrc: './assets/uploads/packages/bronze.png',
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
            imageSrc: './assets/uploads/packages/silver.png',
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
            imageSrc: './assets/uploads/packages/platinum.png',
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
    
    // Update title
    if (tierTitle) {
        tierTitle.textContent = currentTier.displayName;
        tierTitle.setAttribute('data-i18n-options', JSON.stringify({ tier: tier }));
    }
    
    // Update commission per data
    if (commissionPerData) {
        commissionPerData.textContent = `● ${currentTier.commissionPerData}% commission per data`;
        commissionPerData.setAttribute('data-i18n-options', JSON.stringify({ percentage: currentTier.commissionPerData }));
    }
    
    // Update commission for merge data
    if (commissionMergeData) {
        commissionMergeData.textContent = `● ${currentTier.commissionMergeData}% commission for merge data`;
        commissionMergeData.setAttribute('data-i18n-options', JSON.stringify({ percentage: currentTier.commissionMergeData }));
    }
    
    // Update data limit
    if (dataLimit) {
        dataLimit.textContent = `● Limited to ${currentTier.dataLimit} data per set, ${currentTier.setsPerDay} sets of data everyday`;
        dataLimit.setAttribute('data-i18n-options', JSON.stringify({ 
            dataLimit: currentTier.dataLimit, 
            setsPerDay: currentTier.setsPerDay 
        }));
    }
    
    // Update withdrawal limit
    if (withdrawalLimit) {
        withdrawalLimit.textContent = `● withdrawal limit: ${currentTier.withdrawalLimit} USDT`;
        withdrawalLimit.setAttribute('data-i18n-options', JSON.stringify({ limit: currentTier.withdrawalLimit }));
    }
    
    // Update withdrawal times
    if (withdrawalTimes) {
        withdrawalTimes.textContent = `● ${currentTier.withdrawalTimes} times of withdrawal`;
        withdrawalTimes.setAttribute('data-i18n-options', JSON.stringify({ times: currentTier.withdrawalTimes }));
    }
    
    // Update handling fee
    if (handlingFee) {
        handlingFee.textContent = `● ${currentTier.handlingFee}% handling fee`;
        handlingFee.setAttribute('data-i18n-options', JSON.stringify({ percentage: currentTier.handlingFee }));
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
        badge.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);
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
