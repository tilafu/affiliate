// Drive Management Module for Admin Panel

// Will be imported from the main module
let fetchWithAuth;
let showNotification;
let isInitialized = false; // Flag to track initialization

// Initialize dependencies from the main module
export function initDependencies(dependencies) {
    fetchWithAuth = dependencies.fetchWithAuth;
    showNotification = dependencies.showNotification;
    
    if (!fetchWithAuth || !showNotification) {
        console.error("CRITICAL: fetchWithAuth or showNotification not passed to admin-drives.js initDependencies");
        isInitialized = false;
        return;
    }
    isInitialized = true;
    console.log("admin-drives.js initialized with dependencies.");

    // Initialize enhanced combo creation dependencies
    if (window.initEnhancedComboCreationDependencies) {
        window.initEnhancedComboCreationDependencies(dependencies);
    }

    // Initialize Drive Configuration UI elements and event listeners if the section is visible
    // This part of the code was removed as per the latest requirements
}

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

// Helper function to remove existing modals and prevent duplicates/overlaps
function removeExistingModal(modalId) {
    const existingModalElement = document.getElementById(modalId);
    if (existingModalElement) {
        const modalInstance = bootstrap.Modal.getInstance(existingModalElement);
        if (modalInstance) {
            // Listen for the hidden event to ensure Bootstrap cleanup is done before removing
            existingModalElement.addEventListener('hidden.bs.modal', function onModalHidden() {
                // Check if the element is still in the body before attempting to remove
                if (document.body.contains(existingModalElement)) {
                    existingModalElement.remove();
                }
                
            }, { once: true });
            modalInstance.hide();
        } else {
            // If no Bootstrap instance (e.g., modal was not properly initialized or already partly removed),
            // attempt to remove directly if it's still in the DOM.
            if (document.body.contains(existingModalElement)) {
                existingModalElement.remove();
            }
        }
    }

    // Clean up any orphaned backdrops.
    // This timeout gives Bootstrap a moment to finish its hide animations and backdrop removal.
    setTimeout(() => {
        // Only remove backdrops if no other Bootstrap modals are currently shown.
        if (document.querySelectorAll('.modal.show[data-bs-backdrop]').length === 0 && document.querySelectorAll('.modal-backdrop.show').length > 0) {
             const backdrops = document.querySelectorAll('.modal-backdrop');
             backdrops.forEach(backdrop => backdrop.remove());
        }
    }, 350); // 350ms should be slightly longer than typical Bootstrap fade animations (e.g., .modal.fade has 0.15s transition)
}

// Data Drives Management - Load all drives
export async function loadDrives() {
    if (!isInitialized) {
        showNotification('Drive module is not ready. Please wait or refresh.', 'error');
        console.error('loadDrives called before initDependencies completed.');
        return;
    }
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
<<<<<<< HEAD
            }

<<<<<<< HEAD
            const username = userDriveSummary.username ? userDriveSummary.username.replace(/[<>]/g, '') : 'Unknown';
            const totalCompletedDrives = userDriveSummary.total_completed_drives || 0; // New field
            const totalCommissionEarned = parseFloat(userDriveSummary.total_commission_earned || 0).toFixed(2); // Renamed for clarity
            const lastDriveDate = userDriveSummary.last_drive_date ? new Date(userDriveSummary.last_drive_date).toLocaleString() : 'Never'; // Renamed for clarity
            const status = userDriveSummary.status || 'INACTIVE'; // This might represent current drive status or overall activity
=======
            // Ensure all data values are properly escaped and defaulted
=======
            }            // Ensure all data values are properly escaped and defaulted
>>>>>>> main
            const username = drive.username ? drive.username.replace(/[<>]/g, '') : 'Unknown';
            const totalDrives = drive.total_drives || 0;
            const totalCommission = parseFloat(drive.total_commission || 0).toFixed(2);
            const lastDrive = drive.last_drive ? new Date(drive.last_drive).toLocaleString() : 'Never';
            const status = drive.status || 'INACTIVE';
            const assignedConfigName = drive.assigned_drive_configuration_name || 'N/A';
<<<<<<< HEAD
            const assignedConfigId = drive.assigned_drive_configuration_id || null;
>>>>>>> main

            return `
=======
            const assignedConfigId = drive.assigned_drive_configuration_id || null;            return `
>>>>>>> main
            <tr data-user-id="${userId}" data-assigned-config-id="${assignedConfigId}" data-assigned-config-name="${assignedConfigName}">
                <td>${userId}</td>
                <td>${username}</td>
<<<<<<< HEAD
                <td>${totalCompletedDrives}</td> {/* Display total completed drives */}
                <td>$${totalCommissionEarned}</td>
                <td>${lastDriveDate}</td>
                <td><span class="badge bg-${getStatusBadgeColor(status)}">${status}</span></td>                <td>
                    <button class="btn btn-sm btn-info view-drive-history-btn" 
=======
                <td>${assignedConfigName}</td>
                <td>${totalDrives}</td>
                <td>$${totalCommission}</td>
                <td>${lastDrive}</td>
                <td><span class="badge bg-${getStatusBadgeColor(status)}">${status}</span></td>
                <td>
                    <button class="btn btn-sm btn-info view-drive-history-btn"
>>>>>>> main
                            data-user-id="${userId}"
                            data-username="${username}">
                        View History
                    </button>
                    <button class="btn btn-sm btn-primary assign-drive-config-btn"
                            data-user-id="${userId}"
                            data-username="${username}">
                        Assign Drive Config
                    </button>
                    <button class="btn btn-sm btn-warning reset-drive-btn" 
                            data-user-id="${userId}"
                            data-username="${username}">
                        Reset Drive
                    </button>
<<<<<<< HEAD
                    <button class="btn btn-sm btn-primary assign-drive-config-btn"
                            data-user-id="${userId}"
                            data-username="${username}">
                        Assign Drive
=======
                    <button class="btn btn-sm btn-secondary view-user-drive-progress-btn"
                            data-user-id="${userId}"
                            data-username="${username}">
                        View Progress
