// Drive Management Module for Admin Panel

// Will be imported from the main module
let fetchWithAuth;
let showNotification;
let isInitialized = false; // Flag to track initialization

// Helper function to remove an existing modal from the DOM
function removeExistingModal(modalId) {
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        // Ensure Bootstrap modal instance is disposed if it exists, to prevent issues
        const modalInstance = bootstrap.Modal.getInstance(existingModal);
        if (modalInstance) {
            modalInstance.hide(); // Hide first to allow for transitions
            // Bootstrap's hide is asynchronous, but removing the element directly after should be fine
            // For more complex scenarios, one might listen for the 'hidden.bs.modal' event
        }
        existingModal.remove();
        console.log(`Removed existing modal with ID: ${modalId}`);
    }
}

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

// Data Drives Management - Load all drives
export async function loadDrives() {
    if (!isInitialized) {
        showNotification('Drive module is not ready. Please wait or refresh.', 'error');
        console.error('loadDrives called before initDependencies completed.');
        return;
    }
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
            const assignedConfigName = drive.assigned_drive_configuration_name || 'N/A';
            const assignedConfigId = drive.assigned_drive_configuration_id || null;

            return `
            <tr data-user-id="${userId}" data-assigned-config-id="${assignedConfigId}" data-assigned-config-name="${assignedConfigName}">
                <td>${userId}</td>
                <td>${username}</td>
                <td>${assignedConfigName}</td>
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
                    <button class="btn btn-sm btn-primary assign-drive-config-btn"
                            data-user-id="${userId}"
                            data-username="${username}">
                        Assign Drive Config
                    </button>
                    <button class="btn btn-sm btn-success assign-combos-btn"
                            data-user-id="${userId}"
                            data-username="${username}"
                            data-assigned-config-id="${assignedConfigId}"
                            data-assigned-config-name="${assignedConfigName}"
                            ${!assignedConfigId ? 'disabled' : ''}
                            title="${!assignedConfigId ? 'Assign a Drive Config first' : 'Assign Task Sets (Combos)'}">
                        Assign Combos
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
                }

                if (!confirm(`Are you sure you want to reset the drive for ${username || 'this user'}?`)) {
                    return;
                }
                target.setAttribute('data-processing', 'true');
                console.log('Reset drive clicked for:', { userId, username });
                const response = await fetchWithAuth(`/admin/users/${userId}/reset-drive`, {
                    method: 'POST'
                });
                if (response.success) {
                    showNotification(response.message || 'Drive reset successfully', 'success');
                    await loadDrives();
                } else {
                    console.warn('Failed to reset drive:', response);
                    showNotification(response.message || 'Failed to reset drive', 'error');
                }
            }
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
                await showAssignDriveConfigModal(userId, username);
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
            }

        } catch (error) {
            console.error('Error in drive handler:', error);
            showNotification(`Operation failed: ${error.message || 'Unknown error'}`, 'error');
        } finally {
            // Remove processing flag to allow future events
            if (target.hasAttribute('data-processing')) {
                target.removeAttribute('data-processing');
            }
        }
    });

    // Mark table as having handlers initialized
    drivesTable.setAttribute('data-handlers-initialized', 'true');
}

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
}


// Function to show the modal for assigning combos (Task Sets)
async function showAssignCombosModal(userId, username, assignedConfigId, assignedConfigName) {
    console.log(`showAssignCombosModal for user: ${username} (ID: ${userId}), Config: ${assignedConfigName} (ID: ${assignedConfigId})`);
    
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('manageTaskSetsModal'));
    
    // Populate user and config info in the modal
    document.getElementById('modal-taskset-username').textContent = username;
    document.getElementById('modal-taskset-configname').textContent = assignedConfigName;
    // Store for later use, e.g., when creating a task set for this user/config
    document.getElementById('modal-taskset-user-id').value = userId;
    document.getElementById('modal-taskset-config-id').value = assignedConfigId;


    await loadProductsForTaskSetCreationModal(assignedConfigId);
    
    modal.show();
}

// New function to load products for the "Assign Combos" modal
async function loadProductsForTaskSetCreationModal(configId) {
    const productListDiv = document.getElementById('products-for-task-set-creation-list');
    if (!productListDiv) {
        console.error('Product list div for task set creation not found.');
        showNotification('UI element missing for product list.', 'error');
        return;
    }
    productListDiv.innerHTML = '<p>Loading products...</p>';

    try {        // API: GET /api/admin/drive-management/configurations/:configId/products
        // This endpoint should return all products associated with the drive configuration,
        // not products already in task sets for this config, but all products defined within the config.
        const response = await fetchWithAuth(`/api/admin/drive-management/configurations/${configId}/products`);

        if (!response.success || !Array.isArray(response.products)) {
            throw new Error(response.message || 'Failed to load products for the configuration or invalid format.');
        }
        
        const products = response.products;

        if (products.length === 0) {
            productListDiv.innerHTML = '<p>No products found in this drive configuration. Add products to the configuration first.</p>';
            return;
        }

        // Display products with an "Add Combo" button for each
        productListDiv.innerHTML = products.map(product => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>${product.name} (ID: ${product.id}, Price: $${product.price})</span>
                <button class="btn btn-sm btn-primary add-combo-from-product-btn" 
                        data-product-id="${product.id}" 
                        data-product-name="${product.name}">
                    + Add Combo
                </button>
            </div>
        `).join('');

        // Add event listeners for the "Add Combo" buttons
        productListDiv.querySelectorAll('.add-combo-from-product-btn').forEach(button => {
            button.addEventListener('click', async (e) => {                const productId = e.target.dataset.productId;
                const productName = e.target.dataset.productName;
                const currentUserId = document.getElementById('modal-taskset-user-id').value;
                const currentConfigId = document.getElementById('modal-taskset-config-id').value;

                if (!currentUserId || !currentConfigId) {
                    showNotification('Missing user ID or configuration ID. Please try again.', 'error');
                    console.error('Missing data:', { currentUserId, currentConfigId, productId, productName });
                    return;
                }

                // For simplicity, let's auto-generate a task set name and order for now.
                // In a real scenario, you might prompt the user for these.
                const taskSetName = `Combo for ${productName} (User: ${currentUserId})`;
                // A more robust way to determine order would be to count existing task sets for the user/config.
                const displayOrder = 1; // Placeholder

                console.log('Creating task set with:', { currentUserId, currentConfigId, productId, taskSetName, displayOrder });

                // API Call: POST /api/admin/drive-management/tasksets
                // Body should include: name, order_in_drive, is_combo (false for single product), 
                // drive_configuration_id, user_id, and product_ids (array with single product_id)
                try {
                    const creationResponse = await fetchWithAuth('/api/admin/drive-management/tasksets', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: taskSetName,
                            order_in_drive: displayOrder,
                            is_combo: false, // A "combo" from a single product is essentially a single task set
                            drive_configuration_id: currentConfigId,
                            user_id: currentUserId, 
                            product_ids: [productId] // Send as an array
                        })
                    });

                    if (creationResponse && creationResponse.id) {
                        showNotification(`Task Set "${taskSetName}" created successfully for product "${productName}"!`, 'success');
                        // Optionally, refresh or update UI. For now, just a notification.
                        // You might want to close the modal or refresh a list of user's task sets if displayed elsewhere.
                        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('manageTaskSetsModal'));
                        if (modalInstance) {
                            modalInstance.hide();
                        }
                        await loadDrives(); // Refresh drives to reflect any changes (e.g. if task set count is shown)
                    } else {
                        throw new Error(creationResponse.message || 'Failed to create task set.');
                    }
                } catch (error) {
                    showNotification(error.message || 'Error creating task set.', 'error');
                    console.error('Error creating task set from product:', error);
                }
            });
        });

    } catch (error) {
        productListDiv.innerHTML = `<p class="text-danger">Error loading products: ${error.message}</p>`;
        showNotification(error.message, 'error');
        console.error('Error in loadProductsForTaskSetCreationModal:', error);
    }
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
                        <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                          <table class="table table-sm table-hover">
                            <thead>
                              <tr>
                                <th>Select</th>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Price ($)</th>
                                <th>Commission (%)</th>
                              </tr>
                            </thead>
                            <tbody id="available-products-list">
                              ${productsList.map(product => `
                                <tr data-product-id="${product.id}" data-product-price="${product.price || 0}">
                                  <td><input type="checkbox" class="product-select-checkbox" data-product-id="${product.id}"></td>
                                  <td>${product.id}</td>
                                  <td>${product.name}</td>
                                  <td>${parseFloat(product.price || 0).toFixed(2)}</td>
                                  <td>${parseFloat(product.commission_rate || 0).toFixed(2)}</td>
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

// Replace the existing showEditDriveConfigurationModal function in c:\\Users\\user\\Documents\\affiliate-final\\public\\js\\admin-drives.js with this:

async function showEditDriveConfigurationModal(configId) {
    try {
        // Fetch the specific configuration
        const configResponse = await fetchWithAuth(`/api/admin/drive-management/configurations/${configId}`);
        if (!configResponse || !configResponse.id) {
            showNotification('Failed to load drive configuration details.', 'error');
            console.error('Invalid config response:', configResponse);
            return;
        }
        const config = configResponse;

        // Fetch all available products
        let productsList = [];
        try {
            const productsResponse = await fetchWithAuth(`/admin/products`);
            if (productsResponse && productsResponse.success && Array.isArray(productsResponse.products)) {
                productsList = productsResponse.products;
            } else if (Array.isArray(productsResponse)) { // Fallback for direct array response
                productsList = productsResponse;
            } else {
                console.warn('Products data is not in the expected array format, or is missing. Received:', productsResponse);
                showNotification('Products data is not in the expected format. Displaying an empty list.', 'warning');
            }
        } catch (fetchError) {
            console.error('Error fetching products for edit modal:', fetchError);
            showNotification('Error fetching products. Please try again.', 'error');
            // Continue with an empty productsList if fetching fails, so modal can still show config details
        }

        // Ensure product_ids from config are strings for consistent comparison
        const associatedProductIds = Array.isArray(config.product_ids) ? config.product_ids.map(String) : [];

        // 1. Prepare product data for sorting and rendering
        const productDataForTable = productsList.map(product => {
            const productIdStr = String(product.id); // Ensure product.id is a string for comparison
            const isSelected = associatedProductIds.includes(productIdStr);
            return {
                id: productIdStr, // Store as string
                name: product.name,
                price: product.price || 0,
                commission_rate: product.commission_rate || 0,
                isSelected: isSelected
            };
        });

        // 2. Sort product data: selected first, then by name
        productDataForTable.sort((a, b) => {
            if (a.isSelected && !b.isSelected) return -1;
            if (!a.isSelected && b.isSelected) return 1;
            const aName = String(a.name || '').toLowerCase();
            const bName = String(b.name || '').toLowerCase();
            if (aName < bName) return -1;
            if (aName > bName) return 1;
            return 0;
        });

        // 3. Generate HTML for sorted products
        const productsHtml = productDataForTable.map(p => `
            <tr data-product-id="${p.id}" data-product-price="${parseFloat(p.price).toFixed(2)}">
              <td><input type="checkbox" class="product-select-checkbox-edit" data-product-id="${p.id}" ${p.isSelected ? 'checked' : ''}></td>
              <td>${p.id}</td>
              <td>${p.name}</td>
              <td>${parseFloat(p.price).toFixed(2)}</td>
              <td>${parseFloat(p.commission_rate).toFixed(2)}</td>
            </tr>
        `).join('');

        const modalId = 'editDriveConfigModal';
        removeExistingModal(modalId); // Helper function to remove modal if it exists

        const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="${modalId}Label">Edit Drive Configuration: ${config.name}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <form id="edit-drive-config-form">
                  <input type="hidden" id="edit-config-id" value="${config.id}">
                  <div class="mb-3">
                    <label for="edit-config-name" class="form-label">Name*</label>
                    <input type="text" class="form-control" id="edit-config-name" value="${config.name || ''}" required>
                  </div>
                  <div class="mb-3">
                    <label for="edit-config-description" class="form-label">Description</label>
                    <textarea class="form-control" id="edit-config-description" rows="3">${config.description || ''}</textarea>
                  </div>
                  <div class="mb-3">
                    <label for="edit-config-tasks-required" class="form-label">Tasks Required (Number of Task Sets)*</label>
                    <input type="number" class="form-control" id="edit-config-tasks-required" value="${config.tasks_required || 1}" required min="1">
                  </div>
                  <div class="mb-3 form-check">
                    <input type="checkbox" class="form-check-input" id="edit-config-is-active" ${config.is_active ? 'checked' : ''}>
                    <label class="form-check-label" for="edit-config-is-active">Is Active</label>
                  </div>
                  
                  <hr>
                  <h5>Product Selection <span class="badge bg-secondary" id="selected-products-count-edit">0 selected</span></h5>
                  
                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label for="min-price-filter-edit" class="form-label">Min Price ($)</label>
                      <input type="number" class="form-control" id="min-price-filter-edit" value="0" min="0" step="0.01">
                    </div>
                    <div class="col-md-6">
                      <label for="max-price-filter-edit" class="form-label">Max Price ($)</label>
                      <input type="number" class="form-control" id="max-price-filter-edit" min="0" step="0.01">
                    </div>
                  </div>
                  
                  <div class="mb-3">
                    <button type="button" class="btn btn-secondary" id="apply-price-filter-edit">Apply Price Filter</button>
                    <button type="button" class="btn btn-outline-secondary" id="reset-price-filter-edit">Reset Filter</button>
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
                            <th>Commission (%)</th>
                          </tr>
                        </thead>
                        <tbody id="available-products-list-edit">
                          ${productsHtml}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <button type="submit" class="btn btn-primary">Update Configuration</button>
                </form>
              </div>
            </div>
          </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById(modalId);
        const modal = new bootstrap.Modal(modalElement);
        modal.show();

        // Initialize and update selected products counter for EDIT modal
        const selectedCountElementEdit = document.getElementById('selected-products-count-edit');
        const productCheckboxesEdit = document.querySelectorAll('#available-products-list-edit .product-select-checkbox-edit');
        
        const updateSelectedCountEdit = () => {
            const count = document.querySelectorAll('#available-products-list-edit .product-select-checkbox-edit:checked').length;
            selectedCountElementEdit.textContent = `${count} selected`;
        };

        productCheckboxesEdit.forEach(checkbox => {
            checkbox.addEventListener('change', updateSelectedCountEdit);
        });
        updateSelectedCountEdit(); // Initial count based on pre-selected items

        // Handle price filter for EDIT modal
        const applyFilterBtnEdit = document.getElementById('apply-price-filter-edit');
        const resetFilterBtnEdit = document.getElementById('reset-price-filter-edit');
        const minPriceInputEdit = document.getElementById('min-price-filter-edit');
        const maxPriceInputEdit = document.getElementById('max-price-filter-edit');
        
        applyFilterBtnEdit.addEventListener('click', () => {
            const minPrice = parseFloat(minPriceInputEdit.value) || 0;
            const maxPriceText = maxPriceInputEdit.value.trim();
            // If maxPriceText is empty, it means no upper limit.
            const maxPrice = maxPriceText === '' ? Number.MAX_SAFE_INTEGER : parseFloat(maxPriceText);
            
            document.querySelectorAll('#available-products-list-edit tr').forEach(row => {
                const productPrice = parseFloat(row.dataset.productPrice) || 0;
                // Adjust condition for maxPrice: if maxPrice is NaN (due to empty input but failed parse), treat as no limit.
                if (productPrice >= minPrice && (isNaN(maxPrice) || productPrice <= maxPrice)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
        
        resetFilterBtnEdit.addEventListener('click', () => {
            minPriceInputEdit.value = '0';
            maxPriceInputEdit.value = ''; // Clear max price input
            document.querySelectorAll('#available-products-list-edit tr').forEach(row => {
                row.style.display = '';
            });
        });

        // Handle form submission for EDIT modal
        document.getElementById('edit-drive-config-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentConfigId = document.getElementById('edit-config-id').value;
            const name = document.getElementById('edit-config-name').value;
            const description = document.getElementById('edit-config-description').value;
            const tasks_required = parseInt(document.getElementById('edit-config-tasks-required').value);
            const is_active = document.getElementById('edit-config-is-active').checked;
            
            const selectedProductIds = [];
            document.querySelectorAll('#available-products-list-edit .product-select-checkbox-edit:checked').forEach(checkbox => {
                selectedProductIds.push(parseInt(checkbox.dataset.productId, 10)); // Ensure IDs are integers for the backend
            });

            if (!name || !tasks_required || tasks_required <= 0) {
                showNotification('Name and a positive number for Tasks Required are mandatory.', 'error');
                return;
            }

            try {
                const response = await fetchWithAuth(`/api/admin/drive-management/configurations/${currentConfigId}`, {
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

                // Check for a success flag or specific status code from fetchWithAuth wrapper if applicable
                // Assuming direct response object or a response.success flag
                if (response && (response.success === true || (response.id && response.name === name))) { 
                    showNotification('Drive configuration updated successfully!', 'success');
                    modal.hide();
                    loadDriveConfigurations(); // Refresh the list
                } else {
                    // Log the full response for debugging if it's not a success
                    console.error('Failed to update configuration, response:', response);
                    const errorMessage = response && response.message ? response.message : 'Failed to update configuration.';
                    const errorDetail = response && response.error ? response.error : '';
                    const errorConstraint = response && response.constraint ? `Constraint: ${response.constraint}` : '';
                    showNotification(`${errorMessage} ${errorDetail} ${errorConstraint}`.trim(), 'error');
                }
            } catch (error) {
                console.error('Error updating configuration:', error);
                showNotification(error.message || 'Error updating configuration', 'error');
            }
        });

    } catch (error) {
        console.error('Error showing edit drive configuration modal:', error);
        showNotification('Failed to show edit drive configuration modal: ' + (error.message || 'Unknown error'), 'error');
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

// Updated to accept configId and configName for context when adding products or other operations that might need it
function showManageProductsModal(taskSetId, taskSetName, configId, configName) { 
    console.log('showManageProductsModal called for', { taskSetId, taskSetName, configId, configName });
    // Implementation will involve:
    // 1. Setting modal title.
    // 2. Fetching products for the task set: GET /api/admin/drive-management/task-sets/${taskSetId}/products
    // 3. Displaying products in a list/table with options to add, edit order/overrides, remove.
    // 4. "Add Product" would likely open another modal/form to select a product and set its properties for this task set.
    const modalElement = document.getElementById('manageProductsInTaskSetModal');
    if (!modalElement) {
        console.error('Manage Products modal element not found.');
        showNotification('UI Error: Manage products modal not found.', 'error');
        return;
    }

    document.getElementById('manageProductsModalLabel').textContent = `Manage Products for: ${taskSetName}`;
    // Store taskSetId and other context for use by other functions within this modal
    modalElement.dataset.taskSetId = taskSetId;
    modalElement.dataset.taskSetName = taskSetName;
    modalElement.dataset.configId = configId; 
    modalElement.dataset.configName = configName;

    const addProductBtn = document.getElementById('show-add-product-to-task-set-modal-btn');
    if (addProductBtn) {
        const newBtn = addProductBtn.cloneNode(true);
        addProductBtn.parentNode.replaceChild(newBtn, addProductBtn);
        newBtn.onclick = () => showAddProductToTaskSetModal(taskSetId, taskSetName, configId, configName);
    } else {
        console.error('Add product to task set button not found in modal');
    }
    
    const saveOrderBtn = document.getElementById('save-product-order-btn');
    if (saveOrderBtn) {
        const newSaveOrderBtn = saveOrderBtn.cloneNode(true);
        saveOrderBtn.parentNode.replaceChild(newSaveOrderBtn, saveOrderBtn);
        newSaveOrderBtn.onclick = () => handleSaveProductOrder(taskSetId, taskSetName, configId, configName);
    } else {
        console.error('Save product order button not found in modal');
    }

    loadProductsForTaskSet(taskSetId, taskSetName, configId, configName); // Pass configId and configName

    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    modal.show();
}

async function loadProductsForTaskSet(taskSetId, taskSetName, configId, configName) {
    const productsList = document.getElementById('products-in-task-set-list');
    if (!productsList) {
        console.error('Products in task set list element not found.');
        return;
    }
    productsList.innerHTML = '<tr><td colspan="5" class="text-center">Loading products...</td></tr>';

    try {
        const products = await fetchWithAuth(`/api/admin/drive-management/task-sets/${taskSetId}/products`); 

        if (!products || !Array.isArray(products)) { 
             throw new Error('Invalid data received for products in task set.');
        }

        if (products.length === 0) {
            productsList.innerHTML = '<tr><td colspan="5" class="text-center">No products added to this task set yet.</td></tr>';
        } else {
            // Sort products by display_order before rendering
            products.sort((a, b) => a.display_order - b.display_order);
            renderProductsInModal(products, taskSetId, taskSetName, configId, configName);
        }
    } catch (error) {
        productsList.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${error.message}</td></tr>`;
        showNotification(error.message, 'error');
    }
}

