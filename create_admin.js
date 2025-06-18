// Quick script to create an admin user for testing
const pool = require('./server/config/db');
const bcrypt = require('bcrypt');

async function createAdminUser() {
    const client = await pool.connect();
    
    try {
        console.log('Checking for admin user...');
        
        // Check if admin user exists
        const adminCheck = await client.query(
            'SELECT id, username, role FROM users WHERE role = $1 LIMIT 1',
            ['admin']
        );
        
        if (adminCheck.rows.length === 0) {
            console.log('No admin user found. Creating one...');
            
            // Hash password
            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            // Create admin user
            const result = await client.query(`
                INSERT INTO users (username, email, password_hash, referral_code, role, tier)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, username, role
            `, ['admin', 'admin@test.com', hashedPassword, 'ADMIN123', 'admin', 'platinum']);
            
            console.log('✅ Admin user created:', result.rows[0]);
            console.log('📝 Login credentials:');
            console.log('   Username: admin');
            console.log('   Password: admin123');
        } else {
            console.log('✅ Admin user already exists:', adminCheck.rows[0]);
            console.log('📝 Login credentials:');
            console.log('   Username:', adminCheck.rows[0].username);
            console.log('   Password: (use existing password or reset if needed)');
        }
        
        console.log('\n🌐 Access admin panel at: http://localhost:3000/admin.html');
        console.log('🔐 Make sure to login first!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        process.exit();
    }
}

createAdminUser();
