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
                }            }else if (data.code === 3) { // Insufficient balance/Frozen
                 logDebug(`Insufficient balance/Frozen: ${data.info}`, 'warn');
                 const tasksCompleted = data.tasks_completed && data.tasks_required ? 
                     `${data.tasks_completed} of ${data.tasks_required}` : '0 of 0';
                 const totalCommission = data.total_session_commission || '0.00';
                 displayFrozenState(data.info, data.frozen_amount_needed, tasksCompleted, totalCommission);
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
    }    // Function to display frozen state popup modal
    function displayFrozenState(message, amountNeeded, tasksCompleted = '0 of 0', totalCommission = '0.00') {
        console.log('=== displayFrozenState called ===');
        console.log('Message:', message);
        console.log('Amount needed:', amountNeeded);
        console.log('Tasks completed:', tasksCompleted);
        console.log('Total commission:', totalCommission);
        
        // Simple test modal to see if it shows up at all
        const testModal = document.createElement('div');
        testModal.id = 'test-modal';
        testModal.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: red !important;
            color: white !important;
            padding: 20px !important;
            z-index: 999999 !important;
            border: 5px solid yellow !important;
            font-size: 20px !important;
            font-weight: bold !important;
        `;
        testModal.innerHTML = 'TEST MODAL - ACCOUNT FROZEN<br>Click to close';
        testModal.addEventListener('click', () => testModal.remove());
        
        document.body.appendChild(testModal);
        console.log('Test modal added to body');
        
        // Also try the full modal
        setTimeout(() => {
            testModal.remove();
            showFullModal(message, amountNeeded, tasksCompleted, totalCommission);
        }, 2000);
    }
    
    function showFullModal(message, amountNeeded, tasksCompleted = '0 of 0', totalCommission = '0.00') {
        // Remove existing modal if present
        const existingModal = document.getElementById('drive-frozen-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const existingStyles = document.getElementById('drive-frozen-modal-styles');
        if (existingStyles) {
            existingStyles.remove();
        }

        // Calculate progress percentage
        let percentage = 0;
        if (tasksCompleted && tasksCompleted !== '0 of 0' && tasksCompleted !== 'undefined of undefined') {
            const match = tasksCompleted.match(/(\d+)\s*of\s*(\d+)/);
            if (match) {
                const completed = parseInt(match[1]);
                const total = parseInt(match[2]);
                if (!isNaN(completed) && !isNaN(total) && total > 0) {
                    percentage = Math.min((completed / total) * 100, 100);
                }
            }
        }

        // Create modal with inline styles to override any conflicting CSS
        const modalHTML = `
            <div id="drive-frozen-modal" style="
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background: rgba(0, 0, 0, 0.8) !important;
                backdrop-filter: blur(8px) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: 999999 !important;
                padding: 20px !important;
                box-sizing: border-box !important;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
                animation: fadeIn 0.3s ease !important;
            ">
                <div style="
                    background: linear-gradient(145deg, #667eea 0%, #764ba2 100%) !important;
                    border-radius: 20px !important;
                    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5) !important;
                    max-width: 450px !important;
                    width: 100% !important;
                    max-height: 90vh !important;
                    overflow-y: auto !important;
                    position: relative !important;
                    color: white !important;
                    border: 2px solid rgba(255, 255, 255, 0.1) !important;
                    animation: slideUp 0.4s ease !important;
                ">
                    <div style="
                        padding: 40px 35px 35px !important;
                        text-align: center !important;
                        position: relative !important;
                    ">
                        <!-- Close Button -->
                        <button id="drive-frozen-close" style="
                            position: absolute !important;
                            top: 15px !important;
                            right: 15px !important;
                            background: rgba(255, 255, 255, 0.2) !important;
                            border: none !important;
                            border-radius: 50% !important;
                            width: 40px !important;
                            height: 40px !important;
                            color: white !important;
                            font-size: 18px !important;
                            cursor: pointer !important;
                            transition: all 0.3s ease !important;
                            display: flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            font-weight: bold !important;
                        " onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='scale(1)'">×</button>
                        
                        <!-- Icon -->
                        <div style="margin-bottom: 20px !important;">
                            <i class="fas fa-exclamation-triangle" style="
                                font-size: 56px !important;
                                color: #FFD700 !important;
                                text-shadow: 0 4px 15px rgba(255, 215, 0, 0.4) !important;
                                animation: pulse 2s infinite !important;
                            "></i>
                        </div>
                        
                        <!-- Title -->
                        <h2 style="
                            font-size: 28px !important;
                            font-weight: 700 !important;
                            margin: 0 0 12px 0 !important;
                            color: #FFD700 !important;
                            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3) !important;
                        ">⚠️ Account Frozen</h2>
                        
                        <!-- Message -->
                        <p style="
                            font-size: 16px !important;
                            margin: 0 0 20px 0 !important;
                            opacity: 0.9 !important;
                            line-height: 1.5 !important;
                            color: #e1e8f0 !important;
                        ">${message}</p>
                        
                        <!-- Amount Section -->
                        ${amountNeeded ? `
                        <div style="
                            font-size: 18px !important;
                            margin-bottom: 25px !important;
                            padding: 15px !important;
                            background: rgba(255, 255, 255, 0.1) !important;
                            border-radius: 12px !important;
                            border: 1px solid rgba(255, 255, 255, 0.2) !important;
                            backdrop-filter: blur(10px) !important;
                        ">
                            Amount needed: <span style="
                                color: #FFD700 !important;
                                font-weight: 800 !important;
                                font-size: 22px !important;
                                text-shadow: 0 2px 10px rgba(255, 215, 0, 0.3) !important;
                            ">${amountNeeded} USDT</span>
                        </div>
                        ` : ''}
                        
                        <!-- Stats Section -->
                        <div style="
                            margin-bottom: 30px !important;
                            padding: 20px !important;
                            background: rgba(255, 255, 255, 0.08) !important;
                            border-radius: 12px !important;
                            border: 1px solid rgba(255, 255, 255, 0.15) !important;
                            backdrop-filter: blur(10px) !important;
                        ">
                            <!-- Progress Section -->
                            <div style="margin-bottom: 20px !important;">
                                <div style="
                                    font-size: 14px !important;
                                    opacity: 0.8 !important;
                                    margin-bottom: 8px !important;
                                    color: #b8c6db !important;
                                    text-transform: uppercase !important;
                                    letter-spacing: 0.5px !important;
                                ">Drive Progress</div>
                                <div style="
                                    font-size: 18px !important;
                                    font-weight: 600 !important;
                                    margin-bottom: 12px !important;
                                    color: #FFD700 !important;
                                ">${tasksCompleted} ${percentage > 0 ? `(${Math.round(percentage)}%)` : ''}</div>
                                
                                <!-- Progress Bar -->
                                <div style="
                                    width: 100% !important;
                                    height: 10px !important;
                                    background: rgba(255, 255, 255, 0.2) !important;
                                    border-radius: 5px !important;
                                    overflow: hidden !important;
                                    margin-bottom: 8px !important;
                                    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2) !important;
                                ">
                                    <div id="drive-progress-bar" style="
                                        height: 100% !important;
                                        background: linear-gradient(90deg, #4ECDC4 0%, #44A08D 100%) !important;
                                        border-radius: 5px !important;
                                        transition: width 0.8s ease-out !important;
                                        width: ${percentage}% !important;
                                        box-shadow: 0 2px 8px rgba(78, 205, 196, 0.4) !important;
                                    "></div>
                                </div>
                            </div>
                            
                            <!-- Commission -->
                            <div style="margin: 0 !important; text-align: center !important;">
                                <div style="
                                    color: #4ECDC4 !important;
                                    font-size: 20px !important;
                                    font-weight: 700 !important;
                                    text-shadow: 0 2px 8px rgba(78, 205, 196, 0.3) !important;
                                ">${totalCommission} USDT</div>
                                <div style="
                                    display: block !important;
                                    margin-top: 8px !important;
                                    opacity: 0.7 !important;
                                    font-size: 13px !important;
                                    line-height: 1.4 !important;
                                    color: #b8c6db !important;
                                ">Your earned commission is safe and will be available when you resume</div>
                            </div>
                        </div>
                        
                        <!-- Buttons -->
                        <div style="
                            display: flex !important;
                            gap: 15px !important;
                            flex-direction: column !important;
                        ">
                            <button id="drive-deposit-funds-btn" style="
                                padding: 16px 24px !important;
                                border-radius: 12px !important;
                                border: none !important;
                                font-weight: 600 !important;
                                font-size: 16px !important;
                                cursor: pointer !important;
                                transition: all 0.3s ease !important;
                                display: flex !important;
                                align-items: center !important;
                                justify-content: center !important;
                                gap: 10px !important;
                                text-transform: uppercase !important;
                                letter-spacing: 0.5px !important;
                                min-height: 50px !important;
                                background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%) !important;
                                color: white !important;
                                box-shadow: 0 6px 20px rgba(78, 205, 196, 0.4) !important;
                            " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 25px rgba(78, 205, 196, 0.5)'; this.style.background='linear-gradient(135deg, #5FDDD6 0%, #55B09E 100%)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 6px 20px rgba(78, 205, 196, 0.4)'; this.style.background='linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)'">
                                <i class="fas fa-plus-circle"></i> Deposit Funds
                            </button>
                            
                            <button id="drive-contact-support-btn" style="
                                padding: 16px 24px !important;
                                border-radius: 12px !important;
                                border: 1px solid rgba(255, 255, 255, 0.3) !important;
                                font-weight: 600 !important;
                                font-size: 16px !important;
                                cursor: pointer !important;
                                transition: all 0.3s ease !important;
                                display: flex !important;
                                align-items: center !important;
                                justify-content: center !important;
                                gap: 10px !important;
                                text-transform: uppercase !important;
                                letter-spacing: 0.5px !important;
                                min-height: 50px !important;
                                background: rgba(255, 255, 255, 0.15) !important;
                                color: white !important;
                            " onmouseover="this.style.background='rgba(255, 255, 255, 0.25)'; this.style.transform='translateY(-2px)'; this.style.borderColor='rgba(255, 255, 255, 0.4)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.15)'; this.style.transform='translateY(0)'; this.style.borderColor='rgba(255, 255, 255, 0.3)'">
                                <i class="fas fa-headset"></i> Contact Support
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <style id="drive-frozen-modal-styles">
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideUp {
                    from { 
                        transform: translateY(-50px) scale(0.95); 
                        opacity: 0; 
                    }
                    to { 
                        transform: translateY(0) scale(1); 
                        opacity: 1; 
                    }
                }
                
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            </style>
        `;

        // Add styles and modal to DOM
        document.head.insertAdjacentHTML('beforeend', '<style id="drive-frozen-modal-styles">@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes slideUp { from { transform: translateY(-50px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } } @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } } @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }</style>');
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Get modal elements and add event listeners
        const modal = document.getElementById('drive-frozen-modal');
        const closeBtn = document.getElementById('drive-frozen-close');
        const depositBtn = document.getElementById('drive-deposit-funds-btn');
        const supportBtn = document.getElementById('drive-contact-support-btn');

        // Close button event
        closeBtn.addEventListener('click', () => {
            modal.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => modal.remove(), 300);
        });

        // Close on overlay click (clicking outside modal)
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.animation = 'fadeOut 0.3s ease-out forwards';
                setTimeout(() => modal.remove(), 300);
            }
        });

        // Deposit funds button
        depositBtn.addEventListener('click', () => {
            modal.remove();
            window.location.href = './account.html';
        });

        // Contact support button
        supportBtn.addEventListener('click', () => {
            modal.remove();
            window.location.href = './contact.html';
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.style.animation = 'fadeOut 0.3s ease-out forwards';
                setTimeout(() => modal.remove(), 300);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);        // Create global close function for the close button
        window.closeFrozenModal = () => {
            const modal = document.getElementById('drive-frozen-modal');
            if (modal) {
                modal.style.animation = 'fadeOut 0.3s ease-out forwards';
                setTimeout(() => modal.remove(), 300);
            }
        };
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
    const driveProgressSection = document.getElementById('progress-section'); // Fixed: Use correct ID from HTML
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
                if(driveProgressSection) {
                    driveProgressSection.style.display = 'block';
                    driveProgressSection.style.visibility = 'visible';
                    driveProgressSection.style.opacity = '1';
                    driveProgressSection.classList.add('show');
                    driveProgressSection.classList.remove('d-none');
                } // Show progress with multiple approaches
                if(noDriveMessageSection) noDriveMessageSection.style.display = 'none'; // Hide no-drive message
                updateFrontendState(data); // Update state with all details
                renderProductCard(data.current_product_details);
                updateWalletBalance();            } else if (data.status === 'frozen') {
                 console.log('Frozen session found. Displaying frozen state.');
                 if(startDriveButton) startDriveButton.style.display = 'none';
                 if(driveContentArea) driveContentArea.style.display = 'block';
                 if(driveProgressSection) {
                     driveProgressSection.style.display = 'block';
                     driveProgressSection.style.visibility = 'visible';
                     driveProgressSection.style.opacity = '1';
                     driveProgressSection.classList.add('show');
                     driveProgressSection.classList.remove('d-none');
                 } // Show progress with multiple approaches
                 if(noDriveMessageSection) noDriveMessageSection.style.display = 'none'; // Hide no-drive message
                 const tasksCompleted = data.tasks_completed && data.tasks_required ? 
                     `${data.tasks_completed} of ${data.tasks_required}` : '0 of 0';
                 const totalCommission = data.total_commission || '0.00';
                 displayFrozenState(data.info || 'Your drive is frozen.', data.frozen_amount_needed, tasksCompleted, totalCommission);
                 updateWalletBalance();
            } else if (data.status === 'complete' || data.status === 'pending_reset') { // pending_reset is also a form of completion
                 console.log('Drive complete or pending reset.');
                 if(driveProgressSection) {
                     driveProgressSection.style.display = 'block';
                     driveProgressSection.style.visibility = 'visible';
                     driveProgressSection.style.opacity = '1';
                     driveProgressSection.classList.add('show');
                     driveProgressSection.classList.remove('d-none');
                 } // Show progress (even if complete) with multiple approaches
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

// Debug function to check progress section visibility
function debugProgressSection() {
    const progressSection = document.getElementById('progress-section');
    if (progressSection) {
        console.log('Progress Section Debug:', {
            element: progressSection,
            display: getComputedStyle(progressSection).display,
            visibility: getComputedStyle(progressSection).visibility,
            opacity: getComputedStyle(progressSection).opacity,
            classList: progressSection.classList.toString(),
            style: progressSection.style.cssText,
            offsetHeight: progressSection.offsetHeight,
            offsetWidth: progressSection.offsetWidth
        });
    } else {
        console.log('Progress section element not found!');
    }
}

// Add to window for manual debugging
window.debugProgressSection = debugProgressSection;

// Test function to manually trigger the frozen modal (for debugging)
window.testFrozenModal = function() {
    console.log('Testing frozen modal...');
    displayFrozenState(
        'Drive frozen. Please deposit funds and contact admin.',
        '100.00',
        '3 of 5',
        '25.50'
    );
};

// Manual function to show progress section for testing
function showProgressSection() {
    const progressSection = document.getElementById('progress-section');
    if (progressSection) {
        progressSection.style.display = 'block';
        progressSection.style.visibility = 'visible';
        progressSection.style.opacity = '1';
        progressSection.classList.add('show');
        progressSection.classList.remove('d-none');
        console.log('Progress section manually shown');
        debugProgressSection();
    } else {
        console.log('Progress section element not found');
    }
}

// Add to window for testing
window.showProgressSection = showProgressSection;

// Initialize page and check drive status
console.log('Drive.js initializing...');
    
// Ensure progress section is properly reset on load
const progressSection = document.getElementById('progress-section');
if (progressSection) {
    // Remove any conflicting classes/styles that might hide it
    progressSection.classList.remove('d-none');
    progressSection.style.visibility = 'visible';
    progressSection.style.opacity = '1';
    console.log('Progress section initialized for visibility');
}