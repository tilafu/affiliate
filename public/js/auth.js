// --- Login Form Handling ---
async function handleLoginSubmit(event) {
    event.preventDefault();
    const form = event.target;
    clearErrors(form); // Clear previous errors from main.js
    console.log('Login form submitted via auth.js');

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = form.querySelector('button[type="submit"]');
    const originalButtonText = loginButton.textContent;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Basic Client-Side Validation
    let isValid = true;
    if (!username) {
        showError(usernameInput, 'Username or email is required.'); // Use showError from main.js
        isValid = false;
    }
    if (!password) {
        showError(passwordInput, 'Password is required.'); // Use showError from main.js
        isValid = false;
    }

    if (!isValid) {
        return;
    }

    loginButton.textContent = 'Logging in...';
    loginButton.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();
        console.log('Login API response:', data);

        if (response.ok && data.success) {
            // Store token and user data
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user_data', JSON.stringify(data.user)); // Store user details if needed by dashboard

            showNotification('Login successful! Redirecting...', 'success');
            setTimeout(() => {
                // Redirect based on role (if available in response) or default
                const redirectPath = data.user?.isAdmin ? 'admin/dashboard.html' : 'dashboard.html';
                window.location.href = redirectPath;
            }, 1000);
        } else {
            // Use server's error message or a default
            const message = data.message || `Login failed (Status: ${response.status})`;
            showNotification(message, 'error');
            console.error('Login failed:', message);
        }
    } catch (error) {
        console.error('Login fetch error:', error);
        showNotification('Network error during login. Please try again.', 'error');
    } finally {
        loginButton.textContent = originalButtonText;
        loginButton.disabled = false;
    }
}

// --- Registration Form Handling ---

// Re-implement validation logic here or ensure it's globally available from main.js
function validateRegistrationForm() {
    let isValid = true;
    const form = document.getElementById('signupForm');
    clearErrors(form); // Clear previous errors

    const username = document.getElementById('username');
    const email = document.getElementById('email');
    const password = document.getElementById('password');
    const repeatPassword = document.getElementById('repeat-password');
    const referralCode = document.getElementById('referralCode');
    const revenueSource = form.querySelector('input[name="revenue_source"]:checked');

    if (!username.value.trim()) { showError(username, 'Username is required'); isValid = false; }
    if (!email.value.trim() || !email.value.includes('@')) { showError(email, 'Valid email is required'); isValid = false; }
    if (!referralCode.value.trim()) { showError(referralCode, 'Referral code is required'); isValid = false; }
    if (password.value.length < 8) { showError(password, 'Password must be at least 8 characters'); isValid = false; }
    if (password.value !== repeatPassword.value) { showError(repeatPassword, 'Passwords do not match'); isValid = false; }
    if (!revenueSource) { const radioGroup = form.querySelector('.radio-group'); showError(radioGroup, 'Please select a revenue source'); isValid = false; }

    return isValid;
}


async function handleRegisterSubmit(event) {
    event.preventDefault();
    const form = event.target;
    console.log('Register form submitted via auth.js');

    if (!validateRegistrationForm()) {
        console.log('Registration form validation failed');
        showNotification('Please correct the errors in the form.', 'error');
        return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Creating account...';
    submitButton.disabled = true;

const formData = {
    username: document.getElementById('username').value.trim(),
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
    repeatPassword: document.getElementById('repeat-password').value.trim(),
    referralCode: document.getElementById('referralCode').value.trim(),
    revenueSource: form.querySelector('input[name="revenue_source"]:checked').value
};

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
        });

        const data = await response.json();
        console.log('Register API response:', data);

        if (response.ok && data.success) {
            // Optionally store token immediately, or redirect to login
            // localStorage.setItem('auth_token', data.token);
            // localStorage.setItem('user_data', JSON.stringify(data.user));
            
            // Store username for login page prefill
            sessionStorage.setItem('registered_username', formData.username);

            showNotification(data.message || 'Registration successful! Redirecting to login...', 'success');
            setTimeout(() => {
                window.location.href = 'login.html'; // Redirect to login after registration
            }, 1500);
        } else {
            const message = data.message || `Registration failed (Status: ${response.status})`;
            showNotification(message, 'error');
            console.error('Registration failed:', message);
        }
    } catch (error) {
        console.error('Registration fetch error:', error);
        showNotification('Network error during registration. Please try again.', 'error');
    } finally {
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
    }
}

function attachLogoutHandlers() {
  // Select all elements with the "logout" class
  const logoutElements = document.querySelectorAll('.logout');
  
  // Attach click event listeners to each logout element
  logoutElements.forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Logging out...');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      
      // If you have a showNotification function:
      if (typeof showNotification === 'function') {
        showNotification('Logged out successfully.', 'success');
      }
      
      // Redirect to login page
      window.location.href = 'login.html';
    });
  });
}

// Make the function available globally
window.attachLogoutHandlers = attachLogoutHandlers;
