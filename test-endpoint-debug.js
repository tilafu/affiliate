const http = require('http');

async function testEndpoint() {
    console.log('Testing rating submission endpoint with debugging...');
    
    // Test without authentication first to see if we get a 401 or different error
    const testData = {
        rating: 5,
        productId: 123,
        productName: "Test Product",
        userTier: "gold",
        reviewText: "This is a test review"
    };
    
    const postData = JSON.stringify(testData);
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/drive/add-commission',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    console.log('Making request to:', `http://${options.hostname}:${options.port}${options.path}`);
    console.log('Request data:', testData);
    
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            console.log('Response status:', res.statusCode);
            console.log('Response headers:', res.headers);
            
            let responseBody = '';
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            
            res.on('end', () => {
                console.log('Response body:', responseBody);
                
                if (res.statusCode === 401) {
                    console.log('✅ Expected 401 - Authentication required');
                } else if (res.statusCode === 500) {
                    console.log('❌ Got 500 error - This indicates the endpoint exists but has an internal error');
                    try {
                        const parsed = JSON.parse(responseBody);
                        console.log('Parsed error response:', parsed);
                    } catch (e) {
                        console.log('Could not parse error response as JSON');
                    }
                } else {
                    console.log(`Unexpected status code: ${res.statusCode}`);
                }
                
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: responseBody
                });
            });
        });
        
        req.on('error', (error) => {
            console.error('Request error:', error);
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

testEndpoint().catch(console.error);
