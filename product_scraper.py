import asyncio
import csv
import json
import logging
import time
import os
import aiohttp
from typing import List, Dict, Any

from playwright.async_api import async_playwright

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# XPaths for login and product details
LOGIN_SELECTORS = {
    "username": "/html/body/div/div/div/div[2]/div/div/div[2]/div/form/div[2]/div[1]/input",
    "password": "/html/body/div/div/div/div[2]/div/div/div[2]/div/form/div[2]/div[2]/div[1]/input",
    "submit": "/html/body/div/div/div/div[2]/div/div/div[2]/div/form/div[2]/div[3]/button"
}
LOGIN_CREDENTIALS = {
    "username": "Kimberly8080",
    "password": "bp123456"
}
SELECTORS = {
    "image": "/html/body/div/div/div/div[2]/div/div[2]/div[1]/div/img",
    "name": "/html/body/div/div/div/div[2]/div/div[2]/div[2]/div[1]",
    "price": "/html/body/div/div/div/div[2]/div/div[2]/div[2]/div[2]",
    "description": "/html/body/div/div/div/div[2]/div/div[2]/div[2]/div[3]/div[2]/p"
}

class ProductScraper:
    def __init__(self, urls_file: str = "urls.csv", batch_size: int = 10, test_run: bool = False):
        self.urls_file = urls_file
        self.batch_size = batch_size
        self.results = []
        self.total_urls = 0
        self.processed_urls = 0
        self.test_run = test_run  # If True, only scrape first 5

    def read_urls(self) -> List[str]:
        urls = []
        try:
            with open(self.urls_file, 'r') as file:
                for line in file:
                    line = line.strip()
                    if line and not line.startswith('//'):
                        urls.append(line)
            self.total_urls = len(urls)
            logger.info(f"Loaded {self.total_urls} URLs from {self.urls_file}")
            # Only use first 5 for test run
            if self.test_run:
                urls = urls[:5]
                logger.info("Test run enabled: Only processing first 5 URLs.")
            return urls
        except Exception as e:
            logger.error(f"Error reading URLs file: {e}")
            return []

    async def login(self, page):
        login_url = "https://the-blueprisms.com/login"
        await page.goto(login_url, wait_until="networkidle")
        logger.info("Logging in...")

        await page.fill(f"xpath={LOGIN_SELECTORS['username']}", LOGIN_CREDENTIALS["username"])
        await page.fill(f"xpath={LOGIN_SELECTORS['password']}", LOGIN_CREDENTIALS["password"])
        await page.click(f"xpath={LOGIN_SELECTORS['submit']}")
        await page.wait_for_load_state("networkidle")
        logger.info("Login successful.")
        await asyncio.sleep(2)  # Wait a bit after login

    async def download_image(self, context, image_url: str, product_id: str):
        if not image_url or not product_id:
            return None
        os.makedirs("images", exist_ok=True)
        filename = f"{product_id}.jpg"
        filepath = os.path.join("images", filename)
        try:
            # Open image in a new tab
            page = await context.new_page()
            await page.goto(image_url, wait_until="networkidle")
            # Get image bytes using JavaScript
            img_bytes = await page.evaluate("""
                () => {
                    return fetch(window.location.href)
                        .then(res => res.arrayBuffer())
                        .then(buf => Array.from(new Uint8Array(buf)));
                }
            """)
            with open(filepath, "wb") as f:
                f.write(bytes(img_bytes))
            await page.close()
            logger.info(f"Downloaded image: {filepath}")
            return filepath
        except Exception as e:
            logger.error(f"Error downloading image {image_url}: {e}")
            return None

    async def scrape_product(self, page, url):
        await page.goto(url, wait_until="networkidle")
        await asyncio.sleep(2)  # Wait for content to load

        product_data = {}

        # Extract product ID from URL
        try:
            product_id = url.rstrip('/').split('/')[-1]
            product_data["product_id"] = product_id
        except Exception:
            product_id = None
            product_data["product_id"] = None

        # Extract image and download
        try:
            image_element = await page.query_selector(f"xpath={SELECTORS['image']}")
            if image_element:
                image_src = await image_element.get_attribute("src")
                product_data["image_alt"] = await image_element.get_attribute("alt")
                # Download image as {product_id}.jpg using browser context
                image_file = await self.download_image(page.context, image_src, product_id)
                # Only include the relative path in the output
                if image_file:
                    product_data["image_file"] = os.path.relpath(image_file)
                else:
                    product_data["image_file"] = None
            else:
                product_data["image_file"] = None
        except Exception as e:
            logger.error(f"Failed to extract/download image: {e}")
            product_data["image_file"] = None

        # Extract name
        try:
            name_element = await page.query_selector(f"xpath={SELECTORS['name']}")
            if name_element:
                product_data["name"] = (await name_element.text_content()).strip()
            else:
                product_data["name"] = None
        except Exception as e:
            logger.error(f"Failed to extract name: {e}")
            product_data["name"] = None

        # Extract price
        try:
            price_element = await page.query_selector(f"xpath={SELECTORS['price']}")
            if price_element:
                product_data["price"] = (await price_element.text_content()).strip()
            else:
                product_data["price"] = None
        except Exception as e:
            logger.error(f"Failed to extract price: {e}")
            product_data["price"] = None

        # Extract description
        try:
            desc_element = await page.query_selector(f"xpath={SELECTORS['description']}")
            if desc_element:
                product_data["description"] = (await desc_element.text_content()).strip()
            else:
                product_data["description"] = None
        except Exception as e:
            logger.error(f"Failed to extract description: {e}")
            product_data["description"] = None

        return product_data

    async def scrape_all(self):
        urls = self.read_urls()
        if not urls:
            return []

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)  # Set headless=True to hide browser
            context = await browser.new_context()
            page = await context.new_page()
            await self.login(page)

            for i, url in enumerate(urls, 1):
                logger.info(f"Scraping {i}/{len(urls)}: {url}")
                try:
                    data = await self.scrape_product(page, url)
                    self.results.append({"url": url, "data": data})
                except Exception as e:
                    logger.error(f"Error scraping {url}: {e}")
                    self.results.append({"url": url, "data": None, "error": str(e)})
                await asyncio.sleep(2)  # Wait between requests

            await browser.close()
        self.save_results("products.json")
        logger.info(f"Scraping complete! Processed {len(self.results)} products.")

    def save_results(self, filename="products.json"):
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        logger.info(f"Results saved to {filename}")