>>>>>>> main
                    </button>
                    <button class="btn btn-sm btn-success create-combo-btn"
                            data-user-id="${userId}"
                            data-username="${username}"
                            data-assigned-config-id="${assignedConfigId}"
                            data-assigned-config-name="${assignedConfigName}">
                        Create Combo
                    </button>
                </td>
            </tr>`;
<<<<<<< HEAD
        }).join('');        // Initialize handlers after updating the table
=======
        }).join('');

        // Initialize handlers after updating the table
>>>>>>> post
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
        // More robustly remove old listeners if they were attached directly
        // This is a bit of a hack; ideally, clone and replace the button or manage listeners more carefully
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });


    // Use event delegation for better performance
    drivesTable.addEventListener('click', async function(event) {
        const target = event.target.closest('button'); // Ensure we are targeting a button
        if (!target) return;
        
        // Prevent duplicate event handling
        if (target.getAttribute('data-processing')) {
            return;
        }

        const userId = target.dataset.userId;
        const username = target.dataset.username;

        try {
            // View drive history button handler
            if (target.matches('.view-drive-history-btn')) {
                event.preventDefault();
                target.setAttribute('data-processing', 'true');

                if (!userId) {
                    console.error('View history clicked but userId is missing');
                    showNotification('Error: Could not identify user', 'error');
                    target.removeAttribute('data-processing');
                    return;
                }
                console.log('View drive history clicked for:', { userId, username });
                const driveModal = showDriveHistoryModal(userId, username);
                if (driveModal) {
                    await loadDriveHistory(userId, username);
                }
            }

            // Reset drive button handler
            else if (target.matches('.reset-drive-btn')) {
                event.preventDefault();
                if (!userId) {
                    console.error('Reset drive clicked but userId is missing');
                    showNotification('Error: Could not identify user', 'error');
                    return;
<<<<<<< HEAD
                }                // Confirm before resetting
                if (!confirm(`Are you sure you want to reset the drive for ${username || 'this user'}?`)) {
                    return;
                }                console.log('Reset drive clicked for:', { userId, username });
                
                const response = await fetchWithAuth(`/admin/users/${userId}/reset-drive`, {
                    method: 'POST',
                    body: JSON.stringify({}) // Empty object to avoid JSON parsing errors
                });
                
=======
                }

                if (!confirm(`Are you sure you want to reset the drive for ${username || 'this user'}?`)) {
                    return;
                }
                target.setAttribute('data-processing', 'true');
                console.log('Reset drive clicked for:', { userId, username });
                const response = await fetchWithAuth(`/admin/users/${userId}/reset-drive`, {
                    method: 'POST'
                });
>>>>>>> main
                if (response.success) {
                    showNotification(response.message || 'Drive reset successfully', 'success');
                    await loadDrives();
                } else {
                    console.warn('Failed to reset drive:', response);
                    showNotification(response.message || 'Failed to reset drive', 'error');
                }
            }
<<<<<<< HEAD
            
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
=======
            // Assign Drive Config button handler
            else if (target.matches('.assign-drive-config-btn')) {
                event.preventDefault();
                if (!userId) {
                    console.error('Assign Drive Config clicked but userId is missing');
                    showNotification('Error: Could not identify user', 'error');
                    return;
                }
                target.setAttribute('data-processing', 'true');
                console.log('Assign Drive Config clicked for:', { userId, username });
<<<<<<< HEAD
                await showAssignDriveConfigModal(userId, username);
<<<<<<< HEAD
            }
            // Assign Combos button handler
            else if (target.matches('.assign-combos-btn')) {
                event.preventDefault();
                const assignedConfigId = target.dataset.assignedConfigId;
                const assignedConfigName = target.dataset.assignedConfigName;

                if (!userId || !assignedConfigId || assignedConfigId === 'null' || assignedConfigId === 'undefined') {
                    console.error('Assign Combos clicked but userId or assignedConfigId is missing', { userId, assignedConfigId });
                    showNotification('Error: User or assigned configuration details are missing. Please assign a Drive Config first.', 'error');
                    return;
                }
                target.setAttribute('data-processing', 'true');
                console.log('Assign Combos clicked for:', { userId, username, assignedConfigId, assignedConfigName });
                await showAssignCombosModal(userId, username, assignedConfigId, assignedConfigName);
>>>>>>> main
            }
=======
            }            // View User Drive Progress button handler
>>>>>>> main
=======
                await showAssignDriveConfigModal(userId, username);            }
>>>>>>> post
            // View User Drive Progress button handler
>>>>>>> post
            else if (target.matches('.view-user-drive-progress-btn')) {
                event.preventDefault();
                if (!userId) {
                    console.error('View User Drive Progress clicked but userId is missing');
                    showNotification('Error: Could not identify user for progress view.', 'error');
                    return;
                }
                target.setAttribute('data-processing', 'true');
                console.log('View User Drive Progress clicked for:', { userId, username });
                await showUserDriveProgressModal(userId, username);
            }            // Create Combo button handler
            else if (target.matches('.create-combo-btn')) {
                event.preventDefault();
                console.log('Create Combo button clicked for user:', { userId, username });
                
                if (!userId) {
                    console.error('Create Combo clicked but userId is missing');
                    showNotification('Error: Could not identify user for combo creation.', 'error');
                    return;
                }
                
                target.setAttribute('data-processing', 'true');
                
                try {
                    // Check for ACTIVE drive session instead of static assigned configuration
                    console.log('🔍 Checking for active drive session...');
                    const driveProgressResponse = await fetchWithAuth(`/api/admin/drive-management/users/${userId}/drive-progress`);
                    
                    if (!driveProgressResponse || !driveProgressResponse.drive_session_id) {
                        // No active drive session found
                        showNotification(`❌ Cannot create combo for "${username}". User has no active drive session. Please ensure the user starts a drive first.`, 'warning');
                        return;
                    }
                    
                    console.log('✅ Active drive session found:', {
                        sessionId: driveProgressResponse.drive_session_id,
                        configName: driveProgressResponse.drive_configuration_name,
                        currentTask: driveProgressResponse.current_task_item_name,
                        progress: `${driveProgressResponse.completed_task_items}/${driveProgressResponse.total_task_items}`
                    });
                    
                    // Proceed with combo creation using the active session data
                    console.log('🚀 Proceeding with combo creation for active drive session...');
                    
                    // Use the existing enhanced combo creation functionality
                    if (typeof showEnhancedComboCreationModal === 'function') {
                        await showEnhancedComboCreationModal(userId, username);
                    } else {
                        console.error('❌ Enhanced combo creation function not available');
                        showNotification('Combo creation functionality not available', 'error');
                    }
                    
                } catch (error) {
                    console.error('❌ Error checking drive session:', error);
                    showNotification(`Failed to check drive session for "${username}": ${error.message}`, 'error');
                }
            }

        } catch (error) {
            console.error('Error in drive handler:', error);
            showNotification(`Operation failed: ${error.message || 'Unknown error'}`, 'error');
        } finally {
            // Remove processing flag to allow future events
<<<<<<< HEAD
            if (target.matches('.view-drive-history-btn, .reset-drive-btn, .assign-drive-config-btn')) {
=======
            if (target.hasAttribute('data-processing')) {
>>>>>>> main
                target.removeAttribute('data-processing');
            }
        }
    });

    // Mark table as having handlers initialized
    drivesTable.setAttribute('data-handlers-initialized', 'true');
}

<<<<<<< HEAD
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
=======
// Function to show a modal for assigning a drive configuration to a user
async function showAssignDriveConfigModal(userId, username) {
    // Fetch active drive configurations
    let activeConfigurations = [];
    try {
        const allConfigs = await getDriveConfigurations(); // Assuming this function is available and fetches all configs
        activeConfigurations = allConfigs.filter(config => config.is_active);
    } catch (error) {
        showNotification('Failed to load drive configurations for assignment.', 'error');
        console.error('Error fetching active configurations:', error);
        return;
    }

    if (activeConfigurations.length === 0) {
        showNotification('No active drive configurations available to assign.', 'info');
        return;
    }

    const configOptions = activeConfigurations.map(config => 
        `<option value="${config.id}">${config.name} (ID: ${config.id})</option>`
    ).join('');

    const modalId = 'assignDriveConfigToUserModal';
    removeExistingModal(modalId);

    const modalHtml = `
    <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="${modalId}Label">Assign Drive Configuration to ${username} (User ID: ${userId})</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="assign-drive-config-to-user-form">
              <input type="hidden" id="assign-dc-user-id" value="${userId}">
              <div class="mb-3">
                <label for="select-drive-config-to-assign" class="form-label">Select Drive Configuration*</label>
                <select class="form-select" id="select-drive-config-to-assign" required>
                  <option value="" disabled selected>Choose a configuration...</option>
                  ${configOptions}
                </select>
              </div>
              <button type="submit" class="btn btn-primary">Assign Configuration</button>
              <button type="button" class="btn btn-success ms-2" id="assign-tier-based-config-btn">Auto</button>
            </form>
          </div>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalElement);
    modal.show();

    document.getElementById('assign-drive-config-to-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedConfigId = document.getElementById('select-drive-config-to-assign').value;
        const currentUserId = document.getElementById('assign-dc-user-id').value;

        if (!selectedConfigId) {
            showNotification('Please select a drive configuration.', 'error');
            return;
>>>>>>> main
        }
        
        try {            const response = await fetchWithAuth(`/api/admin/drive-management/users/${currentUserId}/assign-drive-config`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    drive_configuration_id: selectedConfigId
                })
            });

            if (response.message) {
                showNotification('Drive configuration assigned successfully!', 'success');
                modal.hide();
                await loadDrives(); // Refresh the drives list to show the new assignment
            } else {
                throw new Error(response.message || 'Failed to assign drive configuration.');
            }
        } catch (error) {
            showNotification(error.message || 'Error assigning drive configuration', 'error');
            console.error('Error in assign-drive-config-to-user-form submit:', error);
        }
    });

    // Event listener for the new button
    document.getElementById('assign-tier-based-config-btn').addEventListener('click', async () => {
        const currentUserId = document.getElementById('assign-dc-user-id').value;
        if (!currentUserId) {
            showNotification('User ID is missing.', 'error');
            return;
        }

        // Confirmation dialog
        if (!confirm(`This will generate and assign a new drive configuration based on user ${username}\\'s tier. Any existing active drive for this user will be replaced. Continue?`)) {
            return;
        }

        showNotification('Generating and assigning tier-based configuration...', 'info');

        try {
            const response = await fetchWithAuth(`/api/admin/drive-management/users/${currentUserId}/assign-tier-based-drive`, {
                method: 'POST', // Assuming POST to create/assign
                headers: {
                    'Content-Type': 'application/json'
                }
                // No body needed if the backend derives everything from userId and their tier
            });

            if (response.success && response.drive_session_id) {
                showNotification(response.message || 'Tier-based drive configuration assigned successfully!', 'success');
                modal.hide();
                await loadDrives(); // Refresh the drives list
            } else {
                throw new Error(response.message || 'Failed to assign tier-based drive configuration.');
            }
        } catch (error) {
            showNotification(error.message || 'Error assigning tier-based drive configuration', 'error');
            console.error('Error in assign-tier-based-config-btn click:', error);
        }
    });
}






// --- Drive Configuration Management ---

// NEW EXPORTED function to GET data
export async function getDriveConfigurations() {
    if (!isInitialized) {
        console.error('getDriveConfigurations called before initDependencies completed.');
        if (typeof showNotification === 'function') {
            showNotification('Drive configuration data might be unavailable: module not fully ready.', 'warning');
        }
        return []; // Return empty array or appropriate default/error state
    }
    try {
        const response = await fetchWithAuth('/api/admin/drive-management/configurations');
        // Ensure the response structure is as expected, often it's response.data or similar
        // For this example, assuming fetchWithAuth directly returns the array or an object with a property.
        // If fetchWithAuth returns a more complex object (e.g., { success: true, configurations: [...] }), adjust here.
        const configurations = response; // Adjust if fetchWithAuth wraps data, e.g., response.data or response.configurations

        if (Array.isArray(configurations)) {
            return configurations;
        } else {
            console.warn('Fetched drive configurations is not an array:', configurations);
            if (typeof showNotification === 'function') {
                showNotification('Received unexpected format for drive configurations.', 'error');
            }
            return [];
        }
    } catch (error) {
        console.error('Error fetching drive configurations:', error);
        if (typeof showNotification === 'function') {
            showNotification(error.message || 'Failed to fetch drive configurations', 'error');
        }
        return [];
    }
}

// ORIGINAL function to LOAD data into the table - NOW EXPORTED
export async function loadDriveConfigurations() { // Added export
    try {
        // Removed redundant check for typeof getDriveConfigurations === 'function'
        // getDriveConfigurations is defined in the same module scope and will either be a function
        // or the call below would fail. It also has its own initialization checks.

        const configurations = await getDriveConfigurations(); // Call the sibling function in this module
        
        const configList = document.getElementById('drive-configurations-list');
        if (!configList) {
            console.error('Drive configurations list element not found');
            return;
        }

        configList.innerHTML = configurations.map(config => `
            <tr>
                <td>${config.id}</td>
                <td>${config.name}</td>
                <td>${config.description || 'N/A'}</td>
                <td>${config.tasks_required}</td>
                <td><span class="badge bg-${config.is_active ? 'success' : 'secondary'}">${config.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>${new Date(config.created_at).toLocaleString()}</td>
                <td>
                    <button class="btn btn-sm btn-warning edit-config-btn" data-config-id="${config.id}">Edit</button>
                    <button class="btn btn-sm btn-danger delete-config-btn" data-config-id="${config.id}">Delete</button>
                </td>
            </tr>
        `).join('');

        // Add event listeners for new buttons
        document.querySelectorAll('.edit-config-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const configId = e.target.dataset.configId;
                showEditDriveConfigurationModal(configId);
            });
        });
        document.querySelectorAll('.delete-config-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const configId = e.target.dataset.configId;
                handleDeleteDriveConfiguration(configId);
            });
        });

    } catch (error) {
        console.error('Error loading drive configurations:', error);
        // showNotification is available in this module's scope
        showNotification(error.message || 'Failed to load drive configurations', 'error');
    }
}