function renderProductsInModal(products, taskSetId, taskSetName, configId, configName) {
    const productsList = document.getElementById('products-in-task-set-list');
    productsList.innerHTML = products.map((p, index) => `
        <tr data-product-id="${p.product_id}" data-original-order="${p.display_order}">
            <td>${p.product_name}</td>
            <td>$${p.product_price}</td>
            <td>${p.product_commission_rate}%</td>
            <td>
                <button class="btn btn-sm btn-outline-secondary product-order-up-btn" ${index === 0 ? 'disabled' : ''} title="Move Up">
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary product-order-down-btn" ${index === products.length - 1 ? 'disabled' : ''} title="Move Down">
                    <i class="fas fa-arrow-down"></i>
                </button>
            </td>
            <td>
                <button class="btn btn-sm btn-danger remove-product-from-task-set-btn" data-product-id="${p.product_id}" data-product-name="${p.product_name}">Remove</button>
            </td>
        </tr>
    `).join('');

    // Add event listeners for reorder and remove buttons
    productsList.querySelectorAll('.remove-product-from-task-set-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.currentTarget.dataset.productId;
            const productName = e.currentTarget.dataset.productName;
            handleRemoveProductFromTaskSet(taskSetId, productId, productName, taskSetName, configId, configName);
        });
    });

    productsList.querySelectorAll('.product-order-up-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.currentTarget.closest('tr');
            if (row.previousElementSibling) {
                row.parentNode.insertBefore(row, row.previousElementSibling);
                updateProductReorderButtonStates(productsList);
            }
        });
    });

    productsList.querySelectorAll('.product-order-down-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.currentTarget.closest('tr');
            if (row.nextElementSibling) {
                row.parentNode.insertBefore(row.nextElementSibling, row);
                updateProductReorderButtonStates(productsList);
            }
        });
    });
    updateProductReorderButtonStates(productsList); // Initial state update
}

