/**
 * Enhanced Socket.IO Integration for Fake User DMs and Support
 * Extends existing socket functionality for new chat features
 */

// Extend socket handling for enhanced chat features
class EnhancedSocketHandler {
  constructor(socket, chatApp) {
    this.socket = socket;
    this.chatApp = chatApp;
    this.init();
  }

  init() {
    this.setupFakeUserDMHandlers();
    this.setupSupportHandlers();
    this.setupNotificationHandlers();
  }

  // =============================================
  // FAKE USER DM SOCKET HANDLERS
  // =============================================

  setupFakeUserDMHandlers() {
    // Handle new fake user DM messages
    this.socket.on('fake_user_dm_message', (data) => {
      console.log('Received fake user DM message:', data);
      
      if (this.chatApp.chatMode === 'direct' && 
          this.chatApp.currentDM?.id === data.conversation_id) {
        // Add message to current conversation
        this.chatApp.messages.push(data.message);
        this.chatApp.renderMessages();
        this.playNotificationSound();
      } else {
        // Update DM list with unread indicator
        this.updateDMUnreadCount(data.conversation_id);
        this.showBrowserNotification(
          `${data.message.sender_name}`,
          data.message.content
        );
      }
    });

    // Handle fake user typing indicators
    this.socket.on('fake_user_typing', (data) => {
      if (this.chatApp.chatMode === 'direct' && 
          this.chatApp.currentDM?.id === data.conversation_id) {
        this.showTypingIndicator(data.fake_user_name);
      }
    });

    // Handle fake user stopped typing
    this.socket.on('fake_user_stopped_typing', (data) => {
      this.hideTypingIndicator();
    });
  }

  // =============================================
  // SUPPORT CONVERSATION HANDLERS
  // =============================================

  setupSupportHandlers() {
    // Handle support messages from admin
    this.socket.on('support_message', (data) => {
      console.log('Received support message:', data);
      
      if (this.chatApp.chatMode === 'support') {
        // Add message to current support conversation
        this.chatApp.messages.push(data.message);
        this.chatApp.renderMessages();
        this.playNotificationSound();
      } else {
        // Show notification for support message
        this.showBrowserNotification(
          'Help & Support',
          data.message.content
        );
        this.updateSupportUnreadIndicator();
      }
    });

    // Handle support agent typing
    this.socket.on('support_agent_typing', () => {
      if (this.chatApp.chatMode === 'support') {
        this.showTypingIndicator('Support Agent');
      }
    });

    // Handle support agent stopped typing
    this.socket.on('support_agent_stopped_typing', () => {
      this.hideTypingIndicator();
    });
  }

  // =============================================
  // NOTIFICATION HANDLERS
  // =============================================

