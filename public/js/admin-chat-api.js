/**
 * Admin Chat API Client
 * Handles all API calls for the admin chat management interface
 */

const AdminChatAPI = (() => {
  // Base API URL
  const API_BASE = '/api/admin/chat';
  
  // Helper function for API calls
  const apiCall = async (endpoint, method = 'GET', data = null) => {
    try {
      // Check if admin token exists before making the call
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        console.error('No admin token found');
        redirectToLogin();
        return null;
      }
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin'
      };
      
      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      
      // Handle unauthorized or forbidden
      if (response.status === 401 || response.status === 403) {
        console.error('Authentication error:', response.status);
        showError('Authentication error. Please ensure you are logged in as an admin.');
        redirectToLogin();
        return null;
      }
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'API call failed');
      }
      
      return result;
    } catch (error) {
      console.error('API error:', error);
      showError(error.message);
      return null;
    }
  };
  
  
  // Get CSRF token from meta tag
  const getCSRFToken = () => {
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    return metaTag ? metaTag.getAttribute('content') : '';
  };
  
  // Show error message
  const showError = (message) => {
    console.error('API Error:', message);
    
    // Try to use the existing notification system if available
    if (window.AdminUI && window.AdminUI.showNotification) {
      window.AdminUI.showNotification('error', message);
      return;
    }
    
    // Fallback to alert for simplicity
    alert(`Error: ${message}`);
  };
  
  // Redirect to login page
  const redirectToLogin = () => {
    // Get the current URL to use as a return URL after login
    const currentUrl = encodeURIComponent(window.location.href);
    
    // Clear the token since it's invalid or expired
    localStorage.removeItem('adminToken');
    
    // Redirect to the login page with a return URL
    window.location.href = `/admin-login.html?returnUrl=${currentUrl}`;
  };
  
  // API methods
  return {
    // Initialize and check authentication
    init: () => {
      // Check if admin token exists
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        console.warn('No admin token found, redirecting to login');
        redirectToLogin();
        return false;
      }
      
      // Verify token with a simple API call
      return apiCall('/groups?page=1&limit=1')
        .then(result => {
          return !!result; // Return true if API call succeeded
        })
        .catch(() => {
          return false; // Return false if API call failed
        });
    },
    
    // Groups
    getGroups: (page = 1, limit = 50, search = '') => {
      return apiCall(`/groups?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
    },
    
    getGroupDetails: (groupId) => {
      return apiCall(`/groups/${groupId}`);
    },
    
    getGroupUsers: (groupId, userType = 'fake', page = 1, limit = 50) => {
      return apiCall(`/groups/${groupId}/users?userType=${userType}&page=${page}&limit=${limit}`);
    },
    
    // Fake Users
    getAllFakeUsers: (page = 1, limit = 50, search = '') => {
      return apiCall(`/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
    },
    
    getFakeUserDetails: (userId) => {
      return apiCall(`/users/${userId}`);
    },
    
    // Posting and Messages
    postAsFakeUser: (groupId, fakeUserId, message, messageType = 'text') => {
      return apiCall('/post', 'POST', {
        groupId,
        fakeUserId,
        message,
        messageType
      });
    },
    
    scheduleMessage: (groupId, fakeUserId, message, messageType, scheduledAt, isRecurring = false, recurringPattern = null) => {
      return apiCall('/schedule', 'POST', {
        groupId,
        fakeUserId,
        message,
        messageType,
        scheduledAt,
        isRecurring,
        recurringPattern
      });
    },
    
    cancelScheduledMessage: (messageId) => {
      return apiCall(`/schedule/${messageId}`, 'DELETE');
    },
    
    getScheduledMessages: (groupId = null, fakeUserId = null, page = 1, limit = 50) => {
      let query = `?page=${page}&limit=${limit}`;
      if (groupId) query += `&groupId=${groupId}`;
      if (fakeUserId) query += `&fakeUserId=${fakeUserId}`;
      
      return apiCall(`/schedule${query}`);
    },
    
    // Preview
    previewConversation: (groupId, messages) => {
      return apiCall('/preview', 'POST', {
        groupId,
        messages
      });
    },
    
    // Admin Logs
    getAdminLogs: (filters = {}, page = 1, limit = 50) => {
      let query = `?page=${page}&limit=${limit}`;
      
      if (filters.adminId) query += `&adminId=${filters.adminId}`;
      if (filters.actionType) query += `&actionType=${filters.actionType}`;
      if (filters.groupId) query += `&groupId=${filters.groupId}`;
      if (filters.fakeUserId) query += `&fakeUserId=${filters.fakeUserId}`;
      if (filters.startDate) query += `&startDate=${filters.startDate}`;
      if (filters.endDate) query += `&endDate=${filters.endDate}`;
      
      return apiCall(`/logs${query}`);
    },
    
    getLogDetails: (logId) => {
      return apiCall(`/logs/${logId}`);
    },
    
    // Templates (for future implementation)
    getTemplates: (page = 1, limit = 50) => {
      return apiCall(`/templates?page=${page}&limit=${limit}`);
    },
    
    createTemplate: (name, description, content) => {
      return apiCall('/templates', 'POST', {
        name,
        description,
        content
      });
    },
    
    updateTemplate: (templateId, name, description, content) => {
      return apiCall(`/templates/${templateId}`, 'PUT', {
        name,
        description,
        content
      });
    },
    
    deleteTemplate: (templateId) => {
      return apiCall(`/templates/${templateId}`, 'DELETE');
    }
  };
})();
