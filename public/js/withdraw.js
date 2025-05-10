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
      updateWithdrawalTranslations();
    });
  } else {
    console.warn('i18next initialization function not found');
  }

  // Helper function to fetch data
  const fetchData = async (url, callback) => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        callback(data);
      } else {
        console.error(`Failed to fetch data from ${url}:`, data.message);
      }
    } catch (error) {
      console.error(`Error fetching data from ${url}:`, error);
    }
  };

  // Fetch and display the user's withdrawn amount
  fetchData('/api/user/withdrawals', (data) => {
    const withdrawElement = document.getElementById('user-withdrawn-amount');
    withdrawElement.innerHTML = `<strong>${data.totalWithdrawals.toFixed(2)}<small style="font-size:14px"> USDT</small></strong>`;
  });

  // Fetch and display the withdrawable balance
  fetchData('/api/user/withdrawable-balance', (data) => {
    const balanceElement = document.getElementById('withdrawable-balance');
    balanceElement.innerHTML = `<strong>${data.withdrawableBalance.toFixed(2)}<small style="font-size:14px"> USDT</small></strong>`;
  });

  // Fetch and display the withdraw history
  fetchData('/api/user/withdraw-history', (data) => {
    const historyElement = document.getElementById('withdraw-history');
    historyElement.innerHTML = data.history
      .map(
        (entry) => `
          <tr>
            <td>${new Date(entry.date).toLocaleDateString()}</td>
            <td>${new Date(entry.date).toLocaleTimeString()}</td>
            <td>${entry.amount.toFixed(2)} USDT</td>
          </tr>
        `
      )
      .join('');
  });

  // Fetch and display the user's balance
  fetch('/api/user/balance', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const withdrawableBalanceElement = document.getElementById('withdrawable-balance');
        withdrawableBalanceElement.innerHTML = `<strong>${data.balance.toFixed(2)}<small style="font-size:14px"> USDT</small></strong>`;
      } else {
        console.error('Failed to fetch balance:', data.message);
      }
    })    .catch(error => {
      console.error('Error fetching balance:', error);
    });

  // Set up the withdraw form submission
  document.getElementById('withdraw').addEventListener('click', (e) => {
    // Handle withdraw submission
    console.log('Withdraw button clicked');
  });
});

// Function to update translations on the withdrawal page
function updateWithdrawalTranslations() {
  // Only run if i18next is available and initialized
  if (window.i18next && window.i18next.isInitialized) {
    // Call the global updateContent function from i18n.js
    if (typeof updateContent === 'function') {
      updateContent();
      console.log('Updated withdrawal page translations');
    } else {
      console.warn('updateContent function not available');
    }
  } else {
    console.warn('i18next not initialized yet for withdrawal page');
  }
}

// Listen for language changes
document.addEventListener('languageChanged', () => {
  updateWithdrawalTranslations();
});