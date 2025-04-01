# Backend Implementation Plan

## 1. Phase 1 - Foundation Setup & Authentication
```mermaid
graph TD
A[Phase 1] --> B[Database Setup]
A --> C[Server Boilerplate]
A --> D[Auth System]
B --> B1[Users Table]
B --> B2[Accounts Table]
C --> C1[Express Server]
C --> C2[DB Connection]
D --> D1[Registration]
D --> D2[Login]
D --> D3[JWT Auth]
```

### Implementation Steps:
1. **Database Initialization**
   - Create PostgreSQL database `affiliate_db`
   - Run schema setup from `sql/init.sql`
   - *Verification*: `SELECT * FROM pg_tables WHERE schemaname='public'`

2. **Server Boilerplate**
   - Create `server/` directory with Express setup
   - Configure environment variables (.env)
   - *Verification*: Server responds to GET /api/status

3. **Registration System**
   - POST /api/auth/register endpoint
   - Referral code validation logic
   - *Verification*: New user appears in DB with encrypted password

4. **Login & JWT**
   - POST /api/auth/login endpoint
   - JWT token generation
   - Auth middleware for protected routes
   - *Verification*: Successful login returns valid JWT

---

## 2. Phase 2 - Affiliate System Core
```mermaid
graph TD
A[Phase 2] --> B[Referral Validation]
A --> C[Upline Tracking]
A --> D[Commission Calculation]
B --> B1[Code Exists Check]
B --> B2[Prevent Self-Referral]
C --> C1[Upline-Downline Relationship]
D --> D1[Direct Commission]
D --> D2[Indirect Commission]
```

### Implementation Steps:
1. **Referral Code Handling**
   - Add referral code generation on registration
   - *Verification*: New users get unique 8-character codes

2. **Upline Tracking**
   - Store upline_id in users table
   - *Verification*: Downline users appear in upline's record

3. **Commission Calculation**
   - Implement multi-level commission (5-3-1%)
   - *Verification*: Test with 3-level referral chain

---

## 3. Phase 3 - Data Drive System
```mermaid
graph TD
A[Phase 3] --> B[Drive Sessions]
A --> C[Product Combos]
A --> D[Commission Tracking]
B --> B1[Start Drive]
B --> B2[Complete Drive]
C --> C1[Combo Pricing]
D --> D1[Real-time Updates]
```

### Implementation Steps:
1. **Drive Session Management**
   - POST /api/drive/start
   - *Verification*: Drive session appears in database

2. **Product Combo System**
   - Predefined product combinations
   - *Verification*: Combos return correct pricing

---

## 4. Phase 4 - Tier System
```mermaid
graph TD
A[Phase 4] --> B[Tier Progression]
A --> C[Tier Benefits]
B --> B1[Performance Tracking]
C --> C1[Commission Boost]
C --> C2[Access Levels]
```

### Implementation Steps:
1. **Tier Upgrade Logic**
   - Daily check for tier qualifications
   - *Verification*: Test user upgrades after meeting criteria

---

## 5. Phase 5 - Balance Management
```mermaid
graph TD
A[Phase 5] --> B[Transaction System]
A --> C[Fund Freezing]
A --> D[Payout Processing]
B --> B1[Balance Updates]
C --> C1[Fraud Prevention]
```

### Implementation Steps:
1. **Balance Operations**
   - Atomic balance updates
   - *Verification*: Test concurrent transactions

---

## 6. Phase 6 - Admin System
```mermaid
graph TD
A[Phase 6] --> B[User Management]
A --> C[Analytics]
A --> D[System Configuration]
B --> B1[User Search]
C --> C1[Real-time Dashboard]
```

---

## Testing Strategy
1. **Unit Tests** - Jest (API endpoints)
2. **Integration Tests** - Database operations
3. **E2E Tests** - Cypress (User flows)

## Documentation
1. API Reference (Swagger)
2. Database Schema Docs
3. Deployment Guide
