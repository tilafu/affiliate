// Function to format date (adjust format as needed)
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        // Example format: YYYY-MM-DD HH:MM
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        console.error("Error formatting date:", e);
        return 'Invalid Date';
    }
}
 
// Format money values with 2 decimal places and $ sign
function formatMoney(amount) {
    if (amount === null || amount === undefined) return '$0.00';
    return '$' + parseFloat(amount).toFixed(2);
}

// Function to initialize profile page logic
async function initializeProfilePage() {
    console.log('Initializing profile page logic...');
    const token = getToken(); // From main.js

    if (!token) {
        console.log('No token found, redirecting to login.');
        window.location.href = 'login.html';
        return;
    }

    // Get elements AFTER sidebar is loaded
    const usernameEl = document.getElementById('profile-username');
    const mobileInputEl = document.getElementById('profile-mobile-input');
    const regDateEl = document.getElementById('profile-registration-date');
    const saveBtn = document.getElementById('profile-save-btn');

    // Additional profile elements
    const tierEl = document.getElementById('profile-tier');
    const referralCodeEl = document.getElementById('profile-referral-code');
    const mainBalanceEl = document.getElementById('profile-main-balance');
    const trainingBalanceEl = document.getElementById('profile-training-balance');
    const totalProfitsEl = document.getElementById('profile-total-profits');

    if (!usernameEl || !mobileInputEl || !regDateEl || !saveBtn) {
        console.error('One or more essential profile elements not found after component load.');
        return; // Stop if essential elements are missing
    }

    // --- Fetch and display profile data ---
    try {
        console.log('Fetching user profile data for profile page...');
        const data = await fetchWithAuth('/api/user/profile'); // Uses function from main.js
        console.log('Profile API response:', data);

        if (data.success && data.user) {
            const user = data.user;
            
            // Set basic profile information
            usernameEl.textContent = user.username || 'N/A';
            mobileInputEl.value = user.mobile_number || ''; // Populate input field
            regDateEl.textContent = formatDate(user.created_at); // Format and display date

            // Set additional financial information if elements exist
            if (tierEl) tierEl.textContent = user.tier || 'Bronze';
            if (referralCodeEl) referralCodeEl.textContent = user.referral_code || 'N/A';
            
            // Format financial information with proper decimal places
            if (mainBalanceEl) mainBalanceEl.textContent = formatMoney(user.main_balance);
            if (trainingBalanceEl) trainingBalanceEl.textContent = formatMoney(user.training_balance);
            if (totalProfitsEl) totalProfitsEl.textContent = formatMoney(user.total_profits);

            // Update cached data if necessary (though dashboard.js might handle this too)
            localStorage.setItem('user_data', JSON.stringify(user));

        } else {
            console.error('Profile API call failed:', data.message);
            showNotification(data.message || 'Failed to load profile data.', 'error');
            usernameEl.textContent = 'Error';
            mobileInputEl.value = 'Error';
            regDateEl.textContent = 'Error';
            
            // Also set error state for financial fields if they exist
            if (tierEl) tierEl.textContent = 'Error';
            if (referralCodeEl) referralCodeEl.textContent = 'Error';
            if (mainBalanceEl) mainBalanceEl.textContent = 'Error';
            if (trainingBalanceEl) trainingBalanceEl.textContent = 'Error';
            if (totalProfitsEl) totalProfitsEl.textContent = 'Error';
        }
    } catch (error) {
        console.error('Error fetching profile data:', error);
        if (error.message !== 'Unauthorized') { // Avoid duplicate errors on 401
             showNotification('Could not load profile data.', 'error');
             usernameEl.textContent = 'Error';
             mobileInputEl.value = 'Error';
             regDateEl.textContent = 'Error';
             
            // Also set error state for financial fields if they exist
            if (tierEl) tierEl.textContent = 'Error';
            if (referralCodeEl) referralCodeEl.textContent = 'Error';
            if (mainBalanceEl) mainBalanceEl.textContent = 'Error';
            if (trainingBalanceEl) trainingBalanceEl.textContent = 'Error';
            if (totalProfitsEl) totalProfitsEl.textContent = 'Error';
        }
    }

    // --- Add event listener for Save button ---
    saveBtn.addEventListener('click', async () => {
        const newMobileNumber = mobileInputEl.value.trim();

        if (!newMobileNumber) {
            showNotification('Mobile number cannot be empty.', 'error');
            return;
        }

        // Optional: Add more validation for the phone number format here

        console.log(`Attempting to update mobile number to: ${newMobileNumber}`);
        saveBtn.disabled = true; // Disable button during request
        saveBtn.textContent = 'Saving...';

        try {
            const updateData = await fetchWithAuth('/api/user/profile', {
                method: 'PUT',
                body: JSON.stringify({ 
                    mobile_number: newMobileNumber 
                    // Make sure this field name matches what your API expects
                })
            });

            console.log('Update profile response:', updateData);

            if (updateData.success) {
                showNotification('Mobile number updated successfully!', 'success');
                // Optionally update the cached user data
                const updatedUser = updateData.user;
                localStorage.setItem('user_data', JSON.stringify(updatedUser));
                // Update the input field value just in case backend modified it (e.g., formatting)
                mobileInputEl.value = updatedUser.mobile_number || '';
            } else {
                showNotification(updateData.message || 'Failed to update mobile number.', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
             if (error.message !== 'Unauthorized') {
                showNotification('Could not update mobile number. Please try again.', 'error');
             }
        } finally {
            saveBtn.disabled = false; // Re-enable button
            saveBtn.textContent = 'Save';
        }
    });
}

// Wait for the DOM and then potentially wait for the sidebar component
document.addEventListener('DOMContentLoaded', () => {
    console.log('Profile page script loaded');
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');

    if (sidebarPlaceholder) {
        // If the sidebar placeholder exists, wait for the component to load
        sidebarPlaceholder.addEventListener('componentLoaded', (event) => {
            if (event.detail.path === '/components/sidebar.html') {
                console.log('Sidebar component loaded, initializing profile page.');
                initializeProfilePage();
                // Also initialize sidebar-specific things like logout button if needed
                 if (typeof initializeSidebarScripts === 'function') {
                    initializeSidebarScripts();
                 }
                 // Re-attach general logout handlers if they exist and are needed here
                 if (typeof attachLogoutHandlers === 'function') {
                    attachLogoutHandlers();
                 }
            }
        });
    } else {
        // If there's no sidebar placeholder, initialize immediately (shouldn't happen for profile page)
        console.warn('Sidebar placeholder not found on profile page, initializing immediately.');
        initializeProfilePage();
    }
});
