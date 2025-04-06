// Placeholder for Admin Panel JavaScript logic

// Example function to initialize admin features (can be called on DOMContentLoaded)
function initializeAdmin() {
    console.log('Initializing Admin Panel...');
    // Function to simulate fetching and displaying analytics data
    function fetchAndDisplayAnalytics() {
        // Simulated API response
        const analyticsData = {
            registrationsThisWeek: 25,
            totalCommissionsPaid: '$5,000',
        };

        const registrationsDiv = document.querySelector('#admin-analytics .card-body h5:contains("Registrations This Week") + p.card-text');
        const commissionsDiv = document.querySelector('#admin-analytics .card-body h5:contains("Total Commissions Paid") + p.card-text');

        if (registrationsDiv) registrationsDiv.textContent = analyticsData.registrationsThisWeek;
        if (commissionsDiv) commissionsDiv.textContent = analyticsData.totalCommissionsPaid;
    }

    // Call the new function
    fetchAndDisplayAnalytics();

    // TODO: Add logic to fetch admin data (users, analytics, config)
    // TODO: Add event listeners for admin actions (search, edit, save config)

    // Example: Placeholder for loading user list
    loadUserManagement();

    // Example: Placeholder for loading analytics
    loadAnalytics();

    // Example: Placeholder for loading system config
    loadSystemConfig();

    // Add event listener for the user search button after initializing sections
    const searchButton = document.getElementById('admin-user-search-btn');
    searchButton?.addEventListener('click', handleUserSearch);
}

// --- User Management Functions ---

async function handleUserSearch() {
    const searchInput = document.getElementById('admin-user-search-input');
    const tableBody = document.getElementById('admin-user-table-body');
    const messageDiv = document.getElementById('user-search-message');
    const searchTerm = searchInput.value.trim();

    if (!searchInput || !tableBody || !messageDiv) {
        console.error('User search elements not found.');
        return;
    }

    // Clear previous results and messages
    tableBody.innerHTML = '';
    messageDiv.textContent = '';
    messageDiv.style.display = 'none';

    if (!searchTerm) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center"><i>Enter search term above to find users.</i></td></tr>';
        return;
    }

    tableBody.innerHTML = '<tr><td colspan="5" class="text-center"><i>Searching...</i></td></tr>';

    try {
        // TODO: Replace with actual API call
        // const response = await fetchWithAuth(`/api/admin/users/search?q=${encodeURIComponent(searchTerm)}`); // Assuming fetchWithAuth exists
        // const data = await response.json(); // Or handle response based on fetchWithAuth implementation

        // --- Placeholder Data ---
        console.log(`Simulating API call for search term: ${searchTerm}`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
        const data = {
            success: true,
            users: searchTerm.toLowerCase().includes('test') ? [
                { id: 1, username: 'testuser1', email: 'test1@example.com', tier_name: 'Gold', status: 'Active' },
                { id: 2, username: 'testuser2', email: 'test2@example.com', tier_name: 'Silver', status: 'Inactive' }
            ] : []
        };
        // --- End Placeholder Data ---


        if (data.success && data.users && data.users.length > 0) {
            populateUserTable(data.users);
        } else if (data.success && data.users && data.users.length === 0) {
            messageDiv.textContent = 'No users found matching your search.';
            messageDiv.className = 'alert alert-warning text-center mt-2'; // Use Bootstrap alert class
            messageDiv.style.display = 'block';
            tableBody.innerHTML = ''; // Clear the 'Searching...' message
        } else {
            // Handle API error message from data.message if available
            messageDiv.textContent = data.message || 'Error searching for users.';
            messageDiv.className = 'alert alert-danger text-center mt-2';
            messageDiv.style.display = 'block';
            tableBody.innerHTML = ''; // Clear the 'Searching...' message
        }
    } catch (error) {
        console.error('Error during user search:', error);
        messageDiv.textContent = 'An error occurred while searching for users.';
        messageDiv.className = 'alert alert-danger text-center mt-2';
        messageDiv.style.display = 'block';
        tableBody.innerHTML = ''; // Clear the 'Searching...' message
    }
}

function populateUserTable(users) {
    const tableBody = document.getElementById('admin-user-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = ''; // Clear previous results or 'Searching...' message

    users.forEach(user => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${user.username || 'N/A'}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.tier_name || 'N/A'}</td>
            <td>${user.status || 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-info me-1" onclick="viewUserDetails(${user.id})">View</button>
                <button class="btn btn-sm btn-warning" onclick="editUser(${user.id})">Edit</button>
                <!-- Add more actions like activate/deactivate if needed -->
            </td>
        `;
    });
}

function viewUserDetails(userId) {
    console.log(`Viewing details for user ID: ${userId}`);
    // TODO: Implement logic to show user details (e.g., in a modal or separate view)
    alert(`Placeholder: View details for user ${userId}`);
}

function editUser(userId) {
    console.log(`Editing user ID: ${userId}`);
    // TODO: Implement logic to show an edit form/modal for the user
    alert(`Placeholder: Edit user ${userId}`);
}


// --- Original Placeholder Functions (can be removed or updated) ---

function loadUserManagement() {
    console.log('Loading user management section structure...');
    // This function might not be needed anymore if handleUserSearch covers initialization
    // Or it could just ensure the HTML structure exists if loaded dynamically
    const userManagementDiv = document.getElementById('admin-user-management');
    // Basic check to ensure the container exists
    if (!userManagementDiv) {
        console.error("User management container div not found!");
    }
    // Initial table state is set in the HTML now.
}


function loadAnalytics() {
    console.log('Loading analytics section...');
    const analyticsDiv = document.getElementById('admin-analytics');
     if (analyticsDiv) {
        // Replace placeholder content - In a real app, you'd use a charting library
        analyticsDiv.innerHTML = `
            <div class="row">
                <div class="col-md-6 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Registrations This Week</h5>
                            <p class="card-text display-4"><i>(Chart)</i></p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                     <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Total Commissions Paid</h5>
                            <p class="card-text display-4"><i>(Value)</i></p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        // TODO: Implement API calls and chart rendering
    }
}

function loadSystemConfig() {
    console.log('Loading system config section...');
     const systemConfigDiv = document.getElementById('admin-system-config');
     if (systemConfigDiv) {
         // Replace placeholder content
         systemConfigDiv.innerHTML = `
            <h6>Product Commissions</h6>
            <p><i>Table/Form to edit product commissions...</i></p>
            <hr>
            <h6>Tier Management</h6>
            <p><i>Form to edit tier names, costs, data limits, commission rates...</i></p>
             <hr>
            <h6>Other Settings</h6>
            <p><i>Other global settings...</i></p>
            <button class="btn btn-primary mt-3" id="save-config-btn">Save Configuration</button>
         `;
         // TODO: Implement API calls to load/save config and add event listeners
         document.getElementById('save-config-btn')?.addEventListener('click', () => {
             console.log('Saving system configuration...');
             alert('Placeholder: Saving configuration...');
             // TODO: Add API call to save config
         });
     }
}

// Make sure initializeAdmin is called after the DOM is ready
// This is handled by the inline script in admin.html
