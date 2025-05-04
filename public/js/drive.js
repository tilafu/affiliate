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

    // Event listener for the Start Drive button
    if (startDriveButton) {
        startDriveButton.addEventListener('click', handleStartDrive);
    }

    // TODO: Add event listener for the Purchase button (will be inside the dynamically created card)

    // Function to handle the Start Drive button click
    async function handleStartDrive() {
        console.log('Start Drive button clicked');
        // Disable the button and show loading state
        startDriveButton.disabled = true;
        startDriveButton.textContent = 'Starting...';

        try {
            const response = await fetch('/api/drive/start', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' // Assuming POST requires Content-Type
                },
                // No body needed for start drive based on backend controller
            });

            const data = await response.json();

            if (response.ok && data.code === 0) { // Assuming code 0 is success
                console.log('Drive started successfully:', data.info);
                // Hide start button, show drive content area
                startDriveButton.style.display = 'none';
                driveContentArea.style.display = 'block'; // Assuming this area is initially hidden
                // Fetch and display the first product
                fetchNextOrder();
            } else {
                // Handle errors (e.g., existing session, insufficient balance)
                console.error('Failed to start drive:', data.info || data.message || 'Unknown error');
                alert('Failed to start drive: ' + (data.info || data.message || 'Unknown error')); // Basic error display
                 // Re-enable button on failure
                startDriveButton.disabled = false;
                startDriveButton.textContent = 'Start Drive';
            }
        } catch (error) {
            console.error('Error starting drive:', error);
            alert('Error starting drive: ' + error.message); // Basic error display
             // Re-enable button on error
            startDriveButton.disabled = false;
            startDriveButton.textContent = 'Start Drive';
        }
    }

    // Function to fetch and display the next order/product
    async function fetchNextOrder() {
        console.log('Fetching next order...');
        // TODO: Show loading state in the drive content area

        try {
            const response = await fetch('/api/drive/getorder', {
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
        purchaseButton.textContent = 'Processing...';

        try {
            const response = await fetch('/api/drive/saveorder', { // Assuming saveOrder for single products
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
            const response = await fetch('/api/user/balance', { // Assuming this endpoint exists
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                walletBalanceElement.textContent = data.balance.toFixed(2);
            } else {
                console.error('Failed to fetch updated balance:', data.message);
                walletBalanceElement.textContent = 'Error'; // Indicate error
            }
        } catch (error) {
            console.error('Error fetching updated balance:', error);
            walletBalanceElement.textContent = 'Error'; // Indicate error
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
        const response = await fetch('/api/drive/status', {
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
            }
        } else {
            console.error('checkDriveStatus: Failed to check drive status:', data.info || data.message || 'Unknown error', 'Response:', response);
            // Optionally display an error message to the user
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
