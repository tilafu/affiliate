// *** DEBUGGING MODE - 401 REDIRECTS DISABLED ***
// - All 401 error redirects have been completely removed from task.js
// - 401 errors are only logged to console with detailed debug information
// - Users will NOT be automatically logged out on 401 errors from task.js
// - Redirects will be restored after identifying the root cause
// *** END DEBUG NOTE ***

console.log('TASK.JS LOADING - CHECK FOR DUPLICATES', new Date().getTime());

// Ensure API_BASE_URL and showNotification are available (assuming from main.js)
// If not, define them here or ensure main.js is loaded first.
if (typeof API_BASE_URL === 'undefined') {
    console.error('API_BASE_URL is not defined! Make sure main.js is loaded first.');
    window.API_BASE_URL = 'http://localhost:3000'; // Fallback
}

// --- Global Variables (Unlimited Task Sets Design) ---
var oid = null; // Will be set by startDrive response if needed (using session ID?) // This seems unused, consider removing.
let totalTasksRequired = 0; // Variable to store the total number of products across all task sets (unlimited design)
let tasksCompleted = 0; // Track the current product step being worked on (unlimited design)
let totalDriveCommission = 0; // Track total commission earned in this drive
let isStartingDrive = false; // Flag to prevent unintentional start drive calls

// --- Modal State Variables ---
window.selectedAction = 'buy'; // Default modal action state

// --- UI Element References ---
window.taskPageElements = window.taskPageElements || {
    autoStartButton: null,
    productCardContainer: null, // New container for the dynamic product card
    walletBalanceElement: null,
    driveCommissionElement: null, // Element to display commission earned in this drive
    tasksProgressElement: null, // Element to display tasks completed/required
    driveProgressBar: null, // Main progress bar at the top
    progressTextElement: null, // Text showing progress count
    tasksProgressBar: null, // Small progress bar in tasks card
    progressSection: null, // Progress section container
    orderLoadingOverlay: null // Reference to the new loading overlay
};

// --- Drive State Variables ---
let currentProductData = null; // Store data of the currently displayed product

// --- Drive Animation/Start Logic ---
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
  window.taskPageElements.searchButton = document.getElementById('show-product-modal-btn');
  window.taskPageElements.productCardContainer = document.getElementById('product-card-container'); // Get reference to the new container
  window.taskPageElements.walletBalanceElement = document.querySelector('.datadrive-balance');  // Select the balance element directly
  window.taskPageElements.driveCommissionElement = document.querySelector('.datadrive-commission'); // Element for drive commission
  window.taskPageElements.tasksProgressElement = document.getElementById('tasks-count'); // Element displaying tasks completed/required
  window.taskPageElements.tasksProgressBar = document.getElementById('tasks-progress-bar'); // Progress bar element for tasks card
  window.taskPageElements.driveProgressBar = document.getElementById('drive-progress-bar'); // Main progress bar at the top
  window.taskPageElements.progressTextElement = document.getElementById('progress-text'); // Text element for progress 
  window.taskPageElements.progressSection = document.getElementById('progress-section'); // Progress section container
  window.taskPageElements.orderLoadingOverlay = document.getElementById('order-loading-overlay'); // Get reference to the loading overlay
  // Debug: Check if elements are found
  console.log('Element references:', {
    autoStartButton: !!window.taskPageElements.autoStartButton,
    productCardContainer: !!window.taskPageElements.productCardContainer,
    walletBalanceElement: !!window.taskPageElements.walletBalanceElement,
    driveCommissionElement: !!window.taskPageElements.driveCommissionElement,
    tasksProgressElement: !!window.taskPageElements.tasksProgressElement,
    tasksProgressBar: !!window.taskPageElements.tasksProgressBar,
    driveProgressBar: !!window.taskPageElements.driveProgressBar,
    progressTextElement: !!window.taskPageElements.progressTextElement,
    progressSection: !!window.taskPageElements.progressSection,
    orderLoadingOverlay: !!window.taskPageElements.orderLoadingOverlay
  });
  
  // Additional debug for tasks-count element specifically
  console.log('Tasks count element details:', {
    found: !!window.taskPageElements.tasksProgressElement,
    id: window.taskPageElements.tasksProgressElement?.id,
    currentText: window.taskPageElements.tasksProgressElement?.textContent,
    innerHTML: window.taskPageElements.tasksProgressElement?.innerHTML
  });  // Initial UI state: Hide elements by default, will be shown based on drive status
  if (window.taskPageElements.productCardContainer) window.taskPageElements.productCardContainer.style.display = 'none';
  if (window.taskPageElements.orderLoadingOverlay) window.taskPageElements.orderLoadingOverlay.style.display = 'none';
    // Try to restore session data from localStorage first
  const savedSessionData = getCurrentSessionData();
  if (savedSessionData) {
    console.log('Restoring session data from localStorage:', savedSessionData);
    totalDriveCommission = savedSessionData.totalCommission || 0;
    tasksCompleted = savedSessionData.tasksCompleted || 0;
    totalTasksRequired = savedSessionData.totalTasksRequired || 0;
    console.log('Values after restoration:', { totalDriveCommission, tasksCompleted, totalTasksRequired });
  } else {
    console.log('No saved session data found, initializing with defaults');
    totalDriveCommission = 0;
    tasksCompleted = 0;
    totalTasksRequired = 0;
    console.log('Values after default initialization:', { totalDriveCommission, tasksCompleted, totalTasksRequired });
  }
  
  // Initialize progress bars with restored or default values (delayed to allow components to load)
  setTimeout(() => {
    updateProgressBar(tasksCompleted, totalTasksRequired);
  }, 200);
  
  // Initialize commission display with restored value
  updateDriveCommission();
  
  // Initial balance fetch
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
  
  // Set up periodic frozen account check (every 60 seconds) - more frequent than regular refresh
  setInterval(() => {
      if (globalAuthData && globalAuthData.token) {
          // Check if account is frozen and can be unfrozen
          checkFrozenAccountStatus(globalAuthData.token);
      }
  }, 60000); // 60 seconds
  
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
  
  // We'll rely on event delegation for the search button in initializeModalEventDelegation() instead
  console.log("Using event delegation for the search button via initializeModalEventDelegation()");

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
  if (window.taskPageElements.productCardContainer) {
      window.taskPageElements.productCardContainer.addEventListener('click', function(event) {
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

  // Initialize modal event handlers for drive product modal
  initializeModalEventHandlers();
  
  // Initialize modern modal event delegation for search button and modal controls
  initializeModalEventDelegation();
  console.log("Drive product modal functionality enabled");

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
    if (!balanceElement) {
        console.warn('Balance element not found');
        return;
    }
    
    // Find the balance label (the div containing "Wallet balance" text)
    const balanceContainer = balanceElement.closest('.col-md-6');
    const balanceLabel = balanceContainer ? balanceContainer.querySelector('.profile-label') : null;    // First check drive status to see if account is frozen
    fetch(`${API_BASE_URL}/api/drive/status`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    })
    .then(response => response.json())
    .then(statusData => {        const isFrozen = statusData.success && statusData.status === 'frozen';
        const frozenAmountNeeded = statusData.frozen_amount_needed ? parseFloat(statusData.frozen_amount_needed) : 0;
          if (isFrozen) {
            // Use the modern dashboard modal instead of Bootstrap modal
            if (typeof window.displayFrozenState === 'function') {
                const message = statusData.info || "Drive frozen due to insufficient balance. Please deposit funds to continue.";
                const tasksCompleted = statusData.all_tasks_completed || '0 of 0';
                const totalCommission = statusData.total_commission || '0.00';
                
                console.log('Using dashboard modal for frozen state');
                window.displayFrozenState(message, frozenAmountNeeded, tasksCompleted, totalCommission);
            } else {
                // Fallback to Bootstrap modal if dashboard modal not available
                console.warn('Dashboard modal not available, using Bootstrap fallback');
                const frozenModalElement = document.getElementById('frozenAccountModal');
                if (frozenModalElement) {
                    const frozenModal = bootstrap.Modal.getOrCreateInstance(frozenModalElement);
                    
                    // Update modal with current frozen amount needed
                    const modalAmountNeeded = document.getElementById('modal-amount-needed');
                    if (modalAmountNeeded && frozenAmountNeeded > 0) {
                        modalAmountNeeded.textContent = `$${frozenAmountNeeded.toFixed(2)} USDT`;
                    } else if (modalAmountNeeded) {
                        modalAmountNeeded.textContent = 'Contact Support';
                    }
                    
                    frozenModal.show();
                }
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
                
                // Update modal balance display
                const modalCurrentBalance = document.getElementById('modal-current-balance');
                if (modalCurrentBalance) {
                    modalCurrentBalance.textContent = `$${mainBalance.toFixed(2)} USDT`;
                }
                
                // Check if user has sufficient balance to unfreeze automatically
                if (isFrozen && frozenAmountNeeded > 0 && mainBalance >= frozenAmountNeeded) {
                    // Attempt automatic unfreeze since user now has sufficient balance
                    attemptAutoUnfreeze(token, mainBalance, frozenAmountNeeded);
                }
                
                if (isFrozen && frozenBalance > 0) {
                    // Show frozen balance when account is frozen
                    if (balanceLabel) {
                        balanceLabel.textContent = 'Frozen Balance';
                        balanceLabel.style.color = '#dc3545'; // Red color to indicate frozen
                    }
                    balanceElement.innerHTML = `${frozenBalance.toFixed(2)} <small>USDT</small>`;
                    balanceElement.style.color = '#dc3545'; // Red color for frozen balance
                    balanceElement.title = `Your balance of ${frozenBalance.toFixed(2)} USDT is currently frozen. Please deposit funds to continue.`;
                } else {
                    // Show normal wallet balance
                    if (balanceLabel) {
                        balanceLabel.textContent = 'Wallet balance';
                        balanceLabel.style.color = ''; // Reset color
                    }
                    balanceElement.innerHTML = `${mainBalance.toFixed(2)} <small>USDT</small>`;
                    balanceElement.style.color = ''; // Reset color
                    balanceElement.title = ''; // Clear title
                }} else {
                console.error('Failed to fetch balance:', data.message);
                if (typeof showNotification === 'function') {
                    showNotification(`Failed to fetch balance: ${data.message}`, 'error');
                }
                balanceElement.innerHTML = 'Error';
                balanceElement.style.color = '#dc3545'; // Red color for error
            }
        })
        .catch(error => {
            console.error('Error fetching balance:', error);
            if (typeof showNotification === 'function') {
                showNotification(`Error fetching balance: ${error.message}`, 'error');
            }
            balanceElement.innerHTML = 'Error';
            balanceElement.style.color = '#dc3545'; // Red color for error
        });
    })
    .catch(error => {
        console.error('Error checking drive status:', error);
        if (typeof showNotification === 'function') {
            showNotification(`Error checking drive status: ${error.message}`, 'error');
        }
        balanceElement.innerHTML = 'Error';
        balanceElement.style.color = '#dc3545'; // Red color for error
    });
}

