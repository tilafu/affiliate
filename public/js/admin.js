// Admin Panel JavaScript
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

    const response = await fetch(`/api${endpoint}`, { ...defaultOptions, ...options });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

function showNotification(message, type = 'success') {
    // Simple alert implementation - can be enhanced with a toast system later
    alert(message);
}

// Add this notification function
function showAdminNotification(message, type = 'info') {
    const alertsContainer = document.getElementById('alerts-container');
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
            loadDrives();
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
        const response = await fetchWithAuth('/admin/deposits');
        if (response.success) {
            const depositsList = document.getElementById('deposits-list');
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
        }
    } catch (error) {
        console.error('Error loading deposits:', error);
        showNotification('Failed to load deposits', 'error');
    }
}

// Withdrawals Management
async function loadWithdrawals() {
    try {
        const response = await fetchWithAuth('/admin/withdrawals');
        if (response.success) {
            const withdrawalsList = document.getElementById('withdrawals-list');
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
        }
    } catch (error) {
        console.error('Error loading withdrawals:', error);
        showNotification('Failed to load withdrawals', 'error');
    }
}

// Data Drives Management
async function loadDrives() {
    try {
        const response = await fetchWithAuth('/admin/drives');
        if (response.success) {
            const drivesList = document.getElementById('drives-list');
            drivesList.innerHTML = response.drives.map(drive => `
                <tr>
                    <td>${drive.username}</td>
                    <td>${drive.total_drives}</td>
                    <td>$${drive.total_commission}</td>
                    <td>${new Date(drive.last_drive).toLocaleDateString()}</td>
                    <td>
                        <span class="status-badge status-${drive.status === 'ACTIVE' ? 'approved' : 'rejected'}">
                            ${drive.status}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-warning reset-drive-btn" 
                                data-user-id="${drive.user_id}">
                            Reset Drive
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading drives:', error);
        showNotification('Failed to load drives data', 'error');
    }
}

// Modify the loadDrives function to include username lookup
async function getDriveStatus(userId) {
    try {
        // First get user details
        const userResponse = await fetchWithAuth(`/admin/users/${userId}`);
        const username = userResponse.user.username;
        
        // Then get drive status
        const driveResponse = await fetchWithAuth(`/admin/drives/${userId}`);
        
        showAdminNotification(`Checking drive status for user: ${username}`, 'info');
        return driveResponse;
    } catch (error) {
        console.error('Error getting drive status:', error);
        showAdminNotification(`Error checking drive status for user ID ${userId}`, 'danger');
    }
}

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
                                    data-thread-subject="${originalMessage.subject || `Message ID ${originalMessage.id}`}">
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
        // Assuming fetchWithAuth should be used for consistency.
        // Also, the form IDs referenced (e.g., create-product-form) need to exist in admin.html
        const response = await fetch('/api/admin/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('Product created successfully');
            document.getElementById('create-product-form').reset();
            await loadProducts();
        } else {
            showError(data.message || 'Error creating product');
        }
    } catch (error) {
        showError('Error creating product');
    }
}

async function editProduct(productId) {
    try {
        const response = await fetch(`/api/admin/products/${productId}`);
        const data = await response.json();
        if (data.success) {
            // Populate edit form with product data
            const product = data.product;
            document.getElementById('edit-product-id').value = product.id;
            // Populate relevant fields only
            document.getElementById('edit-product-name').value = product.name;
            document.getElementById('edit-product-price').value = product.price;
            document.getElementById('edit-commission-rate').value = product.commission_rate;
            // Assuming min_balance_required is still needed/editable
            document.getElementById('edit-min-balance').value = product.min_balance_required || 0; 
            // Add image_url if needed: document.getElementById('edit-image-url').value = product.image_url || '';
            
            // Show edit modal (Ensure this modal ID exists in admin.html)
            const editModalElement = document.getElementById('edit-product-modal');
            if (!editModalElement) {
                console.error("Edit product modal not found!");
                showNotification('Error: Edit modal element not found.', 'error');
                return;
            }
            const editModal = new bootstrap.Modal(editModalElement);
            editModal.show();
        }
    } catch (error) {
        showError('Error loading product details');
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
        if (data.success) {
            showNotification('Product updated successfully');
            const editModal = bootstrap.Modal.getInstance(document.getElementById('edit-product-modal'));
            editModal.hide();
            await loadProducts();
        } else {
            showError(data.message || 'Error updating product');
        }
    } catch (error) {
        showError('Error updating product');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/products/${productId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('Product deleted successfully');
            await loadProducts();
        } else {
            showError(data.message || 'Error deleting product');
        }
    } catch (error) {
        showError('Error deleting product');
    }
}

async function respondToMessage(messageId) {
    const response = prompt('Enter your response:');
    if (!response) return;

    try {
        const result = await fetch(`/api/admin/support-messages/${messageId}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ response })
        });
        
        const data = await result.json();
        if (data.success) {
            showNotification('Response sent successfully');
            await loadSupportMessages();
        } else {
            showError(data.message || 'Error sending response');
        }
    } catch (error) {
        showError('Error sending response');
    }
}

