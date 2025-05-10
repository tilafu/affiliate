// Function to set the language and update content
async function setLanguage(lang) {
    await i18next.changeLanguage(lang);
    localStorage.setItem('preferredLanguage', lang);
    updateContent();
    // Update the language switcher to reflect the current language
    const langSwitcher = document.getElementById('language-switcher');
    if (langSwitcher) {
        langSwitcher.value = lang;
    }
}

// Function to update all elements with data-i18n attributes
function updateContent() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const options = element.hasAttribute('data-i18n-options')
            ? JSON.parse(element.getAttribute('data-i18n-options'))
            : {};

        // For input placeholders, we need to set the placeholder attribute
        if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
            element.placeholder = i18next.t(key, options);
        } else {
            element.innerHTML = i18next.t(key, options);
        }
    });
    // Update page title
    const titleElement = document.querySelector('title');
    if (titleElement) {
        const pageTitleKey = titleElement.getAttribute('data-i18n-title');
        if (pageTitleKey) {
            document.title = i18next.t(pageTitleKey);
        } else if (i18next.exists('pageTitle')) { // Fallback for pages that might not have data-i18n-title
             document.title = i18next.t('pageTitle');
        }
    } else if (i18next.exists('pageTitle')) { // Fallback if title element itself is missing but key exists
        document.title = i18next.t('pageTitle');
    }
}

// Initialize i18next
async function initI18next() {
    await i18next
        .use(i18nextHttpBackend)
        .init({
            lng: localStorage.getItem('preferredLanguage') || 'en', // Default language
            fallbackLng: 'en', // Fallback language if translation is missing
            debug: true, // Set to false in production
            backend: {
                loadPath: 'locales/{{lng}}.json' // Path to translation files
            }
        });
    updateContent();

    // Set up language switcher
    const langSwitcher = document.getElementById('language-switcher');
    if (langSwitcher) {
        langSwitcher.value = i18next.language; // Set initial value
        langSwitcher.addEventListener('change', (event) => {
            setLanguage(event.target.value);
        });
    }
}

// Call initialization when the script loads
initI18next();

// Expose the t function globally if needed, or pass it around.
// For simplicity in this example, we'll rely on calling updateContent
// or specific update functions after language change.
// If showNotification is in main.js and needs i18n, it should use i18next.t()
// Example of how showNotification might be adapted if it were here:
/*
function showTranslatedNotification(messageKey, type, options = {}) {
    const message = i18next.t(messageKey, options);
    // Assuming showNotification is globally available or imported
    showNotification(message, type);
}
*/
