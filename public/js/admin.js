// Ensure API_BASE_URL and showNotification are available (assuming from main.js)
// If not, define them here or ensure main.js is loaded first.
// const API_BASE_URL = 'http://localhost:3000'; // Example if not defined elsewhere

document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin JS loaded');
    // Check if logged in as admin (basic check, backend enforces)
    const token = localStorage.getItem('auth_token');
    const userData = JSON.parse(localStorage.getItem('user_data'));

    if (!token || !userData) {
        showNotification('Not authenticated. Redirecting to login.', 'error');
        window.location.href = 'login.html';
        return;
    }
    // Optional: Add a check for role if stored, though backend validation is key
    // if (userData.role !== 'admin') {
    //     showNotification('Not authorized as admin. Redirecting.', 'error');
    //     window.location.href = 'login.html'; // Or dashboard.html
    //     return;
    // }

    loadUsers();
    loadProducts();

    // Add event listeners
    document.getElementById('add-product-form').addEventListener('submit', handleAddProduct);
    document.getElementById('update-tier-button').addEventListener('click', handleUpdateTier);
    document.getElementById('reset-drive-button').addEventListener('click', handleResetDrive); // Added listener for reset button
    document.getElementById('submit-transaction-button').addEventListener('click', handleManualTransaction);

    // Event delegation for manage buttons in user list
    document.getElementById('user-list').addEventListener('click', (event) => {
        if (event.target.classList.contains('manage-user-btn')) {
            const userId = event.target.dataset.userId;
            const username = event.target.dataset.username;
            const currentTier = event.target.dataset.tier;
            selectUserForManagement(userId, username, currentTier);
        }
    });

     // Event delegation for delete buttons in product list
     document.getElementById('product-list').addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-product-btn')) {
            const productId = event.target.dataset.productId;
            const productName = event.target.dataset.productName;
            if (confirm(`Are you sure you want to delete product "${productName}" (ID: ${productId})?`)) {
                handleDeleteProduct(productId);
            }
        }
        // Add similar logic for an 'edit-product-btn' if needed later
    });

    const form = document.getElementById('admin-notification-form');
    const statusDiv = document.getElementById('notify-status');
    // const adminToken = localStorage.getItem('admin_token'); // INCORRECT - Use the standard auth token

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            statusDiv.textContent = 'Sending...';

            const user_id = document.getElementById('notify-user-id').value;
            const message = document.getElementById('notify-message').value;

            try {
                const res = await fetch('/api/admin/notifications', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getAuthToken()}` // CORRECTED - Use standard auth token
                    },
                    body: JSON.stringify({ user_id, message })
                });
                const data = await res.json();
                if (data.success) {
                    statusDiv.textContent = 'Notification sent!';
                    form.reset();
                } else {
                    statusDiv.textContent = 'Failed: ' + (data.message || 'Unknown error');
                }
            } catch (err) {
                statusDiv.textContent = 'Error sending notification.';
            }
        });
    }
});

// --- Helper: Get Auth Token ---
function getAuthToken() {
    return localStorage.getItem('auth_token');
}

// --- User Management ---
let selectedUserId = null;

async function loadUsers() {
    const userListBody = document.getElementById('user-list');
    userListBody.innerHTML = '<tr><td colspan="7">Loading users...</td></tr>'; // Show loading state

    try {
        const token = getAuthToken();
        if (!token) throw new Error('No auth token found');

        const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to fetch users (${response.status})`);
        }

        const data = await response.json();

        if (data.success && data.users) {
            renderUserTable(data.users);
        } else {
            throw new Error(data.message || 'Failed to parse user data');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        userListBody.innerHTML = `<tr><td colspan="7">Error loading users: ${error.message}</td></tr>`;
        showNotification(`Error loading users: ${error.message}`, 'error');
    }
}

