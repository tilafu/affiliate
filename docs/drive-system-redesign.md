# Drive System Redesign Plan

## 1. CLEAN ARCHITECTURE STRUCTURE

### Frontend Modules (Modular Design)
```
/js/drive/
├── core/
│   ├── DriveStateManager.js      // Centralized state management
│   ├── DriveAPI.js               // Unified API client
│   └── DriveEventBus.js          // Event-driven communication
├── components/
│   ├── ProductRenderer.js        // Product display logic
│   ├── ProgressTracker.js        // Progress bar & statistics
│   ├── BalanceManager.js         // Balance & frozen state handling
│   └── PurchaseFlow.js           // Purchase workflow
├── services/
│   ├── SessionService.js         // Session persistence & recovery
│   ├── AnalyticsService.js       // Usage tracking
│   └── ErrorHandler.js           // Centralized error handling
└── main/
    ├── TaskPageController.js     // Main page controller
    └── AdminDriveController.js   // Admin interface controller
```

### Backend Modules (Service Layer)
```
/server/services/
├── DriveService.js               // Core drive logic
├── UserBalanceService.js         // Balance & frozen state
├── ProductSelectionService.js    // Product selection algorithms
├── ProgressTrackingService.js    // Progress calculations
└── SessionRecoveryService.js     // Session restoration
```

## 2. STATE MANAGEMENT REDESIGN

### Centralized State Object
```javascript
const DriveState = {
  session: {
    id: null,
    status: 'inactive', // 'inactive', 'active', 'frozen', 'completed'
    configurationId: null,
    startedAt: null,
    currentItemId: null
  },
  progress: {
    completed: 0,
    total: 0,
    percentage: 0,
    originalTasksOnly: { completed: 0, total: 0 }
  },
  currentProduct: {
    id: null,
    data: null,
    isCombo: false,
    slotInItem: 0,
    totalSlotsInItem: 0
  },
  balance: {
    main: 0,
    frozen: 0,
    isFrozen: false,
    amountNeeded: 0
  },
  commission: {
    currentDrive: 0,
    lifetime: 0
  }
};
```

## 3. API UNIFICATION

### Single Drive API Endpoint Structure
```
/api/drive/
├── session/
│   ├── GET /status          // Get current session status
│   ├── POST /start          // Start new session
│   ├── POST /resume         // Resume existing session
│   └── POST /end            // End session
├── product/
│   ├── GET /current         // Get current product
│   ├── POST /purchase       // Purchase product
│   └── POST /refund         // Process refund
├── progress/
│   ├── GET /summary         // Get progress summary
│   └── GET /detailed        // Get detailed progress
└── balance/
    ├── GET /status          // Get balance & frozen status
    └── POST /unfreeze       // Attempt auto-unfreeze
```

## 4. SESSION RECOVERY IMPROVEMENTS

### Enhanced Session Data Structure
```javascript
const SessionData = {
  version: '2.0',
  timestamp: Date.now(),
  sessionId: 'uuid',
  userId: 123,
  drive: {
    configurationId: 1,
    status: 'active',
    progress: { /* progress object */ },
    currentProduct: { /* product object */ }
  },
  balance: {
    main: 1250.50,
    frozen: 0,
    lastUpdated: Date.now()
  },
  ui: {
    lastPage: 'task.html',
    modalState: null,
    scrollPosition: 0
  },
  integrity: {
    checksum: 'hash',
    serverSync: true,
    lastSyncTime: Date.now()
  }
};
```

### Recovery Strategies
1. **Immediate Recovery**: Restore UI state instantly
2. **Background Sync**: Verify with server in background
3. **Conflict Resolution**: Handle server/client differences
4. **Fallback Strategy**: Graceful degradation if recovery fails

## 5. BALANCE & FROZEN STATE SEPARATION

