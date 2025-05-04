document.addEventListener('DOMContentLoaded', () => {
    const token = getToken(); // Assumes getToken() is available globally
    if (!token) {
        console.error('No auth token found, redirecting to login.');
        window.location.href = 'login.html';
        return;
    }

    const messageListElem = document.getElementById('support-message-list');
    const supportForm = document.getElementById('support-form');
    const subjectInput = document.getElementById('support-subject-input');
    const messageInput = document.getElementById('usermessage'); // Keep existing ID
    const sendButton = document.getElementById('userchat'); // Keep existing ID

    // Function to format date simply (adjust as needed)
    const formatSimpleDate = (dateString) => {
        if (!dateString) return '';
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return 'Invalid Date';
        }
    };

    // Function to display messages
    const displayMessages = (messages) => {
        if (!messageListElem) return;
        messageListElem.innerHTML = ''; // Clear loading/previous messages

        if (!messages || messages.length === 0) {
            messageListElem.innerHTML = '<p class="text-center text-muted">You have no support messages yet.</p>';
            return;
        }

        messages.forEach(msg => {
            // Determine if the message is from the user or support/admin (assuming admin replies aren't fetched here yet)
            const isUserMessage = msg.sender_role === 'user'; // Check sender_role if available, otherwise assume all fetched are user's
            const chatClass = isUserMessage ? 'chat' : 'chat chat-left'; // 'chat' for user (right), 'chat-left' for admin/support
            const avatarSrc = isUserMessage ? './assets/uploads/user.jpg' : './assets/uploads/favicon.png'; // Example avatars
            const time = formatSimpleDate(msg.created_at);

            const messageHtml = `
                <div class="${chatClass}">
                    ${!isUserMessage ? `<div class="chat-avatar"><span class="avatar avatar-sm"><img alt="Support" src="${avatarSrc}" class="hide-mobile"></span></div>` : ''}
                    <div class="chat-body">
                       <div class="chat-content">
                          ${msg.subject ? `<p><strong>Subject: ${escapeHtml(msg.subject)}</strong></p>` : ''}
                          <p>${escapeHtml(msg.message)}</p>
                          <time class="chat-time">${time}</time>
                       </div>
                    </div>
                     ${isUserMessage ? `<div class="chat-avatar"><span class="avatar avatar-sm"><img alt="User" src="${avatarSrc}" class="hide-mobile"></span></div>` : ''}
                </div>
            `;
            messageListElem.insertAdjacentHTML('beforeend', messageHtml);
        });
         // Scroll to the bottom
         messageListElem.scrollTop = messageListElem.scrollHeight;
    };

    // Function to fetch user's messages
    const fetchMessages = async () => {
        if (!messageListElem) return;
        messageListElem.innerHTML = '<p class="text-center text-muted">Loading messages...</p>'; // Show loading state

        try {
            const data = await fetchWithAuth('/api/user/support/messages'); // Assumes fetchWithAuth is global
            if (data.success) {
                displayMessages(data.messages);
            } else {
                messageListElem.innerHTML = '<p class="text-center text-danger">Could not load messages.</p>';
                console.error('Failed to fetch support messages:', data.message);
                showNotification(data.message || 'Failed to load messages.', 'error');
            }
        } catch (error) {
            messageListElem.innerHTML = '<p class="text-center text-danger">Error loading messages.</p>';
            console.error('Error fetching support messages:', error);
            if (error.message !== 'Unauthorized') {
                 showNotification('Error loading messages.', 'error');
            }
        }
    };

    // Add submit listener for the form
    if (supportForm && subjectInput && messageInput && sendButton) {
        supportForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const subject = subjectInput.value.trim();
            const message = messageInput.value.trim();

            if (!message) {
                showNotification('Please enter your message.', 'error');
                return;
            }

            sendButton.disabled = true;
            sendButton.textContent = 'Sending...';

            try {
                const response = await fetchWithAuth('/api/user/support/messages', {
                    method: 'POST',
                    body: JSON.stringify({ subject: subject || null, message: message }) // Send subject as null if empty
                });

                if (response.success) {
                    showNotification('Message sent successfully!', 'success');
                    supportForm.reset(); // Clear the form
                    fetchMessages(); // Refresh the message list
                } else {
                    showNotification(response.message || 'Failed to send message.', 'error');
                }
            } catch (error) {
                 console.error('Error sending support message:', error);
                 if (error.message !== 'Unauthorized') {
                    showNotification('Could not send message. Please try again.', 'error');
                 }
            } finally {
                sendButton.disabled = false;
                sendButton.textContent = 'Send Message';
            }
        });
    } else {
        console.error('Could not find form elements for support message.');
    }

    // Initial fetch of messages
    fetchMessages();

});

// Basic HTML escaping function
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
