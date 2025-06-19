const jwt = require('jsonwebtoken');
const pool = require('./config/db');

async function debugAuthentication() {
    try {
        console.log('🔍 Debugging Authentication Issues...\n');
        
        // Check environment variable
        const jwtSecret = process.env.JWT_SECRET;
        console.log('JWT_SECRET exists:', !!jwtSecret);
        console.log('JWT_SECRET length:', jwtSecret ? jwtSecret.length : 0);
        console.log('JWT_SECRET preview:', jwtSecret ? jwtSecret.substring(0, 10) + '...' : 'Not set');
        
        // Create a test token
        const testPayload = {
            userId: 4,
            username: 'Mash',
            role: 'admin'
        };
        
        const testToken = jwt.sign(testPayload, jwtSecret || 'your-jwt-secret', { expiresIn: '1h' });
        console.log('\n🔑 Generated Test Token:');
        console.log('Token length:', testToken.length);
        console.log('Token preview:', testToken.substring(0, 50) + '...');
        
        // Try to verify the token
        try {
            const decoded = jwt.verify(testToken, jwtSecret || 'your-jwt-secret');
            console.log('\n✅ Token verification successful:');
            console.log('Decoded payload:', decoded);
        } catch (verifyError) {
            console.log('\n❌ Token verification failed:', verifyError.message);
        }
        
        // Test the actual middleware logic
        console.log('\n🧪 Testing auth middleware logic...');
        
        try {
            // Check if user exists in database
            const userResult = await pool.query(
                'SELECT id, username, email, referral_code, tier, role FROM users WHERE id = $1',
                [testPayload.userId]
            );
            
            if (userResult.rows.length > 0) {
                console.log('✅ User found in database:', userResult.rows[0]);
            } else {
                console.log('❌ User not found in database for ID:', testPayload.userId);
            }
        } catch (dbError) {
            console.log('❌ Database error:', dbError.message);
        }
        
        // Test a real API call with the token
        console.log('\n🌐 Testing API call with token...');
        
        try {
            const response = await fetch('http://localhost:3000/api/user/profile', {
                headers: {
                    'Authorization': `Bearer ${testToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('API Response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ API call successful:', data);
            } else {
                const errorText = await response.text();
                console.log('❌ API call failed:', errorText);
            }
        } catch (apiError) {
            console.log('❌ API call error:', apiError.message);
        }
        
    } catch (error) {
        console.error('❌ Debug script error:', error);
    } finally {
        await pool.end();
    }
}

debugAuthentication();
