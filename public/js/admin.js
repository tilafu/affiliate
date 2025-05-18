// Admin Panel JavaScript
import * as DriveModule from './admin-drives.js';

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
    
    // Setup drive polling using the Drive module
    DriveModule.setupDrivePolling();
});

// Helper function for authenticated API calls
async function fetchWithAuth(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token');
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    try {
        console.debug(`Making API request to: /api${endpoint}`);
        const response = await fetch(`/api${endpoint}`, { ...defaultOptions, ...options });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API error (${response.status}): ${errorText}`);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        const data = await response.json();
        console.debug(`API response from ${endpoint}:`, data);
        return data;
    } catch (error) {
        console.error(`Error in fetchWithAuth for ${endpoint}:`, error);
        // Re-throw the error to be handled by the calling function
        throw error;
    }
}

function showNotification(message, type = 'success') {
    const modalElement = document.getElementById('notificationModal');
    if (!modalElement) {
        console.error('Notification modal element not found. Falling back to alert.');
        alert((type === 'error' ? 'Error: ' : '') + message);
        return;
    }

    const modalTitle = document.getElementById('notificationModalLabel');
    const modalBody = document.getElementById('notificationModalBody');
    const modalHeader = document.getElementById('notificationModalHeader');

    if (!modalTitle || !modalBody || !modalHeader) {
        console.error('Notification modal sub-elements not found. Falling back to alert.');
        alert((type === 'error' ? 'Error: ' : '') + message);
        return;
    }

    modalBody.textContent = message;

    // Clear previous contextual classes
    modalHeader.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'bg-info', 'text-white');

    switch (type) {
        case 'success':
            modalTitle.textContent = 'Success';
            modalHeader.classList.add('bg-success', 'text-white');
            break;
        case 'error':
            modalTitle.textContent = 'Error';
            modalHeader.classList.add('bg-danger', 'text-white');
            break;
        case 'warning':
            modalTitle.textContent = 'Warning';
            modalHeader.classList.add('bg-warning', 'text-white');
            break;
        case 'info':
        default:
            modalTitle.textContent = 'Information';
            modalHeader.classList.add('bg-info', 'text-white');
            break;
    }

    const notificationModal = new bootstrap.Modal(modalElement);
    notificationModal.show();
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
            DriveModule.loadDrives(); // Using the drive module instead
            break;
        case 'drive-configurations': // New section
            loadDriveConfigurations();
            break;
        case 'support':
            loadSupportMessages();
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
                                data-tier="${user.tier}">
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
            const productList = document.getElementById('products-list');
            productList.innerHTML = response.products.map(product => `
                <tr>
                    <td>${product.id}</td>
                    <td>${product.name}</td>
                    <td>$${product.price}</td>
                    <td>${product.commission_rate}%</td>
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
        commission_rate: parseFloat(formData.get('commission_rate')),
        min_balance_required: parseFloat(formData.get('min_balance_required')) || 0
        // image_url might be added here if the form includes it
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
            document.getElementById('edit-product-id').value = product.id;
            // Populate relevant fields only
            document.getElementById('edit-product-name').value = product.name;
            document.getElementById('edit-product-price').value = product.price;
            document.getElementById('edit-commission-rate').value = product.commission_rate;
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
        commission_rate: parseFloat(formData.get('commission_rate')),
        min_balance_required: parseFloat(formData.get('min_balance_required')) || 0
        // Add image_url if needed: image_url: formData.get('image_url')
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
    document.addEventListener('click', async (e) => {

        // Drive Configuration Buttons
        if (e.target.matches('#create-drive-config-btn')) { // Corrected ID
            openDriveConfigModal();
        } else if (e.target.matches('.edit-drive-config-btn')) {
            const configId = e.target.dataset.configId;
            const config = allDriveConfigurations.find(c => c.id == configId);
            if (config) {
                openDriveConfigModal(config);
            } else {
                showNotification('Could not find configuration data to edit.', 'error');
            }
        } else if (e.target.matches('.delete-drive-config-btn')) {
            const configId = e.target.dataset.configId;
            deleteDriveConfigurationHandler(configId);
        }

        // Existing handlers below:
        // Deposit handlers
        if (e.target.matches('.approve-deposit-btn')) {
            const id = e.target.dataset.id;
            try {
                const response = await fetchWithAuth(`/admin/deposits/${id}/approve`, { method: 'POST' });
                if (response.success) {
                    showNotification('Deposit approved successfully', 'success');
                    loadDeposits();
                }
            } catch (error) {
                console.error('Error approving deposit:', error);
                showNotification('Failed to approve deposit', 'error');
            }
        } else if (e.target.matches('.reject-deposit-btn')) {
            const id = e.target.dataset.id;
            try {
                const response = await fetchWithAuth(`/admin/deposits/${id}/reject`, { method: 'POST' });
                if (response.success) {
                    showNotification('Deposit rejected successfully', 'success');
                    loadDeposits();
                }
            } catch (error) {
                console.error('Error rejecting deposit:', error);
                showNotification('Failed to reject deposit', 'error');
            }
        }
        // Withdrawal handlers
        else if (e.target.matches('.approve-withdrawal-btn')) {
            const id = e.target.dataset.id;
            try {
                const response = await fetchWithAuth(`/admin/withdrawals/${id}/approve`, { method: 'POST' });
                if (response.success) {
                    showNotification('Withdrawal approved successfully', 'success');
                    loadWithdrawals();
                }
            } catch (error) {
                console.error('Error approving withdrawal:', error);
                showNotification('Failed to approve withdrawal', 'error');
            }
        } else if (e.target.matches('.reject-withdrawal-btn')) {
            const id = e.target.dataset.id;
            try {
                const response = await fetchWithAuth(`/admin/withdrawals/${id}/reject`, { method: 'POST' });
                if (response.success) {
                    showNotification('Withdrawal rejected successfully', 'success');
                    loadWithdrawals();
                }
            } catch (error) {
                console.error('Error rejecting withdrawal:', error);
                showNotification('Failed to reject withdrawal', 'error');
            }
        }
        // Drive handlers - now using the Drive module
        else if (e.target.matches('.reset-drive-btn') || e.target.matches('.view-drive-history-btn')) {
            // Pass the event to the Drive module's handlers
            DriveModule.initializeDriveHandlers(e);
        }
        // Support message handlers
        else if (e.target.matches('.reply-message-btn')) {
            const messageId = e.target.dataset.messageId;
            const userId = e.target.dataset.userId;
            document.getElementById('message-reply-form').style.display = 'block';
            document.getElementById('send-reply-button').dataset.messageId = messageId;
            document.getElementById('send-reply-button').dataset.userId = userId;
        }
        // Product handlers - EDIT Product Button Click
        else if (e.target.matches('.edit-product-btn')) {
            const productId = e.target.dataset.id;
            try {
                const response = await fetchWithAuth(`/admin/products/${productId}`);
                if (response.success && response.product) {
                    const product = response.product;
                    document.getElementById('edit-product-id').value = product.id;
                    document.getElementById('edit-product-name').value = product.name;
                    document.getElementById('edit-product-price').value = product.price;
                    document.getElementById('edit-commission-rate').value = product.commission_rate;

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
        // Product handlers - Delete product handler
        else if (e.target.matches('.delete-product-btn')) {
            if (confirm('Are you sure you want to delete this product?')) {
                const id = e.target.dataset.id;
                try {
                    const response = await fetchWithAuth(`/admin/products/${id}`, { method: 'DELETE' });
                    if (response.success) {
                        showNotification('Product deleted successfully', 'success');
                        loadProducts(); 
                    } else {
                        showNotification(response.message || 'Failed to delete product', 'error');
                    }
                } catch (error) {
                    console.error('Error deleting product:', error);
                    showNotification('Failed to delete product: ' + error.message, 'error');
                }
            }
        }
        // User management handlers
        else if (e.target.matches('.manage-user-btn')) {
            const userId = e.target.dataset.userId;
            const username = e.target.dataset.username;
            const currentTier = e.target.dataset.tier;
            
            const userDetails = document.getElementById('user-details');
            document.getElementById('manage-username').textContent = username;
            document.getElementById('manage-user-id').textContent = userId;
            document.getElementById('user-tier-select').value = currentTier;
            userDetails.style.display = 'block';
        }
    }); // End of main click listener

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

    const addProductForm = document.getElementById('add-product-form');
    if (addProductForm) {
        addProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const productData = {
                name: document.getElementById('product-name').value,
                price: parseFloat(document.getElementById('product-price').value),
                commission_rate: parseFloat(document.getElementById('product-commission').value),
            };

            if (!productData.name || isNaN(productData.price) || isNaN(productData.commission_rate)) {
                 showNotification('Please fill in Name, Price, and Commission Rate correctly.', 'error');
                 return;
            }

            try {
                const response = await fetchWithAuth('/admin/products', {
                    method: 'POST',
                    body: JSON.stringify(productData)
                });

                if (response.success) {
                    showNotification('Product added successfully', 'success');
                    e.target.reset(); 
                    loadProducts(); 
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

    const editProductForm = document.getElementById('edit-product-form');
     if (editProductForm) {
        editProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const productId = formData.get('product_id'); 

            if (!productId) {
                 showNotification('Error: Product ID missing from edit form.', 'error');
                 return;
            }

            const productData = {
                name: formData.get('name'),
                price: parseFloat(formData.get('price')),
                commission_rate: parseFloat(formData.get('commission_rate')),
            };

            if (!productData.name || isNaN(productData.price) || isNaN(productData.commission_rate)) {
                 showNotification('Please fill in Name, Price, and Commission Rate correctly.', 'error');
                 return;
            }

            try {
                const response = await fetchWithAuth(`/admin/products/${productId}`, {
                    method: 'PUT',
                    body: JSON.stringify(productData)
                });

                if (response.success) {
                    showNotification('Product updated successfully', 'success');
                    const editModalElement = document.getElementById('edit-product-modal');
                     if (editModalElement) {
                         const editModal = bootstrap.Modal.getInstance(editModalElement);
                         if (editModal) {
                            editModal.hide();
                         }
                     }
                    loadProducts();
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
    
    // Drive Configuration Form Submission
    const driveConfigForm = document.getElementById('driveConfigForm');
    if (driveConfigForm) {
        // The event listener is already here, we need to ensure handleDriveConfigFormSubmit is defined and the button triggers it.
        // We will trigger the form submission from the button click handler.
        // driveConfigForm.addEventListener('submit', handleDriveConfigFormSubmit);
    }

    document.getElementById('update-tier-button')?.addEventListener('click', async () => {
        const userId = document.getElementById('manage-user-id').textContent;
        const newTier = document.getElementById('user-tier-select').value;

        try {
            const response = await fetchWithAuth(`/admin/users/${userId}/tier`, {
                method: 'PUT',
                body: JSON.stringify({ tier: newTier })
            });

            if (response.success) {
                showNotification('User tier updated successfully', 'success');
                loadUsers();
            }
        } catch (error) {
            console.error('Error updating user tier:', error);
            showNotification('Failed to update user tier', 'error');
        }
    });    
    document.addEventListener('visibilitychange', () => {
        const drivesSection = document.getElementById('drives-section');
        if (document.visibilityState === 'visible' && drivesSection?.style.display === 'block') {
            DriveModule.loadDrives();
        }
    });
    
    window.addEventListener('beforeunload', () => {
        clearInterval(driveUpdateInterval);
    });

    // Add event listener for the save drive configuration button explicitly
    const saveDriveConfigButton = document.getElementById('save-drive-config-button');
    if (saveDriveConfigButton) {
        saveDriveConfigButton.addEventListener('click', () => {
            // Programmatically submit the form
            // This will trigger the 'submit' event listener on the form if it exists and is correctly set up.
            // Or, we can directly call a refined version of handleDriveConfigFormSubmit.
            // For now, let's assume handleDriveConfigFormSubmit will be called by form.submit()
            // or we can call it directly if it's designed to be called without an event.
            // Let's make it so handleDriveConfigFormSubmit is robust.
            if (document.getElementById('driveConfigForm')) {
                 // Create a new submit event
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                // Dispatch the event on the form
                if (!document.getElementById('driveConfigForm').dispatchEvent(submitEvent)) {
                    // Event was cancelled
                    console.debug('Drive config form submission was cancelled by preventDefault.');
                }
            }
        });
    }
}

// Add this function for polling drive updates
function setupDrivePolling() {
    // Clear existing interval if any
    if (driveUpdateInterval) {
        clearInterval(driveUpdateInterval);
    }
    
    // Poll every 30 seconds
    driveUpdateInterval = setInterval(() => {
        if (document.getElementById('drives-section')?.style.display === 'block') {
            DriveModule.loadDrives();
        }
    }, 30000);
}

// Helper function to update the product counter in the drive configuration modal
function updateProductCounter() {
    const selectedCheckboxes = document.querySelectorAll('#product-checkboxes-container .product-checkbox:checked');
    const countElement = document.getElementById('selected-products-count');
    if (countElement) {
        countElement.textContent = selectedCheckboxes.length;
    }
}

// Helper function to populate a select element with products
async function populateProductCheckboxes(containerId) {
    const productContainer = document.getElementById(containerId);
    if (!productContainer) {
        console.error(`Product container '${containerId}' not found.`);
        return;
    }
    productContainer.innerHTML = '<p>Loading products...</p>'; // Loading indicator

    try {
        const response = await fetchWithAuth('/admin/products'); // Assuming this endpoint returns all products
        if (response.success && response.products) {
            if (response.products.length === 0) {
                productContainer.innerHTML = '<p>No products available to add.</p>';
                document.getElementById('selected-products-count').textContent = '0';
                return;
            }
            let checkboxesHTML = '';
            response.products.forEach(product => {
                checkboxesHTML += `
                    <div class="form-check">
                        <input class="form-check-input product-checkbox" type="checkbox" value="${product.id}" id="product-${product.id}-config">
                        <label class="form-check-label" for="product-${product.id}-config">
                            ${product.name} ($${product.price})
                        </label>
                    </div>
                `;
            });
            productContainer.innerHTML = checkboxesHTML;
            
            // Add event listeners to update the counter when checkboxes are changed
            const checkboxes = document.querySelectorAll('#product-checkboxes-container .product-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', updateProductCounter);
            });
            
            // Initialize counter
            updateProductCounter();
        } else {
            productContainer.innerHTML = '<p>Could not load products.</p>';
            document.getElementById('selected-products-count').textContent = '0';
            showNotification(response.message || 'Failed to load products for selection.', 'error');
        }
    } catch (error) {
        console.error('Error fetching products for selection:', error);
        productContainer.innerHTML = '<p>Error loading products.</p>';
        document.getElementById('selected-products-count').textContent = '0';
        showNotification('Error fetching products: ' + error.message, 'error');
    }
}

// Drive Configurations Management
let allDriveConfigurations = []; // To store fetched configurations for potential client-side filtering or access

async function loadDriveConfigurations() {
    console.debug("Attempting to load drive configurations..."); // Added debug
    try {        const response = await fetchWithAuth('/admin/drive-configurations');
        console.debug("Response from /admin/drive-configurations:", response); // Added debug
        console.debug("Response type:", typeof response);
        console.debug("Response keys:", response ? Object.keys(response) : 'null or undefined');
        
        if (response.success && response.configurations) {
            allDriveConfigurations = response.configurations;
            const listElement = document.getElementById('drive-configurations-list');
            if (!listElement) {
                console.error('Drive configurations list element not found.');
                showNotification('UI Error: Drive configurations list element not found.', 'error'); // Notify user
                return;
            }
            if (allDriveConfigurations.length === 0) {
                listElement.innerHTML = '<tr><td colspan="6" class="text-center">No drive configurations found.</td></tr>';
                return;
            }
            listElement.innerHTML = allDriveConfigurations.map(config => `
                <tr data-config-id="${config.id}">
                    <td>${config.id}</td>
                    <td>${config.name}</td>
                    <td>${config.description || 'N/A'}</td>
                    <td><span class="badge bg-${config.is_active ? 'success' : 'secondary'}">${config.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>${config.items ? config.items.length : 0}</td>
                    <td>
                        <button class="btn btn-sm btn-warning edit-drive-config-btn" data-config-id="${config.id}">Edit</button>
                        <button class="btn btn-sm btn-danger delete-drive-config-btn" data-config-id="${config.id}">Delete</button>
                    </td>
                </tr>
            `).join('');
        } else {
            console.error('Failed to load drive configurations:', response.message || 'Unknown error'); // Added debug
            showNotification(response.message || 'Failed to load drive configurations.', 'error');
        }
    } catch (error) {
        console.error('Error loading drive configurations:', error);
        showNotification('Error loading drive configurations: ' + error.message, 'error');
    }
}

async function handleDriveConfigFormSubmit(event) {
    if(event) event.preventDefault(); // Prevent default form submission if called by event

    const form = document.getElementById('driveConfigForm');
    const configId = form.elements['drive-config-id'].value;
    const name = form.elements['drive-config-name'].value;
    const description = form.elements['drive-config-description'].value;
    const isActive = form.elements['drive-config-active'].checked;

    const selectedProductCheckboxes = document.querySelectorAll('#product-checkboxes-container .product-checkbox:checked');
    const productIds = Array.from(selectedProductCheckboxes).map(cb => parseInt(cb.value, 10));

    if (!name.trim()) {
        showNotification('Configuration name is required.', 'error');
        return;
    }
    if (productIds.length === 0) {
        showNotification('At least one product must be selected for the configuration.', 'error');
        return;
    }

    const payload = {
        name,
        description,
        is_active: isActive,
        product_ids: productIds
    };

    const method = configId ? 'PUT' : 'POST';
    const endpoint = configId ? `/admin/drive-configurations/${configId}` : '/admin/drive-configurations';    try {
        showNotification('Saving drive configuration...', 'info');
        const response = await fetchWithAuth(endpoint, {
            method: method,
            body: JSON.stringify(payload)
        });

        if (response.success) {
            showNotification(response.message || 'Drive configuration saved successfully!', 'success');
            const modalElement = document.getElementById('driveConfigModal');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }
            loadDriveConfigurations(); // Refresh the list
        } else {
            showNotification(response.message || 'Failed to save drive configuration.', 'error');
        }

        if (response.success) {
            showNotification(response.message || 'Drive configuration saved successfully!', 'success');
            const modalElement = document.getElementById('driveConfigModal');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }
            loadDriveConfigurations(); // Refresh the list
        } else {
            showNotification(response.message || 'Failed to save drive configuration.', 'error');
        }
    } catch (error) {
        console.error('Error saving drive configuration:', error);
        showNotification('Error saving drive configuration: ' + error.message, 'error');
    }
}

// Ensure the submit event listener for the form is correctly placed and calls the new function
document.addEventListener('DOMContentLoaded', () => {
    // ... other DOMContentLoaded logic ...

    const driveConfigFormElement = document.getElementById('driveConfigForm');
    if (driveConfigFormElement) {
        driveConfigFormElement.addEventListener('submit', handleDriveConfigFormSubmit);
    }
});

function openDriveConfigModal(config = null) {
    const modalElement = document.getElementById('driveConfigModal');
    const modalTitle = modalElement.querySelector('.modal-title');
    const form = document.getElementById('driveConfigForm');
    form.reset(); // Reset form fields

    document.getElementById('drive-config-id').value = '';
    const productManagementArea = document.getElementById('drive-config-products-management-area');
    const productsNote = document.getElementById('drive-config-products-note');

    // Clear existing product checkboxes to avoid duplication if modal is reopened
    const productCheckboxesContainer = document.getElementById('product-checkboxes-container');
    if (productCheckboxesContainer) {
        productCheckboxesContainer.innerHTML = '<p><em>Loading products...</em></p>'; // Reset before populating
    }


    if (config) {
        // Edit mode
        modalTitle.textContent = 'Edit Drive Configuration';
        document.getElementById('drive-config-id').value = config.id;
        document.getElementById('drive-config-name').value = config.name;
        document.getElementById('drive-config-description').value = config.description || '';
        document.getElementById('drive-config-active').checked = config.is_active;        if (productManagementArea) productManagementArea.style.display = 'block';
        if (productsNote) productsNote.style.display = 'none'; // Hide note when editing

        populateProductCheckboxes('product-checkboxes-container').then(() => { // Corrected ID
            if (config.items && Array.isArray(config.items)) {
                config.items.forEach(item => {
                    const productId = typeof item === 'object' ? item.product_id : item; // Adapt if item structure varies
                    const checkbox = document.getElementById(`product-${productId}-config`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
                // Update the counter after setting checkboxes
                updateProductCounter();
            }
        });

    } else {
        // Create mode
        modalTitle.textContent = 'Create New Drive Configuration';
        if (productManagementArea) productManagementArea.style.display = 'block'; // Should be visible
        if (productsNote) productsNote.style.display = 'block'; // Show note for new configs
        populateProductCheckboxes('product-checkboxes-container'); // Corrected ID
    }

    const driveConfigModal = new bootstrap.Modal(modalElement);
    driveConfigModal.show();
}

async function deleteDriveConfigurationHandler(configId) {
    if (!confirm('Are you sure you want to delete this drive configuration? This action cannot be undone.')) {
        return;
    }
    // Backend endpoint for DELETE /admin/drive-configurations/:configId needs to be implemented.
    // It should also handle deletion of associated drive_configuration_items.
    try {
        const response = await fetchWithAuth(`/admin/drive-configurations/${configId}`, { method: 'DELETE' });
        if (response.success) {
            showNotification('Drive configuration deleted successfully.', 'success');
            loadDriveConfigurations(); // Refresh the list
        } else {
            showNotification(response.message || 'Failed to delete drive configuration.', 'error');
        }
    } catch (error) {
        console.error('Error deleting drive configuration:', error);
        showNotification('Error deleting drive configuration: ' + error.message, 'error');
    }
}

// Initialize drive module with dependencies
DriveModule.initDependencies({
    fetchWithAuth: fetchWithAuth,
    showNotification: showNotification
});
