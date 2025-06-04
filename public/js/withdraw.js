document.addEventListener('DOMContentLoaded', () => {
  // Use centralized authentication check
  const authData = requireAuth();
  if (!authData) {
    return; // requireAuth will handle redirect
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
      });

      // Fetch and display the withdrawable balance (Main account balance)
      fetchData('/api/user/balance', (data) => { // Using /api/user/balance as it's the main account
        const balanceElement = document.getElementById('withdrawable-balance');
        if (balanceElement) {
            balanceElement.innerHTML = `<strong>${data.balance.toFixed(2)}<small style="font-size:14px"> USDT</small></strong>`;
        } else {
            console.warn('Withdrawable balance element not found.');
        }
      });

      // Fetch and display the withdraw history
      fetchData('/api/user/withdraw-history', (data) => {
        const historyElement = document.querySelector('#withdraws table tbody'); // Select the tbody within the history tab
        if (historyElement) {
          historyElement.innerHTML = data.history
            .map(
              (entry) => `
                <tr>
                  <td>${new Date(entry.date).toLocaleDateString()}</td>
                  <td>${new Date(entry.date).toLocaleTimeString()}</td>
                  <td>${parseFloat(entry.amount).toFixed(2)} USDT</td>
                  <td>${entry.address || 'N/A'}</td> 
                  <td>${entry.status}</td>
                </tr>
              `
            )
            .join('');
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
      };

      try {
        // Show loading indicator (using the existing dialog logic from the HTML script)
        let loading = $(document).dialog({
           type : 'notice',
           infoIcon: baseurl + '/assets/frontend/shopva/img/loading.gif',
           infoText: 'Submitting withdrawal request...',
           autoClose: 0
        });

        const response = await fetch('/api/user/withdraw/request', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            // 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content') // If CSRF is needed
          },
          body: JSON.stringify(withdrawalData),
        });

        const data = await response.json();

        loading.close(); // Close loading indicator

        if (data.success) {
          $(document).dialog({ infoText: data.message, autoClose: 2000 });
          // Clear form
          if (amountInput) amountInput.value = '';
          if (passwordInput) passwordInput.value = '';
          if (accountDetailsInput) accountDetailsInput.value = ''; // Clear account details input
          // Refresh data on the page
          refreshWithdrawalData();
        } else {
          $(document).dialog({ infoText: data.message || 'Failed to submit withdrawal request.', autoClose: 2000 });
        }
      } catch (error) {
        console.error('Error submitting withdrawal request:', error);
        // Ensure loading is closed even on error
        if (loading && typeof loading.close === 'function') {
           loading.close();
        }
        $(document).dialog({ infoText: 'An error occurred while submitting the withdrawal request.', autoClose: 2000 });
      }
    });
  } else {
    console.warn('Withdraw button not found.');
  }

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
