// Ensure API_BASE_URL and showNotification are available (assuming from main.js)

// --- Global Variables ---
<<<<<<< HEAD
let currentDriveSessionId = null;
let currentDriveConfigurationId = null;
let totalTasksRequired = 0;
let tasksCompleted = 0;
let totalDriveCommission = 0;
let isStartingDrive = false; // Flag to prevent multiple start drive calls
=======
var oid = null; // Will be set by startDrive response if needed (using session ID?) // This seems unused, consider removing.
let totalTasksRequired = 0; // Variable to store the total number of tasks required (now Task Sets)
let tasksCompleted = 0; // Track the number of completed tasks (now Task Sets)
let totalDriveCommission = 0; // Track total commission earned in this drive
let isStartingDrive = false; // Flag to prevent unintentional start drive calls
>>>>>>> main

// --- UI Element References ---
let autoStartButton;
let productCardContainer;
let walletBalanceElement;
let driveCommissionElement;
let tasksProgressElement;
let driveProgressBar;
let progressTextElement;
let tasksProgressBar; // Small progress bar in tasks card
let orderLoadingOverlay;

// --- Drive State Variables ---
let currentProductData = null; // Store data of the currently displayed product/order

// --- Drive Animation/Start Logic ---
<<<<<<< HEAD
let countDown = 5;
let animationTimeout = null;

// --- Initialization ---
function initializeTaskPage() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        showNotification('Authentication token not found. Redirecting to login.', 'error');
        window.location.href = 'login.html';
        return false;
    }

    autoStartButton = document.getElementById('autoStart');
    productCardContainer = document.getElementById('product-card-container');
    walletBalanceElement = document.querySelector('.datadrive-balance strong');
    driveCommissionElement = document.querySelector('.datadrive-commission strong');
    tasksProgressElement = document.getElementById('tasks-count');
    tasksProgressBar = document.getElementById('tasks-progress-bar');
    driveProgressBar = document.getElementById('drive-progress-bar');
    progressTextElement = document.getElementById('progress-text');
    orderLoadingOverlay = document.getElementById('order-loading-overlay');

    if (autoStartButton) autoStartButton.style.display = 'block';
    if (productCardContainer) productCardContainer.style.display = 'none';
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';

    updateProgressBar(0, 1); // Default state
    refreshWalletBalance();

    if (autoStartButton) {
        autoStartButton.addEventListener('click', () => {
            if (!isStartingDrive) {
                isStartingDrive = true;
                startDriveProcess(token);
            }
        });
    } else {
        console.error('Could not find #autoStart button.');
    }

    if (productCardContainer) {
        productCardContainer.addEventListener('click', function(event) {
            if (event.target && event.target.id === 'purchase-button') {
                if (currentProductData && currentProductData.order_id && currentProductData.product_id) {
                    handlePurchase(token, currentProductData);
                } else {
                    showNotification('Error: Product data is incomplete. Cannot proceed with purchase.', 'error');
                    console.error("Purchase attempt with incomplete currentProductData:", currentProductData);
                }
            }
        });
    }

    checkDriveStatus(token); // Check status on load
    return true;
=======
let countDown = 5; // Reset countdown for each start attempt
let animationTimeout = null; // To store the timeout ID for animation
let globalAuthData = null; // Global auth data

// --- Initialization ---
function initializeTaskPage() {
  // Use centralized authentication check
  const authData = requireAuth();
  if (!authData) {
    return false; // requireAuth will handle redirect
  }
  
  // Store auth data globally for use in other functions
  globalAuthData = authData;
  
  // Get references to key elements
  autoStartButton = document.getElementById('autoStart');
  productCardContainer = document.getElementById('product-card-container'); // Get reference to the new container
  walletBalanceElement = document.querySelector('.datadrive-balance strong');  // Select the strong element directly
  driveCommissionElement = document.querySelector('.datadrive-commission strong'); // Element for drive commission
  tasksProgressElement = document.getElementById('tasks-count'); // Element displaying tasks completed/required
  tasksProgressBar = document.getElementById('tasks-progress-bar'); // Progress bar element for tasks card
  driveProgressBar = document.getElementById('drive-progress-bar'); // Main progress bar at the top
  progressTextElement = document.getElementById('progress-text'); // Text element for progress 
  orderLoadingOverlay = document.getElementById('order-loading-overlay'); // Get reference to the loading overlay
  // Initial UI state: Hide elements by default, will be shown based on drive status
  if (autoStartButton) autoStartButton.style.display = 'none'; // Don't show until we check drive status
  if (productCardContainer) productCardContainer.style.display = 'none';
  if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';

  // Initialize progress bars with default values (will be updated by checkDriveStatus)
  updateProgressBar(0, 45); // Default to 0/45  // Initial balance fetch
  refreshWalletBalance();
    // Check for existing drive session on page load - this will show the appropriate UI
  checkForExistingDrive(authData.token);
  
  // Set up periodic auto-refresh (every 30 seconds)
  setInterval(() => {
      if (globalAuthData && globalAuthData.token) {
          // Only auto-refresh if we're not currently processing a purchase
          const purchaseButton = document.getElementById('purchase-button');
          if (!purchaseButton || !purchaseButton.disabled) {
              console.log('Performing background refresh...');
              performBackgroundRefresh();
          }
      }
  }, 30000); // 30 seconds
  
  // --- Event Listeners ---
  // Attach listener for the refresh button
  const refreshButton = document.getElementById('refresh-drive-button');
  if (refreshButton) {
      console.log("Found refresh button, attaching listener.");
      refreshButton.addEventListener('click', () => {
          console.log("Refresh button clicked.");
          performManualRefresh();
      });
  }
  
  // Attach listener for the Start button
  if (autoStartButton) {
      console.log("Found #autoStart button, attaching listener.");
      autoStartButton.addEventListener('click', () => {
          console.log("#autoStart button clicked.");
          if (!isStartingDrive) { // Only start if not already in the process
              isStartingDrive = true; // Set flag
              startDriveProcess(authData.token);
          } else {
              console.log("Start Drive button clicked, but process is already starting.");
          }
      });  } else {
      console.error('Could not find #autoStart button to attach listener.');
  }

  // Attach listener for the Refresh Drive button
  const refreshDriveButton = document.getElementById('refresh-drive-button');
  if (refreshDriveButton) {
      console.log("Found refresh drive button, attaching listener.");
      refreshDriveButton.addEventListener('click', async () => {
          console.log("Refresh drive button clicked.");
          await performManualRefresh();
      });
  } else {
      console.log('Refresh drive button not found - this is optional.');
  }// Check drive status on page load for persistence - Moved below event listeners
  // First check if user is resuming a specific order from orders page
  const resumeOrderId = sessionStorage.getItem('resumeOrderId');
  const resumeProductId = sessionStorage.getItem('resumeProductId');
  
  if (resumeOrderId && resumeProductId) {
    console.log('Resuming order:', resumeOrderId, 'Product:', resumeProductId);
    // Clear the session data so it doesn't interfere with future visits
    sessionStorage.removeItem('resumeOrderId');
    sessionStorage.removeItem('resumeProductId');
    
    // Load the specific order and start the drive
    resumeSpecificOrder(authData.token, resumeOrderId, resumeProductId);
  } else {
    // Normal flow - check current drive status
    checkDriveStatus(authData.token);
  }

  // Event delegation for dynamically added Purchase button
  // Using productCardContainer ensures listener is within the relevant area
  if (productCardContainer) {
      productCardContainer.addEventListener('click', function(event) {
          if (event.target && event.target.id === 'purchase-button') {
              console.log("#purchase-button clicked.");
              if (currentProductData) {
                  handlePurchase(authData.token, currentProductData); // Pass token and current product data
              } else {
                  console.error("Purchase button clicked but no current product data available.");
                  if (typeof showNotification === 'function') {
                      showNotification('Error: No product data to purchase.', 'error');
                  } else { alert('Error: No product data to purchase.'); }
              }
          }
      });
  }

   return true; // Indicate successful initialization
>>>>>>> post
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTaskPage);
} else {
    initializeTaskPage();
}

