/**
 * Task Management JavaScript - Redesigned
 * This file handles all functionality for the task center page including
 * task progress tracking, product displays, modal functionality, and animations.
 */

// Globals for task management
let selectedAction = 'buy'; // Default action

// Product Modal Functions
function openProductModal() {
    const modal = document.getElementById('product-modal');
    const productImage = document.getElementById('product-image');
    const productName = document.getElementById('product-name');
    const productPrice = document.getElementById('product-price');
    const productCommission = document.getElementById('product-commission');
    
    // Copy data to modal
    document.getElementById('modal-product-image').src = productImage.src;
    document.getElementById('modal-product-name').textContent = productName.textContent;
    document.getElementById('modal-product-price').textContent = productPrice.textContent;
    document.getElementById('modal-product-commission').textContent = productCommission.textContent;
    
    // Set current date and time
    const now = new Date();
    document.getElementById('product-date').textContent = now.toLocaleDateString('en-GB');
    document.getElementById('product-time').textContent = Date.now().toString();
    
    // Calculate total return based on selected action
    updateTotalReturn();
    
    // Show modal
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Initialize action buttons
    initializeActionButtons();
    
    // Set up modal purchase button
    const modalPurchaseBtn = document.getElementById('modal-purchase-button');
    const originalPurchaseBtn = document.getElementById('purchase-button');
    
    modalPurchaseBtn.onclick = function() {
        // Apply coupon if entered
        const couponCode = document.getElementById('coupon-code').value.trim();
        if (couponCode) {
            applyCoupon(couponCode);
        }
        
        // Trigger the original purchase logic with selected action
        console.log('Purchase initiated with action:', selectedAction);
        if (originalPurchaseBtn.onclick) {
            originalPurchaseBtn.onclick();
        } else if (originalPurchaseBtn.click) {
            originalPurchaseBtn.click();
        }
        closeProductModal();
    };
}

function initializeActionButtons() {
    const actionButtons = document.querySelectorAll('.action-btn');
    
    actionButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            actionButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update selected action
            selectedAction = this.getAttribute('data-action');
            
            // Update total return based on selected action
            updateTotalReturn();
        });
    });
}

function updateTotalReturn() {
    const commissionText = document.getElementById('modal-product-commission').textContent;
    const commission = parseFloat(commissionText.replace(/[^0-9.]/g, '')) || 0;
    
    let totalReturn = commission;
    
    // Adjust return based on selected action
    switch (selectedAction) {
        case 'buy':
            totalReturn = commission;
            break;
        case 'cashback':
            totalReturn = commission * 1.1; // 10% bonus for cashback
            break;
        case 'gift':
            totalReturn = commission * 0.9; // 10% less for gift
            break;
        case 'reference':
            totalReturn = commission * 1.05; // 5% bonus for reference
            break;
    }
    
    document.getElementById('total-return-value').textContent = '$' + totalReturn.toFixed(2);
}

function applyCoupon(couponCode) {
    // Mock coupon validation
    const validCoupons = {
        'SAVE10': 0.1,
        'WELCOME': 0.05,
        'BONUS20': 0.2
    };
    
    const discount = validCoupons[couponCode.toUpperCase()];
    
    if (discount) {
        const currentReturn = parseFloat(document.getElementById('total-return-value').textContent.replace('$', ''));
        const newReturn = currentReturn * (1 + discount);
        document.getElementById('total-return-value').textContent = '$' + newReturn.toFixed(2);
        
        // Show success feedback
        const couponInput = document.getElementById('coupon-code');
        couponInput.style.borderColor = '#10b981';
        couponInput.style.background = '#ecfdf5';
        
        // Add checkmark to apply button
        const applyBtn = document.querySelector('.coupon-apply-btn');
        applyBtn.innerHTML = '<i class="fas fa-check"></i>';
        applyBtn.style.background = '#10b981';
        
        setTimeout(() => {
            couponInput.style.borderColor = '';
            couponInput.style.background = '';
            applyBtn.innerHTML = '<i class="fas fa-check"></i>';
            applyBtn.style.background = '';
        }, 3000);
    } else {
        // Show error feedback
        const couponInput = document.getElementById('coupon-code');
        couponInput.style.borderColor = '#ef4444';
        couponInput.style.background = '#fef2f2';
        
        setTimeout(() => {
            couponInput.style.borderColor = '';
            couponInput.style.background = '';
        }, 3000);
    }
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Reset form
    document.getElementById('coupon-code').value = '';
    selectedAction = 'buy';
    
    // Reset action buttons
    const actionButtons = document.querySelectorAll('.action-btn');
    actionButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-action="buy"]')?.classList.add('active');
}

