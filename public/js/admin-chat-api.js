/**
 * Admin Chat API Client
 * Handles all API calls for the admin chat management interface
 */

const AdminChatAPI = (() => {
  // Base API URL - Fixed to match server routing
  const API_BASE = '/api/admin/chat';
  
  // Helper function for API calls with improved error handling
  const apiCall = async (endpoint, method = 'GET', data = null) => {
    const fullUrl = `${API_BASE}${endpoint}`;
    console.log(`[AdminChatAPI] Making ${method} request to: ${fullUrl}`);
    
    // Check if we have proper authentication
    const adminToken = localStorage.getItem('admin_auth_token') || localStorage.getItem('auth_token');
    if (!adminToken) {
      console.warn('[AdminChatAPI] No admin token found. User may not be authenticated.');
      showError('Authentication token not found. Please log in again.');
      window.location.href = '/admin.html';
      return null;
    }
    
    try {
      let response;
      
      // Use DualAuth if available, otherwise fall back to direct fetch
      if (typeof DualAuth !== 'undefined' && DualAuth.fetchWithAuth) {
        console.log('[AdminChatAPI] Using DualAuth for authentication');
        response = await DualAuth.fetchWithAuth(fullUrl, {
          method,
          body: data ? JSON.stringify(data) : null,
        }, 'admin');
      } else {
        console.log('[AdminChatAPI] DualAuth not available, using direct fetch');
        // Fallback to direct fetch with Authorization header
        response = await fetch(fullUrl, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: data ? JSON.stringify(data) : null,
          credentials: 'include'
        });
      }

      console.log(`[AdminChatAPI] Response status: ${response.status} ${response.statusText}`);
      console.log(`[AdminChatAPI] Response URL: ${response.url}`);

      // Check for non-JSON responses which may indicate an error or redirect
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.log(`[AdminChatAPI] Non-JSON response received (${contentType}):`, text.substring(0, 500));
        
        // If we get HTML, it's likely a server-side redirect or error page
        if (text.includes('<!DOCTYPE html>')) {
            console.error('[AdminChatAPI] Received HTML response instead of JSON. This could be an auth issue or server error.');
            showError('An unexpected server response was received. Please try logging in again.');
            return null;
        }
        // For other non-JSON, non-OK responses
        if (!response.ok) {
            throw new Error(`SERVER_NON_JSON_ERROR: Server returned a non-JSON error: ${response.status} ${response.statusText}`);
        }
        // If response is OK but not JSON (e.g., 204 No Content)
        return { success: true, data: text };
      }

      const result = await response.json();
      
      if (!response.ok) {
        // Enhanced error handling with detailed error information
        const errorInfo = {
          status: response.status,
          statusText: response.statusText,
          error: result.error || 'UNKNOWN_ERROR',
          message: result.message || result.error || 'API call failed',
          details: result.details || null,
          timestamp: result.timestamp || new Date().toISOString()
        };
        
        console.error('[AdminChatAPI] API Error:', errorInfo);
        throw new Error(JSON.stringify(errorInfo));
      }
      
      return result;
    } catch (error) {
      console.error('[AdminChatAPI] API call failed:', error);
      
      // Try to parse enhanced error info
      let errorInfo;
      try {
        errorInfo = JSON.parse(error.message);
      } catch (parseError) {
        // Fallback to simple error
        errorInfo = {
          error: 'NETWORK_ERROR',
          message: error.message,
          details: 'Failed to connect to server or parse response'
        };
      }
      
      // Avoid showing generic error if DualAuth is already handling a redirect
      if (errorInfo.error !== 'Unauthorized') {
        showError(`${errorInfo.message}${errorInfo.details ? ' - ' + errorInfo.details : ''}`);
      }
      return null;
    }
  };
  
  
  // Get CSRF token from meta tag
  const getCSRFToken = () => {
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    return metaTag ? metaTag.getAttribute('content') : '';
  };
  
  // Show error message with improved formatting
  const showError = (message) => {
    console.error('[AdminChatAPI] Error:', message);
    
    // Try to use the existing notification system if available
    if (window.AdminUI && window.AdminUI.showNotification) {
      window.AdminUI.showNotification('error', message);
      return;
    }
    
    // Try to use a more user-friendly notification if available
    if (window.showNotification) {
      window.showNotification('error', message);
      return;
    }
    
    // Create a temporary error display element
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
    
    // Fallback to alert for critical errors
    if (message.includes('AUTHENTICATION') || message.includes('UNAUTHORIZED')) {
      alert(`Authentication Error: ${message}`);
    }
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
    
    // Alias for backward compatibility
    getGroupById: (groupId) => {
      return apiCall(`/groups/${groupId}`);
    },

    getGroupUsers: (groupId) => {
      // Use correct backend route for group members (fake users)
      return apiCall(`/groups/${groupId}/members`);
    },
    
    // Fake Users
    getAllFakeUsers: (page = 1, limit = 50, search = '') => {
      return apiCall(`/fake-users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
    },
    
    getFakeUserDetails: (userId) => {
      return apiCall(`/fake-users/${userId}`);
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
    },
    
    // Conversations (Admin View)
    getConversations: (page = 1, limit = 50, search = '') => {
      return apiCall(`/conversations?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
    },
    
    getConversationMessages: (conversationId, page = 1, limit = 50) => {
      return apiCall(`/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
    },
    
    sendConversationMessage: (conversationId, fakeUserId, content, messageType = 'text') => {
      return apiCall(`/conversations/${conversationId}/messages`, 'POST', {
        fakeUserId,
        content,
        messageType
      });
    }
  };
})();
