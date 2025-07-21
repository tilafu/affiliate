const http = require('http');

// Test the 404 handling
function test404(port, path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: port,
            path: path,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data.substring(0, 200) + '...' // First 200 chars
                });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.end();
    });
}

async function runTests() {
    console.log('Testing 404 error handling...\n');
    
    const tests = [
        { port: 3000, path: '/non-existent-page', description: 'Client Server - Non-existent HTML page' },
        { port: 3000, path: '/api/non-existent', description: 'Client Server - Non-existent API endpoint' },
        { port: 3001, path: '/non-existent-admin', description: 'Admin Server - Non-existent HTML page' },
        { port: 3001, path: '/api/admin/non-existent', description: 'Admin Server - Non-existent API endpoint' }
    ];

    for (const test of tests) {
        try {
            console.log(`Testing: ${test.description}`);
            console.log(`URL: http://localhost:${test.port}${test.path}`);
            
            const result = await test404(test.port, test.path);
            
            console.log(`Status Code: ${result.statusCode}`);
            console.log(`Content-Type: ${result.headers['content-type']}`);
            
            if (result.statusCode === 404) {
                if (test.path.startsWith('/api/')) {
                    console.log('✅ API 404 response correct');
                } else {
                    console.log('✅ HTML 404 page served correctly');
                }
            } else {
                console.log(`❌ Expected 404, got ${result.statusCode}`);
            }
            
            console.log('---\n');
            
        } catch (error) {
            console.log(`❌ Server not running on port ${test.port}: ${error.message}`);
            console.log('---\n');
        }
    }
}

runTests().catch(console.error);
