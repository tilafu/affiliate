// Ensure API_BASE_URL and showNotification are available (assuming from main.js)
// If not, define them here or ensure main.js is loaded first.

// --- Global Variables (Unlimited Task Sets Design) ---
var oid = null; // Will be set by startDrive response if needed (using session ID?) // This seems unused, consider removing.
let totalTasksRequired = 0; // Variable to store the total number of products across all task sets (unlimited design)
let tasksCompleted = 0; // Track the current product step being worked on (unlimited design)
let totalDriveCommission = 0; // Track total commission earned in this drive
let isStartingDrive = false; // Flag to prevent unintentional start drive calls

// --- UI Element References ---
let autoStartButton;
let productCardContainer; // New container for the dynamic product card
let walletBalanceElement;
let driveCommissionElement; // Element to display commission earned in this drive
let tasksProgressElement; // Element to display tasks completed/required
let driveProgressBar; // Main progress bar at the top
let progressTextElement; // Text showing progress count
let tasksProgressBar; // Small progress bar in tasks card
let orderLoadingOverlay; // Reference to the new loading overlay

// --- Drive State Variables ---
let currentProductData = null; // Store data of the currently displayed product

// --- Drive Animation/Start Logic ---
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
  // Initialize progress bars with default values for unlimited task sets design
  updateProgressBar(0, 0); // Start with 0/0 for unlimited design// Initial balance fetch
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
}

// --- Wait for DOM and potentially components before initializing ---
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
        
        if (isFrozen) {
            // Show the frozen account modal
            const frozenModalElement = document.getElementById('frozenAccountModal');
            if (frozenModalElement) {
                const frozenModal = bootstrap.Modal.getOrCreateInstance(frozenModalElement);
                frozenModal.show();
            }
        }
        
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

// --- Helper to safely update wallet balance everywhere ---
function refreshWalletBalance() {
    if (globalAuthData && globalAuthData.token) {
        fetchBalance(globalAuthData.token);
    }
}

