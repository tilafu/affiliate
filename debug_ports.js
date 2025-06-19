// Debug script to understand port routing
console.log('🔍 Port Routing Debug');
console.log('Current URL:', window.location.href);
console.log('Current Port:', window.location.port);
console.log('API_BASE_URL:', window.API_BASE_URL);

// Test both ports
async function testBothPorts() {
    console.log('\n🧪 Testing both server ports...');
    
    // Test port 3000
    try {
        const response3000 = await fetch('http://localhost:3000/api/health');
        const data3000 = await response3000.json();
        console.log('✅ Port 3000:', data3000);
    } catch (error) {
        console.log('❌ Port 3000 failed:', error.message);
    }
    
    // Test port 3001
    try {
        const response3001 = await fetch('http://localhost:3001/api/health');
        const data3001 = await response3001.json();
        console.log('✅ Port 3001:', data3001);
    } catch (error) {
        console.log('❌ Port 3001 failed:', error.message);
    }
    
    // Test carousel on both ports
    console.log('\n🎠 Testing carousel on both ports...');
    
    try {
        const carousel3000 = await fetch('http://localhost:3000/api/products/carousel');
        console.log('Port 3000 carousel status:', carousel3000.status);
    } catch (error) {
        console.log('Port 3000 carousel failed:', error.message);
    }
    
    try {
        const carousel3001 = await fetch('http://localhost:3001/api/products/carousel');
        console.log('Port 3001 carousel status:', carousel3001.status);
    } catch (error) {
        console.log('Port 3001 carousel failed:', error.message);
    }
}

testBothPorts();