### Balance Types Definition
```javascript
const BalanceTypes = {
  MAIN: {
    key: 'main_balance',
    description: 'Available for purchases',
    color: '#10b981', // green
    status: 'active'
  },
  FROZEN: {
    key: 'frozen_balance',
    description: 'Temporarily unavailable',
    color: '#dc3545', // red
    status: 'frozen'
  }
};

const UserStates = {
  ACTIVE: 'active',
  FROZEN: 'frozen',
  SUSPENDED: 'suspended'
};
```

### Frozen State Logic
1. **Trigger**: Insufficient balance during purchase
2. **Amount Needed**: Calculated based on remaining drive cost
3. **Auto-Unfreeze**: When balance >= amount needed
4. **Manual Unfreeze**: Admin intervention
5. **UI Indication**: Clear visual distinction

## 6. PRODUCT RENDERING & PURCHASE FLOW

### Component-Based Product Rendering
```javascript
class ProductRenderer {
  constructor(container) {
    this.container = container;
    this.template = new ProductTemplate();
    this.animations = new ProductAnimations();
  }

  async render(productData, options = {}) {
    const html = this.template.generate(productData, options);
    await this.animations.fadeOut(this.container);
    this.container.innerHTML = html;
    await this.animations.fadeIn(this.container);
    this.attachEventListeners();
  }

  attachEventListeners() {
    // Purchase button, product interaction, etc.
  }
}
```

### Streamlined Purchase Flow
```javascript
class PurchaseFlow {
  async executePurchase(productData) {
    try {
      // 1. Pre-purchase validation
      await this.validatePurchase(productData);
      
      // 2. UI feedback
      this.updateUI('processing');
      
      // 3. API call
      const result = await DriveAPI.purchaseProduct(productData);
      
      // 4. Handle response
      await this.handlePurchaseResult(result);
      
      // 5. Update state
      DriveStateManager.updateAfterPurchase(result);
      
    } catch (error) {
      await this.handlePurchaseError(error);
    }
  }
}
```

## 7. DATABASE OPTIMIZATIONS

### Proposed New Indexes
```sql
-- Improve drive session queries
CREATE INDEX idx_drive_sessions_user_status ON drive_sessions(user_id, status);
CREATE INDEX idx_drive_sessions_active ON drive_sessions(user_id) WHERE status = 'active';

-- Optimize progress calculations
CREATE INDEX idx_user_active_drive_items_progress ON user_active_drive_items(drive_session_id, user_status, order_in_drive);

-- Balance queries
CREATE INDEX idx_accounts_user_type ON accounts(user_id, type);
```

### Data Integrity Constraints
```sql
-- Ensure only one active session per user
CREATE UNIQUE INDEX idx_one_active_session_per_user 
ON drive_sessions(user_id) 
WHERE status IN ('active', 'frozen');

-- Validate current item reference
ALTER TABLE drive_sessions 
ADD CONSTRAINT chk_current_item_belongs_to_session 
CHECK (
  current_user_active_drive_item_id IS NULL OR 
  EXISTS (
    SELECT 1 FROM user_active_drive_items 
    WHERE id = current_user_active_drive_item_id 
    AND drive_session_id = drive_sessions.id
  )
);
```

## 8. IMPLEMENTATION PLAN

### Phase 1: Core Cleanup (Week 1)
1. Create new modular structure
2. Implement DriveStateManager
3. Unify API endpoints
4. Basic session recovery

### Phase 2: UI Enhancement (Week 2)
1. Component-based product rendering
2. Enhanced progress tracking
3. Improved balance display
4. Better error handling

### Phase 3: Advanced Features (Week 3)
1. Robust session recovery
2. Analytics integration
3. Performance optimizations
4. Admin interface improvements

### Phase 4: Testing & Deployment (Week 4)
1. Comprehensive testing
2. Migration strategy
3. Rollback plan
4. Documentation

## 9. MIGRATION STRATEGY