// --- Helper to safely update wallet balance everywhere ---
function refreshWalletBalance() {
    if (globalAuthData && globalAuthData.token) {
        // Check if the balance element exists before trying to fetch balance
        const balanceElement = document.querySelector('.datadrive-balance');
        if (balanceElement) {
            fetchBalance(globalAuthData.token);
        } else {
            console.warn('Balance element not found, skipping balance refresh');
        }
    }
}

// --- Enhanced Balance Refresh with Retry Logic ---
async function refreshWalletBalanceWithRetry(maxRetries = 3, delay = 1000) {
    console.log(`Starting enhanced balance refresh with ${maxRetries} retries...`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Balance refresh attempt ${attempt}/${maxRetries}`);
            
            if (globalAuthData && globalAuthData.token) {
                const balanceElement = document.querySelector('.datadrive-balance');
                if (balanceElement) {
                    // Call the existing fetchBalance function
                    await fetchBalanceAsync(globalAuthData.token);
                    console.log(`Balance refresh attempt ${attempt} completed successfully`);
                    return true; // Success
                } else {
                    console.warn('Balance element not found during enhanced refresh');
                }
            } else {
                console.warn('No auth data available for enhanced balance refresh');
            }
        } catch (error) {
            console.error(`Balance refresh attempt ${attempt} failed:`, error);
            
            if (attempt < maxRetries) {
                console.log(`Waiting ${delay}ms before next attempt...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    console.warn(`All ${maxRetries} balance refresh attempts failed`);
    return false;
}

// --- Async version of fetchBalance for better control ---
async function fetchBalanceAsync(token) {
    if (!token) return;

    const balanceElement = document.querySelector('.datadrive-balance');
    if (!balanceElement) {
        console.warn('Balance element not found');
        return;
    }
    
    try {
        // First check drive status to see if account is frozen
        const statusResponse = await fetch(`${API_BASE_URL}/api/drive/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        
        const statusData = await statusResponse.json();
        const isFrozen = statusData.success && statusData.status === 'frozen';
        const frozenAmountNeeded = statusData.frozen_amount_needed ? parseFloat(statusData.frozen_amount_needed) : 0;
        
        // Then fetch balances
        const response = await fetch(`${API_BASE_URL}/api/user/balances`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success && data.balances) {
            const mainBalance = parseFloat(data.balances.main_balance || 0);
            const frozenBalance = parseFloat(data.balances.frozen_balance || 0);
            
            console.log('Balance updated:', { mainBalance, frozenBalance, isFrozen });
            
            // Update modal balance display if modal is open
            const modalCurrentBalance = document.getElementById('modal-current-balance');
            if (modalCurrentBalance) {
                modalCurrentBalance.textContent = `$${mainBalance.toFixed(2)} USDT`;
            }
            
            // Check if user has sufficient balance to unfreeze automatically
            if (isFrozen && frozenAmountNeeded > 0 && mainBalance >= frozenAmountNeeded) {
                console.log('User has sufficient balance to unfreeze, attempting auto-unfreeze...');
                // Could add auto-unfreeze logic here if needed
            }
            
            if (isFrozen && frozenBalance > 0) {
                // Show frozen balance when account is frozen
                balanceElement.innerHTML = `${frozenBalance.toFixed(2)} <small>USDT</small>`;
                balanceElement.style.color = '#dc3545'; // Red color for frozen balance
                balanceElement.title = `Your balance of ${frozenBalance.toFixed(2)} USDT is currently frozen. Please deposit funds to continue.`;
            } else {
                // Show normal wallet balance
                balanceElement.innerHTML = `${mainBalance.toFixed(2)} <small>USDT</small>`;
                balanceElement.style.color = ''; // Reset color
                balanceElement.title = ''; // Clear title
            }
        } else {
            console.error('Failed to fetch balance:', data.message);
            balanceElement.innerHTML = 'Error';
            balanceElement.style.color = '#dc3545'; // Red color for error
        }
    } catch (error) {
        console.error('Error in fetchBalanceAsync:', error);
        balanceElement.innerHTML = 'Error';
        balanceElement.style.color = '#dc3545'; // Red color for error
        throw error; // Re-throw for retry logic
    }
}

// --- Update Progress Bar Function (Unlimited Task Sets Design) ---
function updateProgressBar(currentStep, totalProducts) {
    // Get DOM elements for legacy support using global variables where available
    const progressBar = document.getElementById('drive-progress-bar');
    const progressText = document.getElementById('progress-text');
    // Use global tasksProgressElement and tasksProgressBar variables instead of creating new const
    
    // Ensure we have valid numbers
    const completed = Math.max(0, parseInt(currentStep) || 0);
    const total = Math.max(0, parseInt(totalProducts) || 0);
    
    // Calculate percentage for legacy progress bar
    const percentage = total > 0 ? Math.min(100, Math.max(0, (completed / total) * 100)) : 0;
    
    // Show progress section if we have data - use multiple approaches to ensure visibility
    const progressSection = window.taskPageElements?.progressSection;
    if (progressSection && total > 0) {
        progressSection.style.display = 'block';
        progressSection.style.visibility = 'visible';
        progressSection.style.opacity = '1';
        progressSection.classList.add('show');
        progressSection.classList.remove('d-none');
    }
    
    // Update main drive progress bar (if exists)
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', percentage);
        progressBar.textContent = `${Math.round(percentage)}%`;
    }
    
    // Update tasks progress bar (if exists) - use global reference
    const tasksProgressBar = window.taskPageElements?.tasksProgressBar;
    if (window.taskPageElements.tasksProgressBar) {
        window.taskPageElements.tasksProgressBar.style.width = `${percentage}%`;
        window.taskPageElements.tasksProgressBar.setAttribute('aria-valuenow', percentage);
    }
    
    // Update progress text (if exists)
    if (progressText) {
        progressText.textContent = `${completed} / ${total} tasks completed`;
    }
    
    // Update tasks count (if exists) - use global reference
    const tasksProgressElement = window.taskPageElements?.tasksProgressElement;
    if (tasksProgressElement) {
        tasksProgressElement.textContent = `${completed} / ${total}`;
    }
    
    // Update global variables
    tasksCompleted = completed;
    totalTasksRequired = total;
    saveCurrentSessionData();
    
    console.log(`Drive Progress updated: ${completed}/${total} tasks (${percentage.toFixed(1)}%)`);
}

// --- Update Drive Commission Function ---
function updateDriveCommission() {
    // Update the commission display element
    if (window.taskPageElements.driveCommissionElement) {
        const commissionValue = (totalDriveCommission || 0).toFixed(2);
        window.taskPageElements.driveCommissionElement.innerHTML = `${commissionValue}<small style="font-size:14px"> USDT</small>`;
        
        // Add highlight animation when commission updates
        window.taskPageElements.driveCommissionElement.classList.remove('highlight-green');
        setTimeout(() => {
            window.taskPageElements.driveCommissionElement.classList.add('highlight-green');
        }, 10);    }
    
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
    
    // Call API directly without countdown
    callStartDriveAPI(token);
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
    if (window.taskPageElements.orderLoadingOverlay) window.taskPageElements.orderLoadingOverlay.style.display = 'flex';

    setTimeout(() => {
        fetch(`${API_BASE_URL}/api/drive/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
        })
        .then(response => {
            console.log("Start drive API response status:", response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
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
                }            } catch (e) {
                console.error("Error closing loading indicator:", e);
            }
            if (window.taskPageElements.orderLoadingOverlay) window.taskPageElements.orderLoadingOverlay.style.display = 'none';
            if (window.taskPageElements.autoStartButton) {
                window.taskPageElements.autoStartButton.innerHTML = '<i class="fas fa-play me-2"></i>Start';
                window.taskPageElements.autoStartButton.disabled = false;
            }
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

                // Debug: Log the exact data structure received
                console.log("Start drive API success response structure:", {
                    tasks_in_configuration: data.tasks_in_configuration,
                    current_order: data.current_order,
                    hasTasksConfig: data.tasks_in_configuration !== undefined,
                    hasCurrentOrder: !!data.current_order,
                    fullData: data
                });

                // Backend returns tasks_in_configuration (total task sets) and current_order
                if (data.tasks_in_configuration !== undefined && data.current_order) {
                    totalTasksRequired = data.tasks_in_configuration; // Total Task Sets
                    tasksCompleted = 0; // Drive just started

                    totalDriveCommission = 0; // Reset commission for new drive
                    clearSessionData(); // Clear any old session data
                    // saveCurrentSessionData will be called by updateDriveCommission
                    updateDriveCommission(); // Update UI and persist initial commission (0)

                    updateProgressBar(tasksCompleted, totalTasksRequired);

                    currentProductData = data.current_order;
                    // renderProductCard(data.current_order); // DISABLED - Product card rendering turned off
                    
                    // Show product container (no need to hide search button)
                    if (window.taskPageElements.productCardContainer) window.taskPageElements.productCardContainer.style.display = 'none'; // Keep hidden - product card disabled
                } else {
                    console.error("callStartDriveAPI: Missing required fields in successful response", {
                        received: data,
                        missingFields: {
                            tasks_in_configuration: data.tasks_in_configuration === undefined,
                            current_order: !data.current_order
                        }
                    });
                    // Fallback: Try to get the first product through checkDriveStatus
                    console.log("Attempting fallback: checking drive status to get current product");
                    setTimeout(() => {
                        checkDriveStatus(token);
                    }, 1000);
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
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            try {
                 if (loadingMethod === 'layer' && loadingIndicator !== null) {
                    console.log("Closing layer indicator with index:", loadingIndicator);
                    layer.close(loadingIndicator);
                } else if (loadingMethod === 'dialog' && loadingIndicator && typeof loadingIndicator.close === 'function') {
                    console.log("Closing jQuery dialog indicator.");
                    loadingIndicator.close();
                } else {
                     console.log("No specific loading indicator to close or method unknown.");
                }            } catch (e) {
                console.error("Error closing loading indicator on catch:", e);
            }
            if (window.taskPageElements.orderLoadingOverlay) window.taskPageElements.orderLoadingOverlay.style.display = 'none';
            if (window.taskPageElements.autoStartButton) {
                window.taskPageElements.autoStartButton.innerHTML = '<i class="fas fa-play me-2"></i>Start';
                window.taskPageElements.autoStartButton.disabled = false;
            }
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
    if (window.taskPageElements.orderLoadingOverlay) window.taskPageElements.orderLoadingOverlay.style.display = 'flex';
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
        if (window.taskPageElements.orderLoadingOverlay) window.taskPageElements.orderLoadingOverlay.style.display = 'none';
          if (data.code === 2) { // Drive complete
            console.log("Drive complete message received from backend (getorder).");
            displayDriveComplete(data.info || 'Congratulations! Your data drive is complete.');
            if (data.total_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_commission);
                updateDriveCommission();
            }
            
            refreshWalletBalance();        } else if (data.code === 3) { // Drive Frozen
            console.warn("Drive Frozen message received from backend (getorder).");
            displayTaskFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed, data);
            if (data.total_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_commission);
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

            // renderProductCard(data.current_order); // DISABLED - Product card rendering turned off
            console.log("Current order received (getorder):", data.current_order);            
            
            // Update progress from basic status data
            if (data.tasks_completed !== undefined && data.tasks_required !== undefined) {
                tasksCompleted = data.tasks_completed; // Original tasks completed (user-visible)
                totalTasksRequired = data.tasks_required; // Total original tasks (user-visible)
                updateProgressBar(tasksCompleted, totalTasksRequired);
                console.log(`Progress updated from getorder: ${tasksCompleted}/${totalTasksRequired}`);
            }
            
            // Update with detailed progress data for more accurate display (async, non-blocking)
            updateProgressFromDetailedData().then(detailedData => {
                if (detailedData) {
                    console.log('Progress updated with detailed data in fetchNextOrder');
                }
            }).catch(error => {
                console.warn('Could not fetch detailed progress in fetchNextOrder:', error.message);
            });
            
            // Update commission data
            if (data.total_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_commission);
                updateDriveCommission();
            } else if (data.total_session_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_session_commission);
                updateDriveCommission();
            }
            refreshWalletBalance();        } else {
            // Enhanced error logging for unknown errors
            if (!data.info && !data.message) {
                console.error('Error fetching next order (getorder): FULL RESPONSE:', data);
            }
            const errorMsg = data.info || data.message || 'Unknown error - no error message provided';
            console.error('Error fetching next order (getorder):', errorMsg);
            if (data.code === 1) { // No active session / Drive not started
                displayDriveError(data.info || data.message || 'Your drive session has not started or is complete. Please start a new drive.');
                if (window.taskPageElements.autoStartButton) window.taskPageElements.autoStartButton.style.display = 'block';
                if (window.taskPageElements.productCardContainer) window.taskPageElements.productCardContainer.style.display = 'none';
                 totalDriveCommission = 0;
                 updateDriveCommission();
                 updateProgressBar(0, totalTasksRequired || 0); // Reset progress bar
            } else {
                displayDriveError(`Error fetching order: ${errorMsg}`);
            }
        }
    })
    .catch(error => {
        if (window.taskPageElements.orderLoadingOverlay) window.taskPageElements.orderLoadingOverlay.style.display = 'none';
        $('.product-carousel').trigger('play.owl.autoplay', [3000]);
        console.error('Error fetching next order:', error);
        displayDriveError(`Network error fetching order: ${error.message}`);
    });
}

