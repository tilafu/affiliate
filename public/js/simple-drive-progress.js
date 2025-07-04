/**
 * Simplified Automatic Drive Progress Component
 * Shows real-time progress as users complete products in their data drive
 */

class SimpleDriveProgress {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            tier: 'bronze', // Default tier
            maxProducts: 45, // Default for bronze
            currentProgress: 0,
            totalCommission: 0,
            animationDuration: 800,
            ...options
        };
        
        this.tierLimits = {
            bronze: 45,
            silver: 45,
            gold: 50,
            platinum: 50,
            diamond: 50
        };
        
        this.init();
    }
    
    init() {
        if (!this.container) {
            console.error('Drive progress container not found');
            return false;
        }
        
        this.render();
        this.bindEvents();
        return true;
    }
      render() {
        const { tier, currentProgress, totalCommission, allTasksCompleted, allTasksTotal } = this.options;
        const maxProducts = this.options.maxProducts || this.tierLimits[tier] || 45;
        const progressPercent = Math.min((currentProgress / maxProducts) * 100, 100);
        const remaining = Math.max(maxProducts - currentProgress, 0);
        
        // Show additional stats if we have combo tasks
        const hasComboTasks = allTasksTotal && allTasksTotal > maxProducts;
        const additionalTasksHtml = hasComboTasks ? `
            <div class="drive-additional-tasks-info">
                <small class="text-muted">
                    Total Items: ${allTasksCompleted}/${allTasksTotal} 
                    (includes ${allTasksTotal - maxProducts} admin combo task${allTasksTotal - maxProducts !== 1 ? 's' : ''})
                </small>
            </div>
        ` : '';
        
        this.container.innerHTML = `
            <div class="drive-progress-wrapper" data-tier="${tier}">
                <div class="drive-progress-header">
                    <h3 class="drive-progress-title">Drive Progress</h3>
                    <div class="drive-progress-count">${currentProgress}/${maxProducts} Original Tasks</div>
                    <div class="drive-status-indicator drive-status-${this.getStatus()}">
                        ${this.getStatusText()}
                    </div>
                </div>
                
                <div class="drive-progress-bar-container">
                    <div class="drive-progress-bar-fill" style="width: ${progressPercent}%"></div>
                </div>
                
                <div class="drive-progress-stats">
                    <div class="drive-progress-stat">
                        <span class="drive-progress-stat-value">${currentProgress}</span>
                        <span class="drive-progress-stat-label">Completed</span>
                    </div>
                    <div class="drive-progress-stat">
                        <span class="drive-progress-stat-value">${remaining}</span>
                        <span class="drive-progress-stat-label">Remaining</span>
                    </div>
                    <div class="drive-progress-stat">
                        <span class="drive-progress-stat-value">${Math.round(progressPercent)}%</span>
                        <span class="drive-progress-stat-label">Complete</span>
                    </div>
                </div>
                
                ${additionalTasksHtml}
                
                <div class="drive-commission-display">
                    <p class="drive-commission-value">$${totalCommission.toFixed(2)} USDT</p>
                    <p class="drive-commission-label">Total Commission Earned</p>
                </div>
            </div>
        `;
    }
      getStatus() {
        const { currentProgress } = this.options;
        const maxProducts = this.options.maxProducts || this.tierLimits[this.options.tier] || 45;
        
        if (currentProgress >= maxProducts) return 'completed';
        if (currentProgress > 0) return 'active';
        return 'paused';
    }
    
    getStatusText() {
        const status = this.getStatus();
        switch (status) {
            case 'completed': return '✓ Complete';
            case 'active': return '● Active';
            case 'paused': return '⏸ Ready';
            default: return '● Ready';
        }
    }
      updateProgress(newProgress, newCommission = null) {
        if (!this.container) {
            console.warn('Cannot update progress: container not found');
            return;
        }
        
        this.options.currentProgress = newProgress;
        if (newCommission !== null) {
            this.options.totalCommission = newCommission;
        }
        
        // Add update animation
        const progressWrapper = this.container.querySelector('.drive-progress-wrapper');
        if (progressWrapper) {
            progressWrapper.classList.add('drive-progress-update');
        }
        
        setTimeout(() => {
            this.render();
            
            // Remove animation class
            setTimeout(() => {
                if (progressWrapper) {
                    progressWrapper.classList.remove('drive-progress-update');
                }
            }, 600);
        }, 100);
        
        // Check for completion
        const maxProducts = this.tierLimits[this.options.tier] || 45;
        if (newProgress >= maxProducts) {
            this.onComplete();
        }
    }

    /**
     * Update progress with drive status data from backend API
     * Uses original tasks count (excludes admin-added combo tasks)
     * @param {Object} data - Drive status data from the backend
     */
    updateFromDriveStatus(data) {
        if (!data) return;
        
        // Use original tasks for progress calculation (like admin modal)
        const originalCompleted = data.original_tasks_completed || data.tasks_completed || 0;
        const originalRequired = data.original_tasks_required || data.tasks_required || 0;
        const totalCommission = parseFloat(data.total_commission || 0);
        
        // Store additional stats for display purposes
        const allTasksCompleted = data.all_tasks_completed || originalCompleted;
        const allTasksTotal = data.all_tasks_total || originalRequired;
        
        // Update options with original tasks data
        this.options.currentProgress = originalCompleted;
        this.options.maxProducts = originalRequired;
        this.options.totalCommission = totalCommission;
        
        // Store additional data for comprehensive display
        this.options.allTasksCompleted = allTasksCompleted;
        this.options.allTasksTotal = allTasksTotal;
        this.options.status = data.status;
        
        // Add update animation
        this.container.querySelector('.drive-progress-wrapper')?.classList.add('drive-progress-update');
        
        setTimeout(() => {
            this.render();
            
            // Remove animation class
            setTimeout(() => {
                this.container.querySelector('.drive-progress-wrapper')?.classList.remove('drive-progress-update');
            }, 600);
        }, 100);
        
        // Check for completion
        if (originalCompleted >= originalRequired && originalRequired > 0) {
            this.onComplete();
        }
    }
    
    updateCommission(newCommission) {
        this.options.totalCommission = newCommission;
        const commissionValue = this.container.querySelector('.drive-commission-value');
        if (commissionValue) {
            commissionValue.textContent = `$${newCommission.toFixed(2)} USDT`;
        }
    }
    
    setTier(newTier) {
        this.options.tier = newTier;
        this.options.maxProducts = this.tierLimits[newTier] || 45;
        this.render();
    }
    
    onComplete() {
        const wrapper = this.container.querySelector('.drive-progress-wrapper');
        if (wrapper) {
            wrapper.classList.add('drive-progress-completed');
            
            // Show celebration effect
            this.showCompletionCelebration();
        }
    }
    
    showCompletionCelebration() {
        // Simple celebration animation
        const wrapper = this.container.querySelector('.drive-progress-wrapper');
        if (wrapper) {
            wrapper.style.animation = 'drive-progress-pulse 0.6s ease-in-out 3';
        }
        
        // Optional: Trigger custom completion event
        if (this.options.onComplete) {
            this.options.onComplete(this.options);
        }
    }
    
    bindEvents() {
        // Listen for global drive progress updates
        window.addEventListener('driveProgressUpdate', (event) => {
            const { progress, commission } = event.detail;
            this.updateProgress(progress, commission);
        });
        
        window.addEventListener('driveCommissionUpdate', (event) => {
            const { commission } = event.detail;
            this.updateCommission(commission);
        });
    }
    
    // Static method to trigger progress updates from anywhere
    static updateGlobalProgress(progress, commission) {
        window.dispatchEvent(new CustomEvent('driveProgressUpdate', {
            detail: { progress, commission }
        }));
    }
    
    static updateGlobalCommission(commission) {
        window.dispatchEvent(new CustomEvent('driveCommissionUpdate', {
            detail: { commission }
        }));
    }
}