### Backward Compatibility
- Keep existing APIs during transition
- Gradual feature migration
- Feature flags for new functionality
- Monitoring and rollback capabilities

### Data Migration
- No breaking database changes
- Populate new fields gradually
- Validate data integrity
- Performance monitoring


Other notes, last chat broke but here's the progress we made:

user_active_drive_items overview:


Stats target | Description

--------------------------------+-----------------------------+-----------+----------+-----------------------------------------------------+----------+-------------+--------------+------------------------------------------------------------------------------------------------
id | integer | | not null | nextval('user_active_drive_items_id_seq'::regclass) | plain | |
|
user_id | integer | | not null | | plain | |
| ID of the user this drive item belongs to
drive_session_id | integer | | not null | | plain | |
| FK to drive_sessions.id, identifying the user's specific drive session.
product_id_1 | integer | | not null | | plain | |
| Primary product for this drive step
product_id_2 | integer | |
| | plain | |
| Optional second product for a combo
product_id_3 | integer | |
| | plain | |
| Optional third product for a combo
order_in_drive | integer | | not null | | plain | |
| The sequence number of this item in the user"s active drive
user_status | character varying(10) | | not null | 'PENDING'::character varying | extended | |
| Status of this specific item for the user (e.g., PENDING, CURRENT, COMPLETED, SKIPPED, FAILED)
task_type | character varying(50) | |
| 'order'::character varying | extended | |
| Type of task, e.g., "order", "survey"
created_at | timestamp without time zone | |
| CURRENT_TIMESTAMP | plain | |
|
updated_at | timestamp without time zone | |
| CURRENT_TIMESTAMP | plain | |
|
current_product_slot_processed | integer | | not null | 0 | plain | |
|
drive_task_set_id_override | integer | |
| | plain | |
|
Indexes:
"user_active_drive_items_pkey" PRIMARY KEY, btree (id)
"idx_drive_session_id" btree (drive_session_id)
"idx_user_drive_session_order" btree (user_id, drive_session_id, order_in_drive)
Check constraints:
"chk_user_status" CHECK (user_status::text = ANY (ARRAY['PENDING'::character varying, 'CURRENT'::character varying, 'COMPLETED'::character varying, 'SKIPPED'::character varying, 'FAILED'::character varying]::text[]))
Foreign-key constraints:
"fk_drive_task_set_id_override" FOREIGN KEY (drive_task_set_id_override) REFERENCES drive_task_sets(id) ON DELETE SET NULL
"user_active_drive_items_drive_session_id_fkey" FOREIGN KEY (drive_session_id)
REFERENCES drive_sessions(id) ON DELETE CASCADE
"user_active_drive_items_product_id_1_fkey" FOREIGN KEY (product_id_1) REFERENCES products(id) ON DELETE RESTRICT
"user_active_drive_items_product_id_2_fkey" FOREIGN KEY (product_id_2) REFERENCES products(id) ON DELETE RESTRICT
"user_active_drive_items_product_id_3_fkey" FOREIGN KEY (product_id_3) REFERENCES products(id) ON DELETE RESTRICT
"user_active_drive_items_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(i
d) ON DELETE CASCADE
Referenced by:
TABLE "drive_sessions" CONSTRAINT "fk_current_user_active_drive_item" FOREIGN KEY (current_user_active_drive_item_id) REFERENCES user_active_drive_items(id) ON DELETE SET NULL

drive_sessions db overview:

              Column               |            Type             | Collation | Nullable |                  Default                   | Storage  | Compression | Stats 
target |                                                          Description      

-----------------------------------+-----------------------------+-----------+----------+--------------------------------------------+----------+-------------+--------------+--------------------------------------------------------------------------------------------------------------------------------
 id                                | integer                     |           | not 
null | nextval('drive_sessions_id_seq'::regclass) | plain    |             |       
       |
 user_id                           | integer                     |           | not 
