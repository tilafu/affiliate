/**
 * Admin Panel - Enhanced Drive Data Management
 * This script fixes the drive history view and reset functionality, and
 * adds dynamic data updates after each drive operation.
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing drive data enhancements');
    
    // Set up event handlers for the drive history and reset buttons
    setupDriveEventHandlers();
    
    // Add custom styles for better visual feedback
    addDriveDataStyles();
});

/**
 * Set up event handlers for drive-related actions
 */
function setupDriveEventHandlers() {
    // Use event delegation for better performance
    document.addEventListener('click', function(event) {
        // View drive history button handler
        if (event.target.closest('.view-drive-history-btn')) {
            const button = event.target.closest('.view-drive-history-btn');
            event.preventDefault();
            
            const userId = button.dataset.userId;
            const username = button.dataset.username;
            
            console.log(`View drive history clicked for userId=${userId}, username=${username}`);
            loadEnhancedDriveHistory(userId, username);
        }
        
        // Reset drive button handler
        if (event.target.closest('.reset-drive-btn')) {
            const button = event.target.closest('.reset-drive-btn');
            event.preventDefault();
            
            const userId = button.dataset.userId;
            const username = button.dataset.username || 'this user';
            
            console.log(`Reset drive clicked for userId=${userId}`);
            resetDriveEnhanced(userId, username);
        }
    });
}

/**
 * Enhanced drive history loading function with better error handling
 */
