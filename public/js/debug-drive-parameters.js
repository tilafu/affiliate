
/**
 * Debugging utility for monitoring drive parameters
 * Add this script to task.html to get additional debugging tools
 */

(function() {
    // Create debug panel on page
    function createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 0;
            right: 0;
            width: 300px; 
            background-color: rgba(0,0,0,0.8);
            color: #00ff00;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            z-index: 9999;
            max-height: 400px;
            overflow-y: auto;
            transition: transform 0.3s;
            transform: translateY(calc(100% - 30px));
            border-top-left-radius: 5px;
        `;
        
        // Add header that always shows
        const header = document.createElement('div');
        header.textContent = '▲ Parameter Debug Panel ▲';
        header.style.cssText = `
            cursor: pointer;
            text-align: center;
            background-color: #333;
            padding: 5px;
            margin: -10px -10px 10px -10px;
        `;
        
        // Toggle panel visibility on click
        header.addEventListener('click', () => {
            if (panel.style.transform === 'translateY(0px)') {
                panel.style.transform = 'translateY(calc(100% - 30px))';
                header.textContent = '▲ Parameter Debug Panel ▲';
            } else {
                panel.style.transform = 'translateY(0)';
                header.textContent = '▼ Parameter Debug Panel ▼';
            }
        });
        
        panel.appendChild(header);
        
        // Content area for debug info
        const content = document.createElement('div');
        content.id = 'debug-panel-content';
        content.style.cssText = `
            padding-top: 5px;
        `;
        panel.appendChild(content);
        
        document.body.appendChild(panel);
    }
    
    // Update debug panel with current parameters
    function updateDebugPanel() {
        const content = document.getElementById('debug-panel-content');
        if (!content) return;
        
        // Get current parameters from global variables
        // Assuming these variables are defined in task.js
        content.innerHTML = `
            <div>
                <strong>Drive Session ID:</strong> ${window.currentDriveSessionId || 'undefined'}
            </div>
            <div>
                <strong>Drive Config ID:</strong> ${window.currentDriveConfigurationId || 'undefined'}
            </div>
            <div>
                <strong>Tasks:</strong> ${window.tasksCompleted || 0}/${window.totalTasksRequired || 0}
            </div>
            <div>
                <strong>Commission:</strong> ${window.totalDriveCommission || 0} USDT
            </div>
            <div>
                <strong>LocalStorage Session ID:</strong> ${localStorage.getItem('current_drive_session_id') || 'undefined'}
            </div>
            <hr/>
            <div>
                <strong>Current Product:</strong> ${window.currentProductData ? JSON.stringify(window.currentProductData, null, 2).substring(0, 100) + '...' : 'undefined'}
            </div>
            <hr/>
            <div>
                <button id="debug-force-error">Simulate 500 Error</button>
                <button id="debug-clear-session">Clear Session ID</button>
                <button id="debug-fix-session">Fix Session ID</button>
            </div>
            <div>
                <button id="debug-view-id-history">View ID History</button>
            </div>
        `;
        
        // Add event listeners to debug buttons
        document.getElementById('debug-force-error').addEventListener('click', () => {
            if (window.currentProductData) {
                // Back up original data
                const originalData = JSON.parse(JSON.stringify(window.currentProductData));
                // Corrupt data to force error
                window.currentProductData.order_id = null;
                window.currentProductData.product_id = undefined;
                alert('Product data corrupted to simulate error. Next purchase will fail.');
                
                // Restore after 10 seconds
                setTimeout(() => {
                    window.currentProductData = originalData;
                    alert('Product data restored.');
                }, 10000);
            } else {
                alert('No product data available to corrupt.');
            }
        });
        
        document.getElementById('debug-clear-session').addEventListener('click', () => {
            localStorage.removeItem('current_drive_session_id');
            window.currentDriveSessionId = null;
            alert('Session ID cleared from localStorage and memory.');
            updateDebugPanel();
        });
        
        document.getElementById('debug-fix-session').addEventListener('click', () => {
            if (window.idTracking && window.idTracking.sessionIdHistory && window.idTracking.sessionIdHistory.length > 0) {
                const lastValidId = window.idTracking.sessionIdHistory[window.idTracking.sessionIdHistory.length - 1];
                localStorage.setItem('current_drive_session_id', lastValidId);
                window.currentDriveSessionId = lastValidId;
                alert(`Session ID restored to ${lastValidId}`);
                updateDebugPanel();
            } else {
                alert('No session ID history available to restore from.');
            }
        });
        
        document.getElementById('debug-view-id-history').addEventListener('click', () => {
            if (window.idTracking) {
                const historyData = window.idTracking.getHistory();
                const sessionHistory = historyData.sessionIds.map((id, index) => `${index}: ${id}`).join('\n');
                const orderHistory = historyData.orderIds.map((id, index) => `${index}: ${id}`).join('\n');
                const productHistory = historyData.productIds.map((id, index) => `${index}: ${id}`).join('\n');
                
                alert(`SESSION ID HISTORY:\n${sessionHistory}\n\nORDER ID HISTORY:\n${orderHistory}\n\nPRODUCT ID HISTORY:\n${productHistory}`);
            } else {
                alert('ID tracking not available.');
            }
        });
    }
    
    // Initialize when DOM is ready
    function init() {
        createDebugPanel();
        
        // Update panel periodically
        setInterval(updateDebugPanel, 1000);
        
        // Intercept fetch to log API calls related to drive
        const originalFetch = window.fetch;
        window.fetch = function(url, options) {
            if (typeof url === 'string' && url.includes('/api/drive/')) {
                const debugContent = document.getElementById('debug-panel-content');
                if (debugContent) {
                    const timestamp = new Date().toLocaleTimeString();
                    const requestDiv = document.createElement('div');
                    requestDiv.style.color = '#ffcc00';
                    requestDiv.innerHTML = `[${timestamp}] API Call: ${url.split('/').pop()}`;
                    
                    // Log request payload if available
                    if (options && options.body) {
                        try {
                            const payload = JSON.parse(options.body);
                            const payloadDiv = document.createElement('div');
                            payloadDiv.style.color = '#aaaaaa';
                            payloadDiv.style.fontSize = '10px';
                            payloadDiv.innerHTML = `Request: ${JSON.stringify(payload).substring(0, 100)}...`;
                            debugContent.appendChild(payloadDiv);
                        } catch (e) {
                            // Ignore parsing errors
                        }
                    }
                    
                    debugContent.appendChild(requestDiv);
                    
                    // Keep only the last 20 API logs
                    const logs = debugContent.querySelectorAll('div');
                    if (logs.length > 40) {
                        for (let i = 0; i < logs.length - 40; i++) {
                            if (logs[i].id !== 'debug-buttons') {
                                debugContent.removeChild(logs[i]);
                            }
                        }
                    }
                }
            }
            return originalFetch.apply(this, arguments);
        };
    }
    
    // Add event listener for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
