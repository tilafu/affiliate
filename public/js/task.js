document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // Fetch user balance
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
        // Update the data drive balance
        const balanceElements = document.querySelectorAll('.datadrive-balance');
        balanceElements.forEach(elem => {
          elem.textContent = `${data.balance.toFixed(2)}`;
        });
      } else {
        console.error('Failed to fetch balance:', data.message);
      }
    })
    .catch(error => {
      console.error('Error fetching balance:', error);
    });
});