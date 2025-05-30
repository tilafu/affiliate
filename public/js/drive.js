document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        // Redirect to login if not authenticated
        window.location.href = 'login.html'; // Assuming login page is login.html
        return;
    }

    // Get references to key elements
    const startDriveButton = document.getElementById('start-drive-button');
    const driveContentArea = document.getElementById('drive-content-area'); // Container for product card etc.
    const walletBalanceElement = document.querySelector('.datadrive-balance strong'); // Element displaying balance
    
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

    // TODO: Add event listener for the Purchase button (will be inside the dynamically created card)    // Function to handle the Start Drive button click
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
                    'Content-Type': 'application/json' // Assuming POST requires Content-Type
                },
                // No body needed for start drive based on backend controller
            });

            console.log('Start drive response status:', response.status);
            
            // Even if there's a 500 error, try to parse response
            let data;
            try {
                data = await response.json();
                console.log('Start drive response data:', data);
            } catch (parseError) {
                console.error('Error parsing response:', parseError);
                throw new Error(`Server error (status ${response.status}). Please try again later.`);
            }

            // If there's an existing session already managed by admin, the API now returns a 200 status with existing_session = true
            if (response.ok && data.code === 0) {
                console.log('Drive started or existing session found:', data.message);
                
                // Whether new or existing session, hide start button and show drive content
                startDriveButton.style.display = 'none';
                driveContentArea.style.display = 'block';
                
                // If this is an existing session, we need to check the status
                if (data.existing_session) {
                    console.log('Using existing session with ID:', data.session_id);
                    // Use the drive status API to get the current state
                    checkDriveStatus(token);
                } else {
                    // New drive started, fetch the first order
                    fetchNextOrder();
                }            } else {
                // Handle errors (e.g., insufficient balance, configuration issues)
                console.error('Failed to start drive:', data.info || data.message || 'Unknown error');
                
                // Check if this is a 409 conflict (existing session)
                if (response.status === 409) {
                    console.log('Existing session detected from 409 response, checking drive status...');
                    
                    // Hide the start button, show content area, and check status to resume
                    startDriveButton.style.display = 'none';
                    driveContentArea.style.display = 'block';
                    checkDriveStatus(token);
                } else {
                    // Other error, show message and reset button
                    alert('Failed to start drive: ' + (data.info || data.message || 'Unknown error'));
                    startDriveButton.disabled = false;
                    startDriveButton.textContent = 'Start Drive';
                }
            }} catch (error) {
            console.error('Error starting drive:', error);
            
            // Create a more detailed error message
            let errorMsg = error.message;
            if (error.response && error.response.status) {
                errorMsg += ` (Status: ${error.response.status})`;
            }
            
            // Show error to user and log it
            alert('Error starting drive: ' + errorMsg);
            
            // Add to browser console for debugging
            console.group('Drive Start Error Details');
            console.error('Error object:', error);
            console.error('Stack trace:', error.stack);
            console.groupEnd();
            
            // Re-enable button on error
            startDriveButton.disabled = false;
            startDriveButton.textContent = 'Start Drive';
        }
    }    // Function to fetch and display the next order/product
    async function fetchNextOrder() {
        console.log('Fetching next order...');
        // TODO: Show loading state in the drive content area
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/drive/getorder`, {
                method: 'POST', // Backend getOrder uses POST
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                 // No body needed for getorder based on backend controller
            });

            const data = await response.json();

            if (response.ok && data.success) {
                if (data.code === 0) { // Success, product received
                    console.log('Received order:', data);
                    renderProductCard(data); // Render the product details
                    updateWalletBalance(); // Update balance after getting order (optional, might update after save too)
                } else if (data.code === 2) { // Drive complete
                    console.log('Drive complete:', data.info);
                    displayDriveComplete(data.info); // Show drive complete message
                    updateWalletBalance(); // Final balance update
                } else {
                     // Handle other success codes or unexpected data structure
                     console.error('Received unexpected success data:', data);
                     alert('Received unexpected data while fetching order.');
                     displayDriveError('Received unexpected data.');
                }
            } else {
                 // Handle errors (e.g., no active session, no suitable products)
                 console.error('Failed to fetch order:', data.info || data.message || 'Unknown error');
                 alert('Failed to fetch order: ' + (data.info || data.message || 'Unknown error'));
                 displayDriveError(data.info || data.message || 'Unknown error');
            }
        } catch (error) {
            console.error('Error fetching order:', error);
            alert('Error fetching order: ' + error.message);
            displayDriveError('Error fetching order: ' + error.message);
        }
    }

    // Function to render the product details in a card
    function renderProductCard(productData) {
        // TODO: Implement rendering the product details in the HTML structure
        // This will involve creating/updating elements within driveContentArea
        console.log('renderProductCard received data:', productData); // More specific log
        if (productData.order_id === undefined || productData.order_id === null) {
             console.error("CRITICAL: order_id is missing in productData for renderProductCard!", productData);
             // Display an error to the user as saving will fail
             displayDriveError("An internal error occurred (missing order ID). Please try starting a new drive.");
             return; // Stop rendering if ID is missing
        }
        console.log('order_id is present in productData:', productData.order_id); // Confirm order_id is there

        driveContentArea.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h4>${productData.product_name || productData.product_number}</h4>
                    <img src="${productData.product_image}" alt="${productData.product_name}" style="max-width: 100px; margin: 10px 0;">
                    <p>Price: ${productData.product_price} USDT</p>
                    <p>Commission: ${productData.order_commission || productData.total_commission} USDT</p>
                    <button id="purchase-button" class="btn btn-primary">Purchase</button>
                </div>
            </div>
        `;
         // Add event listener to the new purchase button
        document.getElementById('purchase-button').addEventListener('click', () => handlePurchase(productData));
    }

    // Function to handle the Purchase button click
    async function handlePurchase(productData) {
        console.log('Purchase button clicked for product:', productData);
        // Disable purchase button
        const purchaseButton = document.getElementById('purchase-button');
        purchaseButton.disabled = true;
        purchaseButton.textContent = 'Processing...';        try {
            const response = await fetch(`${API_BASE_URL}/api/drive/saveorder`, { // Assuming saveOrder for single products
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    order_id: productData.order_id, // Include order_id
                    product_id: productData.product_id,
                    order_amount: productData.product_price, // Send price as order_amount
                    earning_commission: productData.order_commission, // Send commission
                    product_number: productData.product_number // Send task reference
                })
            });

            const data = await response.json();

            if (response.ok && data.code === 0) { // Assuming code 0 is success
                console.log('Order saved successfully:', data.info);
                updateWalletBalance(); // Update balance after successful purchase
                fetchNextOrder(); // Fetch the next order
            } else if (data.code === 3) { // Insufficient balance/Frozen
                 console.warn('Insufficient balance/Frozen:', data.info);
                 displayFrozenState(data.info, data.frozen_amount_needed); // Show frozen message
                 updateWalletBalance(); // Update balance to show frozen state if applicable
            }
            else {
                console.error('Failed to save order:', data.info || data.message || 'Unknown error');
                alert('Failed to save order: ' + (data.info || data.message || 'Unknown error'));
                 // Re-enable button on failure (unless frozen)
                 purchaseButton.disabled = false;
                 purchaseButton.textContent = 'Purchase';
            }
        } catch (error) {
            console.error('Error saving order:', error);
            alert('Error saving order: ' + error.message);
             // Re-enable button on error
            purchaseButton.disabled = false;
            purchaseButton.textContent = 'Purchase';
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
         // TODO: Add event listener for contact support button if needed
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
    checkDriveStatus(token); // New function call
});

