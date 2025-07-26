const pool = require('./server/config/db');

async function testRatingInsert() {
    try {
        console.log('Testing product rating insert...');
        
        // Test data similar to what the client would send
        const testData = {
            userId: 1, // assuming user ID 1 exists
            productId: 123,
            productName: "Test Product",
            rating: 5,
            commissionAmount: 0.50,
            reviewText: "This is a test review text"
        };
        
        console.log('Test data:', testData);
        
        // Try the current server query (without review_text)
        console.log('\n1. Testing current server query (without review_text)...');
        try {
            const result1 = await pool.query(
                `INSERT INTO product_ratings 
                 (user_id, product_id, product_name, rating, commission_earned, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT (user_id, product_id) 
                 DO UPDATE SET 
                   rating = EXCLUDED.rating,
                   commission_earned = EXCLUDED.commission_earned,
                   updated_at = NOW()
                 RETURNING *`,
                [testData.userId, testData.productId, testData.productName, testData.rating, testData.commissionAmount]
            );
            console.log('✅ Success - Current query works');
            console.log('Inserted record:', result1.rows[0]);
        } catch (error) {
            console.log('❌ Error with current query:', error.message);
        }
        
        // Try with review_text included
        console.log('\n2. Testing query with review_text...');
        try {
            const result2 = await pool.query(
                `INSERT INTO product_ratings 
                 (user_id, product_id, product_name, rating, commission_earned, review_text, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 ON CONFLICT (user_id, product_id) 
                 DO UPDATE SET 
                   rating = EXCLUDED.rating,
                   commission_earned = EXCLUDED.commission_earned,
                   review_text = EXCLUDED.review_text,
                   updated_at = NOW()
                 RETURNING *`,
                [testData.userId, 124, testData.productName, testData.rating, testData.commissionAmount, testData.reviewText]
            );
            console.log('✅ Success - Query with review_text works');
            console.log('Inserted record:', result2.rows[0]);
        } catch (error) {
            console.log('❌ Error with review_text query:', error.message);
        }
        
        // Clean up test data
        await pool.query('DELETE FROM product_ratings WHERE user_id = $1 AND product_id IN ($2, $3)', [testData.userId, testData.productId, 124]);
        console.log('\n✅ Test data cleaned up');
        
    } catch (error) {
        console.error('Error in test:', error);
    } finally {
        await pool.end();
    }
}

testRatingInsert();