function updateProductReorderButtonStates(productListElement) {
    const rows = productListElement.querySelectorAll('tr');
    rows.forEach((row, index) => {
        const upButton = row.querySelector('.product-order-up-btn');
        const downButton = row.querySelector('.product-order-down-btn');
        if (upButton) upButton.disabled = index === 0;
        if (downButton) downButton.disabled = index === rows.length - 1;
    });
}

async function handleSaveProductOrder(taskSetId, taskSetName, configId, configName) {
    const productsListElement = document.getElementById('products-in-task-set-list');
    const productRows = productsListElement.querySelectorAll('tr[data-product-id]');
    const orderedProductIds = Array.from(productRows).map(row => row.dataset.productId);

    if (orderedProductIds.length === 0) {
        showNotification('No products to order.', 'info');
        return;
    }

    try {
        const response = await fetchWithAuth(`/api/admin/drive-management/task-sets/${taskSetId}/products/reorder`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products: productsOrder })
        });
        if (response && response.success) {
            showNotification('Product order saved successfully!', 'success');
            loadProductsForTaskSet(taskSetId, taskSetName, configId, configName); 
        } else {
            throw new Error(response.message || 'Failed to save product order.');
        }
    } catch (error) {
        showNotification(error.message || 'Error saving product order', 'error');
    }
}

