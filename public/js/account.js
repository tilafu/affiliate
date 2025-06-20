document.ad    // API Endpoints
    const profileUrl = `${window.API_BASE_URL}/api/user/profile`;
    const balancesUrl = `${window.API_BASE_URL}/api/user/balances`;
    
    // DOM Elements
    const usernameElem = document.getElementById('account-username');
    const referralCodeElem = document.getElementById('account-referral-code');
    const copyReferralBtn = document.getElementById('copy-referral-btn');
    const tierImageElem = document.getElementById('account-tier-image');
    const dailyProfitsElem = document.getElementById('account-daily-profits');
    const totalBalanceElem = document.getElementById('account-total-balance');
    const frozenBalanceElem = document.getElementById('account-frozen-balance');ener('DOMContentLoaded', () => {
    // Use centralized authentication check - but handle gracefully
    const authData = isAuthenticated(); // Use silent check instead of requireAuth
    
    if (!authData || !authData.token) {
        console.warn('User not authenticated on account page');
        // Show error state instead of redirecting
        setErrorState('Please log in to view account information');
        return;
    }

    // API Endpoints
    const profileUrl = `${window.API_BASE_URL}/api/user/profile`;
    const balancesUrl = `${window.API_BASE_URL}/api/user/balances`;// DOM Elements
    const usernameElem = document.getElementById('account-username');
    const referralCodeElem = document.getElementById('account-referral-code');
    const copyReferralBtn = document.getElementById('copy-referral-btn');
    const tierImageElem = document.getElementById('account-tier-image');
    const dailyProfitsElem = document.getElementById('account-daily-profits');
    const totalBalanceElem = document.getElementById('account-total-balance');
    const frozenBalanceElem = document.getElementById('account-frozen-balance');    // Tier Image Mapping
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
    };

    // Global variable to store referral code
    let currentReferralCode = '';

    // Copy to clipboard functionality
    const copyToClipboard = async (text) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                // Modern async clipboard API
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for older browsers or non-secure contexts
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            }
        } catch (error) {
            console.error('Failed to copy text: ', error);
            return false;
        }
    };

    // Setup copy button functionality
    const setupCopyFunctionality = () => {
        if (copyReferralBtn) {
            copyReferralBtn.addEventListener('click', async () => {
                if (!currentReferralCode) {
                    if (typeof showNotification === 'function') {
                        showNotification('No referral code available to copy', 'warning');
                    }
                    return;
                }

                const success = await copyToClipboard(currentReferralCode);
                
                if (success) {
                    // Visual feedback - change icon temporarily
                    const icon = copyReferralBtn.querySelector('i');
                    const originalClass = icon.className;
                    icon.className = 'fas fa-check';
                    copyReferralBtn.style.color = '#28a745';
                    
                    setTimeout(() => {
                        icon.className = originalClass;
                        copyReferralBtn.style.color = '';
                    }, 2000);

                    if (typeof showNotification === 'function') {
                        showNotification('Referral code copied to clipboard!', 'success');
                    }
                } else {
                    if (typeof showNotification === 'function') {
                        showNotification('Failed to copy referral code', 'error');
                    }
                }
            });
        }
    };// Helper function to update DOM with error state
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
            // Use fetchWithAuth for better error handling
            const [profileData, balancesData] = await Promise.all([
                fetchWithAuth('/api/user/profile'),
                fetchWithAuth('/api/user/balances')
            ]);

            // Update Profile Info
            if (profileData.success && profileData.user) {
                const user = profileData.user;
                if (usernameElem) usernameElem.textContent = user.username || 'N/A';
                if (referralCodeElem) {
                    const referralCode = user.referral_code || 'N/A';
                    referralCodeElem.textContent = referralCode;
                    currentReferralCode = referralCode; // Store for copying
                }

                // Update Tier Image
                if (tierImageElem) {
                    const tier = user.tier ? user.tier.toLowerCase() : 'default';
                    const imagePath = tierImagePaths[tier] || tierImagePaths.default;
                    tierImageElem.style.backgroundImage = `url(${imagePath})`;
                }
            } else {
                console.error('Profile data fetch failed:', profileData.message);
                setErrorState(`Profile error: ${profileData.message || 'Unknown error'}`);
                return;
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
                };                updateWithAnimation(dailyProfitsElem, balances.commission_balance);
                updateWithAnimation(totalBalanceElem, balances.main_balance);
                updateWithAnimation(frozenBalanceElem, balances.frozen_balance);
            } else {
                console.error('Balances data fetch failed:', balancesData.message);
                // Don't set error state for balances, just log it
            }
        } catch (error) {
            console.error('Error updating account data:', error);
            setErrorState(`Error loading account data: ${error.message}`);
        }
    };// Initial load
    updateAccountData().catch(error => {
        console.error('Initial account data load failed:', error);
        setErrorState(`Error loading account data: ${error.message}`);
    });

    // Setup copy functionality
    setupCopyFunctionality();// Initialize logout functionality
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
