// --- Helper Functions ---

// Function to make authenticated API calls
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        console.error('Admin token not found. Redirecting to login.');
        // Optionally redirect to login
        // window.location.href = '/admin/login';
        throw new Error('Admin token not found.');
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {}),
    };

    try {
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            // Try to parse error message from response body
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                // Ignore if response body is not JSON
            }
            const errorMessage = errorData?.message || `HTTP error! status: ${response.status}`;
            console.error(`API Error (${response.status}): ${errorMessage}`, errorData);
            const error = new Error(errorMessage);
            error.status = response.status;
            error.data = errorData;
            throw error;
        }
        // Handle cases where response might be empty (e.g., 204 No Content)
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            return await response.text(); // Or handle as needed
        }
    } catch (error) {
        console.error('Fetch error:', error);
        throw error; // Re-throw the error to be caught by the caller
    }
}

// Function to display messages
function showMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `alert ${isError ? 'alert-danger' : 'alert-success'} mt-2`;
        element.style.display = 'block';
        // Optional: Hide message after a few seconds
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    } else {
        console.error(`Message element with ID ${elementId} not found.`);
    }
}

// --- Initialization ---

function initializeAdmin() {
    console.log('Initializing Admin Panel...');
    loadUsers();
    loadProducts();
    setupEventListeners();
    // Load other sections if needed (e.g., analytics)
    // loadAnalytics();
}

function setupEventListeners() {
    // Balance Adjustment Form
    const balanceForm = document.getElementById('manual-balance-form');
    balanceForm?.addEventListener('submit', handleBalanceAdjustment);

    // Add Product Form
    const addProductForm = document.getElementById('add-product-form');
    addProductForm?.addEventListener('submit', handleAddProduct);

    // Edit Product Modal Save Button
    const saveProductBtn = document.getElementById('save-product-changes-btn');
    saveProductBtn?.addEventListener('click', handleUpdateProduct);

    // Add listeners for dynamically created buttons (using event delegation)
    const userTableBody = document.getElementById('admin-user-table-body');
    userTableBody?.addEventListener('click', (event) => {
        if (event.target.classList.contains('update-tier-btn')) {
            const userId = event.target.dataset.userId;
            const selectElement = document.getElementById(`tier-select-${userId}`);
            const newTier = selectElement.value;
            handleUpdateTier(userId, newTier);
        }
    });

    const productTableBody = document.getElementById('admin-product-table-body');
    productTableBody?.addEventListener('click', (event) => {
        if (event.target.classList.contains('edit-product-btn')) {
            const productData = JSON.parse(event.target.dataset.product);
            openEditProductModal(productData);
        } else if (event.target.classList.contains('delete-product-btn')) {
            const productId = event.target.dataset.productId;
            handleDeleteProduct(productId);
        }
    });
}


// --- User Management ---

async function loadUsers() {
    const tableBody = document.getElementById('admin-user-table-body');
    const messageDiv = document.getElementById('user-list-message');
    if (!tableBody || !messageDiv) return;

    tableBody.innerHTML = '<tr><td colspan="6" class="text-center"><i>Loading users...</i></td></tr>';
    messageDiv.style.display = 'none';

    try {
        const users = await fetchWithAuth('/api/admin/users');
        if (users && users.length > 0) {
            populateUserTable(users);
        } else {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center"><i>No users found.</i></td></tr>';
        }
    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center"><i>Error loading users.</i></td></tr>';
        showMessage('user-list-message', `Error loading users: ${error.message}`, true);
    }
}

