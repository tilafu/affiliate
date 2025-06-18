// Tier Management Frontend
// JavaScript for admin tier configuration management

class TierManagement {
    constructor() {
        this.apiBase = 'http://localhost:3001/api/admin/tier-management';
        this.currentTiers = [];
        this.isEditing = false;
        this.editingId = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadTierConfigurations();
        await this.loadTierStatistics();
    }

    setupEventListeners() {
        // Save tier configuration
        document.getElementById('saveTierBtn').addEventListener('click', () => {
            this.saveTierConfiguration();
        });

        // Cancel editing
        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            this.cancelEdit();
        });

        // New tier button
        document.getElementById('newTierBtn').addEventListener('click', () => {
            this.createNewTier();
        });

        // Refresh data
        document.getElementById('refreshTiersBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // Form validation
        this.setupFormValidation();
    }

    setupFormValidation() {
        const form = document.getElementById('tierConfigForm');
        const inputs = form.querySelectorAll('input, textarea');

        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.validateForm();
            });
        });
    }

    validateForm() {
        const tierName = document.getElementById('tierName').value.trim();
        const quantityLimit = document.getElementById('quantityLimit').value;
        const numSingleTasks = document.getElementById('numSingleTasks').value;
        const minPriceSingle = parseFloat(document.getElementById('minPriceSingle').value) || 0;
        const maxPriceSingle = parseFloat(document.getElementById('maxPriceSingle').value) || 0;

        const isValid = tierName && quantityLimit && numSingleTasks && 
                       minPriceSingle >= 0 && maxPriceSingle > 0 && 
                       minPriceSingle <= maxPriceSingle;

        document.getElementById('saveTierBtn').disabled = !isValid;

        // Show validation messages
        if (minPriceSingle > maxPriceSingle) {
            this.showValidationError('Min price cannot be greater than max price');
        } else {
            this.hideValidationError();
        }
    }

    showValidationError(message) {
        let errorDiv = document.getElementById('validationError');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'validationError';
            errorDiv.className = 'alert alert-danger mt-2';
            document.getElementById('tierConfigForm').appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    hideValidationError() {
        const errorDiv = document.getElementById('validationError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    async loadTierConfigurations() {
        try {
            const response = await this.makeAuthenticatedRequest('/configurations');
            
            if (response.success) {
                this.currentTiers = response.data;
                this.renderTierTable();
            } else {
                this.showError('Failed to load tier configurations');
            }
        } catch (error) {
            console.error('Error loading tier configurations:', error);
            this.showError('Network error loading tier configurations');
        }
    }

    async loadTierStatistics() {
        try {
            const response = await this.makeAuthenticatedRequest('/statistics');
            
            if (response.success) {
                this.renderTierStatistics(response.data);
            }
        } catch (error) {
            console.error('Error loading tier statistics:', error);
        }
    }    renderTierTable() {
        const tbody = document.getElementById('tierConfigTableBody');
        if (!tbody) {
            console.error('tierConfigTableBody element not found');
            return;
        }
        tbody.innerHTML = '';

        this.currentTiers.forEach(tier => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <span class="badge bg-${this.getTierColor(tier.tier_name)}">${tier.tier_name}</span>
                </td>
                <td>${tier.quantity_limit}</td>
                <td>${tier.num_single_tasks || 0}</td>
                <td>${tier.num_combo_tasks || 0}</td>
                <td>$${tier.min_price_single || 0} - $${tier.max_price_single || 0}</td>
                <td>$${tier.min_price_combo || 0} - $${tier.max_price_combo || 0}</td>
                <td>${tier.commission_rate || 0}%</td>
                <td>
                    <span class="badge bg-${tier.is_active ? 'success' : 'secondary'}">
                        ${tier.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="tierManager.editTier(${tier.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="tierManager.deleteTier(${tier.id}, '${tier.tier_name}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    renderTierStatistics(stats) {
        const container = document.getElementById('tierStatsContainer');
        container.innerHTML = '';

        stats.forEach(stat => {
            const card = document.createElement('div');
            card.className = 'col-md-3 mb-3';
            card.innerHTML = `
                <div class="card h-100">
                    <div class="card-body text-center">
                        <h5 class="card-title">
                            <span class="badge bg-${this.getTierColor(stat.tier_name)} mb-2">${stat.tier_name}</span>
                        </h5>
                        <div class="row">
                            <div class="col-12">
                                <h3 class="text-primary">${stat.user_count || 0}</h3>
                                <small class="text-muted">Total Users</small>
                            </div>
                        </div>
                        <hr>
                        <div class="row">
                            <div class="col-6">
                                <strong>${stat.new_users_30d || 0}</strong>
                                <small class="d-block text-muted">New (30d)</small>
                            </div>
                            <div class="col-6">
                                <strong>$${parseFloat(stat.avg_balance || 0).toFixed(2)}</strong>
                                <small class="d-block text-muted">Avg Balance</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    getTierColor(tierName) {
        const colors = {
            'bronze': 'warning',
            'silver': 'secondary',
            'gold': 'success',
            'platinum': 'primary'
        };
        return colors[tierName.toLowerCase()] || 'info';
    }

    editTier(id) {
        const tier = this.currentTiers.find(t => t.id === id);
        if (!tier) return;

        this.isEditing = true;
        this.editingId = id;

        // Populate form
        document.getElementById('tierName').value = tier.tier_name;
        document.getElementById('quantityLimit').value = tier.quantity_limit;
        document.getElementById('numSingleTasks').value = tier.num_single_tasks || 0;
        document.getElementById('numComboTasks').value = tier.num_combo_tasks || 0;
        document.getElementById('minPriceSingle').value = tier.min_price_single || 0;
        document.getElementById('maxPriceSingle').value = tier.max_price_single || 0;
        document.getElementById('minPriceCombo').value = tier.min_price_combo || 0;
        document.getElementById('maxPriceCombo').value = tier.max_price_combo || 0;
        document.getElementById('commissionRate').value = tier.commission_rate || 0;
        document.getElementById('tierDescription').value = tier.description || '';
        document.getElementById('isActive').checked = tier.is_active;

        // Update UI
        document.getElementById('tierFormTitle').textContent = `Edit Tier: ${tier.tier_name}`;
        document.getElementById('saveTierBtn').textContent = 'Update Tier';
        document.getElementById('cancelEditBtn').style.display = 'inline-block';

        // Scroll to form
        document.getElementById('tierManagementForm').scrollIntoView({ behavior: 'smooth' });
    }

    createNewTier() {
        this.isEditing = false;
        this.editingId = null;

        // Clear form
        document.getElementById('tierConfigForm').reset();

        // Update UI
        document.getElementById('tierFormTitle').textContent = 'Create New Tier';
        document.getElementById('saveTierBtn').textContent = 'Create Tier';
        document.getElementById('cancelEditBtn').style.display = 'none';

        // Scroll to form
        document.getElementById('tierManagementForm').scrollIntoView({ behavior: 'smooth' });
    }

    cancelEdit() {
        this.isEditing = false;
        this.editingId = null;

        // Clear form
        document.getElementById('tierConfigForm').reset();

        // Update UI
        document.getElementById('tierFormTitle').textContent = 'Tier Configuration';
        document.getElementById('saveTierBtn').textContent = 'Create Tier';
        document.getElementById('cancelEditBtn').style.display = 'none';

        this.hideValidationError();
    }

    async saveTierConfiguration() {
        const formData = this.getFormData();
        
        try {
            let response;
            if (this.isEditing) {
                response = await this.makeAuthenticatedRequest(`/configurations/${this.editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
            } else {
                response = await this.makeAuthenticatedRequest('/configurations', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
            }

            if (response.success) {
                this.showSuccess(response.message);
                this.cancelEdit();
                await this.refreshData();
            } else {
                this.showError(response.message);
            }
        } catch (error) {
            console.error('Error saving tier configuration:', error);
            this.showError('Failed to save tier configuration');
        }
    }

    async deleteTier(id, tierName) {
        if (!confirm(`Are you sure you want to delete the ${tierName} tier? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await this.makeAuthenticatedRequest(`/configurations/${id}`, {
                method: 'DELETE'
            });

            if (response.success) {
                this.showSuccess(response.message);
                await this.refreshData();
            } else {
                this.showError(response.message);
            }
        } catch (error) {
            console.error('Error deleting tier:', error);
            this.showError('Failed to delete tier configuration');
        }
    }

    getFormData() {
        return {
            tier_name: document.getElementById('tierName').value.trim(),
            quantity_limit: parseInt(document.getElementById('quantityLimit').value),
            num_single_tasks: parseInt(document.getElementById('numSingleTasks').value) || 0,
            num_combo_tasks: parseInt(document.getElementById('numComboTasks').value) || 0,
            min_price_single: parseFloat(document.getElementById('minPriceSingle').value) || 0,
            max_price_single: parseFloat(document.getElementById('maxPriceSingle').value) || 0,
            min_price_combo: parseFloat(document.getElementById('minPriceCombo').value) || 0,
            max_price_combo: parseFloat(document.getElementById('maxPriceCombo').value) || 0,
            commission_rate: parseFloat(document.getElementById('commissionRate').value) || 0,
            description: document.getElementById('tierDescription').value.trim(),
            is_active: document.getElementById('isActive').checked
        };
    }

    async refreshData() {
        await Promise.all([
            this.loadTierConfigurations(),
            this.loadTierStatistics()
        ]);
    }

    async makeAuthenticatedRequest(endpoint, options = {}) {
        const token = localStorage.getItem('admin_auth_token') || localStorage.getItem('auth_token');
        
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const finalOptions = { ...defaultOptions, ...options };

        const response = await fetch(`${this.apiBase}${endpoint}`, finalOptions);
        return response.json();
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            alert(message);
        }
    }
}

// Initialize when DOM is loaded
let tierManager;
document.addEventListener('DOMContentLoaded', function() {
    tierManager = new TierManagement();
    // Make it globally accessible
    window.tierManagement = tierManager;
});
