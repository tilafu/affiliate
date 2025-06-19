document.addEventListener('DOMContentLoaded', () => {
    // Use centralized authentication check
    const authData = requireAuth();
    if (!authData) {
        return; // requireAuth will handle redirect
    }

    // Get references to key elements
    const startDriveButton = document.getElementById('start-drive-button');
    const driveContentArea = document.getElementById('drive-content-area'); // Container for product card etc.
    const walletBalanceElement = document.querySelector('.datadrive-balance strong'); // Element displaying balance
    
    // Frontend state for sequential product processing
    let currentItemId = null;
    let currentProductSlotInItem = 0;
    let totalProductsInItem = 0;
    let isLastProductInCurrentItem = false;
    let currentProductData = null; // Stores the full details of the currently displayed single product
    
    // Debug elements
    const debugSection = document.getElementById('debug-section');
    const debugConsole = document.getElementById('debug-console');
    const clearDebugBtn = document.getElementById('clear-debug-btn');
    
    // Press Ctrl+Shift+D to toggle debug console
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            debugSection.style.display = debugSection.style.display === 'none' ? 'block' : 'none';
        }
    });
    
    // Clear debug console button
    if (clearDebugBtn) {
        clearDebugBtn.addEventListener('click', () => {
            if (debugConsole) debugConsole.innerHTML = '';
        });
    }
    
    // Debug logging function
    function logDebug(message, type = 'info') {
        if (!debugConsole) return;
        
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const entry = document.createElement('div');
        entry.className = `debug-${type}`;
        entry.innerHTML = `<span class="debug-time">${timestamp}</span> <span class="debug-type">[${type}]</span> ${message}`;
        
        debugConsole.appendChild(entry);
        debugConsole.scrollTop = debugConsole.scrollHeight;
    }

    // Event listener for the Start Drive button
    if (startDriveButton) {
        startDriveButton.addEventListener('click', handleStartDrive);
    }

    // Function to handle the Start Drive button click
    async function handleStartDrive() {
        console.log('Start Drive button clicked');
        // Disable the button and show loading state
        startDriveButton.disabled = true;
        startDriveButton.textContent = 'Starting...';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/drive/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
            });

            console.log('Start drive response status:', response.status);
            
            let data;
            try {
                data = await response.json();
                console.log('Start drive response data:', data);
            } catch (parseError) {
                console.error('Error parsing response:', parseError);
                logDebug(`Server error (status ${response.status}). Error parsing response: ${parseError.message}`, 'error');
                throw new Error(`Server error (status ${response.status}). Please try again later.`);
            }

            if (response.ok && data.code === 0) {
                logDebug(`Drive started or existing session found: ${data.message}. Session ID: ${data.session_id}`, 'info');
                
                startDriveButton.style.display = 'none';
                driveContentArea.style.display = 'block';
                
                if (data.existing_session) {
                    logDebug('Using existing session. Checking drive status...', 'info');
                    checkDriveStatus(); // Token is available in the outer scope
                } else {
                    // New drive started, data should contain the first product
                    if (data.current_product_details) {
                        logDebug('New drive started. Rendering first product.', 'info');
                        updateFrontendState(data);
                        renderProductCard(data.current_product_details);
                        updateWalletBalance();
                    } else {
                        logDebug('New drive started, but no product details in response. Fetching next order.', 'warn');
                        fetchNextOrder(); // Fetch the first order/product
                    }
                }
            } else {
                logDebug(`Failed to start drive: ${data.info || data.message || 'Unknown error'}`, 'error');
                if (response.status === 409) { // Conflict - existing session
                    logDebug('Existing session detected (409). Checking drive status...', 'info');
                    startDriveButton.style.display = 'none';
                    driveContentArea.style.display = 'block';
                    checkDriveStatus();
                } else {
                    alert('Failed to start drive: ' + (data.info || data.message || 'Unknown error'));
                    startDriveButton.disabled = false;
                    startDriveButton.textContent = 'Start Drive';
                }
            }
        } catch (error) {
            logDebug(`Error starting drive: ${error.message}`, 'error');
            console.error('Error starting drive:', error);
            alert('Error starting drive: ' + error.message);
            startDriveButton.disabled = false;
            startDriveButton.textContent = 'Start Drive';
        }
    }

    // Function to update frontend state variables based on API response
    function updateFrontendState(data) {
        if (data.current_product_details) {
            currentProductData = data.current_product_details;
            currentItemId = data.item_id || data.order_id; // order_id is the item_id from backend
            currentProductSlotInItem = data.product_slot_in_item;
            totalProductsInItem = data.total_products_in_item;
            isLastProductInCurrentItem = data.is_last_product_in_item;
            logDebug(`State updated: itemID=${currentItemId}, slot=${currentProductSlotInItem}/${totalProductsInItem}, lastInItem=${isLastProductInCurrentItem}`, 'dev');
        } else if (data.product_details) { // For getOrder response
            currentProductData = data.product_details;
            currentItemId = data.item_id || data.order_id;
            currentProductSlotInItem = data.product_slot_in_item;
            totalProductsInItem = data.total_products_in_item;
            isLastProductInCurrentItem = data.is_last_product_in_item;
            logDebug(`State updated (getOrder): itemID=${currentItemId}, slot=${currentProductSlotInItem}/${totalProductsInItem}, lastInItem=${isLastProductInCurrentItem}`, 'dev');
        } else {
            logDebug('No product details in data to update frontend state.', 'warn');
        }
    }

    // Function to fetch and display the next order/product
    async function fetchNextOrder() {
        logDebug('Fetching next order...', 'info');
        driveContentArea.innerHTML = '<p>Loading next product...</p>'; // Loading state
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/drive/getorder`, {
                method: 'POST', 
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
            });

            const data = await response.json();
            logDebug(`Fetch next order response: ${JSON.stringify(data)}`, 'dev');

            if (response.ok) {
                if (data.code === 0 && data.product_details) { // Success, product received
                    logDebug('Received next product.', 'info');
                    updateFrontendState(data);
                    renderProductCard(data.product_details);
                    updateWalletBalance(); 
                } else if (data.code === 2) { // Drive complete
                    logDebug('Drive complete.', 'info');
                    displayDriveComplete(data.info || 'All tasks completed!');
                    updateWalletBalance(); 
                } else {
                     logDebug(`Received unexpected success data from getOrder: ${JSON.stringify(data)}`, 'warn');
                     alert('Received unexpected data while fetching order.');
                     displayDriveError('Received unexpected data from server.');
                }
            } else {
                 logDebug(`Failed to fetch order: ${data.info || data.message || 'Unknown error'}`, 'error');
                 alert('Failed to fetch order: ' + (data.info || data.message || 'Unknown error'));
                 displayDriveError(data.info || data.message || 'Failed to fetch next product.');
            }
        } catch (error) {
            logDebug(`Error fetching order: ${error.message}`, 'error');
            console.error('Error fetching order:', error);
            alert('Error fetching order: ' + error.message);
            displayDriveError('Error fetching next product: ' + error.message);
        }
    }

    // Function to render the product details in a card
    function renderProductCard(productDetails) {
        logDebug(`Rendering product card for: ${productDetails.product_name}`, 'info');
        if (!productDetails || productDetails.product_id === undefined) {
             logDebug("CRITICAL: product_id is missing in productDetails for renderProductCard!", 'error');
             console.error("CRITICAL: product_id is missing in productDetails for renderProductCard!", productDetails);
             displayDriveError("An internal error occurred (missing product ID). Please try starting a new drive.");
             return;
        }

        // Display combo progress if applicable
        let productNameDisplay = productDetails.product_name || productDetails.product_number;
        if (totalProductsInItem > 1) {
            productNameDisplay += ` (${currentProductSlotInItem}/${totalProductsInItem})`;
        }        driveContentArea.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h4>${productNameDisplay}</h4>
                    <img src="${productDetails.product_image}" alt="${productDetails.product_name}" style="max-width: 100px; margin: 10px 0;">
                    <p>Price: ${productDetails.product_price} USDT</p>
                    <p>Commission: <span class="text-success">+${productDetails.order_commission} USDT</span></p>
                    <div class="alert alert-info py-2 my-2">
                        <small><i class="fas fa-info-circle"></i> <strong>Refund Policy:</strong> Purchase amount will be refunded after completion!</small>
                    </div>
                    <button id="purchase-button" class="btn btn-primary">Purchase & Earn</button>
                </div>
            </div>
        `;
        document.getElementById('purchase-button').addEventListener('click', () => handlePurchase(productDetails));
    }

    // Function to handle the Purchase button click
    async function handlePurchase(productDataForPurchase) { // Renamed to avoid conflict with global currentProductData
        logDebug(`Purchase button clicked for product: ${productDataForPurchase.product_name} (Slot: ${currentProductSlotInItem})`, 'info');
        const purchaseButton = document.getElementById('purchase-button');
        if (purchaseButton) {
            purchaseButton.disabled = true;
            purchaseButton.textContent = 'Processing...';
        }
        
        try {
            const payload = {
                order_id: currentItemId, // This is the user_active_drive_items.id
                product_id: productDataForPurchase.product_id,
                item_id: currentItemId, // Explicitly pass item_id as per updated-combo.md
                product_slot_to_complete: currentProductSlotInItem, // Send the current slot
                order_amount: productDataForPurchase.product_price,
                earning_commission: productDataForPurchase.order_commission,
                // product_number is not explicitly in productDataForPurchase, but backend might not need it if product_id is specific enough
            };
            logDebug(`SaveOrder payload: ${JSON.stringify(payload)}`, 'dev');

            const response = await fetch(`${API_BASE_URL}/api/drive/saveorder`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            logDebug(`SaveOrder response: ${JSON.stringify(data)}`, 'dev');            if (response.ok && data.code === 0) {
                logDebug('Order saved successfully: ' + (data.info || 'Product purchased.'), 'info');
                
                // Process refund for the purchase amount
                try {
                    logDebug(`Processing refund of ${productDataForPurchase.product_price} USDT for product purchase`, 'info');
                    const refundResponse = await fetch(`${API_BASE_URL}/api/drive/refund`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            order_id: currentItemId,
                            product_id: productDataForPurchase.product_id,
                            refund_amount: productDataForPurchase.product_price,
                            reason: 'Post-purchase refund as per drive policy'
                        })
                    });

                    const refundData = await refundResponse.json();
                    logDebug(`Refund response: ${JSON.stringify(refundData)}`, 'dev');                    if (refundResponse.ok && refundData.success) {
                        logDebug(`Refund successful: ${productDataForPurchase.product_price} USDT refunded`, 'info');
                        
                        // Show purchase success popup instead of notification
                        if (typeof showPurchaseSuccessPopup === 'function') {
                            showPurchaseSuccessPopup(productDataForPurchase.product_name, () => {
                                // Continue with the drive flow after user clicks "Continue Drive"
                                if (data.next_action === 'drive_complete') {
                                    logDebug('Drive complete after purchase.', 'info');
                                    displayDriveComplete(data.message_to_user || 'Congratulations! Drive complete!');
                                } else {
                                    // Default action is to fetch the next order/product
                                    logDebug('Fetching next order after purchase.', 'info');
                                    fetchNextOrder();
                                }
                            });
                            return; // Exit early since popup will handle the continue flow
                        } else {
                            // Fallback to regular notification if popup function is not available
                            if (typeof showNotification === 'function') {
                                showNotification(`Purchase completed! ${productDataForPurchase.product_price} USDT refunded + ${productDataForPurchase.order_commission} USDT commission earned`, 'success');
                            }
                        }
                    } else {
                        logDebug(`Refund failed: ${refundData.message || 'Unknown error'}`, 'warn');
                        // Log error but don't stop the flow - user still got their commission
                        console.warn('Refund failed but purchase was successful:', refundData);
                        
                        // Still show success popup even if refund failed
                        if (typeof showPurchaseSuccessPopup === 'function') {
                            showPurchaseSuccessPopup(productDataForPurchase.product_name, () => {
                                // Continue with the drive flow
                                if (data.next_action === 'drive_complete') {
                                    logDebug('Drive complete after purchase.', 'info');
                                    displayDriveComplete(data.message_to_user || 'Congratulations! Drive complete!');
                                } else {
                                    logDebug('Fetching next order after purchase.', 'info');
                                    fetchNextOrder();
                                }
                            });
                            return;
                        }
                    }                } catch (refundError) {
                    logDebug(`Error processing refund: ${refundError.message}`, 'error');
                    console.error('Error processing refund:', refundError);
                    // Continue with normal flow even if refund fails
                    
                    // Show success popup even if refund processing failed
                    if (typeof showPurchaseSuccessPopup === 'function') {
                        showPurchaseSuccessPopup(productDataForPurchase.product_name, () => {
                            // Continue with the drive flow
                            if (data.next_action === 'drive_complete') {
                                logDebug('Drive complete after purchase.', 'info');
                                displayDriveComplete(data.message_to_user || 'Congratulations! Drive complete!');
                            } else {
                                logDebug('Fetching next order after purchase.', 'info');
                                fetchNextOrder();
                            }
                        });
                        return;
                    }
                }
                
                // Update balance after refund attempt
                updateWalletBalance();
                
                // Only execute default flow if popup wasn't shown
                if (typeof showPurchaseSuccessPopup !== 'function') {
                    if (data.next_action === 'drive_complete') {
                        logDebug('Drive complete after purchase.', 'info');
                        displayDriveComplete(data.message_to_user || 'Congratulations! Drive complete!');
                    } else {
                        // Default action is to fetch the next order/product
                        logDebug('Fetching next order after purchase.', 'info');
                        fetchNextOrder();
                    }
                }
            }else if (data.code === 3) { // Insufficient balance/Frozen
                 logDebug(`Insufficient balance/Frozen: ${data.info}`, 'warn');
                 displayFrozenState(data.info, data.frozen_amount_needed);
                 updateWalletBalance();
            } else {
                logDebug(`Failed to save order: ${data.info || data.message || 'Unknown error'}`, 'error');
                alert('Failed to save order: ' + (data.info || data.message || 'Unknown error'));
                 if (purchaseButton) {
                     purchaseButton.disabled = false;
                     purchaseButton.textContent = 'Purchase';
                 }
            }
        } catch (error) {
            logDebug(`Error saving order: ${error.message}`, 'error');
            console.error('Error saving order:', error);
            alert('Error saving order: ' + error.message);
            if (purchaseButton) {
                purchaseButton.disabled = false;
                purchaseButton.textContent = 'Purchase';
            }
        }
    }

    // Function to update the displayed wallet balance
    async function updateWalletBalance() {
        console.log('Updating wallet balance...');
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.error('No auth token found');
                return;
            }
            
            const response = await fetch(`${API_BASE_URL}/api/user/balances`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            
            if (data.success && data.balances) {
                const mainBalance = parseFloat(data.balances.main_balance || 0);
                if (walletBalanceElement) {
                    walletBalanceElement.textContent = mainBalance.toFixed(2);
                }
            } else {
                console.error('Failed to fetch updated balance:', data.message);
                if (walletBalanceElement) {
                    walletBalanceElement.textContent = 'Error';
                }
            }
        } catch (error) {
            console.error('Error fetching updated balance:', error);
            if (walletBalanceElement) {
                walletBalanceElement.textContent = 'Error';
            }
        }
    }

    // Function to display drive complete message
    function displayDriveComplete(message) {
        driveContentArea.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h4>Drive Complete!</h4>
                    <p>${message}</p>
                    <button id="start-new-drive-button" class="btn btn-primary">Start New Drive</button>
                </div>
            </div>
        `;
         document.getElementById('start-new-drive-button').addEventListener('click', () => {
             // Reset UI and allow starting a new drive
             driveContentArea.innerHTML = ''; // Clear content area
             startDriveButton.style.display = 'block'; // Show start button
             startDriveButton.disabled = false;
             startDriveButton.textContent = 'Start Drive';
             updateWalletBalance(); // Final balance update
         });    
    }

     // Function to display frozen state message
    function displayFrozenState(message, amountNeeded) {
         driveContentArea.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h4>Drive Frozen</h4>
                    <p>${message}</p>
                    ${amountNeeded ? `<p>Amount needed to unfreeze: ${amountNeeded} USDT</p>` : ''}
                    <p>Please deposit funds to continue or contact support.</p>
                     <button id="contact-support-button" class="btn btn-secondary">Contact Support</button>
                </div>
            </div>
        `;
         
         // Add event listener for contact support button
         const contactSupportButton = document.getElementById('contact-support-button');
         if (contactSupportButton) {
             contactSupportButton.addEventListener('click', () => {
                 // Redirect to support page
                 window.location.href = './support.html';
             });
         }
    }

     // Function to display a generic drive error
     function displayDriveError(message) {
         driveContentArea.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h4>Error</h4>
                    <p>${message}</p>
                     <button id="start-new-drive-button" class="btn btn-primary">Try Starting New Drive</button>
                </div>
            </div>
        `;
         document.getElementById('start-new-drive-button').addEventListener('click', () => {
             // Reset UI and allow starting a new drive
             driveContentArea.innerHTML = ''; // Clear content area
             startDriveButton.style.display = 'block'; // Show start button
             startDriveButton.disabled = false;
             startDriveButton.textContent = 'Start Drive';
             updateWalletBalance(); // Final balance update
         });
     }

    // Initial balance load and drive status check
    updateWalletBalance();
    checkDriveStatus(); // Call the primary checkDriveStatus
});

// Function to check the current drive status and resume if necessary
async function checkDriveStatus() { // Removed token parameter, use global token
    const localToken = localStorage.getItem('auth_token'); // Use local token variable
    if (!localToken) {
        console.log('checkDriveStatus: No token found, returning.');
        return;
    }

    // Get references to key elements for showing/hiding
    const startDriveButton = document.getElementById('start-drive-button');
    const driveContentArea = document.getElementById('drive-content-area');
    const driveProgressSection = document.getElementById('drive-progress-section'); // Assuming this is the ID of the "Drive Progress" section
    const noDriveMessageSection = document.getElementById('no-drive-message-section'); // New section for the message and button

    try {
        const response = await fetch(`${API_BASE_URL}/api/drive/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localToken}`
            }
        });

        const data = await response.json();
        console.log('Drive status response:', data);

        if (response.ok && data.code === 0) {
            if (data.status === 'active' && data.current_product_details) {
                console.log('Active session with current product found. Resuming drive.');
                if(startDriveButton) startDriveButton.style.display = 'none';
                if(driveContentArea) driveContentArea.style.display = 'block';
                if(driveProgressSection) driveProgressSection.style.display = 'block'; // Show progress
                if(noDriveMessageSection) noDriveMessageSection.style.display = 'none'; // Hide no-drive message
                updateFrontendState(data); // Update state with all details
                renderProductCard(data.current_product_details);
                updateWalletBalance();
            } else if (data.status === 'frozen') {
                 console.log('Frozen session found. Displaying frozen state.');
                 if(startDriveButton) startDriveButton.style.display = 'none';
                 if(driveContentArea) driveContentArea.style.display = 'block';
                 if(driveProgressSection) driveProgressSection.style.display = 'block'; // Show progress
                 if(noDriveMessageSection) noDriveMessageSection.style.display = 'none'; // Hide no-drive message
                 displayFrozenState(data.info || 'Your drive is frozen.', data.frozen_amount_needed);
                 updateWalletBalance();
            } else if (data.status === 'complete' || data.status === 'pending_reset') { // pending_reset is also a form of completion
                 console.log('Drive complete or pending reset.');
                 if(driveProgressSection) driveProgressSection.style.display = 'block'; // Show progress (even if complete)
                 if(noDriveMessageSection) noDriveMessageSection.style.display = 'none'; // Hide no-drive message
                 displayDriveComplete(data.info || 'Your data drive is complete.');
                 updateWalletBalance();
            } else if (data.status === 'no_session') {
                 console.log('No active drive session found.');
                 if(startDriveButton) startDriveButton.style.display = 'block';
                 if(driveContentArea) driveContentArea.style.display = 'none';
                 if(driveProgressSection) driveProgressSection.style.display = 'none'; // Hide progress
                 if(noDriveMessageSection) {
                    noDriveMessageSection.innerHTML = '<p>No active data drive. Please contact support if you believe this is an error.</p><button id="contact-support-no-drive-btn" class="btn btn-primary">Contact Support</button>';
                    noDriveMessageSection.style.display = 'block'; // Show no-drive message
                    const contactBtn = document.getElementById('contact-support-no-drive-btn');
                    if(contactBtn) {
                        contactBtn.addEventListener('click', () => {
                            window.location.href = './support.html';
                        });
                    }
                 }
                 // Reset frontend state if no session
                 currentItemId = null;
                 currentProductSlotInItem = 0;
                 totalProductsInItem = 0;
                 isLastProductInCurrentItem = false;
                 currentProductData = null;
            } else {
                 console.log(`Received unexpected status: ${data.status}. Data:`, data);
                 if(startDriveButton) startDriveButton.style.display = 'block';
                 if(driveContentArea) driveContentArea.style.display = 'none';
                 if(driveProgressSection) driveProgressSection.style.display = 'none'; // Hide progress
                 if(noDriveMessageSection) noDriveMessageSection.style.display = 'none'; // Hide no-drive message
            }
        } else {
            console.log(`Failed to check drive status: ${data.info || data.message || 'Unknown error'}`);
            if(startDriveButton) startDriveButton.style.display = 'block'; 
            if(driveContentArea) driveContentArea.style.display = 'none';
            if(driveProgressSection) driveProgressSection.style.display = 'none'; // Hide progress
            if(noDriveMessageSection) noDriveMessageSection.style.display = 'none'; // Hide no-drive message
        }
    } catch (error) {
        console.error('Error checking drive status:', error);
        if(startDriveButton) startDriveButton.style.display = 'block'; 
        if(driveContentArea) driveContentArea.style.display = 'none';
        if(driveProgressSection) driveProgressSection.style.display = 'none'; // Hide progress
        if(noDriveMessageSection) noDriveMessageSection.style.display = 'none'; // Hide no-drive message
    }
}

// Constants and auth setup
const API_BASE_URL = ''; // Should be set to your API base URL e.g. http://localhost:3000
let token = localStorage.getItem('auth_token');

function requireAuth() {
    token = localStorage.getItem('auth_token');
    if (!token) {
        console.log('Auth token not found. Redirecting to login.');
        window.location.href = './login.html';
        return null;
    }
    return { token: token };
}