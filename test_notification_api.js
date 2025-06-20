const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api';

async function testNotificationEndpoints() {
    try {
        console.log('=== Testing Notification Endpoints ===');
        
        // First, get admin auth token
        console.log('1. Authenticating as admin...');
        const authResponse = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123' // Replace with actual admin password
            })
        });
        
        const authData = await authResponse.json();
        
        if (!authData.success) {
            console.error('Failed to authenticate:', authData.message);
            return;
        }
        
        console.log('✓ Admin authenticated successfully');
        const token = authData.token;
        
        // Test notification categories endpoint
        console.log('2. Testing notification categories endpoint...');
        const categoriesResponse = await fetch(`${API_BASE}/admin/notification-categories`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const categoriesData = await categoriesResponse.json();
        console.log('Categories response:', categoriesData);
        
        if (categoriesData.success && categoriesData.categories.length > 0) {
            console.log('✓ Notification categories loaded successfully');
            
            // Test individual notification
            console.log('3. Testing individual notification...');
            const individualNotificationResponse = await fetch(`${API_BASE}/admin/notifications`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: 8, // Hezbolla user
                    category_id: 1, // System Alert
                    title: 'Test Individual Notification',
                    message: 'This is a test individual notification sent via API',
                    priority: 2
                })
            });
            
            const individualData = await individualNotificationResponse.json();
            console.log('Individual notification response:', individualData);
            
            if (individualData.success) {
                console.log('✓ Individual notification sent successfully');
            } else {
                console.log('✗ Individual notification failed:', individualData.message);
            }
            
            // Test bulk notification
            console.log('4. Testing bulk notification...');
            const bulkNotificationResponse = await fetch(`${API_BASE}/admin/notifications/bulk`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_ids: [8, 13, 14], // Multiple users
                    category_id: 2, // Account Update
                    title: 'Test Bulk Notification',
                    message: 'This is a test bulk notification sent via API',
                    priority: 1
                })
            });
            
            const bulkData = await bulkNotificationResponse.json();
            console.log('Bulk notification response:', bulkData);
            
            if (bulkData.success) {
                console.log('✓ Bulk notification sent successfully');
            } else {
                console.log('✗ Bulk notification failed:', bulkData.message);
            }
            
        } else {
            console.log('✗ Failed to load notification categories');
        }
        
    } catch (error) {
        console.error('Error testing endpoints:', error.message);
    }
}

testNotificationEndpoints();