async def main():
    scraper = ProductScraper()
    await scraper.scrape_all()

async def scrape_missing_range(start_id=582, end_id=1298, products_file='products.json'):
    # 1. Load existing products
    if os.path.exists(products_file):
        with open(products_file, 'r', encoding='utf-8') as f:
            products = json.load(f)
    else:
        products = []

    # 2. Get existing product_ids
    existing_ids = {int(item['data']['product_id']) for item in products if item.get('data') and item['data'].get('product_id')}

    # 3. Prepare URLs for missing IDs
    missing_urls = [
        f"https://the-blueprisms.com/product-details/{pid}"
        for pid in range(start_id, end_id + 1)
        if pid not in existing_ids
    ]

    if not missing_urls:
        print("No missing products to scrape in the specified range.")
        return

    # 4. Scrape missing products
    scraper = ProductScraper()
    scraper.results = products  # Start with existing products

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        await scraper.login(page)

        for i, url in enumerate(missing_urls, 1):
            print(f"Scraping missing {i}/{len(missing_urls)}: {url}")
            try:
                data = await scraper.scrape_product(page, url)
                scraper.results.append({"url": url, "data": data})
            except Exception as e:
                print(f"Error scraping {url}: {e}")
                scraper.results.append({"url": url, "data": None, "error": str(e)})
            await asyncio.sleep(2)

        await browser.close()

    # 5. Write combined list back to products.json
    with open(products_file, 'w', encoding='utf-8') as f:
        json.dump(scraper.results, f, ensure_ascii=False, indent=2)
    print(f"Done! Scraped and appended {len(missing_urls)} products.")

if __name__ == "__main__":
    asyncio.run(scrape_missing_range())