// renderProductCard function removed - product card rendering disabled

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
    if (window.taskPageElements.orderLoadingOverlay) window.taskPageElements.orderLoadingOverlay.style.display = 'flex';
    
    // Determine product_slot_to_complete
    let determined_slot;
    if (productData.product_slot !== undefined) {
        determined_slot = productData.product_slot;
        console.log('Using productData.product_slot for slot:', determined_slot);
    } else if (productData.is_combo_product === true && productData.combo_product_index !== undefined) {
        // combo_product_index is 1-based from backend, but saveOrder expects 0-based slot index
        determined_slot = productData.combo_product_index - 1;
        console.log('Converting combo_product_index from 1-based to 0-based for slot:', productData.combo_product_index, '->', determined_slot);
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
    };    console.log('Constructed payload for saveorder:', payload);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/drive/saveorder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
          // Check if response is actually JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const responseText = await response.text();
            console.error('Expected JSON but got:', contentType);
            console.error('Response body (first 500 chars):', responseText.substring(0, 500));            // Check if it's an authentication issue
            if (response.status === 401) {
                console.error('=== 401 AUTH ERROR DEBUG (task.js) ===');
                console.error('URL that returned 401:', url);
                console.error('Response status:', response.status);
                console.error('Response statusText:', response.statusText);
                console.error('Content-Type:', contentType);
                console.error('Response body preview:', responseText.substring(0, 500));
                console.error('=== END 401 DEBUG ===');
                
                // REDIRECT REMOVED FOR DEBUGGING - Will be restored after identifying the problem
                if (typeof showNotification === 'function') {
                    showNotification(`task.js: API returned 401 - Check browser console for debug details`, 'error');
                }
                
                throw new Error(`401 Unauthorized from task.js - Check console for debug info`);
            } else if (response.status === 404) {
                throw new Error('API endpoint not found. Check server configuration.');
            } else {
                throw new Error(`Server returned ${response.status} ${response.statusText}. Expected JSON but got ${contentType}.`);
            }
        }

        const data = await response.json();
        if (window.taskPageElements.orderLoadingOverlay) window.taskPageElements.orderLoadingOverlay.style.display = 'none';
        
        if (response.ok && data.code === 0) { // Order processed successfully
            console.log('Order saved successfully (saveorder):', data);
            
            // Update commission and wallet balance from backend response
            if (data.total_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_commission);
                updateDriveCommission();
                console.log(`Commission updated from backend (saveOrder): ${totalDriveCommission} USDT total`);
            } else if (data.total_session_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_session_commission);
                updateDriveCommission();
                console.log(`Commission updated from backend (saveOrder/fallback): ${totalDriveCommission} USDT total`);
            }
            
            // Update wallet balance if provided
            if (data.new_balance !== undefined) {
                console.log(`Wallet balance updated from backend: ${data.new_balance} USDT`);
                // The wallet will be refreshed below, but this logs the immediate update
            }
            
            // Process refund for the purchase amount (commission was already added by backend)
            try {
                console.log(`Processing refund of ${productData.product_price} USDT for product purchase`);
                const refundResponse = await fetch(`${API_BASE_URL}/api/drive/refund`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_active_drive_item_id: productData.user_active_drive_item_id,
                        product_id: productData.product_id,
                        refund_amount: productData.product_price,
                        reason: 'Post-purchase refund as per drive policy'
                    })
                });

                const refundData = await refundResponse.json();
                console.log('Refund response:', refundData);

                if (refundResponse.ok && refundData.success) {
                    console.log(`Refund successful: ${productData.product_price} USDT refunded`);
                    console.log(`Commission flow: Backend handled commission during purchase, refund only returned product price`);
                    
                    // Commission was already updated from saveOrder response above
                    
                    // Update progress immediately after successful purchase
                    console.log('Updating progress immediately after successful purchase...');
                    tasksCompleted += 1; // Increment local progress
                    updateProgressBar(tasksCompleted, totalTasksRequired);
                    
                    // Fetch fresh drive status to get accurate progress and update with detailed data
                    try {
                        await updateDriveStatus();
                        console.log('Drive status updated after successful purchase and refund');
                        
                        // Also update with detailed progress for most accurate display
                        updateProgressFromDetailedData().then(detailedData => {
                            if (detailedData) {
                                console.log('Progress updated with detailed data after purchase');
                            }
                        }).catch(error => {
                            console.warn('Could not fetch detailed progress after purchase:', error.message);
                        });
                    } catch (statusError) {
                        console.warn('Failed to update drive status after purchase:', statusError);
                        // Fallback: progress was already updated locally above
                        updateDriveCommission();
                        updateProgressBar(tasksCompleted, totalTasksRequired);
                    }                    // Refresh wallet balance immediately after successful refund
                    console.log('Refreshing wallet balance after successful refund...');
                    refreshWalletBalanceWithRetry(3, 500); // 3 retries with 500ms delay (no await to avoid syntax issues)
                      // Show purchase success popup instead of notification
                    if (typeof showPurchaseSuccessPopup === 'function') {
                        showPurchaseSuccessPopup(productData.product_name || 'Product', () => {
                            // Continue with next product or complete the drive
                            fetchNextOrder(token);
                        });
                    } else {
                        // Fallback to regular notification if popup function is not available
                        if (typeof showNotification === 'function') {
                            showNotification(`Purchase completed! ${productData.product_price} USDT refunded + ${(productData.order_commission || 0)} USDT commission earned`, 'success');
                        } else { 
                            alert(`Order completed! ${productData.product_price} USDT refunded + ${(productData.order_commission || 0)} USDT commission earned`); 
                        }
                        // Continue to next product after showing notification
                        setTimeout(() => {
                            fetchNextOrder(token);
                        }, 2000);
                    }
                } else {
                    console.warn('Refund failed but purchase was successful:', refundData);
                    
                    // Commission was already updated from saveOrder response above, no need to add again
                    
                    // Update progress immediately after successful purchase
                    console.log('Updating progress immediately after successful purchase (refund failed)...');
                    tasksCompleted += 1; // Increment local progress
                    updateProgressBar(tasksCompleted, totalTasksRequired);
                    
                    // Fetch fresh drive status to get accurate progress and update with detailed data
                    try {
                        await updateDriveStatus();
                        console.log('Drive status updated after successful purchase (refund failed)');
                        
                        // Also update with detailed progress for most accurate display
                        updateProgressFromDetailedData().then(detailedData => {
                            if (detailedData) {
                                console.log('Progress updated with detailed data after purchase (refund failed)');
                            }
                        }).catch(error => {
                            console.warn('Could not fetch detailed progress after purchase:', error.message);
                        });
                    } catch (statusError) {
                        console.warn('Failed to update drive status after purchase:', statusError);
                        // Fallback: progress was already updated locally above
                        updateDriveCommission();
                        updateProgressBar(tasksCompleted, totalTasksRequired);
                    }
                      // Refresh wallet balance even if refund failed (commission should still be added)
                    console.log('Refreshing wallet balance after purchase (refund failed)...');
                        refreshWalletBalance();
                          // Show success popup even if refund fails
                        if (typeof showPurchaseSuccessPopup === 'function') {
                            showPurchaseSuccessPopup(productData.product_name || 'Product', () => {
                                // Continue with next product
                                fetchNextOrder(token);
                            });
                        } else {
                            // Fallback to standard success message if refund fails
                            if (typeof showNotification === 'function') {
                                showNotification(data.info || "Order Sent successfully!", 'success');
                            } else { 
                                alert(data.info || "Order Sent successfully!"); 
                            }
                            // Continue to next product after showing notification
                            setTimeout(() => {
                                fetchNextOrder(token);
                            }, 2000);
                        }
                    }
                } catch (refundError) {
                    console.error('Error processing refund:', refundError);
                    
                    // Commission was already updated from saveOrder response above, no need to add again
                    
                    // Update progress immediately after successful purchase
                    console.log('Updating progress immediately after successful purchase (refund error)...');
                    tasksCompleted += 1; // Increment local progress
                    updateProgressBar(tasksCompleted, totalTasksRequired);
                    
                    // Fetch fresh drive status to get accurate progress and update with detailed data
                    try {
                        await updateDriveStatus();
                        console.log('Drive status updated after successful purchase (refund error)');
                        
                        // Also update with detailed progress for most accurate display
                        updateProgressFromDetailedData().then(detailedData => {
                            if (detailedData) {
                                console.log('Progress updated with detailed data after purchase (refund error)');
                            }
                        }).catch(error => {
                            console.warn('Could not fetch detailed progress after purchase:', error.message);
                        });
                    } catch (statusError) {
                        console.warn('Failed to update drive status after purchase:', statusError);
                        // Fallback: progress was already updated locally above
                        updateDriveCommission();
                        updateProgressBar(tasksCompleted, totalTasksRequired);
                    }
                  // Refresh wallet balance even if refund had an error (commission should still be added by backend)
                console.log('Refreshing wallet balance after purchase (refund error)...');
                refreshWalletBalance();
                  // Show success popup even if refund had an error
                if (typeof showPurchaseSuccessPopup === 'function') {
                    showPurchaseSuccessPopup(productData.product_name || 'Product', () => {
                        // Continue with next product
                        fetchNextOrder(token);
                    });
                } else {
                    // Fallback to standard success message if refund fails
                    if (typeof showNotification === 'function') {
                        showNotification(data.info || "Order Sent successfully!", 'success');
                    } else { 
                        alert(data.info || "Order Sent successfully!"); 
                    }
                    // Continue to next product after showing notification
                    setTimeout(() => {
                        fetchNextOrder(token);
                    }, 2000);
                }
            }
              // Ensure session data is saved before page reload
            console.log('Ensuring session data is saved before page reload...');
            saveCurrentSessionData(); // Explicit save
            
            // Final balance refresh before page reload
            console.log('Final balance refresh before page reload...');
            refreshWalletBalance();
            
            // Log final values before reload
            console.log('Final values before reload:', {
                tasksCompleted,
                totalTasksRequired, 
                totalDriveCommission,
                savedData: getCurrentSessionData()
            });
            
            // Only reload page if popup is not being used
            if (typeof showPurchaseSuccessPopup !== 'function') {
                // Refresh the entire page after a brief delay to show the notification and allow balance update
                console.log('Refreshing entire page after successful purchase...');
                setTimeout(() => {
                    // Additional balance refresh right before reload
                    console.log('Final balance refresh right before reload...');
                    refreshWalletBalance();
                    
                    // Small additional delay to ensure balance update completes
                    setTimeout(() => {                    
                        window.location.reload();
                    }, 500); // Extra 500ms to ensure balance update completes
                }, 2000); // Increased delay to 2 seconds to show refund message and allow processing
            } else {
                console.log('Popup handling flow - skipping automatic page reload');
            }
              // Note: Code below this point won't execute due to page refresh
            // but keeping it for fallback in case reload fails
              } else if (data.code === 3) { // Frozen state
             if (typeof showNotification === 'function') {
                showNotification(data.info || "Session frozen due to insufficient balance.", 'warning');
             } else { alert(data.info || "Session frozen due to insufficient balance."); }
             displayTaskFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed, data);
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
            if (data.code === 0) {
                // Update global variables with fresh server data - use original tasks for user-visible progress
                if (data.tasks_completed !== undefined) {
                    tasksCompleted = data.tasks_completed;
                }
                if (data.tasks_required !== undefined) {
                    totalTasksRequired = data.tasks_required;
                }
                if (data.total_commission !== undefined) {
                    totalDriveCommission = parseFloat(data.total_commission);
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
    if (window.taskPageElements.tasksProgressElement) {
        if (tasksCompleted >= totalTasksRequired) {
            window.taskPageElements.tasksProgressElement.textContent = `(${totalTasksRequired} / ${totalTasksRequired})`;
        } else {
            const currentTask = tasksCompleted + 1;
            window.taskPageElements.tasksProgressElement.textContent = `(${currentTask} / ${totalTasksRequired})`;
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
        window.taskPageElements.driveCommissionElement?.parentElement,
        window.taskPageElements.tasksProgressElement?.parentElement,
        window.taskPageElements.walletBalanceElement?.parentElement
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
/**
 * Update drive status and progress component with fresh data from backend
 * This function fetches the latest drive status and updates all progress displays
 */
async function updateDriveStatus() {
    const token = getAuthToken();
    if (!token) {
        console.warn('updateDriveStatus: No token found');
        throw new Error('No authentication token');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/drive/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('updateDriveStatus: Fresh status received:', data);

        if (data.code === 0) { // Valid status response
            // Update commission
            if (data.total_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_commission);
                console.log('updateDriveStatus: Updated commission:', totalDriveCommission);
            }

            // Update task progress with original task data (user-visible progress)
            if (data.tasks_completed !== undefined && data.tasks_required !== undefined) {
                totalTasksRequired = data.tasks_required;
                tasksCompleted = data.tasks_completed;
                console.log('updateDriveStatus: Updated progress:', tasksCompleted, '/', totalTasksRequired);
            }

            // Update UI components
            updateDriveCommission();
            updateProgressBar(tasksCompleted, totalTasksRequired);

            // Save updated session data
            saveCurrentSessionData();
            
            return data;
        } else {
            throw new Error(`Invalid status response: ${data.info || data.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('updateDriveStatus: Error fetching drive status:', error);
        throw error;
    }
}

function checkDriveStatus(token) {
    console.log('checkDriveStatus function called.');
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
    .then(res => {
        console.log('Drive status response status:', res.status);
        console.log('Drive status response headers:', res.headers);
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        return res.json();
    })
    .then(data => {
        console.log('Drive status response received (/api/drive/status):', data);
        
        if (data.code === 0) { // Indicates a valid status response
            // Load total_commission from backend if available (primary field, with total_session_commission as fallback)
            if (data.total_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_commission);
                console.log('Updated commission from backend (total_commission):', totalDriveCommission);
            } else if (data.total_session_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_session_commission);
                console.log('Updated commission from backend (total_session_commission fallback):', totalDriveCommission);
            } else {
                // Fallback to localStorage if backend doesn't send it
                const sessionData = getCurrentSessionData();
                if (sessionData && sessionData.totalCommission !== undefined) {
                    totalDriveCommission = parseFloat(sessionData.totalCommission);
                    console.log('Using commission from localStorage:', totalDriveCommission);
                } else {
                    console.log('No commission data found, keeping current value:', totalDriveCommission);
                }
            }
            
            // Load task progress from backend if available - use original tasks for user-visible progress
            if (data.tasks_completed !== undefined && data.tasks_required !== undefined) {
                totalTasksRequired = data.tasks_required;
                tasksCompleted = data.tasks_completed;
                console.log('Updated task progress from backend (original tasks):', tasksCompleted, '/', totalTasksRequired);
            } else {
                // Fallback to localStorage if backend doesn't send it
                const sessionData = getCurrentSessionData();
                if (sessionData) {
                    if (sessionData.tasksCompleted !== undefined) tasksCompleted = sessionData.tasksCompleted;
                    if (sessionData.totalTasksRequired !== undefined) totalTasksRequired = sessionData.totalTasksRequired;
                    console.log('Using task progress from localStorage:', tasksCompleted, '/', totalTasksRequired);
                }
            }
            
            // Update UI with current values
            updateDriveCommission(); // Update UI and persist
            updateProgressBar(tasksCompleted, totalTasksRequired); // Show proper progress
            
            // Update with detailed progress data for more accurate display (async, non-blocking)
            updateProgressFromDetailedData().then(detailedData => {
                if (detailedData) {
                    console.log('Progress updated with detailed data from /api/drive/detailed-progress');
                } else {
                    console.log('Using basic progress data from /api/drive/status');
                }
            }).catch(error => {
                console.warn('Could not fetch detailed progress, using basic progress:', error.message);
            });
            
            if (data.status === 'active' && data.current_order) {
                console.log('checkDriveStatus: Active session with current order found. Resuming drive.');
                
                // Clean up any frozen state displays when resuming
                clearFrozenStateDisplay();
                
                if (window.taskPageElements.autoStartButton) window.taskPageElements.autoStartButton.style.display = 'none';
                if (window.taskPageElements.productCardContainer) {
                    window.taskPageElements.productCardContainer.style.display = 'none'; // Keep hidden - product card disabled
                    // renderProductCard(data.current_order); // DISABLED - Product card rendering turned off
                    currentProductData = data.current_order;
                }
                
                // Show progress section for active drive
                if (window.taskPageElements.progressSection) {
                    window.taskPageElements.progressSection.style.display = 'block';
                    window.taskPageElements.progressSection.style.visibility = 'visible';
                    window.taskPageElements.progressSection.style.opacity = '1';
                    window.taskPageElements.progressSection.classList.add('show');
                    window.taskPageElements.progressSection.classList.remove('d-none');
                    console.log('Progress section explicitly shown for active drive');
                }
                
                // Ensure wallet balance is up to date
                refreshWalletBalance();
                
                return true;
            } else if (data.status === 'frozen') {
                console.log('checkDriveStatus: Frozen session found. Displaying frozen state.');
                
                // Extract and set global variables for frozen sessions - use original tasks for user-visible progress
                if (data.tasks_completed !== undefined && data.tasks_required !== undefined) {
                    totalTasksRequired = data.tasks_required;
                    tasksCompleted = data.tasks_completed;
                    updateProgressBar(tasksCompleted, totalTasksRequired);
                }
                
                // Update with detailed progress data for more accurate display
                updateProgressFromDetailedData().catch(error => {
                    console.warn('Could not fetch detailed progress for frozen session:', error.message);
                });
                
                displayTaskFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed, data);
                if (window.taskPageElements.autoStartButton) window.taskPageElements.autoStartButton.style.display = 'none';
                
                // Show progress section for frozen drive
                if (window.taskPageElements.progressSection) {
                    window.taskPageElements.progressSection.style.display = 'block';
                    window.taskPageElements.progressSection.style.visibility = 'visible';
                    window.taskPageElements.progressSection.style.opacity = '1';
                    window.taskPageElements.progressSection.classList.add('show');
                    window.taskPageElements.progressSection.classList.remove('d-none');
                    console.log('Progress section explicitly shown for frozen drive');
                }
                return true;
            } else if (data.status === 'complete') {
                console.log('checkDriveStatus: Drive complete.');
                displayDriveComplete(data.info || 'Drive completed successfully.');
                if (window.taskPageElements.autoStartButton) window.taskPageElements.autoStartButton.style.display = 'none';
                
                // Update with detailed progress data for complete state
                updateProgressFromDetailedData().catch(error => {
                    console.warn('Could not fetch detailed progress for completed drive:', error.message);
                });
                
                // Show progress section for completed drive
                if (window.taskPageElements.progressSection) {
                    window.taskPageElements.progressSection.style.display = 'block';
                    window.taskPageElements.progressSection.style.visibility = 'visible';
                    window.taskPageElements.progressSection.style.opacity = '1';
                    window.taskPageElements.progressSection.classList.add('show');
                    window.taskPageElements.progressSection.classList.remove('d-none');
                    console.log('Progress section explicitly shown for completed drive');
                }
                return true;
            } else if (data.status === 'no_session') {
                console.log('checkDriveStatus: No active session found.');
                if (window.taskPageElements.autoStartButton) window.taskPageElements.autoStartButton.style.display = 'block';
                if (window.taskPageElements.productCardContainer) window.taskPageElements.productCardContainer.style.display = 'none';
                
                // Hide progress section when no session
                if (window.taskPageElements.progressSection) {
                    window.taskPageElements.progressSection.style.display = 'none';
                    window.taskPageElements.progressSection.classList.remove('show');
                    window.taskPageElements.progressSection.classList.add('d-none');
                    console.log('Progress section hidden for no session');
                }
                
                clearSessionData();
                totalDriveCommission = 0; // Reset commission
                tasksCompleted = 0;
                totalTasksRequired = 45; // Default drive requirement
                updateDriveCommission(); // Update UI and persist
                updateProgressBar(tasksCompleted, totalTasksRequired); // Show proper progress
                return false;
            }
        } else {
            // Handle non-zero codes (errors)
            console.warn('checkDriveStatus: API returned error code:', data.code, 'Message:', data.info || data.message);
            
            if (data.code === 3) { // Frozen state
                displayTaskFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed, data);
                if (window.taskPageElements.autoStartButton) window.taskPageElements.autoStartButton.style.display = 'none';
                return true;
            }
        }
        
        // If data.code is not 0, or status is unexpected
        console.warn('checkDriveStatus: Received unexpected status or error code:', data);
        if (window.taskPageElements.autoStartButton) window.taskPageElements.autoStartButton.style.display = 'block';
        if (window.taskPageElements.productCardContainer) window.taskPageElements.productCardContainer.style.display = 'none';
        return false;
    })
    .catch(error => {
        console.error('checkDriveStatus: Error checking drive status:', error);
        
        // Check if it's a 401 authentication error
        if (error.message && error.message.includes('401')) {
            console.error('=== 401 AUTH ERROR DEBUG (checkDriveStatus) ===');
            console.error('URL that returned 401:', `${API_BASE_URL}/api/drive/status`);
            console.error('Token used:', token);
            console.error('Error details:', error.message);
            console.error('=== END 401 DEBUG ===');
            
            // REDIRECT REMOVED FOR DEBUGGING - Will be restored after identifying the problem
            if (typeof showNotification === 'function') {
                showNotification('Authentication error while checking drive status. Check console for details.', 'error');
            }
        }
        
        if (window.taskPageElements.autoStartButton) window.taskPageElements.autoStartButton.style.display = 'block';
        if (window.taskPageElements.productCardContainer) window.taskPageElements.productCardContainer.style.display = 'none';
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
            await checkDriveStatusForRefresh(globalAuthData.token);
            
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
async function checkDriveStatusForRefresh(token) {
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
                // Update commission immediately from response - use total_commission field
                if (data.total_commission !== undefined) {
                    totalDriveCommission = parseFloat(data.total_commission);
                    updateDriveCommission();
                }
                
                // Update progress data - use original tasks for user-visible progress
                if (data.tasks_completed !== undefined && data.tasks_required !== undefined) {
                    tasksCompleted = data.tasks_completed;
                    totalTasksRequired = data.tasks_required;
                    updateProgressBar(tasksCompleted, totalTasksRequired);
                }
                
                // Handle different drive states
                if (data.status === 'active' && data.current_order) {
                    console.log('Drive is active with current order');
                    currentProductData = data.current_order;
                    
                    if (window.taskPageElements.autoStartButton) window.taskPageElements.autoStartButton.style.display = 'none';
                    if (window.taskPageElements.productCardContainer) {
                        window.taskPageElements.productCardContainer.style.display = 'none'; // Keep hidden - product card disabled
                        // renderProductCard(data.current_order); // DISABLED - Product card rendering turned off
                    }
                    
                    clearFrozenStateDisplay(); // Remove any frozen state displays
                      } else if (data.status === 'frozen') {
                    console.log('Drive is frozen');
                    displayTaskFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed, data);
                    if (window.taskPageElements.autoStartButton) window.taskPageElements.autoStartButton.style.display = 'none';
                    
                } else if (data.status === 'complete') {
                    console.log('Drive is complete');
                    displayDriveComplete(data.info || 'Drive completed successfully.');
                    if (window.taskPageElements.autoStartButton) window.taskPageElements.autoStartButton.style.display = 'none';
                      } else if (data.status === 'no_session') {
                    console.log('No active drive session');
                    if (window.taskPageElements.autoStartButton) window.taskPageElements.autoStartButton.style.display = 'block';
                    if (window.taskPageElements.productCardContainer) window.taskPageElements.productCardContainer.style.display = 'none';
                    
                                       
                    
                   
                    // Reset state for no session - use backend-provided drive requirements
                    clearSessionData();
                    totalDriveCommission = 0;
                    tasksCompleted = 0;
                    
                    // Use drive configuration from backend response if available
                    if (data.tasks_required !== undefined) {
                        totalTasksRequired = data.tasks_required;
                        console.log(`Set totalTasksRequired to ${totalTasksRequired} from backend drive configuration`);
                    } else {
                        // Fallback to fetching drive configuration if not provided
                        try {
                            totalTasksRequired = await fetchUserDriveConfiguration(token);
                            console.log(`Set totalTasksRequired to ${totalTasksRequired} from user's drive configuration (fallback)`);
                        } catch (error) {
                            console.error('Error fetching drive config, using default:', error);
                            totalTasksRequired = 45; // Fallback to default
                        }
                    }
                    
                    updateDriveCommission();
                    updateProgressBar(tasksCompleted, totalTasksRequired);
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
                if (data.total_commission !== undefined) {
                    totalDriveCommission = parseFloat(data.total_commission);
                } else if (data.total_session_commission !== undefined) {
                    totalDriveCommission = parseFloat(data.total_session_commission);
                }
                
                // Update progress and commission
                updateProgressBar(tasksCompleted, totalTasksRequired);                updateDriveCommission();
                
                displayTaskFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed, data);
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
    try {        console.log('Checking for existing active drive session...');
        await checkDriveStatusForRefresh(token);
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
            await checkDriveStatusForRefresh(globalAuthData.token);
        }
        
        console.log('Background refresh completed');
    } catch (error) {
        console.error('Background refresh failed:', error);        // Fail silently - don't disrupt user experience
    }
}

// --- Drive State Display Functions ---
function displayDriveComplete(message) {
    console.log('displayDriveComplete called with message:', message);
    
    // Hide the product card and show completion message    if (window.taskPageElements.productCardContainer) window.taskPageElements.productCardContainer.style.display = 'none';
    if (window.taskPageElements.autoStartButton) {
        window.taskPageElements.autoStartButton.style.display = 'block';
        window.taskPageElements.autoStartButton.innerHTML = '<i class="fas fa-play me-2"></i>Start New Drive';
        window.taskPageElements.autoStartButton.disabled = false;
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
    if (window.taskPageElements.autoStartButton) {
        window.taskPageElements.autoStartButton.style.display = 'block';
        window.taskPageElements.autoStartButton.innerHTML = '<i class="fas fa-play me-2"></i>Start';
        window.taskPageElements.autoStartButton.disabled = false;
    }
    if (window.taskPageElements.productCardContainer) window.taskPageElements.productCardContainer.style.display = 'none';
    
    // Show error notification
    if (typeof showNotification === 'function') {
        showNotification(message, 'error');
    } else if (typeof $(document).dialog === 'function') {
        $(document).dialog({infoText: message, autoClose: 4000});
    } else {
        alert(message);
    }
}

function displayTaskFrozenState(message, frozenAmountNeeded, serverData = null) {
    console.log('Task.js displayTaskFrozenState called with message:', message, 'Amount needed:', frozenAmountNeeded, 'Server data:', serverData);
    
    // Hide product card and start button but KEEP progress and commission visible
    if (window.taskPageElements.productCardContainer) window.taskPageElements.productCardContainer.style.display = 'none';
    if (window.taskPageElements.autoStartButton) window.taskPageElements.autoStartButton.style.display = 'none';
    
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
    
    // Prepare formatted data for the dashboard modal
    const tasksCompletedFormatted = totalTasksRequired > 0 
        ? `${tasksCompleted} of ${totalTasksRequired}`
        : '0 of 0';
    const totalCommissionFormatted = totalDriveCommission > 0 
        ? totalDriveCommission.toFixed(2)
        : '0.00';
    
    // Use the modern dashboard modal if available
    if (typeof window.displayFrozenState === 'function') {
        console.log('Using dashboard modal for task frozen state');
        window.displayFrozenState(message, frozenAmountNeeded, tasksCompletedFormatted, totalCommissionFormatted);
    } else {
        // Fallback to notification system if dashboard modal not available
        console.warn('Dashboard modal not available, using notification fallback');
        const frozenMessage = frozenAmountNeeded 
            ? `${message} Please deposit ${parseFloat(frozenAmountNeeded).toFixed(2)} USDT to continue. Progress: ${tasksCompletedFormatted}. Commission: ${totalCommissionFormatted} USDT`
            : `${message} Progress: ${tasksCompletedFormatted}. Commission: ${totalCommissionFormatted} USDT`;
        
        if (typeof showNotification === 'function') {
            showNotification(frozenMessage, 'warning');
        } else if (typeof $(document).dialog === 'function') {
            $(document).dialog({infoText: frozenMessage, autoClose: 8000});
        } else {
            alert(frozenMessage);
        }
        
        // Create fallback card display
        createFrozenStateCard(message, frozenAmountNeeded);
    }
    
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

// --- Auto Unfreeze Function ---
function attemptAutoUnfreeze(token, currentBalance, requiredAmount) {
    console.log(`Attempting auto-unfreeze: Balance ${currentBalance}, Required ${requiredAmount}`);
    
    // Make a request to check if account can be unfrozen
    fetch(`${API_BASE_URL}/api/drive/check-unfreeze`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            current_balance: currentBalance,
            required_amount: requiredAmount
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.unfrozen) {
            // Account was successfully unfrozen
            console.log('Account automatically unfrozen');
            
            // Show success notification
            if (typeof showNotification === 'function') {
                showNotification('Account unfrozen! You can now continue with your drive.', 'success');
            }
              // Hide any frozen modals that might be showing
            // Try to hide Bootstrap modal (legacy fallback)
            const frozenModalElement = document.getElementById('frozenAccountModal');
            if (frozenModalElement) {
                const frozenModal = bootstrap.Modal.getInstance(frozenModalElement);
                if (frozenModal) {
                    frozenModal.hide();
                }
            }
            
            // Try to hide dashboard modal (modern version)
            const dashboardModal = document.getElementById('drive-frozen-modal');
            if (dashboardModal) {
                dashboardModal.remove();
            }
            
            // Refresh the page to update drive status
            setTimeout(() => {
                refreshWalletBalance();
                checkForExistingDrive(token);
            }, 1000);
            
        } else if (data.message) {
            console.log('Auto-unfreeze not possible:', data.message);
        }
    })
    .catch(error => {
        console.error('Error attempting auto-unfreeze:', error);
    });
}

// --- Periodic Frozen Account Check ---
function checkFrozenAccountStatus(token) {
    // Only check if no modal is currently showing to avoid spam
    const frozenModalElement = document.getElementById('frozenAccountModal');
    if (frozenModalElement) {
        const existingModal = bootstrap.Modal.getInstance(frozenModalElement);
        if (existingModal && existingModal._isShown) {
            return; // Modal is already showing, don't check again
        }
    }
    
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
        const frozenAmountNeeded = statusData.frozen_amount_needed ? parseFloat(statusData.frozen_amount_needed) : 0;
        
        if (isFrozen && frozenAmountNeeded > 0) {
            // Check current balance
            fetch(`${API_BASE_URL}/api/user/balances`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            })
            .then(response => response.json())
            .then(balanceData => {
                if (balanceData.success && balanceData.balances) {
                    const mainBalance = parseFloat(balanceData.balances.main_balance || 0);
                    
                    if (mainBalance >= frozenAmountNeeded) {
                        console.log('Account can be auto-unfrozen - attempting...');
                        attemptAutoUnfreeze(token, mainBalance, frozenAmountNeeded);
                    }
                }
            })
            .catch(error => {
                console.error('Error checking balance for auto-unfreeze:', error);
            });
        }
    })
    .catch(error => {
        console.error('Error checking frozen account status:', error);
    });
}