// Export the function to make it accessible via DriveModuleAPI
// Comment: The function showCreateDriveConfigurationModal is exported on the next line.
export function showCreateDriveConfigurationModal() {
    // Fetch all available products
    fetchWithAuth('/admin/products') // Changed from /api/products
        .then(productsResponse => {
            // Assuming fetchWithAuth might return a structured response like { success: true, products: [] }
            // or just the array directly. Adjust based on actual fetchWithAuth behavior.
            let productsList = [];
            if (productsResponse && productsResponse.success && Array.isArray(productsResponse.products)) {
                productsList = productsResponse.products;
            } else if (Array.isArray(productsResponse)) {
                productsList = productsResponse; // Fallback if it returns array directly
            }
            
            const modalHtml = `
            <div class="modal fade" id="createDriveConfigModal" tabindex="-1" aria-labelledby="createDriveConfigModalLabel" aria-hidden="true">
              <div class="modal-dialog modal-lg">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title" id="createDriveConfigModalLabel">Create Drive Configuration</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body">
                    <form id="create-drive-config-form">
                      <div class="mb-3">
                        <label for="config-name" class="form-label">Name*</label>
                        <input type="text" class="form-control" id="config-name" required>
                      </div>
                      <div class="mb-3">
                        <label for="config-description" class="form-label">Description</label>
                        <textarea class="form-control" id="config-description" rows="3"></textarea>
                      </div>
                      <div class="mb-3">
                        <label for="config-tasks-required" class="form-label">Tasks Required (Number of Task Sets)*</label>
                        <input type="number" class="form-control" id="config-tasks-required" required min="1" value="1">
                      </div>
                      <div class="mb-3 form-check">
                        <input type="checkbox" class="form-check-input" id="config-is-active" checked>
                        <label class="form-check-label" for="config-is-active">Is Active</label>
                      </div>
                      
                      <hr>
                      <h5>Product Selection <span class="badge bg-secondary" id="selected-products-count">0 selected</span></h5>
                      
                      <div class="row mb-3">
                        <div class="col-md-6">
                          <label for="min-price-filter" class="form-label">Min Price ($)</label>
                          <input type="number" class="form-control" id="min-price-filter" value="0" min="0" step="0.01">
                        </div>
                        <div class="col-md-6">
                          <label for="max-price-filter" class="form-label">Max Price ($)</label>
                          <input type="number" class="form-control" id="max-price-filter" min="0" step="0.01">
                        </div>
                      </div>
                      
                      <div class="mb-3">
                        <button type="button" class="btn btn-secondary" id="apply-price-filter">Apply Price Filter</button>
                        <button type="button" class="btn btn-outline-secondary" id="reset-price-filter">Reset Filter</button>
                      </div>
                      
                      <div class="mb-3">
                        <label class="form-label">Available Products</label>
                        <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">                        <table class="table table-sm table-hover">
                            <thead>
                              <tr>
                                <th>Select</th>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Price ($)</th>
                              </tr>
                            </thead>
                            <tbody id="available-products-list">
                              ${productsList.map(product => `
                                <tr data-product-id="${product.id}" data-product-price="${product.price || 0}">
                                  <td><input type="checkbox" class="product-select-checkbox" data-product-id="${product.id}"></td>
                                  <td>${product.id}</td>
                                  <td>${product.name}</td>
                                  <td>${parseFloat(product.price || 0).toFixed(2)}</td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      
                      <button type="submit" class="btn btn-primary">Create Configuration</button>
                    </form>
                  </div>
                </div>
              </div>
            </div>`;

            removeExistingModal('createDriveConfigModal');
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modalElement = document.getElementById('createDriveConfigModal');
            const modal = new bootstrap.Modal(modalElement);
            modal.show();

            // Initialize and update selected products counter
            const selectedCountElement = document.getElementById('selected-products-count');
            const productCheckboxes = document.querySelectorAll('#available-products-list .product-select-checkbox');
            
            const updateSelectedCount = () => {
                const count = document.querySelectorAll('#available-products-list .product-select-checkbox:checked').length;
                selectedCountElement.textContent = `${count} selected`;
            };

            productCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', updateSelectedCount);
            });
            updateSelectedCount(); // Initial count

            // Handle price filter
            const applyFilterBtn = document.getElementById('apply-price-filter');
            const resetFilterBtn = document.getElementById('reset-price-filter');
            const minPriceInput = document.getElementById('min-price-filter');
            const maxPriceInput = document.getElementById('max-price-filter');
            
            applyFilterBtn.addEventListener('click', () => {
                const minPrice = parseFloat(minPriceInput.value) || 0;
                const maxPrice = parseFloat(maxPriceInput.value) || Number.MAX_SAFE_INTEGER;
                
                document.querySelectorAll('#available-products-list tr').forEach(row => {
                    const productPrice = parseFloat(row.dataset.productPrice) || 0;
                    if (productPrice >= minPrice && (maxPrice === 0 || productPrice <= maxPrice)) {
                        row.style.display = ''; // Show row
                    } else {
                        row.style.display = 'none'; // Hide row
                    }
                });
            });
            
            resetFilterBtn.addEventListener('click', () => {
                minPriceInput.value = '0';
                maxPriceInput.value = '';
                document.querySelectorAll('#available-products-list tr').forEach(row => {
                    row.style.display = ''; // Show all rows
                });
            });

            document.getElementById('create-drive-config-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('config-name').value;
                const description = document.getElementById('config-description').value;
                const tasks_required = parseInt(document.getElementById('config-tasks-required').value);
                const is_active = document.getElementById('config-is-active').checked;
                
                // Collect selected product IDs
                const selectedProductIds = [];
                document.querySelectorAll('.product-select-checkbox:checked').forEach(checkbox => {
                    selectedProductIds.push(checkbox.dataset.productId);
                });

                if (!name || !tasks_required || tasks_required <= 0) {
                    showNotification('Name and a positive number for Tasks Required are mandatory.', 'error');
                    return;
                }

                try {
                    const response = await fetchWithAuth('/api/admin/drive-management/configurations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            name, 
                            description, 
                            tasks_required, 
                            is_active,
                            product_ids: selectedProductIds 
                        })
                    });
                    if (response && response.id) { // Assuming successful creation returns the new object with an id
                        showNotification('Drive configuration created successfully!', 'success');
                        modal.hide();
                        loadDriveConfigurations(); // Refresh the list
                    } else {
                        throw new Error(response.message || 'Failed to create configuration.');
                    }
                } catch (error) {
                    showNotification(error.message || 'Error creating configuration', 'error');
                }
            });
        })
        .catch(error => {
            console.error('Error fetching products for drive configuration modal:', error);
            showNotification('Error loading products. Please try again.', 'error');
        });
}

async function showEditDriveConfigurationModal(configId) {
    try {
        const config = await fetchWithAuth(`/api/admin/drive-management/configurations/${configId}`);
        if (!config || !config.id) { // Basic check for a valid config object
            showNotification('Failed to load drive configuration details.', 'error');
            return;
        }
        
        // Fetch all available products for the product list
        let productsList = [];
        try {
            // Corrected endpoint and improved response handling
            const productsResponse = await fetchWithAuth(`/admin/products`); 
            if (!productsResponse) {
                 console.error('No response received from /admin/products');
                 showNotification('Failed to load products: No response from server.', 'error');
            } else if (productsResponse.error) { // Check for explicit error message from API
                console.error('Error fetching products:', productsResponse.error, 'Status:', productsResponse.status);
                showNotification(`Error loading products: ${productsResponse.error} (Status: ${productsResponse.status})`, 'error');
            } else if (Array.isArray(productsResponse)) {
                productsList = productsResponse;
            } else if (productsResponse.products && Array.isArray(productsResponse.products)) { // Handle if products are nested
                productsList = productsResponse.products;
            } else {
                // Fallback for unexpected structure, but still an array was expected
                console.warn('Products data is not in the expected array format, or is missing. Received:', productsResponse);
                showNotification('Products data is not in the expected format. Displaying an empty list.', 'warning');
            }
        } catch (fetchError) {
            console.error('Error fetching products for edit modal:', fetchError);
            showNotification('Failed to load products for editing.', 'error');
        }

        const modalHtml = `
        <div class="modal fade" id="editDriveConfigModal" tabindex="-1" aria-labelledby="editDriveConfigModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="editDriveConfigModalLabel">Edit Drive Configuration</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <form id="edit-drive-config-form">
                  <input type="hidden" id="edit-config-id" value="${config.id}">
                  <div class="mb-3">
                    <label for="edit-config-name" class="form-label">Name*</label>
                    <input type="text" class="form-control" id="edit-config-name" value="${config.name}" required>
                  </div>
                  <div class="mb-3">
                    <label for="edit-config-description" class="form-label">Description</label>
                    <textarea class="form-control" id="edit-config-description" rows="3">${config.description || ''}</textarea>
                  </div>
                  <div class="mb-3">
                    <label for="edit-config-tasks-required" class="form-label">Tasks Required (Number of Task Sets)*</label>
                    <input type="number" class="form-control" id="edit-config-tasks-required" value="${config.tasks_required}" required min="1">
                  </div>
                  <div class="mb-3 form-check">
                    <input type="checkbox" class="form-check-input" id="edit-config-is-active" ${config.is_active ? 'checked' : ''}>
                    <label class="form-check-label" for="edit-config-is-active">Is Active</label>
                  </div>
                  
                  <hr>
                  <h5>Product Selection <span class="badge bg-secondary" id="edit-selected-products-count">0 selected</span></h5>
                  
                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label for="edit-min-price-filter" class="form-label">Min Price ($)</label>
                      <input type="number" class="form-control" id="edit-min-price-filter" value="0" min="0" step="0.01">
                    </div>
                    <div class="col-md-6">
                      <label for="edit-max-price-filter" class="form-label">Max Price ($)</label>
                      <input type="number" class="form-control" id="edit-max-price-filter" min="0" step="0.01">
                    </div>
                  </div>
                  
                  <div class="mb-3">
                    <button type="button" class="btn btn-secondary" id="edit-apply-price-filter">Apply Price Filter</button>
                    <button type="button" class="btn btn-outline-secondary" id="edit-reset-price-filter">Reset Filter</button>
                  </div>
                  
                  <div class="mb-3">
                    <label class="form-label">Available Products</label>
                    <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                      <table class="table table-sm table-hover">
                        <thead>
                          <tr>
                            <th>Select</th>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Price ($)</th>
                          </tr>
                        </thead>
                        <tbody id="edit-available-products-list">
                          ${productsList.map(product => `
                            <tr data-product-id="${product.id}" data-product-price="${product.price || 0}">
                              <td><input type="checkbox" class="product-select-checkbox" data-product-id="${product.id}" ${config.product_ids && config.product_ids.includes(product.id) ? 'checked' : ''}></td>
                              <td>${product.id}</td>
                              <td>${product.name}</td>
                              <td>${parseFloat(product.price || 0).toFixed(2)}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <button type="submit" class="btn btn-primary">Save Changes</button>
                </form>
              </div>
            </div>
          </div>
        </div>`;

        removeExistingModal('editDriveConfigModal');

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById('editDriveConfigModal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();

        // Try to load any existing products assigned to this configuration
        try {
            const configProducts = await fetchWithAuth(`/api/admin/drive-management/configurations/${configId}/products`);
            if (Array.isArray(configProducts) && configProducts.length > 0) {
                // Mark checkboxes for products that are already assigned to this configuration
                configProducts.forEach(product => {
                    const checkbox = document.querySelector(`.product-select-checkbox[data-product-id="${product.id}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
        } catch (error) {
            console.warn('Could not load existing products for this configuration:', error);
            // Continue without pre-selecting products
        }

        // Handle price filter
        const applyFilterBtn = document.getElementById('edit-apply-price-filter');
        const resetFilterBtn = document.getElementById('edit-reset-price-filter');
        const minPriceInput = document.getElementById('edit-min-price-filter');
        const maxPriceInput = document.getElementById('edit-max-price-filter');
        
        applyFilterBtn.addEventListener('click', () => {
            const minPrice = parseFloat(minPriceInput.value) || 0;
            const maxPrice = parseFloat(maxPriceInput.value) || Number.MAX_SAFE_INTEGER;
            
            document.querySelectorAll('#edit-available-products-list tr').forEach(row => {
                const productPrice = parseFloat(row.dataset.productPrice) || 0;
                if (productPrice >= minPrice && (maxPrice === 0 || productPrice <= maxPrice)) {
                    row.style.display = ''; // Show row
                } else {
                    row.style.display = 'none'; // Hide row
                }
            });
        });
        
        resetFilterBtn.addEventListener('click', () => {
            minPriceInput.value = '0';
            maxPriceInput.value = '';
            document.querySelectorAll('#edit-available-products-list tr').forEach(row => {
                row.style.display = ''; // Show all rows
            });
        });

        document.getElementById('edit-drive-config-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-config-id').value;
            const name = document.getElementById('edit-config-name').value;
            const description = document.getElementById('edit-config-description').value;
            const tasks_required = parseInt(document.getElementById('edit-config-tasks-required').value);
            const is_active = document.getElementById('edit-config-is-active').checked;
            
            // Collect selected product IDs
            const selectedProductIds = [];
            document.querySelectorAll('.product-select-checkbox:checked').forEach(checkbox => {
                selectedProductIds.push(checkbox.dataset.productId);
            });

            if (!name || !tasks_required || tasks_required <=0) {
                showNotification('Name and a positive number for Tasks Required are mandatory.', 'error');
                return;
            }

            try {
                const updateResponse = await fetchWithAuth(`/api/admin/drive-management/configurations/${id}`, { 
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        name, 
                        description, 
                        tasks_required, 
                        is_active,
                        product_ids: selectedProductIds 
                    })
                });
                if (updateResponse && updateResponse.id) { 
                    showNotification('Drive configuration updated successfully!', 'success');
                    modal.hide();
                    loadDriveConfigurations(); 
                } else {
                    throw new Error(updateResponse.message || 'Failed to update configuration.');
                }
            } catch (error) {
                showNotification(error.message || 'Error updating configuration', 'error');
            }
        });

    } catch (error) {
        showNotification(error.message || 'Error loading configuration for editing', 'error');
    }
}

async function handleDeleteDriveConfiguration(configId) {
    if (!confirm('Are you sure you want to delete this drive configuration? This action cannot be undone.')) {
        return;
    }
    try {
        const response = await fetchWithAuth(`/api/admin/drive-management/configurations/${configId}`, { 
            method: 'DELETE'
        });
        if (response && response.success !== false) { 
            showNotification('Drive configuration deleted successfully!', 'success');
            loadDriveConfigurations(); 
        } else {
            throw new Error(response.message || 'Failed to delete configuration.');
        }
    } catch (error) {
        showNotification(error.message || 'Error deleting configuration', 'error');
    }
}

// --- Task Set Management for a Drive Configuration ---
// This function `showTaskSetsForConfiguration` and related functions for managing task sets directly 
// from the "Drive Configurations Management" table (e.g., showCreateTaskSetModal, showEditTaskSetModal, handleDeleteTaskSet,
// showManageProductsModal, loadProductsForTaskSet, renderProductsInModal, handleSaveProductOrder, 
// showAddProductToTaskSetModal, handleRemoveProductFromTaskSet) might become obsolete or need significant
// refactoring if task sets are now managed *only* in the context of a user's assigned configuration via the "Assign Combos" flow.
// For now, I will leave them, but they are prime candidates for cleanup once the new flow is fully implemented and tested.

async function showTaskSetsForConfiguration(configId, configName) {
    document.getElementById('tasksetConfigName').textContent = configName;
    document.getElementById('current-config-id-for-taskset').value = configId;

    try {
        // Use fetchWithAuth, which is initialized in initDependencies
        const taskSetsArray = await fetchWithAuth(`/api/admin/drive-management/configurations/${configId}/tasksets`); 

        // Check if the response is an array
        if (!Array.isArray(taskSetsArray)) { 
            console.error('Invalid response from server when fetching task sets: Expected an array but received:', taskSetsArray);
            throw new Error('Invalid response format from server: Expected an array of task sets.');
        }

        const taskSets = taskSetsArray; // Use the array directly
        const taskSetsList = document.getElementById('task-sets-list');
        
        if (!taskSetsList) {
            console.error('Task sets list element not found');
            showNotification('UI element for task sets not found.', 'error');
            return;
        }

        taskSetsList.innerHTML = ''; // Clear existing content

        if (taskSets.length === 0) {
            taskSetsList.innerHTML = '<tr><td colspan="6" class="text-center">No task sets found for this configuration. Create one!</td></tr>';
        } else {
            taskSetsList.innerHTML = taskSets.map(ts => `
                <tr data-task-set-id="${ts.id}">
                    <td>${ts.id}</td>
                    <td>${ts.name || 'N/A'}</td>
                    <td>${ts.display_order}</td>
                    <td>${ts.products_count || 0}</td>
                    <td><span class="badge bg-${ts.is_combo ? 'primary' : 'info'}">${ts.is_combo ? 'Combo' : 'Single'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-secondary manage-products-btn" data-task-set-id="${ts.id}" data-task-set-name="${ts.name || 'Task Set ' + ts.id}" data-config-id="${configId}" data-config-name="${configName}">Manage Products</button>
                        <button class="btn btn-sm btn-warning edit-task-set-btn" data-task-set-id="${ts.id}" data-config-id="${configId}" data-config-name="${configName}">Edit</button>
                        <button class="btn btn-sm btn-danger delete-task-set-btn" data-task-set-id="${ts.id}" data-config-id="${configId}" data-config-name="${configName}">Delete</button>
                    </td>
                </tr>
            `).join('');

            // Re-attach event listeners for newly created buttons
            taskSetsList.querySelectorAll('.manage-products-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const taskSetId = e.target.dataset.taskSetId;
                    const taskSetName = e.target.dataset.taskSetName;
                    showManageProductsModal(taskSetId, taskSetName, configId, configName); 
                });
            });
            taskSetsList.querySelectorAll('.edit-task-set-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const taskSetId = e.target.dataset.taskSetId;
                    const currentConfigId = e.target.dataset.configId;
                    const currentConfigName = e.target.dataset.configName;
                    showEditTaskSetModal(taskSetId, currentConfigId, currentConfigName); 
                });
            });
            taskSetsList.querySelectorAll('.delete-task-set-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const taskSetId = e.target.dataset.taskSetId;
                    const currentConfigId = e.target.dataset.configId;
                    const currentConfigName = e.target.dataset.configName;
                    handleDeleteTaskSet(taskSetId, currentConfigId, currentConfigName); 
                });
            });
        }

        const modalElement = document.getElementById('manageTaskSetsModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
            modal.show();
        } else {
            console.error('Manage Task Sets modal element (#manageTaskSetsModal) not found');
            showNotification('Could not display task sets modal: UI element missing.', 'error');
        }

    } catch (error) {
        console.error('Error in showTaskSetsForConfiguration:', error);
        showNotification(error.message || 'Error loading task sets for configuration.', 'error');
        
        // Attempt to show the modal anyway so the user isn't stuck, and display error inside
        const modalElement = document.getElementById('manageTaskSetsModal');
        if (modalElement) {
             const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
             modal.show(); 
             const taskSetsList = document.getElementById('task-sets-list');
             if(taskSetsList) {
                taskSetsList.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load task sets: ${error.message || 'Unknown error'}. Please try again or check console.</td></tr>`;
             }
        } else {
            console.error('Manage Task Sets modal element (#manageTaskSetsModal) not found, cannot display error fallback.');
        }
    }
}

export function showCreateTaskSetModal(configId, configName) { // Added export
    const modalId = 'createTaskSetModal';
    removeExistingModal(modalId);

    const modalHtml = `
    <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="${modalId}Label">Create New Task Set for ${configName}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="create-task-set-form">
              <input type="hidden" id="create-task-set-config-id" value="${configId}">
              <div class="mb-3">
                <label for="task-set-name" class="form-label">Task Set Name*</label>
                <input type="text" class="form-control" id="task-set-name" required>
              </div>
              <div class="mb-3">
                <label for="task-set-display-order" class="form-label">Display Order*</label>
                <input type="number" class="form-control" id="task-set-display-order" required min="1">
              </div>
              <div class="mb-3 form-check">
                <input type="checkbox" class="form-check-input" id="task-set-is-combo">
                <label class="form-check-label" for="task-set-is-combo">Is Combo Set (allows multiple products)</label>
              </div>
              <button type="submit" class="btn btn-primary">Create Task Set</button>
            </form>
          </div>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalElement);
    modal.show();

    document.getElementById('create-task-set-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('task-set-name').value;
        const display_order_from_form = parseInt(document.getElementById('task-set-display-order').value);
        const is_combo = document.getElementById('task-set-is-combo').checked;
        // configId and configName are available from the showCreateTaskSetModal parameters

        if (!name || !display_order_from_form || display_order_from_form <= 0) {
            showNotification('Task Set Name and a positive Display Order are mandatory.', 'error');
            return;
        }

        try {
            const response = await fetchWithAuth('/api/admin/drive-management/tasksets', { // Corrected API endpoint
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name, 
                    order_in_drive: display_order_from_form, // Field name matches backend
                    is_combo,
                    drive_configuration_id: configId // Added drive_configuration_id from function parameter
                })
            });
            if (response && response.id) { 
                showNotification('Task Set created successfully!', 'success');
                modal.hide();
                showTaskSetsForConfiguration(configId, configName); // Use parameters for refreshing
            } else {
                const errorMessage = response && response.message ? response.message : 'Failed to create task set.';
                throw new Error(errorMessage);
            }
        } catch (error) {
            const errorMessage = error && error.message ? error.message : 'Error creating task set';
            showNotification(errorMessage, 'error');
        }
    });
}

// Updated to accept configId and configName for refreshing the list
async function showEditTaskSetModal(taskSetId, configId, configName) { 
    console.log('showEditTaskSetModal called for taskSetId:', taskSetId, 'configId:', configId, 'configName:', configName);
    try {
        const taskSet = await fetchWithAuth(`/api/admin/drive-management/task-sets/${taskSetId}`); 

        const modalId = 'editTaskSetModal';
        removeExistingModal(modalId);

        const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="${modalId}Label">Edit Task Set: ${taskSet.name}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <form id="edit-task-set-form">
                  <input type="hidden" id="edit-task-set-id" value="${taskSet.id}">
                  <input type="hidden" id="edit-task-set-config-id" value="${configId}"> 
                  <div class="mb-3">
                    <label for="edit-ts-name" class="form-label">Task Set Name*</label>
                    <input type="text" class="form-control" id="edit-ts-name" value="${taskSet.name}" required>
                  </div>
                  <div class="mb-3>
                    <label for="edit-ts-display-order" class="form-label">Display Order*</label>
                    <input type="number" class="form-control" id="edit-ts-display-order" value="${taskSet.display_order}" required min="1">
                  </div>
                  <div class="mb-3 form-check">
                    <input type="checkbox" class="form-check-input" id="edit-ts-is-combo" ${taskSet.is_combo ? 'checked' : ''}>
                    <label class="form-check-label" for="edit-ts-is-combo">Is Combo Set</label>
                  </div>
                  <button type="submit" class="btn btn-primary">Save Changes</button>
                </form>
              </div>
            </div>
          </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById(modalId);
        const modal = new bootstrap.Modal(modalElement);
        modal.show();

        document.getElementById('edit-task-set-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-task-set-id').value;
            const name = document.getElementById('edit-ts-name').value;
            const display_order = parseInt(document.getElementById('edit-ts-display-order').value);
            const is_combo = document.getElementById('edit-ts-is-combo').checked;
            const currentConfigId = document.getElementById('edit-task-set-config-id').value;

            if (!name || !display_order || display_order <= 0) {
                showNotification('Task Set Name and a positive Display Order are mandatory.', 'error');
                return;
            }

            try {
                const updateResponse = await fetchWithAuth(`/api/admin/drive-management/task-sets/${id}`, { 
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, display_order, is_combo, drive_configuration_id: currentConfigId }) 
                });
                if (updateResponse && updateResponse.id) { 
                    showNotification('Task Set updated successfully!', 'success');
                    modal.hide();
                    showTaskSetsForConfiguration(currentConfigId, configName); 
                } else {
                    throw new Error(updateResponse.message || 'Failed to update task set.');
                }
            } catch (error) {
                showNotification(error.message || 'Error updating task set', 'error');
            }
        });

    } catch (error) {
        showNotification(error.message || 'Error loading task set for editing', 'error');
    }
}

async function handleDeleteTaskSet(taskSetId, configId, configName) { 
    console.log('handleDeleteTaskSet called for taskSetId:', taskSetId, 'configId:', configId, 'configName:', configName);
    if (confirm('Are you sure you want to delete this task set? This will also remove all associated products within this set.')) {
        try {
            const response = await fetchWithAuth(`/api/admin/drive-management/task-sets/${taskSetId}`, { 
                method: 'DELETE'
            });
            if (response && response.success !== false) { 
                showNotification('Task Set deleted successfully!', 'success');
                showTaskSetsForConfiguration(configId, configName); 
            } else {
                throw new Error(response.message || 'Failed to delete task set.');
            }
        } catch (error) {
            showNotification(error.message || 'Error deleting task set', 'error');
        }
    }
}

// --- User Drive Progress Management --- // Coming from admin-drives.js

// Function to show user drive progress modal
async function showUserDriveProgressModal(userId, username) {
    const modalElement = document.getElementById('userDriveProgressModal');
    if (!modalElement) {
        console.error('User drive progress modal element not found.');
        showNotification('Could not display progress: Modal component missing.', 'error');
        return;
    }
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    // Store userId and username on the modal for other functions to access
    modalElement.dataset.userId = userId;
    modalElement.dataset.username = username;

    const modalTitleElement = document.getElementById('userDriveProgressModalLabel');
    if (modalTitleElement) {
        modalTitleElement.textContent = `Drive Progress for ${username || 'User ' + userId}`;
        
        // Add refresh button if it doesn't exist
        let refreshBtnContainer = modalTitleElement.querySelector('.refresh-btn-container');
        if (!refreshBtnContainer) {
            refreshBtnContainer = document.createElement('span');
            refreshBtnContainer.className = 'refresh-btn-container ms-2'; // Added ms-2 for spacing
            modalTitleElement.appendChild(refreshBtnContainer);
        }
        refreshBtnContainer.innerHTML = ''; // Clear previous button if any

        const refreshBtn = document.createElement('button');
        refreshBtn.type = 'button';
        refreshBtn.className = 'btn btn-sm btn-outline-secondary';
        refreshBtn.id = 'refreshUserDriveProgressBtn';
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        
        refreshBtn.addEventListener('click', async () => {
            const currentUserId = modalElement.dataset.userId;
            const currentUsername = modalElement.dataset.username;
            if (currentUserId && currentUsername) {
                showNotification('Refreshing progress...', 'info');
                await _loadAndRenderUserDriveProgress(currentUserId, currentUsername);
            } else {
                showNotification('Could not refresh: User context lost.', 'error');
            }
        });
        refreshBtnContainer.appendChild(refreshBtn);
    }
    
    modal.show();
    await _loadAndRenderUserDriveProgress(userId, username); // Initial load
}

// --- Helper function to load and render user drive progress ---
async function _loadAndRenderUserDriveProgress(userId, username) {
    const modalBody = document.getElementById('userDriveProgressModalBody');
    const modalTitle = document.getElementById('userDriveProgressModalLabel');
    if (!modalBody || !modalTitle) {
        console.error('Modal elements not found for rendering progress.');
        return;
    }

    modalTitle.textContent = `Drive Progress for ${username}`;
    modalBody.innerHTML = '<p>Loading progress...</p>'; // Show loading state
    
    try {
        const data = await fetchWithAuth(`/api/admin/drive-management/users/${userId}/drive-progress`);
        if (!data || !data.task_items) {
            modalBody.innerHTML = `<p>No active drive or task items found for ${username}.</p>`;
            return;
        }

        // Fetch available products for combo creation
        let availableProducts = [];
        try {
            const productsResponse = await fetchWithAuth('/admin/products');
            availableProducts = productsResponse.products || [];
        } catch (error) {
            console.warn('Failed to load products for combo creation:', error);
        }

        let tableHtml = `
            <div id="progress-user-info" style="display: none;">${username} (ID: ${userId})</div>
            <p><strong>Drive:</strong> ${data.drive_configuration_name} (Session ID: ${data.drive_session_id})</p>
            <p><strong>Progress:</strong> ${data.completed_task_items} / ${data.total_task_items} tasks completed.</p>
            <table class="table table-sm table-striped" id="drive-progress-table">
                <thead>
                    <tr>
                        <th style="width: 60px;">Order</th>
                        <th>Task Name / Products</th>
                        <th style="width: 100px;">Status</th>
                        <th style="width: 120px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (data.task_items.length === 0) {
            tableHtml += '<tr><td colspan="4">No tasks in this drive session.</td></tr>';
        }

        data.task_items.forEach((item, index) => {
            let productDisplay = 'N/A';
            const products = [];
            if (item.product_1_name) products.push(item.product_1_name);
            if (item.product_2_name) products.push(item.product_2_name);
            if (item.product_3_name) products.push(item.product_3_name);

            if (item.is_combo) {
                productDisplay = `<strong>${item.task_name || 'Combo Task'}</strong> (Combo)`;
                if (products.length > 0) {
                    productDisplay += `<br><small class="text-primary">Contains: ${products.join(' / ')}</small>`;
                } else {
                    productDisplay += `<br><small class="text-muted">No products listed for this combo.</small>`;
                }
            } else { // Single task
                if (products.length > 0) {
                    if (item.task_name && item.task_name !== products[0]) {
                        productDisplay = `${item.task_name}: ${products[0]}`;
                    } else {
                        productDisplay = products[0];
                    }
                } else if (item.task_name) {
                    productDisplay = item.task_name;
                } else {
                    productDisplay = 'N/A';
                }
            }            const canAddCombo = item.user_status === 'PENDING' && products.length < 3;
            const showComboButton = canAddCombo && availableProducts.length > 0;

            tableHtml += `
                <tr id="task-row-${item.id}">
                    <td>${item.order_in_drive}</td>
                    <td>${productDisplay}</td>
                    <td><span class="badge bg-${item.user_status === 'COMPLETED' ? 'success' : (item.user_status === 'CURRENT' ? 'primary' : 'secondary')}">${item.user_status}</span></td>
                    <td>
                        ${showComboButton ? `
                            <button type="button" class="btn btn-sm btn-outline-primary" 
                                    onclick="toggleComboCreationRow('${item.id}', ${userId}, '${username}', ${item.order_in_drive})"
                                    id="combo-btn-${item.id}">
                                <i class="fas fa-plus me-1"></i>Combo
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;// Add hidden combo creation row
            if (showComboButton) {
                tableHtml += `
                    <tr id="combo-row-${item.id}" style="display: none; background-color: #f8f9ff;">
                        <td colspan="4">
                            <div class="combo-creation-form p-3 border rounded" style="background: linear-gradient(135deg, #f8f9ff 0%, #e3f2fd 100%);">
                                <h6 class="text-primary mb-3">
                                    <i class="fas fa-cube me-2"></i>Add Combo Products (Task ${item.order_in_drive})
                                </h6>
                                  <!-- Price Filter -->
                                <div class="row mb-3">
                                    <div class="col-md-4">
                                        <label class="form-label small">Min Price ($)</label>
                                        <input type="number" class="form-control form-control-sm" 
                                               id="min-price-${item.id}" 
                                               placeholder="0.00" min="0" step="0.01">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label small">Max Price ($)</label>
                                        <input type="number" class="form-control form-control-sm" 
                                               id="max-price-${item.id}" 
                                               placeholder="1000.00" min="0" step="0.01">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label small">Search Products</label>
                                        <input type="text" class="form-control form-control-sm" 
                                               id="search-products-${item.id}" 
                                               placeholder="Search by name..."
                                               onkeyup="searchProducts('${item.id}')">
                                    </div>
                                </div><!-- Product Selection -->
                                <div class="mb-3">
                                    <label class="form-label small">Select Products (Max 2 additional)</label>                                    <div class="product-selection-container" style="max-height: 300px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 6px;">
                                        <div class="table-responsive">
                                            <table class="table table-sm table-hover mb-0" id="products-table-${item.id}" style="font-size: 0.85rem;">
                                                <thead class="table-light sticky-top" style="top: 0; z-index: 10;">
                                                    <tr>
                                                        <th style="width: 60px; text-align: center; background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">Select</th>
                                                        <th style="width: auto; background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">Product Name</th>
                                                        <th style="width: 100px; text-align: right; background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">Price</th>
                                                    </tr>
                                                </thead>
                                                <tbody id="products-list-${item.id}">
                                                    ${availableProducts.map(product => `
                                                        <tr class="product-item" data-price="${product.price}" data-product-id="${product.id}" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor=''">
                                                            <td style="text-align: center; vertical-align: middle; padding: 8px;">
                                                                <input class="form-check-input" type="checkbox" 
                                                                       value="${product.id}" 
                                                                       id="product-${item.id}-${product.id}"
                                                                       onchange="updateComboProductSelection('${item.id}')"
                                                                       style="cursor: pointer;">
                                                            </td>
                                                            <td style="vertical-align: middle; padding: 8px;">
                                                                <label class="form-check-label small mb-0" for="product-${item.id}-${product.id}" style="cursor: pointer; font-weight: 500;">
                                                                    ${product.name}
                                                                </label>
                                                            </td>
                                                            <td style="text-align: right; vertical-align: middle; padding: 8px;">
                                                                <span class="badge bg-primary text-white" style="font-size: 0.75rem;">$${parseFloat(product.price).toFixed(2)}</span>
                                                            </td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div id="no-results-${item.id}" class="text-center p-3 text-muted small" style="display: none;">
                                            <i class="fas fa-search"></i> No products match the current filter
                                        </div>
                                    </div>
                                    <div class="d-flex justify-content-between align-items-center mt-2">
                                        <small id="filter-status-${item.id}" class="text-muted">Showing ${availableProducts.length} products</small>
                                        <small class="text-muted">Selected: <span id="selected-count-${item.id}">0</span>/2</small>
                                    </div>
                                </div>

                                <!-- Action Buttons -->
                                <div class="d-flex gap-2">
                                    <button type="button" class="btn btn-primary btn-sm" 
                                            onclick="createComboForTaskItem('${item.id}', ${userId})"
                                            id="create-btn-${item.id}">
                                        <i class="fas fa-plus me-1"></i>Add Combo
                                    </button>
                                    <button type="button" class="btn btn-secondary btn-sm" 
                                            onclick="toggleComboCreationRow('${item.id}')">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }
        });

        tableHtml += `
                </tbody>
            </table>
        `;
        modalBody.innerHTML = tableHtml;        // Set up price filtering for each combo creation form
        data.task_items.forEach(item => {
            if (item.user_status === 'PENDING' && item.products?.length < 3) {
                setupPriceFiltering(item.id, availableProducts);
            }
        });

        // Hide the old combo button since we now have inline buttons
        const createComboBtn = document.getElementById('create-combo-from-progress-btn');
        if (createComboBtn) {
            createComboBtn.style.display = 'none';
        }

    } catch (error) {
<<<<<<< HEAD
        console.error('Error fetching user drive progress:', error);
        showNotification('Failed to fetch user drive progress: ' + (error.message || 'Unknown error'), 'error');
        document.getElementById('userDriveProgressDetailsPlaceholder').style.display = 'none';        document.getElementById('userDriveProgressDetails').style.display = 'block'; // Show the details section to display error message inside
        document.getElementById('progress-task-items-list').innerHTML = `<tr><td colspan="3" class="text-center text-danger">Error loading data.</td></tr>`;
    }
}

// ===== ENHANCED COMBO CREATION FUNCTIONALITY =====

// Global variables for enhanced combo creation
let currentComboUserId = null;
let currentComboUsername = null;
let userProgressData = null;
let availableProductsForCombo = [];

/**
 * Initialize enhanced combo creation from View Progress modal
 */
function initializeEnhancedComboCreation() {
    // Add event listener to the "Create Combo" button in View Progress modal
    const createComboFromProgressBtn = document.getElementById('create-combo-from-progress-btn');
    if (createComboFromProgressBtn) {
        createComboFromProgressBtn.addEventListener('click', () => {
            // Extract user info from the progress modal
            const userInfoElement = document.getElementById('progress-user-info');
            if (userInfoElement && userInfoElement.textContent) {
                const userText = userInfoElement.textContent.trim();
                // Extract user ID from format like "Username (ID: 123)"
                const userIdMatch = userText.match(/\(ID:\s*(\d+)\)/);
                const userId = userIdMatch ? userIdMatch[1] : null;
                
                // Extract username (everything before " (ID:")
                const usernameMatch = userText.match(/^(.+?)\s*\(ID:/);
                const username = usernameMatch ? usernameMatch[1].trim() : 'Unknown User';
                
                if (userId) {
                    showEnhancedComboCreationModal(userId, username);
                } else {
                    showNotification('Could not determine user ID for combo creation', 'error');
                }
            } else {
                showNotification('User information not available for combo creation', 'error');
            }
        });
    }

    // Initialize enhanced combo creation modal event handlers
    initializeEnhancedComboModalHandlers();
}

/**
 * Show the enhanced combo creation modal
 */
async function showEnhancedComboCreationModal(userId, username) {
    currentComboUserId = userId;
    currentComboUsername = username;
    
    // Show the modal
    const modalElement = document.getElementById('enhancedComboCreationModal');
    if (!modalElement) {
        showNotification('Enhanced combo creation modal not found', 'error');
        return;
    }
    
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
    
    // Reset form
    resetEnhancedComboForm();
    
    // Load user progress and products
    await Promise.all([
        loadUserProgressForCombo(userId, username),
        loadProductsForCombo()
    ]);
}

/**
 * Load user progress data for combo creation
 */
async function loadUserProgressForCombo(userId, username) {
    const loadingElement = document.getElementById('user-progress-loading');
    const contentElement = document.getElementById('user-progress-content');
    
    loadingElement.style.display = 'block';
    contentElement.style.display = 'none';
    
    try {
        const response = await fetchWithAuth(`/api/admin/drive-management/users/${userId}/drive-progress`);
        
        if (response && response.drive_session_id) {
            userProgressData = response;
            
            // Update UI elements
            document.getElementById('combo-user-info').textContent = `${username} (ID: ${userId})`;
            document.getElementById('combo-drive-config').textContent = response.drive_configuration_name || 'N/A';
            document.getElementById('combo-current-task').textContent = response.current_task_item_name || 'N/A';
            document.getElementById('combo-progress-summary').textContent = `${response.completed_task_items} of ${response.total_task_items} tasks completed`;
            
            // Update progress bar
            const progressPercent = response.total_task_items > 0 ? 
                Math.round((response.completed_task_items / response.total_task_items) * 100) : 0;
            const progressBar = document.getElementById('combo-progress-bar');
            progressBar.style.width = progressPercent + '%';
            progressBar.setAttribute('aria-valuenow', progressPercent);
            progressBar.textContent = progressPercent + '%';
            
            // Show the "Create Combo" button in progress modal
            const createComboBtn = document.getElementById('create-combo-from-progress-btn');
            if (createComboBtn) {
                createComboBtn.style.display = 'inline-block';
            }
            
            // Populate insertion point options
            populateInsertionPoints(response.task_items || []);
            
        } else {
            throw new Error(response?.message || 'No active drive session found');
        }
        
        loadingElement.style.display = 'none';
        contentElement.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading user progress for combo:', error);
        loadingElement.innerHTML = `<span class="text-danger">Error loading progress: ${error.message}</span>`;
        showNotification('Failed to load user progress for combo creation', 'error');
    }
}

/**
 * Populate insertion points for combo creation based on user progress
 */
function populateInsertionPoints(taskItems) {
    const insertionPointSelect = document.getElementById('combo-insertion-point');
    if (!insertionPointSelect) return;

    // Clear existing options
    insertionPointSelect.innerHTML = '';

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select insertion point...';
    insertionPointSelect.appendChild(defaultOption);

    taskItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.order_in_drive;
        option.textContent = `Before task ${item.order_in_drive}: ${item.task_item_name}`;
        insertionPointSelect.appendChild(option);
    });

    // Show custom position fields if a valid insertion point is selected
    insertionPointSelect.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        const customPositionGroup = document.getElementById('custom-position-group');
        if (selectedValue && selectedValue !== '') {
            customPositionGroup.style.display = 'block';
        } else {
            customPositionGroup.style.display = 'none';
        }
    });
}

/**
 * Initialize event handlers for the enhanced combo creation modal
 */
function initializeEnhancedComboModalHandlers() {
    const modalElement = document.getElementById('enhancedComboCreationModal');
    if (!modalElement) return;

    // Update product selection count on checkbox change
    modalElement.addEventListener('change', (e) => {
        if (e.target.classList.contains('product-select-checkbox')) {
            updateSelectedProductsCount();
        }
    });

    // Create combo button handler
    document.getElementById('create-combo-btn')?.addEventListener('click', async () => {
        const selectedProducts = Array.from(document.querySelectorAll('.product-select-checkbox:checked')).map(cb => cb.dataset.productId);
        const insertionPoint = document.getElementById('combo-insertion-point').value;
        const customName = document.getElementById('custom-combo-name').value.trim();
        const customOrder = parseInt(document.getElementById('custom-combo-order').value) || null;

        if (selectedProducts.length === 0) {
            return showNotification('Please select at least one product for the combo.', 'error');
        }

        // Confirm with the user
        const comboNamePreview = customName || `Combo (${selectedProducts.length} products)`;
        if (!confirm(`Create combo with name: "${comboNamePreview}" at position ${insertionPoint}?`)) {
            return;
        }

        try {
            // API call to create the combo task set
            const response = await fetchWithAuth('/api/admin/drive-management/tasksets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: customName,
                    order_in_drive: customOrder,
                    is_combo: true,
                    drive_configuration_id: currentComboUserId, // Assuming this is the correct usage
                    user_id: currentComboUserId,
                    product_ids: selectedProducts
                })
            });

            if (response && response.id) {
                showNotification(`Combo "${comboNamePreview}" created successfully!`, 'success');
                const modalInstance = bootstrap.Modal.getInstance(modalElement);
                if (modalInstance) {
                    modalInstance.hide();
                }
                await loadDrives(); // Refresh drives or relevant sections
            } else {
                throw new Error(response.message || 'Failed to create combo.');
            }
        } catch (error) {
            showNotification(error.message || 'Error creating combo', 'error');
        }
    });
}
=======
        console.error('Error fetching or rendering user drive progress:', error);
        modalBody.innerHTML = `<p class="text-danger">Error loading drive progress: ${error.message}</p>`;
        const createComboBtn = document.getElementById('create-combo-from-progress-btn');
        if (createComboBtn) {
            createComboBtn.style.display = 'none';
        }
    }
}

