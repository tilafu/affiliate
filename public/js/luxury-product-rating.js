/**
 * Luxury Product Rating Modal Component
 * Handles post-purchase product rating with tier-based compensation
 * Uses unique function names to avoid conflicts with existing modal systems
 */

class LuxuryProductRatingModal {
    constructor() {
        this.isOpen = false;
        this.currentProductData = null;
        this.onContinueCallback = null;
        this.selectedStars = 0;
        this.reviewText = '';
        this.ratingType = 'manual'; // 'manual' or 'ai'
        
        // Compensation matrix based on user tier
        this.compensationMatrix = {
            'Bronze': { manual: 0.40, ai: 0.20 },
            'Silver': { manual: 0.70, ai: 0.30 },
            'Gold': { manual: 0.90, ai: 0.50 }
        };
    }
    
    /**
     * Show the rating modal for a product
     * @param {Object} productData - Product information
     * @param {Function} onContinue - Callback to execute after rating submission
     */
    show(productData, onContinue) {
        if (this.isOpen) {
            console.warn('LuxuryProductRatingModal: Modal is already open');
            return;
        }
        
        this.currentProductData = productData;
        this.onContinueCallback = onContinue;
        this.isOpen = true;
        
        this.createModal();
        this.attachEventListeners();
        
        // Show with animation
        requestAnimationFrame(() => {
            const overlay = document.getElementById('lux-rating-modal-overlay');
            if (overlay) {
                overlay.classList.add('show');
            }
        });
    }
    