// --- Modal JS Separation: Use custom JS classes for modal actions ---
document.addEventListener('DOMContentLoaded', function() {
    // Open modal
    document.body.addEventListener('click', function(e) {
        if (e.target.closest('.js-modal-open')) {
            openProductModal();
        }
    });
    // Close modal
    document.body.addEventListener('click', function(e) {
        if (e.target.closest('.js-modal-close')) {
            closeProductModal();
        }
    });
    // Purchase from modal
    document.body.addEventListener('click', function(e) {
        if (e.target.closest('.js-modal-purchase')) {
            // The purchase logic is handled in openProductModal, but you can move it here if needed
            // For now, just trigger the click on the original purchase button
            const originalPurchaseBtn = document.getElementById('purchase-button');
            if (originalPurchaseBtn) {
                if (originalPurchaseBtn.onclick) {
                    originalPurchaseBtn.onclick();
                } else if (originalPurchaseBtn.click) {
                    originalPurchaseBtn.click();
                }
            }
            closeProductModal();
        }
    });
    // Close modal on backdrop click
    document.body.addEventListener('click', function(e) {
        if (e.target.classList.contains('product-modal-backdrop')) {
            closeProductModal();
        }
    });
    
    // Close modal on ESC key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const modal = document.getElementById('product-modal');
            if (modal && modal.classList.contains('show')) {
                closeProductModal();
            }
        }
    });
});

