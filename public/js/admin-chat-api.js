/**
 * Admin Chat API Client
 * Handles all API calls for the admin chat management interface
 */

const AdminChatAPI = (() => {
  // Base API URL
  const API_BASE = '/api/admin-chat';
  
  // Helper function for API calls
  const apiCall = async (endpoint, method = 'GET', data = null) => {
    try {
      // Use DualAuth for a unified authentication approach
      const response = await DualAuth.fetchWithAuth(`/api/admin-chat${endpoint}`, {
        method,
        body: data ? JSON.stringify(data) : null,
      }, 'admin');

      // Check for non-JSON responses which may indicate an error or redirect
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        // If we get HTML, it's likely a server-side redirect or error page
        if (text.includes('<!DOCTYPE html>')) {
            console.error('Received HTML response instead of JSON. This could be an auth issue or server error.');
            showError('An unexpected server response was received. Please try logging in again.');
            // DualAuth's fetchWithAuth will handle the redirect on 401, but this is a fallback.
            // if (!response.ok) {
            //      window.location.href = '/admin.html';
            // }
            // return null;
        }
        // For other non-JSON, non-OK responses
        if (!response.ok) {
            throw new Error(`Server returned a non-JSON error: ${response.status} ${response.statusText}`);
        }
        // If response is OK but not JSON (e.g., 204 No Content)
        return text; // Or handle as needed
      }

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || result.message || 'API call failed');
      }
      
      return result;
    } catch (error) {
      console.error('API error in apiCall:', error);
      // Avoid showing generic error if DualAuth is already handling a redirect.
      // We can check if the error message is 'Unauthorized' which is what we throw in DualAuth.
      if (error.message !== 'Unauthorized') {
        showError(error.message);
      }
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
  
  // Redirect to admin dashboard
  const redirectToLogin = () => {
    // Clear the tokens since they're invalid or expired
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    
    // Redirect to the admin panel
    // window.location.href = '/admin.html';
  };
  
  // API methods
  return {
    // Groups
    getGroups: (page = 1, limit = 50, search = '') => {
      return apiCall(`/groups?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
    },
    
    getGroupDetails: (groupId) => {
      return apiCall(`/groups/${groupId}`);
    },
    
    getGroupUsers: (groupId, userType = 'fake', page = 1, limit = 50) => {
      // Corrected route to be more specific and avoid conflicts
      return apiCall(`/users/group/${groupId}?userType=${userType}&page=${page}&limit=${limit}`);
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