null |                                            | plain    |             |       
       |
 product_combo_id                  | integer                     |           |     
     |                                            | plain    |             |       
       |
 start_time                        | timestamp without time zone |           |     
     | CURRENT_TIMESTAMP                          | plain    |             |       
       |
 end_time                          | timestamp without time zone |           |     
     |                                            | plain    |             |       
       |
 status                            | character varying(500)      |           |     
     | 'active'::character varying                | extended |             |       
       |
 created_at                        | timestamp without time zone |           |     
     | CURRENT_TIMESTAMP                          | plain    |             |       
       |
 drive_type                        | character varying(50)       |           |     
     | 'first'::character varying                 | extended |             |       
       |
 tasks_completed                   | integer                     |           |     
     | 0                                          | plain    |             |       
       | Number of Task Sets already completed in this drive session.
 tasks_required                    | integer                     |           |     
     |                                            | plain    |             |       
       | Total number of Task Sets required to complete this drive session.       
 started_at                        | timestamp with time zone    |           |     
     | now()                                      | plain    |             |       
       |
 completed_at                      | timestamp with time zone    |           |     
     |                                            | plain    |             |       
       |
 session_uuid                      | uuid                        |           |     
     |                                            | plain    |             |       
       |
 frozen_amount_needed              | numeric                     |           |     
     |                                            | main     |             |       
       |
 last_product_id                   | integer                     |           |     
     |                                            | plain    |             |       
       |
 last_combo_id                     | character varying(100)      |           |     
     |                                            | extended |             |       
       |
 combo_progress                    | jsonb                       |           |     
     |                                            | extended |             |       
       |
 starting_balance                  | numeric(12,2)               |           |     
     |                                            | main     |             |       
       |
 commission_earned                 | numeric(12,2)               |           |     
     | 0                                          | main     |             |       
       |
 drive_tasks                       | jsonb                       |           |     
     |                                            | extended |             |       
       |
 drive_configuration_id            | integer                     |           |     
     |                                            | plain    |             |       
       |
 current_task_set_id               | integer                     |           |     
     |                                            | plain    |             |       
       | The ID of the Task Set the user is currently working on.
 current_task_set_product_id       | integer                     |           |     
     |                                            | plain    |             |       
       | The ID of the specific product (from drive_task_set_products) the user is 
currently working on within the current_task_set_id.
 current_user_active_drive_item_id | integer                     |           |     
     |                                            | plain    |             |       
       | FK to user_active_drive_items.id, indicating the current step in the active drive
 notes                             | text                        |           |     
     |                                            | extended |             |       
       | Additional notes about the drive session
 ended_at                          | timestamp without time zone |           |     
     |                                            | plain    |             |       
       | Timestamp when the drive session was ended
Indexes:
    "drive_sessions_pkey" PRIMARY KEY, btree (id)
    "drive_sessions_session_uuid_key" UNIQUE CONSTRAINT, btree (session_uuid)     
    "idx_drive_sessions_drive_configuration_id" btree (drive_configuration_id)
Check constraints:
    "drive_sessions_status_check" CHECK (status::text = ANY (ARRAY['active'::character varying::text, 'completed'::character varying::text, 'frozen'::character varying::text, 'pending_reset'::character varying::text]))
Foreign-key constraints:
    "drive_sessions_current_task_set_id_fkey" FOREIGN KEY (current_task_set_id) REFERENCES drive_task_sets(id) ON DELETE SET NULL
    "drive_sessions_current_task_set_product_id_fkey" FOREIGN KEY (current_task_set_product_id) REFERENCES drive_task_set_products(id) ON DELETE SET NULL
    "drive_sessions_drive_configuration_id_fkey" FOREIGN KEY (drive_configuration_id) REFERENCES drive_configurations(id) ON DELETE SET NULL
    "drive_sessions_product_combo_id_fkey" FOREIGN KEY (product_combo_id) REFERENCES product_combos(id) ON DELETE SET NULL
    "drive_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id)      
    "fk_current_user_active_drive_item" FOREIGN KEY (current_user_active_drive_item_id) REFERENCES user_active_drive_items(id) ON DELETE SET NULL