// --- Modern Modal Event Delegation ---
function initializeModalEventDelegation() {
  console.log('Initializing modern modal event delegation...');
  
  // Use event delegation on document body to handle all modal-related clicks
  document.body.addEventListener('click', function(event) {
    const target = event.target;
    
    // Handle search button click
    if (target.id === 'show-product-modal-btn' || target.closest('#show-product-modal-btn')) {
      event.preventDefault();
      console.log('Search button clicked, opening product modal');
      openProductModal();
    }
    
    // Handle modal open buttons
    if (target.classList.contains('js-modal-open') || target.closest('.js-modal-open')) {
      event.preventDefault();
      console.log('Modal open triggered via JS class');
      openProductModal();
    }
    
    // Handle modal close buttons
    if (target.classList.contains('js-modal-close') || target.closest('.js-modal-close')) {
      event.preventDefault();
      console.log('Modal close triggered via JS class');
      closeProductModal();
    }
    
    // Handle modal purchase buttons
    if (target.classList.contains('js-modal-purchase') || target.closest('.js-modal-purchase')) {
      event.preventDefault();
      console.log('Modal purchase triggered via JS class');
      
      // Get the original purchase button and trigger its functionality
      const originalPurchaseBtn = document.getElementById('purchase-button');
      if (originalPurchaseBtn) {
        // Apply coupon if entered
        const couponCode = document.getElementById('coupon-code')?.value?.trim();
        if (couponCode) {
          applyCoupon(couponCode);
        }
        
        // Trigger the original purchase logic
        if (currentProductData) {
          handlePurchase(globalAuthData?.token, currentProductData);
        } else {
          console.error("Modal purchase clicked but no current product data available.");
          if (typeof showNotification === 'function') {
            showNotification('Error: No product data to purchase.', 'error');
          } else { 
            alert('Error: No product data to purchase.'); 
          }
        }
        closeProductModal();
      } else {
        console.error('Original purchase button not found');
      }
    }
      // Handle backdrop clicks (close modal)
    if (target.classList.contains('product-modal-backdrop')) {
      event.preventDefault();
      console.log('Modal backdrop clicked - closing modal');
      closeProductModal();
    }
    
    // Handle action buttons in modal
    if (target.classList.contains('action-btn') || target.closest('.action-btn')) {
      event.preventDefault();
      const actionBtn = target.classList.contains('action-btn') ? target : target.closest('.action-btn');
      const action = actionBtn.getAttribute('data-action');
      
      if (action) {
        console.log('Action button clicked:', action);
        
        // Remove active class from all action buttons
        document.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('active'));
        
        // Add active class to clicked button
        actionBtn.classList.add('active');
        
        // Update selected action
        window.selectedAction = action;
        
        // Update total return based on selected action
        updateTotalReturn();
      }
    }
    
    // Handle coupon apply button
    if (target.classList.contains('coupon-apply-btn') || target.closest('.coupon-apply-btn')) {
      event.preventDefault();
      const couponInput = document.getElementById('coupon-code');
      const couponCode = couponInput?.value?.trim();
      
      if (couponCode) {
        console.log('Applying coupon via JS class:', couponCode);
        applyCoupon(couponCode);
      }
    }
  });
  
  // Handle ESC key for modal close
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      const modal = document.getElementById('product-modal');
      if (modal && modal.classList.contains('show')) {
        console.log('ESC key pressed - closing modal');
        closeProductModal();
      }
    }
  });
  
  console.log('Modal event delegation initialized successfully');
}

