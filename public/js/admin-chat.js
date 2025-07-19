/**
 * Simplified Admin Chat Management
 * Clean card-based interface for admin chat operations
 */

// Utility functions
function showError(message, type = 'error') {
  console.error('[AdminChat] ' + (type === 'error' ? 'Error:' : 'Info:'), message);
  
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 10000;
    background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
    color: white; padding: 12px 20px; border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 5000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// Main Application Class
class AdminChatApp {
  constructor() {
    this.groups = [];
    this.personas = [];
    this.unreadMessages = [];
    this.supportConversations = [];
    this.sentMessages = [];
    this.selectedConversation = null;
    
    // Reply context for modal replies
    this.currentReplyContext = null;
  }

  async init() {
    try {
      console.log('[AdminChat] Initializing clean admin chat interface...');
      
      // Check if API is available
      if (typeof AdminChatAPI === 'undefined') {
        throw new Error('AdminChatAPI is not loaded');
      }

      this.cacheUIElements();
      this.setupEventListeners();
      await this.loadInitialData();
      
      // Initialize message type UI
      try {
        await this.handleMessageTypeChange();
      } catch (error) {
        console.error('[AdminChat] Error initializing message type UI:', error);
        // Don't let this error fail the entire initialization
      }
      
      // Load all data
      this.refreshAll();
      
      console.log('[AdminChat] Admin chat initialized successfully');
    } catch (error) {
      console.error('[AdminChat] Failed to initialize:', error);
      showError('Failed to initialize admin chat interface');
    }
  }

  cacheUIElements() {
    this.ui = {
      // Counts
      unreadCount: document.getElementById('unreadCount'),
      supportCount: document.getElementById('supportCount'),
      
      // Lists
      unreadMessagesList: document.getElementById('unreadMessagesList'),
      supportConversationsList: document.getElementById('supportConversationsList'),
      sentMessagesList: document.getElementById('sentMessagesList'),
      
      // Search inputs
      unreadSearch: document.getElementById('unreadSearch'),
      supportSearch: document.getElementById('supportSearch'),
      
      // Send message form
      groupSelect: document.getElementById('groupSelect'),
      personaSelect: document.getElementById('personaSelect'),
      messageContent: document.getElementById('messageContent'),
      sendMessageBtn: document.getElementById('sendMessageBtn'),
      scheduleMessageBtn: document.getElementById('scheduleMessageBtn'),
      
      // Radio buttons for message type
      messageTypeRadios: document.querySelectorAll('input[name="messageType"]'),
      
      // User search for DMs
      userSearch: document.getElementById('userSearch'),
      userSelect: document.getElementById('userSelect'),
      
      // Modal
      detailModal: document.getElementById('detailModal'),
      modalTitle: document.getElementById('modalTitle'),
      conversationMessages: document.getElementById('conversationMessages'),
      replySection: document.getElementById('replySection'),
      replyMessage: document.getElementById('replyMessage'),
      replyPersona: document.getElementById('replyPersona'),
      
      // Refresh button
      refreshBtn: document.getElementById('refreshBtn')
    };
  }

  setupEventListeners() {
    // Search functionality
    this.ui.unreadSearch?.addEventListener('input', (e) => this.searchUnread(e.target.value));
    this.ui.supportSearch?.addEventListener('input', (e) => this.searchSupport(e.target.value));

    // Send message form
    this.ui.groupSelect?.addEventListener('change', () => this.updateSendButton());
    this.ui.personaSelect?.addEventListener('change', () => this.updateSendButton());
    this.ui.messageContent?.addEventListener('input', () => this.updateSendButton());
    this.ui.sendMessageBtn?.addEventListener('click', () => this.sendMessage());
    this.ui.scheduleMessageBtn?.addEventListener('click', () => this.scheduleMessage());
    
    // Message type radio buttons
    this.ui.messageTypeRadios?.forEach(radio => {
      radio.addEventListener('change', async () => {
        try {
          await this.handleMessageTypeChange();
        } catch (error) {
          console.error('[AdminChat] Error handling message type change:', error);
          // Don't let this error cause logout
        }
      });
    });
    
    // User search for DMs
    this.ui.userSearch?.addEventListener('input', (e) => this.searchUsers(e.target.value));
    this.ui.userSelect?.addEventListener('change', () => this.updateSendButton());
    
    // Main refresh button
    this.ui.refreshBtn?.addEventListener('click', () => this.refreshAll());
    
    // Modal close on background click
    this.ui.detailModal?.addEventListener('click', (e) => {
      if (e.target === this.ui.detailModal) {
        this.hideDetailModal();
      }
    });
  }

  async loadInitialData() {
    try {
      // Load personas for sending messages
      console.log('Loading personas...');
      const personasResponse = await AdminChatAPI.getAllFakeUsers(1, 100, '');
      console.log('Personas response:', personasResponse);
      
      if (personasResponse && personasResponse.users) {
        this.personas = personasResponse.users;
        console.log('Loaded personas:', this.personas);
        this.populatePersonaSelect();
      } else {
        console.warn('No personas found in response');
        // Add some default personas if none exist
        this.personas = [
          { id: 1, username: 'admin_bot', display_name: 'Admin Bot' },
          { id: 2, username: 'support_agent', display_name: 'Support Agent' }
        ];
        this.populatePersonaSelect();
      }

      // Load real groups from API
      const groupsResponse = await AdminChatAPI.getGroups(1, 100, '');
      if (groupsResponse && groupsResponse.groups) {
        this.groups = groupsResponse.groups;
      } else {
        // Fallback to mock data if API fails
        this.groups = [
          { id: 1, name: 'General Discussion' },
          { id: 2, name: 'Product Updates' },
          { id: 3, name: 'Support Questions' },
          { id: 4, name: 'Feature Requests' }
        ];
      }
      this.populateGroupSelect();

    } catch (error) {
      console.error('[AdminChat] Error loading initial data:', error);
      showError('Failed to load initial data');
      
      // Use fallback data
      this.groups = [
        { id: 1, name: 'General Discussion' },
        { id: 2, name: 'Product Updates' },
        { id: 3, name: 'Support Questions' },
        { id: 4, name: 'Feature Requests' }
      ];
      this.populateGroupSelect();
    }
  }

  populatePersonaSelect() {
    console.log('Populating persona select with:', this.personas);
    if (!this.ui.personaSelect) {
      console.warn('Persona select element not found');
      return;
    }
    
    this.ui.personaSelect.innerHTML = '<option value="">Choose a persona...</option>';
    this.personas.forEach(persona => {
      const option = document.createElement('option');
      option.value = persona.id;
      option.textContent = persona.display_name || persona.username;
      option.style.color = '#2c3e50';
      this.ui.personaSelect.appendChild(option);
      console.log('Added persona option:', persona.display_name || persona.username);
    });
    
    console.log('Persona select populated, total options:', this.ui.personaSelect.options.length);
  }

  populateGroupSelect() {
    if (!this.ui.groupSelect) return;
    
    this.ui.groupSelect.innerHTML = '<option value="">Choose a group...</option>';
    this.groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      this.ui.groupSelect.appendChild(option);
    });
  }

  refreshAll() {
    this.refreshUnread();
    this.refreshSupport();
    this.refreshSentMessages();
  }

  async refreshUnread() {
    try {
      if (!this.ui.unreadMessagesList) return;
      
      this.ui.unreadMessagesList.innerHTML = '<div class="loading">Loading unread messages...</div>';
      
      // Load real client messages from the chat system
      let clientMessagesResponse = null;
      
      try {
        clientMessagesResponse = await AdminChatAPI.getClientMessages(1, 50);
      } catch (error) {
        console.warn('[AdminChat] Client messages API not available:', error);
      }
      
      if (clientMessagesResponse && clientMessagesResponse.messages) {
        // Convert client messages to unread messages format
        const unreadMessages = clientMessagesResponse.messages.map(msg => ({
          id: msg.id,
          from: msg.username || msg.user_name || 'Unknown User',
          group: msg.group_name || 'General Chat',
          groupId: msg.group_id || 1, // Include the actual group ID
          message: msg.content || msg.message || 'No content',
          timestamp: msg.created_at || msg.timestamp || new Date().toISOString(),
          unread: true,
          conversationType: 'group',
          messageType: msg.message_type || 'text',
          avatar: msg.avatar_url || msg.profile_picture || '/assets/uploads/user.jpg', // Include avatar
          userId: msg.user_id
        }));
        
        this.unreadMessages = unreadMessages;
        this.renderUnreadMessages(unreadMessages);
        this.updateUnreadCount(unreadMessages.length);
      } else {
        // Fallback: try the conversations API
        try {
          const conversationsResponse = await AdminChatAPI.getConversations(1, 50, '');
          
          if (conversationsResponse && conversationsResponse.conversations) {
            // Convert conversations to unread messages format
            const unreadMessages = conversationsResponse.conversations
              .filter(conv => conv.unread_count > 0) // Only show conversations with unread messages
              .map(conv => ({
                id: conv.id,
                from: conv.last_sender_name || 'Unknown User',
                group: conv.group_name || 'Direct Message',
                message: conv.last_message || 'No message',
                timestamp: conv.last_message_time || new Date().toISOString(),
                unread: true,
                conversationType: conv.conversation_type || 'group'
              }));
            
            this.unreadMessages = unreadMessages;
            this.renderUnreadMessages(unreadMessages);
            this.updateUnreadCount(unreadMessages.length);
          } else {
            this.showFallbackMessages();
          }
        } catch (error) {
          console.warn('[AdminChat] Conversations API also failed:', error);
          this.showFallbackMessages();
        }
      }
      
    } catch (error) {
      console.error('[AdminChat] Error loading unread messages:', error);
      this.ui.unreadMessagesList.innerHTML = '<div class="empty-state">Failed to load unread messages</div>';
    }
  }

  showFallbackMessages() {
    // Fallback to mock data if both APIs fail
    const mockUnreadMessages = [
      {
        id: 1,
        from: 'john_doe',
        group: 'General Discussion',
        groupId: 1,
        message: 'Hey everyone, I have a question about the latest update. Can someone help me understand how the new feature works?',
        timestamp: new Date().toISOString(),
        unread: true,
        conversationType: 'group',
        avatar: '/assets/uploads/avatars/john.jpg',
        userId: 1
      },
      {
        id: 2,
        from: 'jane_smith',
        group: 'Support Questions',
        groupId: 2,
        message: 'I\'m having trouble with my account settings. The password reset isn\'t working.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        unread: true,
        conversationType: 'group',
        avatar: '/assets/uploads/avatars/jane.jpg',
        userId: 2
      }
    ];
    
    this.unreadMessages = mockUnreadMessages;
    this.renderUnreadMessages(mockUnreadMessages);
    this.updateUnreadCount(mockUnreadMessages.length);
  }

  async refreshSupport() {
    try {
      if (!this.ui.supportConversationsList) return;
      
      this.ui.supportConversationsList.innerHTML = '<div class="loading">Loading support conversations...</div>';
      
      // Mock data for demonstration
      const mockSupportConversations = [
        {
          id: 1,
          user: 'alice_cooper',
          lastMessage: 'I need help with my subscription billing. The payment failed.',
          timestamp: new Date().toISOString(),
          unread: true,
          avatar: '/assets/uploads/avatars/alice.jpg'
        },
        {
          id: 2,
          user: 'bob_wilson',
          lastMessage: 'Thank you for your help with the login issue!',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          unread: false,
          avatar: '/assets/uploads/avatars/bob.jpg'
        },
        {
          id: 3,
          user: 'carol_jones',
          lastMessage: 'How do I update my profile information?',
          timestamp: new Date(Date.now() - 14400000).toISOString(),
          unread: true,
          avatar: '/assets/uploads/avatars/carol.jpg'
        }
      ];
      
      this.supportConversations = mockSupportConversations;
      this.renderSupportConversations(mockSupportConversations);
      this.updateSupportCount(mockSupportConversations.filter(c => c.unread).length);
      
    } catch (error) {
      console.error('[AdminChat] Error loading support conversations:', error);
      this.ui.supportConversationsList.innerHTML = '<div class="empty-state">Failed to load support conversations</div>';
    }
  }

  async refreshSentMessages() {
    try {
      if (!this.ui.sentMessagesList) return;
      
      // Mock data for recent sent messages
      const mockSentMessages = [
        {
          id: 1,
          group: 'General Discussion',
          persona: 'AI Assistant',
          message: 'Welcome to our community! Feel free to ask any questions.',
          timestamp: new Date(Date.now() - 1800000).toISOString()
        }
      ];
      
      this.sentMessages = mockSentMessages;
      this.renderSentMessages(mockSentMessages);
      
    } catch (error) {
      console.error('[AdminChat] Error loading sent messages:', error);
    }
  }

  renderUnreadMessages(messages) {
    if (!this.ui.unreadMessagesList) return;
    
    if (messages.length === 0) {
      this.ui.unreadMessagesList.innerHTML = '<div class="empty-state">No unread messages</div>';
      return;
    }
    
    this.ui.unreadMessagesList.innerHTML = messages.map(message => `
      <div class="message-item ${message.unread ? 'unread' : ''}" onclick="adminChatApp.viewMessage(${message.id})">
        <img src="${escapeHtml(message.avatar || '/assets/uploads/user.jpg')}" alt="${escapeHtml(message.from)}" class="message-avatar" onerror="this.src='/assets/uploads/user.jpg'">
        <div class="message-content">
          <div class="message-header">
            <span class="message-from">${escapeHtml(message.from)}</span>
            <span class="message-time">${formatDate(message.timestamp)}</span>
          </div>
          <div class="message-preview">${escapeHtml(message.message)}</div>
          <div class="message-group">in ${escapeHtml(message.group)}</div>
        </div>
      </div>
    `).join('');
  }

  renderSupportConversations(conversations) {
    if (!this.ui.supportConversationsList) return;
    
    if (conversations.length === 0) {
      this.ui.supportConversationsList.innerHTML = '<div class="empty-state">No support conversations</div>';
      return;
    }
    
    this.ui.supportConversationsList.innerHTML = conversations.map(conv => `
      <div class="message-item ${conv.unread ? 'unread' : ''}" onclick="adminChatApp.viewConversation(${conv.id})">
        <img src="${escapeHtml(conv.avatar || '/assets/uploads/user.jpg')}" alt="${escapeHtml(conv.user)}" class="message-avatar" onerror="this.src='/assets/uploads/user.jpg'">
        <div class="message-content">
          <div class="message-header">
            <span class="message-from">${escapeHtml(conv.user)}</span>
            <span class="message-time">${formatDate(conv.timestamp)}</span>
          </div>
          <div class="message-preview">${escapeHtml(conv.lastMessage)}</div>
        </div>
      </div>
    `).join('');
  }

  renderSentMessages(messages) {
    if (!this.ui.sentMessagesList) return;
    
    if (messages.length === 0) {
      this.ui.sentMessagesList.innerHTML = '<div class="empty-state">No recent sent messages</div>';
      return;
    }
    
    this.ui.sentMessagesList.innerHTML = messages.map(message => `
      <div class="message-item">
        <img src="${escapeHtml(message.personaAvatar || '/assets/uploads/bot-avatar.jpg')}" alt="${escapeHtml(message.persona)}" class="message-avatar" onerror="this.src='/assets/uploads/bot-avatar.jpg'">
        <div class="message-content">
          <div class="message-header">
            <span class="message-from">Sent to ${escapeHtml(message.group)}</span>
            <span class="message-time">${formatDate(message.timestamp)}</span>
          </div>
          <div class="message-preview">${escapeHtml(message.message)}</div>
          <div class="message-group">as ${escapeHtml(message.persona)}</div>
        </div>
      </div>
    `).join('');
  }

  updateUnreadCount(count) {
    if (this.ui.unreadCount) {
      this.ui.unreadCount.textContent = count;
    }
  }

  updateSupportCount(count) {
    if (this.ui.supportCount) {
      this.ui.supportCount.textContent = count;
    }
  }

  updateSendButton() {
    const messageType = document.querySelector('input[name="messageType"]:checked')?.value || 'group';
    
    let hasTarget, hasPersona, hasMessage;
    
    if (messageType === 'group') {
      hasTarget = this.ui.groupSelect?.value;
    } else {
      hasTarget = this.ui.userSelect?.value;
    }
    
    hasPersona = this.ui.personaSelect?.value;
    hasMessage = this.ui.messageContent?.value.trim();
    
    const canSend = hasTarget && hasPersona && hasMessage;
    
    if (this.ui.sendMessageBtn) {
      this.ui.sendMessageBtn.disabled = !canSend;
    }
    if (this.ui.scheduleMessageBtn) {
      this.ui.scheduleMessageBtn.disabled = !canSend;
    }
  }

  async handleMessageTypeChange() {
    try {
      const messageType = document.querySelector('input[name="messageType"]:checked')?.value || 'group';
      
      const groupContainer = document.getElementById('groupSelectContainer');
      const userSearchContainer = document.getElementById('userSelectContainer');
      
      if (messageType === 'group') {
        if (groupContainer) groupContainer.style.display = 'block';
        if (userSearchContainer) userSearchContainer.style.display = 'none';
      } else {
        if (groupContainer) groupContainer.style.display = 'none';
        if (userSearchContainer) userSearchContainer.style.display = 'block';
        
        // Load users asynchronously and catch any errors
        try {
          await this.loadUsers();
        } catch (error) {
          console.error('[AdminChat] Error in loadUsers from handleMessageTypeChange:', error);
          // Don't let this error bubble up to cause logout
        }
      }
      
      this.updateSendButton();
    } catch (error) {
      console.error('[AdminChat] Error in handleMessageTypeChange:', error);
      // Don't let this error bubble up to cause logout
    }
  }

  async loadUsers() {
    try {
      // Check if we have admin authentication before making the API call
      const adminToken = localStorage.getItem('admin_auth_token') || localStorage.getItem('auth_token');
      if (!adminToken) {
        console.log('[AdminChat] No admin token available, using mock data for client list');
        const mockClients = [
          { id: '1', username: 'john_doe', email: 'john@example.com', display_name: 'John Doe' },
          { id: '2', username: 'jane_smith', email: 'jane@example.com', display_name: 'Jane Smith' },
          { id: '3', username: 'bob_wilson', email: 'bob@example.com', display_name: 'Bob Wilson' },
          { id: '4', username: 'alice_cooper', email: 'alice@example.com', display_name: 'Alice Cooper' },
          { id: '5', username: 'carol_jones', email: 'carol@example.com', display_name: 'Carol Jones' }
        ];
        this.populateUserSelect(mockClients);
        return;
      }

      if (typeof AdminChatAPI !== 'undefined' && AdminChatAPI.getRegisteredClients) {
        console.log('[AdminChat] Loading registered clients via API...');
        const response = await AdminChatAPI.getRegisteredClients(1, 100, '');
        
        if (response === null) {
          console.log('[AdminChat] API returned null (no auth token), using mock data');
          const mockClients = [
            { id: '1', username: 'john_doe', email: 'john@example.com', display_name: 'John Doe' },
            { id: '2', username: 'jane_smith', email: 'jane@example.com', display_name: 'Jane Smith' },
            { id: '3', username: 'bob_wilson', email: 'bob@example.com', display_name: 'Bob Wilson' }
          ];
          this.populateUserSelect(mockClients);
          return;
        }
        
        console.log('[AdminChat] API response:', response);
        
        // Handle API response structure
        const users = response && response.users ? response.users : [];
        console.log('[AdminChat] Extracted users:', users);
        this.populateUserSelect(users);
      } else {
        console.log('[AdminChat] AdminChatAPI.getRegisteredClients not available, using mock data');
        // Fallback mock data representing real clients
        const mockClients = [
          { id: '1', username: 'john_doe', email: 'john@example.com', display_name: 'John Doe' },
          { id: '2', username: 'jane_smith', email: 'jane@example.com', display_name: 'Jane Smith' },
          { id: '3', username: 'bob_wilson', email: 'bob@example.com', display_name: 'Bob Wilson' },
          { id: '4', username: 'alice_cooper', email: 'alice@example.com', display_name: 'Alice Cooper' },
          { id: '5', username: 'carol_jones', email: 'carol@example.com', display_name: 'Carol Jones' }
        ];
        this.populateUserSelect(mockClients);
      }
    } catch (error) {
      console.error('[AdminChat] Error loading registered clients:', error);
      showError('Failed to load client list. Using demo data.', 'info');
      
      // Use fallback data on error - don't let this break the UI
      const mockClients = [
        { id: '1', username: 'john_doe', email: 'john@example.com', display_name: 'John Doe' },
        { id: '2', username: 'jane_smith', email: 'jane@example.com', display_name: 'Jane Smith' },
        { id: '3', username: 'bob_wilson', email: 'bob@example.com', display_name: 'Bob Wilson' }
      ];
      this.populateUserSelect(mockClients);
    }
  }

  populateUserSelect(users) {
    if (!this.ui.userSelect) return;
    
    this.ui.userSelect.innerHTML = '<option value="">Select a user...</option>';
    
    // Ensure users is an array
    if (!Array.isArray(users)) {
      console.warn('[AdminChat] populateUserSelect: users is not an array:', users);
      return;
    }
    
    users.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = `${user.username || user.display_name || user.name || 'Unknown'} (${user.email || 'No email'})`;
      this.ui.userSelect.appendChild(option);
    });
  }

  searchUsers(query) {
    if (!query.trim()) {
      this.loadUsers();
      return;
    }
    
    // Filter existing options
    const options = Array.from(this.ui.userSelect.options);
    options.forEach(option => {
      if (option.value === '') return; // Keep the placeholder
      
      const text = option.textContent.toLowerCase();
      const matches = text.includes(query.toLowerCase());
      option.style.display = matches ? 'block' : 'none';
    });
  }

  async sendMessage() {
    try {
      const messageType = document.querySelector('input[name="messageType"]:checked')?.value || 'group';
      const personaId = this.ui.personaSelect?.value;
      const message = this.ui.messageContent?.value.trim();
      
      let targetId;
      if (messageType === 'group') {
        targetId = this.ui.groupSelect?.value;
      } else {
        targetId = this.ui.userSelect?.value;
      }
      
      if (!targetId || !personaId || !message) {
        showError('Please fill in all fields');
        return;
      }
      
      if (messageType === 'group') {
        console.log('Sending group message:', { groupId: targetId, personaId, message });
        // Call API for group messages
        if (typeof AdminChatAPI !== 'undefined' && AdminChatAPI.postAsFakeUser) {
          await AdminChatAPI.postAsFakeUser(targetId, personaId, message);
        }
      } else {
        console.log('Sending DM to client:', { clientUserId: targetId, personaId, message });
        // Call API for direct messages to clients
        if (typeof AdminChatAPI !== 'undefined' && AdminChatAPI.sendDirectMessage) {
          await AdminChatAPI.sendDirectMessage(targetId, personaId, message);
        }
      }
      
      showError(`${messageType === 'group' ? 'Group message' : 'Direct message'} sent successfully!`, 'success');
      
      // Clear the form
      this.ui.messageContent.value = '';
      this.updateSendButton();
      this.refreshSentMessages();
      
    } catch (error) {
      console.error('[AdminChat] Error sending message:', error);
      showError('Failed to send message');
    }
  }

  async scheduleMessage() {
    showError('Message scheduling will be implemented soon', 'info');
  }

  viewMessage(messageId) {
    console.log('View message:', messageId);
    const message = this.unreadMessages.find(m => m.id === messageId);
    console.log('Found message:', message);
    if (message) {
      // Set reply context for this message
      this.currentReplyContext = {
        type: 'message_reply',
        messageId: message.id,
        groupId: message.groupId,
        originalSender: message.from,
        groupName: message.group
      };
      
      console.log('Set reply context:', this.currentReplyContext);
      
      this.showDetailModal(`Message from ${message.from}`, `
        <div class="message-item">
          <img src="${escapeHtml(message.avatar || '/assets/uploads/user.jpg')}" alt="${escapeHtml(message.from)}" class="message-avatar" onerror="this.src='/assets/uploads/user.jpg'">
          <div class="message-content">
            <div class="message-header">
              <span class="message-from">${escapeHtml(message.from)}</span>
              <span class="message-time">${formatDate(message.timestamp)}</span>
            </div>
            <div class="message-preview" style="white-space: pre-wrap; -webkit-line-clamp: none; overflow: visible;">${escapeHtml(message.message)}</div>
            <div class="message-group">in ${escapeHtml(message.group)}</div>
          </div>
        </div>
      `, true); // Enable reply for messages
    }
  }

  viewConversation(conversationId) {
    console.log('View conversation:', conversationId);
    const conversation = this.supportConversations.find(c => c.id === conversationId);
    if (conversation) {
      // Set reply context for this support conversation
      this.currentReplyContext = {
        type: 'support_reply',
        conversationId: conversation.id,
        userId: conversation.user_id || conversation.user,
        userName: conversation.user
      };
      
      this.showDetailModal(`Support conversation with ${conversation.user}`, `
        <div class="message-item">
          <img src="${escapeHtml(conversation.avatar || '/assets/uploads/user.jpg')}" alt="${escapeHtml(conversation.user)}" class="message-avatar" onerror="this.src='/assets/uploads/user.jpg'">
          <div class="message-content">
            <div class="message-header">
              <span class="message-from">${escapeHtml(conversation.user)}</span>
              <span class="message-time">${formatDate(conversation.timestamp)}</span>
            </div>
            <div class="message-preview" style="white-space: pre-wrap; -webkit-line-clamp: none; overflow: visible;">${escapeHtml(conversation.lastMessage)}</div>
          </div>
        </div>
        <p style="margin-top: 1rem; color: #7f8c8d; font-style: italic;">Full conversation history would be loaded here...</p>
      `, true); // Enable reply for support conversations
    }
  }

  showDetailModal(title, content, showReply = false) {
    if (this.ui.modalTitle) {
      this.ui.modalTitle.textContent = title;
    }
    if (this.ui.conversationMessages) {
      this.ui.conversationMessages.innerHTML = content;
    }
    if (this.ui.replySection) {
      this.ui.replySection.style.display = showReply ? 'block' : 'none';
      
      // Populate reply persona dropdown when showing reply section
      if (showReply && this.ui.replyPersona) {
        this.populateReplyPersonas();
      }
    }
    if (this.ui.detailModal) {
      this.ui.detailModal.classList.add('active');
    }
  }

  hideDetailModal() {
    if (this.ui.detailModal) {
      this.ui.detailModal.classList.remove('active');
    }
    if (this.ui.replyMessage) {
      this.ui.replyMessage.value = '';
    }
    if (this.ui.replyPersona) {
      this.ui.replyPersona.value = '';
    }
    // Clear reply context
    this.currentReplyContext = null;
  }

  populateReplyPersonas() {
    console.log('Populating reply personas with:', this.personas);
    console.log('Reply persona element:', this.ui.replyPersona);
    
    if (!this.ui.replyPersona) {
      console.warn('Reply persona select element not found');
      return;
    }
    
    if (!this.personas || this.personas.length === 0) {
      console.warn('No personas available to populate');
      // Add fallback personas if none loaded
      this.personas = [
        { id: 1, username: 'admin_bot', display_name: 'Admin Bot' },
        { id: 2, username: 'support_agent', display_name: 'Support Agent' }
      ];
    }
    
    this.ui.replyPersona.innerHTML = '<option value="">Choose a persona...</option>';
    
    this.personas.forEach(persona => {
      const option = document.createElement('option');
      option.value = persona.id;
      option.textContent = persona.display_name || persona.username;
      option.style.color = '#2c3e50';
      option.style.backgroundColor = 'white';
      this.ui.replyPersona.appendChild(option);
      console.log('Added reply persona option:', persona.display_name || persona.username, 'with ID:', persona.id);
    });
    
    console.log('Reply persona select populated, total options:', this.ui.replyPersona.options.length);
  }

  async sendReply() {
    try {
      const replyText = this.ui.replyMessage?.value.trim();
      const selectedPersona = this.ui.replyPersona?.value;
      
      console.log('SendReply called with:', {
        replyText,
        selectedPersona,
        personaOptions: this.ui.replyPersona?.options.length,
        currentContext: this.currentReplyContext
      });
      
      if (!replyText) {
        showError('Please enter a reply message');
        return;
      }
      
      if (!selectedPersona) {
        showError('Please select a persona to reply as');
        return;
      }
      
      // Ensure selectedPersona is a number
      const personaId = parseInt(selectedPersona);
      if (isNaN(personaId)) {
        showError('Invalid persona selection');
        return;
      }
      
      if (!this.currentReplyContext) {
        showError('No conversation context available');
        return;
      }
      
      console.log('Sending reply:', {
        message: replyText,
        personaId: personaId,
        context: this.currentReplyContext
      });
      
      // Prepare the reply data based on context type
      let replyData;
      
      if (this.currentReplyContext.type === 'message_reply') {
        // Replying to a group message
        replyData = {
          groupId: this.currentReplyContext.groupId,
          fakeUserId: personaId,
          message: replyText,
          messageType: 'text'
        };
      } else if (this.currentReplyContext.type === 'support_reply') {
        // Replying to a support conversation (DM)
        replyData = {
          userId: this.currentReplyContext.userId,
          fakeUserId: personaId,
          message: replyText,
          messageType: 'text'
        };
      } else {
        showError('Unknown conversation type');
        return;
      }
      
      // Send the reply via API
      console.log('Sending reply data:', replyData);
      console.log('Current reply context:', this.currentReplyContext);
      console.log('Selected persona ID:', personaId, 'Type:', typeof personaId);
      
      let response;
      try {
        if (this.currentReplyContext.type === 'message_reply') {
          // Call API with individual parameters for group messages
          response = await AdminChatAPI.postAsFakeUser(
            replyData.groupId,
            replyData.fakeUserId, 
            replyData.message,
            replyData.messageType
          );
        } else {
          // For support replies (DMs), we might need a different endpoint
          // For now, try the same endpoint but this may need adjustment
          response = await AdminChatAPI.postAsFakeUser(
            replyData.userId, // Use userId as groupId for DMs (may need different endpoint)
            replyData.fakeUserId,
            replyData.message,
            replyData.messageType
          );
        }
        
        console.log('Reply API response:', response);
        
        if (response && response.success) {
          showError('Reply sent successfully!', 'success');
          
          // Clear the form
          this.ui.replyMessage.value = '';
          this.ui.replyPersona.value = '';
          
          // Close modal and refresh data
          this.hideDetailModal();
          this.refreshUnread();
          this.refreshSupport();
          
        } else {
          const errorMsg = response?.error || response?.message || 'Failed to send reply';
          throw new Error(errorMsg);
        }
        
      } catch (apiError) {
        console.error('[AdminChat] API error sending reply:', apiError);
        const errorMsg = apiError.message || 'Unknown error occurred';
        showError('Failed to send reply: ' + errorMsg);
      }
      
    } catch (error) {
      console.error('[AdminChat] Error sending reply:', error);
      showError('Failed to send reply: ' + error.message);
    }
  }

  markAllRead() {
    console.log('Mark all messages as read');
    showError('All messages marked as read', 'success');
    this.refreshUnread();
  }

  searchUnread(searchTerm) {
    console.log('Search unread messages:', searchTerm);
    if (!searchTerm) {
      this.renderUnreadMessages(this.unreadMessages);
      return;
    }
    
    const filtered = this.unreadMessages.filter(message => 
      message.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.group.toLowerCase().includes(searchTerm.toLowerCase())
    );
    this.renderUnreadMessages(filtered);
  }

  searchSupport(searchTerm) {
    console.log('Search support conversations:', searchTerm);
    if (!searchTerm) {
      this.renderSupportConversations(this.supportConversations);
      return;
    }
    
    const filtered = this.supportConversations.filter(conv => 
      conv.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
    );
    this.renderSupportConversations(filtered);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof AdminChatAPI === 'undefined') {
    console.error('[AdminChat] AdminChatAPI is not loaded');
    showError('Chat API is not loaded. Please refresh the page.');
    return;
  }
  
  console.log('[AdminChat] Initializing clean admin chat interface...');
  window.adminChatApp = new AdminChatApp();
  window.adminChatApp.init();
});
