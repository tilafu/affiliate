/* Admin Login Functionality Disabled */
/*
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('admin-login-form');
    const loginError = document.getElementById('admin-login-error');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('admin-username').value;
            const password = document.getElementById('admin-password').value;
            
            try {
                // Clear previous error messages
                loginError.style.display = 'none';
                loginError.textContent = '';
                
                console.log('Sending admin login request with credentials:', { username, password });
                
                const response = await fetch(`${API_BASE_URL}/api/auth/admin-login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                
                console.log('Admin login response:', response);
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Login failed');
                }
                
                // Store admin token and data
                localStorage.setItem('admin_token', data.token);
                localStorage.setItem('admin_data', JSON.stringify(data.admin));
                
                // Redirect to admin panel
                window.location.href = 'admin.html';
                
            } catch (error) {
                console.error('Admin login error:', error);
                loginError.textContent = error.message || 'Failed to login. Please try again.';
                loginError.style.display = 'block';
            }
        });
    }
    
    // Check if already logged in as admin
    const adminToken = localStorage.getItem('admin_token');
    if (adminToken && window.location.pathname.includes('admin-login.html')) {
        window.location.href = 'admin.html';
    }
});
*/