Referenced by:
    TABLE "old_drive_orders" CONSTRAINT "drive_orders_session_id_fkey" FOREIGN KEY 
(session_id) REFERENCES drive_sessions(id)
    TABLE "drive_orders" CONSTRAINT "drive_orders_session_id_fkey1" FOREIGN KEY (session_id) REFERENCES drive_sessions(id) ON DELETE CASCADE


My last request:
How would you redesign this page for pc to look minimalistic yet luxurious and classy, the mobile version will get inspiration from this too but should also look classy. ignore the top part of the page, the header section public/assets/uploads/images/Drive/2 (2).jpg

The search button is our new entry point to the drive sessions and the trending products will be random images from our products folder, C:\Users\user\Documents\affiliate-final\public\assets\uploads\images

public/assets/uploads/images/Drive/Product Listing (1).png
Similarly, how would you make a luxurious minimalistic product page for pc from this image idea, and an accompanying mobile 
When the modal is loading and before the next sections after clicking the purchase button, we'll have a gif as the load animation

After hitting the purchase button, the client will get another modal (is this the best way to do it) that will ask for the submitted product rating, and they can either manually fill a text field and provide a star-based rating or select a button with let AI generate the response. There isn't any output from this step, but there is financial compensation that will be added to the commission they receive. Its in this format. 
Tier	        Human Review	           AI Review
Bronze	             40¢	                     20¢
Silver	               70¢	                       30¢
Gold	              90¢	                      50¢



the pea traffic and efficiency index gauges can show random figures but they should always be in the last quarter, let them seem dynamic.

Create a plan to implement these changes

## 10. UI REDESIGN & ENHANCEMENT IMPLEMENTATION PLAN

### Phase 1: Luxury Minimalistic UI Redesign (Week 1)

#### 1.1 Main Dashboard (task.html) Redesign
**Objective**: Transform the current interface into a luxury minimalistic design

