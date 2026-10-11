from playwright.sync_api import sync_playwright

SEARCH_URL = "https://www.coles.com.au/search/products?q=monster%20ultra%20white"


def _extract_products(data):
    products = []
    results = data.get("pageProps", {}).get("searchResults", {}).get("results", [])
    for item in results:
        name = item.get("name")
        pricing = item.get("pricing") or {}
        price = pricing.get("now")
        if not name or price is None:
            continue
        if "white" not in name.lower():
            continue
        try:
            price = float(price)
        except (TypeError, ValueError):
            continue
        slug = (item.get("_links") or {}).get("self", {}).get("href", "")
        products.append({
            "name": name,
            "price": price,
            "url": f"https://www.coles.com.au{slug}" if slug else SEARCH_URL,
        })
    return products


def search_white_monster():
    captured = {}

    def handle_response(response):
        if "_next/data" in response.url and "search" in response.url and response.status == 200:
            try:
                captured["data"] = response.json()
            except Exception:
                pass

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("response", handle_response)
        page.goto(SEARCH_URL, wait_until="networkidle", timeout=30000)
        browser.close()

    if "data" not in captured:
        raise RuntimeError("Coles search did not return product data (possibly blocked)")

    return _extract_products(captured["data"])
