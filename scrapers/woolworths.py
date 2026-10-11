import math

from playwright.sync_api import sync_playwright

from scrapers._playwright_utils import goto_and_wait
from scrapers._product_matching import is_white_monster

SEARCH_URL = "https://www.woolworths.com.au/shop/search/products?searchTerm=monster+ultra+white"
SEARCH_API_PATTERN = "/apis/ui/Search/products"


def _extract_products(data):
    products = []
    bundles = data.get("Bundles") or data.get("Products") or []
    for bundle in bundles:
        for item in bundle.get("Products", []):
            name = item.get("Name") or item.get("DisplayName")
            price = item.get("Price")
            stockcode = item.get("Stockcode")
            if not name or price is None:
                continue
            if not is_white_monster(name):
                continue
            try:
                price = float(price)
            except (TypeError, ValueError):
                continue
            if not math.isfinite(price):
                continue
            products.append({
                "name": name,
                "price": price,
                "url": (
                    f"https://www.woolworths.com.au/shop/productdetails/{stockcode}"
                    if stockcode else SEARCH_URL
                ),
            })
    return products


def search_white_monster():
    captured = {}

    def handle_response(response):
        if SEARCH_API_PATTERN in response.url and response.status == 200:
            try:
                captured["data"] = response.json()
            except Exception:
                pass

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        try:
            page = browser.new_page()
            page.on("response", handle_response)
            goto_and_wait(page, SEARCH_URL, timeout=30000)
        finally:
            browser.close()

    if "data" not in captured:
        raise RuntimeError("Woolworths search did not return product data (possibly blocked)")

    return _extract_products(captured["data"])
