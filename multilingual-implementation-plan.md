# Multilingual Implementation Plan for Website

## Overview
This document provides a step-by-step guide for implementing multilingual functionality across all pages of the website.

## Implemented Pages
- Login Page
- Registration Page
- Profile Page

## Pages Pending Implementation
- Deposit Page
- Withdrawal Page
- Memberships Page
- Terms and Conditions Page
- FAQs Page
- About Us Page
- Notifications System

## Implementation Steps for Each Page

### 1. Add Required Script References
Add i18next scripts to the head section of each HTML page:
```html
<!-- i18next scripts -->
<script src="https://unpkg.com/i18next/i18next.min.js"></script>
<script src="https://unpkg.com/i18next-http-backend/i18nextHttpBackend.min.js"></script>
```

Include the i18n.js script before other custom scripts:
```html
<script src="./js/i18n.js"></script>
```

### 2. Add data-i18n Attributes
Add data-i18n attributes to all elements that contain text:
```html
<h1 data-i18n="pageTitle">Original Text</h1>
<p data-i18n="paragraphText">Original paragraph text</p>
<button data-i18n="buttonText">Button Text</button>
```

For input placeholders:
```html
<input type="text" placeholder="Original placeholder" data-i18n="placeholderKey">
```

For page titles:
```html
<title data-i18n-title="pageTitleKey">Original Title</title>
```

### 3. Initialize i18n in the Page's JavaScript File
Add the following code to initialize i18n and update the content when the language changes:

```javascript
// Function to ensure i18n content is updated with correct translations
function updatePageTranslations() {
    // Only run if i18next is available and initialized
    if (window.i18next && window.i18next.isInitialized) {
        // Call the global updateContent function from i18n.js
        if (typeof updateContent === 'function') {
            updateContent();
            console.log('Updated page translations');
        } else {
            console.warn('updateContent function not available');
        }
    } else {
        console.warn('i18next not initialized yet');
    }
}

// Initialize i18n on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize i18next if not already initialized
    if (typeof initI18next === 'function' && window.i18next && !window.i18next.isInitialized) {
        initI18next().then(() => {
            console.log('i18next initialized');
            // After i18next initializes, update translations
            updatePageTranslations();
        });
    } else if (window.i18next && window.i18next.isInitialized) {
        // If already initialized, just update translations
        console.log('i18next already initialized, updating translations');
        updatePageTranslations();
    }
    
    // For pages with sidebar
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    if (sidebarPlaceholder) {
        sidebarPlaceholder.addEventListener('componentLoaded', (event) => {
            if (event.detail.path === '/components/sidebar.html') {
                // Setup language switcher after sidebar loads
                const langSwitcher = document.getElementById('language-switcher');
                if (langSwitcher) {
                    // Set initial value
                    langSwitcher.value = i18next.language || 'en';
                    
                    // Add change event listener
                    langSwitcher.addEventListener('change', (e) => {
                        setLanguage(e.target.value);
                    });
                }
                
                // Update translations again after sidebar loads
                updatePageTranslations();
            }
        });
    }
});

// Add language change event listener
if (window.i18next) {
    window.i18next.on('languageChanged', () => {
        console.log('Language changed, updating translations');
        updatePageTranslations();
    });
}
```

### 4. Add Translation Support for API Messages and Notifications
Modify the showNotification function in the page's JavaScript file to use translated messages:

```javascript
// Example of using translated notification messages
const successMsg = (window.i18next && window.i18next.isInitialized) ? 
    i18next.t('successMessageKey', 'Default success message') : 
    'Default success message';

showNotification(successMsg, 'success');
```

### 5. Update Translation Files
Add all necessary keys to the translation files (locales/en.json, locales/es.json, locales/fr.json, etc.):

```json
{
  "pageTitle": "Page Title in English",
  "paragraphText": "This is a paragraph in English",
  "buttonText": "Button Text in English",
  "placeholderKey": "Placeholder text in English",
  "successMessageKey": "Success message in English"
}
```

## Recommended Implementation Order
1. Deposit Page (critical for user functionality)
2. Withdrawal Page (critical for user functionality)
3. Memberships Page
4. Notification System
5. FAQs Page
6. Terms and Conditions Page
7. About Us Page

## Testing Checklist
For each page:
- [ ] All static text elements display correctly in all languages
- [ ] Placeholders and form elements display correctly in all languages
- [ ] Page title changes correctly
- [ ] Error and success messages display correctly in the selected language
- [ ] The language switcher correctly changes all content on the page
- [ ] No hardcoded text remains untranslated

## Advanced Features to Consider
- Automatic language detection based on browser settings
- Remember user language preference in local storage
- URL parameters for language selection (e.g., ?lang=fr)
- Fallback mechanisms for missing translations