// --- Update Progress Bar Function (Unlimited Task Sets Design) ---
function updateProgressBar(currentStep, totalProducts) {
    // Get DOM elements
    const progressBar = document.getElementById('drive-progress-bar');
    const progressText = document.getElementById('progress-text');
    const tasksProgressElement = document.getElementById('tasks-count');
    
    // Ensure we have valid numbers for the unlimited task sets design
    // currentStep = current product being worked on (across all task sets)
    // totalProducts = total products across all current task sets
    const completed = Math.max(0, parseInt(currentStep) || 0);
    const total = Math.max(0, parseInt(totalProducts) || 0);
    const displayCompleted = completed;
    const displayTotal = total || 0; // Default to 0 for unlimited design
    
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
    
    // Update progress text for unlimited task sets design
    if (progressText) {
        if (total === 0) {
            progressText.textContent = 'Drive starting...';
        } else {
            progressText.textContent = `${displayCompleted} / ${displayTotal} products completed`;
        }
    }
    
    // Update tasks count for unlimited design
    if (tasksProgressElement) {
        if (total === 0) {
            tasksProgressElement.textContent = '(initializing...)';
        } else {
            tasksProgressElement.textContent = `(${displayCompleted} / ${displayTotal})`;
        }
    }
    
    // Update global variables for unlimited task sets design
    // Repurpose these variables to track products instead of task sets
    tasksCompleted = completed; // Now tracks current product step
    totalTasksRequired = total; // Now tracks total products across all task sets
    saveCurrentSessionData();
    
    console.log(`Unlimited Drive Progress updated: ${displayCompleted}/${displayTotal} products (${percentage.toFixed(1)}%)`);
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

function startDriveProcess(token) {
    if (!isStartingDrive) {
        console.log("startDriveProcess called but isStartingDrive is false. Aborting.");
        return;
    }
    console.log("startDriveProcess called.");

    countDown = 5; // Reset countdown
    
    $('.product-carousel').trigger('stop.owl.autoplay');
    $('.product-carousel').trigger('play.owl.autoplay', [500]);
    
    if (autoStartButton) autoStartButton.querySelector('span').textContent = 'Starting...';
    
    animationTimeout = setTimeout(() => animateAndStart(token), 1000);
}

function animateAndStart(token) {
    console.log("animateAndStart called with countdown: " + countDown);
    
    // Check if countdown has reached 0 before displaying
    if (countDown <= 0) {
        console.log("Countdown complete, calling API");
        $('.product-carousel').trigger('stop.owl.autoplay');
        $('.product-carousel').trigger('play.owl.autoplay', [3000]);
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

function callStartDriveAPI(token) {
    console.log("callStartDriveAPI called");
    let loadingIndicator = null;
    let loadingMethod = null;
    try {
        if (typeof layer !== 'undefined' && typeof layer.load === 'function') {
            loadingIndicator = layer.load(2);
            loadingMethod = 'layer';
            console.log("Using layer.load for loading indicator. Index:", loadingIndicator);
        } else if (typeof $(document).dialog === 'function') {
            loadingIndicator = $(document).dialog({
                type: 'notice',
                infoText: 'Starting Data Drive...',
                autoClose: 0
            });
            loadingMethod = 'dialog';
            console.log("Using jQuery dialog for loading indicator.");
        } else {
            console.log("No loading indicator available, using console fallback");
            loadingMethod = 'none';
        }
    } catch (e) {
        console.error("Error showing loading indicator:", e);
        loadingMethod = 'error';
    }

    $('.product-carousel').addClass('starting-drive');
    $('.product-carousel').css({
        'animation': 'pulse 1s infinite',
        'box-shadow': '0 0 15px rgba(0,123,255,0.7)'
    });
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';

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
            } else {
                try {
                    if (typeof showNotification === 'function') {
                        showNotification(data.info || 'Failed to start drive.', 'error');
                    } else if (typeof $(document).dialog === 'function') {
                        $(document).dialog({infoText: data.info || 'Failed to start drive.', autoClose: 4000});
                    } else {
                        alert(data.info || 'Failed to start drive.');
                    }
                } catch (e) {
                    console.error("Error showing error dialog:", e);
                    alert(data.info || 'Failed to start drive.');
                }
                $('.product-carousel').css('border', '2px solid red');
                setTimeout(() => {
                    $('.product-carousel').css('border', '');
                }, 3000);
            }
            isStartingDrive = false;
        })
        .catch(error => {
            console.error('Error starting drive:', error);
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
                console.error("Error closing loading indicator on catch:", e);
            }
            if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
            if (autoStartButton) autoStartButton.querySelector('span').textContent = 'Start';
            $('.product-carousel').removeClass('starting-drive');            $('.product-carousel').css({
                'animation': '',
                'box-shadow': ''
            });
            $('.product-carousel').css('border', '2px solid red');
            setTimeout(() => {
                $('.product-carousel').css('border', '');
            }, 3000);
            try {
                if (typeof showNotification === 'function') {
                    showNotification(`Error starting drive: ${error.message}`, 'error');
                } else if (typeof $(document).dialog === 'function') {
                    $(document).dialog({infoText: `Error starting drive: ${error.message}`, autoClose: 4000});
                } else {
                    alert(`Error starting drive: ${error.message}`);
                }
            } catch (e) {
                console.error("Error showing error dialog:", e);
                alert(`Error starting drive: ${error.message}`);
            }
            isStartingDrive = false;
        });
    }, 500);
}

function fetchNextOrder(token) {
    console.log("Fetching next order (/api/drive/getorder)...");
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';
    $('.product-carousel').trigger('stop.owl.autoplay');
    fetch(`${API_BASE_URL}/api/drive/getorder`, { // This is a POST request as per existing code
        method: 'POST', // Assuming it's POST, though GET might be more appropriate for "get"
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
    })
    .then(response => response.json())
    .then(data => {
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
            refreshWalletBalance();        } else if (data.code === 3) { // Drive Frozen
            console.warn("Drive Frozen message received from backend (getorder).");
            displayFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed, data);
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
        }
    })
    .catch(error => {
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        $('.product-carousel').trigger('play.owl.autoplay', [3000]);
        console.error('Error fetching next order:', error);
        displayDriveError(`Network error fetching order: ${error.message}`);
    });
}