// --- Balance Fetch Function ---
function fetchBalance(token) {
    if (!token) return;

    const balanceElement = document.querySelector('.datadrive-balance');
    const balanceLabel = document.querySelector('.datadrive-balance').closest('.item-card').querySelector('span');
    if (!balanceElement) return;

    // First check drive status to see if account is frozen
    fetch(`${API_BASE_URL}/api/drive/status`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    })
    .then(response => response.json())
    .then(statusData => {
        const isFrozen = statusData.success && statusData.status === 'frozen';
        
        // Then fetch balances
        return fetch(`${API_BASE_URL}/api/user/balances`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.balances) {
                const mainBalance = parseFloat(data.balances.main_balance || 0);
                const frozenBalance = parseFloat(data.balances.frozen_balance || 0);
                
                if (isFrozen && frozenBalance > 0) {
                    // Show frozen balance when account is frozen
                    if (balanceLabel) {
                        balanceLabel.textContent = 'Frozen Balance';
                        balanceLabel.style.color = '#dc3545'; // Red color to indicate frozen
                    }
                    balanceElement.innerHTML = `<strong style="color: #dc3545">${frozenBalance.toFixed(2)}<small style="font-size:14px"> USDT</small></strong>`;
                    balanceElement.title = `Your balance of ${frozenBalance.toFixed(2)} USDT is currently frozen. Please deposit funds to continue.`;
                } else {
                    // Show normal wallet balance
                    if (balanceLabel) {
                        balanceLabel.textContent = 'Wallet balance';
                        balanceLabel.style.color = ''; // Reset color
                    }
                    balanceElement.innerHTML = `<strong>${mainBalance.toFixed(2)}<small style="font-size:14px"> USDT</small></strong>`;
                    balanceElement.title = ''; // Clear title
                }            } else {
                console.error('Failed to fetch balance:', data.message);
                if (typeof showNotification === 'function') {
                    showNotification(`Failed to fetch balance: ${data.message}`, 'error');
                }
                balanceElement.innerHTML = '<strong>Error</strong>';
            }
        })
        .catch(error => {
            console.error('Error fetching balance:', error);
            if (typeof showNotification === 'function') {
                showNotification(`Error fetching balance: ${error.message}`, 'error');
            }
            balanceElement.innerHTML = '<strong>Error</strong>';
        });
    })
    .catch(error => {
        console.error('Error checking drive status:', error);
        if (typeof showNotification === 'function') {
            showNotification(`Error checking drive status: ${error.message}`, 'error');
        }
        balanceElement.innerHTML = '<strong>Error</strong>';
    });
}

function refreshWalletBalance() {
    if (globalAuthData && globalAuthData.token) {
        fetchBalance(globalAuthData.token);
    }
}

// --- Update Progress Bar Function ---
function updateProgressBar(tasksCompleted, totalTasks) {
    // Get DOM elements
    const progressBar = document.getElementById('drive-progress-bar');
    const progressText = document.getElementById('progress-text');
    const tasksProgressElement = document.getElementById('tasks-count');
    
    // Ensure we have valid numbers and convert to 1-based counting for display
    const completed = Math.max(0, parseInt(tasksCompleted) || 0);
    const total = Math.max(0, parseInt(totalTasks) || 0);
    const displayCompleted = completed > 0 ? completed : 0; // Keep 0 as 0 for display
    const displayTotal = total || 45; // Default to 45 if no total provided
    
    // Calculate percentage for progress bar
    const percentage = total > 0 ? Math.min(100, Math.max(0, (completed / total) * 100)) : 0;
    
    // Update progress bar
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', percentage);
        
        // Add flash animation when progress updates
        progressBar.classList.remove('progress-flash');
        setTimeout(() => {
            progressBar.classList.add('progress-flash');
        }, 10);
    }
    
    // Update progress text (use 1-based counting for display)
    if (progressText) {
        const displayCompletedText = displayCompleted === 0 ? 0 : displayCompleted;
        progressText.textContent = `${displayCompletedText} / ${displayTotal} tasks completed`;
    }
    
    // Update tasks count (use 1-based counting for display)
    if (tasksProgressElement) {
        const displayCompletedCount = displayCompleted === 0 ? 0 : displayCompleted;
        tasksProgressElement.textContent = `(${displayCompletedCount} / ${displayTotal})`;
    }
    
    console.log(`Progress updated: ${displayCompleted}/${displayTotal} (${percentage.toFixed(1)}%)`);
}

// --- Update Drive Commission Function ---
function updateDriveCommission() {
    // Update the commission display element
    if (driveCommissionElement) {
        const commissionValue = (totalDriveCommission || 0).toFixed(2);
        driveCommissionElement.innerHTML = `${commissionValue}<small style="font-size:14px"> USDT</small>`;
        
        // Add highlight animation when commission updates
        driveCommissionElement.classList.remove('highlight-green');
        setTimeout(() => {
            driveCommissionElement.classList.add('highlight-green');
        }, 10);
    }
    
    // Save current session data to localStorage for persistence
    saveCurrentSessionData();
    
    console.log(`Commission updated: ${(totalDriveCommission || 0).toFixed(2)} USDT`);
}

// --- Save Current Session Data Function ---
function saveCurrentSessionData() {
    const sessionData = {
        totalCommission: totalDriveCommission || 0,
        tasksCompleted: tasksCompleted || 0,
        totalTasksRequired: totalTasksRequired || 0,
        timestamp: Date.now()
    };
    
    try {
        localStorage.setItem('currentDriveSession', JSON.stringify(sessionData));
        console.log('Session data saved:', sessionData);
    } catch (error) {
        console.error('Error saving session data:', error);
    }
}

// --- Get Current Session Data Function ---
function getCurrentSessionData() {
    try {
        const sessionData = localStorage.getItem('currentDriveSession');
        return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
        console.error('Error getting session data:', error);
        return null;
    }
}

// --- Clear Session Data Function ---
function clearSessionData() {
    try {
        localStorage.removeItem('currentDriveSession');
        console.log('Session data cleared');
    } catch (error) {
        console.error('Error clearing session data:', error);
    }
}

