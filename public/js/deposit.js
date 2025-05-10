document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    alert('Not authenticated. Redirecting to login.');
    window.location.href = 'login.html';
    return;
  }

  // Initialize i18next if not already initialized
  if (typeof initI18next === 'function') {
    initI18next().then(() => {
      updateDepositTranslations();
    });
  } else {
    console.warn('i18next initialization function not found');
  }

  // Fetch the user's deposited amount
  fetch('/api/user/deposits', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const depositElement = document.getElementById('user-deposited-amount');
        depositElement.innerHTML = `<strong>${data.totalDeposits.toFixed(2)}<small style="font-size:14px"> USDT</small></strong>`;
      } else {
        console.error('Failed to fetch deposits:', data.message);
      }    })
    .catch(error => {
      console.error('Error fetching deposits:', error);
    });
});

// Function to update translations on the deposit page
function updateDepositTranslations() {
  // Only run if i18next is available and initialized
  if (window.i18next && window.i18next.isInitialized) {
    // Call the global updateContent function from i18n.js
    if (typeof updateContent === 'function') {
      updateContent();
      console.log('Updated deposit page translations');
    } else {
      console.warn('updateContent function not available');
    }
  } else {
    console.warn('i18next not initialized yet for deposit page');
  }
}

// Listen for language changes
document.addEventListener('languageChanged', () => {
  updateDepositTranslations();
});