/**
 * Admin Panel - Enhancement for Drive Data Tab
 * This file provides improved features for the admin panel's drive data tab:
 * 1. Fixed drive history viewing functionality
 * 2. Fixed reset drive functionality
 * 3. Dynamic data updates after each drive operation
 * 4. Enhanced commission tracking per drive
 * 5. Improved error handling
 */

// Global variable to track active Bootstrap modals
let activeModal = null;

/**
 * Safely creates and shows a modal with the given content
 * This avoids issues with Bootstrap modal initialization
 */
function createAndShowDriveModal(id, title, content) {
    console.log(`Creating modal with id: ${id}`);
    
    // Clean up any existing modal with this ID to prevent duplicates
    const existingModal = document.getElementById(id);
    if (existingModal) {
        console.log('Removing existing modal to prevent duplicates');
        existingModal.remove();
    }
    
    // Create modal HTML structure
    const modalHTML = `
        <div class="modal fade" id="${id}" tabindex="-1" aria-labelledby="${id}Label" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${id}Label">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">${content}</div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>`;
    
    // Add to DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer.firstChild);
    
    // Get the created modal element
    const modalElement = document.getElementById(id);
    
    // Try to initialize with Bootstrap
    try {
        if (typeof bootstrap !== 'undefined') {
            console.log('Initializing modal with Bootstrap');
            activeModal = new bootstrap.Modal(modalElement);
            activeModal.show();
            return true;
        } else {
            throw new Error('Bootstrap not available');
        }
    } catch (bootstrapError) {
        console.warn('Bootstrap modal initialization failed:', bootstrapError);
        
        // Try jQuery as fallback
        try {
            console.log('Trying jQuery modal as fallback');
            if (typeof $ !== 'undefined') {
                $(`#${id}`).modal('show');
                return true;
            } else {
                throw new Error('jQuery not available');
            }
        } catch (jqueryError) {
            console.error('Modal creation failed completely:', jqueryError);
            return false;
        }
    }
}

/**
 * Improved version of loadDriveHistory that handles API responses properly
 * and correctly displays the drive history in a modal
 */
