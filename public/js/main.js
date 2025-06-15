// This should be your API base URL, for example:
// const API_BASE_URL = ''; // Empty if API is on same origin
// or
// Only declare API_BASE_URL if it hasn't been declared yet
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'http://localhost:3000'; // If API is on a different port
}

// Function to display notifications on the page
function showNotification(message, type = 'info', duration = 5000) {
    // If i18next is available and the message is a translation key, translate it
    if (window.i18next && window.i18next.isInitialized && typeof message === 'string' && i18next.exists(message)) {
        message = i18next.t(message);
    }
    
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
            pointer-events: none;
        `;
        document.body.appendChild(notificationContainer);
    }
    
    // Create individual notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        border-left: 4px solid;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        line-height: 1.4;
        position: relative;
        pointer-events: auto;
        transform: translateX(100%);
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        gap: 12px;
    `;
    
    let icon = '';
    let borderColor = '';
    let backgroundColor = '';
    
    // Style based on type
    if (type === 'success') {
        icon = '✓';
        borderColor = '#10B981';
        backgroundColor = 'rgba(16, 185, 129, 0.1)';
        notification.style.color = '#065F46';
    } else if (type === 'error') {
        icon = '✕';
        borderColor = '#EF4444';
        backgroundColor = 'rgba(239, 68, 68, 0.1)';
        notification.style.color = '#991B1B';
    } else if (type === 'warning') {
        icon = '⚠';
        borderColor = '#F59E0B';
        backgroundColor = 'rgba(245, 158, 11, 0.1)';
        notification.style.color = '#92400E';
    } else { // info
        icon = 'ℹ';
        borderColor = '#3B82F6';
        backgroundColor = 'rgba(59, 130, 246, 0.1)';
        notification.style.color = '#1E40AF';
    }
    
    notification.style.borderLeftColor = borderColor;
    notification.style.background = `linear-gradient(135deg, ${backgroundColor}, rgba(255, 255, 255, 0.9))`;
    
    // Add icon and message
    notification.innerHTML = `
        <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: ${borderColor};
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
            flex-shrink: 0;
        ">${icon}</div>
        <div style="flex: 1;">${message}</div>
        <div style="
            cursor: pointer;
            color: #6B7280;
            font-size: 18px;
            line-height: 1;
            padding: 2px;
            border-radius: 4px;
            transition: all 0.2s ease;
        " onclick="this.parentElement.style.transform='translateX(100%)'; setTimeout(() => this.parentElement.remove(), 300);">×</div>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-hide after duration
    if (duration > 0) {
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }, duration);
    }
    
    return notification;
}

// Modern confirmation dialog
function showConfirmDialog(message, title = 'Confirm', options = {}) {
    return new Promise((resolve) => {
        const {
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            type = 'info' // 'info', 'warning', 'danger'
        } = options;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            z-index: 15000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            border-radius: 16px;
            padding: 32px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            transform: scale(0.8);
            transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;
        
        let iconColor = '#3B82F6';
        let confirmButtonColor = '#3B82F6';
        
        if (type === 'warning') {
            iconColor = '#F59E0B';
            confirmButtonColor = '#F59E0B';
        } else if (type === 'danger') {
            iconColor = '#EF4444';
            confirmButtonColor = '#EF4444';
        }
        
        dialog.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    background: ${iconColor}20;
                    margin: 0 auto 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                ">${type === 'warning' ? '⚠️' : type === 'danger' ? '⚠️' : 'ℹ️'}</div>
                <h3 style="
                    margin: 0 0 12px 0;
                    font-size: 20px;
                    font-weight: 600;
                    color: #111827;
                ">${title}</h3>
                <p style="
                    margin: 0;
                    font-size: 16px;
                    color: #6B7280;
                    line-height: 1.5;
                ">${message}</p>
            </div>
            <div style="
                display: flex;
                gap: 12px;
                justify-content: center;
            ">
                <button id="dialog-cancel" style="
                    padding: 12px 24px;
                    border: 2px solid #E5E7EB;
                    background: white;
                    color: #6B7280;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: inherit;
                ">${cancelText}</button>
                <button id="dialog-confirm" style="
                    padding: 12px 24px;
                    border: none;
                    background: ${confirmButtonColor};
                    color: white;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: inherit;
                ">${confirmText}</button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Animate in
        setTimeout(() => {
            overlay.style.opacity = '1';
            dialog.style.transform = 'scale(1)';
        }, 50);
        
        // Add hover effects
        const cancelBtn = dialog.querySelector('#dialog-cancel');
        const confirmBtn = dialog.querySelector('#dialog-confirm');
        
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.borderColor = '#9CA3AF';
            cancelBtn.style.color = '#374151';
        });
        
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.borderColor = '#E5E7EB';
            cancelBtn.style.color = '#6B7280';
        });
        
        confirmBtn.addEventListener('mouseenter', () => {
            confirmBtn.style.transform = 'translateY(-1px)';
            confirmBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        });
        
        confirmBtn.addEventListener('mouseleave', () => {
            confirmBtn.style.transform = 'translateY(0)';
            confirmBtn.style.boxShadow = 'none';
        });
        
        // Handle clicks
        const closeDialog = (result) => {
            overlay.style.opacity = '0';
            dialog.style.transform = 'scale(0.8)';
            setTimeout(() => {
                document.body.removeChild(overlay);
                resolve(result);
            }, 300);
        };
        
        cancelBtn.addEventListener('click', () => closeDialog(false));
        confirmBtn.addEventListener('click', () => closeDialog(true));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeDialog(false);
        });
        
        // Handle escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEscape);
                closeDialog(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
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

        // Handle 401 (Unauthorized) upfront
        if (response.status === 401) {
            // Preserve drive session data before clearing localStorage
            const driveSessionData = localStorage.getItem('current_drive_session');
            
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            
            // Restore drive session data after clearing auth data
            if (driveSessionData) {
                localStorage.setItem('current_drive_session', driveSessionData);
            }
            
            window.location.href = 'login.html';
            throw new Error('Unauthorized');
        }        // Handle other errors
        if (!response.ok) {
            let errorData = {};
            try {
                errorData = await response.json();
            } catch (parseErr) {
                // If parsing fails, create a generic error message
                errorData = { 
                    message: `HTTP ${response.status}: ${response.statusText}` 
                };
            }
            const errorMsg = errorData.message || `Error status ${response.status}`;
            console.error('API Error Response:', errorData);
            throw new Error(errorMsg);
        }

        return await response.json();
    } catch (error) {
        console.error('API request error:', error);
        
        // Don't show notification for password change errors - let the calling function handle it
        if (error.message !== 'Unauthorized' && !url.includes('/password/')) {
            showNotification('Network error or server issue. Please try again.', 'error');
        }
        throw error;
    }
}
