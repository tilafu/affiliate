/**
 * CDOT PEA Communication Admin Chat
 * This script handles the admin interface for managing chat groups and fake users
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated as admin
    checkAdminAuth()
        .then(isAuthenticated => {
            if (isAuthenticated) {
                initializeAdminChat();
            } else {
                window.location.href = 'admin.html';
            }
        })
        .catch(error => {
            console.error('Authentication check failed:', error);
            window.location.href = 'admin.html';
        });
});

function checkAdminAuth() {
    return new Promise((resolve, reject) => {
        const token = localStorage.getItem('adminToken');
        
        if (!token) {
            resolve(false);
            return;
        }
        
        fetch('/api/admin/auth/verify-token', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Authentication failed');
            }
        })
        .then(data => {
            if (data.authenticated) {
                const adminName = document.getElementById('adminName');
                if (adminName) {
                    adminName.textContent = data.username || 'Admin';
                }
                resolve(true);
            } else {
                resolve(false);
            }
        })
        .catch(error => {
            console.error('Auth verification error:', error);
            reject(error);
        });
    });
}

function initializeAdminChat() {
    // Elements
    const groupsList = document.getElementById('groupsList');
    const fakeUsersList = document.getElementById('fakeUsersList');
    const chatDefaultState = document.getElementById('chatDefaultState');
    const chatActiveState = document.getElementById('chatActiveState');
    const activeChatName = document.getElementById('activeChatName');
    const activeChatStatus = document.getElementById('activeChatStatus');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const fakeUserSelect = document.getElementById('fakeUserSelect');
    const selectedFakeUserAvatar = document.getElementById('selectedFakeUserAvatar');
    const viewMembersBtn = document.getElementById('viewMembersBtn');
    const chatSettingsBtn = document.getElementById('chatSettingsBtn');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const imageUploadInput = document.getElementById('imageUploadInput');
    
    // Modal buttons
    const createGroupBtn = document.getElementById('createGroupBtn');
    const saveGroupBtn = document.getElementById('saveGroupBtn');
    const createFakeUserBtn = document.getElementById('createFakeUserBtn');
    const saveFakeUserBtn = document.getElementById('saveFakeUserBtn');
    const addRealMemberBtn = document.getElementById('addRealMemberBtn');
    const addFakeMemberBtn = document.getElementById('addFakeMemberBtn');
    const addUserToGroupBtn = document.getElementById('addUserToGroupBtn');
    const addFakeUserToGroupBtn = document.getElementById('addFakeUserToGroupBtn');
    
    // Search inputs
    const groupSearchInput = document.getElementById('groupSearchInput');
    const fakeUserSearchInput = document.getElementById('fakeUserSearchInput');
    
    // Avatar preview for fake user creation
    const fakeUserAvatar = document.getElementById('fakeUserAvatar');
    const avatarPreview = document.getElementById('avatarPreview');
    
    // State
    let socket;
    let groups = [];
    let fakeUsers = [];
    let allUsers = [];
    let activeGroupId = null;
    let activeGroup = null;
    let groupMembers = { real: [], fake: [] };
    let selectedFakeUserId = null;
    let uploadedImageUrl = null;
    let uploadedImageType = null;
    
    // Initialize
    connectToSocketServer();
    loadGroups();
    loadFakeUsers();
    loadAllUsers();
    setupEventListeners();
    
    // Functions
    
    // Socket.IO connection
    function connectToSocketServer() {
        const token = localStorage.getItem('adminToken');
        
        if (!token) {
            showNotification('Admin token not found. Please log in again.', 'error');
            return;
        }
        
        try {
            socket = io({
                auth: {
                    token: token
                }
            });
            
            socket.on('connect', () => {
                console.log('Connected to chat server as admin');
            });
            
            socket.on('disconnect', () => {
                console.log('Disconnected from chat server');
            });
            
            socket.on('error', (error) => {
                console.error('Socket error:', error);
                showNotification('Socket error: ' + error.message, 'error');
            });
            
            socket.on('new-message', (message) => {
                if (activeGroupId === message.group_id) {
                    addMessageToChat(message);
                }
                
                // Update group in list with latest message
                updateGroupWithLatestMessage(message);
            });
            
            socket.on('message-deleted', (data) => {
                if (activeGroupId === data.group_id) {
                    const messageElement = document.querySelector(`.message[data-message-id="${data.message_id}"]`);
                    if (messageElement) {
                        messageElement.remove();
                    }
                }
            });
            
        } catch (error) {
            console.error('Error connecting to socket server:', error);
            showNotification('Failed to connect to chat server', 'error');
        }
    }
    
    // Load chat groups
    async function loadGroups() {
        try {
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch('/api/admin/chat/groups', {
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
            groups = data;
            
            renderGroupsList(groups);
            
        } catch (error) {
            console.error('Error loading groups:', error);
            showNotification('Failed to load chat groups', 'error');
            groupsList.innerHTML = '<div class="error-message">Failed to load groups. Please try again.</div>';
        }
    }
    
    // Load fake users
    async function loadFakeUsers() {
        try {
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch('/api/admin/chat/fake-users', {
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
            fakeUsers = data;
            
            renderFakeUsersList(fakeUsers);
            
        } catch (error) {
            console.error('Error loading fake users:', error);
            showNotification('Failed to load fake users', 'error');
            fakeUsersList.innerHTML = '<div class="error-message">Failed to load fake users. Please try again.</div>';
        }
    }
    
    // Load all real users for adding to groups
    async function loadAllUsers() {
        try {
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch('/api/admin/users', {
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
            allUsers = data;
            
            // Populate user select dropdowns
            populateUserDropdowns();
            
        } catch (error) {
            console.error('Error loading users:', error);
            showNotification('Failed to load users', 'error');
        }
    }
    
    // Populate user dropdowns in modals
    function populateUserDropdowns() {
        const userSelects = [
            document.getElementById('groupUser'),
            document.getElementById('userSelect')
        ];
        
        userSelects.forEach(select => {
            if (!select) return;
            
            // Clear existing options except the first one
            while (select.options.length > 1) {
                select.remove(1);
            }
            
            // Add user options
            allUsers.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.username}${user.full_name ? ` (${user.full_name})` : ''}`;
                select.appendChild(option);
            });
        });
    }
    
    // Render groups list
    function renderGroupsList(groups) {
        if (!groups || groups.length === 0) {
            groupsList.innerHTML = '<div class="no-groups">No groups available</div>';
            return;
        }
        
        groupsList.innerHTML = '';
        
        groups.forEach(group => {
            const groupItem = document.createElement('div');
            groupItem.className = 'chat-group-item';
            groupItem.dataset.groupId = group.id;
            
            if (activeGroupId === group.id) {
                groupItem.classList.add('active');
            }
            
            const lastMessageTime = group.last_message ? 
                formatMessageTime(new Date(group.last_message.created_at)) : '';
                
            const lastMessageContent = group.last_message ? 
                group.last_message.content : 'No messages yet';
                
            groupItem.innerHTML = `
                <div class="chat-group-avatar">
                    <img src="${group.avatar_url || '../assets/uploads/user.jpg'}" alt="${group.name}">
                </div>
                <div class="chat-group-details">
                    <div class="chat-group-name">${group.name}</div>
                    <div class="chat-group-info">
                        ${group.member_count || 0} members · ${lastMessageTime}
                    </div>
                    <div class="chat-group-last-message">${lastMessageContent}</div>
                </div>
            `;
            
            groupItem.addEventListener('click', () => {
                openChat(group.id);
                
                // Update active state in UI
                document.querySelectorAll('.chat-group-item').forEach(item => {
                    item.classList.remove('active');
                });
                groupItem.classList.add('active');
            });
            
            groupsList.appendChild(groupItem);
        });
    }
    
    // Render fake users list
    function renderFakeUsersList(users) {
        if (!users || users.length === 0) {
            fakeUsersList.innerHTML = '<div class="no-users">No fake users available</div>';
            return;
        }
        
        fakeUsersList.innerHTML = '';
        
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'fake-user-item';
            userItem.dataset.userId = user.id;
            
            userItem.innerHTML = `
                <div class="fake-user-avatar">
                    <img src="${user.avatar_url || '../assets/uploads/user.jpg'}" alt="${user.display_name}">
                </div>
                <div class="fake-user-details">
                    <div class="fake-user-name">${user.display_name}</div>
                    <div class="fake-user-role">${user.role || 'Member'}</div>
                </div>
            `;
            
            userItem.addEventListener('click', () => {
                // Show fake user details or edit modal
                editFakeUser(user.id);
            });
            
            fakeUsersList.appendChild(userItem);
        });
        
        // Also update fake user select in chat interface
        updateFakeUserSelect();
    }
    
    // Update fake user dropdown in chat interface
    function updateFakeUserSelect() {
        // Clear existing options except the first one
        while (fakeUserSelect.options.length > 1) {
            fakeUserSelect.remove(1);
        }
        
        // If no active group, just clear and return
        if (!activeGroupId) return;
        
        // Filter fake users that are in the active group
        const groupFakeUsers = groupMembers.fake || [];
        
        groupFakeUsers.forEach(member => {
            const user = fakeUsers.find(u => u.id === member.id);
            if (user) {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.display_name;
                option.dataset.avatarUrl = user.avatar_url || '../assets/uploads/user.jpg';
                fakeUserSelect.appendChild(option);
            }
        });
    }
    
    // Open a chat group
    function openChat(groupId) {
        // Set active group
        activeGroupId = groupId;
        activeGroup = groups.find(g => g.id === activeGroupId);
        
        // Update UI
        chatDefaultState.classList.add('hidden');
        chatActiveState.classList.remove('hidden');
        viewMembersBtn.disabled = false;
        chatSettingsBtn.disabled = false;
        
        // Update chat header
        if (activeGroup) {
            activeChatName.textContent = activeGroup.name;
            activeChatStatus.textContent = `${activeGroup.member_count || 0} members`;
        }
        
        // Join socket room for this group
        socket.emit('join-group', groupId);
        
        // Load group members and messages
        loadGroupMembers(groupId);
        loadGroupMessages(groupId);
        
        // Reset selected fake user
        fakeUserSelect.value = '';
        selectedFakeUserId = null;
        selectedFakeUserAvatar.innerHTML = '<img src="../assets/uploads/user.jpg" alt="Admin">';
        
        // Clear uploaded image
        uploadedImageUrl = null;
        uploadedImageType = null;
    }
    
    // Load group members
    async function loadGroupMembers(groupId) {
        try {
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch(`/api/admin/chat/groups/${groupId}/members`, {
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
            
            // Separate real and fake members
            groupMembers = {
                real: data.filter(m => m.type === 'real'),
                fake: data.filter(m => m.type === 'fake')
            };
            
            // Update fake user select
            updateFakeUserSelect();
            
        } catch (error) {
            console.error('Error loading group members:', error);
            showNotification('Failed to load group members', 'error');
        }
    }
    
    // Load group messages
    async function loadGroupMessages(groupId) {
        try {
            const token = localStorage.getItem('adminToken');
            
            // Clear messages container
            chatMessages.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>';
            
            const response = await fetch(`/api/admin/chat/groups/${groupId}/messages`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const messages = await response.json();
            
            // Render messages
            chatMessages.innerHTML = '';
            
            if (messages.length === 0) {
                chatMessages.innerHTML = '<div class="no-messages">No messages yet</div>';
                return;
            }
            
            messages.forEach(message => {
                addMessageToChat(message, false);
            });
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
        } catch (error) {
            console.error('Error loading messages:', error);
            showNotification('Failed to load messages', 'error');
            chatMessages.innerHTML = '<div class="error-message">Failed to load messages. Please try again.</div>';
        }
    }
    
    // Add a message to the chat
    function addMessageToChat(message, scroll = true) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        messageElement.dataset.messageId = message.id;
        
        // Determine message type (sent by admin, sent by user, or sent by fake user)
        const isSentByAdmin = message.admin_id !== null;
        const isSentByFakeUser = message.fake_user_id !== null;
        
        if (isSentByAdmin && !isSentByFakeUser) {
            messageElement.classList.add('sent', 'admin-message');
        } else if (isSentByFakeUser) {
            messageElement.classList.add('received');
        } else {
            messageElement.classList.add('received');
        }
        
        // Add sender info for fake users and real users
        let senderName = 'Unknown';
        
        if (isSentByFakeUser) {
            senderName = message.fake_user_display_name || 'Fake User';
        } else if (!isSentByAdmin) {
            senderName = message.user_username || 'User';
        } else {
            senderName = 'Admin';
        }
        
        // Create message HTML
        let messageHTML = '';
        
        if (!isSentByAdmin || isSentByFakeUser) {
            messageHTML += `<div class="message-sender">${senderName}</div>`;
        }
        
        messageHTML += '<div class="message-content">';
        
        // Add media if present
        if (message.media_url) {
            if (message.media_type && message.media_type.startsWith('image/')) {
                messageHTML += `
                    <div class="message-media">
                        <img src="${message.media_url}" alt="Image" onclick="window.open('${message.media_url}', '_blank')">
                    </div>
                `;
            } else {
                messageHTML += `
                    <div class="message-media">
                        <a href="${message.media_url}" target="_blank" class="file-attachment">
                            <i class="fas fa-file"></i> Download attachment
                        </a>
                    </div>
                `;
            }
        }
        
        messageHTML += `
            <div class="message-text">${message.content}</div>
            <div class="message-time">${formatMessageTime(new Date(message.created_at))}</div>
        `;
        
        messageHTML += '</div>';
        
        // Add delete button for admin
        messageHTML += `
            <div class="message-actions">
                <button class="delete-message-btn" title="Delete message">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        
        messageElement.innerHTML = messageHTML;
        
        // Add event listener for delete button
        const deleteBtn = messageElement.querySelector('.delete-message-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                deleteMessage(message.id);
            });
        }
        
        // Add to chat
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom if needed
        if (scroll) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    // Send a message
    async function sendMessage() {
        if (!activeGroupId) return;
        
        const content = messageInput.value.trim();
        if (!content && !uploadedImageUrl) {
            showNotification('Please enter a message or attach an image', 'error');
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            
            const messageData = {
                content: content,
                media_url: uploadedImageUrl,
                media_type: uploadedImageType
            };
            
            // If sending as a fake user
            if (selectedFakeUserId) {
                messageData.fake_user_id = selectedFakeUserId;
            }
            
            const response = await fetch(`/api/admin/chat/groups/${activeGroupId}/messages`, {
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
            
            // Clear input and uploaded image
            messageInput.value = '';
            uploadedImageUrl = null;
            uploadedImageType = null;
            
            // The message will be added via socket event
            
        } catch (error) {
            console.error('Error sending message:', error);
            showNotification('Failed to send message', 'error');
        }
    }
    
    // Delete a message
    async function deleteMessage(messageId) {
        if (!confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch(`/api/admin/chat/messages/${messageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Remove message from UI
            const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.remove();
            }
            
            showNotification('Message deleted successfully', 'success');
            
        } catch (error) {
            console.error('Error deleting message:', error);
            showNotification('Failed to delete message', 'error');
        }
    }
    
    // Create a new group
    async function createGroup() {
        const name = document.getElementById('groupName').value.trim();
        const description = document.getElementById('groupDescription').value.trim();
        const groupType = document.getElementById('groupType').value;
        const userId = document.getElementById('groupUser').value;
        
        if (!name) {
            showNotification('Group name is required', 'error');
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            
            const groupData = {
                name,
                description,
                group_type: groupType
            };
            
            if (userId) {
                groupData.user_id = userId;
            }
            
            const response = await fetch('/api/admin/chat/groups', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(groupData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const newGroup = await response.json();
            
            // Add to groups list and refresh
            groups.unshift(newGroup);
            renderGroupsList(groups);
            
            // Close modal
            $('#createGroupModal').modal('hide');
            
            // Reset form
            document.getElementById('createGroupForm').reset();
            
            showNotification('Group created successfully', 'success');
            
        } catch (error) {
            console.error('Error creating group:', error);
            showNotification('Failed to create group', 'error');
        }
    }
    
    // Create a new fake user
    async function createFakeUser() {
        const displayName = document.getElementById('fakeUserName').value.trim();
        const role = document.getElementById('fakeUserRole').value;
        const avatarFile = document.getElementById('fakeUserAvatar').files[0];
        
        if (!displayName) {
            showNotification('Display name is required', 'error');
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            
            // Create form data for file upload
            const formData = new FormData();
            formData.append('display_name', displayName);
            formData.append('role', role);
            
            if (avatarFile) {
                formData.append('avatar', avatarFile);
            }
            
            const response = await fetch('/api/admin/chat/fake-users', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const newUser = await response.json();
            
            // Add to fake users list and refresh
            fakeUsers.unshift(newUser);
            renderFakeUsersList(fakeUsers);
            
            // Close modal
            $('#createFakeUserModal').modal('hide');
            
            // Reset form
            document.getElementById('createFakeUserForm').reset();
            document.getElementById('avatarPreview').style.display = 'none';
            
            showNotification('Fake user created successfully', 'success');
            
        } catch (error) {
            console.error('Error creating fake user:', error);
            showNotification('Failed to create fake user', 'error');
        }
    }
    
    // Edit a fake user
    function editFakeUser(userId) {
        // This will be implemented later
        alert('Edit fake user functionality will be implemented soon.');
    }
    
    // Open group members modal
    async function openGroupMembersModal() {
        if (!activeGroupId) return;
        
        try {
            // Populate the tables
            const realMembersTable = document.getElementById('realMembersTable');
            const fakeMembersTable = document.getElementById('fakeMembersTable');
            
            realMembersTable.innerHTML = '<tr><td colspan="3">Loading members...</td></tr>';
            fakeMembersTable.innerHTML = '<tr><td colspan="3">Loading members...</td></tr>';
            
            // Load latest members
            await loadGroupMembers(activeGroupId);
            
            // Render real members
            if (groupMembers.real.length === 0) {
                realMembersTable.innerHTML = '<tr><td colspan="3">No real members</td></tr>';
            } else {
                realMembersTable.innerHTML = '';
                
                groupMembers.real.forEach(member => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td class="member-name-cell">
                            <img src="${member.avatar_url || '../assets/uploads/user.jpg'}" alt="${member.username}" class="member-avatar">
                            ${member.username}
                        </td>
                        <td>${member.group_role || 'Member'}</td>
                        <td>
                            <button class="btn btn-sm btn-danger remove-member-btn" data-user-id="${member.id}">
                                <i class="fas fa-times"></i> Remove
                            </button>
                        </td>
                    `;
                    
                    realMembersTable.appendChild(row);
                });
                
                // Add event listeners to remove buttons
                realMembersTable.querySelectorAll('.remove-member-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const userId = this.dataset.userId;
                        removeRealMember(userId);
                    });
                });
            }
            
            // Render fake members
            if (groupMembers.fake.length === 0) {
                fakeMembersTable.innerHTML = '<tr><td colspan="3">No fake members</td></tr>';
            } else {
                fakeMembersTable.innerHTML = '';
                
                groupMembers.fake.forEach(member => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td class="member-name-cell">
                            <img src="${member.avatar_url || '../assets/uploads/user.jpg'}" alt="${member.username}" class="member-avatar">
                            ${member.username}
                        </td>
                        <td>${member.role || 'Member'}</td>
                        <td>
                            <button class="btn btn-sm btn-danger remove-fake-member-btn" data-user-id="${member.id}">
                                <i class="fas fa-times"></i> Remove
                            </button>
                        </td>
                    `;
                    
                    fakeMembersTable.appendChild(row);
                });
                
                // Add event listeners to remove buttons
                fakeMembersTable.querySelectorAll('.remove-fake-member-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const userId = this.dataset.userId;
                        removeFakeMember(userId);
                    });
                });
            }
            
            // Show the modal
            $('#groupMembersModal').modal('show');
            
        } catch (error) {
            console.error('Error preparing members modal:', error);
            showNotification('Failed to load group members', 'error');
        }
    }
    
    // Add a real user to the group
    async function addRealMember() {
        if (!activeGroupId) return;
        
        const userId = document.getElementById('userSelect').value;
        const role = document.getElementById('userRole').value;
        
        if (!userId) {
            showNotification('Please select a user', 'error');
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch(`/api/admin/chat/groups/${activeGroupId}/members`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    role: role
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Refresh group members
            await loadGroupMembers(activeGroupId);
            
            // Close modal
            $('#addRealMemberModal').modal('hide');
            
            // Update group members modal
            openGroupMembersModal();
            
            showNotification('Member added successfully', 'success');
            
        } catch (error) {
            console.error('Error adding member:', error);
            showNotification('Failed to add member', 'error');
        }
    }
    
    // Remove a real user from the group
    async function removeRealMember(userId) {
        if (!activeGroupId || !userId) return;
        
        if (!confirm('Are you sure you want to remove this member from the group?')) {
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch(`/api/admin/chat/groups/${activeGroupId}/members/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Refresh group members
            await loadGroupMembers(activeGroupId);
            
            // Update group members modal
            openGroupMembersModal();
            
            showNotification('Member removed successfully', 'success');
            
        } catch (error) {
            console.error('Error removing member:', error);
            showNotification('Failed to remove member', 'error');
        }
    }
    
    // Add a fake user to the group
    async function addFakeMember() {
        if (!activeGroupId) return;
        
        const fakeUserId = document.getElementById('fakeUserSelect').value;
        
        if (!fakeUserId) {
            showNotification('Please select a fake user', 'error');
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch(`/api/admin/chat/groups/${activeGroupId}/fake-members`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fake_user_id: fakeUserId
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Refresh group members
            await loadGroupMembers(activeGroupId);
            
            // Close modal
            $('#addFakeMemberModal').modal('hide');
            
            // Update group members modal
            openGroupMembersModal();
            
            showNotification('Fake user added successfully', 'success');
            
        } catch (error) {
            console.error('Error adding fake user:', error);
            showNotification('Failed to add fake user', 'error');
        }
    }
    
    // Remove a fake user from the group
    async function removeFakeMember(fakeUserId) {
        if (!activeGroupId || !fakeUserId) return;
        
        if (!confirm('Are you sure you want to remove this fake user from the group?')) {
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch(`/api/admin/chat/groups/${activeGroupId}/fake-members/${fakeUserId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Refresh group members
            await loadGroupMembers(activeGroupId);
            
            // Update group members modal
            openGroupMembersModal();
            
            showNotification('Fake user removed successfully', 'success');
            
        } catch (error) {
            console.error('Error removing fake user:', error);
            showNotification('Failed to remove fake user', 'error');
        }
    }
    
    // Upload an image for a message
    async function uploadImage(file) {
        if (!file) return;
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showNotification('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.', 'error');
            return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showNotification('File too large. Maximum size is 5MB.', 'error');
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/admin/chat/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Store uploaded image URL and type
            uploadedImageUrl = data.url;
            uploadedImageType = data.type;
            
            showNotification('Image uploaded successfully. Click Send to include it in your message.', 'success');
            
        } catch (error) {
            console.error('Error uploading image:', error);
            showNotification('Failed to upload image', 'error');
        }
    }
    
    // Update a group with the latest message
    function updateGroupWithLatestMessage(message) {
        // Find the group
        const groupId = message.group_id;
        const group = groups.find(g => g.id === groupId);
        
        if (!group) return;
        
        // Update the group's last message
        group.last_message = {
            content: message.content,
            created_at: message.created_at
        };
        
        // Re-render the groups list
        renderGroupsList(groups);
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('adminToken');
            window.location.href = 'admin.html';
        });
        
        // Send message button
        sendMessageBtn.addEventListener('click', sendMessage);
        
        // Enter key in message input
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Fake user select change
        fakeUserSelect.addEventListener('change', () => {
            selectedFakeUserId = fakeUserSelect.value;
            
            // Update avatar
            const selectedOption = fakeUserSelect.options[fakeUserSelect.selectedIndex];
            const avatarUrl = selectedOption.dataset.avatarUrl || '../assets/uploads/user.jpg';
            
            selectedFakeUserAvatar.innerHTML = `<img src="${avatarUrl}" alt="${selectedOption.textContent}">`;
        });
        
        // Group search input
        groupSearchInput.addEventListener('input', () => {
            const query = groupSearchInput.value.toLowerCase();
            
            if (!query) {
                renderGroupsList(groups);
                return;
            }
            
            const filteredGroups = groups.filter(group => 
                group.name.toLowerCase().includes(query)
            );
            
            renderGroupsList(filteredGroups);
        });
        
        // Fake user search input
        fakeUserSearchInput.addEventListener('input', () => {
            const query = fakeUserSearchInput.value.toLowerCase();
            
            if (!query) {
                renderFakeUsersList(fakeUsers);
                return;
            }
            
            const filteredUsers = fakeUsers.filter(user => 
                user.display_name.toLowerCase().includes(query)
            );
            
            renderFakeUsersList(filteredUsers);
        });
        
        // Create group button
        createGroupBtn.addEventListener('click', () => {
            // Reset form
            document.getElementById('createGroupForm').reset();
            
            // Show modal
            $('#createGroupModal').modal('show');
        });
        
        // Save group button
        saveGroupBtn.addEventListener('click', createGroup);
        
        // Create fake user button
        createFakeUserBtn.addEventListener('click', () => {
            // Reset form
            document.getElementById('createFakeUserForm').reset();
            document.getElementById('avatarPreview').style.display = 'none';
            
            // Show modal
            $('#createFakeUserModal').modal('show');
        });
        
        // Save fake user button
        saveFakeUserBtn.addEventListener('click', createFakeUser);
        
        // View members button
        viewMembersBtn.addEventListener('click', openGroupMembersModal);
        
        // Add real member button
        addRealMemberBtn.addEventListener('click', () => {
            // Reset form
            document.getElementById('addRealMemberForm').reset();
            
            // Show modal
            $('#addRealMemberModal').modal('hide');
            $('#addRealMemberModal').modal('show');
        });
        
        // Add fake member button
        addFakeMemberBtn.addEventListener('click', () => {
            // Reset form
            document.getElementById('addFakeMemberForm').reset();
            
            // Populate fake user select
            const fakeUserSelectElement = document.getElementById('fakeUserSelect');
            fakeUserSelectElement.innerHTML = '<option value="">-- Select a fake user --</option>';
            
            // Add only fake users that are not already in the group
            const groupFakeUserIds = groupMembers.fake.map(m => m.id);
            
            fakeUsers.forEach(user => {
                if (!groupFakeUserIds.includes(user.id)) {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = user.display_name;
                    fakeUserSelectElement.appendChild(option);
                }
            });
            
            // Show modal
            $('#addFakeMemberModal').modal('hide');
            $('#addFakeMemberModal').modal('show');
        });
        
        // Add user to group button
        addUserToGroupBtn.addEventListener('click', addRealMember);
        
        // Add fake user to group button
        addFakeUserToGroupBtn.addEventListener('click', addFakeMember);
        
        // Avatar file input change (preview)
        fakeUserAvatar.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const previewImg = document.querySelector('#avatarPreview img');
                    previewImg.src = e.target.result;
                    document.getElementById('avatarPreview').style.display = 'block';
                    
                    // Update custom file label
                    document.querySelector('.custom-file-label').textContent = file.name;
                };
                reader.readAsDataURL(file);
            }
        });
        
        // Upload image button
        uploadImageBtn.addEventListener('click', () => {
            imageUploadInput.click();
        });
        
        // Image upload input change
        imageUploadInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                uploadImage(file);
            }
        });
        
        // Chat settings button
        chatSettingsBtn.addEventListener('click', () => {
            alert('Chat settings functionality will be implemented soon.');
        });
    }
    
    // Utility: Format message time
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
    
    // Utility: Show notification
    function showNotification(message, type = 'info') {
        // You can implement a more sophisticated notification system
        // For now, we'll use a simple alert
        if (type === 'error') {
            alert(`Error: ${message}`);
        } else if (type === 'success') {
            alert(`Success: ${message}`);
        } else {
            alert(message);
        }
    }
}
