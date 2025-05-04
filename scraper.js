const puppeteer = require('puppeteer');
const fs = require('fs').promises;

// --- Configuration ---
const LOGIN_URL = 'https://the-blueprisms.com/login';
const USERNAME = 'Kimberly8080'; // Provided by user
const PASSWORD = 'bp123456';     // Provided by user

const BASE_URL = 'https://the-blueprisms.com/product-details/';
const START_ID = 1;
const END_ID = 1489; // Adjust if the range is different
const DELAY_MS = 1000; // 1 second delay between requests

// XPaths provided by the user
const XPATHS = {
    image: '//*[@id="__layout"]/div/div[2]/div/div[2]/div[1]/div/img',
    paragraph: '/html/body/div/div/div/div[2]/div/div[2]/div[2]/div[3]/div[2]/p',
    description: '/html/body/div/div/div/div[2]/div/div[2]/div[2]/div[1]',
    // Login XPaths (Updated by user)
    loginUsername: '/html/body/div/div/div/div[2]/div/div/div[2]/div/form/div[2]/div[1]/input',
    loginPassword: '/html/body/div/div/div/div[2]/div/div/div[2]/div/form/div[2]/div[2]/div[1]/input',
    loginSubmit: '/html/body/div/div/div/div[2]/div/div/div[2]/div/form/div[2]/div[3]/button' // Kept previous
};

