document.addEventListener('DOMContentLoaded', () => {
  // Use centralized authentication check
  const authData = checkAuthentication();
  if (!authData) {
    return; // checkAuthentication will handle redirect
  }

  console.log('Deposits page initialized');

  // Check if required functions are available
  if (typeof fetchWithAuth !== 'function') {
    console.error('fetchWithAuth function not available');
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

  // Function to refresh all deposit data
  const refreshDepositData = async () => {
    try {
      console.log('Loading deposit data...');
      
      // Load deposit totals and history
      await loadDepositTotals();
      await loadDepositHistory();
      
      console.log('Deposit data loaded successfully');
    } catch (error) {
      console.error('Error loading deposit data:', error);
    }
  };

  // Function to load deposit totals
  const loadDepositTotals = async () => {
    try {
      const response = await fetchWithAuth('/api/user/deposits/total');
      console.log('Deposit totals response:', response);

      const depositElement = document.getElementById('user-deposited-amount');
      if (depositElement && response.success) {
        const totalDeposits = response.totalDeposits || response.data?.totalDeposits || 0;
        depositElement.innerHTML = `$${parseFloat(totalDeposits).toFixed(2)}`;
        console.log('Updated total deposits:', totalDeposits);
      } else if (depositElement) {
        depositElement.innerHTML = '$0.00';
        console.log('No deposit data available, showing $0.00');
      }
    } catch (error) {
      console.error('Error loading deposit totals:', error);
      const depositElement = document.getElementById('user-deposited-amount');
      if (depositElement) {
        depositElement.innerHTML = '$0.00';
      }
    }
  };
  // Function to load deposit history (including admin adjustments)
  const loadDepositHistory = async () => {
    try {
      const response = await fetchWithAuth('/api/user/deposits');
      console.log('Deposit history response:', response);

      const historyElement = document.querySelector('#deposits table tbody');
      if (historyElement) {
        if (response.success && response.data && response.data.length > 0) {
          historyElement.innerHTML = response.data
            .map((entry) => {
              // Determine the type and styling for admin adjustments
              let typeDisplay = entry.type || 'deposit';
              let statusClass = 'status-completed';
              let amountPrefix = '+';
              
              if (entry.type === 'admin_adjustment') {
                if (entry.amount < 0) {
                  typeDisplay = 'Admin Deduction';
                  statusClass = 'status-warning';
                  amountPrefix = '';
                } else {
                  typeDisplay = 'Admin Credit';
                  statusClass = 'status-success';
                }
              } else if (entry.type === 'deposit') {
                typeDisplay = 'Deposit';
              }
              
              return `
                <tr>
                  <td>${new Date(entry.date || entry.created_at).toLocaleDateString()}</td>
                  <td>${new Date(entry.date || entry.created_at).toLocaleTimeString()}</td>
                  <td>${amountPrefix}$${Math.abs(parseFloat(entry.amount)).toFixed(2)}</td>
                  <td><span class="status-badge ${statusClass}">${typeDisplay}</span></td>
                  <td><span class="status-badge status-${(entry.status || 'completed').toLowerCase()}">${entry.status || 'Completed'}</span></td>
                  ${entry.admin_note ? `<td><small class="text-muted">${entry.admin_note}</small></td>` : '<td>-</td>'}
                </tr>
              `;
            })
            .join('');
        } else {
          historyElement.innerHTML = `
            <tr>
              <td colspan="6" class="empty-state">
                <i class="fas fa-history"></i>
                <p>No deposit history found</p>
              </td>
            </tr>
          `;
        }
      }
    } catch (error) {
      console.error('Error loading deposit history:', error);
      const historyElement = document.querySelector('#deposits table tbody');
      if (historyElement) {
        historyElement.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">
              <i class="fas fa-exclamation-triangle"></i>
              <p>Error loading deposit history</p>
            </td>
          </tr>        `;
      }
    }
  };

  // Initial data load
  refreshDepositData();

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
        showNotification('Please enter a valid deposit amount.', 'warning');
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
        // Show loading indicator
        const originalText = depositButton.innerHTML;
        depositButton.disabled = true;
        depositButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';

        const response = await fetchWithAuth('/api/user/deposit/request', {
          method: 'POST',
          body: JSON.stringify(depositData)
        });

        // Restore button
        depositButton.disabled = false;
        depositButton.innerHTML = originalText;

        if (response.success) {
          showNotification('Deposit request submitted successfully! ' + (response.message || ''), 'success');
          // Clear form
          if (amountInput) amountInput.value = '';
          // Refresh deposit data
          await refreshDepositData();        } else {
          showNotification('Deposit failed: ' + (response.message || 'Failed to submit deposit request.'), 'error');
        }
      } catch (error) {
        console.error('Error submitting deposit request:', error);
        // Restore button
        depositButton.disabled = false;
        depositButton.innerHTML = originalText;
        showNotification('An error occurred while submitting the deposit request.', 'error');
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
