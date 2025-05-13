/**
 * Admin Panel - Enhanced Drive Data Management
 * This script fixes the drive history view and reset functionality, and
 * adds dynamic data updates after each drive operation.
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing drive data enhancements');
    // Add custom styles for better visual feedback
    addDriveDataStyles();
});

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
        // Call API to reset drive        console.log(`Calling API endpoint: /api/admin/users/${userId}/reset-drive`);
        const response = await fetchWithAuth(`/api/admin/users/${userId}/reset-drive`, {
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
 * Refresh a specific drive row in the table
 */
async function refreshDriveRow(userId) {
    try {
        console.log(`Refreshing drive data for userId: ${userId}`);
        
        // Fetch updated drive data for this user
        const response = await fetchWithAuth(`/admin/drives/${userId}`);
        
        if (response.success && response.drive) {
            // Find the row with this user ID
            const row = findDriveRowById(userId);
            
            if (row) {
                // Update the row with new data
                updateDriveRowData(row, response.drive);
                
                // Add a visual highlight effect
                highlightUpdatedRow(row);
            } else {
                console.warn(`Row for user ID ${userId} not found in table`);
                
                // If we can't find the row, reload the entire table
                if (typeof loadDrives === 'function') {
                    await loadDrives();
                }
            }
        }
    } catch (error) {
        console.error('Error refreshing drive data:', error);
    }
}

/**
 * Find a drive row by user ID
 */
function findDriveRowById(userId) {
    return document.querySelector(`tr[data-user-id="${userId}"]`);
}

/**
 * Update a drive row with new data
 */
function updateDriveRowData(row, driveData) {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 5) {
        // Update total drives
        cells[1].textContent = driveData.total_drives || '0';
        
        // Update total commission
        const commission = parseFloat(driveData.total_commission || 0).toFixed(2);
        cells[2].textContent = `$${commission}`;
        
        // Update last drive date
        if (driveData.last_drive) {
            const lastDriveDate = new Date(driveData.last_drive);
            cells[3].textContent = lastDriveDate.toLocaleDateString();
        } else {
            cells[3].textContent = 'Never';
        }
        
        // Update status badge
        const statusBadge = cells[4].querySelector('.status-badge');
        if (statusBadge && driveData.status) {
            statusBadge.className = `status-badge status-${driveData.status.toLowerCase()}`;
            statusBadge.textContent = driveData.status;
        }
    }
}

/**
 * Add highlight effect to updated row
 */
function highlightUpdatedRow(row) {
    row.classList.add('highlight-update');
    setTimeout(() => row.classList.remove('highlight-update'), 2000);
}

/**
 * Add custom styles for drive data
 */
function addDriveDataStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .highlight-update {
            animation: highlightEffect 2s ease-in-out;
        }
        @keyframes highlightEffect {
            0% { background-color: transparent; }
            50% { background-color: rgba(255, 255, 0, 0.2); }
            100% { background-color: transparent; }
        }
        .status-badge {
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.875em;
        }
    `;
    document.head.appendChild(style);
}