function renderUserTable(users) {
    const userListBody = document.getElementById('user-list');
    userListBody.innerHTML = ''; // Clear previous content

    if (users.length === 0) {
        userListBody.innerHTML = '<tr><td colspan="7">No users found.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.tier || 'N/A'}</td>
            <td>${user.role}</td>
            <td>$${user.main_balance?.toFixed(2) ?? '0.00'}</td>
            <td>
                <button class="btn btn-sm btn-info manage-user-btn"
                        data-user-id="${user.id}"
                        data-username="${user.username}"
                        data-tier="${user.tier || 'bronze'}">Manage</button>
            </td>
        `;
        userListBody.appendChild(row);
    });
}

function selectUserForManagement(userId, username, currentTier) {
    selectedUserId = userId;
    document.getElementById('manage-username').textContent = username;
    document.getElementById('manage-user-id').textContent = userId;
    document.getElementById('user-tier-select').value = currentTier; // Set current tier in dropdown
    document.getElementById('user-details').style.display = 'block';
    // Clear transaction fields
    document.getElementById('transaction-amount').value = '';
    document.getElementById('transaction-description').value = '';
}

async function handleUpdateTier() {
    if (!selectedUserId) {
        showNotification('Please select a user first.', 'warning');
        return;
    }

    const newTier = document.getElementById('user-tier-select').value;
    const token = getAuthToken();
    const button = document.getElementById('update-tier-button');
    button.disabled = true;
    button.textContent = 'Updating...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${selectedUserId}/tier`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ tier: newTier })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showNotification(`User ${selectedUserId}'s tier updated to ${newTier}.`, 'success');
            loadUsers(); // Refresh user list
            document.getElementById('user-details').style.display = 'none'; // Hide management section
            selectedUserId = null;
        } else {
            throw new Error(data.message || `Failed to update tier (${response.status})`);
        }
    } catch (error) {
        console.error('Error updating tier:', error);
        showNotification(`Error updating tier: ${error.message}`, 'error');
    } finally {
         button.disabled = false;
         button.textContent = 'Update Tier';
    }
}

async function handleManualTransaction() {
     if (!selectedUserId) {
        showNotification('Please select a user first.', 'warning');
        return;
    }

    const type = document.getElementById('transaction-type').value;
    const amountInput = document.getElementById('transaction-amount');
    const descriptionInput = document.getElementById('transaction-description');
    const amount = parseFloat(amountInput.value);
    const description = descriptionInput.value.trim();
    const token = getAuthToken();
    const button = document.getElementById('submit-transaction-button');

    if (isNaN(amount) || amount <= 0) {
        showNotification('Please enter a valid positive amount.', 'error');
        return;
    }

    button.disabled = true;
    button.textContent = 'Processing...';

     try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${selectedUserId}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type, amount, description })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showNotification(data.message || `Manual ${type} successful.`, 'success');
            loadUsers(); // Refresh user list to show updated balance
            // Clear fields and hide section
            amountInput.value = '';
            descriptionInput.value = '';
            document.getElementById('user-details').style.display = 'none';
            selectedUserId = null;
        } else {
            throw new Error(data.message || `Failed to process transaction (${response.status})`);
        }
    } catch (error) {
        console.error('Error processing manual transaction:', error);
        showNotification(`Error processing transaction: ${error.message}`, 'error');
    } finally {
         button.disabled = false;
         button.textContent = 'Submit Transaction';
    }
}

function loadUserWithdrawals(userId) {
  fetch(`/api/user/withdrawals?userId=${userId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json',
    },
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const withdrawElement = document.getElementById(`user-${userId}-withdrawn-amount`);
        withdrawElement.textContent = `${data.totalWithdrawals.toFixed(2)} USDT`;
      } else {
        console.error('Failed to fetch withdrawals for user:', data.message);
      }
    })
    .catch(error => {
      console.error('Error fetching withdrawals for user:', error);
    });
}

async function handleResetDrive() {
    if (!selectedUserId) {
        showNotification('Please select a user first.', 'warning');
        return;
    }

    if (!confirm(`Are you sure you want to reset the drive session for user ${selectedUserId}? This allows them to start a new drive.`)) {
        return;
    }

    const token = getAuthToken();
    const button = document.getElementById('reset-drive-button');
    button.disabled = true;
    button.textContent = 'Resetting...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${selectedUserId}/reset-drive`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // No Content-Type or body needed for this request
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showNotification(data.message || `Drive reset successfully for user ${selectedUserId}.`, 'success');
            // Optionally hide the management section again
            document.getElementById('user-details').style.display = 'none';
            selectedUserId = null;
        } else {
            throw new Error(data.message || `Failed to reset drive (${response.status})`);
        }
    } catch (error) {
        console.error('Error resetting drive:', error);
        showNotification(`Error resetting drive: ${error.message}`, 'error');
    } finally {
        button.disabled = false;
        button.textContent = 'Reset Drive';
    }
}

