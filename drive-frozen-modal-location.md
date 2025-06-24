# Drive Frozen Modal Location Documentation

## Summary

The task page uses **multiple different approaches** for showing frozen account states:

## 1. Bootstrap Modal (Currently Used for Drive Status Check)

**Location**: `frozenAccountModal` in `task.html` (HTML element)  
**Triggered by**: `fetchBalance()` function in `task.js` (line ~240)  
**Usage**: Shows when `/api/drive/status` returns `status: 'frozen'`  
**Styling**: Basic Bootstrap modal with custom CSS in `task-account-styles.css`  
**Features**: 
- ❌ No close button (only "Go to Deposit" action)
- ✅ Updates amount needed dynamically
- ✅ Shows pulse effect when displayed

## 2. Task.js displayFrozenState() Function (Card Display)

**Location**: `displayFrozenState()` function in `task.js` (line 1773)  
**Usage**: Called from various task operations when drive freezes  
**Rendering**: Creates a **card** element, not a modal  
**Features**:
- ✅ Shows progress and commission info
- ✅ Creates visual card display
- ✅ Adds contact support functionality
- ❌ Not a modal, just an inline card

## 3. Dashboard.js displayFrozenState() Function (Preferred Modal)

**Location**: `displayFrozenState()` function in `dashboard.js` (line 553)  
**Usage**: **NOT currently used on task page** (not exported globally)  
**Features**:
- ✅ Modern, animated modal design
- ✅ Has close button with hover effects
- ✅ Beautiful gradient styling and animations
- ✅ Full-screen overlay with backdrop blur
- ✅ Professional appearance

## Current Implementation Flow

1. **On page load**: `fetchBalance()` checks drive status via API
2. **If frozen**: Shows Bootstrap modal (`frozenAccountModal`)
3. **During drive operations**: Various functions call task.js `displayFrozenState()` 
4. **Result**: Creates card display (not modal)

## Key Finding

The **Bootstrap modal** is the one actually shown to users when their account is frozen, but it lacks a close button and modern styling. The **dashboard.js modal** has superior design but is not currently used on the task page.

## Files Involved

- `task.html` - Contains Bootstrap modal HTML
- `task.js` - Contains fetchBalance() that shows Bootstrap modal + displayFrozenState() card function  
- `dashboard.js` - Contains superior modal design (unused on task page)
- `task-account-styles.css` - Styling for Bootstrap modal

## Recommendation

To use the superior dashboard.js modal on the task page:

1. **Export** `displayFrozenState` globally in dashboard.js:
   ```javascript
   window.displayFrozenState = displayFrozenState;
   ```

2. **Replace** Bootstrap modal call in `fetchBalance()` with dashboard modal call

3. **Replace** task.js card-based `displayFrozenState()` with calls to dashboard modal

4. **Remove** Bootstrap modal HTML from task.html (optional, for cleanup)