// Balance-based Drive Configuration Functions
export async function createBalanceBasedConfiguration() {
    if (!isInitialized) {
        showNotification('Drive module is not ready. Please wait or refresh.', 'error');
        return;
    }

    const modalId = 'balanceConfigModal';
    removeExistingModal(modalId);

    const modalHTML = `
        <div class="modal fade" id="${modalId}" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">Create Balance-Based Drive Configuration</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="balanceConfigForm">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">Configuration Name</label>
                                        <input type="text" class="form-control" id="configName" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Description</label>
                                        <textarea class="form-control" id="configDescription" rows="3"></textarea>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Tasks Required</label>
                                        <input type="number" class="form-control" id="tasksRequired" min="1" required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" id="balanceFilterEnabled" checked>
                                            <label class="form-check-label" for="balanceFilterEnabled">
                                                Enable Balance Filtering (75%-99%)
                                            </label>
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" id="tierQuantityEnabled" checked>
                                            <label class="form-check-label" for="tierQuantityEnabled">
                                                Enable Tier-Based Quantities
                                            </label>
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" id="isActive" checked>
                                            <label class="form-check-label" for="isActive">
                                                Active Configuration
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="alert alert-info">
                                <strong>Balance Filtering:</strong> Products will be filtered to 75%-99% of user balance<br>
                                <strong>Tier Quantities:</strong> Bronze/Silver: 40, Gold: 45, Platinum: 50 products
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="submitBalanceBasedConfiguration()">Create Configuration</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
}

export async function submitBalanceBasedConfiguration() {
    const formData = {
        name: document.getElementById('configName').value,
        description: document.getElementById('configDescription').value,
        tasks_required: parseInt(document.getElementById('tasksRequired').value),
        balance_filter_enabled: document.getElementById('balanceFilterEnabled').checked,
        tier_quantity_enabled: document.getElementById('tierQuantityEnabled').checked,
        is_active: document.getElementById('isActive').checked
    };

    try {
        const response = await fetchWithAuth('/admin/drives/balance-config/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.success) {
            showNotification('Balance-based configuration created successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('balanceConfigModal')).hide();
            loadDriveConfigurations(); // Refresh the configurations list
        } else {
            showNotification(response.message || 'Failed to create configuration', 'error');
        }
    } catch (error) {
        console.error('Error creating balance-based configuration:', error);
        showNotification('Error creating configuration', 'error');
    }
}

// Combo Creation Functions
export async function showComboCreationModal(taskSetId) {
    if (!isInitialized) {
        showNotification('Drive module is not ready. Please wait or refresh.', 'error');
        return;
    }

    const modalId = 'comboCreationModal';
    removeExistingModal(modalId);

    // First, get available products
    try {
        const productsResponse = await fetchWithAuth('/admin/products');
        const products = productsResponse.products || [];

        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content" style="border: 2px solid #007bff; background: linear-gradient(135deg, #f8f9ff 0%, #e3f2fd 100%);">
                        <div class="modal-header" style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white;">
                            <h5 class="modal-title">
                                <i class="fas fa-cube me-2"></i>Create Combo Products
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info" style="border-left: 4px solid #007bff; background-color: #e3f2fd;">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Combo Creation:</strong> Add 1-2 products to existing task sets. 
                                Combo products will have a <span style="color: #007bff; font-weight: bold;">blue hue</span> 
                                and <strong>4.5%</strong> commission rate.
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Select Products (1-2 maximum)</label>
                                <div class="product-selection-grid" style="max-height: 300px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px;">
                                    ${products.map(product => `
                                        <div class="form-check product-option" style="margin-bottom: 10px; padding: 10px; border-radius: 6px; transition: all 0.3s; cursor: pointer;" 
                                             onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='transparent'">
                                            <input class="form-check-input product-checkbox" type="checkbox" value="${product.id}" 
                                                   id="product-${product.id}" style="border-color: #007bff;">
                                            <label class="form-check-label" for="product-${product.id}" style="cursor: pointer; width: 100%;">
                                                <strong style="color: #007bff;">${product.name}</strong>
                                                <div class="text-muted small">Price: $${product.price}</div>
                                                ${product.description ? `<div class="text-muted small">${product.description.substring(0, 100)}...</div>` : ''}
                                            </label>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label">Description (Optional)</label>
                                <textarea class="form-control" id="comboDescription" rows="2" 
                                         placeholder="Description for this combo creation..."></textarea>
                            </div>

                            <div class="combo-preview" id="comboPreview" style="display: none; padding: 15px; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 8px; border: 1px solid #007bff;">
                                <h6 style="color: #007bff;"><i class="fas fa-eye me-2"></i>Combo Preview</h6>
                                <div id="selectedProductsList"></div>
                                <div class="mt-2">
                                    <small class="text-muted">Commission Rate: <strong style="color: #007bff;">4.5%</strong></small>
                                </div>
                            </div>
                        </div>
                                                                                             <div class="modal-footer" style="background-color: #f8f9ff;">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn" id="createComboBtn" onclick="createCombo(${taskSetId})" 
                                    style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; border: none;"
                                    disabled>
                                <i class="fas fa-plus me-2"></i>Create Combo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners for product selection
        const checkboxes = document.querySelectorAll('.product-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateComboPreview);
        });

        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();

    } catch (error) {
        console.error('Error loading products for combo creation:', error);
        showNotification('Error loading products', 'error');
    }
}

