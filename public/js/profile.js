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

// Function to ensure i18n content is updated with correct translations
function updateProfileTranslations() {
    // Only run if i18next is available and initialized
    if (window.i18next && window.i18next.isInitialized) {
        // Call the global updateContent function from i18n.js
        if (typeof updateContent === 'function') {
            updateContent();
            console.log('Updated profile page translations');
        } else {
            console.warn('updateContent function not available');
        }
    } else {
        console.warn('i18next not initialized yet for profile page');
    }
}

// Function to initialize profile page logic
async function initializeProfilePage() {
    console.log('Initializing profile page logic...');
    
    // Use centralized authentication check
    const authData = requireAuth();
    if (!authData) {
        return; // requireAuth will handle redirect
    }

    // Make sure i18n content is translated
    updateProfileTranslations();

    // Get elements AFTER sidebar is loaded
    const usernameEl = document.getElementById('profile-username');
    const mobileInputEl = document.getElementById('profile-mobile-input');
    const regDateEl = document.getElementById('profile-registration-date');
    const saveBtn = document.getElementById('profile-save-btn');

    if (!usernameEl || !mobileInputEl || !regDateEl || !saveBtn) {
        console.error('One or more profile elements not found after component load.');
        return; // Stop if essential elements are missing
    }

    // --- Fetch and display profile data ---
    try {
        console.log('Fetching user profile data for profile page...');
        const data = await fetchWithAuth('/api/user/profile'); // Uses function from main.js
        console.log('Profile API response:', data);

        if (data.success && data.user) {
            const user = data.user;
            usernameEl.textContent = user.username || 'N/A';
            mobileInputEl.value = user.mobile_number || ''; // Populate input field
            regDateEl.textContent = formatDate(user.created_at); // Format and display date

            // Update cached data if necessary (though dashboard.js might handle this too)
            localStorage.setItem('user_data', JSON.stringify(user));

        } else {
            console.error('Profile API call failed:', data.message);
            showNotification(data.message || 'Failed to load profile data.', 'error');
            usernameEl.textContent = 'Error';
            mobileInputEl.value = 'Error';
            regDateEl.textContent = 'Error';
        }
    } catch (error) {
        console.error('Error fetching profile data:', error);
        if (error.message !== 'Unauthorized') { // Avoid duplicate errors on 401
             showNotification('Could not load profile data.', 'error');
             usernameEl.textContent = 'Error';
             mobileInputEl.value = 'Error';
             regDateEl.textContent = 'Error';
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
                const updatedUser = updateData.user; // Get user data from response
                if (updatedUser) { // Check if user data exists in the response
                    localStorage.setItem('user_data', JSON.stringify(updatedUser));
                    // Update the input field value just in case backend modified it (e.g., formatting)
                    mobileInputEl.value = updatedUser.mobile_number || '';
                    console.log('Successfully updated mobile number in UI from response.');
                } else {
                    // If success is true but no user data, keep the user's input value
                    console.warn('Profile update successful, but no updated user data returned from API.');
                    // Optionally re-fetch profile data here to ensure consistency
                    // fetchProfileData(token); // You would need to extract fetch logic into a reusable function
                }
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

    // --- Password Change Modal Logic ---
    const loginModalEl = document.getElementById('changeLoginPasswordModal');
    const withdrawModalEl = document.getElementById('changeWithdrawPasswordModal');
    const loginForm = document.getElementById('loginPasswordForm');
    const withdrawForm = document.getElementById('withdrawPasswordForm');
    const submitLoginBtn = document.getElementById('submitLoginPasswordChange');
    const submitWithdrawBtn = document.getElementById('submitWithdrawPasswordChange');
    const loginPasswordErrorEl = document.getElementById('loginPasswordError');
    const withdrawPasswordErrorEl = document.getElementById('withdrawPasswordError');

    // Function to display errors within modals
    const showModalError = (el, message) => {
        el.textContent = message;
        el.style.display = 'block';
    };
    const clearModalError = (el) => {
        el.textContent = '';
        el.style.display = 'none';
    };

    // Login Password Change Submit
    if (submitLoginBtn && loginForm) {
        submitLoginBtn.addEventListener('click', async () => {
            clearModalError(loginPasswordErrorEl);
            const currentPassword = loginForm.querySelector('#currentLoginPassword').value;
            const newPassword = loginForm.querySelector('#newLoginPassword').value;
            const confirmPassword = loginForm.querySelector('#confirmNewLoginPassword').value;

            if (!currentPassword || !newPassword || !confirmPassword) {
                showModalError(loginPasswordErrorEl, 'All fields are required.');
                return;
            }
            if (newPassword !== confirmPassword) {
                showModalError(loginPasswordErrorEl, 'New passwords do not match.');
                return;
            }
            if (newPassword.length < 6) { // Example minimum length
                 showModalError(loginPasswordErrorEl, 'New password must be at least 6 characters long.');
                 return;
            }

            submitLoginBtn.disabled = true;
            submitLoginBtn.textContent = 'Saving...';

            try {
                // TODO: Define and use the correct API endpoint
                const response = await fetchWithAuth('/api/user/password/login', { // Placeholder endpoint
                    method: 'PUT',
                    body: JSON.stringify({ currentPassword, newPassword })
                });

                if (response.success) {
                    showNotification('Login password updated successfully!', 'success');
                    loginForm.reset();
                    bootstrap.Modal.getInstance(loginModalEl).hide(); // Close modal
                } else {
                    showModalError(loginPasswordErrorEl, response.message || 'Failed to update password.');
                }
            } catch (error) {
                 console.error('Error updating login password:', error);
                 showModalError(loginPasswordErrorEl, 'An error occurred. Please try again.');
            } finally {
                submitLoginBtn.disabled = false;
                submitLoginBtn.textContent = 'Save Changes';
            }
        });
    }

     // Withdraw Password Change Submit
     if (submitWithdrawBtn && withdrawForm) {
        submitWithdrawBtn.addEventListener('click', async () => {
            clearModalError(withdrawPasswordErrorEl);
            const currentPassword = withdrawForm.querySelector('#currentWithdrawPassword').value; // This is the LOGIN password for verification
            const newPassword = withdrawForm.querySelector('#newWithdrawPassword').value;
            const confirmPassword = withdrawForm.querySelector('#confirmNewWithdrawPassword').value;

            if (!currentPassword || !newPassword || !confirmPassword) {
                showModalError(withdrawPasswordErrorEl, 'All fields are required.');
                return;
            }
            if (newPassword !== confirmPassword) {
                showModalError(withdrawPasswordErrorEl, 'New passwords do not match.');
                return;
            }
             if (newPassword.length < 6) { // Example minimum length
                 showModalError(withdrawPasswordErrorEl, 'New password must be at least 6 characters long.');
                 return;
            }

            submitWithdrawBtn.disabled = true;
            submitWithdrawBtn.textContent = 'Saving...';

            try {
                 // TODO: Define and use the correct API endpoint
                const response = await fetchWithAuth('/api/user/password/withdraw', { // Placeholder endpoint
                    method: 'PUT',
                    body: JSON.stringify({ currentPassword, newPassword }) // Send current LOGIN password for verification
                });

                if (response.success) {
                    showNotification('Withdraw password updated successfully!', 'success');
                    withdrawForm.reset();
                    bootstrap.Modal.getInstance(withdrawModalEl).hide(); // Close modal
                } else {
                    showModalError(withdrawPasswordErrorEl, response.message || 'Failed to update password.');
                }
            } catch (error) {
                 console.error('Error updating withdraw password:', error);
                 showModalError(withdrawPasswordErrorEl, 'An error occurred. Please try again.');
            } finally {
                submitWithdrawBtn.disabled = false;
                submitWithdrawBtn.textContent = 'Save Changes';
            }
        });
    }

    // Optional: Clear forms when modals are hidden
    if (loginModalEl) {
        loginModalEl.addEventListener('hidden.bs.modal', () => {
            clearModalError(loginPasswordErrorEl);
            loginForm.reset();
        });
    }
     if (withdrawModalEl) {
        withdrawModalEl.addEventListener('hidden.bs.modal', () => {
            clearModalError(withdrawPasswordErrorEl);
            withdrawForm.reset();
        });
    }

}

// Wait for the DOM and then potentially wait for the sidebar component
document.addEventListener('DOMContentLoaded', () => {
    console.log('Profile page script loaded');
    
    // Function to initialize the language switcher
    function initLanguageSwitcher() {
        const langSwitcher = document.getElementById('language-switcher');
        if (langSwitcher) {
            console.log('Found language switcher, initializing...');
            // Set initial value
            langSwitcher.value = window.i18next ? (i18next.language || 'en') : 'en';
            
            // Remove any existing event listeners (to prevent duplicates)
            const newLangSwitcher = langSwitcher.cloneNode(true);
            langSwitcher.parentNode.replaceChild(newLangSwitcher, langSwitcher);
            
            // Add change event listener
            newLangSwitcher.addEventListener('change', (e) => {
                console.log('Language switcher changed to:', e.target.value);
                if (typeof setLanguage === 'function') {
                    setLanguage(e.target.value);
                } else {
                    console.error('setLanguage function not available');
                }
            });
        } else {
            console.warn('Language switcher not found in the DOM');
        }
    }
    
    // Initialize i18next if not already initialized
    if (typeof initI18next === 'function') {
        console.log('Initializing i18next from profile.js');
        initI18next().then(() => {
            console.log('i18next initialized in profile page');
            // After i18next initializes, update translations
            updateProfileTranslations();
            // Try to initialize language switcher after i18next is ready
            initLanguageSwitcher();
        });
    } else if (window.i18next && window.i18next.isInitialized) {
        // If already initialized, just update translations
        console.log('i18next already initialized, updating profile translations');
        updateProfileTranslations();
        initLanguageSwitcher();
    } else {
        console.warn('initI18next function not available, translations may not work');
    }
      const sidebarPlaceholder = document.getElementById('sidebar-placeholder');

    if (sidebarPlaceholder) {
        // If the sidebar placeholder exists, wait for the component to load
        sidebarPlaceholder.addEventListener('componentLoaded', (event) => {
            if (event.detail.path === '/components/sidebar.html') {
                console.log('Sidebar component loaded, initializing profile page.');
                initializeProfilePage();
                
                // Re-initialize language switcher after sidebar loads (it might have been replaced)
                initLanguageSwitcher();
                
                // Also initialize sidebar-specific things like logout button if needed
                if (typeof initializeSidebarScripts === 'function') {
                    initializeSidebarScripts();
                }
                
                // Update translations again after sidebar loads
                updateProfileTranslations();
            }
        });
    } else {
        // If there's no sidebar placeholder, initialize immediately (shouldn't happen for profile page)
        console.warn('Sidebar placeholder not found on profile page, initializing immediately.');
        initializeProfilePage();
    }
});

// Add language change event listener to update translations when language changes
if (window.i18next) {
    window.i18next.on('languageChanged', () => {
        console.log('Language changed, updating profile translations');
        updateProfileTranslations();
    });
}