// Global instance for easy access
let globalDriveProgress = null;

// Initialize function for easy setup
function initializeDriveProgress(containerId, options = {}) {
    // Check if container exists, if not try to find a suitable parent
    let container = document.getElementById(containerId);
    
    if (!container) {
        console.warn(`Container '${containerId}' not found. Looking for alternative containers...`);
        
        // Try to find the card body in the drive progress section
        const cardBody = document.querySelector('.card-body');
        if (cardBody && cardBody.closest('.card').querySelector('h6')?.textContent.includes('Drive Progress')) {
            cardBody.id = containerId;
            container = cardBody;
            console.log(`Assigned ID '${containerId}' to existing drive progress card body`);
        } else {
            console.error(`No suitable container found for drive progress`);
            return null;
        }
    }
    
    globalDriveProgress = new SimpleDriveProgress(containerId, options);
    return globalDriveProgress;
}

// Integration with existing task.js variables
function syncWithTaskVariables() {
    if (typeof window.totalTasksRequired !== 'undefined' && 
        typeof window.tasksCompleted !== 'undefined' && 
        typeof window.totalDriveCommission !== 'undefined') {
        
        if (globalDriveProgress) {
            globalDriveProgress.updateProgress(
                window.tasksCompleted, 
                window.totalDriveCommission
            );
        }
    }
}

// Auto-sync every 2 seconds if variables exist
setInterval(syncWithTaskVariables, 2000);

// Make available globally
window.SimpleDriveProgress = SimpleDriveProgress;
window.initializeDriveProgress = initializeDriveProgress;
window.globalDriveProgress = globalDriveProgress;

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleDriveProgress;
}