function updateComboPreview() {
    const selectedProducts = Array.from(document.querySelectorAll('.product-checkbox:checked'));
    const preview = document.getElementById('comboPreview');
    const createBtn = document.getElementById('createComboBtn');
    const productsList = document.getElementById('selectedProductsList');

    if (selectedProducts.length === 0) {
        preview.style.display = 'none';
        createBtn.disabled = true;
        return;
    }

    if (selectedProducts.length > 2) {
        // Uncheck the last selected if more than 2
        selectedProducts[selectedProducts.length - 1].checked = false;
        showNotification('Maximum 2 products allowed for combo', 'warning');
        return;
    }

    preview.style.display = 'block';
    createBtn.disabled = false;

    const productNames = selectedProducts.map(checkbox => {

        const label = document.querySelector(`label[for="${checkbox.id}"]`);
        return label.querySelector('strong').textContent;
    });

    productsList.innerHTML = `
        <div class="selected-products">
            ${productNames.map((name, index) => `
                <div class="badge" style="background-color: #007bff; margin-right: 8px; margin-bottom: 4px;">
                    <i class="fas fa-cube me-1"></i>${name}
                </div>
            `).join('')}
        </div>
    `;
}

export async function createCombo(taskSetId) {
    const selectedProducts = Array.from(document.querySelectorAll('.product-checkbox:checked'));
    const description = document.getElementById('comboDescription').value;

    if (selectedProducts.length === 0 || selectedProducts.length > 2) {
        showNotification('Please select 1-2 products for the combo', 'error');
        return;
    }

    const productIds = selectedProducts.map(checkbox => parseInt(checkbox.value));

    try {
        const response = await fetchWithAuth('/admin/drives/combos/insert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskSetId: taskSetId,
                productIds: productIds,
                description: description || 'Admin combo creation',
                commissionRate: 4.5
            })
        });

        if (response.success) {
            showNotification('Combo created successfully with blue hue and 4.5% commission!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('comboCreationModal')).hide();
            // Refresh the task sets or relevant view
            loadDriveConfigurations();
        } else {
            showNotification(response.message || 'Failed to create combo', 'error');
        }
    } catch (error) {
        console.error('Error creating combo:', error);
        showNotification('Error creating combo', 'error');
    }
}