// Image gallery functionality
function initializeImageGallery() {
    const dots = document.querySelectorAll('.dot');
    const mainImage = document.getElementById('modal-product-image');
    
    dots.forEach((dot, index) => {
        dot.addEventListener('click', function() {
            // Remove active class from all dots
            dots.forEach(d => d.classList.remove('active'));
            
            // Add active class to clicked dot
            this.classList.add('active');
            
            // Here you would typically change the image source
            // For now, we'll just add a subtle animation
            mainImage.style.transform = 'scale(0.95)';
            setTimeout(() => {
                mainImage.style.transform = 'scale(1)';
            }, 150);
        });
    });
}

// Purchase Success Popup Functions
function showPurchaseSuccessPopup(productName, onContinue) {
    const popup = document.getElementById('purchase-success-popup');
    const messageEl = document.getElementById('purchase-popup-message');
    const continueBtn = document.getElementById('purchase-continue-btn');
    const closeBtn = document.getElementById('purchase-popup-close');
    
    // Set the message
    messageEl.textContent = `${productName} successfully driven.`;
    
    // Show the popup
    popup.style.display = 'flex';
    setTimeout(() => {
        popup.classList.add('show');
    }, 10);
    
    // Handle continue button
    const handleContinue = () => {
        hidePurchaseSuccessPopup();
        if (typeof onContinue === 'function') {
            onContinue();
        }
    };
    
    // Handle close button
    const handleClose = () => {
        hidePurchaseSuccessPopup();
    };
    
    // Remove existing event listeners
    continueBtn.replaceWith(continueBtn.cloneNode(true));
    closeBtn.replaceWith(closeBtn.cloneNode(true));
    
    // Add new event listeners
    document.getElementById('purchase-continue-btn').addEventListener('click', handleContinue);
    document.getElementById('purchase-popup-close').addEventListener('click', handleClose);
    
    // Close on overlay click
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            handleClose();
        }
    });
    
    // Close on escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            handleClose();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

function hidePurchaseSuccessPopup() {
    const popup = document.getElementById('purchase-success-popup');
    popup.classList.remove('show');
    setTimeout(() => {
        popup.style.display = 'none';
    }, 300);
}

// Helper functions for UI enhancement
function showLoadingSkeleton(element) {
    element.classList.add('loading-skeleton');
    element.textContent = 'Loading...';
}

function hideLoadingSkeleton(element, content) {
    element.classList.remove('loading-skeleton');
    element.textContent = content;
}

function animateProgressBar(element, targetWidth, duration = 1000) {
    const startWidth = parseFloat(element.style.width) || 0;
    const difference = targetWidth - startWidth;
    const startTime = performance.now();

    function updateProgress(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easing function for smooth animation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentWidth = startWidth + (difference * easeOutCubic);
        
        element.style.width = currentWidth + '%';
        
        if (progress < 1) {
            requestAnimationFrame(updateProgress);
        }
    }
    
    requestAnimationFrame(updateProgress);
}

function showNotificationWithAutoHide(message, type = 'info', duration = 5000) {
    // Assuming showNotification function exists
    if (typeof showNotification === 'function') {
        showNotification(message, type);
        
        // Auto-hide after duration
        setTimeout(() => {
            const notifications = document.querySelectorAll('.notification, .alert');
            notifications.forEach(notification => {
                notification.style.opacity = '0';
                setTimeout(() => {
                    notification.remove();
                }, 300);
            });
        }, duration);
    }
}

function updateConnectionStatus() {
    const indicator = document.createElement('div');
    indicator.id = 'connection-status';
    
    function updateStatus() {
        if (navigator.onLine) {
            indicator.textContent = '🟢 Online';
            indicator.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            indicator.style.color = 'white';
        } else {
            indicator.textContent = '🔴 Offline';
            indicator.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            indicator.style.color = 'white';
        }
    }
    
    updateStatus();
    document.body.appendChild(indicator);
    
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    
    // Auto-hide after 3 seconds if online
    setTimeout(() => {
        if (navigator.onLine) {
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 300);
        }
    }, 3000);
}

// Performance optimization
function optimizePerformance() {
    // Lazy load images
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
    
    // Preload critical resources
    const criticalResources = [
        './css/task-account-styles.css',
        './css/task.css',
        './js/task.js'
    ];
    
    criticalResources.forEach(resource => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = resource;
        link.as = resource.includes('.css') ? 'style' : 'script';
        document.head.appendChild(link);
    });
}

