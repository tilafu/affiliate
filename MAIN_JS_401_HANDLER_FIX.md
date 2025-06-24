# Main.js 401 Handler Variable Fix

## Issue
`SyntaxError: Identifier 'is401HandlerActive' has already been declared`

This error occurred because main.js was likely being loaded multiple times, causing the `let is401HandlerActive = false;` declaration to conflict with itself.

## Solution Applied

### 1. Changed Variable Declaration
**Before:**
```javascript
let is401HandlerActive = false;
```

**After:**
```javascript
if (typeof window.is401HandlerActive === 'undefined') {
    window.is401HandlerActive = false;
}
```

### 2. Updated Variable Usage
**Before:**
```javascript
if (is401HandlerActive) {
    return;
}
is401HandlerActive = true;
```

**After:**
```javascript
if (window.is401HandlerActive) {
    return;
}
window.is401HandlerActive = true;
```

### 3. Added Flag Reset
**Added:**
```javascript
} finally {
    // Reset the flag in case redirect fails
    setTimeout(() => {
        window.is401HandlerActive = false;
    }, 2000);
}
```

## Benefits

1. **Prevents Redeclaration Error**: Uses conditional declaration to avoid conflicts
2. **Global Scope**: Variable is now on window object, preventing scope conflicts
3. **Safety Reset**: Flag is reset after 2 seconds in case redirect fails
4. **Multiple Script Loading Safe**: Can handle main.js being loaded multiple times

## Result
✅ No more syntax errors
✅ 401 handler works properly
✅ Safe from script loading conflicts
✅ Maintains all existing functionality
