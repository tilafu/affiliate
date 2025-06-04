document.addEventListener('DOMContentLoaded', () => {
    // Use centralized authentication check
    const authData = requireAuth();
    if (!authData) {
        return; // requireAuth will handle redirect
    }

    // API Endpoints
    const profileUrl = `${API_BASE_URL}/api/user/profile`;
    const balancesUrl = `${API_BASE_URL}/api/user/balances`;

    // DOM Elements
    const usernameElem = document.getElementById('account-username');
    const referralCodeElem = document.getElementById('account-referral-code');
    const tierImageElem = document.getElementById('account-tier-image');
    const dailyProfitsElem = document.getElementById('account-daily-profits');
    const totalBalanceElem = document.getElementById('account-total-balance');
    const frozenBalanceElem = document.getElementById('account-frozen-balance');

    // Tier Image Mapping
    const tierImagePaths = {
        bronze: './assets/uploads/packages/bronze_665c04ea981d91717306602.PNG',
        silver: './assets/uploads/packages/silver_665c0568227141717306728.PNG',
        gold: './assets/uploads/packages/gold_665c05eea02a21717306862.PNG',
        platinum: './assets/uploads/packages/platinum_665c064b7faf81717306955.PNG',
        default: './assets/uploads/v2.PNG'
    };

    // Helper function to format balance display
    const formatBalance = (value) => {
        const amount = parseFloat(value || 0).toFixed(2);
        return `${amount}<small style="font-size:14px"> USDT</small>`;
    };

    // Helper function to update DOM with error state
    const setErrorState = (message = 'Error loading data') => {
        if (usernameElem) usernameElem.textContent = 'Error';
        if (referralCodeElem) referralCodeElem.textContent = 'Error';
        if (dailyProfitsElem) dailyProfitsElem.innerHTML = formatBalance(0);
        if (totalBalanceElem) totalBalanceElem.innerHTML = formatBalance(0);
        if (frozenBalanceElem) frozenBalanceElem.innerHTML = formatBalance(0);
        if (tierImageElem) tierImageElem.style.backgroundImage = `url(${tierImagePaths.default})`;
        
        if (typeof showNotification === 'function') {
            showNotification(message, 'error');
        }
    };

    // Fetch both profile and balances data
    Promise.all([
        fetch(profileUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => {
            if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
            return res.json();
        }),
        fetch(balancesUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => {
            if (!res.ok) throw new Error(`Balances fetch failed: ${res.status}`);
            return res.json();
        })
    ])
    .then(([profileData, balancesData]) => {
        console.log("Profile Data:", profileData);
        console.log("Balances Data:", balancesData);

        // Update Profile Info
        if (profileData.success && profileData.user) {
            const user = profileData.user;
            if (usernameElem) usernameElem.textContent = user.username || 'N/A';
            if (referralCodeElem) referralCodeElem.textContent = user.referral_code || 'N/A';

            // Update Tier Image
            if (tierImageElem) {
                const tier = user.tier ? user.tier.toLowerCase() : 'default';
                const imagePath = tierImagePaths[tier] || tierImagePaths.default;
                tierImageElem.style.backgroundImage = `url(${imagePath})`;
                console.log(`Set tier image for ${tier} to ${imagePath}`);
            }
        } else {
            console.error('Failed to get profile data:', profileData.message);
            throw new Error(profileData.message || 'Failed to load profile data');
        }

        // Update Balances
        if (balancesData.success && balancesData.balances) {
            const balances = balancesData.balances;
            if (dailyProfitsElem) dailyProfitsElem.innerHTML = formatBalance(balances.commission_balance);
            if (totalBalanceElem) totalBalanceElem.innerHTML = formatBalance(balances.main_balance);
            if (frozenBalanceElem) frozenBalanceElem.innerHTML = formatBalance(balances.frozen_balance);
        } else {
            console.error('Failed to get balances data:', balancesData.message);
            throw new Error(balancesData.message || 'Failed to load balance data');
        }
    })
    .catch(error => {
        console.error('Error fetching account data:', error);
        setErrorState(`Error loading account data: ${error.message}`);
    });
});
