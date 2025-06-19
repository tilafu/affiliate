// Debug script to test authentication and API endpoints
require('dotenv').config();
const jwt = require('jsonwebtoken');

// Create a test token
function createTestToken() {
  const testUser = {
    userId: 4, // Admin user ID from our database check
    username: 'Mash',
    role: 'admin'
  };
  
  const secret = process.env.JWT_SECRET || 'your-jwt-secret';
  const token = jwt.sign(testUser, secret, { expiresIn: '1h' });
  return token;
}

async function testAPIs() {
  try {
    const token = createTestToken();
    console.log('🔑 Created test token for user: Mash');
    console.log('🔑 Token (first 50 chars):', token.substring(0, 50) + '...');
    
    // Test 1: Health check (no auth required)
    console.log('\n🧪 Test 1: Health check...');
    try {
      const healthResponse = await fetch('http://localhost:3000/api/health');
      const healthData = await healthResponse.json();
      console.log('✅ Health check:', healthData);
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
    }
    
    // Test 2: Public carousel endpoint (no auth required)
    console.log('\n🧪 Test 2: Public products carousel...');
    try {
      const carouselResponse = await fetch('http://localhost:3000/api/products/carousel');
      const carouselData = await carouselResponse.json();
      console.log('✅ Carousel products:', carouselData.success ? `${carouselData.count} products` : 'Failed');
    } catch (error) {
      console.log('❌ Carousel failed:', error.message);
    }
    
    // Test 3: Profile endpoint (auth required)
    console.log('\n🧪 Test 3: User profile...');
    try {
      const profileResponse = await fetch('http://localhost:3000/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        console.log('✅ Profile data:', profileData);
      } else {
        const errorText = await profileResponse.text();
        console.log('❌ Profile failed:', profileResponse.status, errorText);
      }
    } catch (error) {
      console.log('❌ Profile error:', error.message);
    }
    
    // Test 4: Drive progress endpoint (auth required)
    console.log('\n🧪 Test 4: Drive progress...');
    try {
      const driveResponse = await fetch('http://localhost:3000/api/user/drive-progress', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (driveResponse.ok) {
        const driveData = await driveResponse.json();
        console.log('✅ Drive progress data:', driveData);
      } else {
        const errorText = await driveResponse.text();
        console.log('❌ Drive progress failed:', driveResponse.status, errorText);
      }
    } catch (error) {
      console.log('❌ Drive progress error:', error.message);
    }
    
    // Test 5: User balances endpoint (auth required)
    console.log('\n🧪 Test 5: User balances...');
    try {
      const balanceResponse = await fetch('http://localhost:3000/api/user/balances', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        console.log('✅ Balance data:', balanceData);
      } else {
        const errorText = await balanceResponse.text();
        console.log('❌ Balance failed:', balanceResponse.status, errorText);
      }
    } catch (error) {
      console.log('❌ Balance error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test script error:', error);
  }
}

testAPIs();