// Modal  functions - restored for drive product modal
function openProductModal() {
  console.log('Opening drive product modal');
  const modal = document.getElementById('driveProductModal');
  if (modal) {
    modal.style.display = 'flex';
    // Add a slight delay to ensure smooth animation
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);
    
    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';
    
    // Load current product data into modal if available
    if (currentProductData) {
      populateModalWithProductData(currentProductData);
    } else {
      console.warn('No currentProductData available, fetching from API');
      // Get the auth token
      const authToken = globalAuthData?.token;
      if (authToken) {
        fetchProductDataForModal(authToken);
      } else {
        console.error('No auth token available, cannot fetch product data');
        // Display a message in the modal
        const modalContent = document.querySelector('.drive-modal-content');
        if (modalContent) {
          modalContent.innerHTML = '<div class="alert alert-warning">Please log in to view product data</div>';
        }
      }
    }
  } else {
    console.error('Product modal element not found in DOM');
  }
}

function closeProductModal() {
  console.log('Closing drive product modal');
  const modal = document.getElementById('driveProductModal');
  if (modal) {
    modal.classList.remove('show');
    // Wait for animation to complete before hiding
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
    
    // Restore body scrolling
    document.body.style.overflow = '';
  }
}

// Function to fetch product data for modal when no current data is available
async function fetchProductDataForModal(authToken) {
  console.log('Fetching product data for modal from /api/drive/getorder');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/drive/getorder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('fetchProductDataForModal: Response received:', data);

    if (data.code === 0 && data.current_order) {
      // Update the global current product data
      currentProductData = data.current_order;
      
      // Populate the modal with the fetched data
      populateModalWithProductData(data.current_order);
      
      console.log('fetchProductDataForModal: Successfully populated modal with product data');
      return data.current_order;
    } else if (data.code === 2) {
      // Drive complete
      console.log('fetchProductDataForModal: Drive complete - no product to display');
      const modalContent = document.querySelector('.drive-modal .drive-product-info');
      if (modalContent) {
        modalContent.innerHTML = '<div class="alert alert-success">Drive completed! All tasks are finished.</div>';
      }
      return null;
    } else {
      // Error or no data available
      console.warn('fetchProductDataForModal: No product data available, code:', data.code);
      const modalContent = document.querySelector('.drive-modal .drive-product-info');
      if (modalContent) {
        modalContent.innerHTML = '<div class="alert alert-info">No product data available. Please start a drive session first.</div>';
      }
      return null;
    }
  } catch (error) {
    console.error('fetchProductDataForModal: Error fetching product data:', error);
    const modalContent = document.querySelector('.drive-modal .drive-product-info');
    if (modalContent) {
      modalContent.innerHTML = '<div class="alert alert-danger">Error loading product data. Please try again later.</div>';
    }
    return null;
  }
}

