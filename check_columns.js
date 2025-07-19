const pool = require('./server/config/db');

async function checkColumns() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('All columns in users table:');
    result.rows.forEach(row => {
      console.log(`${row.column_name} - ${row.data_type}`);
    });
    
    const avatarColumns = result.rows.filter(row => 
      row.column_name.includes('avatar') || 
      row.column_name.includes('image') || 
      row.column_name.includes('photo') ||
      row.column_name.includes('profile')
    );
    
    console.log('\nAvatar/image related columns:');
    if (avatarColumns.length > 0) {
      avatarColumns.forEach(row => {
        console.log(`${row.column_name} - ${row.data_type}`);
      });
    } else {
      console.log('No avatar/image related columns found!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Database query error:', error);
    process.exit(1);
  }
}

checkColumns();
