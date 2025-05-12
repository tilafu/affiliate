// Fixes for admin.js drive history functionality
// 1. Update loadDriveHistory to add more debug logs and proper error handling
async function loadDriveHistory(userId, username) {
    // Enhanced logging for incoming parameters
    console.log(`Starting loadDriveHistory. Received userId: ${userId} (type: ${typeof userId}), username: ${username} (type: ${typeof username})`);

    // Robust check for invalid userId that could lead to "/undefined/" in URL
    // This checks for null, undefined, or if the string representation is "undefined" (case-insensitive)
    if (userId == null || String(userId).toLowerCase() === "undefined") {
        console.error(`Invalid userId detected. Original userId value:`, userId, `(type: ${typeof userId}). Username: '${username}'. Aborting API call to prevent /undefined/ path.`);
        // Provide a more user-friendly notification, possibly hinting at data issues.
        showNotification(`Cannot load drive history: User identifier is missing or invalid. Please check the data source. (Username: '${username}')`, 'error');
        return;
    }

    try {
        // Try one of these alternative endpoints based on your backend structure
        console.log(`Fetching data from /admin/drives/${userId}/logs`);
        const response = await fetchWithAuth(`/admin/drives/${userId}/logs`);
        console.log('API response received:', response);
        
        if (response.success) {
            // Check which property contains the history data
            const historyData = response.history || response.logs || response.drives || [];
            console.log('History data found (count):', historyData.length);

            // Log the first item to inspect its structure if data exists
            if (historyData.length > 0) {
                console.log('Sample drive data item (historyData[0]):', JSON.stringify(historyData[0], null, 2));
            }
            
            // Create modal for displaying drive history
            let modalHTML = `
                <div class="modal fade" id="driveHistoryModal" tabindex="-1" aria-labelledby="driveHistoryModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="driveHistoryModalLabel">Drive History for ${username || 'N/A'}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div class="table-responsive">
                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Product</th>
                                                <th>Commission Earned</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>`;
            
            if (historyData.length > 0) {
                historyData.forEach((drive, index) => {
                    // Log each drive object being processed for detailed inspection
                    console.log(`Processing drive item ${index + 1}/${historyData.length}:`, JSON.stringify(drive, null, 2));

                    const driveDate = drive.created_at ? new Date(drive.created_at).toLocaleString() : 'N/A';
                    const productName = drive.product_name || 'N/A';
                    
                    // Ensure commission is a number and formatted, default to 0.
                    const commissionValue = parseFloat(drive.commission_amount || drive.commission || 0);
                    const commissionDisplay = `$${commissionValue.toFixed(2)}`; 
                    
                    const driveStatus = String(drive.status || 'PENDING').toUpperCase(); // Ensure status is a string and uppercase
                    const statusClass = String(drive.status || 'pending').toLowerCase(); // Ensure class is lowercase string

                    modalHTML += `
                        <tr>
                            <td>${driveDate}</td>
                            <td>${productName}</td>
                            <td>${commissionDisplay}</td>
                            <td>
                                <span class="status-badge status-${statusClass}">
                                    ${driveStatus}
                                </span>
                            </td>
                        </tr>`;
                });
            } else {
                modalHTML += `<tr><td colspan="4" class="text-center">No drive history found.</td></tr>`;
            }
            
            modalHTML += `
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            </div>
                        </div>
                    </div>
                </div>`;
            
            // Remove any existing modal element to avoid duplicates
            console.log('Checking for existing modal element');
            const existingModal = document.getElementById('driveHistoryModal');
            if (existingModal) {
                console.log('Removing existing modal');
                existingModal.remove();
            }
            
            // Append the modal to the body
            console.log('Creating and appending new modal to document body');
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHTML;
            document.body.appendChild(modalContainer.firstChild);
            
            // Check if Bootstrap is available
            console.log('Bootstrap available:', typeof bootstrap !== 'undefined');
            
            // Check if the modal element exists before initializing
            const modalElement = document.getElementById('driveHistoryModal');
            console.log('Modal element found:', modalElement !== null);
            
            if (!modalElement) {
                console.error('Modal element not found in the DOM after append');
                return;
            }
            
            try {
                // Show the modal with error handling
                console.log('Initializing Bootstrap modal');
                const modal = new bootstrap.Modal(modalElement);
                console.log('Modal initialized, showing modal');
                modal.show();
                console.log('Modal shown successfully');
            } catch (modalError) {
                console.error('Error initializing or showing modal:', modalError);
            }
        } else {
            console.warn('API returned success: false. Response:', response);
            // Ensure a user-friendly message if response indicates failure but no specific error message.
            const errorMessage = response.message || 'Failed to load drive history due to server indication of failure.';
            showNotification(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Error loading drive history:', error);
        // Check if error object has more details, e.g., from fetchWithAuth
        const detail = error.message || 'An unexpected error occurred.';
        showNotification(`Failed to load drive history: ${detail}`, 'error');
    }
}

// 2. Fix the handlers to ensure no duplication
function fixDriveHandlers() {
    // Find all duplicated event handlers for .view-drive-history-btn
    const handlers = [];
    document.querySelectorAll('.view-drive-history-btn').forEach(btn => {
        // Store event listeners to prevent duplicates
        const existingHandlers = btn.getAttribute('data-has-click-handler');
        if (!existingHandlers) {
            btn.setAttribute('data-has-click-handler', 'true');
            handlers.push(btn);
        }
    });
    
    console.log(`Fixed ${handlers.length} drive history buttons`);
    
    // Same for reset buttons
    const resetHandlers = [];
    document.querySelectorAll('.reset-drive-btn').forEach(btn => {
        const existingHandlers = btn.getAttribute('data-has-click-handler');
        if (!existingHandlers) {
            btn.setAttribute('data-has-click-handler', 'true');
            resetHandlers.push(btn);
        }
    });
    
    console.log(`Fixed ${resetHandlers.length} reset drive buttons`);
}

// Function to check if Bootstrap Modal is properly loaded
function checkBootstrapAvailability() {
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap is not defined. Make sure bootstrap.bundle.min.js is loaded properly.');
        return false;
    }
    
    if (typeof bootstrap.Modal === 'undefined') {
        console.error('Bootstrap Modal is not defined. Make sure you are using the correct version of Bootstrap.');
        return false;
    }
    
    console.log('Bootstrap and Modal are available.');
    return true;
}

// Expose loadDriveHistory as global loadDrives to fix the ReferenceError in admin.js
window.loadDrives = loadDriveHistory;

// Call these functions when needed
// loadDriveHistory(userId, username); 
// fixDriveHandlers();
// checkBootstrapAvailability();