async function scrapeProducts() {
    let browser; // Declare browser outside try block for finally clause
    console.log('Launching browser...');
    try {
        browser = await puppeteer.launch({
            headless: true // Run in background. Set to false to watch it run.
            // Consider adding args like '--no-sandbox', '--disable-setuid-sandbox' if running in certain environments
        });
        const page = await browser.newPage(); // Use ONE page for login and scraping
        const allProductsData = [];

        // Optional: Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        // --- Login Step ---
        console.log(`Navigating to login page: ${LOGIN_URL}`);
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Waiting for login form elements...');
        // Wait for elements using their XPaths via waitForSelector with 'xpath/' prefix
        await page.waitForSelector(`xpath/${XPATHS.loginUsername}`, { timeout: 15000 }); // Increased timeout slightly
        await page.waitForSelector(`xpath/${XPATHS.loginPassword}`, { timeout: 15000 });
        await page.waitForSelector(`xpath/${XPATHS.loginSubmit}`, { timeout: 15000 });

        console.log('Entering credentials using evaluateHandle...');
        // Use evaluateHandle to get element handles via document.evaluate
        const usernameHandle = await page.evaluateHandle((xpath) => {
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return result.singleNodeValue;
        }, XPATHS.loginUsername);

        const passwordHandle = await page.evaluateHandle((xpath) => {
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return result.singleNodeValue;
        }, XPATHS.loginPassword);

        const submitHandle = await page.evaluateHandle((xpath) => {
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return result.singleNodeValue;
        }, XPATHS.loginSubmit);

        // Check if handles point to actual elements
        if (!await usernameHandle.asElement() || !await passwordHandle.asElement() || !await submitHandle.asElement()) {
             // Clean up handles before throwing error
            await usernameHandle.dispose();
            await passwordHandle.dispose();
            await submitHandle.dispose();
            throw new Error('Could not find one or more login form elements using document.evaluate.');
        }

        await usernameHandle.type(USERNAME);
        await passwordHandle.type(PASSWORD);

        console.log('Submitting login form...');
        // Use Promise.all to wait for navigation resulting from the click
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }), // Wait for page load after click
            submitHandle.click() // Use the handle to click
        ]);

        // Optional: Add a check here to verify login was successful
        // e.g., check if URL changed to dashboard, or if a specific element (like logout button) exists
        console.log(`Login successful (assumed based on navigation). Current URL: ${page.url()}`);

        // Dispose of login element handles to free up memory
        await usernameHandle.dispose();
        await passwordHandle.dispose();
        await submitHandle.dispose();
        // --- End Login Step ---


        console.log(`Starting scrape for products ${START_ID} to ${END_ID}...`);

        for (let id = START_ID; id <= END_ID; id++) {
            const url = `${BASE_URL}${id}`;
            const productData = { // Define productData structure for each iteration
                id: id,
                url: url,
                imageUrl: null,
                paragraph: null,
                description: null,
                error: null
            };

            try {
                console.log(`Scraping: ${url}`);
                // Navigate the *same* page to the product URL
                await page.goto(url, {
                    waitUntil: 'networkidle2', // Wait until network activity settles
                    timeout: 60000 // Increase timeout to 60 seconds
                });

                // Wait a fixed amount of time for any dynamic content loading
                await new Promise(resolve => setTimeout(resolve, 1500)); // Corrected timeout wait

                // --- Extract Image ---
                try {
                    const [imgElement] = await page.$x(XPATHS.image);
                    if (imgElement) {
                        productData.imageUrl = await page.evaluate(el => el.getAttribute('src'), imgElement);
                        await imgElement.dispose(); // Clean up element handle
                    } else {
                        console.warn(`Image XPath not found for ID ${id} at ${url}`);
                        productData.error = (productData.error || '') + 'Image XPath not found. ';
                    }
                } catch (err) {
                    console.error(`Error extracting image for ID ${id}: ${err.message}`);
                    productData.error = (productData.error || '') + `Image extraction failed: ${err.message}. `;
                }

                // --- Extract Paragraph ---
                 try {
                    const [pElement] = await page.$x(XPATHS.paragraph);
                    if (pElement) {
                        productData.paragraph = await page.evaluate(el => el.textContent.trim(), pElement);
                         await pElement.dispose();
                    } else {
                        console.warn(`Paragraph XPath not found for ID ${id} at ${url}`);
                        productData.error = (productData.error || '') + 'Paragraph XPath not found. ';
                    }
                } catch (err) {
                    console.error(`Error extracting paragraph for ID ${id}: ${err.message}`);
                     productData.error = (productData.error || '') + `Paragraph extraction failed: ${err.message}. `;
                }

                // --- Extract Description ---
                 try {
                    const [descElement] = await page.$x(XPATHS.description);
                    if (descElement) {
                        productData.description = await page.evaluate(el => el.textContent.trim(), descElement);
                         await descElement.dispose();
                    } else {
                        console.warn(`Description XPath not found for ID ${id} at ${url}`);
                        productData.error = (productData.error || '') + 'Description XPath not found. ';
                    }
                } catch (err) {
                    console.error(`Error extracting description for ID ${id}: ${err.message}`);
                     productData.error = (productData.error || '') + `Description extraction failed: ${err.message}. `;
                }

            } catch (error) {
                // Catch errors during page navigation or element extraction for a specific product
                console.error(`Failed to process ${url}: ${error.message}`);
                productData.error = (productData.error || '') + `Page load or critical error: ${error.message}`;
            }

            // Push data (or error info) for the current product
            allProductsData.push(productData);

            // Wait before the next request
            console.log(`Waiting ${DELAY_MS / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }

        // Close the single page after the loop is done
        await page.close();

        console.log('Saving data to products.json...');
        await fs.writeFile('products.json', JSON.stringify(allProductsData, null, 2));
        console.log('Data saved successfully!');

    } catch (error) {
        // Catch errors during browser launch, login, or file writing
        console.error('Unhandled error during scraping process:', error);
    } finally {
        // Ensure browser is closed even if errors occur
        if (browser) {
            console.log('Closing browser...');
            await browser.close();
        }
    }

    console.log('Scraping finished.');
}

// Execute the main function and handle potential promise rejection
scrapeProducts().catch(error => {
    console.error('Fatal error executing scrapeProducts:', error);
    // Attempt to close browser if it exists and an error occurred outside the main try/finally
    if (browser) {
       browser.close().catch(err => console.error('Error closing browser on fatal error:', err));
    }
    process.exit(1); // Exit with error code
});
