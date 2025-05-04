document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
        console.error('Authentication token not found. Redirecting to login.');
        // Optional: Use a notification function if available from main.js
        // showNotification('Authentication token not found. Redirecting to login.', 'error');
        window.location.href = 'login.html';
        return;
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

    // Tier Image Mapping (adjust paths as needed)
    const tierImagePaths = {
        bronze: './assets/uploads/packages/bronze_665c04ea981d91717306602.PNG', // Example path
        silver: './assets/uploads/packages/silver_665c0568227141717306728.PNG', // Example path
        gold: './assets/uploads/packages/gold_665c05eea02a21717306862.PNG',   // Example path
        platinum: './assets/uploads/packages/platinum_665c064b7faf81717306955.PNG', // Example path
        default: './assets/uploads/v2.PNG' // Fallback image
    };

    // Fetch data from both endpoints
    Promise.all([
        fetch(profileUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.ok ? res.json() : Promise.reject(`Profile fetch failed: ${res.status}`)),
        fetch(balancesUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.ok ? res.json() : Promise.reject(`Balances fetch failed: ${res.status}`))
    ])
    .then(([profileData, balancesData]) => {
        console.log("Profile Data:", profileData);
        console.log("Balances Data:", balancesData);

        // --- Update Profile Info ---
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
            if (usernameElem) usernameElem.textContent = 'Error';
            if (referralCodeElem) referralCodeElem.textContent = 'Error';
        }

        // --- Update Balances ---
        if (balancesData.success && balancesData.balances) {
            const balances = balancesData.balances;
            const mainBalance = parseFloat(balances.main_balance || 0).toFixed(2);
            const commissionBalance = parseFloat(balances.commission_balance || 0).toFixed(2);
            const frozenBalance = parseFloat(balances.frozen_balance || 0).toFixed(2);

            // Assuming "Daily Profits" corresponds to the commission balance
            if (dailyProfitsElem) dailyProfitsElem.innerHTML = `${commissionBalance}<small style="font-size:14px"> USDT</small>`;
            if (totalBalanceElem) totalBalanceElem.innerHTML = `${mainBalance}<small style="font-size:14px"> USDT</small>`;
            if (frozenBalanceElem) frozenBalanceElem.innerHTML = `${frozenBalance}<small style="font-size:14px"> USDT</small>`;

        } else {
            console.error('Failed to get balances data:', balancesData.message);
            if (dailyProfitsElem) dailyProfitsElem.textContent = 'Error';
            if (totalBalanceElem) totalBalanceElem.textContent = 'Error';
            if (frozenBalanceElem) frozenBalanceElem.textContent = 'Error';
        }

    })
    .catch(error => {
        console.error('Error fetching account data:', error);
        // Update UI to show errors
        if (usernameElem) usernameElem.textContent = 'Error';
        if (referralCodeElem) referralCodeElem.textContent = 'Error';
        if (dailyProfitsElem) dailyProfitsElem.textContent = 'Error';
        if (totalBalanceElem) totalBalanceElem.textContent = 'Error';
        if (frozenBalanceElem) frozenBalanceElem.textContent = 'Error';
        if (tierImageElem) tierImageElem.style.backgroundImage = `url(${tierImagePaths.default})`; // Fallback image on error

        // Optional: Use a notification function
        // showNotification(`Error loading account data: ${error}`, 'error');
    });
});
