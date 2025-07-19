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
      
      // Modal
      detailModal: document.getElementById('detailModal'),
      modalTitle: document.getElementById('modalTitle'),
      conversationMessages: document.getElementById('conversationMessages'),
      replySection: document.getElementById('replySection'),
      replyMessage: document.getElementById('replyMessage'),
      
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
      const personasResponse = await AdminChatAPI.getAllFakeUsers(1, 100, '');
      if (personasResponse && personasResponse.users) {
        this.personas = personasResponse.users;
        this.populatePersonaSelect();
      }

      // Load groups (placeholder for now)
      this.groups = [
        { id: 1, name: 'General Discussion' },
        { id: 2, name: 'Product Updates' },
        { id: 3, name: 'Support Questions' },
        { id: 4, name: 'Feature Requests' }
      ];
      this.populateGroupSelect();

    } catch (error) {
      console.error('[AdminChat] Error loading initial data:', error);
      showError('Failed to load initial data');
    }
  }

  populatePersonaSelect() {
    if (!this.ui.personaSelect) return;
    
    this.ui.personaSelect.innerHTML = '<option value="">Choose a persona...</option>';
    this.personas.forEach(persona => {
      const option = document.createElement('option');
      option.value = persona.id;
      option.textContent = persona.display_name || persona.username;
      this.ui.personaSelect.appendChild(option);
    });
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
      
      // Mock data for demonstration
      const mockUnreadMessages = [
        {
          id: 1,
          from: 'john_doe',
          group: 'General Discussion',
          message: 'Hey everyone, I have a question about the latest update. Can someone help me understand how the new feature works?',
          timestamp: new Date().toISOString(),
          unread: true
        },
        {
          id: 2,
          from: 'jane_smith',
          group: 'Support Questions',
          message: 'I\'m having trouble with my account settings. The password reset isn\'t working.',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          unread: true
        },
        {
          id: 3,
          from: 'mike_wilson',
          group: 'Feature Requests',
          message: 'Would it be possible to add a dark mode to the application?',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          unread: true
        }
      ];
      
      this.unreadMessages = mockUnreadMessages;
      this.renderUnreadMessages(mockUnreadMessages);
      this.updateUnreadCount(mockUnreadMessages.length);
      
    } catch (error) {
      console.error('[AdminChat] Error loading unread messages:', error);
      this.ui.unreadMessagesList.innerHTML = '<div class="empty-state">Failed to load unread messages</div>';
    }
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
          unread: true
        },
        {
          id: 2,
          user: 'bob_wilson',
          lastMessage: 'Thank you for your help with the login issue!',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          unread: false
        },
        {
          id: 3,
          user: 'carol_jones',
          lastMessage: 'How do I update my profile information?',
          timestamp: new Date(Date.now() - 14400000).toISOString(),
          unread: true
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
        <div class="message-header">
          <span class="message-from">${escapeHtml(message.from)}</span>
          <span class="message-time">${formatDate(message.timestamp)}</span>
        </div>
        <div class="message-preview">${escapeHtml(message.message)}</div>
        <div class="message-group">in ${escapeHtml(message.group)}</div>
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
        <div class="message-header">
          <span class="message-from">${escapeHtml(conv.user)}</span>
          <span class="message-time">${formatDate(conv.timestamp)}</span>
        </div>
        <div class="message-preview">${escapeHtml(conv.lastMessage)}</div>
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
        <div class="message-header">
          <span class="message-from">Sent to ${escapeHtml(message.group)}</span>
          <span class="message-time">${formatDate(message.timestamp)}</span>
        </div>
        <div class="message-preview">${escapeHtml(message.message)}</div>
        <div class="message-group">as ${escapeHtml(message.persona)}</div>
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
    const hasGroup = this.ui.groupSelect?.value;
    const hasPersona = this.ui.personaSelect?.value;
    const hasMessage = this.ui.messageContent?.value.trim();
    
    const canSend = hasGroup && hasPersona && hasMessage;
    
    if (this.ui.sendMessageBtn) {
      this.ui.sendMessageBtn.disabled = !canSend;
    }
    if (this.ui.scheduleMessageBtn) {
      this.ui.scheduleMessageBtn.disabled = !canSend;
    }
  }

  async sendMessage() {
    try {
      const groupId = this.ui.groupSelect?.value;
      const personaId = this.ui.personaSelect?.value;
      const message = this.ui.messageContent?.value.trim();
      
      if (!groupId || !personaId || !message) {
        showError('Please fill in all fields');
        return;
      }
      
      console.log('Sending message:', { groupId, personaId, message });
      showError('Message sent successfully!', 'success');
      
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
    if (message) {
      this.showDetailModal(`Message from ${message.from}`, `
        <div class="message-item">
          <div class="message-header">
            <span class="message-from">${escapeHtml(message.from)}</span>
            <span class="message-time">${formatDate(message.timestamp)}</span>
          </div>
          <div class="message-preview" style="white-space: pre-wrap; -webkit-line-clamp: none; overflow: visible;">${escapeHtml(message.message)}</div>
          <div class="message-group">in ${escapeHtml(message.group)}</div>
        </div>
      `, false);
    }
  }

  viewConversation(conversationId) {
    console.log('View conversation:', conversationId);
    const conversation = this.supportConversations.find(c => c.id === conversationId);
    if (conversation) {
      this.showDetailModal(`Support conversation with ${conversation.user}`, `
        <div class="message-item">
          <div class="message-header">
            <span class="message-from">${escapeHtml(conversation.user)}</span>
            <span class="message-time">${formatDate(conversation.timestamp)}</span>
          </div>
          <div class="message-preview" style="white-space: pre-wrap; -webkit-line-clamp: none; overflow: visible;">${escapeHtml(conversation.lastMessage)}</div>
        </div>
        <p style="margin-top: 1rem; color: #7f8c8d; font-style: italic;">Full conversation history would be loaded here...</p>
      `, true);
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
  }

  async sendReply() {
    try {
      const replyText = this.ui.replyMessage?.value.trim();
      if (!replyText) {
        showError('Please enter a reply message');
        return;
      }
      
      console.log('Sending reply:', replyText);
      showError('Reply sent successfully!', 'success');
      
      this.ui.replyMessage.value = '';
      this.hideDetailModal();
      this.refreshSupport();
      
    } catch (error) {
      console.error('[AdminChat] Error sending reply:', error);
      showError('Failed to send reply');
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

  populatePersonaSelect() {
    if (!this.ui.personaSelect) return;
    
    this.ui.personaSelect.innerHTML = '<option value="">Choose a persona...</option>';
    this.personas.forEach(persona => {
      const option = document.createElement('option');
      option.value = persona.id;
      option.textContent = persona.display_name || persona.username;
      this.ui.personaSelect.appendChild(option);
    });
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

  showView(viewName) {
    this.currentView = viewName;
    
    // Update tab states
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.chat-view').forEach(view => view.classList.remove('active'));
    
    // Show selected view
    if (viewName === 'unread') {
      this.ui.unreadTab?.classList.add('active');
      this.ui.unreadView?.classList.add('active');
      this.loadUnreadMessages();
    } else if (viewName === 'send') {
      this.ui.sendMessagesTab?.classList.add('active');
      this.ui.sendView?.classList.add('active');
      this.loadRecentSentMessages();
    } else if (viewName === 'support') {
      this.ui.supportTab?.classList.add('active');
      this.ui.supportView?.classList.add('active');
      this.loadSupportConversations();
    }
  }

  async loadUnreadMessages() {
    try {
      if (!this.ui.unreadMessagesList) return;
      
      this.ui.unreadMessagesList.innerHTML = '<div class="loading">Loading unread messages...</div>';
      
      // This is a placeholder - you'll need to implement the backend endpoint
      // const response = await AdminChatAPI.getUnreadMessages();
      
      // Mock data for now
      const mockUnreadMessages = [
        {
          id: 1,
          from: 'john_doe',
          group: 'General Discussion',
          message: 'Hey everyone, I have a question about the latest update...',
          timestamp: new Date().toISOString(),
          unread: true
        },
        {
          id: 2,
          from: 'jane_smith',
          group: 'Support',
          message: 'I\'m having trouble with my account settings',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          unread: true
        }
      ];
      
      this.renderUnreadMessages(mockUnreadMessages);
      
    } catch (error) {
      console.error('[AdminChat] Error loading unread messages:', error);
      this.ui.unreadMessagesList.innerHTML = '<div class="empty-state">Failed to load unread messages</div>';
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
        <div class="message-header">
          <span class="message-from">${escapeHtml(message.from)}</span>
          <span class="message-time">${formatDate(message.timestamp)}</span>
        </div>
        <div class="message-preview">${escapeHtml(message.message)}</div>
        <div class="message-group">${escapeHtml(message.group)}</div>
      </div>
    `).join('');
  }

  async loadRecentSentMessages() {
    try {
      if (!this.ui.sentMessagesList) return;
      
      // Placeholder for recent sent messages
      this.ui.sentMessagesList.innerHTML = '<div class="empty-state">No recent messages</div>';
      
    } catch (error) {
      console.error('[AdminChat] Error loading recent sent messages:', error);
    }
  }

  async loadSupportConversations() {
    try {
      if (!this.ui.supportConversationsList) return;
      
      this.ui.supportConversationsList.innerHTML = '<div class="loading">Loading support conversations...</div>';
      
      // Mock data for support conversations
      const mockSupportConversations = [
        {
          id: 1,
          user: 'alice_cooper',
          lastMessage: 'I need help with my subscription',
          timestamp: new Date().toISOString(),
          unread: true
        },
        {
          id: 2,
          user: 'bob_wilson',
          lastMessage: 'Thank you for your help!',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          unread: false
        }
      ];
      
      this.renderSupportConversations(mockSupportConversations);
      
    } catch (error) {
      console.error('[AdminChat] Error loading support conversations:', error);
      this.ui.supportConversationsList.innerHTML = '<div class="empty-state">Failed to load support conversations</div>';
    }
  }

  renderSupportConversations(conversations) {
    if (!this.ui.supportConversationsList) return;
    
    if (conversations.length === 0) {
      this.ui.supportConversationsList.innerHTML = '<div class="empty-state">No support conversations</div>';
      return;
    }
    
    this.ui.supportConversationsList.innerHTML = conversations.map(conv => `
      <div class="conversation-item ${conv.unread ? 'unread' : ''}" onclick="adminChatApp.viewConversation(${conv.id})">
        <div class="message-header">
          <span class="message-from">${escapeHtml(conv.user)}</span>
          <span class="message-time">${formatDate(conv.timestamp)}</span>
        </div>
        <div class="message-preview">${escapeHtml(conv.lastMessage)}</div>
      </div>
    `).join('');
  }

  updateSendButton() {
    const hasGroup = this.ui.groupSelect?.value;
    const hasPersona = this.ui.personaSelect?.value;
    const hasMessage = this.ui.messageContent?.value.trim();
    
    const canSend = hasGroup && hasPersona && hasMessage;
    
    if (this.ui.sendMessageBtn) {
      this.ui.sendMessageBtn.disabled = !canSend;
    }
    if (this.ui.scheduleMessageBtn) {
      this.ui.scheduleMessageBtn.disabled = !canSend;
    }
  }

  async sendMessage() {
    try {
      const groupId = this.ui.groupSelect?.value;
      const personaId = this.ui.personaSelect?.value;
      const message = this.ui.messageContent?.value.trim();
      
      if (!groupId || !personaId || !message) {
        showError('Please fill in all fields');
        return;
      }
      
      // Implement the actual API call
      console.log('Sending message:', { groupId, personaId, message });
      showError('Message sent successfully!', 'success');
      
      // Clear the form
      this.ui.messageContent.value = '';
      this.updateSendButton();
      this.loadRecentSentMessages();
      
    } catch (error) {
      console.error('[AdminChat] Error sending message:', error);
      showError('Failed to send message');
    }
  }

  viewMessage(messageId) {
    console.log('View message:', messageId);
    // Implement message viewing in detail panel
  }

  viewConversation(conversationId) {
    console.log('View conversation:', conversationId);
    // Implement conversation viewing in detail panel
  }

  hideDetailPanel() {
    if (this.ui.messageDetailPanel) {
      this.ui.messageDetailPanel.style.display = 'none';
    }
  }

  async sendReply() {
    try {
      const replyText = this.ui.replyMessage?.value.trim();
      if (!replyText) {
        showError('Please enter a reply message');
        return;
      }
      
      console.log('Sending reply:', replyText);
      showError('Reply sent successfully!', 'success');
      
      this.ui.replyMessage.value = '';
      
    } catch (error) {
      console.error('[AdminChat] Error sending reply:', error);
      showError('Failed to send reply');
    }
  }

  markAllRead() {
    console.log('Mark all messages as read');
    showError('All messages marked as read', 'success');
    this.loadUnreadMessages();
  }

  searchUnread(searchTerm) {
    console.log('Search unread messages:', searchTerm);
    // Implement search functionality
  }

  searchSupport(searchTerm) {
    console.log('Search support conversations:', searchTerm);
    // Implement search functionality
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof AdminChatAPI === 'undefined') {
    console.error('[AdminChat] AdminChatAPI is not loaded');
    showError('Chat API is not loaded. Please refresh the page.');
    return;
  }
  
  console.log('[AdminChat] Initializing simplified admin chat application...');
  window.adminChatApp = new AdminChatApp();
  window.adminChatApp.init();
});