// --- Product Management ---
async function loadProducts() {
    const productListBody = document.getElementById('product-list');
    productListBody.innerHTML = '<tr><td colspan="8">Loading products...</td></tr>';

     try {
        const token = getAuthToken();
        if (!token) throw new Error('No auth token found');

        const response = await fetch(`${API_BASE_URL}/api/admin/products`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to fetch products (${response.status})`);
        }

        const data = await response.json();

        if (data.success && data.products) {
            renderProductTable(data.products);
        } else {
            throw new Error(data.message || 'Failed to parse product data');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        productListBody.innerHTML = `<tr><td colspan="8">Error loading products: ${error.message}</td></tr>`;
        showNotification(`Error loading products: ${error.message}`, 'error');
    }
}

function renderProductTable(products) {
    const productListBody = document.getElementById('product-list');
    productListBody.innerHTML = ''; // Clear

    if (products.length === 0) {
        productListBody.innerHTML = '<tr><td colspan="8">No products found.</td></tr>';
        return;
    }

    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>$${parseFloat(product.price).toFixed(2)}</td>
            <td>${(parseFloat(product.commission_rate) * 100).toFixed(2)}%</td>
            <td>$${parseFloat(product.min_balance_required).toFixed(2)}</td>
            <td>${product.min_tier}</td>
            <td>${product.is_active ? 'Yes' : 'No'}</td>
            <td>
                <!-- <button class="btn btn-sm btn-info edit-product-btn" data-product-id="${product.id}">Edit</button> -->
                <button class="btn btn-sm btn-danger delete-product-btn"
                        data-product-id="${product.id}"
                        data-product-name="${product.name}">Delete</button>
            </td>
        `;
        productListBody.appendChild(row);
    });
}

async function handleAddProduct(event) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Adding...';

    const productData = {
        name: document.getElementById('product-name').value.trim(),
        price: parseFloat(document.getElementById('product-price').value),
        commission_rate: parseFloat(document.getElementById('product-commission').value),
        min_balance_required: parseFloat(document.getElementById('product-min-balance').value),
        min_tier: document.getElementById('product-min-tier').value,
        // is_active defaults to true on backend if not sent
    };

    // Basic validation
    if (!productData.name || isNaN(productData.price) || isNaN(productData.commission_rate) || isNaN(productData.min_balance_required)) {
         showNotification('Please fill in all required product fields with valid numbers.', 'error');
         button.disabled = false;
         button.textContent = 'Add Product';
         return;
    }
     if (productData.price <= 0 || productData.commission_rate <= 0 || productData.min_balance_required < 0) {
         showNotification('Price and commission rate must be positive. Min balance cannot be negative.', 'error');
         button.disabled = false;
         button.textContent = 'Add Product';
         return;
    }


    const token = getAuthToken();

    try {
         const response = await fetch(`${API_BASE_URL}/api/admin/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(productData)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showNotification('Product added successfully!', 'success');
            loadProducts(); // Refresh product list
            form.reset(); // Clear the form
        } else {
            throw new Error(data.message || `Failed to add product (${response.status})`);
        }
    } catch (error) {
        console.error('Error adding product:', error);
        showNotification(`Error adding product: ${error.message}`, 'error');
    } finally {
         button.disabled = false;
         button.textContent = 'Add Product';
    }
}

async function handleDeleteProduct(productId) {
     const token = getAuthToken();
     // Optionally disable the delete button while processing

     try {
         const response = await fetch(`${API_BASE_URL}/api/admin/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showNotification(`Product ${productId} deleted successfully.`, 'success');
            loadProducts(); // Refresh product list
        } else {
            throw new Error(data.message || `Failed to delete product (${response.status})`);
        }
    } catch (error) {
        console.error(`Error deleting product ${productId}:`, error);
        showNotification(`Error deleting product: ${error.message}`, 'error');
    } finally {
        // Re-enable button if it was disabled
    }
}

async function loadSupportMessages() {
  const res = await fetch('/api/admin/support/messages', { headers: { Authorization: `Bearer ${adminToken}` } });
  const data = await res.json();
  if (data.success) {
    // Render messages in a table or list
  }
}