async function markAsResolved(messageId) {
    try {
        const response = await fetch(`/api/admin/support-messages/${messageId}/resolve`, {
            method: 'PUT'
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('Message marked as resolved');
            await loadSupportMessages();
        } else {
            showError(data.message || 'Error updating message status');
        }
    } catch (error) {
        showError('Error updating message status');
    }
}

function initializeHandlers() {
    // Deposit handlers
    document.addEventListener('click', async (e) => {
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
        }
        
        if (e.target.matches('.reject-deposit-btn')) {
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
    });

    // Withdrawal handlers
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.approve-withdrawal-btn')) {
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
        }
        
        if (e.target.matches('.reject-withdrawal-btn')) {
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
    });

    // Drive handlers
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.reset-drive-btn')) {
            const userId = e.target.dataset.userId;
            try {
                const response = await fetchWithAuth(`/admin/users/${userId}/reset-drive`, { method: 'POST' });
                if (response.success) {
                    showNotification('Drive reset successfully', 'success');
                    loadDrives();
                }
            } catch (error) {
                console.error('Error resetting drive:', error);
                showNotification('Failed to reset drive', 'error');
            }
        }
    });

    // Support message handlers
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.reply-message-btn')) {
            const messageId = e.target.dataset.messageId;
            const userId = e.target.dataset.userId;
            document.getElementById('message-reply-form').style.display = 'block';
            document.getElementById('send-reply-button').dataset.messageId = messageId;
            document.getElementById('send-reply-button').dataset.userId = userId;
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
            e.preventDefault();
            // Construct data only from relevant fields expected by the updated backend
            const productData = {
                name: document.getElementById('product-name').value,
                price: parseFloat(document.getElementById('product-price').value),
                commission_rate: parseFloat(document.getElementById('product-commission').value),
                // Add min_balance_required if it's in the add form
                // min_balance_required: parseFloat(document.getElementById('product-min-balance').value) || 0, 
                // Add image_url if it's in the add form
                // image_url: document.getElementById('product-image-url').value || null 
            };

            // Validate data before sending (basic example)
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
                     const product = response.product;
                     // Populate the edit form modal
                     document.getElementById('edit-product-id').value = product.id;
                     document.getElementById('edit-product-name').value = product.name;
                     document.getElementById('edit-product-price').value = product.price;
                     document.getElementById('edit-commission-rate').value = product.commission_rate;
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
            }

            const productData = {
                name: formData.get('name'),
                price: parseFloat(formData.get('price')),
                commission_rate: parseFloat(formData.get('commission_rate')),
                 // Add other fields if they are in the edit form
                 // min_balance_required: parseFloat(formData.get('min_balance_required')) || 0,
                 // image_url: formData.get('image_url') || null
            };

             // Validate data before sending (basic example)
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
                    // Hide the modal
                    const editModalElement = document.getElementById('edit-product-modal');
                     if (editModalElement) {
                         const editModal = bootstrap.Modal.getInstance(editModalElement);
                         if (editModal) {
                            editModal.hide();
                         }
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

            if (response.success) {
                showNotification('User tier updated successfully', 'success');
                loadUsers();
            }
        } catch (error) {
            console.error('Error updating user tier:', error);
            showNotification('Failed to update user tier', 'error');
        }
    });
}