// DOM-Ready event handlers
document.addEventListener('DOMContentLoaded', function() {
    // Initialize animation observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
            }
        });
    });

    // Observe animated elements
    document.querySelectorAll('.animate-fade-in-up, .animate-slide-in-right, .animate-bounce-in').forEach((el) => {
        el.style.animationPlayState = 'paused';
        observer.observe(el);
    });

    // Connect modal open/close buttons to their functions
    const openModalBtn = document.getElementById('open-product-modal-btn');
    if (openModalBtn) {
        openModalBtn.addEventListener('click', openProductModal);
    }

    const closeModalBtn = document.getElementById('close-product-modal-btn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeProductModal);
    }

    const modalBackdrop = document.getElementById('product-modal-backdrop');
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', closeProductModal);
    }

    // Add ripple effect to buttons
    const buttons = document.querySelectorAll('.btn-modern');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            // Remove existing ripples
            const existingRipples = button.querySelectorAll('.ripple');
            existingRipples.forEach(ripple => ripple.remove());
            
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            button.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
    
    // Refresh button animation
    const refreshBtn = document.getElementById('refresh-drive-button');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            const icon = this.querySelector('i');
            icon.classList.add('rotate-on-hover');
            icon.style.animation = 'spin 1s linear';
            setTimeout(() => {
                icon.style.animation = '';
                icon.classList.remove('rotate-on-hover');
            }, 1000);
        });
    }

    // Add smooth scrolling to all links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add parallax effect to floating elements
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('.float');
        
        parallaxElements.forEach((element, index) => {
            const speed = 0.5 + (index * 0.1);
            const yPos = -(scrolled * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });
    });

    // Add keyboard navigation support
    document.addEventListener('keydown', function(e) {
        // ESC key functionality
        if (e.key === 'Escape') {
            // Close any open modals
            const modals = document.querySelectorAll('.product-modal.show');
            modals.forEach(modal => {
                if (typeof closeProductModal === 'function') {
                    closeProductModal();
                }
            });
        }
        
        // Enter key on buttons
        if (e.key === 'Enter' && e.target.classList.contains('btn-modern')) {
            e.target.click();
        }
    });

    // Enhance form validation with real-time feedback
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const inputs = form.querySelectorAll('input, select, textarea');
            let isValid = true;
            
            inputs.forEach(input => {
                if (input.hasAttribute('required') && !input.value.trim()) {
                    input.classList.add('is-invalid');
                    isValid = false;
                } else {
                    input.classList.remove('is-invalid');
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                showNotificationWithAutoHide('Please fill in all required fields', 'error');
            }
        });
    });

    // Initialize image gallery when modal opens
    const modal = document.getElementById('product-modal');
    if (modal) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (modal.classList.contains('show')) {
                        initializeImageGallery();
                    }
                }
            });
        });
        
        observer.observe(modal, { attributes: true });
    }
    
    // Purchase Success Popup Initialization
    const successPopup = document.getElementById('purchase-success-popup');
    const continueBtn = document.getElementById('purchase-continue-btn');
    const closePopupBtn = document.getElementById('purchase-popup-close');
    
    if (successPopup && continueBtn && closePopupBtn) {
        // Set up event listeners
        closePopupBtn.addEventListener('click', hidePurchaseSuccessPopup);
        continueBtn.addEventListener('click', function() {
            hidePurchaseSuccessPopup();
            // Any continuation logic can go here
        });
        
        // Close on background click
        successPopup.addEventListener('click', function(e) {
            if (e.target === successPopup) {
                hidePurchaseSuccessPopup();
            }
        });
    }
    
    // Coupon apply button functionality
    const couponApplyBtn = document.querySelector('.coupon-apply-btn');
    if (couponApplyBtn) {
        couponApplyBtn.addEventListener('click', function() {
            const couponCode = document.getElementById('coupon-code').value.trim();
            if (couponCode) {
                applyCoupon(couponCode);
            }
        });
    }
    
    // Close modal when clicking outside or pressing Escape
    if (modal) {
        const backdrop = document.querySelector('.product-modal-backdrop');
        
        // Close modal when clicking backdrop
        if (backdrop) {
            backdrop.addEventListener('click', closeProductModal);
        }
        
        // Close modal with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('show')) {
                closeProductModal();
            }
        });
    }
    
    // Initialize performance optimizations
    optimizePerformance();
    
    // Initialize connection status
    updateConnectionStatus();
    
    // Try to load standard navigation components
    try {
        if (typeof loadStandardNavigation === 'function') {
            loadStandardNavigation().then(() => {
                console.log('Standard navigation components loaded for task page');
            }).catch((error) => {
                console.error('Error loading navigation components:', error);
            });
        }
    } catch (error) {
        console.error('Error initializing navigation:', error);
    }
});
