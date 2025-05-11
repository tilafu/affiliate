/**
 * Load drive history for a specific user
 * @param {number} userId - The ID of the user to load history for
 * @param {string} username - The username to display in the modal title
 */
async function loadDriveHistory(userId, username) {
    console.log(`Starting loadDriveHistory for userId=${userId}, username=${username}`);
    try {
        // Fetch drive logs from the API
        console.log(`Fetching data from /admin/drives/${userId}/logs`);
        const response = await fetchWithAuth(`/admin/drives/${userId}/logs`);
        console.log('API response received:', response);
        
        if (response.success) {
            // Check which property contains the history data
            const historyData = response.history || response.logs || response.drives || [];
            console.log('History data found:', historyData.length, 'entries');
            
            // Create table content for the modal
            let tableContent = `
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Product</th>
                                <th>Commission Earned</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>`;
            
            if (historyData.length > 0) {
                historyData.forEach(drive => {
                    tableContent += `
                        <tr>
                            <td>${new Date(drive.created_at).toLocaleString()}</td>
                            <td>${drive.product_name || 'N/A'}</td>
                            <td>$${drive.commission_amount || drive.commission || 0}</td>
                            <td>
                                <span class="status-badge status-${(drive.status || 'pending').toLowerCase()}">
                                    ${drive.status || 'PENDING'}
                                </span>
                            </td>
                        </tr>`;
                });
            } else {
                tableContent += `<tr><td colspan="4" class="text-center">No drive history found.</td></tr>`;
            }
            
            tableContent += `</tbody></table></div>`;
            
            // Use our safer modal creation function from the script in admin.html
            const title = `Drive History for ${username}`;
            const success = createAndShowModal('driveHistoryModal', title, tableContent);
            
            if (!success) {
                // Fallback method - use alert if modal fails
                console.warn('Modal creation failed, using alert fallback');
                showNotification(`Showing drive history for ${username}. ${historyData.length} entries found.`, 'info');
            }
        } else {
            console.warn('API returned success: false', response);
            showNotification('Failed to load drive history', 'error');
        }
    } catch (error) {
        console.error('Error loading drive history:', error);
        showNotification('Failed to load drive history', 'error');
    }
}
