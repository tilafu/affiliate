// Test script to verify admin adjustment tracking
// This file is for testing purposes only

console.log('Testing admin adjustment tracking...');

// Test the API endpoints
async function testAdminAdjustments() {
    try {
        console.log('1. Testing /api/user/deposits endpoint...');
        const depositsResponse = await fetch('/api/user/deposits', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const depositsData = await depositsResponse.json();
        console.log('Deposits response:', depositsData);

        console.log('2. Testing /api/user/deposits/total endpoint...');
        const totalDepositsResponse = await fetch('/api/user/deposits/total', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const totalDepositsData = await totalDepositsResponse.json();
        console.log('Total deposits response:', totalDepositsData);

        console.log('3. Testing /api/user/withdraw-history endpoint...');
        const withdrawalsResponse = await fetch('/api/user/withdraw-history', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const withdrawalsData = await withdrawalsResponse.json();
        console.log('Withdrawals response:', withdrawalsData);

        console.log('4. Testing /api/user/withdrawals endpoint...');
        const totalWithdrawalsResponse = await fetch('/api/user/withdrawals', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const totalWithdrawalsData = await totalWithdrawalsResponse.json();
        console.log('Total withdrawals response:', totalWithdrawalsData);

    } catch (error) {
        console.error('Error testing admin adjustments:', error);
    }
}

// Call the test function
testAdminAdjustments();
