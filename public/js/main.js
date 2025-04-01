// Base URL for API calls (adjust if your server runs elsewhere)
const API_BASE_URL = '/api'; 

// Function to display notifications on the page
function showNotification(message, type = 'info', duration = 5000) {
    let notification = document.getElementById('notification');
    
    // Create notification element if it doesn't exist
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        // Basic styling (can be enhanced with CSS)
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.padding = '15px 25px';
        notification.style.borderRadius = '4px';
        notification.style.zIndex = '1001';
        notification.style.display = 'none';
        notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        document.body.appendChild(notification);
    }
    
    // Style based on type
    if (type === 'success') {
        notification.style.backgroundColor = '#d4edda';
        notification.style.color = '#155724';
        notification.style.border = '1px solid #c3e6cb';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#f8d7da';
        notification.style.color = '#721c24';
        notification.style.border = '1px solid #f5c6cb';
    } else { // Default to 'info'
        notification.style.backgroundColor = '#cce5ff';
        notification.style.color = '#004085';
        notification.style.border = '1px solid #b8daff';
    }
    
    notification.textContent = message;
    notification.style.display = 'block';
    
    // Auto-hide after duration
    if (duration > 0) {
        setTimeout(() => {
            notification.style.display = 'none';
        }, duration);
    }
}

// Function to display validation errors near form elements
function showError(element, message) {
    // Remove existing error message for this element
    const existingError = element.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message'; // Use class for styling via CSS if needed
    errorDiv.style.color = '#dc3545'; // Bootstrap danger color
    errorDiv.style.fontSize = '12px';
    errorDiv.style.marginTop = '5px';
    errorDiv.textContent = message;
    
    // Insert after the input or radio group
    if (element.type === 'radio' || element.classList.contains('radio-group')) {
         // Find the parent container of the radio group to append the error
        const parentContainer = element.closest('.radio-group') || element.parentNode;
        parentContainer.appendChild(errorDiv); 
    } else {
        element.parentNode.appendChild(errorDiv);
        element.style.borderColor = '#dc3545'; // Highlight the input border
    }
}

// Function to clear validation errors
function clearErrors(formElement) {
    formElement.querySelectorAll('.error-message').forEach(el => el.remove());
    formElement.querySelectorAll('input, select, textarea').forEach(el => {
        el.style.borderColor = '#ddd'; // Reset border color
    });
}

// Function to get JWT token from localStorage
function getToken() {
    return localStorage.getItem('auth_token');
}

// Function to make authenticated API requests
async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers, // Allow overriding headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${url}`, {
            ...options,
            headers,
        });

        if (response.status === 401) { // Unauthorized
            // Clear token and redirect to login
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            window.location.href = 'login.html'; 
            throw new Error('Unauthorized'); // Prevent further processing
        }

        return response; // Return the full response object

    } catch (error) {
        console.error('API request error:', error);
        showNotification('Network error or server issue. Please try again.', 'error');
        throw error; // Re-throw the error for specific handling if needed
    }
}