async function enhancedLoadDriveHistory(userId, username) {
    console.log(`Starting enhancedLoadDriveHistory for userId=${userId}, username=${username}`);
    
    // Show loading notification
    showNotification('Loading drive history...', 'info');
    
    try {
        // Fetch drive history from API
        console.log(`Fetching data from /admin/drives/${userId}/logs`);
        const response = await fetchWithAuth(`/admin/drives/${userId}/logs`);
        console.log('API response received:', response);
        
        if (response.success) {
            // Check which property contains the history data
            const historyData = response.history || response.logs || response.drives || [];
            console.log(`History data found: ${historyData.length} entries`);
            
            // Create table content for the modal
            let tableContent = `
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead class="table-dark">
                            <tr>
                                <th scope="col">Date</th>
                                <th scope="col">Product</th>
                                <th scope="col">Commission</th>
                                <th scope="col">Status</th>
                            </tr>
                        </thead>
                        <tbody>`;
            
            // Add data rows or show "no data" message
            if (historyData.length > 0) {
                let totalCommission = 0;
                
                historyData.forEach(drive => {
                    // Extract commission amount and add to total
                    const commission = parseFloat(drive.commission_amount || drive.commission || 0);
                    totalCommission += commission;
                    
                    // Format date
                    const driveDate = new Date(drive.created_at);
                    const formattedDate = driveDate.toLocaleString();
                    
                    // Determine status class
                    const statusClass = (drive.status || 'pending').toLowerCase();
                    
                    // Add table row
                    tableContent += `
                        <tr>
                            <td>${formattedDate}</td>
                            <td>${drive.product_name || 'N/A'}</td>
                            <td class="text-right">$${commission.toFixed(2)}</td>
                            <td>
                                <span class="status-badge status-${statusClass}">
                                    ${drive.status || 'PENDING'}
                                </span>
                            </td>
                        </tr>`;
                });
                
                // Add summary row with total commission
                tableContent += `
                    <tr class="table-info">
                        <td colspan="2"><strong>Total</strong></td>
                        <td class="text-right"><strong>$${totalCommission.toFixed(2)}</strong></td>
                        <td></td>
                    </tr>`;
            } else {
                tableContent += `
                    <tr>
                        <td colspan="4" class="text-center">
                            <em>No drive history found for this user.</em>
                        </td>
                    </tr>`;
            }
            
            tableContent += `</tbody></table></div>`;
            
            // Add timestamp to show when data was retrieved
            tableContent += `
                <div class="text-muted small text-end mt-3">
                    Data retrieved: ${new Date().toLocaleString()}
                </div>`;
            
            // Show the modal with drive history
            const title = `Drive History for ${username}`;
            const success = createAndShowDriveModal('driveHistoryModal', title, tableContent);
            
            if (!success) {
                // Fallback method if modal creation fails
                console.warn('Modal creation failed, using alert fallback');
                alert(`Drive History for ${username}\n\n${historyData.length} entries found.`);
            }
        } else {
            // Handle API error response
            console.warn('API returned success: false', response);
            showNotification(`Failed to load drive history: ${response.message || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        // Handle exceptions
        console.error('Error loading drive history:', error);
        showNotification(`Error loading drive history: ${error.message}`, 'error');
    }
}

/**
 * Enhanced function to reset drive data for a specific user
 */
async function enhancedResetDrive(userId, username) {
    console.log(`Resetting drive for userId: ${userId}, username: ${username}`);
    
    // Show confirmation dialog
    if (!confirm(`Are you sure you want to reset drive data for ${username}?`)) {
        console.log('Reset drive cancelled by user');
        return;
    }
    
    // Show loading notification
    showNotification('Resetting drive data...', 'info');
    
    try {
        // Call API to reset drive
        console.log(`Calling API endpoint: /admin/drives/reset/${userId}`);
        const response = await fetchWithAuth(`/admin/drives/reset/${userId}`, {
            method: 'POST'
        });
        console.log('Reset drive API response:', response);
        
        if (response.success) {
            // Show success message
            showNotification(`Drive data for ${username} has been reset successfully`, 'success');
            
            // Refresh the drive data in the table
            await enhancedRefreshDriveData(userId);
        } else {
            // Handle API error
            console.warn('API returned success: false', response);
            showNotification(`Failed to reset drive: ${response.message || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        // Handle exceptions
        console.error('Error resetting drive:', error);
        showNotification(`Error resetting drive: ${error.message}`, 'error');
    }
}

/**
 * Enhanced function to refresh drive data for a specific user
 */
async function enhancedRefreshDriveData(userId) {
    console.log(`Refreshing drive data for userId: ${userId}`);
    
    try {
        // Fetch updated drive data
        const response = await fetchWithAuth(`/admin/drives/${userId}`);
        
        if (response.success && response.drive) {
            console.log('Received updated drive data:', response.drive);
            
            // Find the row with the matching user ID
            const driveRow = document.querySelector(`.data-row[data-user-id="${userId}"]`);
            
            if (driveRow) {
                // Update row with fresh data
                const totalDrivesCell = driveRow.querySelector('.total-drives');
                const totalCommissionCell = driveRow.querySelector('.total-commission');
                const lastDriveCell = driveRow.querySelector('.last-drive-date');
                const statusCell = driveRow.querySelector('.status-badge');
                
                if (totalDrivesCell) totalDrivesCell.textContent = response.drive.total_drives || '0';
                
                if (totalCommissionCell) {
                    const commission = parseFloat(response.drive.total_commission || 0).toFixed(2);
                    totalCommissionCell.textContent = `$${commission}`;
                }
                
                if (lastDriveCell && response.drive.last_drive) {
                    const lastDriveDate = new Date(response.drive.last_drive);
                    lastDriveCell.textContent = lastDriveDate.toLocaleDateString();
                } else if (lastDriveCell) {
                    lastDriveCell.textContent = 'Never';
                }
                
                if (statusCell) {
                    const status = response.drive.status || 'INACTIVE';
                    statusCell.className = `status-badge status-${status.toLowerCase()}`;
                    statusCell.textContent = status;
                }
                
                // Highlight the row to indicate it was updated
                driveRow.classList.add('table-highlight');
                setTimeout(() => {
                    driveRow.classList.remove('table-highlight');
                }, 2000);
                
                console.log('Drive data updated in the UI');
            } else {
                console.warn(`Row with user ID ${userId} not found in the table`);
            }
        } else {
            console.warn('Failed to fetch updated drive data:', response);
        }
    } catch (error) {
        console.error('Error refreshing drive data:', error);
    }
}

/**
 * Set up event listeners for drive-related actions
 */
function setupDriveEventHandlers() {
    console.log('Setting up drive event handlers');
    
    document.addEventListener('click', function(event) {
        // Handler for view drive history button
        if (event.target.matches('.view-drive-history-btn')) {
            event.preventDefault();
            
            const userId = event.target.dataset.userId;
            const username = event.target.dataset.username;
            
            console.log(`View drive history clicked for userId=${userId}, username=${username}`);
            enhancedLoadDriveHistory(userId, username);
        }
        
        // Handler for reset drive button
        if (event.target.matches('.reset-drive-btn')) {
            event.preventDefault();
            
            const userId = event.target.dataset.userId;
            const username = event.target.dataset.username;
            
            console.log(`Reset drive clicked for userId=${userId}, username=${username}`);
            enhancedResetDrive(userId, username);
        }
    });
}

/**
 * Update the drive table structure to add data attributes and custom classes
 * for easier targeting and styling
 */
function enhanceDriveTable() {
    console.log('Enhancing drive table structure');
    
    const driveTable = document.querySelector('#drives-table');
    
    if (!driveTable) {
        console.warn('Drive table not found');
        return;
    }
    
    // Add data-user-id attribute to each row for easier targeting
    const rows = driveTable.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const viewButton = row.querySelector('.view-drive-history-btn');
        if (viewButton) {
            const userId = viewButton.dataset.userId;
            row.setAttribute('data-user-id', userId);
            row.classList.add('data-row');
        }
        
        // Add classes to cells for easier targeting
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
            cells[1].classList.add('total-drives');
            cells[2].classList.add('total-commission');
            cells[3].classList.add('last-drive-date');
        }
    });
    
    console.log('Drive table enhanced');
}