**Design Principles**:
- **Minimalistic Luxury**: Clean lines, premium typography, subtle gradients
- **Sophisticated Color Palette**: Deep blues (#1a365d), gold accents (#ffd700), premium grays
- **Micro-interactions**: Subtle hover effects, smooth transitions
- **Premium Materials**: Glass morphism, subtle shadows, elegant spacing

**Implementation Steps**:

```css
/* New CSS Variables for Luxury Theme */
:root {
  --luxury-primary: #1a365d;
  --luxury-gold: #ffd700;
  --luxury-platinum: #e5e7eb;
  --luxury-glass: rgba(255, 255, 255, 0.1);
  --luxury-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  --luxury-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

**Desktop Layout**:
1. **Header Redesign**: Sleek top bar with glassmorphism effect
2. **Hero Section**: Large, elegant search button with premium styling
3. **Stats Grid**: Card-based layout with subtle animations
4. **Trending Products**: Horizontal scrolling carousel with premium product cards
5. **Metrics Dashboard**: Integrated PEA gauges with dynamic animations

**Mobile Layout**:
1. **Responsive Grid**: Stack cards vertically with proper spacing
2. **Touch-friendly**: Larger tap targets, swipe gestures
3. **Progressive Enhancement**: Core functionality first, enhancements second

#### 1.2 Product Modal Redesign
**Transform existing Drive Product Modal into luxury experience**

**Desktop Product Modal**:
```html
<!-- Luxury Product Modal Structure -->
<div class="luxury-product-modal">
  <div class="modal-glass-backdrop">
    <div class="luxury-product-container">
      <div class="product-gallery">
        <!-- Premium image gallery with smooth transitions -->
      </div>
      <div class="product-details">
        <!-- Elegant typography and spacing -->
      </div>
      <div class="purchase-section">
        <!-- Premium CTA button with animations -->
      </div>
    </div>
  </div>
</div>
```

**Mobile Product Modal**:
- Full-screen overlay with smooth slide-up animation
- Touch-optimized image gallery
- Simplified, focused layout

### Phase 2: Product Rating System Implementation (Week 2)

#### 2.1 Post-Purchase Rating Modal
**After purchase confirmation, show rating collection modal**

**Modal Structure**:
```html
<div id="product-rating-modal" class="luxury-modal">
  <div class="modal-content">
    <div class="rating-header">
      <h3>Rate Your Experience</h3>
      <p>Help others and earn extra commission</p>
    </div>
    
    <div class="rating-tabs">
      <button class="tab-btn active" data-tab="manual">Manual Review</button>
      <button class="tab-btn" data-tab="ai">AI Generated</button>
    </div>
    
    <div class="rating-content">
      <!-- Manual Rating Tab -->
      <div id="manual-rating" class="tab-content active">
        <div class="star-rating">
          <!-- 5-star rating system -->
        </div>
        <textarea placeholder="Write your review..."></textarea>
      </div>
      
      <!-- AI Generated Tab -->
      <div id="ai-rating" class="tab-content">
        <button class="ai-generate-btn">Generate AI Review</button>
        <div class="ai-preview"></div>
      </div>
    </div>
    
    <div class="compensation-info">
      <div class="tier-display">
        <span class="user-tier">Gold Tier</span>
        <span class="compensation">+$0.90 USDT</span>
      </div>
    </div>
    
    <div class="modal-actions">
      <button class="submit-rating-btn">Submit & Claim Bonus</button>
      <button class="skip-rating-btn">Skip This Time</button>
    </div>
  </div>
</div>
```

#### 2.2 Backend Integration
**API Endpoints** (No new routes needed as per requirements):

**Modified Purchase Flow in `drive.js`**:
```javascript
// After successful purchase and refund
if (refundResponse.ok && refundData.success) {
    // Show rating modal instead of immediate success
    showProductRatingModal(productDataForPurchase, () => {
        // Continue with drive flow after rating submission
        if (data.next_action === 'drive_complete') {
            displayDriveComplete(data.message_to_user);
        } else {
            fetchNextOrder();
        }
    });
}
```

**Rating Modal JavaScript**:
```javascript
function showProductRatingModal(productData, onContinue) {
    const modal = createRatingModal(productData);
    document.body.appendChild(modal);
    
    // Handle manual rating submission
    modal.querySelector('.submit-rating-btn').addEventListener('click', async () => {
        const rating = getRatingData();
        await submitRating(rating, productData);
        modal.remove();
        onContinue();
    });
    
    // Handle AI generation
    modal.querySelector('.ai-generate-btn').addEventListener('click', async () => {
        const aiReview = await generateAIReview(productData);
        displayAIPreview(aiReview);
    });
}

async function submitRating(ratingData, productData) {
    // Calculate compensation based on user tier and rating type
    const compensation = calculateRatingCompensation(ratingData.type);
    
    // Add compensation directly to current drive session
    const response = await fetch(`${API_BASE_URL}/api/drive/add-commission`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount: compensation,
            reason: `Product rating bonus - ${ratingData.type}`,
            product_id: productData.product_id
        })
    });
    
    // Update UI with new commission
    updateCommissionDisplay(compensation);
}

function calculateRatingCompensation(ratingType) {
    const userTier = getUserTier(); // Bronze/Silver/Gold
    const compensationMatrix = {
        'Bronze': { manual: 0.40, ai: 0.20 },
        'Silver': { manual: 0.70, ai: 0.30 },
        'Gold': { manual: 0.90, ai: 0.50 }
    };
    
    return compensationMatrix[userTier][ratingType === 'ai' ? 'ai' : 'manual'];
}
```

### Phase 3: Dynamic Gauges Implementation (Week 2)

#### 3.1 PEA Traffic & Efficiency Index Gauges
**Client-side dynamic gauge generation**

**Gauge Implementation**:
```javascript
class DynamicGauge {
    constructor(containerId, title, range = [75, 95]) {
        this.container = document.getElementById(containerId);
        this.title = title;
        this.range = range;
        this.currentValue = this.generateRandomValue();
        this.init();
    }
    