function populateUserTable(users) {
    const tableBody = document.getElementById('admin-user-table-body');
    tableBody.innerHTML = ''; // Clear loading message

    const tiers = ['bronze', 'silver', 'gold', 'platinum'];

    users.forEach(user => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td><span class="badge bg-secondary">${user.tier || 'N/A'}</span></td>
            <td>
                <div class="input-group input-group-sm">
                    <select class="form-select form-select-sm" id="tier-select-${user.id}">
                        ${tiers.map(t => `<option value="${t}" ${user.tier === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
                    </select>
                    <button class="btn btn-outline-primary btn-sm update-tier-btn" data-user-id="${user.id}">Update</button>
                </div>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-success" onclick="focusBalanceAdjustment(${user.id})">Adjust</button>
            </td>
        `;
    });
}

async function handleUpdateTier(userId, newTier) {
     console.log(`Attempting to update tier for user ${userId} to ${newTier}`);
     showMessage('user-list-message', `Updating tier for user ${userId}...`);
     try {
        const result = await fetchWithAuth(`/api/admin/users/${userId}/tier`, {
            method: 'PUT',
            body: JSON.stringify({ tier: newTier })
        });
        showMessage('user-list-message', result.message || `Tier updated successfully for user ${userId}.`);
        // Optionally, visually update the tier badge in the table immediately
        const badge = document.querySelector(`#admin-user-table-body tr td:nth-child(4) span`); // Needs refinement to target specific row
        if(badge) badge.textContent = newTier; // Update badge text
        // Consider reloading the user list for consistency: loadUsers();
     } catch (error) {
        showMessage('user-list-message', `Error updating tier: ${error.message}`, true);
     }
}

function focusBalanceAdjustment(userId) {
    const userIdInput = document.getElementById('balance-user-id');
    if (userIdInput) {
        userIdInput.value = userId;
        userIdInput.focus();
        // Scroll to the form if needed
        document.getElementById('manual-balance-form').scrollIntoView({ behavior: 'smooth' });
    }
}

async function handleBalanceAdjustment(event) {
    event.preventDefault();
    const form = event.target;
    const userId = form.elements['balance-user-id'].value;
    const type = form.elements['balance-type'].value; // 'deposit' or 'withdrawal'
    const amount = form.elements['balance-amount'].value;
    const description = form.elements['balance-description'].value;
    const messageDivId = 'balance-adjustment-message';

    if (!userId || !amount) {
        showMessage(messageDivId, 'User ID and Amount are required.', true);
        return;
    }

    const endpoint = `/api/admin/accounts/${userId}/${type}`;
    showMessage(messageDivId, `Processing ${type}...`);

    try {
        const result = await fetchWithAuth(endpoint, {
            method: 'POST',
            body: JSON.stringify({ amount: parseFloat(amount), description })
        });
        showMessage(messageDivId, result.message || `${type.charAt(0).toUpperCase() + type.slice(1)} processed successfully.`);
        form.reset(); // Clear the form
    } catch (error) {
        showMessage(messageDivId, `Error processing ${type}: ${error.message}`, true);
    }
}


// --- Product Management ---

async function loadProducts() {
    const tableBody = document.getElementById('admin-product-table-body');
    const messageDiv = document.getElementById('product-list-message');
    if (!tableBody || !messageDiv) return;

    tableBody.innerHTML = '<tr><td colspan="8" class="text-center"><i>Loading products...</i></td></tr>';
    messageDiv.style.display = 'none';

    try {
        const products = await fetchWithAuth('/api/admin/products');
        if (products && products.length > 0) {
            populateProductTable(products);
        } else {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center"><i>No products found. Use the form above to add one.</i></td></tr>';
        }
    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center"><i>Error loading products.</i></td></tr>';
        showMessage('product-list-message', `Error loading products: ${error.message}`, true);
    }
}

function populateProductTable(products) {
    const tableBody = document.getElementById('admin-product-table-body');
    tableBody.innerHTML = ''; // Clear loading/empty message

    products.forEach(product => {
        const row = tableBody.insertRow();
        // Store product data directly on the edit button for easy retrieval
        const productJson = JSON.stringify(product);
        row.innerHTML = `
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>$${parseFloat(product.price).toFixed(2)}</td>
            <td>${(parseFloat(product.commission_rate) * 100).toFixed(2)}%</td>
            <td>$${parseFloat(product.min_balance_required).toFixed(2)}</td>
            <td>${product.min_tier}</td>
            <td><span class="badge bg-${product.is_active ? 'success' : 'danger'}">${product.is_active ? 'Yes' : 'No'}</span></td>
            <td>
                <button class="btn btn-sm btn-warning me-1 edit-product-btn" data-product='${productJson}' data-bs-toggle="modal" data-bs-target="#editProductModal">Edit</button>
                <button class="btn btn-sm btn-danger delete-product-btn" data-product-id="${product.id}">Delete</button>
            </td>
        `;
    });
}

async function handleAddProduct(event) {
    event.preventDefault();
    const form = event.target;
    const messageDivId = 'add-product-message';

    const productData = {
        name: form.elements['product-name'].value,
        price: parseFloat(form.elements['product-price'].value),
        commission_rate: parseFloat(form.elements['product-commission'].value),
        image_url: form.elements['product-image-url'].value || null,
        min_balance_required: parseFloat(form.elements['product-min-balance'].value || 0),
        min_tier: form.elements['product-min-tier'].value
    };

    // Basic frontend validation (backend has more robust checks)
    if (!productData.name || isNaN(productData.price) || isNaN(productData.commission_rate)) {
        showMessage(messageDivId, 'Name, Price, and Commission Rate are required and must be valid numbers.', true);
        return;
    }

    showMessage(messageDivId, 'Adding product...');

    try {
        const result = await fetchWithAuth('/api/admin/products', {
            method: 'POST',
            body: JSON.stringify(productData)
        });
        showMessage(messageDivId, result.message || 'Product added successfully.');
        form.reset();
        loadProducts(); // Refresh the product list
    } catch (error) {
        showMessage(messageDivId, `Error adding product: ${error.message}`, true);
    }
}

function openEditProductModal(product) {
    document.getElementById('edit-product-id').value = product.id;
    document.getElementById('edit-product-name').value = product.name;
    document.getElementById('edit-product-price').value = product.price;
    document.getElementById('edit-product-commission').value = product.commission_rate;
    document.getElementById('edit-product-image-url').value = product.image_url || '';
    document.getElementById('edit-product-min-balance').value = product.min_balance_required;
    document.getElementById('edit-product-min-tier').value = product.min_tier;
    document.getElementById('edit-product-is-active').checked = product.is_active;
}

async function handleUpdateProduct() {
    const productId = document.getElementById('edit-product-id').value;
    const messageDivId = 'edit-product-message'; // Message inside modal

    const productData = {
        name: document.getElementById('edit-product-name').value,
        price: parseFloat(document.getElementById('edit-product-price').value),
        commission_rate: parseFloat(document.getElementById('edit-product-commission').value),
        image_url: document.getElementById('edit-product-image-url').value || null,
        min_balance_required: parseFloat(document.getElementById('edit-product-min-balance').value || 0),
        min_tier: document.getElementById('edit-product-min-tier').value,
        is_active: document.getElementById('edit-product-is-active').checked
    };

     // Basic frontend validation
    if (!productData.name || isNaN(productData.price) || isNaN(productData.commission_rate)) {
        showMessage(messageDivId, 'Name, Price, and Commission Rate are required and must be valid numbers.', true);
        return;
    }

    showMessage(messageDivId, 'Updating product...');

    try {
        const result = await fetchWithAuth(`/api/admin/products/${productId}`, {
            method: 'PUT',
            body: JSON.stringify(productData)
        });
        showMessage(messageDivId, result.message || 'Product updated successfully.');
        // Close the modal using Bootstrap's API
        const modalElement = document.getElementById('editProductModal');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
            modalInstance.hide();
        } else {
             // Fallback if instance not found (might happen if modal was closed manually)
             console.warn("Could not get modal instance to hide it.");
        }

        loadProducts(); // Refresh the product list
    } catch (error) {
        showMessage(messageDivId, `Error updating product: ${error.message}`, true);
    }
}

async function handleDeleteProduct(productId) {
    if (!confirm(`Are you sure you want to delete product ID ${productId}? This cannot be undone.`)) {
        return;
    }

    const messageDivId = 'product-list-message';
    showMessage(messageDivId, `Deleting product ${productId}...`);

    try {
        const result = await fetchWithAuth(`/api/admin/products/${productId}`, {
            method: 'DELETE'
        });
        showMessage(messageDivId, result.message || `Product ${productId} deleted successfully.`);
        loadProducts(); // Refresh the product list
    } catch (error) {
         showMessage(messageDivId, `Error deleting product: ${error.message}`, true);
    }
}

// --- Analytics and Config Placeholders (Keep or remove as needed) ---
/*
function loadAnalytics() {
    console.log('Loading analytics section...');
    // TODO: Implement actual analytics fetching and display
}

function loadSystemConfig() {
    console.log('Loading system config section...');
     // TODO: Implement actual config loading and saving
}
*/

// The initializeAdmin function is called from the inline script in admin.html
// when the DOM is ready and the admin token is verified.