// Function to check the current drive status and resume if necessary
async function checkDriveStatus(token) {
    console.log('checkDriveStatus function called.'); // Log at the start
    // Clear any pending animation timeouts
    if (animationTimeout) {
        clearTimeout(animationTimeout);
        animationTimeout = null;
        console.log('Cleared pending animation timeout.');
    }

    if (!token) {
        console.log('checkDriveStatus: No token found, returning.');
        return; // Should be handled by initial check, but good practice
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
            console.log('Drive status response received:', data); // Log the full response data
            console.log('Drive status:', data.status);
            if (data.status === 'active' && data.current_order) {
                console.log('checkDriveStatus: Active session with current order found. Resuming drive.');
                startDriveButton.style.display = 'none';
                driveContentArea.style.display = 'block';
                renderProductCard(data.current_order); // Render the current order
            } else if (data.status === 'frozen') {
                 console.log('checkDriveStatus: Frozen session found. Displaying frozen state.');
                 startDriveButton.style.display = 'none';
                 driveContentArea.style.display = 'block';
                 displayFrozenState(data.info || 'Your drive is frozen.', data.frozen_amount_needed); // Display frozen state
            } else if (data.status === 'complete') {
                 console.log('checkDriveStatus: Drive complete.');
                 displayDriveComplete(data.info || 'Your data drive is complete.'); // Display complete message
            } else if (data.status === 'no_session') {
                 console.log('checkDriveStatus: No active drive session found.');
                 startDriveButton.style.display = 'block';
                 driveContentArea.style.display = 'none'; // Ensure content area is hidden
            }
             else {
                 // Unexpected status
                 console.warn('checkDriveStatus: Received unexpected status:', data.status, 'with data:', data);
                 startDriveButton.style.display = 'block';
                 driveContentArea.style.display = 'none';
            }        } else {
            console.error('checkDriveStatus: Failed to check drive status:', data.info || data.message || 'Unknown error', 'Response:', response);
            
            // If we got a 500 error but have data, try to recover
            if (response.status === 500 && data.code === 1) {
                console.log('Detected a server error. Attempting to recover by fetching an order directly...');
                
                // Try fetching the order directly as a fallback
                try {
                    startDriveButton.style.display = 'none';
                    driveContentArea.style.display = 'block';
                    fetchNextOrder();
                    return;
                } catch (fallbackError) {
                    console.error('Fallback recovery also failed:', fallbackError);
                }
            }
            
            // Show an error message
            alert('Error checking drive status: ' + (data.info || data.message || 'Unknown error'));
            startDriveButton.style.display = 'block'; // Show start button on error
            driveContentArea.style.display = 'none';
        }
    } catch (error) {
        console.error('checkDriveStatus: Error checking drive status:', error);
        // Optionally display an error message to the user
         startDriveButton.style.display = 'block'; // Show start button on error
         driveContentArea.style.display = 'none';
    }
}