// --- Progress and Commission Display Update Functions ---
function updateProgressBar(completed, total) {
    // Update main progress bar
    if (driveProgressBar) {
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        driveProgressBar.style.width = `${percentage}%`;
        driveProgressBar.textContent = `${percentage}%`;
    }
    
    // Update tasks progress bar if it exists
    if (tasksProgressBar) {
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        tasksProgressBar.style.width = `${percentage}%`;
    }
    
    // Update tasks counter
    if (tasksProgressElement) {
        tasksProgressElement.textContent = `${completed}/${total}`;
    }
    
    // Update progress text (maybe in a header or elsewhere)
    if (progressTextElement) {
        progressTextElement.textContent = `Progress: ${completed}/${total}`;
    }
}

function updateDriveCommissionDisplay(commission) {
    if (driveCommissionElement) {
        driveCommissionElement.textContent = parseFloat(commission).toFixed(2);
        driveCommissionElement.classList.add('highlight-green');
        setTimeout(() => {
            driveCommissionElement.classList.remove('highlight-green');
        }, 1500);
    }
}

// --- Drive Start Animation Logic ---
function startDriveProcess(token) {
    if (!isStartingDrive) {
        return;
    }

    countDown = 5; // Reset countdown
    
    // Assuming jQuery and Owl Carousel are used as per original snippet
    if (typeof $ === 'function' && $('.product-carousel').data('owl.carousel')) {
        $('.product-carousel').trigger('stop.owl.autoplay');
        $('.product-carousel').trigger('play.owl.autoplay', [500]);
    }
    
    if (autoStartButton) autoStartButton.querySelector('span').textContent = 'Starting...';
    
    animationTimeout = setTimeout(() => animateAndStart(token), 1000);
}

