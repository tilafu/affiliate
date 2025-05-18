// Ensure API_BASE_URL and showNotification are available (assuming from main.js)

// --- Global Variables ---
let currentDriveSessionId = null;
let currentDriveConfigurationId = null;
let totalTasksRequired = 0;
let tasksCompleted = 0;
let totalDriveCommission = 0;
let isStartingDrive = false; // Flag to prevent multiple start drive calls

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
        callStartDriveAPI(token);
        return;
    }
    countDown--;
    animationTimeout = setTimeout(() => animateAndStart(token), 1000);
}

// --- API Call: Start Drive ---
function callStartDriveAPI(token) {
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';

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
    if (!currentDriveSessionId) {
        showNotification("Error: No active drive session. Please start a drive.", "error");
        // Attempt to recover or reset
        checkDriveStatus(token);
        return;
    }
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';

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
                <button id="purchase-button" class="btn btn-primary mt-3">Purchase</button>
            </div>
        </div>
    `;
}

// --- API Call: Save Order (Purchase) ---
async function handlePurchase(token, productData) {
    const purchaseButton = document.getElementById('purchase-button');
    if (purchaseButton) {
        purchaseButton.disabled = true;
        purchaseButton.textContent = 'Processing...';
    }
    if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';

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
    }
}
