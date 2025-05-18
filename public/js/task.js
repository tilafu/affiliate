// Ensure API_BASE_URL and showNotification are available (assuming from main.js)
// If not, define them here or ensure main.js is loaded first.

// --- Global Variables ---
let currentDriveSessionId = null;
let currentDriveConfigurationId = null;
let totalTasksRequired = 0; // Variable to store the total number of tasks required
let tasksCompleted = 0; // Track the number of completed tasks
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

// Track important IDs for data consistency
let idTracking = {
    sessionIdHistory: [],
    orderIdHistory: [],
    productIdHistory: [],
    addSessionId: function(id, source) {
        if (id && this.sessionIdHistory[this.sessionIdHistory.length - 1] !== id) {
            this.sessionIdHistory.push(id);
        }
    },
    addOrderId: function(id, source) {
        if (id && this.orderIdHistory[this.orderIdHistory.length - 1] !== id) {
            this.orderIdHistory.push(id);
        }
    },
    addProductId: function(id, source) {
        if (id && this.productIdHistory[this.productIdHistory.length - 1] !== id) {
            this.productIdHistory.push(id);
        }
    },
    getHistory: function() {
        return {
            sessionIds: this.sessionIdHistory,
            orderIds: this.orderIdHistory,
            productIds: this.productIdHistory
        };
    }
};