// Function to populate modal with current product data
function populateModalWithProductData(productData) {
  console.log('Populating modal with product data:', productData);
  
  // Update product image
  const mainImage = document.getElementById('driveProductMainImage');
  if (mainImage && productData.product_image) {
    mainImage.src = productData.product_image;
    mainImage.alt = productData.product_name || 'Product';
  }
  
  // Update product title
  const title = document.getElementById('driveProductTitle');
  if (title && productData.product_name) {
    title.textContent = productData.product_name;
  }
  
  // Update product description
  const description = document.getElementById('driveProductDescription');
  if (description && productData.product_description) {
    description.textContent = productData.product_description;
  }
  
  // Update purchase price
  const purchasePrice = document.getElementById('drivePurchasePrice');
  if (purchasePrice && productData.product_price) {
    purchasePrice.textContent = `$${productData.product_price} USDT`;
  }
  
  // Update commission
  const commission = document.getElementById('driveCommission');
  if (commission && productData.order_commission) {
    commission.textContent = `+ $${productData.order_commission} USDT`;
  }
  
  // Update net result (purchase price minus commission)
  const netResult = document.getElementById('driveNetResult');
  if (netResult && productData.product_price && productData.order_commission) {
    const net = (parseFloat(productData.product_price) - parseFloat(productData.order_commission)).toFixed(2);
    netResult.textContent = `$${net} USDT`;
  }
  
  // Update confirm button text
  const confirmBtn = document.getElementById('confirmDriveBtn');
  if (confirmBtn && productData.order_commission) {
    confirmBtn.textContent = `Confirm Purchase and Claim $${productData.order_commission}`;
  }
}