/**
 * Add custom CSS for enhanced styling
 */
function addCustomStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .table-highlight {
            animation: highlight-row 2s ease-in-out;
        }
        
        @keyframes highlight-row {
            0% { background-color: inherit; }
            50% { background-color: rgba(40, 167, 69, 0.2); }
            100% { background-color: inherit; }
        }
        
        .status-badge {
            display: inline-block;
            padding: 0.25em 0.6em;
            font-size: 0.75em;
            font-weight: 700;
            border-radius: 0.25rem;
            text-transform: uppercase;
        }
        
        .status-active, .status-approved {
            background-color: rgba(40, 167, 69, 0.2);
            color: #155724;
        }
        
        .status-inactive, .status-rejected {
            background-color: rgba(220, 53, 69, 0.2);
            color: #721c24;
        }
        
        .status-pending {
            background-color: rgba(255, 193, 7, 0.2);
            color: #856404;
        }
    `;
    
    document.head.appendChild(styleElement);
}

// Initialize all enhancements when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing drive data enhancements');
    
    // Add custom styles
    addCustomStyles();
    
    // Setup event handlers
    setupDriveEventHandlers();
    
    // Enhance table structure (do this after the table is loaded)
    setTimeout(enhanceDriveTable, 500);
    
    console.log('Drive data enhancements initialized');
});
