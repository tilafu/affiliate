// Account information display and update functions

// Format money values for display
function formatMoney(amount) {
    if (amount === null || amount === undefined) return '0.00';
    return parseFloat(amount).toFixed(2);
}

// Initialize account page data
async function initializeAccountData() {
    console.log('Initializing account data...');
    const token = getToken(); // Assuming this function exists in main.js
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        // Fetch initial account data
        const data = await fetchWithAuth('/api/user/account');
        console.log('Account data loaded:', data);
        
        // Call the update function with the fetched data
        updateUIWithAccountData(data);
        
        // Setup socket connection for real-time updates
        setupSocketConnection();
        
    } catch (error) {
        console.error('Error loading account data:', error);
        showNotification('Could not load account information.', 'error');
    }
}

// Update the UI data display function with more robust selectors
function updateUIWithAccountData(data) {
    if (!data || !data.success || !data.account) {
        console.error('Invalid data format received');
        return;
    }

    const account = data.account;
    console.log('Updating UI with account data:', account);
    
    // DEBUGGING: Log the DOM structure we're working with
    console.log('DOM Structure for debugging:');
    console.log('All potential username elements:', document.querySelectorAll('uni-view[data-v-9f90816a].font-bold.font-size-14'));
    
    // More robust username update - try multiple potential selectors
    const usernameSelectors = [
        'uni-view.font-bold.font-size-14[style="color: #000"]',
        'uni-view[data-v-9f90816a].font-bold.font-size-14',
        '.username-display',
        '.font-bold.font-size-14'
    ];
    
    let usernameUpdated = false;
    for (const selector of usernameSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
            for (const el of elements) {
                // Change only if this looks like a username element (not part of another component)
                if (!el.closest('.sidebar') && !el.parentElement?.classList.contains('referral-section')) {
                    console.log(`Found username element with selector "${selector}"`, el);
                    el.textContent = account.username || 'N/A';
                    usernameUpdated = true;
                }
            }
            if (usernameUpdated) break;
        }
    }
    
    // Direct approach: Find elements containing user data by scanning text content
    if (!usernameUpdated) {
        document.querySelectorAll('uni-view').forEach(el => {
            // Look for parent elements that might contain user data
            const parentText = el.parentElement?.textContent?.toLowerCase() || '';
            if (parentText.includes('username') || parentText.includes('account')) {
                const boldElements = el.querySelectorAll('.font-bold, .font-size-14');
                if (boldElements.length > 0) {
                    console.log('Found username element by content scan:', boldElements[0]);
                    boldElements[0].textContent = account.username || 'N/A';
                    usernameUpdated = true;
                }
            }
        });
    }
    
    // Find and update referral code
    console.log('Looking for referral code elements...');
    let referralUpdated = false;
    
    // Try direct selector first (using data attribute if available)
    const directRefElements = document.querySelectorAll('[data-field="referral-code"], [data-ref="referral-code"]');
    if (directRefElements.length > 0) {
        directRefElements.forEach(el => {
            console.log('Found referral code by direct selector:', el);
            el.textContent = account.referral_code || 'N/A';
            referralUpdated = true;
        });
    }
    
    // If not found, try looking by container text content
    if (!referralUpdated) {
        const allElements = document.querySelectorAll('uni-view, div, span');
        for (const el of allElements) {
            if (el.textContent?.includes('Referral Code') && !el.children.length) {
                // Found label, now look for adjacent element or sibling that would hold the value
                const parent = el.parentElement;
                const siblings = parent?.children;
                if (siblings && siblings.length > 1) {
                    for (let i = 0; i < siblings.length; i++) {
                        if (siblings[i] === el && i + 1 < siblings.length) {
                            console.log('Found referral code element by content scan:', siblings[i+1]);
                            siblings[i+1].textContent = account.referral_code || 'N/A';
                            referralUpdated = true;
                            break;
                        }
                    }
                }
            }
        }
    }
    
    // Update account balance values - more robust approach
    updateAccountBalances(account);
    
    // Update sidebar referral code
    if (account && account.referral_code) {
        updateSidebarReferralCode(account.referral_code);
    }

    console.log('Account page UI updated successfully');
}

