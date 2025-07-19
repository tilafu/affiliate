/**
 * User Chat Interface
 * Handles the user-facing chat functionality
 */

class UserChatApp {
  constructor() {
    this.currentUser = null;
    this.currentGroup = null;
    this.currentDM = null; // Track current direct message conversation
    this.groups = [];
    this.directMessages = []; // Store DM conversations
    this.messages = [];
    this.socket = null;
    this.memberCountTimer = null; // Timer for auto-refreshing member counts
    this.lastMemberCount = undefined; // Track last member count for realistic changes
    this.groupLastVisited = {}; // Track when user last visited each group for "new" badges
    this.chatMode = 'groups'; // 'groups' or 'direct' mode
    
    this.init();
  }

  // Helper method to detect mobile view
  isMobileView() {
    return window.innerWidth <= 768;
  }

  // Helper method to generate exaggerated member count display
  getExaggeratedMemberCount(min = 100, max = 2000, forceNew = false) {
    // Load persisted member count from localStorage first
    if (this.lastMemberCount === undefined) {
      this.loadPersistedMemberCount(min, max);
    }
    
    // If this is the first time or we're forcing a new count, generate initial random number
    if (this.lastMemberCount === undefined || forceNew) {
      const onlineCount = Math.floor(Math.random() * (max - min + 1)) + min;
      this.lastMemberCount = onlineCount;
      this.savePersistedMemberCount();
      return `${onlineCount} online`;
    }
    
    // For subsequent calls, return the same count (only update during auto-refresh)
    return `${this.lastMemberCount} online`;
  }

  // Method specifically for auto-refresh with gradual changes
  getUpdatedMemberCount(min = 100, max = 2000) {
    if (this.lastMemberCount === undefined) {
      // Initialize if not set
      this.lastMemberCount = Math.floor(Math.random() * (max - min + 1)) + min;
    } else {
      // Make realistic incremental changes (±20 max)
      const maxChange = 20;
      const change = Math.floor(Math.random() * (maxChange * 2 + 1)) - maxChange; // -20 to +20
      let newCount = this.lastMemberCount + change;
      
      // Ensure we stay within bounds
      newCount = Math.max(min, Math.min(max, newCount));
      this.lastMemberCount = newCount;
    }
    
    // Save the updated count to localStorage
    this.savePersistedMemberCount();
    
    return `${this.lastMemberCount} online`;
  }

  // Load member count from localStorage to persist across page refreshes
  loadPersistedMemberCount(min = 100, max = 2000) {
    try {
      const stored = localStorage.getItem('chatMemberCount');
      const storedTimestamp = localStorage.getItem('chatMemberCountTimestamp');
      
      if (stored && storedTimestamp) {
        const count = parseInt(stored);
        const timestamp = parseInt(storedTimestamp);
        const now = Date.now();
        
        // Only use stored count if it's less than 1 hour old and within valid range
        // This prevents stale data while allowing persistence during normal usage
        if ((now - timestamp) < 36000 && count >= min && count <= max) {
          this.lastMemberCount = count;
          console.log('Loaded persisted member count:', count);
          return;
        }
      }
    } catch (error) {
      console.log('Could not load persisted member count:', error);
    }
    
    // If no valid stored count, this.lastMemberCount remains undefined
    // and will be initialized by getExaggeratedMemberCount or getUpdatedMemberCount
  }

  // Save member count to localStorage for persistence
  savePersistedMemberCount() {
    try {
      if (this.lastMemberCount !== undefined) {
        localStorage.setItem('chatMemberCount', this.lastMemberCount.toString());
        localStorage.setItem('chatMemberCountTimestamp', Date.now().toString());
      }
    } catch (error) {
      console.log('Could not save member count:', error);
    }
  }

  // Start auto-refresh timer for member counts
  startMemberCountRefresh() {
    // Clear any existing timer
    if (this.memberCountTimer) {
      clearInterval(this.memberCountTimer);
    }
    
    // Update every 3 minutes (180,000 milliseconds)
    this.memberCountTimer = setInterval(() => {
      this.updatePersonalGroupMemberCounts();
    }, 180000);
  }

