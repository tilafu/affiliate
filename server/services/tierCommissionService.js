const pool = require('../config/db');

/**
 * Tier-based commission rate configuration
 */
const TIER_COMMISSION_RATES = {
    bronze: {
        perData: 0.005,      // 0.5%
        mergeData: 0.015     // 1.5%
    },
    silver: {
        perData: 0.01,       // 1%
        mergeData: 0.03      // 3%
    },
    gold: {
        perData: 0.015,      // 1.5%
        mergeData: 0.045     // 4.5%
    },
    platinum: {
        perData: 0.02,       // 2%
        mergeData: 0.06      // 6%
    }
};

/**
 * Get commission rate for a user based on their tier and task type
 * @param {number} userId - User ID
 * @param {boolean} isMergeData - Whether this is merge data (combo) or regular data
 * @returns {Promise<number>} Commission rate as decimal (e.g., 0.015 for 1.5%)
 */
async function getCommissionRateForUser(userId, isMergeData = false) {
    try {
        // Get user's tier from database
        const userResult = await pool.query(
            'SELECT tier FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            throw new Error(`User ${userId} not found`);
        }

        const userTier = userResult.rows[0].tier || 'bronze';
        
        return getCommissionRateByTier(userTier, isMergeData);
    } catch (error) {
        console.error('Error getting commission rate for user:', error);
        // Default to bronze tier for safety
        return getCommissionRateByTier('bronze', isMergeData);
    }
}

/**
 * Get commission rate by tier and task type
 * @param {string} tier - User tier (bronze, silver, gold, platinum)
 * @param {boolean} isMergeData - Whether this is merge data (combo) or regular data
 * @returns {number} Commission rate as decimal
 */
function getCommissionRateByTier(tier, isMergeData = false) {
    const normalizedTier = tier.toLowerCase();
    const tierRates = TIER_COMMISSION_RATES[normalizedTier] || TIER_COMMISSION_RATES.bronze;
    
    return isMergeData ? tierRates.mergeData : tierRates.perData;
}

/**
 * Calculate commission amount for a user
 * @param {number} userId - User ID
 * @param {number} productPrice - Product price
 * @param {boolean} isMergeData - Whether this is merge data (combo) or regular data
 * @returns {Promise<{commissionRate: number, commissionAmount: number}>}
 */
async function calculateCommissionForUser(userId, productPrice, isMergeData = false) {
    const commissionRate = await getCommissionRateForUser(userId, isMergeData);
    const commissionAmount = productPrice * commissionRate;
    
    return {
        commissionRate,
        commissionAmount: parseFloat(commissionAmount.toFixed(2))
    };
}

/**
 * Get all tier information for display purposes
 * @returns {object} Complete tier information
 */
function getTierInformation() {
    return {
        bronze: {
            name: 'Bronze',
            displayName: 'Basic Membership - Bronze',
            cost: 100,
            commissionPerData: '0.5%',
            commissionMergeData: '1.5%',
            dataLimit: 40,
            setsPerDay: 2,
            withdrawalLimit: 5000,
            withdrawalTimes: 1,
            handlingFee: '0%'
        },
        silver: {
            name: 'Silver',
            displayName: 'Plus Membership - Silver',
            cost: 1000,
            commissionPerData: '1%',
            commissionMergeData: '3%',
            dataLimit: 40,
            setsPerDay: 2,
            withdrawalLimit: 20000,
            withdrawalTimes: 2,
            handlingFee: '0%'
        },
        gold: {
            name: 'Gold',
            displayName: 'Elite Membership - Gold',
            cost: 3000,
            commissionPerData: '1.5%',
            commissionMergeData: '4.5%',
            dataLimit: 45,
            setsPerDay: 2,
            withdrawalLimit: 50000,
            withdrawalTimes: 2,
            handlingFee: '0%'
        },
        platinum: {
            name: 'Platinum',
            displayName: 'Supreme Membership - Platinum',
            cost: 5000,
            commissionPerData: '2%',
            commissionMergeData: '6%',
            dataLimit: 45,
            setsPerDay: 2,
            withdrawalLimit: 'unlimited',
            withdrawalTimes: 3,
            handlingFee: '0%'
        }
    };
}

module.exports = {
    getCommissionRateForUser,
    getCommissionRateByTier,
    calculateCommissionForUser,
    getTierInformation,
    TIER_COMMISSION_RATES
};
