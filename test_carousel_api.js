const http = require('http');

function testAPI(endpoint, description) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    console.log(`\n🧪 Testing: ${description}`);
    console.log(`📍 Endpoint: GET http://localhost:3000${endpoint}`);

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`✅ Status: ${res.statusCode}`);
          console.log(`📊 Response:`, {
            success: response.success,
            count: response.count || response.products?.length || 'N/A',
            message: response.message || 'Success'
          });
          
          if (response.products && response.products.length > 0) {
            console.log(`🏆 Sample product:`, {
              name: response.products[0].name,
              price: response.products[0].price,
              commission: response.products[0].commission
            });
          }
          
          resolve({ status: res.statusCode, data: response });
        } catch (error) {
          console.log(`❌ JSON Parse Error:`, error.message);
          console.log(`📄 Raw response:`, data);
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Request Error: ${error.message}`);
      reject(error);
    });

    req.setTimeout(5000, () => {
      console.log(`⏰ Request timeout`);
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting API Tests...\n');
  
  try {
    // Test health endpoint
    await testAPI('/api/health', 'Health Check');
    
    // Test new public carousel endpoint
    await testAPI('/api/products/carousel', 'Public Products Carousel');
    
    // Test the protected endpoint (should fail without auth)
    await testAPI('/api/user/products/highvalue', 'Protected High-Value Products (should fail)');
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

runTests();