// Tier Configuration Management
export async function showTierConfigModal() {
    if (!isInitialized) {
        showNotification('Drive module is not ready. Please wait or refresh.', 'error');
        return;
    }

    const modalId = 'tierConfigModal';
    removeExistingModal(modalId);

    try {
        // Get current tier configurations
        const response = await fetchWithAuth('/admin/drives/tier-configs');
        const tierConfigs = response.data || [];

        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-cog me-2"></i>Tier Quantity Configuration
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                Configure the maximum number of products per tier level.
                            </div>
                            
                            <form id="tierConfigForm">
                                ${tierConfigs.map(config => `
                                    <div class="mb-3">
                                        <label class="form-label">
                                            <strong>${config.tier_name}</strong> Tier - Product Quantity Limit
                                        </label>
                                        <input type="number" class="form-control" 
                                               data-tier="${config.tier_name}" 
                                               value="${config.quantity_limit}" 
                                               min="1" max="100" required>
                                    </div>
                                `).join('')}
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-success" onclick="updateTierConfigs()">
                                <i class="fas fa-save me-2"></i>Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();

    } catch (error) {
        console.error('Error loading tier configurations:', error);
        showNotification('Error loading tier configurations', 'error');
    }
}

export async function updateTierConfigs() {
    const form = document.getElementById('tierConfigForm');
    const inputs = form.querySelectorAll('input[data-tier]');
    
    const tierConfigs = Array.from(inputs).map(input => ({
        tier_name: input.dataset.tier,
        quantity_limit: parseInt(input.value)
    }));

    try {
        const response = await fetchWithAuth('/admin/drives/tier-configs', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tierConfigs })
        });

        if (response.success) {
            showNotification('Tier configurations updated successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('tierConfigModal')).hide();
        } else {
            showNotification(response.message || 'Failed to update tier configurations', 'error');
        }
    } catch (error) {
        console.error('Error updating tier configurations:', error);
        showNotification('Error updating tier configurations', 'error');
    }
}

