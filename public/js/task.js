// Ensure API_BASE_URL and showNotification are available (assuming from main.js)
// If not, define them here or ensure main.js is loaded first.

// --- Global Variables ---
var oid = null; // Will be set by startDrive response if needed (using session ID?) // This seems unused, consider removing.
let totalTasksRequired = 0; // Variable to store the total number of tasks required (now Task Sets)
let tasksCompleted = 0; // Track the number of completed tasks (now Task Sets)
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

  // Initialize progress bars with default values (will be updated by checkDriveStatus)
  updateProgressBar(0, 45); // Default to 0/45

  // Initial balance fetch
  refreshWalletBalance();

  // --- Event Listeners ---
  // Attach listener for the Start button
  if (autoStartButton) {
      console.log("Found #autoStart button, attaching listener.");
      autoStartButton.addEventListener('click', () => {
          console.log("#autoStart button clicked.");
          if (!isStartingDrive) { // Only start if not already in the process
              isStartingDrive = true; // Set flag
              startDriveProcess(token);
          } else {
              console.log("Start Drive button clicked, but process is already starting.");
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
              console.log("#purchase-button clicked.");
              if (currentProductData) {
                  handlePurchase(token, currentProductData); // Pass token and current product data
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
    if (autoStartButton) autoStartButton.querySelector('span').textContent = 'Starting in ' + countDown + '...';
    $('.product-carousel .item img').css({
        'transform': 'scale(' + (1 + Math.random() * 0.2) + ')',
        'transition': 'transform 0.5s ease'
    });
    $('.product-carousel').trigger('next.owl.carousel', [300]);
    if (countDown <= 1) {
        console.log("Countdown complete, calling API");
        $('.product-carousel').trigger('stop.owl.autoplay');
        $('.product-carousel').trigger('play.owl.autoplay', [3000]);
        callStartDriveAPI(token);
        return;
    }
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
    // No specific UI change for is_combo for now, but it's available in productData.is_combo
    productCardContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <h4>${productData.product_name || 'Product'} ${productData.is_combo ? '<span class="badge bg-info text-dark">Combo Item</span>' : ''}</h4>
                <img src="${productData.product_image || './assets/uploads/images/ph.png'}" alt="${productData.product_name || 'Product Image'}" style="max-width: 150px; margin: 10px auto; display: block;">
                <p>Price: <strong>${parseFloat(productData.product_price).toFixed(2)}</strong> USDT</p>
                <p>Commission for this item: <strong>${parseFloat(productData.order_commission).toFixed(2)}</strong> USDT</p>
                <button id="purchase-button" class="btn btn-primary mt-3">Purchase</button>
            </div>
        </div>
    `;
}

async function handlePurchase(token, productData) {
    console.log('Purchase button clicked for product (now using user_active_drive_item_id):', productData.user_active_drive_item_id);
    const purchaseButton = document.getElementById('purchase-button');
    if (purchaseButton) {
        purchaseButton.disabled = true;
        purchaseButton.textContent = 'Processing...';
    }
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';
    
    // Create the request payload - simplified to only user_active_drive_item_id
    const payload = {
        user_active_drive_item_id: productData.user_active_drive_item_id 
    };
    console.log('Sending payload to saveorder:', payload);
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
            refreshWalletBalance();

            // Backend now sends next_order or completion status
            if (data.next_order) {
                currentProductData = data.next_order;
                renderProductCard(data.next_order);
                if (purchaseButton) {
                    purchaseButton.disabled = false;
                    purchaseButton.textContent = 'Purchase';
                }
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

function displayDriveComplete(message) {
    if (!productCardContainer) return;
    productCardContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <h4>Drive Complete!</h4>
                <p>${message}</p>
                <button id="start-new-drive-button" class="btn btn-primary mt-3">Start New Drive</button>
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
         // Save the commission data from this drive in case we want to display a history
         const commissionData = getCurrentSessionData();
         if (commissionData) {
             const driveHistory = JSON.parse(localStorage.getItem('drive_history') || '[]');
             driveHistory.push({
                 completedAt: new Date().toISOString(),
                 totalCommission: commissionData.totalCommission,
                 sessionTimestamp: commissionData.sessionTimestamp
             });
             localStorage.setItem('drive_history', JSON.stringify(driveHistory));
         }
         
         // Clear session data for the next drive
         clearSessionData();
         totalDriveCommission = 0;
         updateDriveCommission();
         
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

// --- Helper to update progress bar ---
function updateProgressBar(completed, total) {
  console.log(`Updating progress bars: ${completed}/${total}`);
  
  // Store globally for reference
  tasksCompleted = completed;
  totalTasksRequired = total;
  
  if (!total) total = 1; // Avoid division by zero
  const percentage = Math.min(Math.round((completed / total) * 100), 100);
  
  // Update main progress bar at the top
  if (driveProgressBar) {
    driveProgressBar.style.width = percentage + '%';
    driveProgressBar.setAttribute('aria-valuenow', percentage);
    driveProgressBar.textContent = percentage + '%';
    
    // Add flash animation to highlight the update
    driveProgressBar.classList.add('progress-flash');
    setTimeout(() => {
      driveProgressBar.classList.remove('progress-flash');
    }, 700);
  }
  
  // Update progress text
  if (progressTextElement) {
    progressTextElement.textContent = `${completed} / ${total} tasks completed`;
  }
  
  // Update the tasks count display
  if (tasksProgressElement) {
    tasksProgressElement.textContent = `(${completed} / ${total})`;
  }
  
  // Update the small tasks progress bar
  if (tasksProgressBar) {
    tasksProgressBar.style.width = percentage + '%';
    tasksProgressBar.setAttribute('aria-valuenow', percentage);
    tasksProgressBar.textContent = percentage + '%';
  }
}

// --- Commission Tracking ---
/**
 * Updates the displayed commission earned in the current drive.
 * totalDriveCommission global variable should be updated before calling this.
 */
function updateDriveCommission() { // Removed 'commission' parameter
  // totalDriveCommission is assumed to be updated globally before this call
  
  // Persist the current totalDriveCommission to localStorage
  // Ensure sessionTimestamp is handled consistently if it's important for session identification
  saveCurrentSessionData({
    totalCommission: totalDriveCommission,
    sessionTimestamp: getCurrentSessionData()?.sessionTimestamp || new Date().getTime() // Preserve existing or set new
  });
  
  if (driveCommissionElement) {
    driveCommissionElement.innerHTML = `${totalDriveCommission.toFixed(2)}<small style="font-size:14px"> USDT</small>`;
    
    // Add a brief highlight effect
    driveCommissionElement.classList.add('highlight-green');
    setTimeout(() => {
      driveCommissionElement.classList.remove('highlight-green');
    }, 1500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        refreshWalletBalance();
    }
});