// Initialize modal event handlers
function initializeModalEventHandlers() {
  // Handle modal back button
  const backButton = document.getElementById('driveModalBack');
  if (backButton) {
    backButton.addEventListener('click', (e) => {
      e.preventDefault();
      closeProductModal();
    });
  }
  
  // Handle modal backdrop clicks
  const modal = document.getElementById('driveProductModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeProductModal();
      }
    });
  }
  
  // Handle confirm purchase button
  const confirmBtn = document.getElementById('confirmDriveBtn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentProductData && globalAuthData) {
        handlePurchase(globalAuthData.token, currentProductData);
        closeProductModal();
      } else {
        console.error('No product data or auth data available for purchase');
      }
    });
  }
}

// --- Debugging and Testing Utilities ---
// Simple debug logger
function debugLog(message, type = 'log') {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}`;
    
    switch (type) {
        case 'log':
            console.log(formattedMessage);
            break;
        case 'warn':
            console.warn(formattedMessage);
            break;
        case 'error':
            console.error(formattedMessage);
            break;
        case 'info':
            console.info(formattedMessage);
            break;
        default:
            console.log(formattedMessage);
    }
}

// --- Update Progress From Detailed Data Function ---
/**
 * Fetch detailed progress data from the /api/drive/getorder endpoint
 * This provides more accurate task set and combo progress information
 */
async function updateProgressFromDetailedData() {
    const token = getAuthToken();
    if (!token) {
        console.warn('updateProgressFromDetailedData: No token found');
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/drive/getorder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('updateProgressFromDetailedData: Response received:', data);

        if (data.code === 0 && data.current_order) {
            // Update current product data for modal functionality
            currentProductData = data.current_order;
            
            // Update progress data with more detailed information
            if (data.all_tasks_completed !== undefined && data.all_tasks_total !== undefined) {
                // Use the more detailed task progress if available
                console.log('updateProgressFromDetailedData: Using detailed task progress:', data.all_tasks_completed, '/', data.all_tasks_total);
                // Store detailed progress but don't override the main display unless needed
                window.detailedTaskProgress = {
                    completed: data.all_tasks_completed,
                    total: data.all_tasks_total
                };
            }

            // Update commission data
            if (data.total_commission !== undefined) {
                totalDriveCommission = parseFloat(data.total_commission);
                updateDriveCommission();
            }

            return data;
        } else if (data.code === 2) {
            // Drive complete
            console.log('updateProgressFromDetailedData: Drive complete detected');
            return data;
        } else {
            console.warn('updateProgressFromDetailedData: Unexpected response code:', data.code);
            return null;
        }
    } catch (error) {
        console.error('updateProgressFromDetailedData: Error fetching detailed progress:', error);
        return null;
    }
}

// --- End of File ---