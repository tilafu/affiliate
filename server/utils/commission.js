function getCommissionRatesForTier(tier) {
    switch (tier) {
        case 'platinum':
            return { single: 0.02, combo: 0.06 };
        case 'gold':
            return { single: 0.015, combo: 0.045 };
        case 'silver':
            return { single: 0.01, combo: 0.03 };
        case 'bronze':
        default:
            return { single: 0.005, combo: 0.015 };
    }
}

function calculateCommission(price, tier, type = 'single') {
    const rates = getCommissionRatesForTier(tier);
    return price * (type === 'combo' ? rates.combo : rates.single);
}

module.exports = { getCommissionRatesForTier, calculateCommission };
