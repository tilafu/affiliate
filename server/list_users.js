const pool = require('./config/db');

async function listUsers() {
  try {
    const result = await pool.query('SELECT id, username, email, role FROM users LIMIT 10');
    console.log('Available users:');
    result.rows.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Role: ${user.role}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

listUsers();