    /**
     * Create the modal HTML structure
     */
    createModal() {
        const userTier = this.getUserTier();
        const compensation = this.calculateCompensation('manual', userTier);
        
        const modalHTML = `
            <div id="lux-rating-modal-overlay" class="lux-rating-modal-overlay">
                <div class="lux-rating-modal">
                    <div class="lux-rating-modal-header">
                        <button class="lux-rating-modal-close" id="lux-rating-close">×</button>
                        <h3 class="lux-rating-modal-title">Rate Your Experience</h3>
                        <p class="lux-rating-modal-subtitle">Help others and earn extra commission</p>
                    </div>
                    
                    <div class="lux-rating-tabs">
                        <button class="lux-tab-btn active" data-tab="manual" id="lux-tab-manual">
                            Manual Review
                        </button>
                        <button class="lux-tab-btn" data-tab="ai" id="lux-tab-ai">
                            AI Generated
                        </button>
                    </div>
                    
                    <div class="lux-rating-content">
                        <!-- Manual Rating Tab -->
                        <div id="lux-manual-rating" class="lux-tab-content active">
                            <div class="lux-star-rating" id="lux-star-rating">
                                ${this.createStarRating()}
                            </div>
                            <textarea 
                                class="lux-review-textarea" 
                                id="lux-review-text"
                                placeholder="Share your thoughts about this product..."
                                maxlength="500"></textarea>
                        </div>
                        
                        <!-- AI Generated Tab -->
                        <div id="lux-ai-rating" class="lux-tab-content">
                            <button class="lux-ai-generate-btn" id="lux-ai-generate">
                                <i class="fas fa-magic"></i> Generate AI Review
                            </button>
                            <div class="lux-ai-preview" id="lux-ai-preview" style="display: none;"></div>
                        </div>
                    </div>
                    
                    <div class="lux-compensation-info">
                        <div class="lux-tier-display">
                            <span class="lux-user-tier">${userTier} Tier</span>
                            <span class="lux-compensation" id="lux-compensation-amount">+$${compensation.toFixed(2)} USDT</span>
                        </div>
                    </div>
                    
                    <div class="lux-modal-actions">
                        <button class="lux-submit-rating-btn" id="lux-submit-rating">
                            Submit & Claim Bonus
                        </button>
                        <button class="lux-skip-rating-btn" id="lux-skip-rating">
                            Skip This Time
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    /**
     * Create star rating HTML
     */
    createStarRating() {
        let starsHTML = '';
        for (let i = 1; i <= 5; i++) {
            starsHTML += `<span class="lux-star" data-rating="${i}">★</span>`;
        }
        return starsHTML;
    }
    
    /**
     * Attach event listeners to modal elements
     */
    attachEventListeners() {
        const overlay = document.getElementById('lux-rating-modal-overlay');
        const closeBtn = document.getElementById('lux-rating-close');
        const tabButtons = document.querySelectorAll('.lux-tab-btn');
        const stars = document.querySelectorAll('.lux-star');
        const aiGenerateBtn = document.getElementById('lux-ai-generate');
        const submitBtn = document.getElementById('lux-submit-rating');
        const skipBtn = document.getElementById('lux-skip-rating');
        const reviewTextarea = document.getElementById('lux-review-text');
        
        // Close modal events
        closeBtn?.addEventListener('click', () => this.close());
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });
        
        // Tab switching
        tabButtons.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });
        
        // Star rating
        stars.forEach(star => {
            star.addEventListener('click', () => this.setStarRating(parseInt(star.dataset.rating)));
            star.addEventListener('mouseenter', () => this.highlightStars(parseInt(star.dataset.rating)));
            star.addEventListener('mouseleave', () => this.highlightStars(this.selectedStars));
        });
        
        // AI generation
        aiGenerateBtn?.addEventListener('click', () => this.generateAIReview());
        
        // Form submission
        submitBtn?.addEventListener('click', () => this.submitRating());
        skipBtn?.addEventListener('click', () => this.skipRating());
        
        // Review text change
        reviewTextarea?.addEventListener('input', (e) => {
            this.reviewText = e.target.value;
        });
        
        // Keyboard events
        document.addEventListener('keydown', this.handleKeydown.bind(this));
    }
    
    /**
     * Switch between manual and AI tabs
     */
    switchTab(tabType) {
        // Update tab buttons
        document.querySelectorAll('.lux-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabType);
        });
        
        // Update tab content
        document.querySelectorAll('.lux-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `lux-${tabType}-rating`);
        });
        
        // Update rating type and compensation
        this.ratingType = tabType;
        this.updateCompensationDisplay();
    }
    
    /**
     * Set star rating
     */
    setStarRating(rating) {
        this.selectedStars = rating;
        this.highlightStars(rating);
    }
    
    /**
     * Highlight stars up to the given rating
     */
    highlightStars(rating) {
        document.querySelectorAll('.lux-star').forEach((star, index) => {
            star.classList.toggle('active', index < rating);
        });
    }
    
    /**
     * Generate AI review (placeholder implementation)
     */
    async generateAIReview() {
        const generateBtn = document.getElementById('lux-ai-generate');
        const preview = document.getElementById('lux-ai-preview');
        
        if (!generateBtn || !preview) return;
        
        // Show loading state
        generateBtn.textContent = 'Generating...';
        generateBtn.disabled = true;
        
        try {
            // Simulate AI generation (replace with actual AI service)
            await this.delay(2000);
            
            const aiReview = this.generateMockAIReview();
            
            preview.textContent = aiReview;
            preview.style.display = 'block';
            
            generateBtn.textContent = 'Regenerate AI Review';
            generateBtn.disabled = false;
            
            // Set default 5-star rating for AI
            this.selectedStars = 5;
            this.reviewText = aiReview;
            
        } catch (error) {
            console.error('Error generating AI review:', error);
            generateBtn.textContent = 'Try Again';
            generateBtn.disabled = false;
        }
    }
    
    /**
     * Generate a mock AI review (replace with actual AI service)
     */
    generateMockAIReview() {
        const positiveAdjectives = ['excellent', 'outstanding', 'impressive', 'reliable', 'high-quality'];
        const features = ['build quality', 'performance', 'design', 'functionality', 'value'];
        const conclusions = ['Highly recommended!', 'Great purchase decision.', 'Exceeded expectations.'];
        
        const adj = positiveAdjectives[Math.floor(Math.random() * positiveAdjectives.length)];
        const feature = features[Math.floor(Math.random() * features.length)];
        const conclusion = conclusions[Math.floor(Math.random() * conclusions.length)];
        
        return `This product offers ${adj} ${feature}. The overall experience has been very satisfying and meets all my requirements. ${conclusion}`;
    }
    
    /**
     * Submit the rating
     */
    async submitRating() {
        if (!this.validateRating()) return;
        
        const submitBtn = document.getElementById('lux-submit-rating');
        if (submitBtn) {
            submitBtn.textContent = 'Submitting...';
            submitBtn.disabled = true;
        }
        
        try {
            const ratingData = {
                type: this.ratingType,
                stars: this.selectedStars,
                review: this.reviewText,
                productId: this.currentProductData?.product_id
            };
            
            await this.submitRatingToServer(ratingData);
            
            // Show success but don't auto-close - let user decide
            this.showSubmissionSuccess();
            // Note: Removed auto-close timeout - user controls when to continue
            
        } catch (error) {
            console.error('Error submitting rating:', error);
            if (submitBtn) {
                submitBtn.textContent = 'Submit & Claim Bonus';
                submitBtn.disabled = false;
            }
            this.showError('Failed to submit rating. Please try again.');
        }
    }
    
    /**
     * Validate rating data before submission
     */
    validateRating() {
        if (this.ratingType === 'manual') {
            if (this.selectedStars === 0) {
                this.showError('Please select a star rating.');
                return false;
            }
            if (!this.reviewText.trim()) {
                this.showError('Please write a review.');
                return false;
            }
        } else if (this.ratingType === 'ai') {
            if (!this.reviewText.trim()) {
                this.showError('Please generate an AI review first.');
                return false;
            }
        }
        return true;
    }
    
    /**
     * Submit rating to server and add compensation
     */
    async submitRatingToServer(ratingData) {
        const userTier = this.getUserTier();
        const compensation = this.calculateCompensation(ratingData.type, userTier);
        
        // Get auth token (using existing system)
        const token = localStorage.getItem('auth_token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        // Add compensation to current drive session
        const response = await fetch(`${window.API_BASE_URL || ''}/api/drive/add-commission`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: compensation,
                reason: `Product rating bonus - ${ratingData.type}`,
                product_id: ratingData.productId,
                rating_data: {
                    stars: ratingData.stars,
                    review: ratingData.review,
                    type: ratingData.type
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'Failed to add commission');
        }
        
        // Update UI commission display if function exists
        if (typeof window.updateCommissionDisplay === 'function') {
            window.updateCommissionDisplay(compensation);
        }
        
        return result;
    }
    
    /**
     * Skip rating and continue
     */
    skipRating() {
        this.close();
        if (this.onContinueCallback) {
            this.onContinueCallback();
        }
    }
    
    /**
     * Get user tier (implement based on your user system)
     */
    getUserTier() {
        // TODO: Implement actual user tier detection
        // For now, return a default tier
        return 'Gold'; // Could be 'Bronze', 'Silver', or 'Gold'
    }
    
    /**
     * Calculate compensation based on type and tier
     */
    calculateCompensation(type, tier = null) {
        const userTier = tier || this.getUserTier();
        const ratingType = type === 'ai' ? 'ai' : 'manual';
        return this.compensationMatrix[userTier]?.[ratingType] || 0;
    }
    
    /**
     * Update compensation display
     */
    updateCompensationDisplay() {
        const compensationElement = document.getElementById('lux-compensation-amount');
        if (compensationElement) {
            const compensation = this.calculateCompensation(this.ratingType);
            compensationElement.textContent = `+$${compensation.toFixed(2)} USDT`;
        }
    }
    
    /**
     * Show submission success with detailed bonus information
     */
    showSubmissionSuccess() {
        const submitBtn = document.getElementById('lux-submit-rating');
        if (submitBtn) {
            submitBtn.textContent = '✓ Success!';
            submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        }
        
        // Create and show detailed success modal
        this.createSuccessModal();
    }
    
    /**
     * Create detailed success modal with compensation info
     */
    createSuccessModal() {
        const userTier = this.getUserTier();
        const compensation = this.compensationMatrix[userTier][this.ratingType];
        
        const successModalHTML = `
            <div class="lux-success-modal-overlay" id="lux-success-modal-overlay">
                <div class="lux-success-modal-content">
                    <div class="lux-success-header">
                        <div class="lux-success-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <h3>Rating Submitted Successfully!</h3>
                        <p>Thank you for your valuable feedback</p>
                    </div>
                    
                    <div class="lux-success-details">
                        <div class="lux-bonus-earned">
                            <span class="lux-bonus-label">Bonus Earned</span>
                            <span class="lux-bonus-amount">+$${compensation.toFixed(2)} USDT</span>
                        </div>
                        
                        <div class="lux-rating-summary">
                            <div class="lux-summary-item">
                                <span class="lux-summary-label">Rating Type:</span>
                                <span class="lux-summary-value">${this.ratingType === 'manual' ? 'Manual Review' : 'AI Generated'}</span>
                            </div>
                            <div class="lux-summary-item">
                                <span class="lux-summary-label">Your Tier:</span>
                                <span class="lux-summary-value">${userTier}</span>
                            </div>
                            <div class="lux-summary-item">
                                <span class="lux-summary-label">Stars Given:</span>
                                <span class="lux-summary-value">${'★'.repeat(this.selectedStars)}</span>
                            </div>
                        </div>
                        
                        <div class="lux-next-steps">
                            <h4>What's Next?</h4>
                            <ul>
                                <li>Your bonus has been added to your account</li>
                                <li>Click "Continue Driving" when ready to proceed</li>
                                <li>Higher tiers earn bigger bonuses</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="lux-success-actions">
                        <button class="lux-continue-btn" id="lux-success-continue">
                            Continue Driving
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', successModalHTML);
        
        // Add event listeners
        const overlay = document.getElementById('lux-success-modal-overlay');
        const continueBtn = document.getElementById('lux-success-continue');
        
        // Show with animation
        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });
        
        // Handle continue button
        continueBtn?.addEventListener('click', () => {
            this.closeSuccessModal();
            // Execute the continue callback after success modal closes
            if (this.onContinueCallback) {
                this.onContinueCallback();
            }
            // Also close the main rating modal
            this.close();
        });
        
        // Close on overlay click
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeSuccessModal();
            }
        });
        
        // Note: Removed auto-close timeout - user controls when to continue
        // Users can click "Continue Driving" button or click outside to close
    }
    
    /**
     * Close success modal
     */
    closeSuccessModal() {
        const overlay = document.getElementById('lux-success-modal-overlay');
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
    }
    
    /**
     * Show error message
     */
    showError(message) {
        // You can implement a toast notification system here
        alert(message); // Temporary implementation
    }
    
    /**
     * Handle keyboard events
     */
    handleKeydown(e) {
        if (!this.isOpen) return;
        
        if (e.key === 'Escape') {
            this.close();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            this.submitRating();
        }
    }
    
    /**
     * Close the modal
     */
    close() {
        const overlay = document.getElementById('lux-rating-modal-overlay');
        if (overlay) {
            overlay.classList.remove('show');
            
            // Remove from DOM after animation
            setTimeout(() => {
                overlay.remove();
            }, 400);
        }
        
        // Cleanup
        document.removeEventListener('keydown', this.handleKeydown.bind(this));
        this.isOpen = false;
        this.currentProductData = null;
        this.onContinueCallback = null;
        this.selectedStars = 0;
        this.reviewText = '';
        this.ratingType = 'manual';
    }
    
    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Global function to show product rating modal
 * Uses unique name to avoid conflicts with existing functions
 */
function showLuxuryProductRatingModal(productData, onContinue) {
    if (!window.luxuryRatingModal) {
        window.luxuryRatingModal = new LuxuryProductRatingModal();
    }
    
    window.luxuryRatingModal.show(productData, onContinue);
}

/**
 * Initialize rating modal system
 */
function initLuxuryProductRatingModal() {
    // Check if we're on the task page
    if (!document.getElementById('show-product-modal-btn')) {
        return;
    }
    
    // Create global instance
    window.luxuryRatingModal = new LuxuryProductRatingModal();
    
    console.log('LuxuryProductRatingModal: Initialized successfully');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLuxuryProductRatingModal);
} else {
    initLuxuryProductRatingModal();
}

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LuxuryProductRatingModal, showLuxuryProductRatingModal };
}
