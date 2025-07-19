/**
 * User Chat Interface
 * Handles the user-facing chat functionality
 */

class UserChatApp {
  constructor() {
    this.currentUser = null;
    this.currentGroup = null;
    this.groups = [];
    this.messages = [];
    this.socket = null;
    
    this.init();
  }

  // Helper method to detect mobile view
  isMobileView() {
    return window.innerWidth <= 768;
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

    // Mobile back button functionality
    const mobileBackBtn = document.getElementById('mobileBackBtn');
    if (mobileBackBtn) {
      mobileBackBtn.addEventListener('click', () => this.goBackToChatList());
    }

    // Tab functionality
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        if (e.target.textContent === 'Groups') {
          this.showGroups();
        } else if (e.target.textContent === 'Recent') {
          this.showRecentChats();
        }
      });
    });

    // Set default tab
    document.querySelector('.tab').classList.add('active');
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
      this.renderGroups();
      
    } catch (error) {
      console.error('Error loading groups:', error);
      this.showError('Failed to load groups');
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
    
    div.innerHTML = `
      <div class="chat-item-avatar">
        <i class="${groupIcon} fa-2x" style="color: ${isPersonal ? '#007bff' : '#28a745'};"></i>
      </div>
      <div class="chat-item-content">
        <div class="chat-item-header">
          <span class="chat-item-name">${group.name}</span>
          <span class="chat-item-time">${lastActivity}</span>
        </div>
        <div class="chat-item-preview">
          ${group.message_count} messages • ${group.member_count} members
        </div>
        ${isPersonal ? '<div class="personal-group-badge">Your Community</div>' : ''}
      </div>
    `;

    div.addEventListener('click', () => this.selectGroup(group));
    
    return div;
  }

  async selectGroup(group) {
    this.currentGroup = group;
    
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
    this.contactName.textContent = group.name;
    this.contactStatus.textContent = `${group.member_count} members`;
    
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
    const userTypeIcon = message.sender_type === 'fake_user' ? '<i class="fas fa-robot" title="AI Assistant"></i>' : '';
    
    div.innerHTML = `
      <div class="message-content">
        <div class="message-header">
          <span class="message-sender">${userTypeIcon} ${senderInfo}</span>
          <span class="message-time">${timestamp}</span>
        </div>
        <div class="message-text">${this.escapeHtml(message.content)}</div>
      </div>
    `;
    
    return div;
  }

  async sendMessage() {
    if (!this.currentGroup || !this.messageInput) return;
    
    const content = this.messageInput.value.trim();
    if (!content) return;

    try {
      const token = this.getAuthToken();
      const response = await fetch(`/api/user/chat/groups/${this.currentGroup.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });

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
    
    this.socket.on('new_message', (message) => {
      if (this.currentGroup && message.group_id === this.currentGroup.id) {
        this.addMessageToUI(message);
      }
    });

    this.socket.on('connect', () => {
      console.log('Connected to chat server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from chat server');
    });
  }

  showGroups() {
    this.renderGroups();
  }

  showRecentChats() {
    // TODO: Implement recent chats view
    this.chatsList.innerHTML = '<div class="no-chats">Recent chats coming soon...</div>';
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
    window.location.href = '/login.html';
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
  new UserChatApp();
});