function animateAndStart(token) {
<<<<<<< HEAD
    if (autoStartButton) autoStartButton.querySelector('span').textContent = 'Starting in ' + countDown + '...';
    
    if (typeof $ === 'function' && $('.product-carousel').data('owl.carousel')) {
        $('.product-carousel .item img').css({
            'transform': 'scale(' + (1 + Math.random() * 0.2) + ')',
            'transition': 'transform 0.5s ease'
        });
        $('.product-carousel').trigger('next.owl.carousel', [300]);
    }

    if (countDown <= 1) {
        if (typeof $ === 'function' && $('.product-carousel').data('owl.carousel')) {
            $('.product-carousel').trigger('stop.owl.autoplay');
            $('.product-carousel').trigger('play.owl.autoplay', [3000]);
        }
=======
    console.log("animateAndStart called with countdown: " + countDown);
    
    // Check if countdown has reached 0 before displaying
    if (countDown <= 0) {
        console.log("Countdown complete, calling API");
        $('.product-carousel').trigger('stop.owl.autoplay');
        $('.product-carousel').trigger('play.owl.autoplay', [3000]);
>>>>>>> post
        callStartDriveAPI(token);
        return;
    }
    
    // Display the current countdown value
    if (autoStartButton) autoStartButton.querySelector('span').textContent = 'Starting in ' + countDown + '...';
    
    $('.product-carousel .item img').css({
        'transform': 'scale(' + (1 + Math.random() * 0.2) + ')',
        'transition': 'transform 0.5s ease'
    });
    $('.product-carousel').trigger('next.owl.carousel', [300]);
    
    // Decrement and continue countdown
    countDown--;
    animationTimeout = setTimeout(() => animateAndStart(token), 1000);
}

// --- API Call: Start Drive ---
function callStartDriveAPI(token) {
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';

<<<<<<< HEAD
    fetch(`${API_BASE_URL}/api/drive/start`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    })
    .then(response => response.json())
    .then(data => {
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        isStartingDrive = false; // Reset flag

        if (data.drive_session_id) { // Success or existing session resumed
            currentDriveSessionId = data.drive_session_id;
            currentDriveConfigurationId = data.drive_configuration_id;
            totalTasksRequired = parseInt(data.tasks_in_configuration || data.tasks_required || 0, 10);
            tasksCompleted = parseInt(data.tasks_completed || 0, 10);
            totalDriveCommission = parseFloat(data.total_session_commission || data.commission_earned || 0);
            
            localStorage.setItem('current_drive_session_id', currentDriveSessionId);

            showNotification(data.message || 'Drive started!', 'success');
            updateDriveCommissionDisplay(totalDriveCommission);
            updateProgressBar(tasksCompleted, totalTasksRequired);

            if (autoStartButton) autoStartButton.style.display = 'none';
            if (productCardContainer) productCardContainer.style.display = 'block';

            if (data.first_order && data.first_order.product_id) {
                currentProductData = {
                    order_id: data.first_order.id, // Assuming 'id' is the drive_order_id
                    product_id: data.first_order.product_id,
                    product_name: data.first_order.product_name,
                    product_price: parseFloat(data.first_order.product_price),
                    product_image: data.first_order.product_image_url || data.first_order.product_image,
                    product_description: data.first_order.product_description,
                    // Calculate commission on frontend if not provided directly with order, or rely on total_session_commission
                };
                renderProductCard(currentProductData);
=======
    setTimeout(() => {
        fetch(`${API_BASE_URL}/api/drive/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
        })
        .then(response => response.json())
        .then(data => {
            console.log("API response received from /api/drive/start:", data);
            try {
                if (loadingMethod === 'layer' && loadingIndicator !== null) {
                    console.log("Closing layer indicator with index:", loadingIndicator);
                    layer.close(loadingIndicator);
                } else if (loadingMethod === 'dialog' && loadingIndicator && typeof loadingIndicator.close === 'function') {
                    console.log("Closing jQuery dialog indicator.");
                    loadingIndicator.close();
                } else {
                     console.log("No specific loading indicator to close or method unknown.");
                }
            } catch (e) {
                console.error("Error closing loading indicator:", e);
            }
            if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
            if (autoStartButton) autoStartButton.querySelector('span').textContent = 'Start';
            $('.product-carousel').removeClass('starting-drive');
            $('.product-carousel').css({
                'animation': '',
                'box-shadow': ''
            });

            if (data.code === 0) {
                try {
                    if (typeof showNotification === 'function') {
                        showNotification(data.info || 'Drive started!', 'success');
                    } else if (typeof $(document).dialog === 'function') {
                        $(document).dialog({infoText: data.info || 'Drive started!', autoClose: 2000});
                    } else {
                        alert(data.info || 'Drive started!');
                    }
                } catch (e) {
                    console.error("Error showing success dialog:", e);
                    alert(data.info || 'Drive started!');
                }
                $('.product-carousel').css('border', '2px solid green');
                setTimeout(() => {
                    $('.product-carousel').css('border', '');
                }, 3000);

                // Backend now returns tasks_in_configuration (total task sets) and current_order
                if (data.tasks_in_configuration !== undefined && data.current_order) {
                    totalTasksRequired = data.tasks_in_configuration; // Total Task Sets
                    tasksCompleted = 0; // Drive just started

                    totalDriveCommission = 0; // Reset commission for new drive
                    clearSessionData(); // Clear any old session data
                    // saveCurrentSessionData will be called by updateDriveCommission
                    updateDriveCommission(); // Update UI and persist initial commission (0)

                    updateProgressBar(tasksCompleted, totalTasksRequired);

                    currentProductData = data.current_order;
                    renderProductCard(data.current_order);
                    
                    if (autoStartButton) autoStartButton.style.display = 'none';
                    if (productCardContainer) productCardContainer.style.display = 'block';
                } else {
                    console.error("callStartDriveAPI: Missing tasks_in_configuration or current_order in successful response", data);
                    // Fallback or error display
                    displayDriveError("Error initializing drive: Incomplete data from server.");
                }
>>>>>>> main
            } else {
                // If first_order is not in start response, fetch it
                fetchNextOrder(token);
            }
        } else {
            showNotification(data.message || 'Failed to start drive.', 'error');
        }
    })
    .catch(error => {
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        isStartingDrive = false;
        showNotification(`Error starting drive: ${error.message}`, 'error');
        console.error("callStartDriveAPI error:", error);
    });
}

// --- API Call: Get Next Order ---
function fetchNextOrder(token) {
<<<<<<< HEAD
    if (!currentDriveSessionId) {
        showNotification("Error: No active drive session. Please start a drive.", "error");
        // Attempt to recover or reset
        checkDriveStatus(token);
        return;
    }
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';

    fetch(`${API_BASE_URL}/api/drive/getorder`, {
        method: 'POST',
=======
    console.log("Fetching next order (/api/drive/getorder)...");
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';
    $('.product-carousel').trigger('stop.owl.autoplay');
    fetch(`${API_BASE_URL}/api/drive/getorder`, { // This is a POST request as per existing code
        method: 'POST', // Assuming it's POST, though GET might be more appropriate for "get"
>>>>>>> main
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ drive_session_id: currentDriveSessionId })
    })
    .then(response => response.json())
    .then(data => {
<<<<<<< HEAD
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';

        if (data.next_order && data.next_order.product_id) {
            currentProductData = {
                order_id: data.next_order.id, // Assuming 'id' is the drive_order_id from backend
                product_id: data.next_order.product_id,
                product_name: data.next_order.product_name,
                product_price: parseFloat(data.next_order.product_price),
                product_image: data.next_order.product_image_url || data.next_order.product_image,
                product_description: data.next_order.product_description,
                // Commission can be calculated or taken from session total updates
            };
            renderProductCard(currentProductData);
            refreshWalletBalance(); // Good to refresh balance if it could change
        } else if (data.message && data.message.includes("No more pending orders")) {
            // This likely means the drive is complete. Verify with checkDriveStatus.
            checkDriveStatus(token); 
        } else if (data.code === 2) { // Explicit drive complete signal from backend
             displayDriveComplete(data.info || 'Congratulations! Your data drive is complete.', totalDriveCommission);
        } else if (data.code === 3) { // Frozen state
             displayFrozenState(data.info || "Session frozen.", data.frozen_amount_needed);
        }
        else {
            // Handle other errors or unexpected responses
            showNotification(data.message || 'Could not fetch next order.', 'error');
            // Consider calling checkDriveStatus to re-evaluate state
            checkDriveStatus(token);
=======
        console.log("Response from /api/drive/getorder:", data);
        $('.product-carousel').trigger('play.owl.autoplay', [3000]);
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        
        if (data.code === 2) { // Drive complete
            console.log("Drive complete message received from backend (getorder).");
            displayDriveComplete(data.info || 'Congratulations! Your data drive is complete.');
            if (data.total_session_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_session_commission);
                updateDriveCommission();
            }
            refreshWalletBalance();
        } else if (data.code === 3) { // Drive Frozen
            console.warn("Drive Frozen message received from backend (getorder).");
            displayFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed);
            if (data.total_session_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_session_commission);
                updateDriveCommission();
            }
            refreshWalletBalance();
        }
        else if (data.success && data.current_order) {
            currentProductData = data.current_order;
            // product_image highlighting logic (can be kept if current_order has product_image)
            if (data.current_order.product_image) {
                 $('.product-carousel .item img').each(function() {
                    if ($(this).attr('src') === data.current_order.product_image) {
                        $(this).parent().addClass('highlighted-product');
                        let itemIndex = $(this).parent().index();
                        $('.product-carousel').trigger('to.owl.carousel', [itemIndex, 300]);
                    }
                });
                setTimeout(() => {
                    $('.product-carousel .item').removeClass('highlighted-product');
                }, 3000);
            }

            renderProductCard(data.current_order);
            console.log("Current order received (getorder):", data.current_order);

            if (data.tasks_completed !== undefined && data.tasks_required !== undefined) {
                tasksCompleted = data.tasks_completed; // Task Sets completed
                totalTasksRequired = data.tasks_required; // Total Task Sets
                updateProgressBar(tasksCompleted, totalTasksRequired);
            }
            if (data.total_session_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_session_commission);
                updateDriveCommission();
            }
            refreshWalletBalance();
        } else {
            console.error('Error fetching next order (getorder):', data.info || data.message);
            if (data.code === 1) { // No active session / Drive not started
                displayDriveError(data.info || 'Your drive session has not started or is complete. Please start a new drive.');
                if (autoStartButton) autoStartButton.style.display = 'block';
                if (productCardContainer) productCardContainer.style.display = 'none';
                 totalDriveCommission = 0;
                 updateDriveCommission();
                 updateProgressBar(0, totalTasksRequired || 0); // Reset progress bar
            } else {
                displayDriveError(`Error fetching order: ${data.info || data.message || 'Unknown error'}`);
            }
>>>>>>> main
        }
    })
    .catch(error => {
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        showNotification(`Network error fetching order: ${error.message}`, 'error');
        console.error("fetchNextOrder error:", error);
    });
}

// --- Render Product Card ---
function renderProductCard(productData) {
    if (!productCardContainer) return;
<<<<<<< HEAD
<<<<<<< HEAD
    if (!productData || !productData.product_id) {
        productCardContainer.innerHTML = '<p>Error: Product data missing or invalid.</p>';
        return;
    }

    const imageUrl = productData.product_image || './assets/uploads/images/ph.png'; // Fallback image
    // Commission per product might not be available directly, rely on total session commission updates
    // Or calculate if rate is known: const commission = productData.product_price * (known_rate / 100);

    productCardContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <h4>${productData.product_name || 'Product'}</h4>
                <img src="${imageUrl}" alt="${productData.product_name || 'Product Image'}" style="max-width: 150px; margin: 10px auto; display: block;">
                <p>Price: <strong>${parseFloat(productData.product_price).toFixed(2)}</strong> USDT</p>
                <!-- <p>Est. Commission: <strong>${parseFloat(productData.order_commission || 0).toFixed(2)}</strong> USDT</p> -->
=======
    // productData now includes is_combo, product_name, product_image, product_price, order_commission, drive_order_id
=======
    // productData now includes is_combo, product_name, product_image, product_price, order_commission, user_active_drive_item_id
>>>>>>> main
    // No specific UI change for is_combo for now, but it's available in productData.is_combo
<<<<<<< HEAD
    productCardContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <h4>${productData.product_name || 'Product'} ${productData.is_combo ? '<span class="badge bg-info text-dark">Combo Item</span>' : ''}</h4>
                <img src="${productData.product_image || './assets/uploads/images/ph.png'}" alt="${productData.product_name || 'Product Image'}" style="max-width: 150px; margin: 10px auto; display: block;">
                <p>Price: <strong>${parseFloat(productData.product_price).toFixed(2)}</strong> USDT</p>
                <p>Commission for this item: <strong>${parseFloat(productData.order_commission).toFixed(2)}</strong> USDT</p>
>>>>>>> main
                <button id="purchase-button" class="btn btn-primary mt-3">Purchase</button>
=======
    
    // Enhanced fade effect for better UX and refresh indication
    productCardContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    productCardContainer.style.opacity = '0.3';
    productCardContainer.style.transform = 'scale(0.98)';
    
    setTimeout(() => {
        productCardContainer.innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <h4>${productData.product_name || 'Product'} ${productData.is_combo ? '<span class="badge bg-info text-dark">Combo Item</span>' : ''}</h4>
                    <img src="${productData.product_image || './assets/uploads/images/ph.png'}" alt="${productData.product_name || 'Product Image'}" style="max-width: 150px; margin: 10px auto; display: block;">
                    <p>Price: <strong>${parseFloat(productData.product_price).toFixed(2)}</strong> USDT</p>
                    <p>Commission for this item: <strong>${parseFloat(productData.order_commission).toFixed(2)}</strong> USDT</p>
                    <p class="text-muted small">Total drive commission so far: <strong>${totalDriveCommission.toFixed(2)}</strong> USDT</p>
                    <button id="purchase-button" class="btn btn-primary mt-3">Purchase</button>
                </div>
>>>>>>> post
            </div>
        `;
        
        // Restore appearance with enhanced animation
        productCardContainer.style.opacity = '1';
        productCardContainer.style.transform = 'scale(1)';
        
        // Add a subtle highlight effect to indicate new content
        const card = productCardContainer.querySelector('.card');
        if (card) {
            card.style.boxShadow = '0 0 20px rgba(0, 123, 255, 0.3)';
            setTimeout(() => {
                card.style.transition = 'box-shadow 0.5s ease';
                card.style.boxShadow = '';
            }, 500);
        }
        
        // Remove transition after animation completes
        setTimeout(() => {
            productCardContainer.style.transition = '';
        }, 300);
    }, 150); // Slightly longer delay for better effect
}

// --- API Call: Save Order (Purchase) ---
async function handlePurchase(token, productData) {
<<<<<<< HEAD
<<<<<<< HEAD
=======
    console.log('Purchase button clicked for product (now using drive_order_id):', productData.drive_order_id);
>>>>>>> main
=======
    console.log('Purchase button clicked for product (now using user_active_drive_item_id):', productData.user_active_drive_item_id);
>>>>>>> main
    const purchaseButton = document.getElementById('purchase-button');
    if (purchaseButton) {
        purchaseButton.disabled = true;
        purchaseButton.textContent = 'Processing...';
    }
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';
<<<<<<< HEAD

    if (!currentDriveSessionId || !productData.order_id || !productData.product_id) {
        showNotification('Critical error: Missing IDs for purchase. Please restart drive.', 'error');
        console.error("handlePurchase missing IDs:", { currentDriveSessionId, productData });
        if (purchaseButton) {
            purchaseButton.disabled = false;
            purchaseButton.textContent = 'Purchase';
        }
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        // Consider a more robust recovery or reset here
        checkDriveStatus(token); // Re-check state
        return;
    }

    const payload = {
        drive_session_id: String(currentDriveSessionId),
        drive_order_id: String(productData.order_id),
        product_id: String(productData.product_id),
        // Backend calculates price/commission based on product_id and user tier
=======
    
    // Create the request payload - simplified to only user_active_drive_item_id
    const payload = {
<<<<<<< HEAD
        drive_order_id: productData.drive_order_id 
>>>>>>> main
=======
        user_active_drive_item_id: productData.user_active_drive_item_id 
>>>>>>> main
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/drive/saveorder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
<<<<<<< HEAD
<<<<<<< HEAD

        if (response.ok && (data.order_status === 'completed' || data.message.includes("Order saved successfully"))) {
            showNotification(data.message || "Order Sent successfully!", 'success');

            tasksCompleted = parseInt(data.tasks_completed, 10);
            totalTasksRequired = parseInt(data.tasks_in_configuration, 10); // tasks_required from backend
            totalDriveCommission = parseFloat(data.total_session_commission);

            updateDriveCommissionDisplay(totalDriveCommission);
            updateProgressBar(tasksCompleted, totalTasksRequired);
            refreshWalletBalance();

            if (data.drive_session_status === 'completed' || tasksCompleted >= totalTasksRequired) {
                displayDriveComplete('Congratulations! Your data drive is complete.', totalDriveCommission);
            } else if (data.next_order && data.next_order.product_id) { // If backend sends next order directly
                 currentProductData = {
                    order_id: data.next_order.id,
                    product_id: data.next_order.product_id,
                    product_name: data.next_order.product_name,
                    product_price: parseFloat(data.next_order.product_price),
                    product_image: data.next_order.product_image_url || data.next_order.product_image,
                    product_description: data.next_order.product_description,
                };
                renderProductCard(currentProductData);
            }
            else {
                fetchNextOrder(token); // Standard flow: fetch next order after save
            }
        } else {
            showNotification(data.message || "Error sending order.", 'error');
=======
        
        if (response.ok && data.code === 0) { // Order processed successfully
=======
          if (response.ok && data.code === 0) { // Order processed successfully
>>>>>>> post
            console.log('Order saved successfully (saveorder):', data);            
            if (typeof showNotification === 'function') {
                showNotification(data.info || "Order Sent successfully!", 'success');
            } else { alert(data.info || "Order Sent successfully!"); }
            
            // Update total commission from backend's total_session_commission
            if (data.total_session_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_session_commission);
                updateDriveCommission(); // This will update UI and save to localStorage
            }
              // Update progress bar with tasks_completed (task sets)
            if (data.tasks_completed !== undefined && data.tasks_required !== undefined) {
                tasksCompleted = data.tasks_completed;
                totalTasksRequired = data.tasks_required; // Should remain constant, but good to sync
                updateProgressBar(tasksCompleted, totalTasksRequired);
            }
            
            // Comprehensive refresh after successful submission
            await performPostSubmissionRefresh(data);

            // Backend now sends next_order or completion status
            if (data.next_order) {
                currentProductData = data.next_order;
                  // Add a small delay to ensure commission display updates properly
                setTimeout(async () => {
                    // Perform additional refresh to ensure data consistency
                    try {
                        await checkDriveStatus(token);
                    } catch (error) {
                        console.warn('Failed to refresh drive status after purchase:', error);
                    }
                    
                    renderProductCard(data.next_order);
                    if (purchaseButton) {
                        purchaseButton.disabled = false;
                        purchaseButton.textContent = 'Purchase';
                    }
                }, 100); // Small delay to ensure DOM updates
                
            } else if (data.drive_complete) {
                console.log("Drive complete after saveorder.");
                displayDriveComplete(data.info || "Congratulations! Your data drive is complete.");
            } else {
                // Should not happen if backend logic is correct (either next_order, complete, or frozen)
                console.warn("saveOrder successful, but no next_order and not drive_complete. State:", data);
                // Potentially re-enable button or fetch status if unsure
                 if (purchaseButton) {
                     purchaseButton.disabled = false;
                     purchaseButton.textContent = 'Purchase';
                 }
                 // fetchNextOrder(token); // Consider if this is a safe fallback
            }
        } else if (data.code === 3) { // Frozen state
             if (typeof showNotification === 'function') {
                showNotification(data.info || "Session frozen due to insufficient balance.", 'warning');
             } else { alert(data.info || "Session frozen due to insufficient balance."); }
             displayFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed);
             refreshWalletBalance();
        }
        else {            if (typeof showNotification === 'function') {
                showNotification(`Failed to save order: ${data.info || data.message || 'Unknown error'}`, 'error');
            } else { alert(`Failed to save order: ${data.info || data.message || 'Unknown error'}`); }
>>>>>>> main
            if (purchaseButton) {
                purchaseButton.disabled = false;
                purchaseButton.textContent = 'Purchase';
            }
            // If saveorder indicates frozen or other specific states, handle them
            if (data.message && data.message.toLowerCase().includes('insufficient balance')) {
                 checkDriveStatus(token); // Re-check status, might be frozen
            }
        }
    } catch (error) {
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        showNotification(`Error saving order: ${error.message}. Try again or restart the drive.`, 'error');
        console.error("handlePurchase error:", error);
        if (purchaseButton) {
            purchaseButton.disabled = false;
            purchaseButton.textContent = 'Purchase';
        }
    }
}

<<<<<<< HEAD
// --- UI Display Functions for Drive States ---
function displayDriveComplete(message, finalCommission) {
    if (productCardContainer) {
        productCardContainer.innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <h4>Drive Complete!</h4>
                    <p>${message || 'All tasks finished.'}</p>
                    <p>Total Commission Earned: <strong>${parseFloat(finalCommission || totalDriveCommission).toFixed(2)} USDT</strong></p>
                    <button id="restart-drive-button" class="btn btn-primary mt-2">Start New Drive</button>
                </div>
            </div>
        `;
        const restartButton = document.getElementById('restart-drive-button');
        if (restartButton) {
            restartButton.addEventListener('click', () => {
                localStorage.removeItem('current_drive_session_id');
                currentDriveSessionId = null;
                // Reset UI to initial state
                if (autoStartButton) {
                     autoStartButton.style.display = 'block';
                     autoStartButton.disabled = false;
                     autoStartButton.querySelector('span').textContent = 'Start';
                }
                if (productCardContainer) productCardContainer.style.display = 'none';
                updateProgressBar(0,1);
                updateDriveCommissionDisplay(0);
                // Optionally, re-initialize or reload for a full reset
                // initializeTaskPage(); 
                location.reload(); // Simplest way to reset state fully
            });
        }
    }
    if (autoStartButton) autoStartButton.style.display = 'none'; // Ensure start button is hidden
    refreshWalletBalance(); // Final balance update
}

function displayDriveError(message) {
    if (!productCardContainer) return;
    productCardContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <h4>Drive Error</h4>
                <p>${message || 'An unexpected error occurred.'}</p>
                <button id="retry-start-drive-button" class="btn btn-warning mt-2">Try Again</button>
            </div>
        </div>
    `;
    const retryButton = document.getElementById('retry-start-drive-button');
    if (retryButton) {
        retryButton.addEventListener('click', () => {
            if (productCardContainer) productCardContainer.style.display = 'none';
            if (autoStartButton) {
                 autoStartButton.style.display = 'block';
                 autoStartButton.disabled = false;
                 autoStartButton.querySelector('span').textContent = 'Start';
            }
            const token = localStorage.getItem('auth_token');
            if(token) checkDriveStatus(token); // Re-check status
        });
    }
}

function displayFrozenState(message, amountNeeded) {
    if (!productCardContainer) return;
    let amountText = '';
    if (amountNeeded) {
        amountText = `<p>Amount needed to unfreeze: <strong>${parseFloat(amountNeeded).toFixed(2)} USDT</strong></p>`;
    }
    productCardContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <h4>Drive Frozen</h4>
                <p>${message || 'Your drive session is currently frozen.'}</p>
                ${amountText}
                <p>Please deposit funds to continue or contact support.</p>
                <button onclick="window.location.href='deposits.html'" class="btn btn-primary mt-2">Deposit Funds</button>
            </div>
        </div>
    `;
    if (autoStartButton) autoStartButton.style.display = 'none';
    refreshWalletBalance();
}

// --- API Call: Check Drive Status ---
async function checkDriveStatus(token) {
=======
// --- Post-Submission Refresh Functionality ---
async function performPostSubmissionRefresh(responseData) {
    try {
        console.log('Performing comprehensive post-submission refresh...');
        
        // 1. Refresh wallet balance immediately
        refreshWalletBalance();
        
        // 2. Update session data in localStorage
        updateSessionData(responseData);
        
        // 3. Refresh drive status and statistics
        await refreshDriveStatistics();
        
        // 4. Update UI elements with fresh data
        updateAllUIElements(responseData);
        
        // 5. Add visual feedback for successful refresh
        showRefreshFeedback();
        
        console.log('Post-submission refresh completed successfully');
    } catch (error) {
        console.error('Error during post-submission refresh:', error);
        // Continue with normal flow even if refresh fails
    }
}

// Update session data with latest information
function updateSessionData(data) {
    const sessionData = {
        totalCommission: totalDriveCommission,
        tasksCompleted: tasksCompleted,
        totalTasksRequired: totalTasksRequired,
        lastUpdated: new Date().toISOString(),
        sessionTimestamp: Date.now()
    };
    
    localStorage.setItem('current_drive_session', JSON.stringify(sessionData));
    console.log('Session data updated:', sessionData);
}

// Refresh drive statistics from server
async function refreshDriveStatistics() {
    if (!globalAuthData || !globalAuthData.token) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/drive/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${globalAuthData.token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.code === 0 && data.session) {
                // Update global variables with fresh server data
                if (data.session.tasks_completed !== undefined) {
                    tasksCompleted = data.session.tasks_completed;
                }
                if (data.session.tasks_required !== undefined) {
                    totalTasksRequired = data.session.tasks_required;
                }
                if (data.session.total_commission !== undefined) {
                    totalDriveCommission = parseFloat(data.session.total_commission);
                }
                console.log('Drive statistics refreshed from server');
            }
        }
    } catch (error) {
        console.error('Error refreshing drive statistics:', error);
    }
}

// Update all UI elements with fresh data
function updateAllUIElements(data) {
    // Update commission display
    updateDriveCommission();
    
    // Update progress indicators
    updateProgressBar(tasksCompleted, totalTasksRequired);
    
    // Update any other relevant UI elements
    updateTasksDisplay();
    
    // Trigger a subtle UI refresh animation
    animateUIRefresh();
}

// Update tasks display elements
function updateTasksDisplay() {
    if (tasksProgressElement) {
        if (tasksCompleted >= totalTasksRequired) {
            tasksProgressElement.textContent = `(${totalTasksRequired} / ${totalTasksRequired})`;
        } else {
            const currentTask = tasksCompleted + 1;
            tasksProgressElement.textContent = `(${currentTask} / ${totalTasksRequired})`;
        }
    }
}

// Add visual feedback for successful refresh
function showRefreshFeedback() {
    // Create a subtle flash effect to indicate refresh
    const refreshIndicator = document.createElement('div');
    refreshIndicator.className = 'refresh-indicator';
    refreshIndicator.innerHTML = '<i class="fas fa-sync-alt"></i> Updated';
    refreshIndicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 8px 15px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(refreshIndicator);
    
    // Animate in
    setTimeout(() => {
        refreshIndicator.style.opacity = '1';
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
        refreshIndicator.style.opacity = '0';
        setTimeout(() => {
            if (refreshIndicator.parentNode) {
                refreshIndicator.parentNode.removeChild(refreshIndicator);
            }
        }, 300);
    }, 2000);
}

// Add subtle animation to UI elements during refresh
function animateUIRefresh() {
    const elementsToAnimate = [
        driveCommissionElement?.parentElement,
        tasksProgressElement?.parentElement,
        walletBalanceElement?.parentElement
    ].filter(Boolean);
    
    elementsToAnimate.forEach(element => {
        element.style.transition = 'transform 0.2s ease';
        element.style.transform = 'scale(1.02)';
        
        setTimeout(() => {
            element.style.transform = 'scale(1)';
            setTimeout(() => {
                element.style.transition = '';
            }, 200);
        }, 100);
    });
}

// --- Drive Status Check for Persistence ---
function checkDriveStatus(token) {
    console.log('checkDriveStatus function called.');
    if (animationTimeout) {
        clearTimeout(animationTimeout);
        animationTimeout = null;
        console.log('Cleared pending animation timeout.');
    }
>>>>>>> post
    if (!token) {
        console.log('checkDriveStatus: No token, redirecting to login.');
        showNotification('Session expired. Redirecting to login.', 'error');
        window.location.href = 'login.html';
        return;
    }
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';

    try {
        const response = await fetch(`${API_BASE_URL}/api/drive/status`, {
            method: 'GET', // GET request as per drive.md and data_drive_functionality.md
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';

        if (!response.ok) {
            throw new Error(data.message || `HTTP error ${response.status}`);
        }
<<<<<<< HEAD
        
        currentDriveSessionId = data.drive_session_id || null;
        if(currentDriveSessionId) localStorage.setItem('current_drive_session_id', currentDriveSessionId);


        totalTasksRequired = parseInt(data.tasks_required || 0, 10);
        tasksCompleted = parseInt(data.tasks_completed || 0, 10);
        totalDriveCommission = parseFloat(data.total_commission || 0);

        updateProgressBar(tasksCompleted, totalTasksRequired);
        updateDriveCommissionDisplay(totalDriveCommission);

        if (data.status === 'active' && data.current_order && data.current_order.product_id) {
            if (autoStartButton) autoStartButton.style.display = 'none';
            if (productCardContainer) productCardContainer.style.display = 'block';
            currentProductData = {
                order_id: data.current_order.order_id, // Ensure backend sends order_id
                product_id: data.current_order.product_id,
                product_name: data.current_order.product_name,
                product_price: parseFloat(data.current_order.product_price),
                product_image: data.current_order.product_image || data.current_order.product_image_url,
                product_description: data.current_order.product_description,
                // order_commission: data.current_order.order_commission // if available
            };
            renderProductCard(currentProductData);
        } else if (data.status === 'frozen') {
            displayFrozenState(data.info || "Your drive is frozen.", data.frozen_amount_needed);
        } else if (data.status === 'complete' || data.status === 'pending_reset') {
            displayDriveComplete(data.info || 'Your data drive is complete.', totalDriveCommission);
        } else if (data.status === 'no_session') {
            if (autoStartButton) autoStartButton.style.display = 'block';
            if (productCardContainer) productCardContainer.style.display = 'none';
            localStorage.removeItem('current_drive_session_id');
            currentDriveSessionId = null;
            // Reset UI elements to default
            updateProgressBar(0, 1);
            updateDriveCommissionDisplay(0);
        } else {
            // Unknown state, default to allowing a new drive start
            console.warn("Unknown drive status from /api/drive/status:", data);
            if (autoStartButton) autoStartButton.style.display = 'block';
            if (productCardContainer) productCardContainer.style.display = 'none';
            localStorage.removeItem('current_drive_session_id');
        }
    } catch (error) {
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        console.error('Error checking drive status:', error);
        showNotification(`Error checking drive status: ${error.message}`, 'error');
        if (autoStartButton) autoStartButton.style.display = 'block'; // Fallback to start button
        if (productCardContainer) productCardContainer.style.display = 'none';
        localStorage.removeItem('current_drive_session_id');
=======
    })
    .then(res => res.json())
    .then(data => {
        console.log('Drive status response received (/api/drive/status):', data);
        // console.log('Drive status:', data.status); // data.status might be deprecated if using code + current_order

        if (data.code === 0) { // Indicates a valid status response
            // Load total_session_commission from backend if available
            if (data.total_session_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_session_commission);
            } else {
                // Fallback to localStorage if backend doesn't send it (should not happen for active/frozen/complete)
                const sessionData = getCurrentSessionData();
                if (sessionData && sessionData.totalCommission !== undefined) {
                    totalDriveCommission = parseFloat(sessionData.totalCommission);
                } else {
                    totalDriveCommission = 0; // Default if nothing found
                }
            }
            updateDriveCommission(); // Update UI and persist

            if (data.status === 'active' && data.current_order) {
                console.log('checkDriveStatus: Active session with current order found. Resuming drive.');
                if (autoStartButton) autoStartButton.style.display = 'none';
                if (productCardContainer) {
                    productCardContainer.style.display = 'block';
                    renderProductCard(data.current_order);
                    currentProductData = data.current_order;
                }
                
                // tasks_completed and tasks_required now refer to Task Sets
                if (data.tasks_completed !== undefined && data.tasks_required !== undefined) {
                    totalTasksRequired = data.tasks_required;
                    tasksCompleted = data.tasks_completed;
                    updateProgressBar(tasksCompleted, totalTasksRequired);
                }
                return true;
            } else if (data.status === 'frozen') {
                console.log('checkDriveStatus: Frozen session found. Displaying frozen state.');
                displayFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed);
                if (autoStartButton) autoStartButton.style.display = 'none';
                 if (data.tasks_completed !== undefined && data.tasks_required !== undefined) { // Update progress even if frozen
                    totalTasksRequired = data.tasks_required;
                    tasksCompleted = data.tasks_completed;
                    updateProgressBar(tasksCompleted, totalTasksRequired);
                }
                return true;
            } else if (data.status === 'complete') {
                console.log('checkDriveStatus: Drive complete.');
                displayDriveComplete(data.info || 'Drive completed successfully.');
                if (autoStartButton) autoStartButton.style.display = 'none';
                if (data.tasks_completed !== undefined && data.tasks_required !== undefined) { // Update progress to show 100%
                    totalTasksRequired = data.tasks_required;
                    tasksCompleted = data.tasks_completed; // Should be equal to totalTasksRequired
                    updateProgressBar(tasksCompleted, totalTasksRequired);
                }
                return true;
            } else if (data.status === 'no_session') {
                console.log('checkDriveStatus: No active session found.');
                if (autoStartButton) autoStartButton.style.display = 'block';
                if (productCardContainer) productCardContainer.style.display = 'none';
                
                clearSessionData();
                totalDriveCommission = 0; // Reset commission
                updateDriveCommission(); // Update UI and persist
                updateProgressBar(0, totalTasksRequired || 0); // Reset progress bar
                return false;
            }
        }
        // If data.code is not 0, or status is unexpected
        console.warn('checkDriveStatus: Received unexpected status or error code:', data);
        if (autoStartButton) autoStartButton.style.display = 'block';
        if (productCardContainer) productCardContainer.style.display = 'none';
        return false;
    })
    .catch(error => {
        console.error('checkDriveStatus: Error checking drive status:', error);
        if (autoStartButton) autoStartButton.style.display = 'block';
        if (productCardContainer) productCardContainer.style.display = 'none';
        return false;
    });
}

// --- Manual Refresh Functionality ---
async function performManualRefresh() {
    console.log('Manual refresh initiated...');
    
    // Show visual feedback that refresh is happening
    const refreshButton = document.getElementById('refresh-drive-button');
    if (refreshButton) {
        const originalHTML = refreshButton.innerHTML;
        refreshButton.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
        refreshButton.disabled = true;
        
        try {
            // 1. Refresh wallet balance
            console.log('Refreshing wallet balance...');
            refreshWalletBalance();
            
            // 2. Check current drive status
            console.log('Checking drive status...');
            await checkDriveStatus(globalAuthData.token);
            
            // 3. Update all UI elements
            console.log('Updating UI elements...');
            updateAllUIElements({});
            
            // 4. Show success feedback
            showRefreshFeedback();
            
            // Success notification
            if (typeof showNotification === 'function') {
                showNotification('Data refreshed successfully!', 'success');
            }
            
            console.log('Manual refresh completed successfully');
            
        } catch (error) {
            console.error('Error during manual refresh:', error);
            
            // Error notification
            if (typeof showNotification === 'function') {
                showNotification('Failed to refresh data. Please try again.', 'error');
            }
        } finally {
            // Restore button state
            setTimeout(() => {
                if (refreshButton) {
                    refreshButton.innerHTML = originalHTML;
                    refreshButton.disabled = false;
                }
            }, 1000); // Keep spinning for 1 second to show completion
        }
    }
}

// Enhanced checkDriveStatus to be used by manual refresh
async function checkDriveStatus(token) {
    if (!token) {
        console.warn('No token provided for drive status check');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/drive/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Drive status response:', data);
            
            if (data.code === 0) {
                // Update global variables with fresh data
                if (data.session) {
                    if (data.session.tasks_completed !== undefined) {
                        tasksCompleted = data.session.tasks_completed;
                    }
                    if (data.session.tasks_required !== undefined) {
                        totalTasksRequired = data.session.tasks_required;
                    }
                    if (data.session.total_commission !== undefined) {
                        totalDriveCommission = parseFloat(data.session.total_commission);
                    }
                    
                    // Update progress
                    updateProgressBar(tasksCompleted, totalTasksRequired);
                    updateDriveCommission();
                }
                
                // Update current product if available
                if (data.current_order) {
                    currentProductData = data.current_order;
                    if (productCardContainer) {
                        productCardContainer.style.display = 'block';
                        renderProductCard(data.current_order);
                    }
                }
            } else if (data.code === 3) {
                // Handle frozen state
                if (data.frozen_amount_needed) {
                    displayFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed);
                }
            }
        } else {
            console.error('Failed to fetch drive status:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error checking drive status:', error);
        throw error; // Re-throw for handling in performManualRefresh
    }
}

// --- Check for Existing Drive on Page Load ---
async function checkForExistingDrive(token) {
    try {
        console.log('Checking for existing active drive session...');
        await checkDriveStatus(token);
    } catch (error) {
        console.error('Error checking for existing drive:', error);
        // Don't throw error - page should still load normally
    }
}

// --- Background Refresh Functionality ---
async function performBackgroundRefresh() {
    try {
        // Silently refresh wallet balance and drive status
        refreshWalletBalance();
        
        // Only check drive status if we have an active session
        const sessionData = localStorage.getItem('current_drive_session');
        if (sessionData) {
            await checkDriveStatus(globalAuthData.token);
        }
        
        console.log('Background refresh completed');
    } catch (error) {
        console.error('Background refresh failed:', error);        // Fail silently - don't disrupt user experience
    }
}

// --- Drive State Display Functions ---
function displayDriveComplete(message) {
    console.log('displayDriveComplete called with message:', message);
    
    // Hide the product card and show completion message
    if (productCardContainer) productCardContainer.style.display = 'none';
    if (autoStartButton) {
        autoStartButton.style.display = 'block';
        autoStartButton.querySelector('span').textContent = 'Start New Drive';
    }
    
    // Show success notification
    if (typeof showNotification === 'function') {
        showNotification(message, 'success');
    } else if (typeof $(document).dialog === 'function') {
        $(document).dialog({infoText: message, autoClose: 4000});
    } else {
        alert(message);
    }
    
    // Reset for new drive
    clearSessionData();
    refreshWalletBalance();
}

function displayDriveError(message) {
    console.log('displayDriveError called with message:', message);
    
    // Show the start button and hide product card
    if (autoStartButton) {
        autoStartButton.style.display = 'block';
        autoStartButton.querySelector('span').textContent = 'Start';
    }
    if (productCardContainer) productCardContainer.style.display = 'none';
    
    // Show error notification
    if (typeof showNotification === 'function') {
        showNotification(message, 'error');
    } else if (typeof $(document).dialog === 'function') {
        $(document).dialog({infoText: message, autoClose: 4000});
    } else {
        alert(message);
    }
}

function displayFrozenState(message, frozenAmountNeeded) {
    console.log('displayFrozenState called with message:', message, 'Amount needed:', frozenAmountNeeded);
    
    // Hide product card and start button
    if (productCardContainer) productCardContainer.style.display = 'none';
    if (autoStartButton) autoStartButton.style.display = 'none';
    
    // Create frozen state display
    const frozenMessage = frozenAmountNeeded 
        ? `${message} Please deposit ${parseFloat(frozenAmountNeeded).toFixed(2)} USDT to continue.`
        : message;
    
    // Show frozen state notification with contact support option
    if (typeof showNotification === 'function') {
        showNotification(frozenMessage, 'warning');
    } else if (typeof $(document).dialog === 'function') {
        $(document).dialog({infoText: frozenMessage, autoClose: 6000});
    } else {
        alert(frozenMessage);
    }
    
    // Add contact support button functionality if not already added
    const contactSupportBtn = document.getElementById('contact-support-btn');
    if (contactSupportBtn) {
        contactSupportBtn.addEventListener('click', () => {
            window.location.href = './support.html';
        });
    }
}

function resumeSpecificOrder(token, orderId, productId) {
    console.log('resumeSpecificOrder called with orderId:', orderId, 'productId:', productId);
    
    // This function would be used when resuming from orders page
    // For now, just check the current drive status
    checkDriveStatus(token);
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        refreshWalletBalance();
>>>>>>> main
    }
}
