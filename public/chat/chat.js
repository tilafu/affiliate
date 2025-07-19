// Chat Application with Socket.IO Integration
// This file now serves as a secondary support system for user-chat.js
// Most core functionality has been moved to user-chat.js to prevent conflicts

document.addEventListener('DOMContentLoaded', function() {
    // Check if user-chat.js has already initialized
    if (window.userChatAppInitialized) {
        console.log('User chat app already initialized, skipping chat.js initialization');
        return;
    }
    
    // If user-chat.js didn't initialize for some reason, mark that main chat app is trying
    window.chatAppInitialized = true;
    console.warn('user-chat.js failed to initialize, falling back to basic chat.js functionality');
    
    // Minimal fallback initialization - most functionality is now in user-chat.js
    initializeBasicChat();
});

function initializeBasicChat() {
    console.log('Initializing basic chat fallback (user-chat.js should handle main functionality)');
    
    // Basic error handling for cases where user-chat.js fails
    const chatsList = document.getElementById('chatsList');
    if (chatsList && chatsList.innerHTML.trim() === '') {
        chatsList.innerHTML = '<div class="no-chats">Loading chats... If this persists, please refresh the page.</div>';
    }
    
    // Basic fallback message if needed
    setTimeout(() => {
        if (chatsList && chatsList.innerHTML.includes('Loading chats...')) {
            chatsList.innerHTML = '<div class="no-chats">Error loading chats. Please refresh the page or check your connection.</div>';
        }
    }, 10000); // 10 second timeout
}

// Utility functions that might be needed by user-chat.js or other parts of the app

// Helper function to format message time (can be used by both systems)
function formatMessageTime(date) {
    const now = new Date();
    const diff = now - date;
    const oneDay = 24 * 60 * 60 * 1000;
    
    // Today: show time
    if (diff < oneDay && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Yesterday
    if (diff < 2 * oneDay && date.getDate() === now.getDate() - 1) {
        return 'Yesterday';
    }
    
    // Within 7 days: show day name
    if (diff < 7 * oneDay) {
        return date.toLocaleDateString([], { weekday: 'short' });
    }
    
    // Older: show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Helper function to escape HTML (security utility)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Mobile detection utility (backup if user-chat.js needs it)
function isMobileView() {
    return window.innerWidth <= 768;
}

// Cookie utility function
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Export utilities to global scope for user-chat.js to use if needed
window.chatUtils = {
    formatMessageTime,
    escapeHtml,
    isMobileView,
    getCookie
};

console.log('chat.js loaded as support system for user-chat.js');
