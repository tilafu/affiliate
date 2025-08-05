/**
 * Enhanced User Chat Frontend Extensions
 * Adds fake user DMs, support conversations, and admin notifications
 * This extends the existing user-chat.js functionality
 */

// Extend the existing UserChatApp class with new functionality
class EnhancedChatFeatures {
  constructor(chatApp) {
    this.chatApp = chatApp;
    this.supportConversation = null;
    this.init();
  }

  init() {
    this.setupAvatarClickHandlers();
    this.loadSupportConversation();
    this.enhanceMessageRendering();
    this.setupSidebarEnhancements();
  }

  // =============================================
  // AVATAR CLICK HANDLERS FOR FAKE USER DMS
  // =============================================

  setupAvatarClickHandlers() {
    // Override the createMessageElement method to add click handlers
    const originalCreateMessageElement = this.chatApp.createMessageElement.bind(this.chatApp);
    
    this.chatApp.createMessageElement = (message) => {
      const messageElement = originalCreateMessageElement(message);
      
      // Add click handler to avatar for fake users in Main PEA Communication
      const avatar = messageElement.querySelector('.message-avatar');
      if (avatar && this.shouldEnableAvatarClick(message)) {
        avatar.style.cursor = 'pointer';
        avatar.title = 'Click to start private conversation';
        avatar.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleAvatarClick(message);
        });
        
        // Add visual indicator
        avatar.classList.add('clickable-avatar');
      }
      
