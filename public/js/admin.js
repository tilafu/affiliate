import * as DriveModuleAPI from './admin-drives.js';

// Admin Panel JavaScript
// Global variables
let driveUpdateInterval;

// Helper function for status colors (used by consolidated drive history)
function getStatusBadgeColor(status) {
    switch (status.toLowerCase()) {
        case 'active': return 'success';
        case 'pending': return 'warning';
        case 'completed': return 'primary';
        case 'failed': return 'danger';
        default: return 'secondary';
    }
}

async function viewDriveDetails(driveId) {
    try {
        const response = await fetchWithAuth(`/admin/drives/${driveId}/details`);
        if (response.success) {
            showNotification('Loading drive details...', 'info');
            // Implement drive details view...
        }
    } catch (error) {
        console.error('Error loading drive details:', error);
        showNotification('Failed to load drive details', 'error');
    }
}
window.viewDriveDetails = viewDriveDetails; // Make it globally accessible

// Add polling interval reference

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('auth_token');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');

    if (!token || !userData || userData.role !== 'admin') {
        showNotification('Not authorized as admin. Redirecting...', 'error');
        window.location.href = 'login.html';
        return;
    }

    // Initialize sidebar navigation
    initializeSidebar();
    
    // Load initial section
    loadSection('dashboard');

    // Initialize all section handlers
    initializeHandlers();
    
    // Initialize DriveModule functionality from admin-drives.js
    if (DriveModuleAPI && typeof DriveModuleAPI.initDependencies === 'function') {
        DriveModuleAPI.initDependencies({ fetchWithAuth, showNotification }); // Pass dependencies
        // Removed call to DriveModuleAPI.setupDrivePolling as it does not exist.
        // Polling will be handled by loadSection.
    } else {
        console.error('DriveModuleAPI or its initDependencies function is not available. Ensure admin-drives.js is loaded as a module and exports correctly.');
    }
});

// Helper function for authenticated API calls
async function fetchWithAuth(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token');
    const defaultHeaders = {
        'Authorization': `Bearer ${token}`,
        // 'Content-Type': 'application/json' // Default Content-Type will be handled below
    };

    const mergedOptions = {
        ...options, // Spread other options like method, body
        headers: {
            ...defaultHeaders, // Start with default headers (Authorization)
            ...(options.headers || {}), // Merge and override with provided headers
        }
    };

    // Set Content-Type to application/json by default if not already set and not FormData
    if (!mergedOptions.headers['Content-Type'] && !(options.body instanceof FormData)) {
        mergedOptions.headers['Content-Type'] = 'application/json';
    }

    // If body is FormData, the browser sets Content-Type to multipart/form-data automatically, 
    // so remove our default if it was set, or any explicit one if it conflicts.
    if (options.body instanceof FormData) {
        delete mergedOptions.headers['Content-Type'];
    }

    const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
    const response = await fetch(url, mergedOptions);

    let responseBodyText = '';
    try {
        responseBodyText = await response.text(); // Read body once as text
    } catch (e) {
        // This catch is primarily for network errors during response.text() itself,
        // though usually response.ok would be false for network issues caught by fetch itself.
        console.error('Error reading response text:', e);
        const err = new Error('Failed to read response from server.');
        err.status = response.status; // Keep original status if available
        throw err;
    }

    if (!response.ok) {
        let errorData = { message: `HTTP error! status: ${response.status}`, status: response.status, responseText: responseBodyText };
        try {
            // Try to parse the already read text as JSON
            errorData = { ...JSON.parse(responseBodyText), status: response.status, responseText: responseBodyText };
            console.error('API Error Response (JSON):', errorData);
        } catch (e) {
            // If parsing as JSON fails, the responseText is already in errorData
            console.error('API Error Response (Non-JSON):', responseBodyText);
            if (!errorData.message && responseBodyText) {
                errorData.message = responseBodyText;
            } else if (!errorData.message) {
                errorData.message = `HTTP error! status: ${response.status} - Non-JSON response`;
            }
        }
        const err = new Error(errorData.message || `HTTP error! status: ${response.status}`);
        err.data = errorData;
        err.status = response.status;
        throw err;
    }

    // If response.ok is true, try to parse the text as JSON
    try {
        if (responseBodyText === "" && response.status === 204) { // Handle 204 No Content specifically
             return null; // Or an empty object/array as appropriate for your API contract
        }
        return JSON.parse(responseBodyText);
    } catch (e) {
        // If JSON parsing fails for a successful response, it might be plain text or an empty body not handled as 204.
        console.warn('Successful response was not valid JSON. Status:', response.status, 'Body:', responseBodyText);
        // Return the raw text for successful non-JSON responses, or handle as needed.
        // If your API contract says
        // then this case might indicate an API issue or an unexpected response.
        return responseBodyText; // Or throw an error, or return null/undefined based on how you want to treat this.
    }
}