async function loadEnhancedDriveHistory(userId, username) {
    console.log(`Loading drive history for userId=${userId}, username=${username}`);
    
    try {
        // First show a loading message
        showNotification('Loading drive history...', 'info');
        
        // Fetch drive logs from API
        const response = await fetchWithAuth(`/admin/drives/${userId}/logs`);
        console.log('Drive history API response:', response);
        
        if (response.success) {
            // Get the history data from the response
            const historyData = response.history || response.logs || response.drives || [];
            console.log(`Found ${historyData.length} drive history entries`);
            
            // Create HTML for the drive history table
            let tableContent = `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Product</th>
                                <th>Commission</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>`;
            
            if (historyData.length > 0) {
                // Calculate total commission as we build the table
                let totalCommission = 0;
                
                historyData.forEach(drive => {
                    // Extract and format the drive date
                    const driveDate = new Date(drive.created_at);
                    const formattedDate = driveDate.toLocaleString();
                    
                    // Extract commission amount
                    const commission = parseFloat(drive.commission_amount || drive.commission || 0);
                    totalCommission += commission;
                    
                    // Build table row
                    tableContent += `
                        <tr>
                            <td>${formattedDate}</td>
                            <td>${drive.product_name || 'N/A'}</td>
                            <td>$${commission.toFixed(2)}</td>
                            <td>
                                <span class="badge bg-${getStatusColor(drive.status)}">
                                    ${drive.status || 'PENDING'}
                                </span>
                            </td>
                        </tr>`;
                });
                
                // Add a summary row with total commission
                tableContent += `
                    <tr class="table-info">
                        <td colspan="2"><strong>Total Commission</strong></td>
                        <td><strong>$${totalCommission.toFixed(2)}</strong></td>
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
            
            // Show the modal with the drive history
            showDriveHistoryModal(`Drive History - ${username}`, tableContent);
        } else {
            console.warn('API returned error:', response);
            showNotification(`Failed to load drive history: ${response.message || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error loading drive history:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

/**
 * Enhanced reset drive function with confirmation and better feedback
 */
async function resetDriveEnhanced(userId, username) {
    // Show confirmation dialog
    if (!confirm(`Are you sure you want to reset drive data for ${username}?`)) {
        console.log('Reset drive cancelled by user');
        return;
    }
    
    console.log(`Resetting drive for userId: ${userId}`);
    showNotification('Processing reset request...', 'info');
    
    try {
        // Call API to reset drive
        const response = await fetchWithAuth(`/admin/drives/reset/${userId}`, {
            method: 'POST'
        });
        console.log('Reset drive API response:', response);
        
        if (response.success) {
            showNotification('Drive reset successfully', 'success');
            
            // Refresh the drive data in the table
            await refreshDriveRow(userId);
        } else {
            console.warn('API returned error:', response);
            showNotification(`Failed to reset drive: ${response.message || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error resetting drive:', error);
        showNotification(`Error: ${error.message}`, 'error');
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
        } else {
            console.warn('Failed to fetch drive data:', response);
            
            // Reload the entire table as fallback
            if (typeof loadDrives === 'function') {
                await loadDrives();
            }
        }
    } catch (error) {
        console.error('Error refreshing drive row:', error);
        showNotification('Failed to refresh drive data', 'error');
    }
}

/**
 * Find a drive row by user ID
 */
function findDriveRowById(userId) {
    // Look for row with matching user ID in various ways
    
    // First, try data-user-id attribute
    const rowByAttr = document.querySelector(`tr[data-user-id="${userId}"]`);
    if (rowByAttr) return rowByAttr;
    
    // Next, try finding it by the button's data attribute
    const button = document.querySelector(`.view-drive-history-btn[data-user-id="${userId}"]`);
    if (button) {
        const row = button.closest('tr');
        if (row) return row;
    }
    
    return null;
}

/**
 * Update a drive row with new data
 */
function updateDriveRowData(row, driveData) {
    // Get the cells in the row
    const cells = row.querySelectorAll('td');
    
    // Make sure we have enough cells
    if (cells.length >= 5) {
        // Update total drives
        if (driveData.total_drives !== undefined) {
            cells[1].textContent = driveData.total_drives;
        }
        
        // Update total commission
        if (driveData.total_commission !== undefined) {
            const commission = parseFloat(driveData.total_commission).toFixed(2);
            cells[2].textContent = `$${commission}`;
        }
        
        // Update last drive date
        if (driveData.last_drive) {
            const lastDriveDate = new Date(driveData.last_drive);
            cells[3].textContent = lastDriveDate.toLocaleDateString();
        } else {
            cells[3].textContent = 'Never';
        }
        
        // Update status
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
    // Remove highlight class if it exists
    row.classList.remove('highlight-update');
    
    // Force a reflow
    void row.offsetWidth;
    
    // Add highlight class
    row.classList.add('highlight-update');
    
    // Remove highlight after animation completes
    setTimeout(() => {
        row.classList.remove('highlight-update');
    }, 2000);
}

/**
 * Show drive history modal
 */
function showDriveHistoryModal(title, content) {
    // Check if the createAndShowModal function exists (added in admin.html)
    if (typeof createAndShowModal === 'function') {
        return createAndShowModal('driveHistoryModal', title, content);
    }
    
    // Implementation if createAndShowModal doesn't exist
    
    // First remove any existing modal
    const existingModal = document.getElementById('driveHistoryModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create a new modal
    const modalHTML = `
        <div class="modal fade" id="driveHistoryModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
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
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Try to show with Bootstrap
    try {
        if (typeof bootstrap !== 'undefined') {
            const modalElement = document.getElementById('driveHistoryModal');
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
            return true;
        }
    } catch (bootstrapError) {
        console.warn('Bootstrap modal failed:', bootstrapError);
    }
    
    // Try jQuery fallback
    try {
        if (typeof $ !== 'undefined') {
            $('#driveHistoryModal').modal('show');
            return true;
        }
    } catch (jqueryError) {
        console.warn('jQuery modal failed:', jqueryError);
    }
    
    // Last resort - alert
    alert(`${title}\n\nCould not show modal. Check console for details.`);
    return false;
}

/**
 * Get Bootstrap color class based on status
 */
function getStatusColor(status) {
    status = (status || '').toLowerCase();
    
    switch (status) {
        case 'active':
        case 'approved':
            return 'success';
        case 'inactive':
        case 'rejected':
            return 'danger';
        case 'pending':
            return 'warning';
        default:
            return 'secondary';
    }
}

/**
 * Add custom styles for drive data
 */
function addDriveDataStyles() {
    // Create style element
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        .highlight-update {
            animation: highlight-fade 2s ease;
        }
        
        @keyframes highlight-fade {
            0% { background-color: transparent; }
            30% { background-color: rgba(255, 243, 205, 0.8); }
            100% { background-color: transparent; }
        }
        
        .status-badge {
            display: inline-block;
            padding: 0.25em 0.5em;
            font-size: 0.75em;
            font-weight: 700;
            line-height: 1;
            text-align: center;
            white-space: nowrap;
            vertical-align: baseline;
            border-radius: 0.25rem;
            text-transform: uppercase;
        }
        
        .status-active, .status-approved {
            background-color: #d4edda;
            color: #155724;
        }
        
        .status-inactive, .status-rejected {
            background-color: #f8d7da;
            color: #721c24;
        }
        
        .status-pending {
            background-color: #fff3cd;
            color: #856404;
        }
    `;
    
    // Append to document
    document.head.appendChild(styleEl);
}
