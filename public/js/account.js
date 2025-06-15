document.addEventListener('DOMContentLoaded', () => {
    // Use centralized authentication check
    const authData = requireAuth();
    if (!authData) {
        return; // requireAuth will handle redirect
    }    // API Endpoints
    const profileUrl = `${window.API_BASE_URL}/api/user/profile`;
    const balancesUrl = `${window.API_BASE_URL}/api/user/balances`;

    // DOM Elements
    const usernameElem = document.getElementById('account-username');
    const referralCodeElem = document.getElementById('account-referral-code');
    const tierImageElem = document.getElementById('account-tier-image');
    const dailyProfitsElem = document.getElementById('account-daily-profits');
    const totalBalanceElem = document.getElementById('account-total-balance');
    const frozenBalanceElem = document.getElementById('account-frozen-balance');

    // Tier Image Mapping
    const tierImagePaths = {
        bronze: './assets/uploads/packages/bronze_665c04ea981d91717306602.PNG',
        silver: './assets/uploads/packages/silver_665c0568227141717306728.PNG',
        gold: './assets/uploads/packages/gold_665c05eea02a21717306862.PNG',
        platinum: './assets/uploads/packages/platinum_665c064b7faf81717306955.PNG',
        default: './assets/uploads/v2.PNG'
    };

    // Helper function to format balance display
    const formatBalance = (value) => {
        const amount = parseFloat(value || 0).toFixed(2);
        return `${amount}<small style="font-size:14px"> USDT</small>`;
    };    // Helper function to update DOM with error state
    const setErrorState = (message = 'Error loading data') => {
        if (usernameElem) usernameElem.textContent = 'Error';
        if (referralCodeElem) referralCodeElem.textContent = 'Error';
        if (dailyProfitsElem) dailyProfitsElem.innerHTML = formatBalance(0);
        if (totalBalanceElem) totalBalanceElem.innerHTML = formatBalance(0);
        if (frozenBalanceElem) frozenBalanceElem.innerHTML = formatBalance(0);
        if (tierImageElem) tierImageElem.style.backgroundImage = `url(${tierImagePaths.default})`;
        
        if (typeof showNotification === 'function') {
            showNotification(message, 'error');
        }
    };    // Auto-update function to refresh account data
    const updateAccountData = async () => {
        try {
            const [profileResponse, balancesResponse] = await Promise.all([
                fetch(profileUrl, {
                    headers: { 'Authorization': `Bearer ${authData.token}` }
                }),
                fetch(balancesUrl, {
                    headers: { 'Authorization': `Bearer ${authData.token}` }
                })
            ]);

            if (!profileResponse.ok || !balancesResponse.ok) {
                throw new Error('Failed to fetch account data');
            }

            const [profileData, balancesData] = await Promise.all([
                profileResponse.json(),
                balancesResponse.json()
            ]);

            // Update Profile Info
            if (profileData.success && profileData.user) {
                const user = profileData.user;
                if (usernameElem) usernameElem.textContent = user.username || 'N/A';
                if (referralCodeElem) referralCodeElem.textContent = user.referral_code || 'N/A';

                // Update Tier Image
                if (tierImageElem) {
                    const tier = user.tier ? user.tier.toLowerCase() : 'default';
                    const imagePath = tierImagePaths[tier] || tierImagePaths.default;
                    tierImageElem.style.backgroundImage = `url(${imagePath})`;
                }
            }

            // Update Balances with animation
            if (balancesData.success && balancesData.balances) {
                const balances = balancesData.balances;
                
                // Add update animation
                const updateWithAnimation = (element, newValue) => {
                    if (element) {
                        element.style.transition = 'opacity 0.3s ease';
                        element.style.opacity = '0.7';
                        setTimeout(() => {
                            element.innerHTML = formatBalance(newValue);
                            element.style.opacity = '1';
                        }, 150);
                    }
                };

                updateWithAnimation(dailyProfitsElem, balances.commission_balance);
                updateWithAnimation(totalBalanceElem, balances.main_balance);
                updateWithAnimation(frozenBalanceElem, balances.frozen_balance);
            }
        } catch (error) {
            console.error('Error updating account data:', error);
            // Don't show error notifications for background updates unless critical
        }
    };    // Initial load
    updateAccountData().catch(error => {
        console.error('Initial account data load failed:', error);
        setErrorState(`Error loading account data: ${error.message}`);
    });    // Initialize logout functionality
    if (typeof attachLogoutHandlers === 'function') {
        attachLogoutHandlers();
    } else {
        console.warn('attachLogoutHandlers not available, setting up fallback');
        // Fallback logout handler for account page
        const accountLogoutBtn = document.getElementById('account-logout-btn');        if (accountLogoutBtn) {
            accountLogoutBtn.addEventListener('click', async function(e) {
                e.preventDefault();
                console.log('Account logout clicked (fallback)...');
                
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
                    // Clear authentication data
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user_data');
                    
                    // Show notification if available
                    if (typeof showNotification === 'function') {
                        showNotification('Logout successful!', 'success');
                        setTimeout(() => {
                            window.location.href = 'login.html';
                        }, 1000);
                    } else {
                        window.location.href = 'login.html';
                    }
                }
            });
        }
    }

    // Set up auto-refresh every 30 seconds
    const refreshInterval = setInterval(updateAccountData, 30000);

    // Clean up interval when page is hidden/unloaded
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearInterval(refreshInterval);
        } else {
            // Refresh immediately when page becomes visible again
            updateAccountData();
            // Restart the interval
            setInterval(updateAccountData, 30000);
        }
    });

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        clearInterval(refreshInterval);
    });
});