function renderProductCard(productData) {
    if (!productCardContainer) return;
    // productData now includes is_combo, product_name, product_image, product_price, order_commission, user_active_drive_item_id
    // Enhanced to show combo information and task progress
    
    console.log('Rendering product card with data:', productData);
    
    // Enhanced fade effect for better UX and refresh indication
    productCardContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    productCardContainer.style.opacity = '0.3';
    productCardContainer.style.transform = 'scale(0.98)';
    
    setTimeout(() => {
        // Determine if this is a combo product and show appropriate indicators
        let comboInfo = '';
        let productTitle = productData.product_name || 'Product';
        
        if (productData.is_combo) {
            comboInfo = '<span class="badge bg-info text-dark ms-2">Combo Item</span>';
            
            // Show combo progress if available
            if (productData.combo_progress) {
                comboInfo += `<br><small class="text-muted">Combo Progress: ${productData.combo_progress}</small>`;
            }
            
            // Show which product in combo if available
            if (productData.product_slot !== undefined && productData.total_products_in_item) {
                comboInfo += `<br><small class="text-primary">Product ${productData.product_slot + 1} of ${productData.total_products_in_item}</small>`;
            }
        }
          // Show drive progress information (unlimited task sets design)
        let taskProgress = '';
        if (totalTasksRequired > 0) {
            // In unlimited design: tasksCompleted = current product step, totalTasksRequired = total products
            const currentProductStep = tasksCompleted + 1; // Next product to complete
            taskProgress = `<div class="mt-2 mb-3">
                <small class="text-muted">Drive Progress: ${tasksCompleted}/${totalTasksRequired} products completed</small>
                <div class="progress mt-1" style="height: 8px;">
                    <div class="progress-bar bg-success" style="width: ${(tasksCompleted / totalTasksRequired * 100)}%"></div>
                </div>
            </div>`;
        }
        
        productCardContainer.innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <h4>${productTitle}${comboInfo}</h4>
                    <img src="${productData.product_image || './assets/uploads/images/ph.png'}" alt="${productData.product_name || 'Product Image'}" style="max-width: 150px; margin: 10px auto; display: block;">
                    <p>Price: <strong>${parseFloat(productData.product_price).toFixed(2)}</strong> USDT</p>
                    <p>Commission for this item: <strong>${parseFloat(productData.order_commission).toFixed(2)}</strong> USDT</p>
                    <p class="text-success small">Total drive commission so far: <strong>${totalDriveCommission.toFixed(2)}</strong> USDT</p>
                    ${taskProgress}
                    <button id="purchase-button" class="btn btn-primary mt-3">Purchase</button>
                </div>
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

async function handlePurchase(token, productData) {
    console.log('--- handlePurchase Start ---');
    console.log('Initial productData.user_active_drive_item_id:', productData ? productData.user_active_drive_item_id : 'productData is null/undefined');
    console.log('Initial productData.product_id:', productData ? productData.product_id : 'productData is null/undefined');
    console.log('Initial productData.product_price (for order_amount):', productData ? productData.product_price : 'productData is null/undefined');
    console.log('Initial productData.product_slot (for product_slot_to_complete):', productData ? productData.product_slot : 'productData is null/undefined');
    console.log('Initial productData.is_combo_product:', productData ? productData.is_combo_product : 'productData is null/undefined');
    console.log('Initial productData.combo_product_index:', productData ? productData.combo_product_index : 'productData is null/undefined');
    console.log('Full initial Product Data:', productData);

    const purchaseButton = document.getElementById('purchase-button');
    if (purchaseButton) {
        purchaseButton.disabled = true;
        purchaseButton.textContent = 'Processing...';
    }
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';
    
    // Determine product_slot_to_complete
    let determined_slot;
    if (productData.product_slot !== undefined) {
        determined_slot = productData.product_slot;
        console.log('Using productData.product_slot for slot:', determined_slot);
    } else if (productData.is_combo_product === true && productData.combo_product_index !== undefined) {
        determined_slot = productData.combo_product_index;
        console.log('Using productData.combo_product_index for slot (combo product):', determined_slot);
    } else if (productData.is_combo_product === false) {
        determined_slot = 0; // Default for non-combo products if product_slot is missing
        console.log('Defaulting slot to 0 (non-combo product, product_slot missing):', determined_slot);
    } else {
        determined_slot = undefined; // Fallback, should trigger backend error if this path is hit
        console.warn('Could not determine product_slot_to_complete. It will be undefined.');
    }

    const payload = {
        user_active_drive_item_id: productData.user_active_drive_item_id,
        product_id: productData.product_id,
        order_amount: productData.product_price, 
        product_slot_to_complete: determined_slot 
    };
    console.log('Constructed payload for saveorder:', payload);
    console.log('--- handlePurchase End of Logging ---');
      try {
        const response = await fetch(`${API_BASE_URL}/api/drive/saveorder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });        const data = await response.json();
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
          if (response.ok && data.code === 0) { // Order processed successfully
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
            
            // Force wallet balance refresh after successful purchase
            refreshWalletBalance();

            // Backend now sends next_order or completion status
            if (data.next_order) {
                currentProductData = data.next_order;                // Add a small delay to ensure commission display updates properly
                setTimeout(async () => {
                    // Perform additional refresh to ensure data consistency
                    try {
                        await checkDriveStatus(token);
                        // Force balance update after successful purchase
                        refreshWalletBalance();
                        // Update commission display one more time to ensure consistency
                        updateDriveCommission();
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
            }        } else if (data.code === 3) { // Frozen state
             if (typeof showNotification === 'function') {
                showNotification(data.info || "Session frozen due to insufficient balance.", 'warning');
             } else { alert(data.info || "Session frozen due to insufficient balance."); }
             displayFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed, data);
             refreshWalletBalance();
        }
        else {            if (typeof showNotification === 'function') {
                showNotification(`Failed to save order: ${data.info || data.message || 'Unknown error'}`, 'error');
            } else { alert(`Failed to save order: ${data.info || data.message || 'Unknown error'}`); }
            if (purchaseButton) {
                 purchaseButton.disabled = false;
                 purchaseButton.textContent = 'Purchase';
            }
        }
    } catch (error) {
        if (typeof showNotification === 'function') {
            showNotification(`Error saving order: ${error.message}`, 'error');
        } else { alert(`Error saving order: ${error.message}`); }
        if (purchaseButton) {
            purchaseButton.disabled = false;
            purchaseButton.textContent = 'Purchase';
        }
    }
}

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
    if (!token) {
        console.log('checkDriveStatus: No token found, returning.');
        return;
    }

    return fetch(`${API_BASE_URL}/api/drive/status`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
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
                    totalDriveCommission = parseFloat(sessionData.totalCommission);                } else {
                    totalDriveCommission = 0; // Default if nothing found
                }
            }
            updateDriveCommission(); // Update UI and persist

            if (data.status === 'active' && data.current_order) {
                console.log('checkDriveStatus: Active session with current order found. Resuming drive.');
                
                // Clean up any frozen state displays when resuming
                clearFrozenStateDisplay();
                
                if (autoStartButton) autoStartButton.style.display = 'none';
                if (productCardContainer) {
                    productCardContainer.style.display = 'block';
                    renderProductCard(data.current_order);
                    currentProductData = data.current_order;
                }
                
                // Update commission display immediately
                if (data.total_session_commission !== undefined) {
                    totalDriveCommission = parseFloat(data.total_session_commission);
                    updateDriveCommission();
                }
                
                // tasks_completed and tasks_required now refer to Task Sets
                if (data.tasks_completed !== undefined && data.tasks_required !== undefined) {
                    totalTasksRequired = data.tasks_required;
                    tasksCompleted = data.tasks_completed;
                    updateProgressBar(tasksCompleted, totalTasksRequired);
                }
                  // Ensure wallet balance is up to date
                refreshWalletBalance();
                
                return true;
            } else if (data.status === 'frozen') {
                console.log('checkDriveStatus: Frozen session found. Displaying frozen state.');
                
                // Extract and set global variables for frozen sessions (missing before)
                if (data.tasks_completed !== undefined && data.tasks_required !== undefined) {
                    totalTasksRequired = data.tasks_required;
                    tasksCompleted = data.tasks_completed;
                    updateProgressBar(tasksCompleted, totalTasksRequired);
                }
                
                displayFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed, data);
                if (autoStartButton) autoStartButton.style.display = 'none';
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
                // Update commission immediately from response
                if (data.total_session_commission !== undefined) {
                    totalDriveCommission = parseFloat(data.total_session_commission);
                    updateDriveCommission();
                }
                
                // Update progress data
                if (data.tasks_completed !== undefined && data.tasks_required !== undefined) {
                    tasksCompleted = data.tasks_completed;
                    totalTasksRequired = data.tasks_required;
                    updateProgressBar(tasksCompleted, totalTasksRequired);
                }
                
                // Handle different drive states
                if (data.status === 'active' && data.current_order) {
                    console.log('Drive is active with current order');
                    currentProductData = data.current_order;
                    
                    if (autoStartButton) autoStartButton.style.display = 'none';
                    if (productCardContainer) {
                        productCardContainer.style.display = 'block';
                        renderProductCard(data.current_order);
                    }
                    
                    clearFrozenStateDisplay(); // Remove any frozen state displays
                    
                } else if (data.status === 'frozen') {
                    console.log('Drive is frozen');
                    displayFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed, data);
                    if (autoStartButton) autoStartButton.style.display = 'none';
                    
                } else if (data.status === 'complete') {
                    console.log('Drive is complete');
                    displayDriveComplete(data.info || 'Drive completed successfully.');
                    if (autoStartButton) autoStartButton.style.display = 'none';
                    
                } else if (data.status === 'no_session') {
                    console.log('No active drive session');
                    if (autoStartButton) autoStartButton.style.display = 'block';
                    if (productCardContainer) productCardContainer.style.display = 'none';
                    
                    // Reset state for no session
                    clearSessionData();
                    totalDriveCommission = 0;
                    updateDriveCommission();
                    updateProgressBar(0, totalTasksRequired || 45);
                }
                
                // Always update wallet balance for consistency
                refreshWalletBalance();
                
            } else if (data.code === 3) {
                // Handle frozen state
                console.log('Drive status indicates frozen state');
                if (data.tasks_completed !== undefined) {
                    tasksCompleted = data.tasks_completed;
                }
                if (data.tasks_required !== undefined) {
                    totalTasksRequired = data.tasks_required;
                }
                if (data.total_session_commission !== undefined) {
                    totalDriveCommission = parseFloat(data.total_session_commission);
                }
                
                // Update progress and commission
                updateProgressBar(tasksCompleted, totalTasksRequired);
                updateDriveCommission();
                
                displayFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed, data);
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

function displayFrozenState(message, frozenAmountNeeded, serverData = null) {
    console.log('displayFrozenState called with message:', message, 'Amount needed:', frozenAmountNeeded, 'Server data:', serverData);
    
    // Hide product card and start button but KEEP progress and commission visible
    if (productCardContainer) productCardContainer.style.display = 'none';
    if (autoStartButton) autoStartButton.style.display = 'none';
    
    // Extract and update data from server response if available
    if (serverData) {
        if (serverData.tasks_completed !== undefined) {
            tasksCompleted = serverData.tasks_completed;
        }
        if (serverData.tasks_required !== undefined) {
            totalTasksRequired = serverData.tasks_required;
        }
        if (serverData.total_commission !== undefined) {
            totalDriveCommission = parseFloat(serverData.total_commission);
        } else if (serverData.total_session_commission !== undefined) {
            totalDriveCommission = parseFloat(serverData.total_session_commission);
        }
    }
    
    // Ensure commission and progress displays remain visible and updated
    updateDriveCommission(); // Update commission display
    updateProgressBar(tasksCompleted, totalTasksRequired); // Update progress display
    
    // Create comprehensive frozen state display with progress info
    const progressInfo = totalTasksRequired > 0 
        ? `\nProgress: ${tasksCompleted}/${totalTasksRequired} tasks completed`
        : '';
    const commissionInfo = totalDriveCommission > 0 
        ? `\nCommission earned: ${totalDriveCommission.toFixed(2)} USDT`
        : '';
    
    const frozenMessage = frozenAmountNeeded 
        ? `${message} Please deposit ${parseFloat(frozenAmountNeeded).toFixed(2)} USDT to continue.${progressInfo}${commissionInfo}`
        : `${message}${progressInfo}${commissionInfo}`;
    
    // Show frozen state notification with contact support option
    if (typeof showNotification === 'function') {
        showNotification(frozenMessage, 'warning');
    } else if (typeof $(document).dialog === 'function') {
        $(document).dialog({infoText: frozenMessage, autoClose: 8000}); // Longer display time for more info
    } else {
        alert(frozenMessage);
    }
    
    // Create or update frozen state card to show progress and commission
    createFrozenStateCard(message, frozenAmountNeeded);
    
    // Add contact support button functionality if not already added
    const contactSupportBtn = document.getElementById('contact-support-btn');
    if (contactSupportBtn) {
        contactSupportBtn.addEventListener('click', () => {
            window.location.href = './support.html';
        });
    }
}

// Create a visual card showing frozen state with progress and commission info
function createFrozenStateCard(message, frozenAmountNeeded) {
    // Remove existing frozen state card if any
    const existingCard = document.getElementById('frozen-state-card');
    if (existingCard) {
        existingCard.remove();
    }
    
    // Create new frozen state card
    const frozenCard = document.createElement('div');
    frozenCard.id = 'frozen-state-card';
    frozenCard.className = 'row mb-3';
    frozenCard.innerHTML = `
        <div class="col-md-5 mx-auto">
            <div class="card border-warning">
                <div class="card-body">
                    <div class="text-center">
                        <h5 class="card-title text-warning">
                            <i class="fas fa-exclamation-triangle"></i> Account Frozen
                        </h5>
                        <p class="text-muted">${message}</p>
                        ${frozenAmountNeeded ? 
                            `<p class="text-danger"><strong>Amount needed: ${parseFloat(frozenAmountNeeded).toFixed(2)} USDT</strong></p>` : 
                            ''}
                        
                        <div class="mt-3 mb-3">
                            <h6>Your Drive Progress (Preserved)</h6>
                            <div class="progress mb-2" style="height: 20px;">
                                <div class="progress-bar bg-warning" style="width: ${totalTasksRequired > 0 ? (tasksCompleted / totalTasksRequired * 100) : 0}%">
                                    ${tasksCompleted}/${totalTasksRequired}
                                </div>
                            </div>
                            <p class="small text-muted">Tasks completed: ${tasksCompleted} of ${totalTasksRequired}</p>
                        </div>
                        
                        <div class="mt-3 mb-3">
                            <h6>Commission Earned (Preserved)</h6>
                            <p class="text-success"><strong>${totalDriveCommission.toFixed(2)} USDT</strong></p>
                            <p class="small text-muted">Your earned commission is safe and will be available when you resume</p>
                        </div>
                        
                        <div class="mt-3">
                            <a href="./deposits.html" class="btn btn-success btn-sm me-2">
                                <i class="fas fa-plus"></i> Deposit Funds
                            </a>
                            <button id="contact-support-btn" class="btn btn-outline-primary btn-sm">
                                <i class="fas fa-life-ring"></i> Contact Support
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Insert the card after the progress bar container
    const progressContainer = document.querySelector('.row.mb-3:nth-child(2)'); // Progress bar container
    if (progressContainer && progressContainer.nextSibling) {
        progressContainer.parentNode.insertBefore(frozenCard, progressContainer.nextSibling);
    } else if (progressContainer) {
        progressContainer.parentNode.appendChild(frozenCard);
    } else {
        // Fallback: insert after the main container
        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
            mainContainer.appendChild(frozenCard);
        }
    }
}

// Function to clear frozen state displays when resuming drive
function clearFrozenStateDisplay() {
    console.log('clearFrozenStateDisplay called');
    
    // Remove frozen state card
    const existingCard = document.getElementById('frozen-state-card');
    if (existingCard) {
        existingCard.remove();
        console.log('Frozen state card removed');
    }
    
    // Clear any frozen state notifications
    const notifications = document.querySelectorAll('.alert-warning, .notification-warning');
    notifications.forEach(notification => {
        // Only remove if it contains frozen-related text
        if (notification.textContent && 
            (notification.textContent.includes('frozen') || 
             notification.textContent.includes('Frozen') ||
             notification.textContent.includes('insufficient balance'))) {
            notification.remove();
        }
    });
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
    }
});