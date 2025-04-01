# Product Requirements Document: Affiliate Program System

Admin code: SETYJWFC
 
## Overview 
The Affiliate Program System is a platform that enables users to participate in a multi-level marketing structure through a referral system and data drive activities. Users earn commissions by completing "data drives" that involve interacting with various products, with earnings influenced by a tier system.

## User Roles
- **User**: A platform member who can participate in data drives and earn commissions
- **Admin**: Platform manager who can adjust balances, manage products, and control user tiers
- **System**: Automated processes that handle calculations and enforce business rules

## Feature Requirements

### 1. Registration & Referral System

#### User Stories
- As a new user, I can only register if I have a valid referral code from an existing user
- As a user, I automatically receive a unique referral code upon registration
- As a user, I receive 20% of the commission my downliners earn from data drives
- As a new user, I receive $15 in my main account upon registration

#### Technical Requirements
- Generate cryptographically secure, unique referral codes
- Validate referral codes during registration
- Store upliner-downliner relationships in database
- Calculate and distribute upliner commissions automatically

### 2. Account System

#### User Stories
- As a new user, I receive a main account with $15 upon registration
- As a new user, I receive a training account with $500
- As a user, I earn 25% commission on my training account activities
- As a user, my training account is closed when I reach the $200 commission cap
- As a user, the $50 earned from my training account is transferred to my main account

#### Technical Requirements
- Maintain separate balances for main and training accounts
- Track commission earnings separately from account balance
- Implement cap detection and account closure logic
- Process automatic transfers between accounts
- Maintain transaction history for all balance changes

### 3. Data Drive System

#### User Stories
- As a user, I can participate in first drives if I have at least $50 in my account
- As a user, I can participate in second drives if I have at least $100 in my account
- As a user, I can complete up to 2 drives per day
- As a user, I cannot start a new drive until an admin resets my previous drive
- As a user, I interact with different products/combos during my drive and earn commissions
- As a user, I see my current balance reduce as I interact with products
- As a user, I may need to top up my account if I encounter items I cannot afford

#### Technical Requirements
- Implement drive eligibility checking based on account balance
- Track daily drive limits per user
- Create drive reset functionality that requires admin action
- Calculate and apply commissions in real-time after each interaction
- Manage product interactions and balance deductions
- Support frozen balance calculation and top-up requirements

### 4. Product & Combo System

#### User Stories
- As an admin, I can create and manage individual products with specific prices and commission rates
- As an admin, I can create combos of up to 3 products
- As a user, I earn different commission rates for different products
- As a user, I must have sufficient balance to interact with each product
- As an admin, I can adjust product prices and commission rates

#### Technical Requirements
- Design flexible product model with configurable price and commission
- Implement combo functionality to group up to 3 products
- Calculate combo prices and commissions as sums of component products
- Validate user balances against product prices before interactions
- Provide admin interface for product management

### 5. Tier System

#### User Stories
- As a user, I am assigned to a tier (bronze, silver, gold, or platinum)
- As a user, my tier determines how many objects I receive per drive
- As an admin, I can upgrade users to higher tiers

#### Technical Requirements
- Store user tier information in user profile
- Map tiers to item quantities (bronze/silver: 40, gold: 45, platinum: 50)
- Apply tier rules consistently across both drive types
- Provide admin functionality to change user tiers

### 6. Balance Management

#### User Stories
- As a user, I see three balance types: current balance, commission, and frozen balance
- As a user, when I cannot afford a product, I see the frozen balance needed to continue
- As an admin, I can adjust user balances after they make payments outside the platform

#### Technical Requirements
- Track multiple balance types per user
- Calculate frozen balance when users encounter unaffordable products
- Provide admin tools to adjust balances
- Maintain comprehensive transaction history
- Ensure accurate balance calculations across all operations

## Non-functional Requirements

### Security
- Implement secure authentication and authorization
- Protect sensitive financial data
- Prevent manipulation of balances or commissions

### Performance
- Support real-time commission calculations
- Handle concurrent drive sessions
- Maintain responsive admin tools even with many users

### Scalability
- Design database for efficient queries with growing user base
- Support increasing product catalog

### Usability
- Provide clear account balance information
- Make drive progress visible and understandable
- Ensure admin tools are efficient and error-resistant