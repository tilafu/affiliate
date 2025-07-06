/**
 * Admin Chat API Client (Integrated Version)
 * Works with existing admin authentication system
 */

const AdminChatAPI = (() => {
  // Base API URL
  const API_BASE = '/api/admin/chat';
  
  // Helper function for API calls
  const apiCall = async (endpoint, method = 'GET', data = null) => {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        // Important: include credentials to send session cookies
        credentials: 'same-origin'
      };
      
      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      
      // Handle unauthorized or forbidden - redirect to admin login
      if (response.status === 401 || response.status === 403) {
        window.location.href = '/admin.html'; // Redirect to main admin page
        return null;
      }
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'API call failed');
      }
      
      return result;
    } catch (error) {
      console.error('API error:', error);
      showNotification('error', error.message || 'API call failed');
      return null;
    }
  };
  
  // Display notification
  const showNotification = (type, message) => {
    // Use existing admin notification system if available
    if (window.AdminUI && window.AdminUI.showNotification) {
      window.AdminUI.showNotification(type, message);
      return;
    }
    
    // Fallback notification
    console.log(`${type.toUpperCase()}: ${message}`);
    alert(message);
  };

  // Group Management
  const getGroups = () => apiCall('/groups');
  const getGroupById = (groupId) => apiCall(`/groups/${groupId}`);
  const createGroup = (groupData) => apiCall('/groups', 'POST', groupData);
  const updateGroup = (groupId, groupData) => apiCall(`/groups/${groupId}`, 'PUT', groupData);
  const deleteGroup = (groupId) => apiCall(`/groups/${groupId}`, 'DELETE');
  
  // Fake User Management
  const getFakeUsers = () => apiCall('/fake-users');
  const getFakeUserById = (userId) => apiCall(`/fake-users/${userId}`);
  const createFakeUser = (userData) => apiCall('/fake-users', 'POST', userData);
  const updateFakeUser = (userId, userData) => apiCall(`/fake-users/${userId}`, 'PUT', userData);
  const deleteFakeUser = (userId) => apiCall(`/fake-users/${userId}`, 'DELETE');
  const generateFakeUsers = (options) => apiCall('/fake-users/generate', 'POST', options);
  
  // Group Membership
  const getGroupMembers = (groupId) => apiCall(`/groups/${groupId}/members`);
  const addGroupMember = (groupId, memberData) => apiCall(`/groups/${groupId}/members`, 'POST', memberData);
  const removeGroupMember = (groupId, memberId) => apiCall(`/groups/${groupId}/members/${memberId}`, 'DELETE');
  
  // Messages
  const getGroupMessages = (groupId, options = {}) => {
    const queryParams = new URLSearchParams();
    if (options.limit) queryParams.append('limit', options.limit);
    if (options.before) queryParams.append('before', options.before);
    if (options.after) queryParams.append('after', options.after);
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return apiCall(`/groups/${groupId}/messages${queryString}`);
  };
  
  const sendMessage = (groupId, messageData) => apiCall(`/groups/${groupId}/messages`, 'POST', messageData);
  const deleteMessage = (messageId) => apiCall(`/messages/${messageId}`, 'DELETE');
  
  // Scheduled Messages
  const getScheduledMessages = () => apiCall('/scheduled-messages');
  const getGroupScheduledMessages = (groupId) => apiCall(`/groups/${groupId}/scheduled-messages`);
  const scheduleMessage = (messageData) => apiCall('/scheduled-messages', 'POST', messageData);
  const updateScheduledMessage = (messageId, messageData) => apiCall(`/scheduled-messages/${messageId}`, 'PUT', messageData);
  const deleteScheduledMessage = (messageId) => apiCall(`/scheduled-messages/${messageId}`, 'DELETE');
  
  // Admin Logs
  const getAdminLogs = (options = {}) => {
    const queryParams = new URLSearchParams();
    if (options.limit) queryParams.append('limit', options.limit);
    if (options.page) queryParams.append('page', options.page);
    if (options.actionType) queryParams.append('actionType', options.actionType);
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return apiCall(`/logs${queryString}`);
  };
  
  // Return public API
  return {
    // Groups
    getGroups,
    getGroupById,
    createGroup,
    updateGroup,
    deleteGroup,
    
    // Fake Users
    getFakeUsers,
    getFakeUserById,
    createFakeUser,
    updateFakeUser,
    deleteFakeUser,
    generateFakeUsers,
    
    // Group Membership
    getGroupMembers,
    addGroupMember,
    removeGroupMember,
    
    // Messages
    getGroupMessages,
    sendMessage,
    deleteMessage,
    
    // Scheduled Messages
    getScheduledMessages,
    getGroupScheduledMessages,
    scheduleMessage,
    updateScheduledMessage,
    deleteScheduledMessage,
    
    // Admin Logs
    getAdminLogs
  };
})();

// Make API available globally
window.AdminChatAPI = AdminChatAPI;