// --- Initialization ---
function initializeTaskPage() {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    // Use showNotification if available, otherwise alert
    if (typeof showNotification === 'function') {
        showNotification('Authentication token not found. Redirecting to login.', 'error');
    } else {
        alert('Authentication token not found. Redirecting to login.');
    }
    window.location.href = 'login.html';
    return false; // Indicate initialization failed
  }  // Get references to key elements
  autoStartButton = document.getElementById('autoStart');
  productCardContainer = document.getElementById('product-card-container'); // Get reference to the new container
  walletBalanceElement = document.querySelector('.datadrive-balance strong');  // Select the strong element directly
  driveCommissionElement = document.querySelector('.datadrive-commission strong'); // Element for drive commission
  tasksProgressElement = document.getElementById('tasks-count'); // Element displaying tasks completed/required
  tasksProgressBar = document.getElementById('tasks-progress-bar'); // Progress bar element for tasks card
  driveProgressBar = document.getElementById('drive-progress-bar'); // Main progress bar at the top
  progressTextElement = document.getElementById('progress-text'); // Text element for progress 
  orderLoadingOverlay = document.getElementById('order-loading-overlay'); // Get reference to the loading overlay
  // Initial UI state: Show start button, hide product card container and loading overlay
  if (autoStartButton) autoStartButton.style.display = 'block';
  if (productCardContainer) productCardContainer.style.display = 'none';
  if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';

  // Check if all required UI elements exist
  if (!progressTextElement) {
    console.warn("'progress-text' element not found in the DOM. Creating a fallback element.");
    progressTextElement = document.createElement('span');
    progressTextElement.id = 'progress-text';
    
    // Try to find a suitable container to append this to
    const progressContainer = document.querySelector('.progress-container') || 
                             document.querySelector('.drive-progress') || 
                             document.body;
    
    if (progressContainer) {
      progressContainer.appendChild(progressTextElement);
    }
  }

  // Initialize progress bars with default values (will be updated by checkDriveStatus)
  updateProgressBar(0, 1); // Default to 0/1 to avoid NaN if totalTasksRequired is 0 initially

  // Initial balance fetch
  refreshWalletBalance();
  // --- Event Listeners ---
  // Attach listener for the Start button
  if (autoStartButton) {
      autoStartButton.addEventListener('click', () => {
          if (!isStartingDrive) { // Only start if not already in the process
              isStartingDrive = true; // Set flag
              startDriveProcess(token);
          }
      });
  } else {
      console.error('Could not find #autoStart button to attach listener.');
  }

  // Check drive status on page load for persistence - Moved below event listeners
  checkDriveStatus(token);

  // Event delegation for dynamically added Purchase button
  // Using productCardContainer ensures listener is within the relevant area
  if (productCardContainer) {
      productCardContainer.addEventListener('click', function(event) {
          if (event.target && event.target.id === 'purchase-button') {
              if (currentProductData) {
                  handlePurchase(token, currentProductData); // Pass token and current product data
              } else {
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
    if (!balanceElement) return;

    fetch(`${API_BASE_URL}/api/user/balances`, {
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
            balanceElement.innerHTML = `<strong>${mainBalance.toFixed(2)}<small style="font-size:14px"> USDT</small></strong>`;
        } else {
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
}

// --- Helper to safely update wallet balance everywhere ---
function refreshWalletBalance() {
    const token = localStorage.getItem('auth_token');
    if (token) {
        fetchBalance(token);
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

function startDriveProcess(token) {
    if (!isStartingDrive) {
        return;
    }

    countDown = 5; // Reset countdown
    
    $('.product-carousel').trigger('stop.owl.autoplay');
    $('.product-carousel').trigger('play.owl.autoplay', [500]);
    
    if (autoStartButton) autoStartButton.querySelector('span').textContent = 'Starting...';
    
    animationTimeout = setTimeout(() => animateAndStart(token), 1000);
}

function animateAndStart(token) {
    if (autoStartButton) autoStartButton.querySelector('span').textContent = 'Starting in ' + countDown + '...';
    $('.product-carousel .item img').css({
        'transform': 'scale(' + (1 + Math.random() * 0.2) + ')',
        'transition': 'transform 0.5s ease'
    });
    $('.product-carousel').trigger('next.owl.carousel', [300]);
    if (countDown <= 1) {
        $('.product-carousel').trigger('stop.owl.autoplay');
        $('.product-carousel').trigger('play.owl.autoplay', [3000]);
        callStartDriveAPI(token);
        return;
    }
    countDown--;
    animationTimeout = setTimeout(() => animateAndStart(token), 1000);
}

function callStartDriveAPI(token) {
    let loadingIndicator = null;
    let loadingMethod = null;
    try {
        if (typeof layer !== 'undefined' && typeof layer.load === 'function') {
            loadingIndicator = layer.load(2);
            loadingMethod = 'layer';
        } else if (typeof $(document).dialog === 'function') {
            loadingIndicator = $(document).dialog({
                type: 'notice',
                infoText: 'Starting Data Drive...',
                autoClose: 0
            });
            loadingMethod = 'dialog';
        } else {
            loadingMethod = 'none';
        }
    } catch (e) {
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
            body: JSON.stringify({})
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            // Store session ID and validate
            if (data.drive_session_id) {
                try {
                    localStorage.setItem('current_drive_session_id', data.drive_session_id);
                } catch (e) {
                    // Storage failed, continue anyway
                }
                
                currentDriveSessionId = data.drive_session_id;
            }
            
            // Handle existing session
            if (data.message === 'Active drive session already exists.' || data.code === 1) {
                if (!data.drive_session_id) {
                    // Try to recover the session ID from localStorage
                    const storedSessionId = localStorage.getItem('current_drive_session_id');
                    if (storedSessionId) {
                        currentDriveSessionId = storedSessionId;
                    }
                    
                    checkDriveStatus(token);
                    return;
                }
            }
            
            // Close loading indicators
            try {
                if (loadingMethod === 'layer' && loadingIndicator !== null) {
                    layer.close(loadingIndicator);
                } else if (loadingMethod === 'dialog' && loadingIndicator && typeof loadingIndicator.close === 'function') {
                    loadingIndicator.close();
                }
            } catch (e) {
                // Error closing indicator, continue
            }
            
            if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
            if (autoStartButton) autoStartButton.querySelector('span').textContent = 'Start';
            $('.product-carousel').removeClass('starting-drive');
            $('.product-carousel').css({
                'animation': '',
                'box-shadow': ''
            });

            if (data.code === 0 || (data.message === 'Active drive session resumed.' && data.drive_session_id)) {
                // Handle success - either new drive or existing session
                if (data.code === 0) {
                    showNotification(data.info || 'Drive started!', 'success');
                } else {
                    showNotification(data.info || 'Active drive session resumed.', 'info');
                }

                currentDriveSessionId = data.drive_session_id;
                currentDriveConfigurationId = data.drive_configuration_id;
                totalTasksRequired = data.tasks_in_configuration || data.tasks_required || 0;
                tasksCompleted = data.tasks_completed || 0;
                totalDriveCommission = parseFloat(data.total_session_commission || 0);

                updateDriveCommissionDisplay(totalDriveCommission);
                updateProgressBar(tasksCompleted, totalTasksRequired);
                
                if (autoStartButton) autoStartButton.style.display = 'none';
                if (productCardContainer) productCardContainer.style.display = 'block';
                
                fetchNextOrder(token);
            } else {
                // Handle failure
                try {
                    if (typeof showNotification === 'function') {
                        showNotification(data.info || 'Failed to start drive.', 'error');
                    } else if (typeof $(document).dialog === 'function') {
                        $(document).dialog({infoText: data.info || 'Failed to start drive.', autoClose: 4000});
                    } else {
                        alert(data.info || 'Failed to start drive.');
                    }
                } catch (e) {
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
            // Handle errors
            try {
                if (loadingMethod === 'layer' && loadingIndicator !== null) {
                    layer.close(loadingIndicator);
                } else if (loadingMethod === 'dialog' && loadingIndicator && typeof loadingIndicator.close === 'function') {
                    loadingIndicator.close();
                }
            } catch (e) {
                // Error closing indicator, continue
            }
            
            if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
            if (autoStartButton) autoStartButton.querySelector('span').textContent = 'Start';
            $('.product-carousel').removeClass('starting-drive');
            $('.product-carousel').css({
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
                alert(`Error starting drive: ${error.message}`);
            }
            isStartingDrive = false;
        });
    }, 500);
}

function fetchNextOrder(token) {
    // Session validation before fetching next order
    if (!currentDriveSessionId) {
        // Try to recover session ID from localStorage if available
        const storedSessionId = localStorage.getItem('current_drive_session_id');
        if (storedSessionId) {
            currentDriveSessionId = storedSessionId;
            idTracking.addSessionId(storedSessionId, 'fetchNextOrder recovery');
        } else {
            // Show empty state and reset UI
            if (autoStartButton) autoStartButton.style.display = 'block';
            if (productCardContainer) productCardContainer.style.display = 'none';
            updateDriveCommissionDisplay(0);
            updateProgressBar(0,1);
            
            // Try to get session details from the server
            checkDriveStatus(token);
            return;
        }
    }
    
    // Validate the session ID format
    if (typeof currentDriveSessionId !== 'string' && typeof currentDriveSessionId !== 'number') {
        currentDriveSessionId = String(currentDriveSessionId || '');
    }
    
    // If still no valid session ID, abort
    if (!currentDriveSessionId || currentDriveSessionId === 'null' || currentDriveSessionId === 'undefined') {
        showNotification("Error: Invalid session ID. Please restart the drive.", "error");
        return;
    }
    
    // Save current session ID to localStorage for recovery
    try {
        localStorage.setItem('current_drive_session_id', currentDriveSessionId);
    } catch (e) {
        // Failed to save, continue anyway
    }
    
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';
    $('.product-carousel').trigger('stop.owl.autoplay');
    
    fetch(`${API_BASE_URL}/api/drive/getorder`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ drive_session_id: currentDriveSessionId })
    })
    .then(response => response.json())
    .then(data => {
        $('.product-carousel').trigger('play.owl.autoplay', [3000]);
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        
        if (data.code === 2) { // Drive complete
            // Fetch final commission from drive status
            checkDriveStatus(token).then(() => {
                displayDriveComplete(data.info || 'Congratulations! Your data drive is complete.', totalDriveCommission);
            });
            if (autoStartButton) autoStartButton.style.display = 'none';
            refreshWalletBalance();
        } else if (data.code === 3) { // Frozen
            displayFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed);
            refreshWalletBalance();
        } else if (data.next_order && data.next_order.product_id) { 
            // Create a validated version of the order data with proper fallbacks
            const orderData = {
                product_id: String(data.next_order.product_id || ''),
                order_id: String(data.next_order.id || 
                          data.next_order.order_id || 
                          data.next_order.drive_order_id ||
                          data.next_order._id || ''),
                product_name: data.next_order.product_name || 'Product',
                product_price: parseFloat(data.next_order.product_price || 0),
                product_image: data.next_order.product_image_url || data.next_order.product_image || './assets/uploads/products/default.jpg',
                product_description: data.next_order.product_description || 'No description available',
                order_in_drive: parseInt(data.next_order.order_in_drive || 0, 10),
                status: data.next_order.status || 'pending'
            };
            
            // If we don't have a valid order_id after trying all fields, look for any ID fields
            if (!orderData.order_id || orderData.order_id === 'undefined' || orderData.order_id === 'null') {                
                // Check if the next_order object itself has an ID property
                if (typeof data.next_order === 'object') {
                    // Try standard ID fields directly on next_order
                    const possibleIdFields = ['id', '_id', 'order_id', 'drive_order_id'];
                    for (const field of possibleIdFields) {
                        if (data.next_order[field] && typeof data.next_order[field] !== 'object') {
                            orderData.order_id = String(data.next_order[field]);
                            break;
                        }
                    }
                }
                
                if (!orderData.order_id || orderData.order_id === 'undefined' || orderData.order_id === 'null') {
                    // Try to find ANY field that might contain an ID as a last resort
                    const idFields = Object.entries(data.next_order).filter(([key, value]) => 
                        (key.toLowerCase().includes('id') || key === '_id') && 
                        value && 
                        typeof value !== 'object');
                
                    if (idFields.length > 0) {
                        // Sort by likelihood of being a valid order ID
                        idFields.sort(([keyA], [keyB]) => {
                            const aHasOrder = keyA.toLowerCase().includes('order') ? -1 : 0;
                            const bHasOrder = keyB.toLowerCase().includes('order') ? -1 : 0;
                            return aHasOrder - bHasOrder;
                        });
                        
                        const [bestKey, bestValue] = idFields[0];
                        orderData.order_id = String(bestValue);
                    } else {
                        // Generate a fallback UUID as last resort
                        const fallbackId = `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
                        orderData.order_id = fallbackId;
                    }
                }
            }
            
            // Final safety check for product_id - absolutely required
            if (!orderData.product_id || orderData.product_id === 'undefined' || orderData.product_id === 'null') {
                showNotification("Error: Invalid product data. Please restart the drive.", "error");
                return;
            }
            
            // Store the current product data for later use
            currentProductData = orderData;
            
            // Track IDs for consistency
            idTracking.addProductId(orderData.product_id, 'fetchNextOrder');
            idTracking.addOrderId(orderData.order_id, 'fetchNextOrder');
            
            if (orderData.premium_status == 0 && orderData.product_image) {
                $('.product-carousel .item img').each(function() {
                    if ($(this).attr('src') === orderData.product_image) {
                        $(this).parent().addClass('highlighted-product');
                        let itemIndex = $(this).parent().index();
                        $('.product-carousel').trigger('to.owl.carousel', [itemIndex, 300]);
                    }
                });
                setTimeout(() => {
                    $('.product-carousel .item').removeClass('highlighted-product');
                }, 3000);
            }
            renderProductCard(orderData);
            refreshWalletBalance();
        } else if (data.success && data.product_id) { // Legacy format support
            // Extract parameters for legacy format
            const legacyOrderData = {
                product_id: data.product_id,
                order_id: data.order_id || data.id || data.drive_order_id || data._id,
                product_name: data.product_name || data.name,
                product_price: data.product_price || data.price || 0,
                product_image: data.product_image || data.image_url,
                product_description: data.product_description || data.description,
                order_commission: data.order_commission || data.commission || 0
            };
            
            // If still no order_id, look for any field that might contain an ID
            if (!legacyOrderData.order_id) {
                for (const [key, value] of Object.entries(data)) {
                    if ((key.toLowerCase().includes('id') || key === '_id') && value && typeof value !== 'object') {
                        legacyOrderData.order_id = value;
                        break;
                    }
                }
                
                // If still no ID, generate a fallback
                if (!legacyOrderData.order_id) {
                    const fallbackId = `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
                    legacyOrderData.order_id = fallbackId;
                }
            }
            
            currentProductData = legacyOrderData;
            
            if (data.premium_status == 0 && data.product_image) {
                $('.product-carousel .item img').each(function() {
                    if ($(this).attr('src') === data.product_image) {
                        $(this).parent().addClass('highlighted-product');
                        let itemIndex = $(this).parent().index();
                        $('.product-carousel').trigger('to.owl.carousel', [itemIndex, 300]);
                    }
                });
                setTimeout(() => {
                    $('.product-carousel .item').removeClass('highlighted-product');
                }, 3000);
            }
            renderProductCard(legacyOrderData);
            refreshWalletBalance();
        } else {
            // Handle error or no order
            
            // Check if this is a "no more orders" message
            if (data.message && data.message.includes("No more pending orders")) {
                checkDriveStatus(token).then(isActive => {
                    if (!isActive) {
                        // displayDriveComplete already called by checkDriveStatus if complete
                    } else {
                        displayDriveError("No pending orders found, but drive still active. Please try again.");
                    }
                });
            }
            else if (data.code === 1 && data.info && data.info.includes('No active drive session')) {
                displayDriveComplete(data.info || 'Your drive session seems to be inactive.', totalDriveCommission);
                if (autoStartButton) autoStartButton.style.display = 'none';
            } else {
                // Check status to be sure
                checkDriveStatus(token).then(isActive => {
                    if (!isActive) {
                        // displayDriveComplete already called by checkDriveStatus if complete
                    } else {
                        displayDriveError(`Error fetching order: ${data.info || data.message || 'Unknown error'}`);
                    }
                });
            }
        }
    })
    .catch(error => {
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        $('.product-carousel').trigger('play.owl.autoplay', [3000]);
        displayDriveError(`Network error fetching order: ${error.message}`);
    });
}

function renderProductCard(productData) {
    if (!productCardContainer) return;
    // Use productData.product_image_url if that's the field name, otherwise productData.product_image
    const imageUrl = productData.product_image_url || productData.product_image || './assets/uploads/images/ph.png';
    let commissionHTML = '';
    if (productData.order_commission !== undefined) {
        commissionHTML = `<p>Commission: <strong>${parseFloat(productData.order_commission).toFixed(2)}</strong> USDT</p>`;
    }

    productCardContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <h4>${productData.product_name || 'Product'}</h4>
                <img src="${imageUrl}" alt="${productData.product_name || 'Product Image'}" style="max-width: 150px; margin: 10px auto; display: block;">
                <p>Price: <strong>${parseFloat(productData.product_price).toFixed(2)}</strong> USDT</p>
                ${commissionHTML}
                <button id="purchase-button" class="btn btn-primary mt-3">Purchase</button>
            </div>
        </div>
    `;
}

async function handlePurchase(token, productData) {
    // Track IDs for consistency
    idTracking.addSessionId(currentDriveSessionId, 'handlePurchase start');
    idTracking.addProductId(productData?.product_id, 'handlePurchase start');
    idTracking.addOrderId(productData?.order_id, 'handlePurchase start');
    
    const purchaseButton = document.getElementById('purchase-button');
    if (purchaseButton) {
        purchaseButton.disabled = true;
        purchaseButton.textContent = 'Processing...';
    }
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';
    
    // Validate required parameters
    const missingParams = [];
    
    if (!currentDriveSessionId) {
        missingParams.push('drive_session_id');
    }
    
    if (!productData || !productData.product_id) {
        missingParams.push('product_id');
    }
    
    if (!productData || !productData.order_id) {
        missingParams.push('drive_order_id');
    }
    
    // If any required parameters are missing, show error and return
    if (missingParams.length > 0) {
        const missingParamsStr = missingParams.join(', ');
        showNotification(`Error: Missing required parameters (${missingParamsStr}). Please restart the drive.`, 'error');
        
        // Reset UI state
        if (purchaseButton) {
            purchaseButton.disabled = false;
            purchaseButton.textContent = 'Purchase';
        }
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        return;
    }
    
    // Prepare the payload
    const payload = {
        drive_session_id: currentDriveSessionId,
        product_id: productData.product_id,
        drive_order_id: productData.order_id,
        quantity_purchased: 1,
        purchase_price: productData.product_price || 0,
        ...(productData.product_number && { product_number: productData.product_number })
    };
    
    // Convert all IDs to strings
    if (typeof payload.drive_session_id !== 'string') {
        payload.drive_session_id = String(payload.drive_session_id || '');
    }
    
    if (typeof payload.drive_order_id !== 'string') {
        payload.drive_order_id = String(payload.drive_order_id || '');
    }
    
    if (typeof payload.product_id !== 'string') {
        payload.product_id = String(payload.product_id || '');
    }
    
    // Additional validation for empty values
    if (!payload.drive_session_id || payload.drive_session_id === 'null' || payload.drive_session_id === 'undefined') {
        // Try to recover from localStorage
        const storedSessionId = localStorage.getItem('current_drive_session_id');
        if (storedSessionId && storedSessionId !== 'null' && storedSessionId !== 'undefined') {
            payload.drive_session_id = storedSessionId;
            currentDriveSessionId = storedSessionId;
        } else {
            showNotification('Invalid session ID. Please restart the drive.', 'error');
            
            // Reset UI elements
            if (purchaseButton) {
                purchaseButton.disabled = false;
                purchaseButton.textContent = 'Purchase';
            }
            if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
            return;
        }
    }
    
    // Validate product price is a valid number
    if (typeof payload.purchase_price !== 'number' || isNaN(payload.purchase_price)) {
        payload.purchase_price = 0;
    }
    
    try {
        // Final safety check for critical parameters
        const criticalParams = ['drive_session_id', 'drive_order_id', 'product_id'];
        for (const param of criticalParams) {
            if (!payload[param] || 
                payload[param] === 'null' || 
                payload[param] === 'undefined' || 
                payload[param] === '[object Object]') {
                
                showNotification(`Error: Invalid ${param.replace('_', ' ')}. Please restart the drive.`, 'error');
                
                if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
                if (purchaseButton) {
                    purchaseButton.disabled = false;
                    purchaseButton.textContent = 'Restart Drive';
                    purchaseButton.onclick = () => {
                        localStorage.removeItem('current_drive_session_id');
                        location.reload();
                    };
                }
                return;
            }
        }
        
        // Make the API request
        const response = await fetch(`${API_BASE_URL}/api/drive/saveorder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        // Handle non-OK responses
        if (!response.ok) {
            const errorText = await response.text();
            
            if (response.status === 500) {
                // Try to sanitize the payload in case there's a backend issue with data format
                try {
                    // Create a sanitized version with simple string values for IDs
                    const sanitizedPayload = {
                        ...payload,
                        drive_session_id: String(payload.drive_session_id || '').trim(),
                        product_id: String(payload.product_id || '').trim(),
                        drive_order_id: String(payload.drive_order_id || '').trim()
                    };
                    
                    showNotification('Server error. Trying with sanitized data...', 'warning');
                    
                    // Create a "sanitized data" card to show what we're sending
                    if (productCardContainer) {
                        productCardContainer.innerHTML = `
                            <div class="card">
                                <div class="card-body">
                                    <h4>Server Error</h4>
                                    <p>There was an error processing your order. The API returned status 500.</p>
                                    <div class="alert alert-info">
                                        <strong>Data being sent:</strong><br>
                                        Session ID: ${sanitizedPayload.drive_session_id}<br>
                                        Product ID: ${sanitizedPayload.product_id}<br>
                                        Order ID: ${sanitizedPayload.drive_order_id}
                                    </div>
                                </div>
                            </div>
                        `;
                        
                        const cardBody = productCardContainer.querySelector('.card-body');
                        
                        // Add a retry button
                        if (cardBody) {
                            const retryBtn = document.createElement('button');
                            retryBtn.className = 'btn btn-primary mt-2';
                            retryBtn.id = 'retry-purchase-button';
                            retryBtn.textContent = 'Retry Purchase';
                            
                            retryBtn.addEventListener('click', () => {
                                if (currentProductData) {
                                    handlePurchase(token, currentProductData);
                                } else {
                                    showNotification('Cannot retry: Product data is missing', 'error');
                                }
                            });
                            
                            cardBody.appendChild(retryBtn);
                        }
                        
                        // Add restart drive button
                        if (cardBody) {
                            const restartBtn = document.createElement('button');
                            restartBtn.className = 'btn btn-danger mt-2 ms-2';
                            restartBtn.id = 'restart-drive-button';
                            restartBtn.textContent = 'Restart Drive';
                            
                            restartBtn.addEventListener('click', () => {
                                localStorage.removeItem('current_drive_session_id');
                                currentDriveSessionId = null;
                                showNotification('Restarting drive...', 'info');
                                
                                // Reset UI
                                if (autoStartButton) {
                                    autoStartButton.style.display = 'block';
                                    autoStartButton.disabled = false;
                                    autoStartButton.querySelector('span').textContent = 'Start';
                                }
                                if (productCardContainer) {
                                    productCardContainer.style.display = 'none';
                                    productCardContainer.innerHTML = '';
                                }
                                
                                // Reload page for a clean state
                                setTimeout(() => {
                                    location.reload();
                                }, 1000);
                            });
                            
                            cardBody.appendChild(restartBtn);
                        }
                    }
                } catch (sanitizeError) {
                    showNotification('Error preparing fixed data. Please restart the drive.', 'error');
                }
                
                // Check drive status after error
                checkDriveStatus(token).then(isActive => {
                    if (!isActive) {
                        showNotification('Drive session is no longer active. Please start a new drive.', 'warning');
                        
                        // Reset UI for new drive
                        if (autoStartButton) {
                            autoStartButton.style.display = 'block';
                            autoStartButton.disabled = false;
                            autoStartButton.querySelector('span').textContent = 'Start';
                        }
                        if (productCardContainer) {
                            productCardContainer.style.display = 'none';
                        }
                    }
                });
            } else {
                showNotification(`Error: ${errorText}`, 'error');
                
                if (purchaseButton) {
                    purchaseButton.disabled = false;
                    purchaseButton.textContent = 'Purchase';
                }
            }
            return;
        }
        
        const data = await response.json();
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        
        if (response.ok && data.code === 0) {
            showNotification(data.message || "Order Sent successfully!", 'success');
            
            // Update session ID if returned in the response
            if (data.drive_session_id) {
                if (data.drive_session_id !== currentDriveSessionId) {
                    currentDriveSessionId = data.drive_session_id;
                    idTracking.addSessionId(data.drive_session_id, 'saveOrder success');
                }
                
                try {
                    localStorage.setItem('current_drive_session_id', data.drive_session_id);
                } catch (e) {
                    // Storage failed, continue anyway
                }
            }
            
            tasksCompleted = data.tasks_completed;
            totalTasksRequired = data.tasks_in_configuration;
            totalDriveCommission = parseFloat(data.total_session_commission);

            updateDriveCommissionDisplay(totalDriveCommission);
            updateProgressBar(tasksCompleted, totalTasksRequired);
            
            refreshWalletBalance();
            
            if (tasksCompleted >= totalTasksRequired) {
                displayDriveComplete('Congratulations! Your data drive is complete.', totalDriveCommission);
            } else {
                fetchNextOrder(token);
            }
        } else if (data.code === 1 && data.message && data.message.includes('already processed')) {
            // Handle duplicate order
            showNotification('This order was already processed. Fetching the next order...', 'info');
            fetchNextOrder(token);
        } else {
            showNotification(data.message || "Error sending order.", 'error');
            
            if (purchaseButton) {
                purchaseButton.disabled = false;
                purchaseButton.textContent = 'Purchase';
            }
        }
    } catch (error) {
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        
        // Error reporting with ID tracking history
        const errorDetails = {
            message: error.message,
            drive_session_id: currentDriveSessionId,
            productData: productData ? {
                product_id: productData.product_id,
                order_id: productData.order_id,
                product_price: productData.product_price
            } : null,
            idHistory: idTracking.getHistory(),
            timestamp: new Date().toISOString()
        };
        
        // Show user-friendly error with recovery options
        if (typeof showNotification === 'function') {
            showNotification(`Error saving order: ${error.message}. Try again or restart the drive.`, 'error');
        } else { 
            alert(`Error saving order: ${error.message}. Try again or restart the drive.`); 
        }
        
        if (purchaseButton) {
            purchaseButton.disabled = false;
            purchaseButton.textContent = 'Purchase';
        }
        
        // Optional: Log error to server for monitoring
        try {
            fetch(`${API_BASE_URL}/api/logging/client-error`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error_type: 'purchase_error',
                    message: error.message,
                    context: JSON.stringify(errorDetails),
                    user_agent: navigator.userAgent
                })
            }).catch(e => {/* Ignore errors logging to server */});
        } catch (logError) {
            // Ignore errors sending the log
        }    }
}

function displayDriveComplete(message, finalCommission) {
    if (!productCardContainer) return;
    let commissionMessage = '';
    if (finalCommission !== undefined) {
        commissionMessage = `<p>Total Commission Earned: <strong>${parseFloat(finalCommission).toFixed(2)}</strong> USDT</p>`;
    }
    productCardContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <h4>Drive Complete!</h4>
                <p>${message}</p>
                ${commissionMessage}
                <button id="start-new-drive-button" class="btn btn-primary mt-3">Start New Drive</button>
            </div>
        </div>
    `;
     document.getElementById('start-new-drive-button').addEventListener('click', () => {
         if (productCardContainer) productCardContainer.innerHTML = ''; // Clear card
         if (productCardContainer) productCardContainer.style.display = 'none'; // Hide card container
         if (autoStartButton) {
             autoStartButton.style.display = 'block';
             autoStartButton.disabled = false;
             autoStartButton.querySelector('span').textContent = 'Start';
         }
         // Clear relevant global state for a new drive
         currentDriveSessionId = null;
         currentDriveConfigurationId = null;
         tasksCompleted = 0;
         totalTasksRequired = 0; // Or a default like 1 to prevent div by zero before new value
         totalDriveCommission = 0;
         updateDriveCommissionDisplay(totalDriveCommission);
         updateProgressBar(tasksCompleted, totalTasksRequired || 1); 
         refreshWalletBalance();
     });
}

function displayFrozenState(message, amountNeeded) {
     if (!productCardContainer) return;
     productCardContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <h4>Drive Frozen</h4>
                <p>${message}</p>
                ${amountNeeded ? `<p>Amount needed to unfreeze: <strong>${parseFloat(amountNeeded).toFixed(2)}</strong> USDT</p>` : ''}
                <p>Please deposit funds to continue or contact support.</p>
                 <button id="contact-support-button" class="btn btn-secondary mt-3">Contact Support</button>
            </div>
        </div>
    `;
     if (autoStartButton) autoStartButton.style.display = 'none';
     refreshWalletBalance();
}

function displayDriveError(message) {
     if (!productCardContainer) return;
     productCardContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <h4>Error</h4>
                <p>${message}</p>
                 <button id="start-new-drive-button" class="btn btn-primary mt-3">Try Starting New Drive</button>
            </div>
        </div>
    `;
     document.getElementById('start-new-drive-button').addEventListener('click', () => {
         if (productCardContainer) productCardContainer.innerHTML = '';
         if (autoStartButton) {
             autoStartButton.style.display = 'block';
             autoStartButton.disabled = false;
             autoStartButton.querySelector('span').textContent = 'Start';
         }
         refreshWalletBalance();
     });
}

// --- Drive Status Check for Persistence ---
async function checkDriveStatus(token) {
    return new Promise(async (resolve, reject) => { // Modified to return a promise
        console.log('checkDriveStatus function called.');
        // Clear any pending animation timeouts
        if (animationTimeout) {
            clearTimeout(animationTimeout);
            animationTimeout = null;
            console.log('Cleared pending animation timeout.');
        }

        if (!token) {
            console.log('checkDriveStatus: No token found, returning.');
            resolve(false); // Resolve promise
            return;
        }
        console.log('Checking drive status with token...');
        try {
            const response = await fetch(`${API_BASE_URL}/api/drive/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok && data.code === 0) {
                console.log('Drive status response received:', data);

                // Ensure global IDs are updated from the status response
                if (data.drive_session_id) {
                    currentDriveSessionId = data.drive_session_id;
                    localStorage.setItem('current_drive_session_id', currentDriveSessionId);
                    idTracking.addSessionId(currentDriveSessionId, 'checkDriveStatus from /api/drive/status');
                }
                if (data.drive_configuration_id) {
                    currentDriveConfigurationId = data.drive_configuration_id;
                }

                console.log('Drive status (after potential ID update):', data.status);

                if (data.status === 'active') {
                    // Global IDs currentDriveSessionId and currentDriveConfigurationId are now set if backend provided them.
                    
                    totalTasksRequired = data.tasks_required || data.tasks_in_configuration || 0;
                    tasksCompleted = data.tasks_completed || 0;
                    totalDriveCommission = parseFloat(data.total_session_commission || data.total_commission || 0);

                    updateDriveCommissionDisplay(totalDriveCommission);
                    updateProgressBar(tasksCompleted, totalTasksRequired);

                    if (autoStartButton) autoStartButton.style.display = 'none';
                    if (productCardContainer) productCardContainer.style.display = 'block';
                    
                    if (data.current_order && data.current_order.product_id) {
                        currentProductData = data.current_order; // Set current product data
                        renderProductCard(data.current_order);
                    } else {
                        // If status is 'active' but no current_order is directly in the status response,
                        // it implies we should fetch the next order.
                        fetchNextOrder(token);
                    }
                    resolve(true); // Active session

                } else if (data.status === 'frozen') {
                    // currentDriveSessionId and currentDriveConfigurationId should be set if available
                    displayFrozenState(data.info || "Session frozen.", data.frozen_amount_needed);
                    // Update UI elements as needed for frozen state
                    if (autoStartButton) autoStartButton.style.display = 'none';
                    if (productCardContainer) productCardContainer.style.display = 'block'; // Or hide, depending on desired UX for frozen
                    updateDriveCommissionDisplay(data.total_session_commission || data.total_commission || 0);
                    updateProgressBar(data.tasks_completed || 0, data.tasks_required || data.tasks_in_configuration || 0);
                    resolve(true); // Session exists (frozen)
                } else if (data.status === 'complete') {
                    displayDriveComplete(data.info || 'Your data drive is complete.', data.total_session_commission || data.total_commission || 0);
                    // Clear session-specific globals if drive is fully complete and reset
                    // currentDriveSessionId = null; // Or handled by starting a new drive
                    // currentDriveConfigurationId = null;
                    localStorage.removeItem('current_drive_session_id'); // Clear stored session ID
                    resolve(false); // Session not active
                } else if (data.status === 'no_session') {
                    if (autoStartButton) autoStartButton.style.display = 'block';
                    if (productCardContainer) productCardContainer.style.display = 'none';
                    updateDriveCommissionDisplay(0);
                    updateProgressBar(0, 1); // Reset progress
                    currentDriveSessionId = null; // Clear IDs
                    currentDriveConfigurationId = null;
                    localStorage.removeItem('current_drive_session_id');
                    resolve(false); // No active session
                } else {
                    // Unexpected status
                    console.warn('checkDriveStatus: Received unexpected status:', data.status, 'with data:', data);
                    if (autoStartButton) autoStartButton.style.display = 'block'; // Default to showing start button
                    if (productCardContainer) productCardContainer.style.display = 'none';
                    resolve(false); // Unexpected
                }
            } else {
                console.error('checkDriveStatus: Failed to check drive status:', data ? (data.info || data.message || 'Unknown API error') : `HTTP error ${response.status}`);
                if (autoStartButton) autoStartButton.style.display = 'block';
                if (productCardContainer) productCardContainer.style.display = 'none';
                currentDriveSessionId = null; // Clear IDs on error
                currentDriveConfigurationId = null;
                localStorage.removeItem('current_drive_session_id');
                resolve(false); // Error
            }
        } catch (error) {
            console.error('checkDriveStatus: Error during fetch or processing:', error);
            if (autoStartButton) autoStartButton.style.display = 'block';
            if (productCardContainer) productCardContainer.style.display = 'none';
            currentDriveSessionId = null; // Clear IDs on error
            currentDriveConfigurationId = null;
            localStorage.removeItem('current_drive_session_id');
            resolve(false); // Error
        }
    });
}
