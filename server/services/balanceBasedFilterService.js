const pool = require('../config/db');
const logger = require('../logger');

/**
 * Balance-based product filtering service
 * Filters products based on user balance (80%-99% of balance range)
 */

/**
 * Get products within balance range for a user
 * @param {number} userId - User ID
 * @param {number} userBalance - User's current balance
 * @param {number} limit - Maximum number of products to return
 * @param {Object} client - Database client (optional, for transactions)
 * @returns {Array} Array of filtered products
 */
async function getProductsInBalanceRange(userId, userBalance, limit = null, client = pool) {
    const minPrice = userBalance * 0.8;  // 80% of balance
    const maxPrice = userBalance * 0.99; // 99% of balance

    logger.info(`Balance-based filtering for user ${userId}: balance=${userBalance}, range=${minPrice}-${maxPrice}`);

    let query = `
        SELECT id, name, price, description, image_url, min_balance_required
        FROM products 
        WHERE is_active = TRUE 
        AND price >= $1 
        AND price <= $2
        ORDER BY RANDOM()`;
    
    const queryParams = [minPrice.toFixed(2), maxPrice.toFixed(2)];
    
    if (limit && limit > 0) {
        query += ` LIMIT $3`;
        queryParams.push(limit);
    }

    try {
        const result = await client.query(query, queryParams);
        logger.info(`Found ${result.rows.length} products in balance range for user ${userId}`);
        return result.rows;
    } catch (error) {
        logger.error(`Error filtering products by balance for user ${userId}:`, error);
        throw error;
    }
}

/**
 * Get tier-based product quantity
 * @param {string} tier - User tier (bronze, silver, gold, platinum)
 * @returns {number} Number of products for the tier
 */
function getTierProductQuantity(tier) {
    const tierMap = {
        'bronze': 40,
        'silver': 40,
        'gold': 45,
        'platinum': 50
    };
    
    return tierMap[tier?.toLowerCase()] || 40; // Default to bronze
}

/**
 * Create drive configuration with balance-based filtering and tier quantities
 * @param {number} userId - User ID
 * @param {string} tier - User tier
 * @param {number} userBalance - User's current balance
 * @param {Object} client - Database client for transactions
 * @returns {Object} Drive configuration details
 */
async function createBalanceBasedDriveConfiguration(userId, tier, userBalance, client = pool) {
    const productQuantity = getTierProductQuantity(tier);
    const filteredProducts = await getProductsInBalanceRange(userId, userBalance, productQuantity, client);

    if (filteredProducts.length === 0) {
        throw new Error(`No products found within balance range (${(userBalance * 0.8).toFixed(2)} - ${(userBalance * 0.99).toFixed(2)}) for user ${userId}`);
    }

    logger.info(`Creating balance-based drive configuration for user ${userId}: tier=${tier}, quantity=${productQuantity}, found=${filteredProducts.length} products`);

    return {
        productQuantity,
        filteredProducts: filteredProducts.slice(0, productQuantity), // Ensure we don't exceed tier limit
        tier,
        userBalance,
        priceRange: {
            min: userBalance * 0.8,
            max: userBalance * 0.99
        }
    };
}

/**
 * Validate if user can afford drive with current balance
 * @param {number} userBalance - User's current balance
 * @param {number} minRequiredBalance - Minimum required balance for drive type
 * @returns {boolean} Whether user can start drive
 */
function canAffordDrive(userBalance, minRequiredBalance = 50) {
    return userBalance >= minRequiredBalance;
}

/**
 * Get recommended products for admin selection based on balance filtering
 * @param {number} targetBalance - Target balance to filter against
 * @param {number} limit - Maximum number of products
 * @param {Object} client - Database client
 * @returns {Array} Recommended products
 */
async function getRecommendedProductsForBalance(targetBalance, limit = 100, client = pool) {
    return await getProductsInBalanceRange(0, targetBalance, limit, client);
}

module.exports = {
    getProductsInBalanceRange,
    getTierProductQuantity,
    createBalanceBasedDriveConfiguration,
    canAffordDrive,
    getRecommendedProductsForBalance
};