  setupNotificationHandlers() {
    // Handle admin notifications in personal groups
    this.socket.on('admin_notification', (data) => {
      console.log('Received admin notification:', data);
      
      if (this.chatApp.currentGroup?.is_personal_group) {
        // Add notification message to current group
        this.chatApp.messages.push({
          ...data.message,
          is_notification: true,
          is_admin_notification: true,
          notification_style: data.style || {}
        });
        this.chatApp.renderMessages();
      }
      
      // Show browser notification if not in focus
      if (!document.hasFocus()) {
        this.showBrowserNotification(
          'Important Notice',
          data.message.content
        );
      }
    });

    // Handle system notifications
    this.socket.on('system_notification', (data) => {
      this.showSystemNotification(data.message, data.type);
    });
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  updateDMUnreadCount(conversationId) {
    const dmItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
    if (!dmItem) return;

    let unreadBadge = dmItem.querySelector('.unread-badge');
    if (!unreadBadge) {
      // Create unread badge
      const indicators = dmItem.querySelector('.chat-item-indicators') || 
                        this.createIndicatorsContainer(dmItem);
      
      unreadBadge = document.createElement('span');
      unreadBadge.className = 'unread-badge';
      unreadBadge.textContent = '1';
      indicators.appendChild(unreadBadge);
    } else {
      // Increment count
      const currentCount = parseInt(unreadBadge.textContent) || 0;
      unreadBadge.textContent = currentCount + 1;
    }
  }

  updateSupportUnreadIndicator() {
    const supportItem = document.querySelector('.support-conversation');
    if (!supportItem) return;

    let unreadBadge = supportItem.querySelector('.unread-badge');
    if (!unreadBadge) {
      const indicators = supportItem.querySelector('.chat-item-indicators') || 
                        this.createIndicatorsContainer(supportItem);
      
      unreadBadge = document.createElement('span');
      unreadBadge.className = 'unread-badge';
      unreadBadge.textContent = '1';
      indicators.appendChild(unreadBadge);
    } else {
      const currentCount = parseInt(unreadBadge.textContent) || 0;
      unreadBadge.textContent = currentCount + 1;
    }
  }

  createIndicatorsContainer(parentElement) {
    const indicators = document.createElement('div');
    indicators.className = 'chat-item-indicators';
    parentElement.appendChild(indicators);
    return indicators;
  }

  showTypingIndicator(userName) {
    const messagesContainer = document.querySelector('.messages-container');
    if (!messagesContainer) return;

    // Remove existing typing indicator
    this.hideTypingIndicator();

    // Create new typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = `
      <div class="typing-indicator-content">
        <span class="typing-user">${userName}</span> is typing
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;

    messagesContainer.appendChild(typingIndicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  hideTypingIndicator() {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  async showBrowserNotification(title, message) {
    // Request permission if needed
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    // Show notification if permitted
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      // Focus window when clicked
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }

  showSystemNotification(message, type = 'info') {
    // Use the same notification system as enhanced features
    if (window.enhancedChatFeatures) {
      window.enhancedChatFeatures.showNotification(message, type);
    }
  }

  playNotificationSound() {
    // Play subtle notification sound
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Fallback: create a subtle beep
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        oscillator.stop(context.currentTime + 0.1);
      });
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }

  // =============================================
  // OUTGOING MESSAGE HANDLERS
  // =============================================

  sendFakeUserDMMessage(conversationId, content) {
    this.socket.emit('send_fake_user_dm', {
      conversation_id: conversationId,
      content: content,
      timestamp: new Date().toISOString()
    });
  }

  sendSupportMessage(content) {
    this.socket.emit('send_support_message', {
      content: content,
      timestamp: new Date().toISOString()
    });
  }

  sendTypingStatus(isTyping, conversationId = null, mode = null) {
    if (mode === 'support') {
      this.socket.emit(isTyping ? 'support_user_typing' : 'support_user_stopped_typing');
    } else if (mode === 'direct' && conversationId) {
      this.socket.emit(isTyping ? 'dm_user_typing' : 'dm_user_stopped_typing', {
        conversation_id: conversationId
      });
    }
  }
}

// CSS for typing indicator and enhanced notifications
const enhancedSocketCSS = `
  .typing-indicator {
    padding: 8px 16px;
    margin: 8px 0;
    display: flex;
    align-items: center;
    opacity: 0.7;
  }
  
  .typing-indicator-content {
    display: flex;
    align-items: center;
    gap: 8px;
    font-style: italic;
    color: #666;
  }
  
  .typing-user {
    font-weight: 500;
  }
  
  .typing-dots {
    display: flex;
    gap: 2px;
  }
  
  .typing-dots span {
    width: 4px;
    height: 4px;
    background: #666;
    border-radius: 50%;
    animation: typingDots 1.5s infinite;
  }
  
  .typing-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  .typing-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }
  
  @keyframes typingDots {
    0%, 60%, 100% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    30% {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  .notification {
    animation: slideInRight 0.3s ease;
  }
  
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

// Initialize enhanced socket handling
document.addEventListener('DOMContentLoaded', () => {
  // Add CSS
  const style = document.createElement('style');
  style.textContent = enhancedSocketCSS;
  document.head.appendChild(style);
  
  // Wait for socket and chat app to initialize
  setTimeout(() => {
    if (window.socket && window.userChatApp) {
      window.enhancedSocketHandler = new EnhancedSocketHandler(window.socket, window.userChatApp);
      console.log('Enhanced socket handlers initialized');
    }
  }, 1500);
});

// Export for global access
window.EnhancedSocketHandler = EnhancedSocketHandler;
