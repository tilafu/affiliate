require('dotenv').config();
const jwt = require('jsonwebtoken');

// Create a test JWT token for API testing
function createTestToken() {
  const testUser = {
    userId: 4, // Admin user ID from our database check
    username: 'Mash',
    role: 'admin'
  };
  
  const token = jwt.sign(testUser, process.env.JWT_SECRET || 'your-jwt-secret', { 
    expiresIn: '1h' 
  });
  
  return token;
}

async function testAPIEndpoints() {
  try {
    const token = createTestToken();
    console.log('🔑 Test token created for user: Mash');
    
    // Test the high-value products endpoint
    console.log('\n🧪 Testing /api/user/products/highvalue endpoint...');
    
    const response = await fetch('http://localhost:3000/api/user/products/highvalue', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ High-value products endpoint working!');
      console.log(`📊 Found ${data.count} high-value products`);
      if (data.products && data.products.length > 0) {
        console.log('🎯 First few products:');
        data.products.slice(0, 3).forEach((product, index) => {
          console.log(`  ${index + 1}. ${product.name} - $${product.price} (Commission: $${product.commission})`);
        });
      }
    } else {
      const errorData = await response.text();
      console.log('❌ High-value products endpoint failed:', response.status, errorData);
    }
    
    // Test the profile endpoint  
    console.log('\n🧪 Testing /api/user/profile endpoint...');
    
    const profileResponse = await fetch('http://localhost:3000/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      console.log('✅ Profile endpoint working!');
      console.log('👤 User data:', profileData.user);
    } else {
      const profileErrorData = await profileResponse.text();
      console.log('❌ Profile endpoint failed:', profileResponse.status, profileErrorData);
    }
    
    // Test the drive progress endpoint
    console.log('\n🧪 Testing /api/user/drive-progress endpoint...');
    
    const driveResponse = await fetch('http://localhost:3000/api/user/drive-progress', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (driveResponse.ok) {
      const driveData = await driveResponse.json();
      console.log('✅ Drive progress endpoint working!');
      console.log('📈 Drive progress data:', driveData);
    } else {
      const driveErrorData = await driveResponse.text();
      console.log('❌ Drive progress endpoint failed:', driveResponse.status, driveErrorData);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Check if we can connect to the server first
async function checkServer() {
  try {
    const healthResponse = await fetch('http://localhost:3000/api/health');
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Server is running:', healthData.status);
      return true;
    }
  } catch (error) {
    console.log('❌ Server not accessible:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting API endpoint tests...');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('⚠️ Make sure the server is running on port 3000');
    return;
  }
  
  await testAPIEndpoints();
  console.log('\n✨ Test completed!');
}

main();