  // Update member counts for personal groups only
  updatePersonalGroupMemberCounts() {
    // Update in chat list
    this.groups.forEach(group => {
      if (group.is_personal_group) {
        const groupElement = document.querySelector(`[data-group-id="${group.id}"]`);
        if (groupElement) {
          const previewElement = groupElement.querySelector('.chat-item-preview');
          if (previewElement) {
            previewElement.innerHTML = `
              ${group.message_count} messages • ${this.getUpdatedMemberCount()}
            `;
          }
        }
      }
    });

    // Update chat header if currently viewing a personal group
    if (this.currentGroup && this.currentGroup.is_personal_group) {
      if (this.contactStatus) {
        this.contactStatus.textContent = this.getUpdatedMemberCount();
      }
    }
  }

  // Stop the member count refresh timer
  stopMemberCountRefresh() {
    if (this.memberCountTimer) {
      clearInterval(this.memberCountTimer);
      this.memberCountTimer = null;
    }
  }

  // Helper method to check if user can post in the current group
  canPostInGroup(group) {
    // Users can only post in their personal group (created when they registered)
    // All other groups are read-only for clients
    // OR if it's a direct message
    if (group && group.is_direct_message) {
      return true; // Can always post in DMs
    }
    return group && group.is_personal_group === true;
  }

  // Helper method to check if group has new messages since last visit
  hasNewMessages(group) {
    const lastVisited = this.groupLastVisited[group.id];
    if (!lastVisited) {
      // Never visited this group, consider it as having new messages if it has any activity
      return group.last_activity && group.message_count > 0;
    }
    
    // Check if group has activity since last visit
    if (group.last_activity) {
      const lastActivityTime = new Date(group.last_activity);
      return lastActivityTime > lastVisited;
    }
    
    return false;
  }

  // Mark group as visited (remove "new" badge)
  markGroupAsVisited(groupId) {
    this.groupLastVisited[groupId] = new Date();
    
    // Save to localStorage for persistence across sessions
    localStorage.setItem('chatGroupLastVisited', JSON.stringify(this.groupLastVisited));
    
    // Update the UI to remove the badge
    this.updateGroupNewBadge(groupId, false);
  }

