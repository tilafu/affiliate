// Debug script for task page 401 errors
// Run this in the browser console to test each API endpoint individually

function debugTaskPageAPIs() {
    console.log('=== DEBUGGING TASK PAGE API CALLS ===');
    
    // List of API endpoints that task page uses
    const endpoints = [
        '/api/user/profile',
        '/api/user/balances', 
        '/api/user/drive-progress',
        '/api/user/withdrawals',
        '/api/products/list',
        '/api/tasks/status'
    ];
    
    // Test each endpoint
    endpoints.forEach(async (endpoint, index) => {
        try {
            console.log(`\n${index + 1}. Testing ${endpoint}...`);
            
            const token = localStorage.getItem('auth_token');
            console.log(`Token for ${endpoint}:`, token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
            
            const response = await fetch(`${API_BASE_URL || ''}${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`${endpoint} Response:`, {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });
            
            if (response.status === 401) {
                console.error(`🚨 ${endpoint} returned 401 - This is likely the culprit!`);
            } else if (response.ok) {
                console.log(`✅ ${endpoint} is working correctly`);
            } else {
                console.warn(`⚠️ ${endpoint} returned ${response.status}`);
            }
            
        } catch (error) {
            console.error(`❌ Error testing ${endpoint}:`, error);
        }
    });
    
    console.log('\n=== DEBUG TEST COMPLETE ===');
    console.log('Check above for any 🚨 401 errors to identify the problematic endpoint');
}

// Auto-run the debug function
debugTaskPageAPIs();

// Also provide a manual function to check current auth state
function checkCurrentAuthState() {
    console.log('=== CURRENT AUTH STATE ===');
    console.log('localStorage auth_token:', localStorage.getItem('auth_token') ? 'Present' : 'Missing');
    console.log('localStorage user_data:', localStorage.getItem('user_data') ? 'Present' : 'Missing');
    
    if (typeof isAuthenticated === 'function') {
        const authData = isAuthenticated();
        console.log('isAuthenticated() result:', authData);
    }
    
    if (typeof SimpleAuth !== 'undefined') {
        console.log('SimpleAuth available:', true);
        console.log('SimpleAuth data:', SimpleAuth.getAuthData());
    } else {
        console.log('SimpleAuth available:', false);
    }
    
    console.log('=== END AUTH STATE ===');
}

console.log('Debug functions loaded. You can also run checkCurrentAuthState() manually.');
