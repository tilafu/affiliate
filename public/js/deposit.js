document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    alert('Not authenticated. Redirecting to login.');
    window.location.href = 'login.html';
    return;
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
      }
    })
    .catch(error => {
      console.error('Error fetching deposits:', error);
    });
});