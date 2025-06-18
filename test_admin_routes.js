// Quick test to verify admin server routes
const fetch = require('node-fetch');

const baseUrl = 'http://localhost:3001';

async function testAdminServer() {
    console.log('🧪 Testing Admin Server Routes...\n');
    
    try {
        // Test 1: Health check
        console.log('1. Testing health endpoint...');
        const healthResponse = await fetch(`${baseUrl}/api/health`);
        console.log(`   Status: ${healthResponse.status}`);
        console.log(`   Response: ${await healthResponse.text()}\n`);
        
        // Test 2: Test notification categories (should fail with 401 - unauthorized)
        console.log('2. Testing notification categories (no auth - should be 401)...');
        const notificationResponse = await fetch(`${baseUrl}/api/admin/notification-categories`);
        console.log(`   Status: ${notificationResponse.status}`);
        console.log(`   Response: ${await notificationResponse.text()}\n`);
        
        // Test 3: Test tier management (should fail with 401 - unauthorized)
        console.log('3. Testing tier management (no auth - should be 401)...');
        const tierResponse = await fetch(`${baseUrl}/api/admin/tier-management/configurations`);
        console.log(`   Status: ${tierResponse.status}`);
        console.log(`   Response: ${await tierResponse.text()}\n`);
        
        console.log('✅ Admin server is responding. Auth issues are expected without token.');
        
    } catch (error) {
        console.error('❌ Admin server test failed:', error.message);
        console.log('\n🔧 Make sure to run: npm run dev');
    }
}

testAdminServer();