    generateRandomValue() {
        // Always in last quarter (75-100%)
        const [min, max] = this.range;
        return Math.random() * (max - min) + min;
    }
    
    init() {
        this.render();
        // Update every 30 seconds with slight variations
        setInterval(() => this.updateValue(), 30000);
    }
    
    updateValue() {
        const variation = (Math.random() - 0.5) * 5; // ±2.5% variation
        this.currentValue = Math.max(75, Math.min(100, this.currentValue + variation));
        this.animateToValue(this.currentValue);
    }
    
    render() {
        this.container.innerHTML = `
            <div class="luxury-gauge">
                <svg class="gauge-svg" viewBox="0 0 200 120">
                    <path class="gauge-bg" d="M20,100 A80,80 0 0,1 180,100"></path>
                    <path class="gauge-fill" d="M20,100 A80,80 0 0,1 180,100"></path>
                    <circle class="gauge-center" cx="100" cy="100" r="8"></circle>
                    <line class="gauge-needle" x1="100" y1="100" x2="100" y2="30"></line>
                </svg>
                <div class="gauge-value">${Math.round(this.currentValue)}%</div>
                <div class="gauge-title">${this.title}</div>
            </div>
        `;
        this.animateToValue(this.currentValue);
    }
    
    animateToValue(value) {
        // Smooth animation to new value
        const needle = this.container.querySelector('.gauge-needle');
        const fill = this.container.querySelector('.gauge-fill');
        const display = this.container.querySelector('.gauge-value');
        
        // Calculate rotation angle (0-180 degrees for semicircle)
        const angle = (value / 100) * 180 - 90;
        
        needle.style.transform = `rotate(${angle}deg)`;
        fill.style.strokeDasharray = `${(value / 100) * 251.2} 251.2`;
        display.textContent = `${Math.round(value)}%`;
    }
}

// Initialize gauges when page loads
document.addEventListener('DOMContentLoaded', () => {
    new DynamicGauge('pea-traffic-gauge', 'PEA TRAFFIC', [78, 92]);
    new DynamicGauge('efficiency-gauge', 'Efficiency Index', [82, 96]);
});
```

### Phase 4: Enhanced User Experience (Week 3)

#### 4.1 Loading Animations
**Premium GIF animations for purchase flow**

**Implementation**:
```javascript
function showPurchaseLoadingAnimation() {
    const loadingModal = `
        <div class="luxury-loading-modal">
            <div class="loading-content">
                <img src="./assets/animations/purchase-loading.gif" alt="Processing">
                <h3>Processing Your Purchase</h3>
                <p>Please wait while we confirm your order...</p>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loadingModal);
}
```

#### 4.2 Trending Products Enhancement
**Dynamic product loading from existing images**

**Product Image Service**:
```javascript
class TrendingProductsService {
    constructor() {
        this.imageBasePath = './assets/uploads/images/';
        this.availableImages = this.generateImageList();
    }
    
    generateImageList() {
        // Generate list of available product images (1.jpg to 1489.jpg)
        const images = [];
        for (let i = 1; i <= 1489; i++) {
            images.push(`${i}.jpg`);
        }
        return images;
    }
    
    getRandomProducts(count = 6) {
        const shuffled = [...this.availableImages].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count).map((img, index) => ({
            id: index + 1,
            image: this.imageBasePath + img,
            name: this.generateProductName(),
            badge: Math.random() > 0.7 ? `#${Math.floor(Math.random() * 99) + 1}` : null
        }));
    }
    
    generateProductName() {
        const adjectives = ['Premium', 'Luxury', 'Elite', 'Professional', 'Advanced'];
        const nouns = ['Device', 'Gadget', 'Tool', 'Accessory', 'Product'];
        return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
    }
}

