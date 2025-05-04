require('dotenv').config({ path: '../.env' }); // Load environment variables from the root .env file
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const productsFilePath = path.join(__dirname, '../products.json');

async function populateProducts() {
  let client;
  try {
    const productsData = fs.readFileSync(productsFilePath, 'utf8');
    const products = JSON.parse(productsData);

    client = await pool.connect();
    await client.query('BEGIN'); // Start transaction

    // Clear existing products (optional)
    // await client.query('DELETE FROM products');
    // console.log('Cleared existing products.');

    for (const product of products) {
      const { name, price, image_file } = product;

      // Construct the image URL relative to the public directory
      // Ensure the correct path is used for the frontend
      const imageUrl = `./assets/uploads/images/${path.basename(image_file)}`;

      const query = `
        INSERT INTO products (name, price, min_balance_required, is_active, image_url)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          min_balance_required = EXCLUDED.min_balance_required,
          is_active = EXCLUDED.is_active,
          image_url = EXCLUDED.image_url;
      `;
      const min_balance_required = product.min_balance_required || 0;
      const is_active = product.is_active !== undefined ? product.is_active : true;

      await client.query(query, [name, price, min_balance_required, is_active, imageUrl]);
      console.log(`Inserted product: ${name}`);
    }

    await client.query('COMMIT'); // Commit transaction
    console.log('Product population complete.');

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK'); // Rollback on error
    }
    console.error('Error populating products:', error);
  } finally {
    if (client) {
      client.release(); // Release client
    }
    pool.end(); // Close the pool after the script finishes
  }
}

populateProducts();