// Function to fetch account data from API
async function fetchAccountData() {
    try {
        const response = await fetchWithAuth('/api/user/account');
        console.log('Account data received:', response);
        
        if (response.success) {
            updateUIWithAccountData(response);
        } else {
            console.error('Failed to fetch account data:', response.message);
        }
        return response;
    } catch (error) {
        console.error('Error fetching account data:', error);
    }
}

// Setup WebSocket connection for real-time updates
function setupSocketConnection() {
    if (typeof io === 'undefined') {
        console.error('Socket.io not loaded');
        return;
    }

    try {
        const socket = io();
        
        socket.on('connect', () => {
            console.log('Socket connected for real-time account updates');
            
            // Authenticate socket with user token
            const token = getToken();
            if (token) {
                socket.emit('authenticate', { token });
            }
        });
        
        // Listen for account updates
        socket.on('account-update', (data) => {
            console.log('Real-time account update received:', data);
            updateUIWithAccountData({ success: true, account: data });
        });
        
        socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });
        
    } catch (error) {
        console.error('Error setting up socket connection:', error);
    }
}

// Initialize account page
function initializeAccountPage() {
    console.log('Initializing account page...');
    
    // First fetch data from API
    fetchAccountData().then(() => {
        // Then set up real-time updates
        setupSocketConnection();
    });
    
    // Refresh data every 30 seconds as fallback if socket fails
    setInterval(fetchAccountData, 30000);
}

// Add this function to update the referral code in the sidebar
function updateSidebarReferralCode(referralCode) {
    console.log('Updating sidebar referral code to:', referralCode);
    
    // Store the referral code in localStorage for persistence
    if (referralCode) {
        localStorage.setItem('user_referral_code', referralCode);
    }
    
    // Find and update the referral code in the sidebar
    const sidebarElement = document.querySelector('#sidebar-placeholder') || 
                          document.querySelector('.sidebar');
    
    if (sidebarElement) {
        // Look for the referral code element in the sidebar
        const referralCodeElement = sidebarElement.querySelector('.referral-code') || 
                                  sidebarElement.querySelector('[data-ref="referral-code"]');
        
        if (referralCodeElement) {
            referralCodeElement.textContent = referralCode || 'N/A';
            console.log('Updated sidebar referral code element');
        } else {
            console.log('Sidebar referral code element not found yet, will try again');
            // Try again after a short delay in case the sidebar is still loading
            setTimeout(() => updateSidebarReferralCode(referralCode), 500);
        }
    }
}

// Add this function to handle logout
function handleLogout() {
    // Clear authentication token from localStorage
    localStorage.removeItem('token');
    
    // Clear any other user-related data
    localStorage.removeItem('user_referral_code');
    localStorage.removeItem('user_data');
    
    // Redirect to login page
    window.location.href = './login.html';
}

// When document is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for necessary scripts to load
    setTimeout(() => {
        initializeAccountPage();
    }, 500);

    // Add this to detect when the sidebar is loaded by components.js
    document.addEventListener('componentLoaded', function(event) {
        if (event.detail && event.detail.component === 'sidebar') {
            console.log('Sidebar component loaded, updating referral code');
            const storedCode = localStorage.getItem('user_referral_code');
            if (storedCode) {
                updateSidebarReferralCode(storedCode);
            }
        }
    });

    // Find and attach event listener to logout button on account page
    const logoutBtn = document.querySelector('.logout-btn, .btn-logout, [data-action="logout"]');
    if (logoutBtn) {
        console.log('Found logout button on account page, attaching event listener');
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
    
    // Also check for text content since the button might not have a specific class
    document.querySelectorAll('a, button').forEach(el => {
        if (el.textContent.trim().toLowerCase() === 'logout' || 
            el.textContent.trim().toLowerCase() === 'sign out') {
            console.log('Found logout button by text content');
            el.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogout();
            });
        }
    });
});