// --- Inline Combo Creation Functions ---

/**
 * Toggle the combo creation row for a specific task item
 */
window.toggleComboCreationRow = function(taskItemId, userId, username, orderInDrive) {
    const comboRow = document.getElementById(`combo-row-${taskItemId}`);
    const comboBtn = document.getElementById(`combo-btn-${taskItemId}`);
    
    if (!comboRow) return;
    
    if (comboRow.style.display === 'none') {
        // Close any other open combo rows
        document.querySelectorAll('[id^="combo-row-"]').forEach(row => {
            if (row.id !== `combo-row-${taskItemId}`) {
                row.style.display = 'none';
            }
        });
        
        // Show this combo row
        comboRow.style.display = 'table-row';
        comboBtn.innerHTML = '<i class="fas fa-minus me-1"></i>Cancel';
        comboBtn.classList.remove('btn-outline-primary');
        comboBtn.classList.add('btn-outline-secondary');
        
        // Focus on the first input
        const firstInput = comboRow.querySelector('input[type="number"]');
        if (firstInput) firstInput.focus();
    } else {
        // Hide combo row
        comboRow.style.display = 'none';
        comboBtn.innerHTML = '<i class="fas fa-plus me-1"></i>Combo';
        comboBtn.classList.remove('btn-outline-secondary');
        comboBtn.classList.add('btn-outline-primary');
        
        // Reset form
        resetComboForm(taskItemId);
    }
};

/**
 * Set up price filtering for a specific task item's combo creation
 */
