// Ensure API_BASE_URL and showNotification are available (assuming from main.js)
// If not, define them here or ensure main.js is loaded first.

// --- Global Variables ---
var oid = null; // Will be set by startDrive response if needed (using session ID?)
let totalTasksRequired = 0; // Variable to store the total number of tasks required
let isStartingDrive = false; // Flag to prevent unintentional start drive calls

// --- UI Element References ---
let autoStartButton;
let productCardContainer; // New container for the dynamic product card
let walletBalanceElement;
let tasksProgressElement; // Element to display tasks completed/required
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
  }

  // Get references to key elements
  autoStartButton = document.getElementById('autoStart');
  productCardContainer = document.getElementById('product-card-container'); // Get reference to the new container
  walletBalanceElement = document.querySelector('.datadrive-balance strong'); // Element displaying balance
  tasksProgressElement = document.querySelector('.item-card h5'); // Element displaying tasks completed/required
  orderLoadingOverlay = document.getElementById('order-loading-overlay'); // Get reference to the loading overlay

  // Initial UI state: Show start button, hide product card container and loading overlay
  if (autoStartButton) autoStartButton.style.display = 'block';
  if (productCardContainer) productCardContainer.style.display = 'none';
  if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';

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
    fetch(`${API_BASE_URL}/api/user/balance`, {
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
          if (data.success) {
            if (walletBalanceElement) {
                 walletBalanceElement.textContent = `${data.balance.toFixed(2)}`;
            }
          } else {
            console.error('Failed to fetch balance:', data.message);
            if (typeof showNotification === 'function') {
                showNotification(`Failed to fetch balance: ${data.message}`, 'error');
            }
             if (walletBalanceElement) walletBalanceElement.textContent = 'Error';
          }
        })
        .catch(error => {
          console.error('Error fetching balance:', error);
           if (typeof showNotification === 'function') {
                showNotification(`Error fetching balance: ${error.message}`, 'error');
            }
             if (walletBalanceElement) walletBalanceElement.textContent = 'Error';
        });
}

// --- Helper to safely update wallet balance everywhere ---
function refreshWalletBalance() {
    const token = localStorage.getItem('auth_token');
    if (token) {
        fetchBalance(token);
    } else {
        if (walletBalanceElement) walletBalanceElement.textContent = 'N/A';
    }
}

// --- Random Sum Helper ---
function randomSum(min, max) {
  var num = Math.floor(Math.random()*(max - min) + min);
  return num;
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
            console.log("API response received:", data);
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
                if (autoStartButton) autoStartButton.style.display = 'none';
                if (productCardContainer) productCardContainer.style.display = 'block';
                fetchNextOrder(token);
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
                console.error("Error showing error dialog:", e);
                alert(`Error starting drive: ${error.message}`);
            }
            isStartingDrive = false;
        });
    }, 500);
}

