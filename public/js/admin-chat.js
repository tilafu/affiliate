/**
 * Admin Chat Management
 * Main JavaScript for the admin chat management interface
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check if user is authenticated as admin
  const authData = requireAuth(true); // true for admin required
  if (!authData) {
    return; // requireAuth will handle redirect
  }
  
  // DOM Elements - Groups Panel
  const groupsList = document.getElementById('groupsList');
  const groupSearch = document.getElementById('groupSearch');
  const searchGroupsBtn = document.getElementById('searchGroupsBtn');
  const groupsPagination = document.getElementById('groupsPagination');
  
  // DOM Elements - Users Panel
  const usersList = document.getElementById('usersList');
  const userSearch = document.getElementById('userSearch');
  const searchUsersBtn = document.getElementById('searchUsersBtn');
  const usersPagination = document.getElementById('usersPagination');
  
  // DOM Elements - Message Panel
  const selectedGroupElement = document.getElementById('selectedGroup');
  const selectedUserElement = document.getElementById('selectedUser');
  const messageContent = document.getElementById('messageContent');
  const messageType = document.getElementById('messageType');
  const sendMessageBtn = document.getElementById('sendMessageBtn');
  const previewBtn = document.getElementById('previewBtn');
  const scheduleBtn = document.getElementById('scheduleBtn');
  const scheduledList = document.getElementById('scheduledList');
  
  // DOM Elements - Preview Modal
  const previewModal = document.getElementById('previewModal');
  const chatPreview = document.getElementById('chatPreview');
  const closePreviewBtn = document.getElementById('closePreviewBtn');
  
  // DOM Elements - Schedule Modal
  const scheduleModal = document.getElementById('scheduleModal');
  const scheduleDate = document.getElementById('scheduleDate');
  const scheduleTime = document.getElementById('scheduleTime');
  const isRecurring = document.getElementById('isRecurring');
  const recurringOptions = document.getElementById('recurringOptions');
  const recurringFrequency = document.getElementById('recurringFrequency');
  const recurringInterval = document.getElementById('recurringInterval');
  const intervalLabel = document.getElementById('intervalLabel');
  const recurringEnd = document.getElementById('recurringEnd');
  const confirmScheduleBtn = document.getElementById('confirmScheduleBtn');
  const cancelScheduleBtn = document.getElementById('cancelScheduleBtn');
  
  // DOM Elements - Logs Modal
  const logsModal = document.getElementById('logsModal');
  const viewLogsBtn = document.getElementById('viewLogsBtn');
  const logsTableBody = document.getElementById('logsTableBody');
  const logActionType = document.getElementById('logActionType');
  const logStartDate = document.getElementById('logStartDate');
  const logEndDate = document.getElementById('logEndDate');
  const filterLogsBtn = document.getElementById('filterLogsBtn');
  const logsPagination = document.getElementById('logsPagination');
  const closeLogsBtn = document.getElementById('closeLogsBtn');
  
  // DOM Elements - Other
  const refreshBtn = document.getElementById('refreshBtn');
  const closeModalButtons = document.querySelectorAll('.close-modal');
  
  // State
  let state = {
    groups: {
      data: [],
      page: 1,
      limit: 50,
      total: 0,
      search: '',
      selected: null
    },
    users: {
      data: [],
      page: 1,
      limit: 100,
      total: 0,
      search: '',
      selected: null
    },
    scheduledMessages: {
      data: [],
      page: 1,
      limit: 10,
      total: 0
    },
    logs: {
      data: [],
      page: 1,
      limit: 50,
      total: 0,
      filters: {}
    },
    ui: {
      fakeUserSearchInput: null // Reference to the fake user search input element
    }
  };
  
  // Initialize
  init();
  
  // Initialize the application
  async function init() {
    // Use same auth check as admin.js - just proceed, let API calls handle auth
    console.log('Initializing admin chat...');
    
    // Load initial data
    loadGroups();
    
    // Add event listeners
    addEventListeners();
    
    // Initialize modals
    initModals();
    
    // Set today's date as default for scheduler
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    scheduleDate.value = dateStr;
    
    // Set default time as 1 hour from now
    const nextHour = new Date(today.getTime() + (60 * 60 * 1000));
    const timeStr = nextHour.getHours().toString().padStart(2, '0') + ':' + 
                   nextHour.getMinutes().toString().padStart(2, '0');
    scheduleTime.value = timeStr;
  }
  
  // Add event listeners
  function addEventListeners() {
    // Groups panel
    searchGroupsBtn.addEventListener('click', () => {
      state.groups.search = groupSearch.value.trim();
      state.groups.page = 1;
      loadGroups();
    });
    
    groupSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        state.groups.search = groupSearch.value.trim();
        state.groups.page = 1;
        loadGroups();
      }
    });
    
    // Users panel
    searchUsersBtn.addEventListener('click', () => {
      if (state.groups.selected) {
        state.users.search = userSearch.value.trim();
        state.users.page = 1;
        loadUsersForGroup(state.groups.selected.id);
      }
    });
    
    userSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && state.groups.selected) {
        state.users.search = userSearch.value.trim();
        state.users.page = 1;
        loadUsersForGroup(state.groups.selected.id);
      }
    });
    
    // Message panel
    sendMessageBtn.addEventListener('click', sendMessage);
    previewBtn.addEventListener('click', showPreviewModal);
    scheduleBtn.addEventListener('click', showScheduleModal);
    
    // Schedule modal
    isRecurring.addEventListener('change', () => {
      recurringOptions.style.display = isRecurring.checked ? 'block' : 'none';
    });
    
    recurringFrequency.addEventListener('change', updateIntervalLabel);
    confirmScheduleBtn.addEventListener('click', scheduleMessage);
    cancelScheduleBtn.addEventListener('click', () => {
      scheduleModal.style.display = 'none';
    });
    
    // Logs modal
    viewLogsBtn.addEventListener('click', () => {
      loadLogs();
      logsModal.style.display = 'block';
    });
    
    filterLogsBtn.addEventListener('click', () => {
      state.logs.filters = {
        actionType: logActionType.value,
        startDate: logStartDate.value,
        endDate: logEndDate.value
      };
      state.logs.page = 1;
      loadLogs();
    });
    
    closeLogsBtn.addEventListener('click', () => {
      logsModal.style.display = 'none';
    });
    
    // Other
    refreshBtn.addEventListener('click', () => {
      loadGroups();
      if (state.groups.selected) {
        loadUsersForGroup(state.groups.selected.id);
        loadScheduledMessages();
      }
    });
    
    // Close modal buttons
    closeModalButtons.forEach(button => {
      button.addEventListener('click', () => {
        const modal = button.closest('.modal');
        if (modal) {
          modal.style.display = 'none';
        }
      });
    });
    
    closePreviewBtn.addEventListener('click', () => {
      previewModal.style.display = 'none';
    });
  }
  
  // Initialize modals
  function initModals() {
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
      }
    });
  }
  
  // Update interval label based on frequency
  function updateIntervalLabel() {
    const frequency = recurringFrequency.value;
    switch (frequency) {
      case 'daily':
        intervalLabel.textContent = 'day(s)';
        break;
      case 'weekly':
        intervalLabel.textContent = 'week(s)';
        break;
      case 'monthly':
        intervalLabel.textContent = 'month(s)';
        break;
    }
  }
  
  // Load groups
  async function loadGroups() {
    groupsList.innerHTML = '<div class="loading">Loading groups...</div>';
    
    const { page, limit, search } = state.groups;
    const result = await AdminChatAPI.getGroups(page, limit, search);
    
    if (result) {
      state.groups.data = result.groups;
      state.groups.total = result.pagination.total;
      
      renderGroups();
      renderPagination(groupsPagination, state.groups, loadGroups);
    }
  }
  
  // Render groups
  function renderGroups() {
    if (state.groups.data.length === 0) {
      groupsList.innerHTML = '<div class="empty-state">No groups found</div>';
      return;
    }
    
    let html = '';
    
    state.groups.data.forEach(group => {
      const isSelected = state.groups.selected && state.groups.selected.id === group.id;
      
      html += `
        <div class="group-item ${isSelected ? 'selected' : ''}" data-id="${group.id}">
          <div class="group-name">${escapeHtml(group.name)}</div>
          <div class="group-stats">
            <div class="group-stat">
              <i class="fas fa-users"></i> ${group.member_count}
            </div>
            <div class="group-stat">
              <i class="fas fa-comment"></i> ${group.message_count}
            </div>
            <div class="group-stat">
              <i class="fas fa-clock"></i> ${formatDate(group.last_activity)}
            </div>
          </div>
        </div>
      `;
    });
    
    groupsList.innerHTML = html;
    
    // Add click event to group items
    document.querySelectorAll('.group-item').forEach(item => {
      item.addEventListener('click', () => {
        const groupId = item.dataset.id;
        selectGroup(groupId);
      });
    });
  }
  
  // Select a group
  async function selectGroup(groupId) {
    // Remove selected class from all groups
    document.querySelectorAll('.group-item').forEach(item => {
      item.classList.remove('selected');
    });
    
    // Add selected class to clicked group
    const groupItem = document.querySelector(`.group-item[data-id="${groupId}"]`);
    if (groupItem) {
      groupItem.classList.add('selected');
    }
    
    // Get group details
    const group = await AdminChatAPI.getGroupById(groupId);
    
    if (group) {
      // Update state
      state.groups.selected = group;
      state.users.selected = null;
      
      // Update UI
      selectedGroupElement.innerHTML = `<strong>Group:</strong> ${escapeHtml(group.name)}`;
      selectedUserElement.innerHTML = 'No user selected';
      
      // Disable message controls
      messageContent.disabled = true;
      messageType.disabled = true;
      sendMessageBtn.disabled = true;
      previewBtn.disabled = true;
      scheduleBtn.disabled = true;
      
      // Load users for this group
      loadUsersForGroup(groupId);
      
      // Load scheduled messages
      loadScheduledMessages();
    }
  }
  
  // Load users for a group
  async function loadUsersForGroup(groupId) {
    usersList.innerHTML = '<div class="loading">Loading users...</div>';
    
    const { page, limit, search } = state.users;
    const result = await AdminChatAPI.getGroupMembers(groupId);
    
    if (result) {
      state.users.data = result;
      state.users.total = result.length;
      
      renderUsers();
      // We don't need pagination for this simple implementation
      // renderPagination(usersPagination, state.users, () => loadUsersForGroup(groupId));
    } else {
      usersList.innerHTML = '<div class="empty-state">No users found in this group</div>';
    }
  }
  
  // Render users
  function renderUsers() {
    if (!state.users.data || state.users.data.length === 0) {
      usersList.innerHTML = '<div class="empty-state">No users found in this group</div>';
      return;
    }
    
    let html = '';
    
    state.users.data.forEach(user => {
      const isSelected = state.users.selected && state.users.selected.id === user.id;
      const avatarUrl = user.avatar_url || 'images/default-avatar.png';
      
      html += `
        <div class="user-item ${isSelected ? 'selected' : ''}" data-id="${user.id}">
          <div class="user-avatar">
            <img src="${avatarUrl}" alt="${escapeHtml(user.display_name)}">
          </div>
          <div class="user-info">
            <div class="user-name">${escapeHtml(user.display_name)}</div>
            <div class="user-username">@${escapeHtml(user.username)}</div>
            ${user.bio ? `<div class="user-bio">${escapeHtml(user.bio.substring(0, 50))}${user.bio.length > 50 ? '...' : ''}</div>` : ''}
          </div>
        </div>
      `;
    });
    
    usersList.innerHTML = html;
    
    // Add click event to user items
    document.querySelectorAll('.user-item').forEach(item => {
      item.addEventListener('click', () => {
        const userId = item.dataset.id;
        selectUser(userId);
      });
    });
  }
  
  // Select a user
  async function selectUser(userId) {
    // Remove selected class from all users
    document.querySelectorAll('.user-item').forEach(item => {
      item.classList.remove('selected');
    });
    
    // Add selected class to clicked user
    const userItem = document.querySelector(`.user-item[data-id="${userId}"]`);
    if (userItem) {
      userItem.classList.add('selected');
    }
    
    // Find user in state
    const user = state.users.data.find(u => u.id.toString() === userId.toString());
    
    if (user) {
      // Update state
      state.users.selected = user;
      
      // Update UI
      selectedUserElement.innerHTML = `<strong>User:</strong> ${escapeHtml(user.display_name)} (@${escapeHtml(user.username)})`;
      
      // Enable message controls
      messageContent.disabled = false;
      messageType.disabled = false;
      sendMessageBtn.disabled = false;
      previewBtn.disabled = false;
      scheduleBtn.disabled = false;
    }
  }
  
  // Load scheduled messages
  async function loadScheduledMessages() {
    if (!state.groups.selected) return;
    
    const groupId = state.groups.selected.id;
    const userId = state.users.selected ? state.users.selected.id : null;
    const userType = state.users.selected ? 'fake_user' : null;
    
    const result = await AdminChatAPI.getScheduledMessages(groupId, userId, userType);
    
    if (result) {
      state.scheduledMessages.data = result.messages;
      state.scheduledMessages.total = result.pagination.total;
      
      renderScheduledMessages();
    }
  }
  
  // Render scheduled messages
  function renderScheduledMessages() {
    if (state.scheduledMessages.data.length === 0) {
      scheduledList.innerHTML = '<div class="empty-state">No scheduled messages</div>';
      return;
    }
    
    let html = '';
    
    state.scheduledMessages.data.forEach(message => {
      html += `
        <div class="scheduled-item" data-id="${message.id}">
          <div class="scheduled-header">
            <div class="scheduled-time">${formatDateTime(message.scheduled_at)}</div>
            <div class="scheduled-actions">
              <button class="cancel-scheduled-btn" data-id="${message.id}">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
          <div class="scheduled-content">${escapeHtml(message.content)}</div>
          <div class="scheduled-meta">
            <div>Group: ${escapeHtml(message.group_name)}</div>
            <div>User: ${escapeHtml(message.user_display_name)}</div>
            ${message.is_recurring ? '<div><i class="fas fa-redo"></i> Recurring</div>' : ''}
          </div>
        </div>
      `;
    });
    
    scheduledList.innerHTML = html;
    
    // Add click event to cancel buttons
    document.querySelectorAll('.cancel-scheduled-btn').forEach(button => {
      button.addEventListener('click', async (e) => {
        e.stopPropagation();
        const messageId = button.dataset.id;
        
        if (confirm('Are you sure you want to cancel this scheduled message?')) {
          const result = await AdminChatAPI.cancelScheduledMessage(messageId);
          
          if (result) {
            // Reload scheduled messages
            loadScheduledMessages();
          }
        }
      });
    });
  }
  
  // Send a message
  async function sendMessage() {
    if (!state.groups.selected || !state.users.selected) {
      alert('Please select a group and a user first');
      return;
    }
    
    const message = messageContent.value.trim();
    
    if (!message) {
      alert('Please enter a message');
      return;
    }
    
    // Disable send button
    sendMessageBtn.disabled = true;
    
    // Send message
    const result = await AdminChatAPI.postAsFakeUser(
      state.groups.selected.id,
      state.users.selected.id,
      message,
      messageType.value
    );
    
    if (result) {
      // Clear message input
      messageContent.value = '';
      
      // Show success message
      alert('Message sent successfully');
    }
    
    // Re-enable send button
    sendMessageBtn.disabled = false;
  }
  
  // Show preview modal
  function showPreviewModal() {
    if (!state.groups.selected || !state.users.selected) {
      alert('Please select a group and a user first');
      return;
    }
    
    const message = messageContent.value.trim();
    
    if (!message) {
      alert('Please enter a message');
      return;
    }
    
    // Build preview data
    const previewData = {
      groupId: state.groups.selected.id,
      messages: [
        {
          fakeUserId: state.users.selected.id,
          content: message,
          messageType: messageType.value
        }
      ]
    };
    
    // Get preview
    AdminChatAPI.previewConversation(previewData.groupId, previewData.messages)
      .then(result => {
        if (result) {
          renderPreview(result);
          previewModal.style.display = 'block';
        }
      });
  }
  
  // Render message preview
  function renderPreview(data) {
    let html = '';
    
    data.messages.forEach(message => {
      const avatarUrl = message.user.avatar_url || 'images/default-avatar.png';
      
      html += `
        <div class="chat-message">
          <div class="chat-message-avatar">
            <img src="${avatarUrl}" alt="${escapeHtml(message.user.display_name)}">
          </div>
          <div class="chat-message-content">
            <div class="chat-message-name">${escapeHtml(message.user.display_name)}</div>
            <div class="chat-message-text">${escapeHtml(message.content)}</div>
            <div class="chat-message-time">${formatTime(new Date())}</div>
          </div>
        </div>
      `;
    });
    
    chatPreview.innerHTML = html;
  }
  
  // Show schedule modal
  function showScheduleModal() {
    if (!state.groups.selected || !state.users.selected) {
      alert('Please select a group and a user first');
      return;
    }
    
    const message = messageContent.value.trim();
    
    if (!message) {
      alert('Please enter a message');
      return;
    }
    
    // Reset recurring options
    isRecurring.checked = false;
    recurringOptions.style.display = 'none';
    
    // Show modal
    scheduleModal.style.display = 'block';
  }
  
  // Schedule a message
  async function scheduleMessage() {
    const message = messageContent.value.trim();
    
    if (!message) {
      alert('Please enter a message');
      return;
    }
    
    // Get scheduled date and time
    const scheduledDate = scheduleDate.value;
    const scheduledTime = scheduleTime.value;
    
    if (!scheduledDate || !scheduledTime) {
      alert('Please select a date and time');
      return;
    }
    
    // Create scheduled date object
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
    
    // Check if date is in the future
    if (scheduledAt <= new Date()) {
      alert('Scheduled time must be in the future');
      return;
    }
    
    // Get recurring info
    const recurring = isRecurring.checked;
    let recurringPattern = null;
    
    if (recurring) {
      recurringPattern = {
        frequency: recurringFrequency.value,
        interval: parseInt(recurringInterval.value),
        endDate: recurringEnd.value || null
      };
    }
    
    // Disable confirm button
    confirmScheduleBtn.disabled = true;
    
    // Schedule message
    const result = await AdminChatAPI.scheduleMessage(
      state.groups.selected.id,
      state.users.selected.id,
      message,
      messageType.value,
      scheduledAt.toISOString(),
      recurring,
      recurringPattern
    );
    
    if (result) {
      // Clear message input
      messageContent.value = '';
      
      // Hide modal
      scheduleModal.style.display = 'none';
      
      // Show success message
      alert('Message scheduled successfully');
      
      // Reload scheduled messages
      loadScheduledMessages();
    }
    
    // Re-enable confirm button
    confirmScheduleBtn.disabled = false;
  }
  
  // Load admin logs
  async function loadLogs() {
    logsTableBody.innerHTML = '<tr><td colspan="6"><div class="loading">Loading logs...</div></td></tr>';
    
    const { page, limit, filters } = state.logs;
    const result = await AdminChatAPI.getAdminLogs(filters, page, limit);
    
    if (result) {
      state.logs.data = result.logs;
      state.logs.total = result.pagination.total;
      
      renderLogs();
      renderPagination(logsPagination, state.logs, loadLogs);
    }
  }
  
  // Render admin logs
  function renderLogs() {
    if (state.logs.data.length === 0) {
      logsTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No logs found</td></tr>';
      return;
    }
    
    let html = '';
    
    state.logs.data.forEach(log => {
      const actionDetails = log.action_details ? JSON.stringify(log.action_details) : '';
      
      html += `
        <tr>
          <td>${formatDateTime(log.created_at)}</td>
          <td>${escapeHtml(log.admin_username || '')}</td>
          <td>${formatActionType(log.action_type)}</td>
          <td>${escapeHtml(log.group_name || '')}</td>
          <td>${escapeHtml(log.fake_user_name || '')}</td>
          <td>${actionDetails.length > 50 ? actionDetails.substring(0, 50) + '...' : actionDetails}</td>
        </tr>
      `;
    });
    
    logsTableBody.innerHTML = html;
  }
  
  // Render pagination
  function renderPagination(element, state, callback) {
    const { page, limit, total } = state;
    const pages = Math.ceil(total / limit);
    
    if (pages <= 1) {
      element.innerHTML = '';
      return;
    }
    
    let html = '';
    
    // Previous button
    html += `
      <button class="pagination-btn ${page === 1 ? 'disabled' : ''}" 
              data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i>
      </button>
    `;
    
    // Page numbers
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(pages, page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      html += `
        <button class="pagination-btn ${i === page ? 'active' : ''}" data-page="${i}">
          ${i}
        </button>
      `;
    }
    
    // Next button
    html += `
      <button class="pagination-btn ${page === pages ? 'disabled' : ''}" 
              data-page="${page + 1}" ${page === pages ? 'disabled' : ''}>
        <i class="fas fa-chevron-right"></i>
      </button>
    `;
    
    element.innerHTML = html;
    
    // Add click event to pagination buttons
    element.querySelectorAll('.pagination-btn:not(.disabled)').forEach(button => {
      button.addEventListener('click', () => {
        const newPage = parseInt(button.dataset.page);
        state.page = newPage;
        callback();
      });
    });
  }
  
  // When the fake users tab is activated, load all users
  function showFakeUsersTab() {
    // Optionally clear any search input
    if (state.ui.fakeUserSearchInput) {
      state.ui.fakeUserSearchInput.value = '';
    }
    // Fetch all users (no search filter)
    loadFakeUsers();
  }
  
  // Load fake users, optionally with a search filter
  async function loadFakeUsers(search = '') {
    let url = '/api/admin/chat/fake-users';
    if (search && search.trim()) {
      url += `?search=${encodeURIComponent(search.trim())}`;
    }
    const response = await fetch(url);
    const users = await response.json();
    state.fakeUsers.data = users;
    renderFakeUsersList();
  }
  
  // Helper Functions
  
  // Format date
  function formatDate(dateStr) {
    if (!dateStr) return 'Never';
    
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  }
  
  // Format date and time
  function formatDateTime(dateStr) {
    if (!dateStr) return 'Never';
    
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
  
  // Format time
  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Format action type
  function formatActionType(actionType) {
    if (!actionType) return '';
    
    return actionType
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }
  
  // Escape HTML
  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    
    return unsafe
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
