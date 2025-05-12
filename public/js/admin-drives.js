// Drive Management Module for Admin Panel

// Helper function for status colors
function getStatusBadgeColor(status) {
    switch (status.toLowerCase()) {
        case 'active': return 'success';
        case 'pending': return 'warning';
        case 'completed': return 'primary';
        case 'failed': return 'danger';
        default: return 'secondary';
    }
}

// Data Drives Management - Load all drives
export async function loadDrives() {
    try {
        const response = await fetchWithAuth('/admin/drives');
        if (!response.success) {
            console.warn('Failed to load drives:', response);
            showNotification('Failed to load drives data', 'error');
            return;
        }

        console.log('Drives data received:', response.drives);
        const drivesList = document.getElementById('drives-list');
        if (!drivesList) {
            console.error('Drives list element not found');
            return;
        }

        drivesList.innerHTML = response.drives.map(drive => {            // Validate required data
            const userId = drive.user_id;  // Match the API response field name
            if (!userId) {
                console.warn('Invalid drive data - missing user_id:', drive);
                return '';
            }

            // Ensure all data values are properly escaped and defaulted
            const username = drive.username ? drive.username.replace(/[<>]/g, '') : 'Unknown';
            const totalDrives = drive.total_drives || 0;
            const totalCommission = parseFloat(drive.total_commission || 0).toFixed(2);
            const lastDrive = drive.last_drive ? new Date(drive.last_drive).toLocaleString() : 'Never';
            const status = drive.status || 'INACTIVE';

            return `
            <tr data-user-id="${userId}">
                <td>${userId}</td>
                <td>${username}</td>
                <td>${totalDrives}</td>
                <td>$${totalCommission}</td>
                <td>${lastDrive}</td>
                <td><span class="badge bg-${getStatusBadgeColor(status)}">${status}</span></td>
                <td>
                    <button class="btn btn-sm btn-info view-drive-history-btn" 
                            data-user-id="${userId}"
                            data-username="${username}">
                        View History
                    </button>
                    <button class="btn btn-sm btn-warning reset-drive-btn" 
                            data-user-id="${userId}"
                            data-username="${username}">
                        Reset Drive
                    </button>
                </td>
            </tr>`;
        }).join('');

        // Initialize handlers after updating the table
        initializeDriveHandlers();

    } catch (error) {
        console.error('Error loading drives:', error);
        showNotification('Failed to load drives data: ' + (error.message || 'Unknown error'), 'error');
    }
}

// Load drive history for a specific user
export async function loadDriveHistory(userId, username) {
    console.log(`Loading drive history for user ${username} (ID: ${userId})`);

    try {
        // Validate userId before making the API call
        if (!userId || userId === 'undefined') {
            console.error('Invalid userId provided to loadDriveHistory:', userId);
            showNotification('Cannot load drive history: Invalid user ID', 'error');
            return;
        }

        // Show loading state
        showNotification('Loading drive history...', 'info');

        // Fetch drive history from API
        const response = await fetchWithAuth(`/admin/drives/${userId}/logs`);
        
        if (!response.success) {
            console.warn('API returned error:', response);
            showNotification(response.message || 'Failed to load drive history', 'error');
            return;
        }        // Get drive history data
        const historyData = response.history || [];
        const driveHistoryBody = document.getElementById('driveHistoryBody');
        
        if (!driveHistoryBody) {
            console.error('Drive history table body not found');
            return;
        }

        if (historyData.length === 0) {
            driveHistoryBody.innerHTML = '<tr><td colspan="5" class="text-center">No drive history found</td></tr>';
            return;
        }

        // Calculate total commission and build table rows
        let totalCommission = 0;
        const rows = historyData.map(drive => {
            const commission = parseFloat(drive.commission_amount || drive.commission || 0);
            totalCommission += commission;
            
            const date = drive.created_at ? new Date(drive.created_at).toLocaleString() : 'N/A';
            const product = drive.product_name || 'N/A';
            const status = drive.status || 'PENDING';
            
            return `
                <tr>
                    <td>${date}</td>
                    <td>${product}</td>
                    <td><span class="badge bg-${getStatusBadgeColor(status)}">${status}</span></td>
                    <td>$${commission.toFixed(2)}</td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="showDriveDetails('${drive.id}')">
                            Details
                        </button>
                    </td>
                </tr>
            `;
        });

        // Add the rows and total row
        driveHistoryBody.innerHTML = rows.join('') + `
            <tr class="table-info">
                <td colspan="3"><strong>Total Commission</strong></td>
                <td colspan="2"><strong>$${totalCommission.toFixed(2)}</strong></td>
            </tr>
        `;

    } catch (error) {
        console.error('Error loading drive history:', error);
        showNotification('Failed to load drive history: ' + (error.message || 'Unknown error'), 'error');
    }
}

