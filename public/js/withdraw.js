document.addEventListener('DOMContentLoaded', () => {
  // Use centralized authentication check
  const authData = requireAuth();
  if (!authData) {
    return; // requireAuth will handle redirect
  }
  
  // Get the token from localStorage
  const authToken = localStorage.getItem('auth_token');
  if (!authToken) {
    console.error('No auth token found');
    window.location.href = './login.html';
    return;
  }
  
  // Get token from localStorage
  const token = localStorage.getItem('auth_token');
  if (!token) {
    console.error('No auth token found');
    window.location.href = './login.html';
    return;
  }
  
  // Initialize i18n (simplified - no longer using i18next)
  if (typeof updateContent === 'function') {
    updateContent(); // Apply text conversions immediately
    console.log('Applied text conversions to withdrawal page');
  } else {
    console.warn('updateContent function not found');
  }
  // Helper function to fetch data
  const fetchData = async (url, callback) => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
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

  // Function to refresh all data on the page
  const refreshWithdrawalData = () => {
      // Fetch and display the user's total withdrawn amount
      fetchData('/api/user/withdrawals', (data) => {
        const withdrawElement = document.getElementById('user-withdrawn-amount');
        if (withdrawElement) {
            withdrawElement.innerHTML = `<strong>${data.totalWithdrawals.toFixed(2)}<small style="font-size:14px"> USDT</small></strong>`;
        } else {
            console.warn('Total withdrawn amount element not found.');
        }
      });      // Fetch and display the withdrawable balance (Main account balance)
      fetchData('/api/user/withdrawable-balance', (data) => { // Using correct endpoint
        const balanceElement = document.getElementById('withdrawable-balance');
        if (balanceElement) {
            balanceElement.innerHTML = `<strong>${data.withdrawableBalance.toFixed(2)}<small style="font-size:14px"> USDT</small></strong>`;
        } else {
            console.warn('Withdrawable balance element not found.');
        }
      });// Fetch and display the withdraw history
      fetchData('/api/user/withdraw-history', (data) => {
        const historyElement = document.querySelector('#withdraw-history-tbody'); // Select the tbody within the history tab
        if (historyElement) {
          if (data.history && data.history.length > 0) {
            historyElement.innerHTML = data.history
              .map(
                (entry) => `
                  <tr>
                    <td>${new Date(entry.date).toLocaleDateString()}</td>
                    <td>${new Date(entry.date).toLocaleTimeString()}</td>
                    <td>${parseFloat(entry.amount).toFixed(2)} USDT</td>
                    <td class="text-truncate" style="max-width: 150px;" title="${entry.address || 'N/A'}">${(entry.address || 'N/A').substring(0, 20)}${(entry.address && entry.address.length > 20) ? '...' : ''}</td> 
                    <td><span class="status-badge status-${entry.status.toLowerCase()}">${entry.status}</span></td>
                  </tr>
                `
              )
              .join('');
          } else {
            historyElement.innerHTML = `
              <tr>
                <td colspan="5" class="empty-state">
                  <i class="fas fa-history"></i>
                  <p>No withdrawal history found</p>
                </td>
              </tr>
            `;
          }
        } else {
          console.warn('Withdraw history table body not found.');
        }
      });
  };

  // Initial data load
  refreshWithdrawalData();


  // Set up the withdraw form submission
  const withdrawButton = document.getElementById('withdraw');
  if (withdrawButton) {
    withdrawButton.addEventListener('click', async (e) => {
      e.preventDefault();

      const amountInput = document.getElementById('withdraw_amount');
      const passwordInput = document.getElementById('withdraw_password');
      const accountDetailsInput = document.getElementById('withdrawal_account_details'); // Assuming this ID exists

      const amount = amountInput ? amountInput.value : null;
      const withdrawal_password = passwordInput ? passwordInput.value : null;
      const withdrawal_account_details = accountDetailsInput ? accountDetailsInput.value : null;


      // Add other form fields (method, withdrawal_account_details) as needed
      // const method = document.getElementById('withdrawal_method').value;
      // const accountDetails = document.getElementById('withdrawal_account_details').value;

      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        alert('Please enter a valid withdrawal amount.');
        return;
      }
      if (!withdrawal_password) {
         alert('Please enter your withdrawal password.');
         return;
      }
      if (!withdrawal_account_details || withdrawal_account_details.trim() === '') {
        alert('Please enter your withdrawal account details (e.g., TRC20 Address).');
        return;
      }
      // Add validation for method, accountDetails, etc. as required

      // Prepare data for the request
      const withdrawalData = {
        amount: parseFloat(amount),
        withdrawal_password: withdrawal_password,
        withdrawal_account_details: withdrawal_account_details,
        // method: method, // Include other fields
      };      try {
        // Show loading indicator
        const withdrawButton = document.getElementById('withdraw');
        const originalText = withdrawButton.innerHTML;
        withdrawButton.disabled = true;
        withdrawButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';        const response = await fetch('/api/user/withdraw/request', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            // 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content') // If CSRF is needed
          },
          body: JSON.stringify(withdrawalData),
        });

        const data = await response.json();

        // Restore button
        withdrawButton.disabled = false;
        withdrawButton.innerHTML = originalText;

        if (data.success) {
          // Show success message
          alert('Success: ' + data.message);
          // Clear form
          if (amountInput) amountInput.value = '';
          if (passwordInput) passwordInput.value = '';
          if (accountDetailsInput) accountDetailsInput.value = ''; // Clear account details input
          // Refresh data on the page
          refreshWithdrawalData();
        } else {
          alert('Error: ' + (data.message || 'Failed to submit withdrawal request.'));
        }
      } catch (error) {
        console.error('Error submitting withdrawal request:', error);
        // Restore button
        const withdrawButton = document.getElementById('withdraw');
        withdrawButton.disabled = false;
        withdrawButton.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Submit Withdrawal';
        alert('An error occurred while submitting the withdrawal request.');
      }
    });
  } else {
    console.warn('Withdraw button not found.');
  }

});

// Function to update text conversions on the withdrawal page
function updateWithdrawalTranslations() {
  // Use the global updateContent function from i18n.js
  if (typeof updateContent === 'function') {
    updateContent();
    console.log('Updated withdrawal page text conversions');
  } else {
    console.warn('updateContent function not available');
  }
}

// Listen for language changes (even though we're not using translations now)
document.addEventListener('languageChanged', () => {
  updateWithdrawalTranslations();
});
