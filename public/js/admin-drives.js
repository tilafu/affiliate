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
        const response = await fetchWithAuth('/admin/drives'); // This endpoint should now return user summaries including total completed drives
        if (!response.success) {
            console.warn('Failed to load drives:', response);
            showNotification('Failed to load drives data', 'error');
            return;
        }

        console.log('Drives data received:', response.drives); // Expecting { success: true, drives: [{user_id, username, total_completed_drives, total_commission_earned, last_drive_date, status}] }
        const drivesList = document.getElementById('drives-list');
        if (!drivesList) {
            console.error('Drives list element not found');
            return;
        }

        drivesList.innerHTML = response.drives.map(userDriveSummary => {
            const userId = userDriveSummary.user_id;
            if (!userId) {
                console.warn('Invalid drive data - missing user_id:', userDriveSummary);
                return '';
            }

            const username = userDriveSummary.username ? userDriveSummary.username.replace(/[<>]/g, '') : 'Unknown';
            const totalCompletedDrives = userDriveSummary.total_completed_drives || 0; // New field
            const totalCommissionEarned = parseFloat(userDriveSummary.total_commission_earned || 0).toFixed(2); // Renamed for clarity
            const lastDriveDate = userDriveSummary.last_drive_date ? new Date(userDriveSummary.last_drive_date).toLocaleString() : 'Never'; // Renamed for clarity
            const status = userDriveSummary.status || 'INACTIVE'; // This might represent current drive status or overall activity

            return `
            <tr data-user-id="${userId}">
                <td>${userId}</td>
                <td>${username}</td>
                <td>${totalCompletedDrives}</td> {/* Display total completed drives */}
                <td>$${totalCommissionEarned}</td>
                <td>${lastDriveDate}</td>
                <td><span class="badge bg-${getStatusBadgeColor(status)}">${status}</span></td>                <td>
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
                    <button class="btn btn-sm btn-primary assign-drive-config-btn"
                            data-user-id="${userId}"
                            data-username="${username}">
                        Assign Drive
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

        // Fetch drive history from API - this endpoint now needs to return drive sessions
        // The backend controller getDriveLogs needs to be updated to reflect this
        const response = await fetchWithAuth(`/admin/drives/${userId}/logs`);
        
        if (!response.success) {
            console.warn('API returned error:', response);
            showNotification(response.message || 'Failed to load drive history', 'error');
            return;
        }
        // Get drive history data (now expecting drive sessions)
        const driveSessions = response.drive_sessions || []; // Assuming the backend sends { success: true, drive_sessions: [...] }
        const driveHistoryBody = document.getElementById('driveHistoryBody');
        
        if (!driveHistoryBody) {
            console.error('Drive history table body not found');
            return;
        }

        if (driveSessions.length === 0) {
            driveHistoryBody.innerHTML = '<tr><td colspan="4" class="text-center">No drive history found</td></tr>'; // Adjusted colspan
            return;
        }

        // Build table rows for drive sessions
        const rows = driveSessions.map(session => {
            const commissionEarned = parseFloat(session.commission_earned || 0);
            const dateCompleted = session.completed_at ? new Date(session.completed_at).toLocaleString() : (session.created_at ? new Date(session.created_at).toLocaleString() : 'N/A');
            const driveName = session.drive_configuration_name || `Drive Session #${session.id}`; // Display drive config name or session ID

            return `
                <tr>
                    <td>${driveName}</td>
                    <td>${dateCompleted}</td>
                    <td>$${commissionEarned.toFixed(2)}</td>
                    <td><span class="badge bg-${getStatusBadgeColor(session.status || 'COMPLETED')}">${session.status || 'COMPLETED'}</span></td>
                </tr>
            `;
        });

        driveHistoryBody.innerHTML = rows.join('');

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
                        <div id="driveHistoryLoader" class="text-center mb-3" style="display: none;"> <!-- Initially hidden -->
                            <div class="spinner-border text-primary"></div>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Drive Name/ID</th>
                                        <th>Date Completed</th>
                                        <th>Earnings</th>
                                        <th>Status</th>
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

    // Remove any existing handlers using the data attribute
    const existingButtons = drivesTable.querySelectorAll('[data-has-click-handler]');
    existingButtons.forEach(btn => {
        btn.removeAttribute('data-has-click-handler');
    });

    // Use event delegation for better performance
    drivesTable.addEventListener('click', async function(event) {
        const target = event.target;
        
        // Prevent duplicate event handling
        if (target.getAttribute('data-processing')) {
            return;
        }

        try {
            // View drive history button handler
            if (target.matches('.view-drive-history-btn')) {
                event.preventDefault();
                target.setAttribute('data-processing', 'true');

                const userId = target.dataset.userId;
                const username = target.dataset.username;

                if (!userId) {
                    console.error('View history clicked but userId is missing');
                    showNotification('Error: Could not identify user', 'error');
                    return;
                }console.log('View drive history clicked for:', { userId, username });
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
                }                // Confirm before resetting
                if (!confirm(`Are you sure you want to reset the drive for ${username || 'this user'}?`)) {
                    return;
                }                console.log('Reset drive clicked for:', { userId, username });
                
                const response = await fetchWithAuth(`/admin/users/${userId}/reset-drive`, {
                    method: 'POST',
                    body: JSON.stringify({}) // Empty object to avoid JSON parsing errors
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
            
            // Assign drive configuration button handler
            if (target.matches('.assign-drive-config-btn')) {
                event.preventDefault();
                target.setAttribute('data-processing', 'true');
                
                const userId = target.dataset.userId;
                const username = target.dataset.username;
                
                if (!userId) {
                    console.error('Assign drive config clicked but userId is missing');
                    showNotification('Error: Could not identify user', 'error');
                    return;
                }
                
                console.log('Assign drive configuration clicked for:', { userId, username });
                await handleDriveConfigAssignment(event);
            }

        } catch (error) {
            console.error('Error in drive handler:', error);
            showNotification(`Operation failed: ${error.message || 'Unknown error'}`, 'error');
        } finally {
            // Remove processing flag to allow future events
            if (target.matches('.view-drive-history-btn, .reset-drive-btn, .assign-drive-config-btn')) {
                target.removeAttribute('data-processing');
            }
        }
    });

    // Mark table as having handlers installed
    drivesTable.setAttribute('data-handlers-initialized', 'true');
}

// Handle the drive configuration assignment
export async function handleDriveConfigAssignment(event) {
    const userId = event.target.dataset.userId;
    const username = event.target.dataset.username;
    
    if (!userId) {
        console.error('Missing user ID for drive configuration assignment');
        showNotification('Error: Could not identify user', 'error');
        return;
    }
    
    console.log(`Preparing to assign drive configuration to user ${username} (ID: ${userId})`);
    
    try {
        // Get current configuration and available configurations
        showNotification('Loading drive configurations...', 'info');
        
        const response = await fetchWithAuth(`/admin/users/${userId}/drive-configuration`);
        
        if (!response.success) {
            console.warn('Failed to load drive configuration data:', response);
            showNotification(response.message || 'Failed to load drive configurations', 'error');
            return;
        }
        
        // Create modal HTML
        const modalId = 'drive-config-modal';
        let modal = document.getElementById(modalId);
        
        // Remove existing modal if any
        if (modal) {
            modal.remove();
        }
        
        // Create new modal
        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1" role="dialog" aria-labelledby="${modalId}-title" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="${modalId}-title">Assign Drive Configuration</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>Assign a drive configuration to user <strong>${username}</strong> (ID: ${userId}).</p>
                            <form id="drive-config-form">
                                <div class="form-group mb-3">
                                    <label for="drive-config-select">Drive Configuration:</label>
                                    <select id="drive-config-select" class="form-control" required>
                                        <option value="">-- Select a configuration --</option>
                                        ${response.available_configurations.map(config => 
                                            `<option value="${config.id}" ${response.current_configuration && response.current_configuration.id === config.id ? 'selected' : ''}>
                                                ${config.name} - ${config.description || 'No description'}
                                            </option>`
                                        ).join('')}
                                    </select>
                                </div>
                                ${response.current_configuration ? 
                                    `<div class="alert alert-info">
                                        <p><strong>Current Configuration:</strong> ${response.current_configuration.name}</p>
                                        <p><small>Assigned on: ${new Date(response.current_configuration.assigned_at).toLocaleDateString()}</small></p>
                                    </div>` : 
                                    '<div class="alert alert-warning">No configuration currently assigned. User will use the default configuration.</div>'
                                }
                            </form>
                        </div>
                        <div class="modal-footer">
                            ${response.current_configuration ? 
                                `<button type="button" class="btn btn-danger remove-config-btn" data-user-id="${userId}">
                                    Remove Assignment
                                </button>` : ''
                            }
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary save-config-btn" data-user-id="${userId}">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById(modalId);
        
        // Initialize Bootstrap modal
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Add event listeners for buttons
        const saveBtn = modal.querySelector('.save-config-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const selectElement = document.getElementById('drive-config-select');
                const configId = selectElement.value;
                
                if (!configId) {
                    showNotification('Please select a drive configuration', 'error');
                    return;
                }
                
                try {
                    showNotification('Assigning drive configuration...', 'info');
                    
                    const response = await fetchWithAuth(`/admin/users/${userId}/drive-configuration`, {
                        method: 'POST',
                        body: JSON.stringify({ drive_configuration_id: configId })
                    });
                    
                    if (response.success) {
                        showNotification(response.message || 'Drive configuration assigned successfully', 'success');
                        bsModal.hide();
                    } else {
                        showNotification(response.message || 'Failed to assign drive configuration', 'error');
                    }
                } catch (error) {
                    console.error('Error assigning drive configuration:', error);
                    showNotification(`Error: ${error.message}`, 'error');
                }
            });
        }
        
        // Add event listener for remove button if it exists
        const removeBtn = modal.querySelector('.remove-config-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', async () => {
                if (!confirm(`Are you sure you want to remove the drive configuration assignment for ${username}?`)) {
                    return;
                }
                
                try {
                    showNotification('Removing drive configuration assignment...', 'info');
                    
                    const response = await fetchWithAuth(`/admin/users/${userId}/drive-configuration`, {
                        method: 'DELETE'
                    });
                    
                    if (response.success) {
                        showNotification(response.message || 'Drive configuration assignment removed', 'success');
                        bsModal.hide();
                    } else {
                        showNotification(response.message || 'Failed to remove drive configuration assignment', 'error');
                    }
                } catch (error) {
                    console.error('Error removing drive configuration assignment:', error);
                    showNotification(`Error: ${error.message}`, 'error');
                }
            });
        }
    } catch (error) {
        console.error('Error handling drive configuration assignment:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
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