async function checkDriveStatus() {
    const token = localStorage.getItem('auth_token');
    if (!token) return false;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/drive/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        
        if (data.code === 0) {
            if (data.status === 'active' && data.current_order) {
                // Resume existing drive with current order
                renderCurrentOrder(data.current_order);
                updateProgressBar(data.tasks_completed, data.tasks_required);
                return true;
            } else if (data.status === 'frozen') {
                showFrozenDialog(data.frozen_amount_needed);
                return true;
            } else if (data.status === 'no_session') {
                return false;
            }
        }
        return false;
    } catch (error) {
        console.error('Error checking drive status:', error);
        return false;
    }
}

// Modify the document ready handler
$(document).ready(async function() {
    // Check for existing drive session first
    const hasActiveSession = await checkDriveStatus();
    if (!hasActiveSession) {
        // Only show start drive button if no active session
        $('#startDriveBtn').show();
    }
    
    // ... rest of the existing document ready code ...
});

// Update the startDrive function
async function startDrive() {
    try {
        // First check if there's an existing session
        const hasActiveSession = await checkDriveStatus();
        if (hasActiveSession) {
            return; // Session already exists and has been restored
        }

        // ... rest of the existing startDrive code ...
    } catch (error) {
        console.error('Error starting drive:', error);
        showError('Failed to start drive. Please try again.');
    }
}

// Add function to show frozen dialog
function showFrozenDialog(amountNeeded) {
    const message = `Your drive session is frozen. Please deposit at least ${amountNeeded} USDT to continue.`;
    // Use your preferred dialog/notification system
    alert(message); // Replace with your UI component
    // Optionally redirect to deposit page
    // window.location.href = '/deposits.html';
}
