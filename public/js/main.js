// This should be your API base URL, for example:
// const API_BASE_URL = ''; // Empty if API is on same origin
// or
const API_BASE_URL = 'http://localhost:3000'; // If API is on a different port

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
        // Make sure we're using the API prefix
        const apiUrl = url.startsWith('/api/') ? url : `/api${url}`;
        const response = await fetch(`${API_BASE_URL}${apiUrl}`, {
            ...options,
            headers,
        });

        // Handle 401 (Unauthorized) upfront
        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            window.location.href = 'login.html';
            throw new Error('Unauthorized');
        }

        // Handle other errors
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}