function showNotification(message, type = 'success') { // type can be 'success', 'error', 'notice', 'confirm' for dialog
    // Use $(document).dialog for notifications
    let dialogType = 'notice'; // Default dialog type
    if (type === 'success') {
        dialogType = 'success';
    } else if (type === 'error') {
        dialogType = 'error';
    }
    // This uses a jQuery dialog plugin, ensure it's loaded and configured.
    // Example: $(document).dialog({ type: dialogType, infoText: message, autoClose: 2500 });
    // For now, we'll assume the dialog plugin is available and works with these options.
    if (typeof $ !== 'undefined' && $.dialog) {
        $(document).dialog({
            type: dialogType,
            infoText: message,
            autoClose: 2500
        });
    } else {
        console.warn('jQuery dialog plugin not available. Using console for notification:', type, message);
        // Fallback to a simpler browser alert or console log if jQuery dialog is not present
        if (type === 'error') {
            alert(`Error: ${message}`);
        } else {
            alert(message);
        }
    }
}

function initializeSidebar() {
    // Handle submenu toggles
    document.querySelectorAll('.has-submenu > .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const submenu = e.target.nextElementSibling;
            submenu.classList.toggle('show');
        });
    });

    // Handle section navigation
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            loadSection(e.target.dataset.section);
        });
    });

    // Mobile menu toggle
    document.querySelector('.navbar-btn')?.addEventListener('click', () => {
        document.querySelector('.main-sidebar').classList.toggle('active');
        document.querySelector('.bg-overlay').classList.toggle('active');
    });

    // Handle logout
    document.getElementById('logout-button').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = 'login.html';
    });
}

function loadSection(sectionName) {
    // Clear any existing drive update interval when changing sections
    if (driveUpdateInterval) {
        clearInterval(driveUpdateInterval);
        driveUpdateInterval = null; // Reset the variable
    }

    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });

    // Show selected section
    const sectionElement = document.getElementById(`${sectionName}-section`);
    if (sectionElement) {
        sectionElement.style.display = 'block';
    }

    // Load section data
    switch (sectionName) {
        case 'dashboard':
            loadDashboardStats();
            break;
        case 'users':
            loadUsers();
            break;
        case 'deposits':
            loadDeposits();
            break;
        case 'withdrawals':
            loadWithdrawals();
            break;
        case 'drives': 
            if (DriveModuleAPI && typeof DriveModuleAPI.loadDrives === 'function') {
                DriveModuleAPI.loadDrives(); // Load drives data immediately
                // Setup polling for the drives list when this section is active
                driveUpdateInterval = setInterval(() => {
                    if (document.getElementById('drives-section')?.style.display === 'block') {
                        console.log('Polling for drive updates...');
                        DriveModuleAPI.loadDrives();
                    } else {
                        // If drives section is not visible, clear interval (should be caught by section change too)
                        if (driveUpdateInterval) clearInterval(driveUpdateInterval);
                        driveUpdateInterval = null;
                    }
                }, 30000); // Poll every 30 seconds
            } else {
                console.error('DriveModuleAPI.loadDrives function is not available.');
            }
            break;        case 'drive-configurations':
            // This section's initial data is loaded by DriveModuleAPI.initDependencies.
            // If a reload is needed upon navigating here, loadDriveConfigurations should be exported from admin-drives.js and called here.
            if (DriveModuleAPI && typeof DriveModuleAPI.loadDriveConfigurations === 'function') {
                 DriveModuleAPI.loadDriveConfigurations(); // This will currently not run as it's not exported.
                 
                 // Initialize the drive configuration handlers
                 if (typeof DriveModuleAPI.initializeDriveConfigHandlers === 'function') {
                     DriveModuleAPI.initializeDriveConfigHandlers();
                 }
            } else {
                console.log('Drive configurations section displayed. Initial data loaded by initDependencies.');
            }
            break;
        case 'products':
            loadProducts();
            break;
        // Parent sections don't need to load data
        case 'general':
        case 'finance':
        case 'operations':
            break;
    }
}

