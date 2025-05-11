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

  // Fetch and display the user's total deposited amount (if needed, otherwise remove)
  // Based on the backend change, /api/user/deposits now returns history.
  // If a total is still needed, a new backend endpoint might be required,
  // or calculate from history. For now, let's remove this section
  // as the history view is the primary requirement.
  /*
  fetchData('/api/user/deposits/total', (data) => { // Assuming a new endpoint for total
    const depositElement = document.getElementById('user-deposited-amount');
    depositElement.innerHTML = `<strong>${data.totalDeposits.toFixed(2)}<small style="font-size:14px"> USDT</small></strong>`;
  });
  */

  // Fetch and display the deposit history
  fetchData('/api/user/deposits', (data) => {
    const historyElement = document.querySelector('#deposits table tbody'); // Select the tbody within the history tab
    if (historyElement) {
      historyElement.innerHTML = data.history
        .map(
          (entry) => `
            <tr>
              <td>${new Date(entry.date).toLocaleDateString()}</td>
              <td>${new Date(entry.date).toLocaleTimeString()}</td>
              <td>${parseFloat(entry.amount).toFixed(2)} USDT</td>
              <td>${entry.description || 'N/A'}</td>
              <td>${entry.status}</td>
            </tr>
          `
        )
        .join('');
    } else {
      console.warn('Deposit history table body not found.');
    }
  });

  // Fetch and display the user's balance (if needed on this page)
   fetchData('/api/user/balance', (data) => {
     const balanceElement = document.getElementById('user-deposited-amount'); // Re-using this ID for balance display
     if (balanceElement) {
        balanceElement.innerHTML = `<strong>${data.balance.toFixed(2)}<small style="font-size:14px"> USDT</small></strong>`;
     } else {
        console.warn('Balance display element not found.');
     }
   });


  // Set up the deposit form submission
  const depositButton = document.getElementById('deposit');
  if (depositButton) {
    depositButton.addEventListener('click', async (e) => {
      e.preventDefault();

      const amountInput = document.getElementById('deposit_amount');
      const amount = amountInput ? amountInput.value : null;
      // Add other form fields (method, transaction_details, proof_image_path) as needed
      // const method = document.getElementById('deposit_method').value;
      // const transactionDetails = document.getElementById('transaction_details').value;
      // const proofImage = document.getElementById('proof_image').files[0]; // Example for file upload

      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        alert('Please enter a valid deposit amount.');
        return;
      }

      // Prepare data for the request
      const depositData = {
        amount: parseFloat(amount),
        // method: method, // Include other fields
        // transaction_details: transactionDetails,
        // proof_image_path: proofImage ? 'path/to/upload' : null // Handle file upload separately or send base64
      };

      // Example of sending data (assuming JSON for now)
      try {
        // Show loading indicator (using the existing dialog logic from the HTML script)
        let loading = $(document).dialog({
           type : 'notice',
           infoIcon: baseurl + '/assets/frontend/shopva/img/loading.gif',
           infoText: 'Submitting deposit request...',
           autoClose: 0
        });

        const response = await fetch('/api/user/deposit/request', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            // 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content') // If CSRF is needed
          },
          body: JSON.stringify(depositData),
        });

        const data = await response.json();

        loading.close(); // Close loading indicator

        if (data.success) {
          $(document).dialog({ infoText: data.message, autoClose: 2000 });
          // Clear form
          if (amountInput) amountInput.value = '';
          // Refresh history and balance
          // Re-fetch history
          fetchData('/api/user/deposits', (data) => {
            const historyElement = document.querySelector('#deposits table tbody');
             if (historyElement) {
               historyElement.innerHTML = data.history
                 .map(
                   (entry) => `
                     <tr>
                       <td>${new Date(entry.date).toLocaleDateString()}</td>
                       <td>${new Date(entry.date).toLocaleTimeString()}</td>
                       <td>${parseFloat(entry.amount).toFixed(2)} USDT</td>
                       <td>${entry.description || 'N/A'}</td>
                       <td>${entry.status}</td>
                     </tr>
                   `
                 )
                 .join('');
             }
          });
          // Re-fetch balance
          fetchData('/api/user/balance', (data) => {
            const balanceElement = document.getElementById('user-deposited-amount');
             if (balanceElement) {
                balanceElement.innerHTML = `<strong>${data.balance.toFixed(2)}<small style="font-size:14px"> USDT</small></strong>`;
             }
          });

        } else {
          $(document).dialog({ infoText: data.message || 'Failed to submit deposit request.', autoClose: 2000 });
        }
      } catch (error) {
        console.error('Error submitting deposit request:', error);
        // Ensure loading is closed even on error
        if (loading && typeof loading.close === 'function') {
           loading.close();
        }
        $(document).dialog({ infoText: 'An error occurred while submitting the deposit request.', autoClose: 2000 });
      }
    });
  } else {
    console.warn('Deposit button not found.');
  }

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