function fetchNextOrder(token) {
    console.log("Fetching next order...");
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';
    $('.product-carousel').trigger('stop.owl.autoplay');
    fetch(`${API_BASE_URL}/api/drive/getorder`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
    })
    .then(response => response.json())
    .then(data => {
        $('.product-carousel').trigger('play.owl.autoplay', [3000]);
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        if (data.code === 2) {
            console.log("Drive complete message received from backend.");
            displayDriveComplete(data.info || 'Data drive complete for today.');
            refreshWalletBalance();
        } else if (data.code === 3) {
             console.warn("Drive Frozen message received from backend.");
             displayFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed);
             refreshWalletBalance();
        }
        else if (data.success) {
             currentProductData = data;
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
            if (data.premium_status == 0) {
                renderProductCard(data);
                console.log("Single product order received", data);
            } else if (data.premium_status == 1) {
                console.log("Combo order received, rendering not yet implemented for card.", data);
                 if (typeof showNotification === 'function') {
                    showNotification('Combo order received, rendering not yet implemented.', 'info');
                 } else { alert('Combo order received, rendering not yet implemented.'); }
                 displayDriveError('Combo order received. Combo rendering not yet implemented.');
            } else {
                 console.error('Unknown premium_status:', data.premium_status);
                 displayDriveError('Received unknown order type.');
            }
             refreshWalletBalance();
        } else {
            console.error('Error fetching next order:', data.info || data.message);
             displayDriveError(`Error fetching order: ${data.info || data.message || 'Unknown error'}`);
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
    productCardContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <h4>${productData.product_name || 'Product'}</h4>
                <img src="${productData.product_image || './assets/uploads/images/ph.png'}" alt="${productData.product_name || 'Product Image'}" style="max-width: 150px; margin: 10px auto; display: block;">
                <p>Price: <strong>${parseFloat(productData.product_price).toFixed(2)}</strong> USDT</p>
                <p>Commission: <strong>${parseFloat(productData.order_commission).toFixed(2)}</strong> USDT</p>
                <button id="purchase-button" class="btn btn-primary mt-3">Purchase</button>
            </div>
        </div>
    `;
}

async function handlePurchase(token, productData) {
    console.log('Purchase button clicked for product:', productData);
    const purchaseButton = document.getElementById('purchase-button');
    if (purchaseButton) {
        purchaseButton.disabled = true;
        purchaseButton.textContent = 'Processing...';
    }
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';
    try {
        const response = await fetch(`${API_BASE_URL}/api/drive/saveorder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                order_id: productData.order_id,
                product_id: productData.product_id,
                order_amount: productData.product_price,
                earning_commission: productData.order_commission,
                product_number: productData.product_number
            })
        });
        const data = await response.json();
        if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
        if (response.ok && data.code === 0) {
            console.log('Order saved successfully:', data.info);
            if (typeof showNotification === 'function') {
                showNotification(data.info || "Order Sent successfully!", 'success');
            } else { alert(data.info || "Order Sent successfully!"); }
            if (tasksProgressElement && data.tasks_completed !== undefined && totalTasksRequired > 0) {
                tasksProgressElement.textContent = `(${data.tasks_completed} / ${totalTasksRequired})`;
            } else if (tasksProgressElement && data.tasks_completed !== undefined) {
                 tasksProgressElement.textContent = `(${data.tasks_completed} / --)`;
            }
            refreshWalletBalance();
            fetchNextOrder(token);
        } else if (data.code === 3) {
             if (typeof showNotification === 'function') {
                showNotification(data.info || "Session frozen due to insufficient balance.", 'warning');
             } else { alert(data.info || "Session frozen due to insufficient balance."); }
             displayFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed);
             refreshWalletBalance();
        }
        else {
            if (typeof showNotification === 'function') {
                showNotification(`Failed to save order: ${data.info || data.message || 'Unknown error'}`, 'error');
            } else { alert(`Failed to save order: ${data.info || data.message || 'Unknown error'}`); }
            if (purchaseButton) {
                 purchaseButton.disabled = false;
                 purchaseButton.textContent = 'Processing...';
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
    console.log('Checking drive status with token...');
    fetch(`${API_BASE_URL}/api/drive/status`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        console.log('Drive status response received:', data);
        console.log('Drive status:', data.status);
        if (data.status === 'active' && data.current_order) {
            console.log('checkDriveStatus: Active session with current order found. Resuming drive.');
            if (autoStartButton) autoStartButton.style.display = 'none';
            if (productCardContainer) productCardContainer.style.display = 'block';
            renderProductCard(data.current_order);
            currentProductData = data.current_order;
            if (tasksProgressElement && data.tasks_completed !== undefined && data.tasks_required !== undefined) {
                tasksProgressElement.textContent = `(${data.tasks_completed} / ${data.tasks_required})`;
                totalTasksRequired = data.tasks_required;
            }
        } else if (data.status === 'frozen') {
             console.log('checkDriveStatus: Frozen session found. Displaying frozen state.');
            displayFrozenState(data.info || "Session frozen due to insufficient balance.", data.frozen_amount_needed);
            if (autoStartButton) autoStartButton.style.display = 'none';
        } else if (data.status === 'complete' || data.status === 'no_session') {
             console.log('checkDriveStatus: Drive complete or no session found.');
            if (autoStartButton) autoStartButton.style.display = 'block';
            if (productCardContainer) productCardContainer.style.display = 'none';
        }
         else {
             console.warn('checkDriveStatus: Received unexpected status:', data.status, 'with data:', data);
             if (autoStartButton) autoStartButton.style.display = 'block';
             if (productCardContainer) productCardContainer.style.display = 'none';
        }
    })
    .catch(error => {
        console.error('checkDriveStatus: Error checking drive status:', error);
         if (autoStartButton) autoStartButton.style.display = 'block';
         if (productCardContainer) productCardContainer.style.display = 'none';
    });
}