// Dashboard Statistics
async function loadDashboardStats() {
    try {
        const response = await fetchWithAuth('/admin/stats');
        if (response.success) {
            document.getElementById('total-users').textContent = response.stats.totalUsers;
            document.getElementById('total-deposits').textContent = `$${response.stats.totalDeposits}`;
            document.getElementById('total-withdrawals').textContent = `$${response.stats.totalWithdrawals}`;
            document.getElementById('active-drives').textContent = response.stats.activeDrives;
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        showNotification('Failed to load dashboard statistics', 'error');
    }
}

// Users Management
async function loadUsers() {
    try {
        const response = await fetchWithAuth('/admin/users');
        if (response.success) {
            const usersList = document.getElementById('users-list');
            usersList.innerHTML = response.users.map(user => `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td>${user.tier}</td>
                    <td>${user.role}</td>
                    <td>$${user.balance}</td>
                    <td>
                        <button class="btn btn-sm btn-primary manage-user-btn" 
                                data-user-id="${user.id}" 
                                data-username="${user.username}"
                                data-tier="${user.tier}"
                                data-assigned-config-id="${user.assigned_drive_configuration_id || ''}"
                                data-assigned-config-name="${user.assigned_drive_configuration_name || 'N/A'}">
                            Manage
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Failed to load users', 'error');
    }
}

// New function to populate the drive configuration dropdown
async function populateDriveConfigurationDropdown(currentAssignedConfigId, currentAssignedConfigName) {
    const selectElement = document.getElementById('user-drive-config-select');
    const currentAssignedElement = document.getElementById('current-assigned-config');

    if (!selectElement || !currentAssignedElement) {
        console.error('Required elements for drive configuration dropdown not found.');
        return;
    }

    // Note: The caller (e.g., manage user button handler) typically sets
    // selectElement.innerHTML = '<option value="">Loading configurations...</option>';
    // before calling this function.

    try {
        // Ensure DriveModuleAPI and getDriveConfigurations are available
        if (!DriveModuleAPI || typeof DriveModuleAPI.getDriveConfigurations !== 'function') {
            console.error('DriveModuleAPI.getDriveConfigurations is not available.');
            showNotification('Critical error: Drive configuration module not loaded correctly.', 'error');
            selectElement.innerHTML = '<option value="">Error loading module</option>';
            currentAssignedElement.textContent = 'Error';
            return;
        }

        const configurations = await DriveModuleAPI.getDriveConfigurations();
        
        selectElement.innerHTML = ''; // Clear "Loading..." or previous options immediately

        if (configurations && configurations.length > 0) {
            let activeConfigFound = false;
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "Select a Configuration";
            selectElement.appendChild(defaultOption);

            configurations.forEach(config => {
                if (config.is_active) { // Only show active configurations
                    activeConfigFound = true;
                    const option = document.createElement('option');
                    option.value = config.id;
                    option.textContent = config.name;
                    selectElement.appendChild(option);
                }
            });

            if (!activeConfigFound) {
                // If loop completes and no active configs were added, but default "Select..." is there.
                // We can either leave "Select a Configuration" or be more specific.
                // For clarity, let's indicate no active ones are available if the list was otherwise populated.
                // If configurations was not empty but all were inactive:
                if (selectElement.options.length <= 1 && configurations.some(c => !c.is_active)) { // only "Select..." is present
                     selectElement.innerHTML = '<option value="">No active configurations available</option>';
                } else if (selectElement.options.length <=1) { // Covers case where configurations was empty or all were inactive
                     selectElement.innerHTML = '<option value="">No configurations available</option>';
                }
            }
        } else {
            selectElement.innerHTML = '<option value="">No configurations available</option>';
        }

        currentAssignedElement.textContent = currentAssignedConfigName || 'N/A';
        selectElement.value = currentAssignedConfigId || '';

    } catch (error) {
        console.error('Error populating drive configuration dropdown:', error);
        showNotification('Failed to load drive configurations for assignment.', 'error');
        selectElement.innerHTML = '<option value="">Error loading configurations</option>';
        currentAssignedElement.textContent = 'Error';
    }
}

// Deposits Management
async function loadDeposits() {
    try {
        // Fetch only pending deposits for the admin view
        const response = await fetchWithAuth('/admin/deposits');
        if (response.success) {
            const depositsList = document.getElementById('deposits-list');
            if (depositsList) {
                depositsList.innerHTML = response.deposits.map(deposit => `
                    <tr>
                        <td>${deposit.id}</td>
                        <td>${deposit.username}</td>
                        <td>$${deposit.amount}</td>
                        <td>${new Date(deposit.created_at).toLocaleDateString()}</td>
                        <td>
                            <span class="status-badge status-${deposit.status.toLowerCase()}">
                                ${deposit.status}
                            </span>
                        </td>
                        <td>
                            ${deposit.status === 'PENDING' ? `
                                <button class="btn btn-sm btn-success approve-deposit-btn" data-id="${deposit.id}">
                                    Approve
                                </button>
                                <button class="btn btn-sm btn-danger reject-deposit-btn" data-id="${deposit.id}">
                                    Reject
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('');
            } else {
                console.warn("Deposits list element ('deposits-list') not found.");
            }
        }
    } catch (error) {
        console.error('Error loading deposits:', error);
        showNotification('Failed to load deposits', 'error');
    }
}

// Withdrawals Management
async function loadWithdrawals() {
    try {
        // Fetch only pending withdrawals for the admin view
        const response = await fetchWithAuth('/admin/withdrawals');
        if (response.success) {
            const withdrawalsList = document.getElementById('withdrawals-list');
            if (withdrawalsList) {
                withdrawalsList.innerHTML = response.withdrawals.map(withdrawal => `
                    <tr>
                        <td>${withdrawal.id}</td>
                        <td>${withdrawal.username}</td>
                        <td>$${withdrawal.amount}</td>
                        <td>${withdrawal.address}</td>
                        <td>${new Date(withdrawal.created_at).toLocaleDateString()}</td>
                        <td>
                            <span class="status-badge status-${withdrawal.status.toLowerCase()}">
                                ${withdrawal.status}
                            </span>
                        </td>
                        <td>
                            ${withdrawal.status === 'PENDING' ? `
                                <button class="btn btn-sm btn-success approve-withdrawal-btn" data-id="${withdrawal.id}">
                                    Approve
                                </button>
                                <button class="btn btn-sm btn-danger reject-withdrawal-btn" data-id="${withdrawal.id}">
                                    Reject
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('');
            } else {
                console.warn("Withdrawals list element ('withdrawals-list') not found.");
            }
        }
    } catch (error) {
        console.error('Error loading withdrawals:', error);
        showNotification('Failed to load withdrawals', 'error');
    }
}

// Data Drives Management
// These functions have been moved to admin-drives.js

// Support Messages Management
async function loadSupportMessages() {
    try {
        const response = await fetchWithAuth('/admin/support/messages');
        if (response.success) {
            const messagesList = document.getElementById('support-messages-list');
            // Group messages by thread_id for basic threading display
            const threads = {};
            response.messages.forEach(msg => {
                const threadKey = msg.thread_id || msg.id; // Original messages act as their own thread key
                if (!threads[threadKey]) {
                    threads[threadKey] = [];
                }
                threads[threadKey].push(msg);
            });

            let html = '';
            // Sort threads by the latest message in each thread
            Object.values(threads).sort((a, b) => {
                const lastMsgA = a[a.length - 1];
                const lastMsgB = b[b.length - 1];
                return new Date(lastMsgB.created_at) - new Date(lastMsgA.created_at);
            }).forEach(threadMessages => {
                // Sort messages within a thread by creation date
                threadMessages.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
                
                const originalMessage = threadMessages.find(m => m.id === (m.thread_id || m.id)) || threadMessages[0];
                html += `<div class="support-thread mb-3 border p-3 rounded">`;
                html += `<h6>Thread: ${originalMessage.subject || `Message ID ${originalMessage.id}`}</h6>`;

                threadMessages.forEach((msg, index) => {
                    // Use a slightly different background for unread messages, e.g., a light yellow or a specific class
                    // The 'list-group-item-warning' is a Bootstrap class that gives a yellow hue.
                    // If a different hue is needed, a custom CSS class would be better.
                    // For now, we'll stick to list-group-item-warning for unread.
                    const unreadClass = !msg.is_read && msg.sender_role !== 'admin' ? 'list-group-item-warning' : ''; 
                    const replyIndentClass = msg.thread_id && msg.id !== msg.thread_id ? 'ms-4' : ''; // Indent replies

                    html += `
                        <div class="list-group-item ${unreadClass} ${replyIndentClass} mb-2">
                            <div class="d-flex w-100 justify-content-between">
                                <h5 class="mb-1">
                                    From: ${msg.sender_username || 'N/A'} (ID: ${msg.sender_id}, Email: ${msg.sender_email || 'N/A'})
                                    ${msg.sender_role === 'admin' ? '<span class="badge bg-info ms-2">Admin Reply</span>' : ''}
                                </h5>
                                <small>${new Date(msg.created_at).toLocaleString()}</small>
                            </div>
                            ${index === 0 && msg.subject ? `<p class="mb-1"><strong>Subject: ${msg.subject}</strong></p>` : ''}
                            <p class="mb-1">${msg.message}</p>
                            ${msg.sender_role !== 'admin' ? // Only show reply button for user messages
                            `<button class="btn btn-sm btn-primary reply-message-btn" 
                                    data-message-id="${msg.id}"
                                    data-user-id="${msg.sender_id}"
                                    data-thread-subject="${originalMessage.subject || 'Message ID ' + originalMessage.id}">
                                Reply
                            </button>` : ''}
                        </div>
                    `;
                });
                html += `</div>`; // End of thread div
            });
            messagesList.innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading support messages:', error);
        showNotification('Failed to load support messages', 'error');
    }
}

// Products Management
async function loadProducts() {
    try {
        const response = await fetchWithAuth('/admin/products');
        if (response.success) {
            const productList = document.getElementById('products-list');            productList.innerHTML = response.products.map(product => `
                <tr>
                    <td>${product.id}</td>
                    <td>${product.name}</td>
                    <td>$${product.price}</td>
                    <td>
                        <button class="btn btn-sm btn-danger delete-product-btn" data-id="${product.id}">
                            Delete
                        </button>
                        <button class="btn btn-sm btn-warning edit-product-btn" data-id="${product.id}">
                            Edit
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showNotification('Failed to load products', 'error');
    }
}

async function createProduct(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    // This function handles the ADD form, remove min_tier and is_active
    const productData = {
        name: formData.get('name'),
        price: parseFloat(formData.get('price')),
        description: formData.get('description') || null,
        min_balance_required: parseFloat(formData.get('min_balance_required')) || 0,
        image_url: formData.get('image_url') || null
    };

    try {
        // NOTE: The fetch endpoint here seems incorrect for createProduct.
        // It should likely use fetchWithAuth or include the token header.
        const response = await fetchWithAuth('/admin/products', { // Changed to fetchWithAuth
            method: 'POST',
            body: JSON.stringify(productData)
            // Content-Type is handled by fetchWithAuth
        });
        
        // fetchWithAuth already parses JSON
        if (response.success) {
            showNotification('Product created successfully', 'success');
            document.getElementById('create-product-form').reset(); // Ensure this ID matches HTML
            await loadProducts();
        } else {
            showNotification(response.message || 'Error creating product', 'error');
        }
    } catch (error) {
        console.error('Error creating product:', error);
        showNotification('Error creating product: ' + error.message, 'error');
    }
}

async function editProduct(productId) { // This function populates the edit form
    try {
        const response = await fetchWithAuth(`/admin/products/${productId}`); // Changed to fetchWithAuth
        if (response.success) {
            // Populate edit form with product data
            const product = response.product;
            document.getElementById('edit-product-id').value = product.id;            // Populate relevant fields only
            document.getElementById('edit-product-name').value = product.name;
            document.getElementById('edit-product-price').value = product.price;
            // Assuming min_balance_required is still needed/editable
            document.getElementById('edit-min-balance').value = product.min_balance_required || 0; 
            // Add image_url if needed: document.getElementById('edit-image-url').value = product.image_url || '';
            
            // Show edit modal (Ensure this modal ID exists in admin.html)
            const editModalElement = document.getElementById('edit-product-modal'); // Ensure this ID matches HTML
            if (!editModalElement) {
                console.error("Edit product modal ('edit-product-modal') not found!");
                showNotification('UI Error: Edit modal element not found.', 'error');
                return;
            }
            const editModal = new bootstrap.Modal(editModalElement);
            editModal.show();
        } else {
            showNotification(response.message || 'Failed to load product details for editing.', 'error');
        }
    } catch (error) {
        console.error('Error loading product details for edit:', error);
        showNotification('Error loading product details: ' + error.message, 'error');
    }
}

async function updateProduct(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const productId = formData.get('product_id');
    // This function handles the EDIT form submission
    const productData = {
        name: formData.get('name'),
        price: parseFloat(formData.get('price')),
        description: formData.get('description') || null,
        min_balance_required: parseFloat(formData.get('min_balance_required')) || 0,
        image_url: formData.get('image_url') || null
    };

    try {
        // Use fetchWithAuth for authenticated request
        const response = await fetchWithAuth(`/admin/products/${productId}`, {
            method: 'PUT',
            body: JSON.stringify(productData)
        });
        
        // Assuming fetchWithAuth returns parsed JSON directly
        const data = response; 
        // fetchWithAuth returns parsed JSON directly
        if (response.success) {
            showNotification('Product updated successfully', 'success');
            const editModalEl = document.getElementById('edit-product-modal'); // Ensure this ID matches HTML
            if (editModalEl) {
                const editModal = bootstrap.Modal.getInstance(editModalEl);
                if (editModal) editModal.hide();
            }
            await loadProducts();
        } else {
            showNotification(response.message || 'Error updating product', 'error');
        }
    } catch (error) {
        console.error('Error updating product:', error);
        showNotification('Error updating product: ' + error.message, 'error');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }

    try {
        const response = await fetchWithAuth(`/admin/products/${productId}`, { // Changed to fetchWithAuth
            method: 'DELETE'
        });
        
        if (response.success) {
            showNotification('Product deleted successfully', 'success');
            await loadProducts();
        } else {
            showNotification(response.message || 'Error deleting product', 'error');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showNotification('Error deleting product: ' + error.message, 'error');
    }
}

async function respondToMessage(messageId, responseText) { // Added responseText parameter
    if (!responseText) return;

    try {
        const response = await fetchWithAuth(`/admin/support-messages/${messageId}/respond`, { // Changed to fetchWithAuth
            method: 'POST',
            body: JSON.stringify({ response: responseText }) // Ensure backend expects 'response'
        });
        
        if (response.success) {
            showNotification('Response sent successfully', 'success');
            await loadSupportMessages(); // Reload to see the update
        } else {
            showNotification(response.message || 'Error sending response', 'error');
        }
    } catch (error) {
        console.error('Error sending response:', error);
        showNotification('Error sending response: ' + error.message, 'error');
    }
}

async function markAsResolved(messageId) {
    try {
        const response = await fetchWithAuth(`/admin/support-messages/${messageId}/resolve`, { // Changed to fetchWithAuth
            method: 'PUT'
        });
        
        if (response.success) {
            showNotification('Message marked as resolved', 'success');
            await loadSupportMessages(); // Reload to see the update
        } else {
            showNotification(response.message || 'Error updating message status', 'error');
        }
    } catch (error) {
        console.error('Error updating message status:', error);
        showNotification('Error updating message status: ' + error.message, 'error');
    }
}

function initializeHandlers() {
    document.addEventListener('click', async (event) => {
        const target = event.target;

    // --- Drive Configuration & Task Set Modals ---
        // Handler for "Create New Configuration" button in the Drive Configurations section
        if (target.id === 'show-create-config-modal-btn') {
            event.preventDefault();
            if (DriveModuleAPI && typeof DriveModuleAPI.showCreateDriveConfigurationModal === 'function') {
                DriveModuleAPI.showCreateDriveConfigurationModal();
            } else {
                console.error('DriveModuleAPI.showCreateDriveConfigurationModal is not available. Ensure admin-drives.js is loaded and exports this function.');
                showNotification('Error: Cannot open the form to create a new drive configuration.', 'error');
            }
        }
        // Handler for "Add New Task Set" button within the "Manage Task Sets Modal"
        else if (target.id === 'show-create-taskset-modal-btn') {
            event.preventDefault();
            const configIdInput = document.getElementById('current-config-id-for-taskset');
            const configNameElement = document.getElementById('tasksetConfigName');
            
            const configId = configIdInput ? configIdInput.value : null;
            // Fallback for configName if the element isn't found or populated, though it should be.
            const configName = configNameElement ? configNameElement.textContent : 'Selected Configuration';

            if (configId) {
                if (DriveModuleAPI && typeof DriveModuleAPI.showCreateTaskSetModal === 'function') {
                    DriveModuleAPI.showCreateTaskSetModal(configId, configName);
                } else {
                    console.error('DriveModuleAPI.showCreateTaskSetModal is not available. Ensure admin-drives.js is loaded and DriveModuleAPI is correctly imported/assigned.');
                    showNotification('Error: Cannot open the form to create a new task set.', 'error');
                }
            } else {
                console.error('Cannot create task set: Configuration ID is missing. Ensure "current-config-id-for-taskset" input is populated when the modal is shown.');
                showNotification('Could not determine the current configuration to add a task set to. Please close and reopen the task set manager.', 'error');
            }
        }

        // User Management
        else if (target.matches('.manage-user-btn')) {
            const userId = target.dataset.userId;
            const username = target.dataset.username;
            const currentTier = target.dataset.tier;
            const assignedConfigId = target.dataset.assignedConfigId;
            const assignedConfigName = target.dataset.assignedConfigName;
            
            const userDetails = document.getElementById('user-details');
            document.getElementById('manage-username').textContent = username;
            document.getElementById('manage-user-id').textContent = userId; // This is a hidden input or span to store the ID
            document.getElementById('user-tier-select').value = currentTier;
            
            // Populate drive configuration dropdown
            await populateDriveConfigurationDropdown(assignedConfigId, assignedConfigName);
            
            userDetails.style.display = 'block';
        }
        // Assign Drive Configuration Button
        else if (target.id === 'assign-drive-config-button') {
            event.preventDefault();
            const userId = document.getElementById('manage-user-id').textContent; // Assuming manage-user-id holds the current user ID
            const selectedConfigId = document.getElementById('user-drive-config-select').value;

            if (!userId) {
                showNotification('Cannot assign configuration: User ID not found.', 'error');
                return;
            }

            // The backend will handle unassignment if selectedConfigId is empty
            try {
                const response = await fetchWithAuth(`/api/admin/users/${userId}/assign-drive-configuration`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ drive_configuration_id: selectedConfigId || null }) // Send null if "None" is selected
                });

                if (response.success) {
                    showNotification('Drive configuration assigned successfully!', 'success');
                    await loadUsers(); // Refresh the user list to show updated assignment (if displayed there)
                    document.getElementById('user-details').style.display = 'none'; // Hide the card
                } else {
                    throw new Error(response.message || 'Failed to assign drive configuration.');
                }
            } catch (error) {
                console.error('Error assigning drive configuration:', error);
                showNotification(error.message || 'Error assigning drive configuration', 'error');
            }
        }
    });

    document.getElementById('send-reply-button')?.addEventListener('click', async () => {
        const messageId = document.getElementById('send-reply-button').dataset.messageId;
        const userId = document.getElementById('send-reply-button').dataset.userId;
        const replyText = document.getElementById('reply-message').value;

        try {
            const response = await fetchWithAuth('/admin/support/messages/reply', {
                method: 'POST',
                body: JSON.stringify({
                    message_id: messageId,
                    user_id: userId,
                    message: replyText
                })
            });

            if (response.success) {
                showNotification('Reply sent successfully', 'success');
                document.getElementById('message-reply-form').style.display = 'none';
                document.getElementById('reply-message').value = '';
                loadSupportMessages();
            }
        } catch (error) {
            console.error('Error sending reply:', error);
            showNotification('Failed to send reply', 'error');
        }
    });

    // Product handlers

    // ADD Product Form Submission (Corrected)
    const addProductForm = document.getElementById('add-product-form');
    if (addProductForm) {
        addProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();            // Construct data only from relevant fields expected by the updated backend
            const productData = {
                name: document.getElementById('product-name').value,
                price: parseFloat(document.getElementById('product-price').value),
                // Add min_balance_required if it's in the add form
                // min_balance_required: parseFloat(document.getElementById('product-min-balance').value) || 0, 
                // Add image_url if it's in the add form
                // image_url: document.getElementById('product-image-url').value || null 
            };

            // Validate data before sending (basic example)
            if (!productData.name || isNaN(productData.price)) {
                 showNotification('Please fill in Name and Price correctly.', 'error');
                 return;
            }

            try {
                const response = await fetchWithAuth('/admin/products', {
                    method: 'POST',
                    body: JSON.stringify(productData)
                });

                if (response.success) {
                    showNotification('Product added successfully', 'success');
                    e.target.reset(); // Reset the add form
                    loadProducts(); // Reload the product list
                } else {
                     showNotification(response.message || 'Failed to add product', 'error');
                }
            } catch (error) {
                console.error('Error adding product:', error);
                showNotification('Failed to add product: ' + error.message, 'error');
            }
        });
    } else {
         console.warn("Add product form ('add-product-form') not found.");
    }


    // EDIT Product Button Click
     document.addEventListener('click', async (e) => {
        if (e.target.matches('.edit-product-btn')) {
            const productId = e.target.dataset.id;
            try {
                // Fetch specific product details
                 const response = await fetchWithAuth(`/admin/products/${productId}`); // Assuming endpoint exists
                 if (response.success && response.product) {
                     const product = response.product;                     // Populate the edit form modal
                     document.getElementById('edit-product-id').value = product.id;
                     document.getElementById('edit-product-name').value = product.name;
                     document.getElementById('edit-product-price').value = product.price;
                     // Populate other relevant fields if they exist in the modal form
                     // document.getElementById('edit-min-balance').value = product.min_balance_required || 0;
                     // document.getElementById('edit-image-url').value = product.image_url || '';

                     // Show the modal
                     const editModalElement = document.getElementById('edit-product-modal');
                     if (editModalElement) {
                         const editModal = new bootstrap.Modal(editModalElement);
                         editModal.show();
                     } else {
                         console.error("Edit product modal ('edit-product-modal') not found.");
                         showNotification('UI Error: Edit modal not found.', 'error');
                     }
                 } else {
                     showNotification(response.message || 'Failed to load product details for editing.', 'error');
                 }
            } catch (error) {
                 console.error('Error fetching product for edit:', error);
                 showNotification('Error fetching product details: ' + error.message, 'error');
            }
        }
    });

    // EDIT Product Form Submission
    const editProductForm = document.getElementById('edit-product-form');
     if (editProductForm) {
        editProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const productId = formData.get('product_id'); // Get ID from hidden input

            if (!productId) {
                 showNotification('Error: Product ID missing from edit form.', 'error');
                 return;
            }            const productData = {
                name: formData.get('name'),
                price: parseFloat(formData.get('price')),
                 // Add other fields if they are in the edit form
                 // min_balance_required: parseFloat(formData.get('min_balance_required')) || 0,
                 // image_url: formData.get('image_url') || null
            };

             // Validate data before sending (basic example)
            if (!productData.name || isNaN(productData.price)) {
                 showNotification('Please fill in Name and Price correctly.', 'error');
                 return;
            }

            try {
                const response = await fetchWithAuth(`/admin/products/${productId}`, {
                    method: 'PUT',
                    body: JSON.stringify(productData)
                });

                if (response.success) {
                    showNotification('Product updated successfully', 'success');
                    // Hide the modal
                    const editModalElement = document.getElementById('edit-product-modal');
                     if (editModalElement) {
                         const editModal = bootstrap.Modal.getInstance(editModalElement);
                         if (editModal) editModal.hide();
                     }
                    loadProducts(); // Reload the product list
                } else {
                     showNotification(response.message || 'Failed to update product', 'error');
                }
            } catch (error) {
                console.error('Error updating product:', error);
                showNotification('Failed to update product: ' + error.message, 'error');
            }
        });
    } else {
         console.warn("Edit product form ('edit-product-form') not found.");
    }


    // Delete product handler (Corrected structure)
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.delete-product-btn')) {
            if (confirm('Are you sure you want to delete this product?')) {
                const id = e.target.dataset.id;
                try {
                    // Correct fetch call for DELETE
                    const response = await fetchWithAuth(`/admin/products/${id}`, { method: 'DELETE' });
                    if (response.success) {
                        showNotification('Product deleted successfully', 'success');
                        loadProducts(); // Reload list after delete
                    } else {
                         showNotification(response.message || 'Failed to delete product', 'error');
                    }
                } catch (error) {
                    console.error('Error deleting product:', error);
                    showNotification('Failed to delete product: ' + error.message, 'error');
                }
            }
        }
    });
    // Removed the duplicated event listener for delete

    // User management handlers
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.manage-user-btn')) {
            const userId = e.target.dataset.userId;
            const username = e.target.dataset.username;
            const currentTier = e.target.dataset.tier;
            
            const userDetails = document.getElementById('user-details');
            document.getElementById('manage-username').textContent = username;
            document.getElementById('manage-user-id').textContent = userId;
            document.getElementById('user-tier-select').value = currentTier;
            userDetails.style.display = 'block';
        }
    });

    document.getElementById('update-tier-button')?.addEventListener('click', async () => {
        const userId = document.getElementById('manage-user-id').textContent;
        const newTier = document.getElementById('user-tier-select').value;

        try {
            const response = await fetchWithAuth(`/admin/users/${userId}/tier`, {
            method: 'PUT',
            body: JSON.stringify({ tier: newTier })
            });

            if (response.success) { // Fixed missing parenthesis
            showNotification('User tier updated successfully', 'success');
            loadUsers();
            }
        } catch (error) {
            console.error('Error updating user tier:', error);
            showNotification('Failed to update user tier', 'error');
        }
        });    // Visibility change handler for drives
    document.addEventListener('visibilitychange', () => {
        const drivesSection = document.getElementById('drives-section');
        if (document.visibilityState === 'visible' && drivesSection?.style.display === 'block') {
            if (DriveModuleAPI && typeof DriveModuleAPI.loadDrives === 'function') {
                DriveModuleAPI.loadDrives();
            } else {
                console.error('DriveModuleAPI.loadDrives is not available.');
            }
        }
    });
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        clearInterval(driveUpdateInterval);
    });
}

// Initial load for the default or active section
document.addEventListener('DOMContentLoaded', () => {
    const defaultSection = 'dashboard'; // Change this to your desired default section
    loadSection(defaultSection);
});
