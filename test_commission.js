const tierCommissionService = require('./server/services/tierCommissionService');

async function testCommission() {
    try {
        // Test with combo = true
        const comboResult = await tierCommissionService.calculateCommissionForUser(2, 18.88, true);
        console.log('Combo commission result:', comboResult);
        
        // Test with combo = false
        const singleResult = await tierCommissionService.calculateCommissionForUser(2, 18.88, false);
        console.log('Single commission result:', singleResult);
        
        // Test with combo = null/undefined (should default to false)
        const nullResult = await tierCommissionService.calculateCommissionForUser(2, 18.88, null);
        console.log('Null commission result:', nullResult);
        
        process.exit(0);
    } catch (error) {
        console.error('Commission test error:', error);
        process.exit(1);
    }
}

testCommission();
