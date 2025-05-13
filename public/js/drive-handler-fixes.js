// This file contains the fixed drive handler code for admin.js

/**
 * Fix for loadDriveHistory function to properly handle modals
 */ 
function fixDriveHistoryFunction() {
    // Properly replace the existing function with improved version
    window.loadDriveHistory = async function(userId, username) {
        console.log(`Starting loadDriveHistory for userId=${userId}, username=${username}`);
        try {
            // Fetch drive history logs
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
                
                // Use safer modal creation method
                if (typeof createAndShowModal === 'function') {
                    const title = `Drive History for ${username}`;
                    createAndShowModal('driveHistoryModal', title, tableContent);
                } else {
                    // If createAndShowModal isn't defined, implement a simple version
                    const modalHTML = `
                        <div class="modal fade" id="driveHistoryModal">
                            <div class="modal-dialog modal-lg">
                                <div class="modal-content">
                                    <div class="modal-header">
                                        <h5 class="modal-title">Drive History for ${username}</h5>
                                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                    </div>
                                    <div class="modal-body">${tableContent}</div>
                                    <div class="modal-footer">
                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                    </div>
                                </div>
                            </div>
                        </div>`;
                    
                    // Remove existing modal to avoid duplicates
                    const existingModal = document.getElementById('driveHistoryModal');
                    if (existingModal) existingModal.remove();
                    
                    // Add modal to DOM
                    document.body.insertAdjacentHTML('beforeend', modalHTML);
                    
                    // Show using jQuery to avoid Bootstrap issues
                    try {
                        $('#driveHistoryModal').modal('show');
                    } catch (error) {
                        console.error('Error showing modal:', error);
                        showNotification(`Drive history for ${username}: ${historyData.length} entries found.`, 'info');
                    }
                }
            } else {
                console.warn('API returned success: false', response);
                showNotification('Failed to load drive history', 'error');
            }
        } catch (error) {
            console.error('Error loading drive history:', error);
            showNotification('Failed to load drive history', 'error');
        }
    };
}

/**
 * Fix for reset drive functionality
 * NOTE: Event handlers are now centralized in admin-drives.js
 */
function fixResetDriveHandler() {
    // Event handlers moved to admin-drives.js for centralization
    console.log('Drive event handlers are now managed in admin-drives.js');
}

/**
 * Improved reset drive function
 */
async function resetDrive(userId) {
    try {        console.log(`Calling API endpoint: /api/admin/users/${userId}/reset-drive`);
        const response = await fetchWithAuth(`/api/admin/users/${userId}/reset-drive`, {
            method: 'POST'
        });
        console.log('Reset drive API response:', response);
        
        if (response.success) {
            showNotification('Drive reset successfully', 'success');
            
            // Refresh the drive data for this user
            console.log('Refreshing drive data for userId:', userId);
            if (typeof refreshDriveData === 'function') {
                await refreshDriveData(userId);
            } else {
                // If refreshDriveData isn't available, just reload all drives
                console.warn('refreshDriveData function not found, reloading all drives instead');
                if (typeof loadDrives === 'function') {
                    await loadDrives();
                }
            }
        } else {
            console.warn('API returned success: false', response);
            showNotification('Failed to reset drive: ' + (response.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error resetting drive:', error);
        showNotification('Failed to reset drive: ' + error.message, 'error');
    }
}

// Initialize the fixes when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Applying drive functionality fixes...');
    fixDriveHistoryFunction();
    fixResetDriveHandler();
    console.log('Drive functionality fixes applied');
});
