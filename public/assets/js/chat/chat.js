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
    
    // Socket.IO connection
    let socket;
    let currentUser = null;
    let activeGroupId = null;
    let groups = [];
    let activeGroup = null;
    let messages = {};
    
    // Error handling and notifications
    function showNotification(message, type = 'info') {
        // Simple alert for now, can be replaced with a more sophisticated notification system
        if (type === 'error') {
            console.error(message);
            alert(`Error: ${message}`);
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
                showNotification('Error connecting to chat server: ' + error.message, 'error');
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
                // Show an empty groups list with a message
                renderChatsList([]);
                return;
            }
            
            let response;
            let data;
            
            try {
                response = await fetch('/api/chat/groups', {
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
                console.warn('Failed to fetch user groups from /api/chat/groups, trying alternative endpoint');
            }
            
            // Try alternative endpoint
            if (!data) {
                try {
                    response = await fetch('/api/chat', {
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
                    console.warn('Failed to fetch user groups from /api/chat');
                }
            }
            
            if (data) {
                groups = Array.isArray(data) ? data : (data.groups || []);
                console.log(`Fetched ${groups.length} groups`);
                renderChatsList(groups);
            } else {
                // If no data, create sample groups for testing
                console.warn('No groups data received, using sample data for testing');
                groups = createSampleGroups();
                renderChatsList(groups);
            }
            
        } catch (error) {
            handleApiError(error, 'Failed to fetch chat groups');
            // Provide sample data as fallback
            groups = createSampleGroups();
            renderChatsList(groups);
        }
    }
    
    // Creates sample groups for testing when API fails
    function createSampleGroups() {
        return [
            {
                id: 1,
                name: 'Support Team',
                avatar_url: '../assets/uploads/user.jpg',
                last_message: {
                    content: 'Welcome to the chat!',
                    created_at: new Date().toISOString()
                },
                unread_count: 1,
                group_type: 'SUPPORT'
            },
            {
                id: 2,
                name: 'Marketing Group',
                avatar_url: '../assets/uploads/user.jpg',
                last_message: {
                    content: 'Check out our new campaign',
                    created_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
                },
                unread_count: 0,
                group_type: 'GROUP'
            }
        ];
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
            
            const response = await fetch(`/api/chat/groups/${groupId}/messages`, {
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
    
    // UI Updates
    function renderChatsList(chats = []) {
        if (!chats.length) {
            chatsList.innerHTML = '<div class="no-chats">No chats available</div>';
            return;
        }
        
        chatsList.innerHTML = chats.map(chat => {
            const lastMessageTime = chat.last_message ? 
                formatMessageTime(new Date(chat.last_message.created_at)) : '';
            
            const lastMessageContent = chat.last_message ? 
                chat.last_message.content : 'No messages yet';
            
            const unreadBadge = chat.unread_count > 0 ? 
                `<span class="unread-badge">${chat.unread_count}</span>` : '';
                
            return `
                <div class="chat-item" data-chat-id="${chat.id}">
                    <div class="chat-item-avatar">
                        <img src="${chat.avatar_url || '../assets/uploads/user.jpg'}" alt="${chat.name}">
                    </div>
                    <div class="chat-item-content">
                        <div class="chat-item-header">
                            <span class="chat-item-name">${chat.name}</span>
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
                openChat(chatId);
                
                // Mark as active
                document.querySelectorAll('.chat-item').forEach(el => {
                    el.classList.remove('active');
                });
                item.classList.add('active');
                
                // Remove unread badge
                const unreadBadge = item.querySelector('.unread-badge');
                if (unreadBadge) {
                    unreadBadge.remove();
                }
            });
        });
    }
    
    function openChat(groupId) {
        // Update active group ID
        activeGroupId = groupId;
        
        // Fetch group details and messages
        fetchGroupDetails(groupId);
        fetchGroupMessages(groupId);
        
        // Update UI
        chatDefaultState.classList.add('hidden');
        chatActiveState.classList.remove('hidden');
    }
    
    function updateChatHeader(group) {
        document.getElementById('contactName').textContent = group.name;
        
        // Set avatar if available
        const avatarElement = document.getElementById('contactAvatar');
        avatarElement.src = group.avatar_url || '../assets/uploads/user.jpg';
        
        // Set status text
        const statusElement = document.getElementById('contactStatus');
        statusElement.textContent = `${group.member_count || 0} members`;
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
        
        // Add sender info for received messages in groups
        if (!isSentByMe) {
            const senderName = isFakeUser ? 
                (message.fake_user_display_name || message.fake_user_username) : 
                message.user_username;
                
            if (senderName) {
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
            const img = document.createElement('img');
            img.src = mediaUrl;
            img.alt = 'Image attachment';
            img.addEventListener('click', () => {
                // Implement lightbox or preview
                window.open(mediaUrl, '_blank');
            });
            mediaContainer.appendChild(img);
        } else if (mediaType && mediaType.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = mediaUrl;
            video.controls = true;
            mediaContainer.appendChild(video);
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
    function sendMessage() {
        const content = messageInput.value.trim();
        if (!content || !activeGroupId) return;
        
        // TODO: Implement file upload and add mediaUrl and mediaType
        sendMessageToServer(activeGroupId, content);
        
        // Clear input
        messageInput.value = '';
        
        // No need to add to UI as it will come back via socket event
    }
    
    function notifyTyping() {
        if (!socket || !activeGroupId) return;
        
        socket.emit('typing', {
            group_id: activeGroupId
        });
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
                // Remove active class from all tabs
                tabButtons.forEach(t => t.classList.remove('active'));
                
                // Add active class to clicked tab
                tab.classList.add('active');
                
                // Filter chats based on tab
                const tabText = tab.textContent.trim().toLowerCase();
                let filteredGroups = [...groups];
                
                if (tabText === 'unread') {
                    filteredGroups = groups.filter(group => group.unread_count > 0);
                } else if (tabText === 'groups') {
                    filteredGroups = groups.filter(group => group.group_type === 'GROUP');
                } else if (tabText === 'favorites') {
                    // Implement favorites logic if needed
                    filteredGroups = groups.filter(group => group.is_favorite);
                }
                
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
        document.getElementById('attachFileButton').addEventListener('click', () => {
            // Implement file upload
            alert('File upload feature coming soon');
        });
        
        // Emoji button
        document.getElementById('emojiButton').addEventListener('click', () => {
            // Implement emoji selector
            alert('Emoji selector coming soon');
        });
    }
    
    // Initialize
    function init() {
        // Debug localStorage and cookies
        debugStorageAndCookies();
        
        connectToSocketServer();
        setupTabEvents();
        setupEventListeners();
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
}
