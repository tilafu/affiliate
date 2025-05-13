/**
 * Enhanced Drive Data Management
 * 
 * This script adds the following features to the admin panel's drive data tab:
 * 1. Dynamically update data after each drive (last drive, commission)
 * 2. Add a button per user showing their drive history
 * 3. Display commission earned per drive
 * 4. Fix 404 errors when trying to view drive history and reset drives
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing enhanced drive data management');
    
    // Add event listeners for drive-related actions
    setupEnhancedDriveButtons();
    
    // Add custom styles for better visual feedback
    addCustomDriveStyles();
    
    // Set up periodic drive data refresh
    setupDriveDataRefresh();
});

/**
 * Set up event handlers for drive-related buttons
 * NOTE: Event handlers are now centralized in admin-drives.js
 */
function setupEnhancedDriveButtons() {
    // Event handlers moved to admin-drives.js for centralization
    console.log('Enhanced drive buttons are now managed in admin-drives.js');
}

/**
 * Load and display drive history with enhanced features
 */
async function loadEnhancedDriveHistory(userId, username) {
    console.log(`Loading enhanced drive history for user ${username} (ID: ${userId})`);
    
    try {
        // Show loading notification
        showNotification('Loading drive history...', 'info');
        
        // Call API to get drive history
        const response = await fetchWithAuth(`/admin/drives/${userId}/logs`);
        console.log('Drive history API response:', response);
        
        if (response.success) {
            // Get drive history data from response
            const historyData = response.history || response.logs || response.drives || [];
            console.log(`Found ${historyData.length} drive history entries`);
            
            // Calculate total commission
            let totalCommission = 0;
            historyData.forEach(drive => {
                const commission = parseFloat(drive.commission_amount || drive.commission || 0);
                totalCommission += commission;
            });
            
            // Create table for drive history
            let tableHTML = `
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Product</th>
                                <th>Commission</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>`;
            
            // Add rows for each drive
            if (historyData.length > 0) {
                historyData.forEach(drive => {
                    const driveDate = new Date(drive.created_at);
                    const commission = parseFloat(drive.commission_amount || drive.commission || 0);
                    const status = drive.status || 'PENDING';
                    const statusClass = status.toLowerCase();
                    
                    tableHTML += `
                        <tr>
                            <td>${driveDate.toLocaleString()}</td>
                            <td>${drive.product_name || 'N/A'}</td>
                            <td>$${commission.toFixed(2)}</td>
                            <td><span class="status-badge status-${statusClass}">${status}</span></td>
                        </tr>`;
                });
                
                // Add summary row
                tableHTML += `
                    <tr class="table-info">
                        <td colspan="2"><strong>Total Commission</strong></td>
                        <td><strong>$${totalCommission.toFixed(2)}</strong></td>
                        <td></td>
                    </tr>`;
            } else {
                // No drive history
                tableHTML += `
                    <tr>
                        <td colspan="4" class="text-center">No drive history found</td>
                    </tr>`;
            }
            
            tableHTML += `</tbody></table></div>`;
            
            // Add timestamp
            tableHTML += `
                <div class="text-muted mt-2 small">
                    Data as of ${new Date().toLocaleString()}
                </div>`;
            
            // Show modal with drive history
            showDriveHistoryModal(`Drive History for ${username}`, tableHTML);
        } else {
            // Handle API error
            console.warn('API returned error:', response);
            showNotification(`Failed to load drive history: ${response.message || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        // Handle exception
        console.error('Error loading drive history:', error);
        showNotification(`Error loading drive history: ${error.message}`, 'error');
    }
}

/**
 * Enhanced reset drive function with confirmation and error handling
 */
async function enhancedResetDrive(userId, username) {
    // Show confirmation
    if (!confirm(`Are you sure you want to reset drive data for ${username}?`)) {
        console.log('Reset drive cancelled by user');
        return;
    }
    
    console.log(`Resetting drive for user ${username} (ID: ${userId})`);
    showNotification('Resetting drive data...', 'info');
    
    try {
        // Call API to reset drive
        const response = await fetchWithAuth(`/admin/drives/reset/${userId}`, {
            method: 'POST'
        });
        console.log('Reset drive API response:', response);
        
        if (response.success) {
            // Show success message
            showNotification(`Drive data for ${username} has been reset successfully`, 'success');
            
            // Refresh drive data in the UI
            await enhancedRefreshDriveData(userId);
        } else {
            // Handle API error
            console.warn('API returned error:', response);
            showNotification(`Failed to reset drive: ${response.message || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        // Handle exception
        console.error('Error resetting drive:', error);
        showNotification(`Error resetting drive: ${error.message}`, 'error');
    }
}

/**
 * Refresh drive data for a specific user
 */
async function enhancedRefreshDriveData(userId) {
    console.log(`Refreshing drive data for user ID: ${userId}`);
    
    try {
        // Fetch updated drive data
        const response = await fetchWithAuth(`/admin/drives/${userId}`);
        
        if (response.success && response.drive) {
            console.log('Received updated drive data:', response.drive);
            
            // Find the row for this user
            const row = document.querySelector(`tr[data-user-id="${userId}"]`) || 
                         document.querySelector(`.view-drive-history-btn[data-user-id="${userId}"]`)?.closest('tr');
            
            if (row) {
                // Get cells in the row
                const cells = row.querySelectorAll('td');
                
                // Update cells with new data if we have enough cells
                if (cells.length >= 5) {
                    // Update total drives
                    cells[1].textContent = response.drive.total_drives || '0';
                    
                    // Update total commission
                    const commission = parseFloat(response.drive.total_commission || 0).toFixed(2);
                    cells[2].textContent = `$${commission}`;
                    
                    // Update last drive date
                    if (response.drive.last_drive) {
                        const lastDriveDate = new Date(response.drive.last_drive);
                        cells[3].textContent = lastDriveDate.toLocaleDateString();
                    } else {
                        cells[3].textContent = 'Never';
                    }
                    
                    // Update status
                    const statusBadge = cells[4].querySelector('.status-badge');
                    if (statusBadge) {
                        const status = response.drive.status || 'INACTIVE';
                        statusBadge.className = `status-badge status-${status.toLowerCase()}`;
                        statusBadge.textContent = status;
                    }
                    
                    // Add highlight effect to row
                    highlightRow(row);
                }
            } else {
                console.warn(`Row for user ID ${userId} not found`);
                
                // If we can't find the specific row, reload all drives
                if (typeof loadDrives === 'function') {
                    await loadDrives();
                }
            }
        } else {
            console.warn('Failed to fetch updated drive data:', response);
        }
    } catch (error) {
        console.error('Error refreshing drive data:', error);
    }
}

/**
 * Set up periodic refresh of drive data
 */
function setupDriveDataRefresh() {
    // Refresh drive data every 30 seconds
    setInterval(function() {
        // Only refresh if we're on the drives tab
        const drivesSection = document.getElementById('drives-section');
        if (drivesSection && window.getComputedStyle(drivesSection).display !== 'none') {
            console.log('Refreshing all drive data');
            
            // Call the original loadDrives function to refresh all data
            if (typeof loadDrives === 'function') {
                loadDrives();
            }
        }
    }, 30000); // 30 seconds
}

/**
 * Show drive history modal
 */
function showDriveHistoryModal(title, content) {
    // Check if we have the built-in createAndShowModal function
    if (typeof createAndShowModal === 'function') {
        createAndShowModal('driveHistoryModal', title, content);
        return;
    }
    
    console.log('Creating custom drive history modal');
    
    // Remove any existing modal with this ID
    const existingModal = document.getElementById('driveHistoryModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal HTML
    const modalHTML = `
        <div class="modal fade" id="driveHistoryModal" tabindex="-1" aria-labelledby="driveHistoryModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="driveHistoryModalLabel">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">${content}</div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>`;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal
    try {
        if (typeof bootstrap !== 'undefined') {
            // Use Bootstrap
            const modalEl = document.getElementById('driveHistoryModal');
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        } else if (typeof $ !== 'undefined') {
            // Use jQuery
            $('#driveHistoryModal').modal('show');
        } else {
            // Fallback
            console.warn('Neither Bootstrap nor jQuery is available for showing modal');
            alert(`${title}\n\nPlease see console for details.`);
        }
    } catch (error) {
        console.error('Error showing modal:', error);
    }
}

/**
 * Add highlight effect to a row
 */
function highlightRow(row) {
    // Remove existing highlight
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
 * Add custom styles for drive data display
 */
function addCustomDriveStyles() {
    // Create stylesheet
    const style = document.createElement('style');
    style.textContent = `
        /* Row highlight animation */
        .highlight-update {
            animation: row-highlight 2s ease-in-out;
        }
        
        @keyframes row-highlight {
            0% { background-color: transparent; }
            30% { background-color: rgba(255, 193, 7, 0.3); }
            100% { background-color: transparent; }
        }
        
        /* Status badge styles */
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
        
        /* Table styles */
        .table-info {
            background-color: rgba(23, 162, 184, 0.1);
        }
    `;
    
    // Add stylesheet to document
    document.head.appendChild(style);
}

// Make original fetchWithAuth and showNotification functions available if needed
if (typeof window.fetchWithAuth !== 'function') {
    window.fetchWithAuth = async function(endpoint, options = {}) {
        const token = localStorage.getItem('auth_token');
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        
        const mergedOptions = { 
            ...defaultOptions, 
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };
        
        if (typeof mergedOptions.body === 'object' && !(mergedOptions.body instanceof FormData)) {
            mergedOptions.body = JSON.stringify(mergedOptions.body);
        }
        
        const response = await fetch(`/api${endpoint}`, mergedOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    };
}

if (typeof window.showNotification !== 'function') {
    window.showNotification = function(message, type = 'success') {
        // Simple fallback implementation
        const alertsContainer = document.getElementById('alerts-container');
        
        if (alertsContainer) {
            const alert = document.createElement('div');
            alert.className = `alert alert-${type} alert-dismissible fade show`;
            alert.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            alertsContainer.appendChild(alert);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                alert.remove();
            }, 5000);
        } else {
            // If no alerts container, use console
            console.log(`[${type.toUpperCase()}] ${message}`);
            
            // Also try dialog if available
            if (typeof $(document).dialog === 'function') {
                $(document).dialog({
                    type: type === 'error' ? 'error' : (type === 'success' ? 'success' : 'notice'),
                    infoText: message,
                    autoClose: 2500
                });
            } else if (type === 'error') {
                alert(`Error: ${message}`);
            }
        }
    };
}
