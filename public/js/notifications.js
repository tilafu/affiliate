document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('auth_token');
  if (!token) return window.location.href = 'login.html';

  // Tab switching logic
  const tabGeneral = document.getElementById('tab-general');
  const tabUser = document.getElementById('tab-user');
  const generalContent = document.getElementById('general-content');
  const userContent = document.getElementById('user-content');
  const generalList = document.getElementById('general-list');
  const userList = document.getElementById('user-list');

  // Notification modal elements
  const notificationDetailModal = new bootstrap.Modal(document.getElementById('notificationDetailModal'));
  const notificationModalBody = document.getElementById('notificationModalBody');


  let generalNotificationsInterval;
  const MAX_GENERAL_NOTIFICATIONS = 10;

  // Initial state
  generalContent.classList.add('active');
  tabGeneral.classList.add('active');
  startGeneralNotifications(); // Start generating and displaying general notifications

  tabGeneral.addEventListener('click', () => {
    tabGeneral.classList.add('active');
    tabUser.classList.remove('active');
    generalContent.classList.add('active');
    userContent.classList.remove('active');
    startGeneralNotifications(); // Start generating and displaying general notifications
    stopUserNotifications(); // Stop fetching user notifications
  });

  tabUser.addEventListener('click', () => {
    tabUser.classList.add('active');
    tabGeneral.classList.remove('active');
    userContent.classList.add('active');
    generalContent.classList.remove('active');
    stopGeneralNotifications(); // Stop generating general notifications
    fetchUserNotifications(); // Fetch and display user notifications
  });

  // Function to generate a random user code (e.g., 6 random alphanumeric characters)
  function generateUserCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  // Function to generate a random USDT figure between 5,000 and 50,000
  function generateRandomUSDT() {
    return (Math.random() * (50000 - 5000) + 5000).toFixed(0);
  }

  // Function to generate a single random general notification
  function generateRandomGeneralNotification() {
    const userCode = generateUserCode();
    const amount = generateRandomUSDT();
    const type = Math.random() > 0.5 ? 'withdrawn' : 'deposited';
    return {
      message: `User '${userCode}' has ${type} ${amount} USDT.`,
      created_at: new Date().toISOString() // Use current time for display
    };
  }

  // Function to add a new general notification to the list
  function addGeneralNotification() {
    const newNotification = generateRandomGeneralNotification();
    const notificationElement = createGeneralNotificationElement(newNotification);

    // Add the new notification to the top
    if (generalList.firstChild) {
      generalList.insertBefore(notificationElement, generalList.firstChild);
    } else {
      generalList.appendChild(notificationElement);
    }

    // Remove the oldest notification if the list exceeds the max limit
    while (generalList.children.length > MAX_GENERAL_NOTIFICATIONS) {
      generalList.removeChild(generalList.lastChild);
    }
  }

  // Function to start generating general notifications at intervals
  function startGeneralNotifications() {
    // Clear existing interval if any
    stopGeneralNotifications();

    // Generate initial set of notifications
    generalList.innerHTML = ''; // Clear the list before adding initial notifications
    for (let i = 0; i < MAX_GENERAL_NOTIFICATIONS; i++) {
        addGeneralNotification();
    }


    // Start interval for new notifications
    generalNotificationsInterval = setInterval(() => {
      addGeneralNotification();
    }, Math.random() * (120000 - 30000) + 30000); // Random interval between 30 seconds and 2 minutes
  }

  // Function to stop generating general notifications
  function stopGeneralNotifications() {
    clearInterval(generalNotificationsInterval);
  }

  // Function to create the HTML element for a general notification (card design)
  function createGeneralNotificationElement(notification) {
    const div = document.createElement('div');
    div.className = 'card cardd mb-2 notification-item'; // Added card classes
    div.innerHTML = `
      <div class="card-body">
        <div class="row">
          <div class="col-auto">
            <div class="avatar avatar-30 shadow rounded-circle">
              <img src="./assets/frontend/img/user.jpg" alt="" width="90"> <!-- Placeholder image -->
            </div>
          </div>
          <div class="col-auto align-self-center ps-0">
            <p class="size-12"><b>${notification.message}</b></p>
            <div style="font-size:12px;color:#888;">${new Date(notification.created_at).toLocaleString()}</div>
          </div>
        </div>
      </div>
    `;
    return div;
  }


  // Function to fetch and display user notifications
  function fetchUserNotifications() {
    userList.innerHTML = '<div>Loading user notifications...</div>'; // Loading indicator

    fetch('/api/user/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          renderUserNotifications(data.notifications, userList); // Use data.notifications
        } else {
          userList.innerHTML = `<div>Error fetching notifications: ${data.message || 'Unknown error'}</div>`;
        }
      })
      .catch(error => {
        console.error('Error fetching user notifications:', error);
        userList.innerHTML = `<div>Error fetching notifications: ${error.message}</div>`;
      });
  }

  // Function to stop fetching user notifications (no ongoing fetch, just clear the list)
  function stopUserNotifications() {
      userList.innerHTML = ''; // Clear the list when switching away
  }


  // Function to render user notifications (with unread indicator)
  function renderUserNotifications(list, container) {
    container.innerHTML = '';
    if (!list || list.length === 0) {
      container.innerHTML = '<div>No notifications.</div>';
      return;
    }
    list.forEach(n => {
      const div = document.createElement('div');
      div.className = 'notification-item user-notification' + (n.is_read ? '' : ' unread'); // Added user-notification class and unread class
      div.dataset.notificationId = n.id; // Store notification ID
      div.dataset.isRead = n.is_read; // Store read status
      div.dataset.message = n.message; // Store full message content
      div.innerHTML = `
        <div>${n.message}</div>
        <div style="font-size:12px;color:#888;">${new Date(n.created_at).toLocaleString()}</div>
      `;
      // Add click listener for user notifications
      div.addEventListener('click', handleUserNotificationClick);
      container.appendChild(div);
    });
  }

  // Function to handle user notification click
  function handleUserNotificationClick(event) {
      const notificationElement = event.currentTarget;
      const notificationId = notificationElement.dataset.notificationId;
      const isRead = notificationElement.dataset.isRead === 'true'; // Get current read status
      const messageContent = notificationElement.dataset.message; // Get full message content

      // Display message in modal
      notificationModalBody.innerHTML = `<p>${messageContent}</p>`;
      notificationDetailModal.show();


      if (!isRead) {
          // Mark as read on the backend
          fetch(`/api/user/notifications/${notificationId}/read`, {
              method: 'PUT',
              headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
              }
          })
          .then(res => res.json())
          .then(data => {
              if (data.success) {
                  // Update UI to show as read
                  notificationElement.classList.remove('unread');
                  notificationElement.dataset.isRead = 'true'; // Update data attribute
                  console.log(`Notification ${notificationId} marked as read.`);
              } else {
                  console.error('Failed to mark notification as read:', data.message);
              }
          })
          .catch(error => {
              console.error('Error marking notification as read:', error);
          });
      }
  }

});