function setupPriceFiltering(taskItemId, availableProducts) {
    const minPriceInput = document.getElementById(`min-price-${taskItemId}`);
    const maxPriceInput = document.getElementById(`max-price-${taskItemId}`);
    
    if (!minPriceInput || !maxPriceInput) {
        console.warn(`Price filter inputs not found for task ${taskItemId}`);
        return;
    }

    // Add price range suggestions
    const prices = availableProducts.map(p => parseFloat(p.price)).filter(p => !isNaN(p)).sort((a, b) => a - b);
    const minSuggested = prices[0] || 0;
    const maxSuggested = prices[prices.length - 1] || 1000;
    const midRange = prices[Math.floor(prices.length / 2)] || 50;

    // Set placeholder values based on available products
    minPriceInput.placeholder = `Min: $${minSuggested.toFixed(2)}`;
    maxPriceInput.placeholder = `Max: $${maxSuggested.toFixed(2)}`;

    // Add quick filter buttons
    const filterContainer = minPriceInput.closest('.row');
    if (filterContainer && !document.getElementById(`quick-filters-${taskItemId}`)) {
        const quickFilters = document.createElement('div');
        quickFilters.id = `quick-filters-${taskItemId}`;
        quickFilters.className = 'col-12 mt-2';
        quickFilters.innerHTML = `
            <div class="d-flex gap-1 flex-wrap">
                <small class="text-muted me-2">Quick filters:</small>
                <button type="button" class="btn btn-outline-secondary btn-sm px-2 py-0" 
                        onclick="setQuickFilter('${taskItemId}', 0, ${midRange})">
                    <$${midRange.toFixed(0)}
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm px-2 py-0" 
                        onclick="setQuickFilter('${taskItemId}', ${midRange}, ${maxSuggested})">
                    $${midRange.toFixed(0)}+
                </button>
                <button type="button" class="btn btn-outline-success btn-sm px-2 py-0" 
                        onclick="setQuickFilter('${taskItemId}', 0, 0)">
                    <i class="fas fa-times"></i> Clear
                </button>
            </div>
        `;
        filterContainer.appendChild(quickFilters);
    }
      function filterProducts() {
        const minPrice = parseFloat(minPriceInput.value) || 0;
        const maxPrice = parseFloat(maxPriceInput.value) || Infinity;
        const searchTerm = (document.getElementById(`search-products-${taskItemId}`)?.value || '').toLowerCase().trim();
        
        console.log(`Filtering products for task ${taskItemId}: min=${minPrice}, max=${maxPrice}, search="${searchTerm}"`);
        
        // Get all product rows from the table
        const productRows = document.querySelectorAll(`#products-list-${taskItemId} .product-item`);
        const noResultsMsg = document.getElementById(`no-results-${taskItemId}`);
        const filterStatus = document.getElementById(`filter-status-${taskItemId}`);
        
        let visibleCount = 0;
        
        productRows.forEach(row => {
            const priceText = row.dataset.price;
            const price = parseFloat(priceText);
            const productName = row.querySelector('label').textContent.toLowerCase();
            
            const priceMatch = !isNaN(price) && price >= minPrice && price <= maxPrice;
            const nameMatch = searchTerm === '' || productName.includes(searchTerm);
            
            if (priceMatch && nameMatch) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
                // Uncheck hidden items and update selection count
                const checkbox = row.querySelector('input[type="checkbox"]');
                if (checkbox && checkbox.checked) {
                    checkbox.checked = false;
                    updateComboProductSelection(taskItemId);
                }
            }
        });
        
        // Show/hide no results message
        if (visibleCount === 0) {
            if (noResultsMsg) {
                noResultsMsg.style.display = 'block';
                noResultsMsg.innerHTML = `<i class="fas fa-search"></i> No products match the current filters${searchTerm ? ` for "${searchTerm}"` : ''}`;
            }
            // Hide the table header when no results
            const tableHeader = document.querySelector(`#products-table-${taskItemId} thead`);
            if (tableHeader) {
                tableHeader.style.display = 'none';
            }
        } else {
            if (noResultsMsg) {
                noResultsMsg.style.display = 'none';
            }
            // Show the table header when there are results
            const tableHeader = document.querySelector(`#products-table-${taskItemId} thead`);
            if (tableHeader) {
                tableHeader.style.display = '';
            }
        }

        // Update filter status
        if (filterStatus) {
            const hasFilters = minPrice > 0 || maxPrice < Infinity || searchTerm !== '';
            if (hasFilters) {
                let statusText = `Showing ${visibleCount} of ${availableProducts.length} products`;
                if (searchTerm) {
                    statusText += ` matching "${searchTerm}"`;
                }
                filterStatus.textContent = statusText;
                filterStatus.style.display = 'block';
            } else {
                filterStatus.textContent = `Showing ${availableProducts.length} products`;
            }
        }
        
        console.log(`Filtered ${visibleCount} products visible for task ${taskItemId}`);
    }    // Add event listeners for instant filtering
    minPriceInput.addEventListener('input', filterProducts);
    maxPriceInput.addEventListener('input', filterProducts);
    
    // Add search input listener
    const searchInput = document.getElementById(`search-products-${taskItemId}`);
    if (searchInput) {
        searchInput.addEventListener('input', filterProducts);
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                filterProducts();
            }
        });
    }
    
    // Add clear button functionality to price inputs
    minPriceInput.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
            minPriceInput.value = '';
            filterProducts();
        }
    });
    
    maxPriceInput.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
            maxPriceInput.value = '';
            filterProducts();
        }
    });
    
    // Initial filter (show all products)
    filterProducts();
}

/**
 * Search products by name (called directly from onkeyup)
 */
window.searchProducts = function(taskItemId) {
    // This function is called directly from the onkeyup event
    // The actual filtering is handled by the debouncedFilter in setupPriceFiltering
    const searchInput = document.getElementById(`search-products-${taskItemId}`);
    if (searchInput) {
        // Trigger the input event to use the same debounced filtering
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
};

/**
 * Set quick filter values for price filtering
 */
window.setQuickFilter = function(taskItemId, minPrice, maxPrice) {
    const minPriceInput = document.getElementById(`min-price-${taskItemId}`);
    const maxPriceInput = document.getElementById(`max-price-${taskItemId}`);
    const searchInput = document.getElementById(`search-products-${taskItemId}`);
    
    if (minPriceInput && maxPriceInput) {
        if (minPrice === 0 && maxPrice === 0) {
            // Clear all filters
            minPriceInput.value = '';
            maxPriceInput.value = '';
            if (searchInput) {
                searchInput.value = '';
            }
        } else {
            minPriceInput.value = minPrice > 0 ? minPrice.toFixed(2) : '';
            maxPriceInput.value = maxPrice < Infinity && maxPrice > 0 ? maxPrice.toFixed(2) : '';
            // Keep search as is when applying price filters
        }
        
        // Trigger filter update with a small delay to ensure DOM is updated
        setTimeout(() => {
            minPriceInput.dispatchEvent(new Event('input', { bubbles: true }));
        }, 50);
        
        // Add visual feedback
        const quickFilterButtons = document.querySelectorAll(`#quick-filters-${taskItemId} .btn`);
        quickFilterButtons.forEach(btn => btn.classList.remove('active'));
        
        // Highlight the active filter button
        if (minPrice === 0 && maxPrice === 0) {
            // Clear button was clicked - no highlight needed
        } else {
            const clickedBtn = event ? event.target : null;
            if (clickedBtn) {
                clickedBtn.classList.add('active');
                setTimeout(() => clickedBtn.classList.remove('active'), 2000);
            }
        }
    }
};

/**
 * Update combo product selection count and validation
 */
window.updateComboProductSelection = function(taskItemId) {
    const selectedCheckboxes = document.querySelectorAll(`#products-list-${taskItemId} input[type="checkbox"]:checked`);
    const selectedCount = selectedCheckboxes.length;
    const maxAllowed = 2;
    
    // Update count display
    const countElement = document.getElementById(`selected-count-${taskItemId}`);
    if (countElement) {
        countElement.textContent = selectedCount;
        countElement.style.color = selectedCount > maxAllowed ? 'red' : '';
    }
    
    // Disable/enable unchecked checkboxes if at max
    const allCheckboxes = document.querySelectorAll(`#products-list-${taskItemId} input[type="checkbox"]`);
    allCheckboxes.forEach(checkbox => {
        if (!checkbox.checked) {
            checkbox.disabled = selectedCount >= maxAllowed;
        }
    });
    
    // Update create button state
    const createBtn = document.getElementById(`create-btn-${taskItemId}`);
    if (createBtn) {
        createBtn.disabled = selectedCount === 0 || selectedCount > maxAllowed;
    }
};

/**
 * Create combo for a specific task item
 */
window.createComboForTaskItem = async function(taskItemId, userId) {
    const createBtn = document.getElementById(`create-btn-${taskItemId}`);
    const originalText = createBtn.innerHTML;
    
    try {
        createBtn.disabled = true;
        createBtn.innerHTML = '<div class="spinner-border spinner-border-sm me-1"></div>Creating...';
        
        // Collect selected products
        const selectedCheckboxes = document.querySelectorAll(`#products-list-${taskItemId} input[type="checkbox"]:checked`);
        const selectedProductIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
        
        if (selectedProductIds.length === 0 || selectedProductIds.length > 2) {
            throw new Error('Please select 1-2 products for the combo');
        }
          // Get the user's active drive item ID and drive session
        const userProgressData = await fetchWithAuth(`/api/admin/drive-management/users/${userId}/drive-progress`);
        const taskItem = userProgressData.task_items?.find(item => item.id == taskItemId);
        
        if (!taskItem) {
            throw new Error('Task item not found');
        }
          // Call the backend API to add combo products to the existing task set
        const response = await fetchWithAuth(`/api/admin/drive-management/users/${userId}/drive/add-combo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                comboName: `Enhanced Task ${taskItem.order_in_drive}`,
                comboDescription: `Combo products added to task ${taskItem.order_in_drive}`,
                productIds: selectedProductIds,
                insertAfterTaskSetId: taskItem.id,
                insertAtOrder: taskItem.order_in_drive
            })
        });
        
        if (response && response.success) {
            showNotification(`Combo products added successfully to Task ${taskItem.order_in_drive}!`, 'success');
            
            // Hide the combo creation row
            toggleComboCreationRow(taskItemId);
            
            // Refresh the progress display
            const modal = document.getElementById('userDriveProgressModal');
            if (modal && modal.classList.contains('show')) {
                const userInfoElement = document.getElementById('progress-user-info');
                if (userInfoElement && userInfoElement.textContent) {
                    const userText = userInfoElement.textContent.trim();
                    const userIdMatch = userText.match(/\(ID:\s*(\d+)\)/);
                    const extractedUserId = userIdMatch ? userIdMatch[1] : userId;
                    const usernameMatch = userText.match(/^(.+?)\s*\(ID:/);
                    const username = usernameMatch ? usernameMatch[1].trim() : 'User';
                    
                    await _loadAndRenderUserDriveProgress(extractedUserId, username);
                }
            }
        } else {
            throw new Error(response?.message || 'Failed to create combo');
        }
        
    } catch (error) {
        console.error('Error creating combo for task item:', error);
        showNotification('Failed to create combo: ' + error.message, 'error');
    } finally {
        createBtn.disabled = false;
        createBtn.innerHTML = originalText;
    }
};

/**
 * Reset combo creation form for a task item
 */
function resetComboForm(taskItemId) {
    // Reset price inputs
    const minPriceInput = document.getElementById(`min-price-${taskItemId}`);
    const maxPriceInput = document.getElementById(`max-price-${taskItemId}`);
    if (minPriceInput) minPriceInput.value = '';
    if (maxPriceInput) maxPriceInput.value = '';
    
    // Uncheck all products
    const checkboxes = document.querySelectorAll(`#products-list-${taskItemId} input[type="checkbox"]`);
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        checkbox.disabled = false;
    });
    
    // Show all products
    const productItems = document.querySelectorAll(`#products-list-${taskItemId} .product-item`);
    productItems.forEach(item => {
        item.style.display = 'block';
    });
    
    // Remove no results message
    const noResultsMsg = document.getElementById(`no-results-${taskItemId}`);
    if (noResultsMsg) noResultsMsg.remove();
    
    // Update selection count
    updateComboProductSelection(taskItemId);
}

// --- End Inline Combo Creation Functions ---

>>>>>>> post
