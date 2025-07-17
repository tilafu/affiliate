// Chat Application with Socket.IO Integration
document.addEventListener('DOMContentLoaded', function() {
    initializeChat();
});

function initializeChat() {
    // DOM Elements
    const chatsList = document.getElementById('chatsList');
    const chatDefaultState = document.getElementById('chatDefaultState');
    const chatActiveState = document.getElementById('chatActiveState');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessage');
    const messagesContainer = document.getElementById('chatMessages');
    const searchInput = document.getElementById('searchInput');
    const tabButtons = document.querySelectorAll('.sidebar-tabs .tab');
    const attachFileButton = document.getElementById('attachFileButton');
    
    // File upload elements (to be created dynamically)
    let fileInput = null;
    let selectedFile = null;
    let filePreview = null;
    
    // Socket.IO connection
    let socket;
    let currentUser = null;
    let activeGroupId = null;
    let activeChatType = 'group'; // 'group' or 'direct'
    let groups = [];
    let activeGroup = null;
    let messages = {};
    let typingTimeout = null; // For debouncing typing events
    let isDataLoaded = false; // Add flag to track if data is loaded
    
    // Error handling and notifications
    function showNotification(message, type = 'info') {
        // Simple alert for now, can be replaced with a more sophisticated notification system
        if (type === 'error') {
            console.error(message);
            alert(`Error: ${message}`);
        } else if (type === 'warning') {
            console.warn(message);
            // For warnings, show a brief console message but don't interrupt user
            // In production, you might want to show a toast notification
        } else {
            console.log(message);
            // For non-error notifications, we might not want to show alerts
            // as they can be disruptive to the user experience
        }
    }
    
    function handleApiError(error, message) {
        console.error(`${message}:`, error);
        showNotification(`${message}. Please try again.`, 'error');
    }
    
    // Helper function to get auth token
    function getAuthToken() {
        // Define all possible token keys that might be used
        const possibleLocalStorageKeys = [
            'token', 'authToken', 'jwt', 'accessToken', 'adminToken',
            'user_token', 'auth_token', 'api_token', 'bearer_token'
        ];
        
        const possibleCookieKeys = [
            'auth_token', 'token', 'jwt', 'accessToken', 'adminToken',
            'user_token', 'api_token', 'bearer_token'
        ];
        
        // Check localStorage
        for (const key of possibleLocalStorageKeys) {
            const value = localStorage.getItem(key);
            if (value) {
                console.log(`Found auth token in localStorage with key: ${key}`);
                return value;
            }
        }
        
        // Check cookies
        for (const key of possibleCookieKeys) {
            const value = getCookie(key);
            if (value) {
                console.log(`Found auth token in cookies with key: ${key}`);
                return value;
            }
        }
        
        console.log('No auth token found in localStorage or cookies');
        
        // No token found
        return null;
    }
    
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }
    
    // Connect to Socket.IO server
    function connectToSocketServer() {
        // Get authentication token from localStorage or cookie
        const token = getAuthToken();
        const userId = localStorage.getItem('userId') || 
                      localStorage.getItem('user_id') || 
                      getCookie('userId') || 
                      getCookie('user_id');
        
        // For debugging purposes
        console.log("Auth tokens available:", {
            token: token ? 'Found (first 5 chars: ' + token.substring(0, 5) + '...)' : 'Not found',
            userId: userId || 'not found'
        });
        
        try {
            // Check if io is defined
            if (typeof io === 'undefined') {
                console.error('Socket.IO client is not loaded. Make sure the Socket.IO script is included in your HTML.');
                showNotification('Chat functionality is unavailable: Socket.IO client not loaded.', 'error');
                return;
            }
            
            // Try connecting without a namespace first
            console.log('Attempting to connect to Socket.IO server...');
            socket = io({
                auth: {
                    token: token || 'guest' // Fallback to guest if no token
                }
            });
            
            // Socket connection events
            socket.on('connect', () => {
                console.log('Connected to chat server successfully');
                fetchUserProfile();
                fetchUserGroups();
            });
            
            socket.on('disconnect', () => {
                console.log('Disconnected from chat server');
            });
            
            socket.on('error', (error) => {
                console.error('Socket error:', error);
                // Only show critical errors, not rate limiting or auth errors
                if (error.message && !error.message.includes('Rate limit') && !error.message.includes('authorized')) {
                    showNotification('Chat error: ' + error.message, 'warning');
                }
            });
            
            socket.on('rate-limit-warning', (data) => {
                console.warn('Rate limit warning:', data);
                // Show a brief, non-intrusive message
                showNotification(data.message, 'warning');
            });
            
            socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
                // Try to determine if it's an authentication issue
                if (error.message && error.message.includes('Authentication')) {
                    showNotification('Authentication error: Please log in to access the chat.', 'error');
                    
                    // Provide additional debug info in console
                    console.log("Connection error details:", {
                        message: error.message,
                        auth: socket.auth
                    });
                } else {
                    showNotification('Failed to connect to chat server: ' + error.message, 'error');
                }
            });
            
            // Chat specific events
            socket.on('new-message', (message) => {
                addMessageToChat(message);
                
                // If message is for the active group, mark as read
                if (activeGroupId === message.group_id && 
                    ((message.user_id && message.user_id !== currentUser.id) || message.fake_user_id)) {
                    markMessageAsRead(message.id);
                }
                
                // Update the chat list with the latest message
                updateChatWithLatestMessage(message);
            });
            
            socket.on('user-typing', (data) => {
                showTypingIndicator(data);
            });
            
            socket.on('message-read', (data) => {
                updateReadReceipts(data);
            });
            
            // Direct message events
            socket.on('new-direct-message', (message) => {
                addDirectMessageToChat(message);
                
                // Update the conversation list with the latest message
                updateConversationWithLatestMessage(message);
            });
            
        } catch (error) {
            console.error('Error connecting to socket server:', error);
            showNotification('Failed to connect to the chat server: ' + error.message, 'error');
        }
    }
    
    // API Calls
    async function fetchUserProfile() {
        try {
            const token = getAuthToken();
            
            if (!token) {
                console.warn('No authentication token found for user profile fetch');
                // Create a fallback user object for guest mode
                currentUser = {
                    id: 'guest',
                    username: 'Guest User',
                    role: 'guest'
                };
                return;
            }
            
            // Try different API endpoints that might exist in your system
            let response;
            let data;
            
            try {
                response = await fetch('/api/users/me', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    data = await response.json();
                }
            } catch (err) {
                console.warn('Failed to fetch user profile from /api/users/me, trying alternative endpoint');
            }
            
            // If first endpoint failed, try alternative
            if (!data) {
                try {
                    response = await fetch('/api/user/profile', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        data = await response.json();
                    }
                } catch (err) {
                    console.warn('Failed to fetch user profile from /api/user/profile');
                }
            }
            
            // If second endpoint failed, try admin endpoint
            if (!data) {
                try {
                    response = await fetch('/api/admin/profile', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        data = await response.json();
                    }
                } catch (err) {
                    console.warn('Failed to fetch user profile from /api/admin/profile');
                }
            }
            
            if (data) {
                currentUser = data;
                console.log('User profile fetched successfully:', currentUser.username);
            } else {
                // Create a fallback user if all attempts failed
                console.warn('Could not fetch user profile from any endpoint');
                currentUser = {
                    id: 'unknown',
                    username: 'Unknown User',
                    role: 'user'
                };
            }
            
        } catch (error) {
            handleApiError(error, 'Failed to fetch user profile');
            // Create a fallback user
            currentUser = {
                id: 'error',
                username: 'Error User',
                role: 'user'
            };
        }
    }
    
    async function fetchUserGroups() {
        try {
            const token = getAuthToken();
            
            if (!token) {
                console.warn('No authentication token found for groups fetch');
                groups = [];
                isDataLoaded = true; // Mark as loaded even if empty
                renderChatsList([]);
                return;
            }
            
            console.log('Fetching conversations...');
            
            // Try conversations endpoint first (includes both groups and DMs)
            try {
                const response = await fetch('/api/chat/conversations', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        groups = data;
                        isDataLoaded = true; // Mark as loaded
                        console.log(`Loaded ${groups.length} conversations`);
                        
                        // Show groups by default (since Groups tab is active by default)
                        const groupsOnly = groups.filter(group => group.type === 'group' || !group.type);
                        renderChatsList(groupsOnly);
                        
                        // After groups load, check for welcome message
                        setTimeout(() => ensureWelcomeDirectMessage(), 1000);
                        return;
                    }
                }
            } catch (err) {
                console.warn('Conversations endpoint failed, trying groups endpoint');
            }
            
            // Fallback to groups endpoint
            try {
                const response = await fetch('/api/chat/groups', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        groups = data.map(item => ({ ...item, type: 'group' }));
                        isDataLoaded = true; // Mark as loaded
                        console.log(`Loaded ${groups.length} groups as fallback`);
                        
                        // Show groups by default
                        renderChatsList(groups);
                        
                        // After groups load, check for welcome message
                        setTimeout(() => ensureWelcomeDirectMessage(), 1000);
                        return;
                    }
                }
            } catch (err) {
                console.error('Both endpoints failed');
            }
            
            // If we get here, everything failed
            groups = [];
            isDataLoaded = true; // Mark as loaded even if failed
            renderChatsList([]);
            
        } catch (error) {
            console.error('Error in fetchUserGroups:', error);
            groups = [];
            isDataLoaded = true; // Mark as loaded even if error
            renderChatsList([]);
        }
    }    
    async function fetchGroupDetails(groupId) {
        try {
            const token = getAuthToken();
            
            const response = await fetch(`/api/chat/groups/${groupId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            activeGroup = data;
            
            // Update UI with group details
            updateChatHeader(activeGroup);
            
        } catch (error) {
            handleApiError(error, 'Failed to fetch group details');
        }
    }
    
    async function fetchGroupMessages(groupId) {
        try {
            const token = getAuthToken();
            
            // Show loading indicator
            const loadingIndicator = showMessageLoading();
            
            const response = await fetch(`/api/chat/groups/${groupId}/messages`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            // Remove loading indicator
            if (loadingIndicator && loadingIndicator.parentNode) {
                loadingIndicator.parentNode.removeChild(loadingIndicator);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            messages[groupId] = data;
            
            renderMessages(groupId);
            
        } catch (error) {
            handleApiError(error, 'Failed to fetch messages');
        }
    }
    
    async function sendMessageToServer(groupId, content, mediaUrl = null, mediaType = null, fakeUserId = null) {
        try {
            const token = getAuthToken();
            
            const messageData = {
                content,
                media_url: mediaUrl,
                media_type: mediaType
            };
            
            // If admin is sending as a fake user
            if (fakeUserId) {
                messageData.fake_user_id = fakeUserId;
            }
            
            const response = await fetch(`/api/chat/groups/${groupId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(messageData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // The message will be added to the UI via the socket.io event
            
        } catch (error) {
            handleApiError(error, 'Failed to send message');
        }
    }
    
    async function markMessageAsRead(messageId) {
        try {
            const token = getAuthToken();
            
            const response = await fetch(`/api/chat/messages/${messageId}/read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.warn(`Failed to mark message ${messageId} as read`);
            }
            
        } catch (error) {
            console.error('Error marking message as read:', error);
            // Don't show notification for this error as it's not critical
        }
    }
    
    // Direct message functions
    async function fetchDirectConversationDetails(conversationId) {
        try {
            const token = getAuthToken();
            
            const response = await fetch(`/api/chat/conversations/direct/${conversationId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            activeGroup = data;
            
            updateChatHeader(data);
            
        } catch (error) {
            handleApiError(error, 'Failed to fetch direct conversation details');
        }
    }
    
    async function fetchDirectMessages(conversationId) {
        try {
            const token = getAuthToken();
            
            // Show loading indicator
            const loadingIndicator = showMessageLoading();
            
            const response = await fetch(`/api/chat/conversations/direct/${conversationId}/messages`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            // Remove loading indicator
            if (loadingIndicator && loadingIndicator.parentNode) {
                loadingIndicator.parentNode.removeChild(loadingIndicator);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            messages[conversationId] = data;
            
            renderDirectMessages(conversationId);
            
        } catch (error) {
            handleApiError(error, 'Failed to fetch direct messages');
        }
    }
    
    async function sendDirectMessageToServer(conversationId, content, mediaUrl = null, mediaType = null) {
        try {
            const token = getAuthToken();
            
            const messageData = {
                content,
                media_url: mediaUrl,
                media_type: mediaType
            };
            
            const response = await fetch(`/api/chat/conversations/direct/${conversationId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(messageData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // The message will be added to the UI via the socket.io event
            
        } catch (error) {
            handleApiError(error, 'Failed to send direct message');
        }
    }
    
    function renderDirectMessages(conversationId) {
        const conversationMessages = messages[conversationId] || [];
        
        messagesContainer.innerHTML = conversationMessages.map(msg => {
            const isOwnMessage = msg.sender_id === currentUser?.id;
            const messageClass = isOwnMessage ? 'message-sent' : 'message-received';
            const senderName = msg.sender_username || 'Unknown';
            const messageTime = formatMessageTime(new Date(msg.created_at));
            
            return `
                <div class="message ${messageClass}">
                    <div class="message-content">
                        ${!isOwnMessage ? `<div class="message-sender">${senderName}</div>` : ''}
                        <div class="message-text">${msg.content}</div>
                        <div class="message-time">${messageTime}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Called when switching back to All tab to ensure data is loaded
    async function loadChatGroups() {
        return fetchUserGroups();
    }
    
    // Ensure user has a welcome direct message from admin
    async function ensureWelcomeDirectMessage() {
        try {
            // Only proceed if user is authenticated and not an admin
            if (!currentUser || currentUser.role === 'admin') {
                return;
            }
            
            // Check if user already has any direct messages
            const hasDirectMessages = groups.some(group => group.type === 'direct');
            
            if (!hasDirectMessages) {
                console.log('No direct messages found, creating welcome message...');
                
                const token = getAuthToken();
                
                // Create a welcome direct message from admin
                const response = await fetch('/api/chat/welcome-message', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const welcomeConversation = await response.json();
                    console.log('Welcome direct message created:', welcomeConversation);
                    
                    // Add the new conversation to our groups list
                    groups.push(welcomeConversation);
                } else {
                    console.warn('Failed to create welcome message:', response.status);
                }
            }
        } catch (error) {
            console.error('Error creating welcome message:', error);
            // Don't show error to user as this is not critical
        }
    }
    
    // UI Updates
    function renderChatsList(chats = []) {
        console.log('renderChatsList called with:', chats.length, 'conversations');
        
        if (!Array.isArray(chats)) {
            console.warn('renderChatsList called with non-array data:', chats);
            chats = [];
        }
        
        if (!chats.length) {
            chatsList.innerHTML = '<div class="no-chats">No conversations available</div>';
            return;
        }
        
        chatsList.innerHTML = chats.map(chat => {
            const lastMessageTime = chat.last_message ? 
                formatMessageTime(new Date(chat.last_message.created_at)) : '';
            
            const lastMessageContent = chat.last_message ? 
                chat.last_message.content : 'No messages yet';
            
            // Simplified unread badge - don't rely on complex unread_count logic
            const unreadBadge = '';
            
            // Rename all group chats to "PEA communication" for client view
            // Keep direct messages with their original names
            const displayName = chat.type === 'direct' ? chat.name : 'PEA communication';
            
            // Simple user icon for all chat types
            const icon = '<i class="fas fa-user"></i>';
                
            return `
                <div class="chat-item" data-chat-id="${chat.id}" data-chat-type="${chat.type || 'group'}">
                    <div class="chat-item-avatar">
                        <img src="${chat.avatar_url || '../assets/uploads/user.jpg'}" alt="${displayName}">
                        <div class="chat-type-indicator">${icon}</div>
                    </div>
                    <div class="chat-item-content">
                        <div class="chat-item-header">
                            <span class="chat-item-name">${displayName}</span>
                            <span class="chat-item-time">${lastMessageTime}</span>
                        </div>
                        <div class="chat-item-message">
                            ${lastMessageContent}
                        </div>
                    </div>
                    ${unreadBadge}
                </div>
            `;
        }).join('');

        // Add click handlers to chat items
        document.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.dataset.chatId;
                const chatType = item.dataset.chatType;
                openChat(chatId, chatType);
                
                // Mark as active
                document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                
                // Remove unread badge
                const unreadBadge = item.querySelector('.unread-badge');
                if (unreadBadge) {
                    unreadBadge.remove();
                }
            });
        });
    }
    
    function openChat(chatId, chatType = 'group') {
        // Leave previous room if active
        if (socket && activeGroupId) {
            if (activeChatType === 'direct') {
                socket.emit('leave-conversation', activeGroupId);
            } else {
                socket.emit('leave-group', activeGroupId);
            }
        }
        
        // Update active chat ID and type
        activeGroupId = chatId;
        activeChatType = chatType;
        
        // Join new room
        if (socket) {
            if (chatType === 'direct') {
                socket.emit('join-conversation', chatId);
            } else {
                socket.emit('join-group', chatId);
            }
        }
        
        // Fetch chat details and messages based on type
        if (chatType === 'direct') {
            fetchDirectConversationDetails(chatId);
            fetchDirectMessages(chatId);
        } else {
            fetchGroupDetails(chatId);
            fetchGroupMessages(chatId);
        }
        
        // Update UI
        chatDefaultState.classList.add('hidden');
        chatActiveState.classList.remove('hidden');
    }
    
    function updateChatHeader(group) {
        // Show "PEA communication" for groups, original name for direct messages
        const displayName = activeChatType === 'direct' ? group.name : 'PEA communication';
        document.getElementById('contactName').textContent = displayName;
        
        // Set avatar if available
        const avatarElement = document.getElementById('contactAvatar');
        avatarElement.src = group.avatar_url || '../assets/uploads/user.jpg';
        
        // Set status text
        const statusElement = document.getElementById('contactStatus');
        if (activeChatType === 'direct') {
            statusElement.textContent = 'Direct Message';
        } else {
            statusElement.textContent = `${group.member_count || 0} members`;
        }
        
        // Add admin actions if user is admin
        const headerActions = document.querySelector('.chat-header-actions');
        
        // Remove any existing admin buttons
        const existingSwitchBtn = document.getElementById('switchUserBtn');
        const existingMembersBtn = document.getElementById('viewMembersBtn');
        if (existingSwitchBtn) existingSwitchBtn.remove();
        if (existingMembersBtn) existingMembersBtn.remove();
        
        // Add view members button for groups (not direct messages)
        if (activeChatType === 'group') {
            const viewMembersBtn = document.createElement('button');
            viewMembersBtn.className = 'btn-icon';
            viewMembersBtn.id = 'viewMembersBtn';
            viewMembersBtn.title = 'View group members';
            viewMembersBtn.innerHTML = '<i class="fas fa-users"></i>';
            viewMembersBtn.addEventListener('click', () => showGroupMembers(activeGroupId));
            
            headerActions.insertBefore(viewMembersBtn, headerActions.firstChild);
        }
        
        // Add switch user button for admins
        if (isUserAdmin()) {
            const switchUserBtn = document.createElement('button');
            switchUserBtn.className = 'btn-icon';
            switchUserBtn.id = 'switchUserBtn';
            switchUserBtn.title = 'Message as different user';
            switchUserBtn.innerHTML = '<i class="fas fa-user-friends"></i>';
            switchUserBtn.addEventListener('click', createFakeUserSelector);
            
            headerActions.insertBefore(switchUserBtn, headerActions.firstChild);
        }
    }
    
    function renderMessages(groupId) {
        const groupMessages = messages[groupId] || [];
        
        // Clear messages container
        messagesContainer.innerHTML = '';
        
        if (groupMessages.length === 0) {
            messagesContainer.innerHTML = '<div class="no-messages">No messages yet</div>';
            return;
        }
        
        // Render messages
        groupMessages.forEach(message => {
            const messageElement = createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function createMessageElement(message) {
        const messageElement = document.createElement('div');
        
        // Determine if message is sent by current user
        const isSentByMe = message.user_id === currentUser.id;
        const isFakeUser = message.fake_user_id !== null;
        
        messageElement.className = `message ${isSentByMe ? 'sent' : 'received'}`;
        
        // Add sender info for received messages in groups - make it more human
        if (!isSentByMe) {
            let senderName;
            
            if (isFakeUser) {
                // For fake users (admin responses), use human-like names
                senderName = message.fake_user_display_name || 'Support Agent';
            } else {
                // For real users, use their username or a generic name
                senderName = message.user_username || 'Team Member';
            }
            
            // Only show sender name if it's not a bot-like name
            if (senderName && !senderName.toLowerCase().includes('bot')) {
                const senderElement = document.createElement('div');
                senderElement.className = 'message-sender';
                senderElement.textContent = senderName;
                messageElement.appendChild(senderElement);
            }
        }
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = message.content;
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = formatMessageTime(new Date(message.created_at));
        
        messageContent.appendChild(messageText);
        messageContent.appendChild(messageTime);
        messageElement.appendChild(messageContent);
        
        // Add media if present
        if (message.media_url) {
            const mediaElement = createMediaElement(message.media_url, message.media_type);
            if (mediaElement) {
                messageContent.insertBefore(mediaElement, messageText);
            }
        }
        
        return messageElement;
    }
    
    function createMediaElement(mediaUrl, mediaType) {
        if (!mediaUrl) return null;
        
        const mediaContainer = document.createElement('div');
        mediaContainer.className = 'message-media';
        
        if (mediaType && mediaType.startsWith('image/')) {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';
            
            const img = document.createElement('img');
            img.src = mediaUrl;
            img.alt = 'Image attachment';
            img.className = 'message-image';
            img.addEventListener('click', () => {
                // Implement lightbox or preview
                window.open(mediaUrl, '_blank');
            });
            
            imageContainer.appendChild(img);
            mediaContainer.appendChild(imageContainer);
        } else if (mediaType && mediaType.startsWith('video/')) {
            const videoContainer = document.createElement('div');
            videoContainer.className = 'video-container';
            
            const video = document.createElement('video');
            video.src = mediaUrl;
            video.controls = true;
            video.className = 'message-video';
            
            videoContainer.appendChild(video);
            mediaContainer.appendChild(videoContainer);
        } else {
            // File attachment
            const fileLink = document.createElement('a');
            fileLink.href = mediaUrl;
            fileLink.className = 'file-attachment';
            fileLink.target = '_blank';
            fileLink.innerHTML = `<i class="fas fa-file"></i> Download attachment`;
            mediaContainer.appendChild(fileLink);
        }
        
        return mediaContainer;
    }
    
    function updateChatWithLatestMessage(message) {
        // Find the chat item
        const chatItem = document.querySelector(`.chat-item[data-chat-id="${message.group_id}"]`);
        if (!chatItem) return;
        
        // Update last message
        const lastMessageElement = chatItem.querySelector('.chat-item-message');
        if (lastMessageElement) {
            lastMessageElement.textContent = message.content;
        }
        
        // Update time
        const timeElement = chatItem.querySelector('.chat-item-time');
        if (timeElement) {
            timeElement.textContent = formatMessageTime(new Date(message.created_at));
        }
        
        // Update unread count if not the active chat
        if (message.group_id !== activeGroupId && message.user_id !== currentUser.id) {
            let unreadBadge = chatItem.querySelector('.unread-badge');
            
            if (!unreadBadge) {
                unreadBadge = document.createElement('span');
                unreadBadge.className = 'unread-badge';
                unreadBadge.textContent = '1';
                chatItem.appendChild(unreadBadge);
            } else {
                const count = parseInt(unreadBadge.textContent) || 0;
                unreadBadge.textContent = (count + 1).toString();
            }
        }
        
        // Move chat to top of list
        const parent = chatItem.parentNode;
        parent.insertBefore(chatItem, parent.firstChild);
    }
    
    function addMessageToChat(message) {
        // Only add if it's for the active group
        if (message.group_id !== activeGroupId) return;
        
        // Add to messages array
        if (!messages[activeGroupId]) {
            messages[activeGroupId] = [];
        }
        messages[activeGroupId].push(message);
        
        // Add message to UI
        const messageElement = createMessageElement(message);
        messagesContainer.appendChild(messageElement);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function addDirectMessageToChat(message) {
        // Only add if it's for the active conversation
        if (activeChatType !== 'direct' || message.conversation_id !== activeGroupId) return;
        
        // Add to messages array
        if (!messages[activeGroupId]) {
            messages[activeGroupId] = [];
        }
        messages[activeGroupId].push(message);
        
        // Add message to UI if we're viewing direct messages
        if (activeChatType === 'direct') {
            const messageElement = createDirectMessageElement(message);
            messagesContainer.appendChild(messageElement);
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    function createDirectMessageElement(message) {
        const isOwnMessage = message.sender_id === currentUser?.id;
        const messageClass = isOwnMessage ? 'message-sent' : 'message-received';
        const senderName = message.sender_username || 'Unknown';
        const messageTime = formatMessageTime(new Date(message.created_at));
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${messageClass}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Add sender name for received messages
        if (!isOwnMessage) {
            const senderElement = document.createElement('div');
            senderElement.className = 'message-sender';
            senderElement.textContent = senderName;
            messageContent.appendChild(senderElement);
        }
        
        // Add media if present
        if (message.media_url) {
            const mediaElement = createMediaElement(message.media_url, message.media_type);
            if (mediaElement) {
                messageContent.appendChild(mediaElement);
            }
        }
        
        // Add text content if present
        if (message.content) {
            const textElement = document.createElement('div');
            textElement.className = 'message-text';
            textElement.textContent = message.content;
            messageContent.appendChild(textElement);
        }
        
        // Add timestamp
        const timeElement = document.createElement('div');
        timeElement.className = 'message-time';
        timeElement.textContent = messageTime;
        messageContent.appendChild(timeElement);
        
        messageElement.appendChild(messageContent);
        return messageElement;
    }
    
    function updateConversationWithLatestMessage(message) {
        // Find and update the conversation in the groups array
        const conversationIndex = groups.findIndex(g => 
            g.type === 'direct' && g.id === message.conversation_id
        );
        
        if (conversationIndex !== -1) {
            groups[conversationIndex].last_message = {
                content: message.content,
                created_at: message.created_at
            };
            
            // If message is not from current user, increment unread count
            if (message.sender_id !== currentUser?.id) {
                groups[conversationIndex].unread_count = 
                    (groups[conversationIndex].unread_count || 0) + 1;
            }
            
            // Re-render the chat list to show updated conversation
            renderChatsList(groups);
        }
    }
    
    function showTypingIndicator(data) {
        // Only show for active group
        if (data.group_id !== activeGroupId) return;
        
        // Don't show for current user
        if (data.user_id === currentUser.id) return;
        
        // Create or update typing indicator
        let typingIndicator = document.getElementById('typingIndicator');
        
        if (!typingIndicator) {
            typingIndicator = document.createElement('div');
            typingIndicator.id = 'typingIndicator';
            typingIndicator.className = 'typing-indicator';
            messagesContainer.appendChild(typingIndicator);
        }
        
        // Show username
        typingIndicator.textContent = `${data.username} is typing...`;
        
        // Clear after 3 seconds
        setTimeout(() => {
            if (typingIndicator.parentNode) {
                typingIndicator.remove();
            }
        }, 3000);
    }
    
    function updateReadReceipts(data) {
        // Implementation depends on UI design requirements
        console.log('Message read:', data);
    }
    
    // Create loading indicator
    function createLoadingIndicator(message = 'Loading...') {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="spinner"></div>
            <span>${message}</span>
        `;
        return loadingIndicator;
    }
    
    // Show loading indicator in messages container
    function showMessageLoading() {
        const loadingIndicator = createLoadingIndicator('Loading messages...');
        messagesContainer.appendChild(loadingIndicator);
        return loadingIndicator;
    }
    
    // Show loading indicator in groups container
    function showGroupsLoading() {
        chatsList.innerHTML = '';
        const loadingIndicator = createLoadingIndicator('Loading chats...');
        chatsList.appendChild(loadingIndicator);
        return loadingIndicator;
    }
    
    // Refresh the chat interface
    function refreshChat() {
        console.log('Manual chat refresh triggered');
        
        // If we have an active group, refresh it
        if (activeGroupId) {
            if (activeChatType === 'direct') {
                fetchDirectConversationDetails(activeGroupId);
                fetchDirectMessages(activeGroupId);
            } else {
                fetchGroupDetails(activeGroupId);
                fetchGroupMessages(activeGroupId);
            }
        }
        
        // Always refresh the groups list to get latest conversations
        fetchUserGroups();
        
        // Show notification that refresh is happening
        showNotification('Refreshing chat data...', 'info');
    }
    
    // Add refresh button to the sidebar
    function setupRefreshButton() {
        const refreshBtn = document.querySelector('.sidebar-header .btn-icon[title="Refresh"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', refreshChat);
        }
    }
    
    // Utility functions
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
    
    // User actions
    async function sendMessage() {
        const content = messageInput.value.trim();
        
        // Check if we have either content or a file
        if ((!content && !selectedFile) || !activeGroupId) return;
        
        // Show sending indicator
        const sendingIndicator = document.createElement('div');
        sendingIndicator.className = 'sending-indicator';
        sendingIndicator.textContent = 'Sending...';
        messagesContainer.appendChild(sendingIndicator);
        
        try {
            let mediaUrl = null;
            let mediaType = null;
            
            // If we have a file, upload it first (for both group chats and direct messages)
            if (selectedFile) {
                console.log('Uploading file:', selectedFile.name);
                
                const formData = new FormData();
                formData.append('file', selectedFile);
                
                const token = getAuthToken();
                
                try {
                    const response = await fetch('/api/chat/upload', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
                    }
                    
                    const uploadData = await response.json();
                    mediaUrl = uploadData.url;
                    mediaType = selectedFile.type;
                    console.log('File uploaded successfully:', mediaUrl);
                } catch (uploadError) {
                    console.error('File upload error:', uploadError);
                    throw new Error(`Failed to upload file: ${uploadError.message}`);
                }
            }
            
            // Send the message based on chat type
            if (activeChatType === 'direct') {
                await sendDirectMessageToServer(activeGroupId, content, mediaUrl, mediaType);
            } else {
                await sendMessageToServer(activeGroupId, content, mediaUrl, mediaType);
            }
            
            // Clear input and file
            messageInput.value = '';
            clearSelectedFile();
            
        } catch (error) {
            console.error('Error sending message:', error);
            showNotification('Failed to send message. Please try again.', 'error');
        } finally {
            // Remove sending indicator
            if (sendingIndicator && sendingIndicator.parentNode) {
                sendingIndicator.parentNode.removeChild(sendingIndicator);
            }
        }
    }
    
    function notifyTyping() {
        if (!socket || !activeGroupId) return;
        
        // Clear existing timeout
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        
        // Set new timeout to limit typing events
        typingTimeout = setTimeout(() => {
            socket.emit('typing', {
                group_id: activeGroupId
            });
        }, 500); // Wait 500ms before sending typing event
    }
    
    // Filter chats
    function filterChats(query) {
        if (!query) {
            renderChatsList(groups);
            return;
        }
        
        const filteredGroups = groups.filter(group => 
            group.name.toLowerCase().includes(query.toLowerCase()) || 
            (group.last_message && group.last_message.content.toLowerCase().includes(query.toLowerCase()))
        );
        
        renderChatsList(filteredGroups);
    }
    
    // Tab switching
    function setupTabEvents() {
        tabButtons.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabText = tab.textContent.trim().toLowerCase();
                console.log('Tab clicked:', tabText);
                
                // Remove active class from all tabs
                tabButtons.forEach(t => t.classList.remove('active'));
                
                // Add active class to clicked tab
                tab.classList.add('active');
                
                // Check if data is loaded before filtering
                if (!isDataLoaded) {
                    console.log('Data not loaded yet, waiting...');
                    return;
                }
                
                // Simple filtering - only groups or direct
                let filteredGroups = [];
                
                if (tabText === 'groups') {
                    // Show only group chats
                    filteredGroups = groups.filter(group => group.type === 'group' || !group.type);
                } else if (tabText === 'direct') {
                    // Show only direct messages
                    filteredGroups = groups.filter(group => group.type === 'direct');
                }
                
                console.log(`Showing ${tabText} conversations:`, filteredGroups.length, 'from total:', groups.length);
                renderChatsList(filteredGroups);
            });
        });
    }
    
    // Event Listeners
    function setupEventListeners() {
        // Send button
        sendButton.addEventListener('click', sendMessage);
        
        // Enter key in input
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            } else {
                notifyTyping();
            }
        });
        
        // Search input
        searchInput.addEventListener('input', (e) => {
            filterChats(e.target.value);
        });
        
        // Attach file button
        if (attachFileButton) {
            attachFileButton.addEventListener('click', () => {
                console.log('Attach file button clicked');
                // Create file input if it doesn't exist
                if (!fileInput) {
                    createFileInput();
                }
                fileInput.click();
            });
        } else {
            console.warn('Attach file button not found');
        }
    }
    
    // Create a hidden file input element
    function createFileInput() {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/jpeg,image/png,image/gif,image/webp';
        fileInput.style.display = 'none';
        fileInput.multiple = false;
        
        // Add to DOM
        document.body.appendChild(fileInput);
        
        // Add event listener
        fileInput.addEventListener('change', handleFileSelection);
    }
    
    // Handle file selection
    function handleFileSelection(event) {
        if (event.target.files.length === 0) return;
        
        selectedFile = event.target.files[0];
        
        // Check file size (max 5MB)
        if (selectedFile.size > 5 * 1024 * 1024) {
            showNotification('File size exceeds 5MB limit', 'error');
            clearFileSelection();
            return;
        }
        
        // Check file type
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(selectedFile.type)) {
            showNotification('Only JPEG, PNG, GIF, and WebP images are allowed', 'error');
            clearFileSelection();
            return;
        }
        
        // Create preview
        createFilePreview();
    }
    
    // Create preview for selected file
    function createFilePreview() {
        // Clear existing preview
        clearFilePreview();
        
        // Create preview container
        filePreview = document.createElement('div');
        filePreview.className = 'file-preview';
        
        // Create preview content
        const previewContent = document.createElement('div');
        previewContent.className = 'preview-content';
        
        // Create image preview
        if (selectedFile.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.className = 'preview-image';
            
            // Use FileReader to load image
            const reader = new FileReader();
            reader.onload = function(e) {
                img.src = e.target.result;
            };
            reader.readAsDataURL(selectedFile);
            
            previewContent.appendChild(img);
        } else {
            // Generic file icon for non-images
            const fileIcon = document.createElement('div');
            fileIcon.className = 'file-icon';
            fileIcon.innerHTML = '<i class="fas fa-file"></i>';
            previewContent.appendChild(fileIcon);
        }
        
        // File info
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.textContent = selectedFile.name;
        previewContent.appendChild(fileInfo);
        
        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.addEventListener('click', clearFileSelection);
        
        // Add all elements to preview
        filePreview.appendChild(previewContent);
        filePreview.appendChild(removeBtn);
        
        // Add preview to DOM
        const inputArea = document.querySelector('.chat-input-area');
        inputArea.insertBefore(filePreview, messageInput);
    }
    
    // Clear file selection
    function clearFileSelection() {
        selectedFile = null;
        if (fileInput) {
            fileInput.value = '';
        }
        clearFilePreview();
    }
    
    // Clear file preview
    function clearFilePreview() {
        if (filePreview && filePreview.parentNode) {
            filePreview.parentNode.removeChild(filePreview);
        }
        filePreview = null;
    }
    
    // Clear selected file
    function clearSelectedFile() {
        selectedFile = null;
        clearFilePreview();
        if (fileInput) {
            fileInput.value = '';
        }
    }
    
    // Admin-specific functions
    
    // Function to check if current user is admin
    function isUserAdmin() {
        return currentUser && currentUser.role === 'admin';
    }
    
    // Fetch fake users for a group (admin only)
    async function fetchGroupFakeUsers(groupId) {
        if (!isUserAdmin()) return [];
        
        try {
            const token = getAuthToken();
            
            const response = await fetch(`/api/chat/groups/${groupId}/fake-users`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            handleApiError(error, 'Failed to fetch fake users');
            return [];
        }
    }
    
    // Create fake user selector for admin
    async function createFakeUserSelector() {
        if (!isUserAdmin() || !activeGroupId) return;
        
        // Get fake users for this group
        const fakeUsers = await fetchGroupFakeUsers(activeGroupId);
        
        if (!fakeUsers.length) {
            console.log('No fake users available for this group');
            return;
        }
        
        // Create selector UI
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'fake-user-selector';
        selectorContainer.innerHTML = `
            <div class="selector-header">
                <span>Message as:</span>
                <button class="close-selector"><i class="fas fa-times"></i></button>
            </div>
            <div class="selector-content">
                <div class="selector-option active" data-user-id="self">
                    <div class="selector-avatar">
                        <img src="../assets/uploads/user.jpg" alt="${currentUser.username}">
                    </div>
                    <div class="selector-name">Yourself (${currentUser.username})</div>
                </div>
                ${fakeUsers.map(user => `
                    <div class="selector-option" data-user-id="${user.id}">
                        <div class="selector-avatar">
                            <img src="${user.avatar_url || '../assets/uploads/user.jpg'}" alt="${user.display_name}">
                        </div>
                        <div class="selector-name">${user.display_name}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Add to chat header
        const chatHeader = document.querySelector('.chat-header');
        chatHeader.appendChild(selectorContainer);
        
        // Add event listeners
        const closeBtn = selectorContainer.querySelector('.close-selector');
        closeBtn.addEventListener('click', () => {
            selectorContainer.remove();
        });
        
        const options = selectorContainer.querySelectorAll('.selector-option');
        options.forEach(option => {
            option.addEventListener('click', () => {
                // Remove active class from all options
                options.forEach(opt => opt.classList.remove('active'));
                
                // Add active class to clicked option
                option.classList.add('active');
                
                // Set active fake user ID
                const fakeUserId = option.dataset.userId;
                
                if (fakeUserId === 'self') {
                    // Reset to sending as self
                    window.activeFakeUserId = null;
                    showNotification('Now messaging as yourself', 'info');
                } else {
                    // Set fake user ID for sending messages
                    window.activeFakeUserId = fakeUserId;
                    const userName = option.querySelector('.selector-name').textContent;
                    showNotification(`Now messaging as ${userName}`, 'info');
                }
                
                // Close selector
                selectorContainer.remove();
            });
        });
    }
    
    // Update the sendMessage function to use the selected fake user
    async function sendMessageWithFakeUser(groupId, content, mediaUrl, mediaType) {
        // If admin has selected a fake user, use that ID
        const fakeUserId = window.activeFakeUserId || null;
        return sendMessageToServer(groupId, content, mediaUrl, mediaType, fakeUserId);
    }
    
    // Initialize
    function init() {
        // Debug localStorage and cookies
        debugStorageAndCookies();
        
        connectToSocketServer();
        
        // Set up event listeners first
        setupEventListeners();
        setupRefreshButton();
        
        // Set up tab events BEFORE connecting to avoid race conditions
        setupTabEvents();
        
        // Ensure "Groups" tab is active on init (but don't trigger click event)
        const groupsTab = document.querySelector('.tab');
        if (groupsTab && !groupsTab.classList.contains('active')) {
            // Remove active from any other tabs
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            // Set first tab (Groups) as active
            groupsTab.classList.add('active');
        }
        
        // Set up periodic refresh to keep data fresh (every 30 seconds)
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                // Only refresh if page is visible and we haven't refreshed recently
                const lastRefresh = window.lastChatRefresh || 0;
                const now = Date.now();
                if (now - lastRefresh > 30000) { // 30 seconds
                    window.lastChatRefresh = now;
                    console.log('Periodic refresh: refreshing chat data');
                    fetchUserGroups();
                }
            }
        }, 30000); // 30 seconds
    }
    
    // Debug function to inspect what's in localStorage and cookies
    function debugStorageAndCookies() {
        console.log('====== DEBUGGING AUTH STORAGE ======');
        
        // Display all localStorage items
        console.log('localStorage items:');
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Don't log actual token values for security
            const value = localStorage.getItem(key);
            const isSensitive = ['token', 'jwt', 'auth', 'password'].some(term => 
                key.toLowerCase().includes(term));
            
            console.log(`- ${key}: ${isSensitive ? '******' : value}`);
        }
        
        // Display all cookies
        console.log('Cookies:');
        const cookiesStr = document.cookie;
        if (cookiesStr) {
            const cookies = cookiesStr.split(';').map(cookie => cookie.trim());
            cookies.forEach(cookie => {
                const parts = cookie.split('=');
                const name = parts[0];
                // Don't log actual token values for security
                const isSensitive = ['token', 'jwt', 'auth', 'password'].some(term => 
                    name.toLowerCase().includes(term));
                
                console.log(`- ${name}: ${isSensitive ? '******' : parts[1] || ''}`);
            });
        } else {
            console.log('No cookies found');
        }
        
        // Check specific auth items we're looking for
        const token = getAuthToken();
        console.log('Auth token found:', !!token);
        if (token) {
            // Show first few characters to help with debugging
            console.log('Token prefix:', token.substring(0, 5) + '...');
        }
        
        console.log('==================================');
    }
    init();
    
    // Show group members in a modal
    async function showGroupMembers(groupId) {
        try {
            const token = getAuthToken();
            
            const response = await fetch(`/api/chat/groups/${groupId}/members`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const members = await response.json();
            
            // Create modal
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Group Members</h3>
                        <button class="btn-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="members-list">
                            ${members.map(member => `
                                <div class="member-item" data-user-id="${member.id}">
                                    <div class="member-avatar">
                                        <img src="${member.avatar_url || '../assets/uploads/user.jpg'}" 
                                             alt="${member.name}" />
                                    </div>
                                    <div class="member-info">
                                        <div class="member-name">${member.name}</div>
                                        <div class="member-role">${member.role || 'Member'}</div>
                                    </div>
                                    <div class="member-actions">
                                        <button class="btn-message" 
                                                onclick="startDirectConversation(${member.id}, '${member.name}')">
                                            <i class="fas fa-comment"></i> Message
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            
            // Add close functionality
            modal.querySelector('.btn-close').addEventListener('click', () => {
                modal.remove();
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            document.body.appendChild(modal);
            
        } catch (error) {
            handleApiError(error, 'Failed to fetch group members');
        }
    }
    
    // Start a direct conversation with a user
    async function startDirectConversation(userId, userName) {
        try {
            const token = getAuthToken();
            
            // First, create or get existing conversation
            const response = await fetch('/api/chat/conversations/direct', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ recipient_id: userId })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const conversation = await response.json();
            
            // Close members modal if open
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                modal.remove();
            }
            
            // Switch to direct message chat
            openChat(conversation.id, 'direct');
            
            // Update the conversations list to show the new direct message
            await loadChatGroups(); // This will refresh the sidebar with the new conversation
            
            // Mark the new conversation as active in the sidebar
            setTimeout(() => {
                const chatItem = document.querySelector(`[data-chat-id="${conversation.id}"][data-chat-type="direct"]`);
                if (chatItem) {
                    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
                    chatItem.classList.add('active');
                }
            }, 100);
            
        } catch (error) {
            handleApiError(error, 'Failed to start direct conversation');
        }
    }
}