      return messageElement;
    };
  }

  shouldEnableAvatarClick(message) {
    // Only enable for fake users in Main PEA Communication group
    return (
      this.chatApp.currentGroup &&
      this.chatApp.currentGroup.is_personal_group &&
      message.sender_type === 'fake_user' &&
      message.fake_user_id
    );
  }

  async handleAvatarClick(message) {
    try {
      console.log('Starting DM with fake user:', message.sender_name);
      
      // Show loading indicator
      this.showNotification('Starting conversation...', 'info');
      
      await this.startFakeUserDM(message.fake_user_id, message.sender_name);
      
    } catch (error) {
      console.error('Error starting fake user DM:', error);
      this.showNotification('Failed to start conversation', 'error');
    }
  }

  async startFakeUserDM(fakeUserId, fakeUserName) {
    try {
      const token = this.chatApp.getAuthToken();
      const response = await fetch(`/api/user/chat/fake-user-dm/${fakeUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to start fake user conversation');
      }

      const data = await response.json();
      
      // Add to DM list and select
      await this.chatApp.loadDirectMessages();
      this.selectFakeUserDM(data.conversation);
      
      this.showNotification(`Started conversation with ${fakeUserName}`, 'success');
      
    } catch (error) {
      console.error('Error starting fake user DM:', error);
      throw error;
    }
  }

  selectFakeUserDM(conversation) {
    this.chatApp.currentDM = conversation;
    this.chatApp.currentGroup = null;
    this.chatApp.chatMode = 'direct';
    
    // Update UI
    this.updateChatHeader(conversation);
    this.loadDMMessages(conversation.id);
    this.updateSidebarSelection();
  }

  // =============================================
  // SUPPORT CONVERSATION INTEGRATION
  // =============================================

  async loadSupportConversation() {
    try {
      const token = this.chatApp.getAuthToken();
      const response = await fetch('/api/user/chat/support', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load support conversation');
      }

      const data = await response.json();
      this.supportConversation = data.conversation;
      
      // Add support to sidebar
      this.addSupportToSidebar();
      
    } catch (error) {
      console.error('Error loading support conversation:', error);
    }
  }

  addSupportToSidebar() {
    const groupsList = document.querySelector('.chat-list');
    if (!groupsList || !this.supportConversation) return;
    
    // Create support item
    const supportItem = document.createElement('div');
    supportItem.className = 'chat-item support-conversation';
    supportItem.dataset.conversationId = this.supportConversation.id;
    
    supportItem.innerHTML = `
      <img src="/images/avatars/support-agent.png" alt="Help & Support" class="chat-item-avatar" 
           onerror="this.src='/assets/uploads/user.jpg'">
      <div class="chat-item-content">
        <div class="chat-item-header">
          <span class="chat-item-name">Help & Support</span>
          <span class="chat-item-time">Available 24/7</span>
        </div>
        <div class="chat-item-preview">Get help with your account and services</div>
      </div>
      <div class="chat-item-indicators">
        <span class="support-badge">Support</span>
      </div>
    `;
    
    // Add click handler
    supportItem.addEventListener('click', () => {
      this.openSupportConversation();
    });
    
    // Insert at top of list
    groupsList.insertBefore(supportItem, groupsList.firstChild);
  }

  async openSupportConversation() {
    this.chatApp.currentDM = this.supportConversation;
    this.chatApp.currentGroup = null;
    this.chatApp.chatMode = 'support';
    
    // Update UI
    this.updateChatHeader(this.supportConversation);
    await this.loadSupportMessages();
    this.updateSidebarSelection();
  }

  async loadSupportMessages() {
    try {
      const token = this.chatApp.getAuthToken();
      const response = await fetch('/api/user/chat/support/messages', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load support messages');
      }

      const data = await response.json();
      this.chatApp.messages = data.messages;
      this.chatApp.renderMessages();
      
    } catch (error) {
      console.error('Error loading support messages:', error);
      this.showNotification('Failed to load support messages', 'error');
    }
  }

  // =============================================
  // ADMIN NOTIFICATION DISPLAY
  // =============================================

  enhanceMessageRendering() {
    // Override renderMessages to handle notifications
    const originalRenderMessages = this.chatApp.renderMessages.bind(this.chatApp);
    
    this.chatApp.renderMessages = () => {
      originalRenderMessages();
      this.enhanceNotificationMessages();
    };
  }

  enhanceNotificationMessages() {
    const messageElements = document.querySelectorAll('.message');
    
    messageElements.forEach(messageEl => {
      const messageData = this.chatApp.messages.find(msg => 
        messageEl.querySelector('.message-text')?.textContent === msg.content
      );
      
      if (messageData && (messageData.is_notification || messageData.is_admin_notification)) {
        this.styleNotificationMessage(messageEl, messageData);
      }
    });
  }

  styleNotificationMessage(messageEl, messageData) {
    // Remove default message styling
    messageEl.classList.remove('message-own', 'message-other');
    messageEl.classList.add('message-notification');
    
    // Apply notification styling
    const notificationStyle = messageData.notification_style || {};
    
    const messageContent = messageEl.querySelector('.message-content');
    if (messageContent) {
      // Center align
      messageEl.style.justifyContent = 'center';
      messageEl.style.textAlign = 'center';
      
      // Apply custom styling
      messageContent.style.backgroundColor = notificationStyle.backgroundColor || '#f0f9ff';
      messageContent.style.color = notificationStyle.textColor || '#0369a1';
      messageContent.style.border = `1px solid ${notificationStyle.borderColor || '#38bdf8'}`;
      messageContent.style.borderRadius = '8px';
      messageContent.style.padding = '12px 16px';
      messageContent.style.maxWidth = '80%';
      messageContent.style.margin = '0 auto';
    }
    
    // Hide avatar and sender info for notifications
    const avatar = messageEl.querySelector('.message-avatar');
    const sender = messageEl.querySelector('.message-sender');
    
    if (avatar) avatar.style.display = 'none';
    if (sender) sender.style.display = 'none';
  }

  // =============================================
  // UI ENHANCEMENT METHODS
  // =============================================

  updateChatHeader(conversation) {
    const chatHeader = document.querySelector('.chat-header h2');
    const chatAvatar = document.querySelector('.chat-header img');
    
    if (chatHeader) {
      chatHeader.textContent = conversation.name;
    }
    
    if (chatAvatar) {
      chatAvatar.src = conversation.avatar_url || '/assets/uploads/user.jpg';
      chatAvatar.alt = conversation.name;
    }
  }

  async loadDMMessages(conversationId) {
    try {
      const token = this.chatApp.getAuthToken();
      const response = await fetch(`/api/user/chat/direct-messages/${conversationId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load DM messages');
      }

      const data = await response.json();
      this.chatApp.messages = data.messages;
      this.chatApp.renderMessages();
      
    } catch (error) {
      console.error('Error loading DM messages:', error);
      this.showNotification('Failed to load messages', 'error');
    }
  }

  updateSidebarSelection() {
    // Remove all active selections
    document.querySelectorAll('.chat-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active class to current selection
    if (this.chatApp.chatMode === 'support') {
      document.querySelector('.support-conversation')?.classList.add('active');
    } else if (this.chatApp.currentDM) {
      document.querySelector(`[data-conversation-id="${this.chatApp.currentDM.id}"]`)?.classList.add('active');
    }
  }

  setupSidebarEnhancements() {
    // Add DM section header if it doesn't exist
    const groupsList = document.querySelector('.chat-list');
    if (!groupsList) return;
    
    // Create DM section
    const dmSection = document.createElement('div');
    dmSection.className = 'chat-section';
    dmSection.innerHTML = `
      <div class="chat-section-header">
        <span class="chat-section-title">Direct Messages</span>
      </div>
      <div class="dm-conversations-list"></div>
    `;
    
    groupsList.appendChild(dmSection);
    
    // Enhance existing DM loading
    this.enhanceDMList();
  }

  async enhanceDMList() {
    // Override loadDirectMessages to update UI
    const originalLoadDirectMessages = this.chatApp.loadDirectMessages.bind(this.chatApp);
    
    this.chatApp.loadDirectMessages = async () => {
      await originalLoadDirectMessages();
      this.renderDMList();
    };
  }

  renderDMList() {
    const dmContainer = document.querySelector('.dm-conversations-list');
    if (!dmContainer) return;
    
    dmContainer.innerHTML = '';
    
    this.chatApp.directMessages.forEach(dm => {
      const dmItem = document.createElement('div');
      dmItem.className = 'chat-item dm-conversation';
      dmItem.dataset.conversationId = dm.id;
      
      dmItem.innerHTML = `
        <img src="${dm.avatar_url || '/assets/uploads/user.jpg'}" alt="${dm.name}" class="chat-item-avatar" 
             onerror="this.src='/assets/uploads/user.jpg'">
        <div class="chat-item-content">
          <div class="chat-item-header">
            <span class="chat-item-name">${dm.name}</span>
            <span class="chat-item-time">${this.formatTime(dm.last_message_at)}</span>
          </div>
          <div class="chat-item-preview">${dm.last_message || 'No messages yet'}</div>
        </div>
        ${dm.unread_count > 0 ? `<div class="chat-item-indicators"><span class="unread-badge">${dm.unread_count}</span></div>` : ''}
      `;
      
      dmItem.addEventListener('click', () => {
        this.selectFakeUserDM(dm);
      });
      
      dmContainer.appendChild(dmItem);
    });
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style notification
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-weight: 500;
      z-index: 9999;
      transition: all 0.3s ease;
      background-color: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// CSS Enhancements for the new features
const enhancedChatCSS = `
  .clickable-avatar {
    transition: all 0.2s ease;
  }
  
  .clickable-avatar:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  
  .message-notification {
    margin: 16px 0 !important;
  }
  
  .message-notification .message-content {
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .support-conversation {
    border-left: 3px solid #10b981;
  }
  
  .support-badge {
    background: #10b981;
    color: white;
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: bold;
  }
  
  .chat-section {
    margin-top: 20px;
  }
  
  .chat-section-header {
    padding: 8px 16px;
    border-bottom: 1px solid #e5e5e5;
    font-weight: 600;
    color: #666;
    font-size: 12px;
    text-transform: uppercase;
  }
  
  .dm-conversation {
    border-left: 3px solid #3b82f6;
  }
  
  .unread-badge {
    background: #ef4444;
    color: white;
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: bold;
    min-width: 16px;
    text-align: center;
  }
`;

// Initialize enhanced features when chat app is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Add CSS
  const style = document.createElement('style');
  style.textContent = enhancedChatCSS;
  document.head.appendChild(style);
  
  // Wait for chat app to initialize, then enhance it
  setTimeout(() => {
    if (window.userChatApp) {
      window.enhancedChatFeatures = new EnhancedChatFeatures(window.userChatApp);
      console.log('Enhanced chat features initialized');
    }
  }, 1000);
});

// Export for global access
window.EnhancedChatFeatures = EnhancedChatFeatures;
