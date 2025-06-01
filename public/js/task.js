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
    productCardContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <h4>${productData.product_name || 'Product'} ${productData.is_combo ? '<span class="badge bg-info text-dark">Combo Item</span>' : ''}</h4>
                <img src="${productData.product_image || './assets/uploads/images/ph.png'}" alt="${productData.product_name || 'Product Image'}" style="max-width: 150px; margin: 10px auto; display: block;">
                <p>Price: <strong>${parseFloat(productData.product_price).toFixed(2)}</strong> USDT</p>
                <p>Commission for this item: <strong>${parseFloat(productData.order_commission).toFixed(2)}</strong> USDT</p>
>>>>>>> main
                <button id="purchase-button" class="btn btn-primary mt-3">Purchase</button>
            </div>
        </div>
    `;
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
>>>>>>> main
    }
}
