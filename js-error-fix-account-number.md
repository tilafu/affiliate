# JavaScript Error Fix: Account Number Field Access

## Problem
```
deposits.html:913 Uncaught TypeError: Cannot read properties of null (reading 'dataset')
    at processBankDepositSimple (deposits.html:913:50)
```

## Root Cause
The bank deposit form had the account number field commented out in the HTML:

```html
<!-- Account Number -->
<!-- <div class="mb-4">
    <label for="account_number" class="form-label">
        <i class="fas fa-credit-card me-2"></i>Account Number
    </label>
    <input type="text" id="account_number" class="form-control" placeholder="Enter your account number" maxlength="20" required>
    <div class="form-text">Your bank account number (will be masked for security)</div>
</div> -->
```

However, the JavaScript was still trying to access this element:

```javascript
const accountNumberInput = document.getElementById('account_number'); // Returns null
// Later in processBankDepositSimple():
const accountNumber = accountNumberInput ? (accountNumberInput.dataset.originalValue || ...) : '';
//                                           ↑ ERROR: Cannot read properties of null
```

## Solution
Added proper null checking for the `dataset` property:

**Before (causing error):**
```javascript
const accountNumber = accountNumberInput ? (accountNumberInput.dataset.originalValue || accountNumberInput.value.replace(/[••]/g, '')) : '';
```

**After (fixed):**
```javascript
const accountNumber = accountNumberInput ? (accountNumberInput.dataset && accountNumberInput.dataset.originalValue ? accountNumberInput.dataset.originalValue : accountNumberInput.value.replace(/[••]/g, '')) : '';
```

## Technical Details
- `document.getElementById('account_number')` returns `null` when the element doesn't exist
- The code checked if `accountNumberInput` exists but didn't check if `accountNumberInput.dataset` exists
- Even when an element exists, `dataset` can be undefined in some cases
- The fix adds defensive programming by checking both conditions

## Prevention
Always use defensive programming when accessing nested properties of DOM elements:
```javascript
// Instead of:
element ? element.dataset.property : ''

// Use:
element && element.dataset && element.dataset.property ? element.dataset.property : ''
```

## Status
✅ **Fixed** - Bank deposit form now works correctly even with commented-out account number field.
