// Test script to simulate the rating submission
const fetch = require('node-fetch'); // You might need to install this: npm install node-fetch

async function testRatingSubmission() {
    try {
        console.log('Testing rating submission endpoint...');
        
        // You'll need to get a real auth token from your browser's localStorage
        // Or from the network dev tools
        const authToken = 'YOUR_AUTH_TOKEN_HERE'; // Replace with actual token
        
        const testData = {
            rating: 5,
            productId: 123,
            productName: "Test Product",
            userTier: "gold",
            reviewText: "This is a test review from the automated test"
        };
        
        console.log('Sending request with data:', testData);
        
        const response = await fetch('http://localhost:3000/api/drive/add-commission', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers.raw());
        
        const responseText = await response.text();
        console.log('Response body:', responseText);
        
        if (response.ok) {
            const result = JSON.parse(responseText);
            console.log('✅ Success! Parsed response:', result);
        } else {
            console.log('❌ Error response');
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Instructions for getting auth token
console.log(`
To run this test:
1. Open your browser's dev tools (F12)
2. Go to the console tab
3. Run: localStorage.getItem('auth_token')
4. Copy the token and replace 'YOUR_AUTH_TOKEN_HERE' in this file
5. Run: node test-rating-endpoint.js
`);

// Uncomment the line below after setting the auth token
// testRatingSubmission();
