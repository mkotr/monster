import json
import math
import re

from playwright.sync_api import sync_playwright

from scrapers._playwright_utils import goto_and_wait
from scrapers._product_matching import is_white_monster

SEARCH_URL = "https://www.coles.com.au/search/products?q=monster%20ultra%20white"


def _slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _extract_products(data):
    products = []
    results = data.get("pageProps", {}).get("searchResults", {}).get("results", [])
    for item in results:
        name = item.get("name")
        if not name:
            continue
        brand = item.get("brand") or ""
        size = item.get("size") or ""
        full_name = f"{brand} {name}".strip()
        if size:
            full_name = f"{full_name} | {size}"
        if not is_white_monster(full_name):
            continue
        pricing = item.get("pricing") or {}
        price = pricing.get("now")
        if price is None:
            continue
        try:
            price = float(price)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(price):
            continue
        product_id = item.get("id")
        if product_id:
            url = f"https://www.coles.com.au/product/{_slugify(full_name)}-{product_id}"
        else:
            url = SEARCH_URL
        products.append({
            "name": full_name,
            "price": price,
            "url": url,
        })
    return products


def _parse_next_data(text):
    if not text:
        return {}
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return {}
    return data.get("props", {})


def search_white_monster():
    captured = {}

    def handle_response(response):
        if "_next/data" in response.url and "search" in response.url and response.status == 200:
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

            if "data" not in captured:
                try:
                    next_data_text = page.locator("#__NEXT_DATA__").text_content(timeout=5000)
                except Exception:
                    next_data_text = None
                props = _parse_next_data(next_data_text)
                if props:
                    captured["data"] = props
        finally:
            browser.close()

    if "data" not in captured:
        raise RuntimeError("Coles search did not return product data (possibly blocked)")

    return _extract_products(captured["data"])