// Update trending products every 45 seconds
const trendingService = new TrendingProductsService();
setInterval(() => {
    updateTrendingProducts(trendingService.getRandomProducts());
}, 45000);
```

### Phase 5: Backend API Enhancements (Week 3)

#### 5.1 Commission Addition Endpoint
**Add to existing drive controller**:

```javascript
// In driveController.js
app.post('/api/drive/add-commission', async (req, res) => {
    try {
        const { amount, reason, product_id } = req.body;
        const userId = req.user.id;
        
        // Get active drive session
        const session = await db.query(
            'SELECT * FROM drive_sessions WHERE user_id = $1 AND status = $2',
            [userId, 'active']
        );
        
        if (session.rows.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No active drive session found' 
            });
        }
        
        // Add commission to current session
        await db.query(
            'UPDATE drive_sessions SET commission_earned = commission_earned + $1 WHERE id = $2',
            [amount, session.rows[0].id]
        );
        
        // Log the commission addition (optional)
        await db.query(
            'INSERT INTO commission_log (user_id, session_id, amount, reason, product_id, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
            [userId, session.rows[0].id, amount, reason, product_id]
        );
        
        res.json({
            success: true,
            message: 'Commission added successfully',
            amount: amount
        });
    } catch (error) {
        console.error('Error adding commission:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});
```

### Phase 6: File Structure Organization

#### 6.1 New CSS Files
```
public/css/
├── luxury-theme.css          // Main luxury theme variables and base styles
├── luxury-components.css     // Reusable luxury components (buttons, cards, modals)
├── product-rating-modal.css  // Product rating modal specific styles
├── dynamic-gauges.css        // Gauge animations and styling
└── luxury-responsive.css     // Mobile responsive overrides
```

#### 6.2 New JavaScript Modules
```
public/js/
├── luxury-ui/
│   ├── DynamicGauge.js       // Gauge component
│   ├── ProductRatingModal.js // Rating modal functionality
│   ├── TrendingProducts.js   // Dynamic product service
│   └── LuxuryAnimations.js   // Animation utilities
├── enhanced-drive.js         // Enhanced drive functionality
└── luxury-main.js            // Main luxury theme controller
```

### Phase 7: Testing & Quality Assurance (Week 4)

#### 7.1 Cross-Browser Testing
- Chrome, Firefox, Safari, Edge compatibility
- Mobile browser testing (iOS Safari, Chrome Mobile)

#### 7.2 Performance Optimization
- Image lazy loading for product carousel
- CSS/JS minification for production
- Animation performance optimization

#### 7.3 User Experience Testing
- Rating modal usability testing
- Gauge animation smoothness verification
- Mobile responsiveness validation

### Phase 8: Deployment Strategy

#### 8.1 Feature Flags
```javascript
const LUXURY_FEATURES = {
    PRODUCT_RATING: true,
    DYNAMIC_GAUGES: true,
    ENHANCED_UI: true,
    AI_REVIEWS: false // Future feature
};
```

#### 8.2 Gradual Rollout
1. **Internal Testing**: Admin accounts only
2. **Beta Testing**: Selected users
3. **Full Deployment**: All users

### Implementation Timeline Summary

**Week 1**: UI Redesign Foundation
- CSS luxury theme system
- Main dashboard redesign
- Product modal enhancement

**Week 2**: Core Features
- Product rating system
- Dynamic gauges
- Backend API integration

**Week 3**: Polish & Enhancement
- Loading animations
- Trending products service
- Performance optimization

**Week 4**: Testing & Deployment
- Quality assurance
- Cross-browser testing
- Production deployment

This implementation plan maintains the existing drive system architecture while adding the luxury UI redesign and product rating compensation system as requested.
