const pool = require('./server/config/db');

(async () => {
  try {
    console.log('Testing notification system...');
    
    // Check if notification_categories table exists and has data
    const categoriesResult = await pool.query('SELECT * FROM notification_categories ORDER BY id');
    console.log('Notification categories:', categoriesResult.rows);
    
    if (categoriesResult.rows.length === 0) {
      console.log('No notification categories found. Creating default categories...');
      
      // Create default categories
      const defaultCategories = [
        { name: 'System', description: 'System notifications', color: '#007bff', icon: 'fas fa-cog' },
        { name: 'Account', description: 'Account related notifications', color: '#28a745', icon: 'fas fa-user' },
        { name: 'Transaction', description: 'Transaction notifications', color: '#ffc107', icon: 'fas fa-dollar-sign' },
        { name: 'Alert', description: 'Important alerts', color: '#dc3545', icon: 'fas fa-exclamation-triangle' }
      ];
      
      for (const category of defaultCategories) {
        await pool.query(
          'INSERT INTO notification_categories (name, description, color, icon) VALUES ($1, $2, $3, $4)',
          [category.name, category.description, category.color, category.icon]
        );
      }
      
      console.log('Default categories created successfully!');
      
      // Fetch again to show the created categories
      const newCategoriesResult = await pool.query('SELECT * FROM notification_categories ORDER BY id');
      console.log('Created categories:', newCategoriesResult.rows);
    }
    
    // Check if there are any users to test with
    const usersResult = await pool.query('SELECT id, username FROM users LIMIT 5');
    console.log('Sample users for testing:', usersResult.rows);
    
    // Check if notifications table exists
    const notificationsResult = await pool.query('SELECT COUNT(*) FROM notifications');
    console.log('Total notifications in database:', notificationsResult.rows[0].count);
    
    process.exit(0);
  } catch (error) {
    console.error('Error testing notifications:', error);
    process.exit(1);
  }
})();