async function showAddProductToTaskSetModal(taskSetId, taskSetName, configId, configName) {
    const modalId = 'addProductToTaskSetModal';
    removeExistingModal(modalId);

    // Fetch available products to populate the select dropdown
    let availableProducts = [];
    try {
        const productsResponse = await fetchWithAuth('/api/products'); // Assuming a general products endpoint
        if (!productsResponse.ok) {
            throw new Error('Failed to load available products.');
        }
        availableProducts = await productsResponse.json();
        if (availableProducts.success === false) { // If API wraps in {success: ..., products: ...}
             availableProducts = availableProducts.products || [];
        }
    } catch (error) {
        showNotification(error.message, 'error');
        return; // Don't show modal if products can't be loaded
    }

    if (!Array.isArray(availableProducts)) {
        console.error('Available products data is not an array:', availableProducts);
        showNotification('Could not load products for selection (invalid format).', 'error');
        return;
    }

    const productOptions = availableProducts.map(p => `<option value="${p.id}">${p.name} ($${p.price})</option>`).join('');

    const modalHtml = `
    <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="${modalId}Label">Add Product to: ${taskSetName}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="add-product-to-task-set-form">
              <div class="mb-3">
                <label for="select-product-to-add" class="form-label">Select Product*</label>
                <select class="form-select" id="select-product-to-add" required>
                  <option value="" disabled selected>Choose a product...</option>
                  ${productOptions}
                </select>
              </div>
              <button type="submit" class="btn btn-primary">Add Product</button>
            </form>
          </div>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalElement);
    modal.show();

    document.getElementById('add-product-to-task-set-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const productId = document.getElementById('select-product-to-add').value;

        if (!productId) {
            showNotification('Please select a product to add.', 'error');
            return;
        }

        try {
            const response = await fetchWithAuth(`/api/admin/drive-management/task-sets/${taskSetId}/products`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: productId })
            });
            if (response && response.success) {

                showNotification('Product added to task set successfully!', 'success');
                modal.hide();
                loadProductsForTaskSet(taskSetId, taskSetName, configId, configName); 
            } else {
                throw new Error(response.message || 'Failed to add product to task set.');
            }
        } catch (error) {
            showNotification(error.message || 'Error adding product to task set', 'error');
        }
    });
}

// Initialize Drive Configuration Handlers
export function initializeDriveConfigHandlers() {
    // Initialize the "Create New Configuration" button
    const createConfigBtn = document.getElementById('show-create-config-modal-btn');
    if (createConfigBtn) {
        createConfigBtn.addEventListener('click', () => {
            showCreateDriveConfigurationModal();
        });
        console.log('Create new configuration button handler initialized');
    } else {
        console.warn('Create new configuration button not found in the DOM');
    }
}