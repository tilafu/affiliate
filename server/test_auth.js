// Test JWT token creation and validation
const jwt = require('jsonwebtoken');
const pool = require('./config/db');

async function testAuth() {
  try {
    console.log('🔐 Testing authentication...');
    
    // Check environment variables
    const jwtSecret = process.env.JWT_SECRET;
    console.log('JWT_SECRET exists:', !!jwtSecret);
    console.log('JWT_SECRET length:', jwtSecret ? jwtSecret.length : 0);
    
    if (!jwtSecret) {
      console.log('❌ JWT_SECRET not found in environment');
      return;
    }
    
    // Get a real user from database
    const userResult = await pool.query('SELECT id, username, email, role FROM users WHERE role = $1 LIMIT 1', ['admin']);
    if (userResult.rows.length === 0) {
      console.log('❌ No admin user found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('👤 Test user:', user);
    
    // Create token
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };
    
    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '1h' });
    console.log('🎫 Token created, length:', token.length);
    
    // Verify token
    try {
      const decoded = jwt.verify(token, jwtSecret);
      console.log('✅ Token verification successful:', decoded);
    } catch (verifyError) {
      console.log('❌ Token verification failed:', verifyError.message);
    }
    
    // Test the token with profile endpoint
    console.log('\n🧪 Testing profile endpoint with valid token...');
    const profileResponse = await fetch('http://localhost:3000/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      console.log('✅ Profile endpoint works:', profileData);
    } else {
      const errorText = await profileResponse.text();
      console.log('❌ Profile endpoint failed:', profileResponse.status, errorText);
    }
    
  } catch (error) {
    console.error('❌ Auth test error:', error.message);
  } finally {
    await pool.end();
  }
}

testAuth();