// Show drive history modal for a user
export function showDriveHistoryModal(userId, username) {
    // Input validation
    if (!userId || userId === 'undefined') {
        console.error('Invalid userId provided to showDriveHistoryModal:', userId);
        showNotification('Cannot show drive history: Invalid user ID', 'error');
        return;
    }

    if (!username) {
        console.warn('Username not provided, using fallback');
        username = 'User ' + userId;
    }

    console.log('Opening drive history modal for:', { userId, username });

    const modalHtml = `
        <div class="modal fade" id="driveHistoryModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Drive History for ${username}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div id="driveHistoryLoader" class="text-center mb-3">
                            <div class="spinner-border text-primary"></div>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Product</th>
                                        <th>Status</th>
                                        <th>Commission</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody id="driveHistoryBody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    // Remove existing modal if it exists
    const existingModal = document.getElementById('driveHistoryModal');
    if (existingModal) {
        console.log('Removing existing drive history modal');
        existingModal.remove();
    }

    // Add new modal to DOM
    console.log('Adding new drive history modal to DOM');
    document.body.insertAdjacentHTML('beforeend', modalHtml);
      try {
        console.log('Initializing Bootstrap modal');
        const modalElement = document.getElementById('driveHistoryModal');
        const modal = new bootstrap.Modal(modalElement);
        console.log('Showing modal');
        modal.show();
        return modal;
    } catch (error) {
        console.error('Error showing drive history modal:', error);
        showNotification('Failed to show drive history modal', 'error');
        return null;
    }
}

// Show details for a specific drive
export function showDriveDetails(driveId) {
    console.log('Showing details for drive:', driveId);
    // Implement drive details view
    showNotification('Drive details feature coming soon', 'info');
}

// Refresh drive data for a specific user
export async function refreshDriveData(userId) {
    try {
        const response = await fetchWithAuth(`/admin/drives/${userId}`);
        if (response.success) {
            // Find the row with matching user ID
            const driveRow = document.querySelector(`.view-drive-history-btn[data-user-id="${userId}"]`).closest('tr');
            
            // Update the cells with fresh data
            if (driveRow && response.drive) {
                driveRow.cells[1].textContent = response.drive.total_drives;
                driveRow.cells[2].textContent = `$${response.drive.total_commission}`;
                driveRow.cells[3].textContent = new Date(response.drive.last_drive).toLocaleDateString();
                
                // Also update the status if it changed
                const statusCell = driveRow.cells[4].querySelector('.status-badge');
                statusCell.className = `status-badge status-${response.drive.status === 'ACTIVE' ? 'approved' : 'rejected'}`; // Ensure these classes exist
                statusCell.textContent = response.drive.status;
                
                showNotification(`Drive data updated for user ID: ${userId}`, 'success');
            }
        }
    } catch (error) {
        console.error('Error refreshing drive data:', error);
        showNotification('Failed to refresh drive data', 'error');
    }
}

// Initialize event handlers for drive-related buttons
export function initializeDriveHandlers() {
    const drivesTable = document.getElementById('drives-list')?.closest('table');
    if (!drivesTable) {
        console.error('Drives table not found');
        return;
    }

    // Use event delegation for better performance
    drivesTable.addEventListener('click', async function(event) {
        const target = event.target;

        try {
            // View drive history button handler
            if (target.matches('.view-drive-history-btn')) {
                event.preventDefault();
                const userId = target.dataset.userId;
                const username = target.dataset.username;

                if (!userId) {
                    console.error('View history clicked but userId is missing');
                    showNotification('Error: Could not identify user', 'error');
                    return;
                }                console.log('View drive history clicked for:', { userId, username });
                const driveModal = showDriveHistoryModal(userId, username);
                if (driveModal) {
                    await loadDriveHistory(userId, username);
                }
            }

            // Reset drive button handler
            if (target.matches('.reset-drive-btn')) {
                event.preventDefault();
                const userId = target.dataset.userId;
                const username = target.dataset.username;

                if (!userId) {
                    console.error('Reset drive clicked but userId is missing');
                    showNotification('Error: Could not identify user', 'error');
                    return;
                }

                // Confirm before resetting
                if (!confirm(`Are you sure you want to reset the drive for ${username || 'this user'}?`)) {
                    return;
                }

                console.log('Reset drive clicked for:', { userId, username });
                const response = await fetchWithAuth(`/admin/users/${userId}/reset-drive`, {
                    method: 'POST'
                });

                if (response.success) {
                    showNotification(response.message || 'Drive reset successfully', 'success');
                    // Refresh the drives table
                    await loadDrives();
                } else {
                    console.warn('Failed to reset drive:', response);
                    showNotification(response.message || 'Failed to reset drive', 'error');
                }
            }

        } catch (error) {
            console.error('Error in drive handler:', error);
            showNotification(`Operation failed: ${error.message || 'Unknown error'}`, 'error');
        }
    });
}

// Initialize the drive polling
export function setupDrivePolling() {
    // Poll every 30 seconds
    setInterval(() => {
        try {
            console.log('Auto-refreshing drives data...');
            loadDrives();
        } catch (error) {
            console.error('Error in drive polling:', error);
        }
    }, 30000);
}

// Will be imported from the main module
let fetchWithAuth;
let showNotification;

// Initialize dependencies from the main module
export function initDependencies(dependencies) {
    fetchWithAuth = dependencies.fetchWithAuth;
    showNotification = dependencies.showNotification;
}
