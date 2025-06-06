/*
* I18N System - COMPLETELY DISABLED
* 
* This system has been disabled in favor of using fallback text conversion.
* All `data-i18n` attributes will display readable text converted from the key names.
* 
* How it works:
* - `convertKeyToText()` function converts camelCase keys to readable text
* - Example: "withdrawalsPageTitle" → "Withdrawals Page"
* - Example: "makeWithdrawalTitle" → "Make Withdrawal"
* - Example: "footerHomeLink" → "Footer Home"
* 
* Usage:
* Simply add `data-i18n="keyName"` attributes to HTML elements and they will automatically display converted text.
*/

// Function to set the language - DISABLED
function setLanguage(lang) {
    // I18N DISABLED - Just store the preference but don't change anything
    localStorage.setItem('preferredLanguage', lang);
    updateContent();
    // Update the language switcher to reflect the current language
    const langSwitcher = document.getElementById('language-switcher');
    if (langSwitcher) {
        langSwitcher.value = lang;
    }
}

// Function to update all elements with data-i18n attributes - USING FALLBACK TEXT ONLY
function updateContent() {
    // I18N DISABLED - Using fallback text conversion only
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        
        // Convert key to readable text
        const fallbackText = convertKeyToText(key);

        // For input placeholders, we need to set the placeholder attribute
        if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
            element.placeholder = fallbackText;
        } else {
            element.innerHTML = fallbackText;
        }
    });
    
    // Update page title with fallback
    const titleElement = document.querySelector('title');
    if (titleElement) {
        const pageTitleKey = titleElement.getAttribute('data-i18n-title');
        if (pageTitleKey) {
            document.title = convertKeyToText(pageTitleKey);
        }
    }
}

// Convert camelCase/key to readable text
function convertKeyToText(key) {
    // Enhanced conversion from camelCase to readable text
    return key
        .replace(/^footer/i, '') // Remove "footer" prefix (case insensitive)
        .replace(/^sidebar/i, '') // Remove "sidebar" prefix (case insensitive) 
        .replace(/^nav/i, '') // Remove "nav" prefix (case insensitive)
        .replace(/^menu/i, '') // Remove "menu" prefix (case insensitive)
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .replace(/Link$/, '') // Remove "Link" suffix
        .replace(/Title$/, '') // Remove "Title" suffix
        .replace(/Label$/, '') // Remove "Label" suffix
        .replace(/Page$/, '') // Remove "Page" suffix
        .replace(/Button$/, '') // Remove "Button" suffix
        .replace(/Text$/, '') // Remove "Text" suffix
        .replace(/Message$/, '') // Remove "Message" suffix
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
}

// Simple initialization - NO i18next dependency
function initI18n() {
    console.log('i18n system initialized (DISABLED - using fallback text only)');
    
    // Apply fallback text to all elements immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateContent);
    } else {
        updateContent();
    }
    
    // Dispatch a global event when i18n is ready
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('i18nReady'));
    }, 100);
}

// Call initialization when the script loads
initI18n();

// Set up language switcher (even though it doesn't do anything now)
document.addEventListener('DOMContentLoaded', () => {
    const langSwitcher = document.getElementById('language-switcher');
    if (langSwitcher) {
        langSwitcher.value = localStorage.getItem('preferredLanguage') || 'en';
        langSwitcher.addEventListener('change', (event) => {
            setLanguage(event.target.value);
        });
    }
});

// Make updateContent globally available for dynamic content
window.updateContent = updateContent;

// Add a global function to force update all translations
window.forceUpdateTranslations = function() {
    console.log('Force updating all text conversions...');
    updateContent();
    console.log('Text conversions updated successfully');
};

// Make other functions globally available if needed
window.setLanguage = setLanguage;
window.convertKeyToText = convertKeyToText;