  // Load last visited times from localStorage
  loadGroupVisitedTimes() {
    try {
      const stored = localStorage.getItem('chatGroupLastVisited');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert string dates back to Date objects
        this.groupLastVisited = {};
        for (const [groupId, dateString] of Object.entries(parsed)) {
          this.groupLastVisited[groupId] = new Date(dateString);
        }
      }
    } catch (error) {
      console.log('Could not load group visited times:', error);
      this.groupLastVisited = {};
    }
  }

  // Update new badge for a specific group
  updateGroupNewBadge(groupId, hasNew) {
    const groupElement = document.querySelector(`[data-group-id="${groupId}"]`);
    if (!groupElement) return;
    
    const nameElement = groupElement.querySelector('.chat-item-name');
    if (!nameElement) return;
    
    // Remove existing badge
    const existingBadge = nameElement.querySelector('.new-message-badge');
    if (existingBadge) {
      existingBadge.remove();
    }
    
    // Add new badge if needed
    if (hasNew) {
      const newBadge = document.createElement('span');
      newBadge.className = 'new-message-badge';
      newBadge.textContent = 'NEW';
      nameElement.appendChild(document.createTextNode(' '));
      nameElement.appendChild(newBadge);
    }
  }

  // Update input area based on posting permissions
  updateInputPermissions(group) {
    const canPost = this.canPostInGroup(group);
    const inputArea = document.querySelector('.chat-input-area');
    
    if (!this.messageInput || !this.sendButton || !inputArea) return;
    
    if (canPost) {
      // Enable posting
      this.messageInput.disabled = false;
      this.sendButton.disabled = false;
      this.messageInput.placeholder = 'Type a message';
      inputArea.classList.remove('read-only');
      inputArea.style.opacity = '1';
    } else {
      // Disable posting - read-only mode
      this.messageInput.disabled = true;
      this.sendButton.disabled = true;
      // this.messageInput.placeholder = 'You can only read messages in this group';
      inputArea.classList.add('read-only');
      inputArea.style.opacity = '0.6';
    }
  }

  async init() {
    try {
      console.log('Initializing chat app...');
      
      // Check authentication and get user info
      await this.checkAuth();
      console.log('Authentication successful for user:', this.currentUser?.username);
      
      // Initialize UI elements
      this.initializeUI();
      
      // Load user's groups
      await this.loadGroups();
      
      // Initialize Socket.io connection
      this.initializeSocket();
      
      console.log('Chat app initialization completed');
      
    } catch (error) {
      console.error('Failed to initialize chat app:', error);
      
      // Show error message to user before redirecting
      this.showError(`Authentication failed: ${error.message}`);
      
      // Delay redirect to allow user to see error
      setTimeout(() => {
        this.redirectToLogin();
      }, 3000);
    }
  }

  async checkAuth() {
    // Check multiple possible token keys (for compatibility)
    const token = localStorage.getItem('authToken') || 
                  localStorage.getItem('auth_token') || 
                  localStorage.getItem('admin_auth_token');
    
    console.log('Checking auth token:', token ? 'Token found' : 'No token');
    
    if (!token) {
      console.log('No auth token found in localStorage');
      console.log('Available localStorage keys:', Object.keys(localStorage));
      throw new Error('No auth token found');
    }

    try {
      console.log('Making request to /api/user/profile');
      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Profile response status:', response.status);

      if (!response.ok) {
        console.log('Profile request failed:', response.status, response.statusText);
        const errorData = await response.text();
        console.log('Error response:', errorData);
        throw new Error(`Invalid token: ${response.status}`);
      }

      const data = await response.json();
      console.log('Profile data received:', data);
      this.currentUser = data.user;
      
      // Store the working token key for future use
      this.tokenKey = localStorage.getItem('authToken') ? 'authToken' : 
                     localStorage.getItem('auth_token') ? 'auth_token' : 'admin_auth_token';
      
    } catch (error) {
      console.error('Auth check failed:', error);
      // Clear all possible token keys
      localStorage.removeItem('authToken');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('admin_auth_token');
      throw error;
    }
  }

  initializeUI() {
    // Get UI elements
    this.chatsList = document.getElementById('chatsList');
    this.chatDefaultState = document.getElementById('chatDefaultState');
    this.chatActiveState = document.getElementById('chatActiveState');
    this.chatMessages = document.getElementById('chatMessages');
    this.messageInput = document.getElementById('messageInput');
    this.sendButton = document.getElementById('sendMessage');
    this.contactName = document.getElementById('contactName');
    this.contactStatus = document.getElementById('contactStatus');
    this.searchInput = document.getElementById('searchInput');

    // Add event listeners
    if (this.sendButton) {
      this.sendButton.addEventListener('click', () => this.sendMessage());
    }
    
    if (this.messageInput) {
      this.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    // Search functionality
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.clearSearch();
        }
      });
    }

    // Mobile back button functionality
    const mobileBackBtn = document.getElementById('mobileBackBtn');
    if (mobileBackBtn) {
      mobileBackBtn.addEventListener('click', () => this.goBackToChatList());
    }
  }

  getAuthToken() {
    return localStorage.getItem('authToken') || 
           localStorage.getItem('auth_token') || 
           localStorage.getItem('admin_auth_token');
  }

  async loadGroups() {
    try {
      const token = this.getAuthToken();
      const response = await fetch('/api/user/chat/groups', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }

      const data = await response.json();
      this.groups = data.groups;
      
      // Load group visited times from localStorage
      this.loadGroupVisitedTimes();
      
      // Also load direct messages
      await this.loadDirectMessages();
      
      this.renderGroups();
      
      // Start auto-refresh for personal group member counts
      this.startMemberCountRefresh();
      
    } catch (error) {
      console.error('Error loading groups:', error);
      this.showError('Failed to load groups');
    }
  }

  // Load direct message conversations
  async loadDirectMessages() {
    try {
      const token = this.getAuthToken();
      const response = await fetch('/api/user/chat/direct-messages', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch direct messages');
      }

      const data = await response.json();
      this.directMessages = data.conversations;
      
    } catch (error) {
      console.error('Error loading direct messages:', error);
      // Don't show error for DMs as it's not critical
    }
  }

  // Start a direct message conversation
  async startDirectMessage(userId) {
    try {
      const token = this.getAuthToken();
      const response = await fetch('/api/user/chat/direct-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error('Failed to start conversation');
      }

      const data = await response.json();
      this.selectDirectMessage(data.conversation);
    } catch (error) {
      console.error('Error starting direct message:', error);
      this.showError('Failed to start conversation');
    }
  }

  // Select and load a direct message conversation
  async selectDirectMessage(conversation) {
    this.currentDM = conversation;
    this.currentGroup = null; // Clear group selection
    this.chatMode = 'direct';
    
    // Update UI
    document.querySelectorAll('.chat-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Show chat interface
    this.chatDefaultState.classList.add('hidden');
    this.chatActiveState.classList.remove('hidden');
    
    // Mobile navigation
    if (this.isMobileView()) {
      const sidebar = document.querySelector('.chat-sidebar');
      const main = document.querySelector('.chat-main');
      
      if (sidebar && main) {
        sidebar.classList.add('hidden-mobile');
        main.classList.add('active-mobile');
      }
    }
    
    // Update chat header
    this.contactName.textContent = conversation.other_user_name || 'Direct Message';
    this.contactStatus.textContent = 'Private Chat';
    
    // Enable input for DMs
    this.updateInputPermissions({ is_direct_message: true });
    
    // Load messages for this conversation
    await this.loadDirectMessageMessages(conversation.id);
    
    // Join socket room for real-time updates
    if (this.socket) {
      this.socket.emit('join_dm', conversation.id);
    }
  }

  // Load messages for a direct message conversation
  async loadDirectMessageMessages(conversationId, page = 1) {
    try {
      const token = this.getAuthToken();
      const response = await fetch(`/api/user/chat/direct-messages/${conversationId}/messages?page=${page}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      this.messages = data.messages;
      this.renderMessages();
      
    } catch (error) {
      console.error('Error loading DM messages:', error);
      this.showError('Failed to load messages');
    }
  }

  renderGroups() {
    if (!this.chatsList) return;

    this.chatsList.innerHTML = '';

    this.groups.forEach(group => {
      const groupElement = this.createGroupElement(group);
      this.chatsList.appendChild(groupElement);
    });
  }

  createGroupElement(group) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.dataset.groupId = group.id;
    
    const isPersonal = group.is_personal_group;
    const groupIcon = isPersonal ? 'fas fa-user-circle' : 'fas fa-users';
    const lastActivity = group.last_activity ? new Date(group.last_activity).toLocaleDateString() : 'No activity';
    
    // Show generic name for personal group on client side
    const displayName = isPersonal ? 'Main PEA Communication' : group.name;
    
    // Check if group has new messages since last visit
    const hasNewMessages = this.hasNewMessages(group);
    const newBadge = hasNewMessages ? '<span class="new-message-badge">NEW</span>' : '';
    
    const avatarUrl = this.getGroupAvatarUrl(group);
    
    div.innerHTML = `
      <div class="chat-item-avatar">
        <img src="${avatarUrl}" alt="${displayName}" class="avatar-img" onerror="this.src='/assets/uploads/user.jpg'">
      </div>
      <div class="chat-item-content">
        <div class="chat-item-header">
          <span class="chat-item-name">${displayName} ${newBadge}</span>
          <span class="chat-item-time">${lastActivity}</span>
        </div>
        <div class="chat-item-preview">
          ${group.message_count} messages${isPersonal ? ' • ' + this.getExaggeratedMemberCount() : ''}
          ${!isPersonal ? '<span class="read-only-indicator">• Read Only</span>' : ''}
        </div>
        ${isPersonal ? '<div class="personal-group-badge">✏️ Your Community - You can post here</div>' : ''}
      </div>
    `;

    div.addEventListener('click', () => this.selectGroup(group));
    
    return div;
  }

  async selectGroup(group) {
    this.currentGroup = group;
    this.currentDM = null; // Clear DM selection
    this.chatMode = 'groups';
    
    // Mark group as visited to remove "new" badge
    this.markGroupAsVisited(group.id);
    
    // Update UI
    document.querySelectorAll('.chat-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-group-id="${group.id}"]`).classList.add('active');
    
    // Show chat interface
    this.chatDefaultState.classList.add('hidden');
    this.chatActiveState.classList.remove('hidden');
    
    // Mobile navigation: Hide sidebar and show chat
    if (this.isMobileView()) {
      console.log('Mobile view detected, applying mobile navigation');
      const sidebar = document.querySelector('.chat-sidebar');
      const main = document.querySelector('.chat-main');
      
      if (sidebar && main) {
        sidebar.classList.add('hidden-mobile');
        main.classList.add('active-mobile');
        console.log('Mobile classes applied for WhatsApp-style navigation');
      }
    }
    
    // Update chat header
    const displayName = group.is_personal_group ? 'Main PEA Communication' : group.name;
    this.contactName.textContent = displayName;
    this.contactStatus.textContent = group.is_personal_group ? this.getExaggeratedMemberCount() : 'Community Group';
    
    // Update input permissions based on group type
    this.updateInputPermissions(group);
    
    // Load messages for this group
    await this.loadMessages(group.id);
    
    // Join socket room for real-time updates
    if (this.socket) {
      this.socket.emit('join_group', group.id);
    }
  }

  // Mobile navigation: go back to chat list
  goBackToChatList() {
    console.log('Going back to chat list');
    
    // Hide active chat and show default state
    if (this.chatActiveState) {
      this.chatActiveState.classList.add('hidden');
    }
    if (this.chatDefaultState) {
      this.chatDefaultState.classList.remove('hidden');
    }
    
    // Mobile-specific navigation: show sidebar and hide chat
    if (this.isMobileView()) {
      console.log('Mobile back navigation: showing sidebar, hiding chat');
      const sidebar = document.querySelector('.chat-sidebar');
      const main = document.querySelector('.chat-main');
      
      if (sidebar && main) {
        sidebar.classList.remove('hidden-mobile');
        main.classList.remove('active-mobile');
        console.log('Mobile classes removed for back navigation');
      }
    }
    
    // Clear active group
    this.currentGroup = null;
    
    // Remove active state from chat items
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    
    // Leave socket room if connected
    if (this.socket && this.currentGroup) {
      this.socket.emit('leave_group', this.currentGroup.id);
    }
  }

  async loadMessages(groupId, page = 1) {
    try {
      const token = this.getAuthToken();
      const response = await fetch(`/api/user/chat/groups/${groupId}/messages?page=${page}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      this.messages = data.messages;
      this.renderMessages();
      
    } catch (error) {
      console.error('Error loading messages:', error);
      this.showError('Failed to load messages');
    }
  }

  renderMessages() {
    if (!this.chatMessages) return;

    this.chatMessages.innerHTML = '';

    this.messages.forEach(message => {
      const messageElement = this.createMessageElement(message);
      this.chatMessages.appendChild(messageElement);
    });

    // Scroll to bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  createMessageElement(message) {
    const div = document.createElement('div');
    const isOwnMessage = message.sender_type === 'real_user' && message.sender_id === this.currentUser.id;
    
    div.className = `message ${isOwnMessage ? 'message-own' : 'message-other'}`;
    
    const timestamp = new Date(message.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    const senderInfo = isOwnMessage ? 'You' : message.sender_name;
    
    // Get avatar URL for the sender
    const avatarUrl = this.getUserAvatarUrl(message);
    
    div.innerHTML = `
      <img src="${avatarUrl}" alt="${senderInfo}" class="message-avatar ${isOwnMessage ? 'own-message' : ''}" 
           onerror="this.src='/assets/uploads/user.jpg'">
      <div class="message-content">
        <div class="message-header">
          <span class="message-sender ${isOwnMessage ? 'own-sender' : ''}">${senderInfo}</span>
          <span class="message-time">${timestamp}</span>
        </div>
        <div class="message-text">${this.escapeHtml(message.content)}</div>
      </div>
    `;
    
    return div;
  }

  // Helper method to get user avatar URL
  getUserAvatarUrl(message) {
    // Primary: Use sender_avatar field from backend query (includes avatars for both real and fake users)
    if (message.sender_avatar) {
      return message.sender_avatar;
    }
    
    // Fallback: Check if message has direct avatar_url field (legacy compatibility)
    if (message.avatar_url) {
      return message.avatar_url;
    }
    
    // Default fallback avatar - should rarely be used if backend provides sender_avatar correctly
    return '/assets/uploads/user.jpg';
  }

  // Helper method to get group/chat item avatar URL
  getGroupAvatarUrl(group) {
    // For personal groups (Main PEA Communication), always use CDOT logo for branding consistency
    if (group.is_personal_group === true) {
      return '/assets/uploads/logo.png';
    }
    
    // Primary: Use group_avatar if available (for group-specific avatars)
    if (group.group_avatar) {
      return group.group_avatar;
    }
    
    // Secondary: Use creator's avatar URL from database (for other groups)
    if (group.creator_avatar_url) {
      return group.creator_avatar_url;
    }
    
    // Default fallback based on group type
    if (group.is_personal_group === false) {
      return '/assets/uploads/community-default.jpg';
    }
    
    // Final fallback
    return '/assets/uploads/user.jpg';
  }

  async sendMessage() {
    const content = this.messageInput.value.trim();
    if (!content) return;

    try {
      const token = this.getAuthToken();
      let response;
      
      if (this.chatMode === 'direct' && this.currentDM) {
        // Send direct message
        response = await fetch(`/api/user/chat/direct-messages/${this.currentDM.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ content })
        });
      } else if (this.chatMode === 'groups' && this.currentGroup) {
        // Check if user has permission to post in this group
        if (!this.canPostInGroup(this.currentGroup)) {
          console.log('User does not have permission to post in this group');
          this.showError('You can only post messages in your personal group');
          return;
        }
        
        // Send group message
        response = await fetch(`/api/user/chat/groups/${this.currentGroup.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ content })
        });
      } else {
        this.showError('No active conversation selected');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      // Clear input
      this.messageInput.value = '';
      
      // Add message to UI immediately
      this.addMessageToUI(data.message);
      
    } catch (error) {
      console.error('Error sending message:', error);
      this.showError('Failed to send message');
    }
  }

  addMessageToUI(message) {
    const messageElement = this.createMessageElement(message);
    this.chatMessages.appendChild(messageElement);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  initializeSocket() {
    this.socket = io();
    
    // Handle group messages
    this.socket.on('new_message', (message) => {
      if (this.currentGroup && message.group_id === this.currentGroup.id && this.chatMode === 'groups') {
        // Add message to current chat
        this.addMessageToUI(message);
      } else {
        // Message in a different group - show "new" badge
        this.updateGroupNewBadge(message.group_id, true);
        
        // Update the group's last activity to current time for badge logic
        const group = this.groups.find(g => g.id === message.group_id);
        if (group) {
          group.last_activity = new Date().toISOString();
        }
      }
    });

    // Handle direct messages
    this.socket.on('new_direct_message', (message) => {
      if (this.currentDM && message.conversation_id === this.currentDM.id && this.chatMode === 'direct') {
        // Add message to current DM chat
        this.addMessageToUI(message);
      } else {
        // Message in a different DM - could update DM list here
        console.log('New DM message in other conversation:', message);
      }
    });

    this.socket.on('connect', () => {
      console.log('Connected to chat server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from chat server');
    });
  }

  showError(message) {
    // Create or update error message
    let errorDiv = document.getElementById('chatError');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'chatError';
      errorDiv.className = 'chat-error';
      document.body.appendChild(errorDiv);
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  redirectToLogin() {
    // Clean up timer before redirecting
    this.stopMemberCountRefresh();
    window.location.href = '/login.html';
  }

  // Cleanup method to be called when the app is destroyed
  destroy() {
    this.stopMemberCountRefresh();
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // Search functionality
  handleSearch(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
      this.clearSearch();
      return;
    }

    this.filterGroups(term);
  }

  filterGroups(searchTerm) {
    const groupElements = document.querySelectorAll('.chat-item');
    let hasVisibleGroups = false;

    groupElements.forEach(element => {
      const groupId = element.dataset.groupId;
      const group = this.groups.find(g => g.id == groupId);
      
      if (group) {
        const groupName = group.is_personal_group ? 'Main PEA Communication' : group.name;
        const isMatch = groupName.toLowerCase().includes(searchTerm);
        
        if (isMatch) {
          element.style.display = 'flex';
          hasVisibleGroups = true;
        } else {
          element.style.display = 'none';
        }
      }
    });

    // Show/hide "no results" message
    this.toggleNoSearchResults(!hasVisibleGroups, searchTerm);
  }

  clearSearch() {
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    
    // Show all groups
    const groupElements = document.querySelectorAll('.chat-item');
    groupElements.forEach(element => {
      element.style.display = 'flex';
    });

    // Hide "no results" message
    this.toggleNoSearchResults(false);
  }

  toggleNoSearchResults(show, searchTerm = '') {
    let noResultsDiv = document.getElementById('noSearchResults');
    
    if (show && !noResultsDiv) {
      // Create "no results" message
      noResultsDiv = document.createElement('div');
      noResultsDiv.id = 'noSearchResults';
      noResultsDiv.className = 'no-search-results';
      noResultsDiv.innerHTML = `
        <div class="no-results-content">
          <i class="fas fa-search"></i>
          <p>No chats found for "${this.escapeHtml(searchTerm)}"</p>
          <small>Try searching with different keywords</small>
        </div>
      `;
      this.chatsList.appendChild(noResultsDiv);
    } else if (!show && noResultsDiv) {
      // Remove "no results" message
      noResultsDiv.remove();
    }
  }
}

// Initialize the chat app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if the main chat.js has already initialized
  // to prevent conflicts between the two chat implementations
  if (window.chatAppInitialized) {
    console.log('Main chat app already initialized, skipping user-chat.js initialization');
    return;
  }
  
  // Mark that we're initializing to prevent conflicts
  window.userChatAppInitialized = true;
  const chatApp = new UserChatApp();
  
  // Store reference globally for cleanup
  window.userChatApp = chatApp;
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (window.userChatApp) {
      window.userChatApp.destroy();
    }
  });
});
