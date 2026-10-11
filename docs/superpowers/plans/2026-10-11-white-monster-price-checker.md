# White Monster Price Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Flask app with an on-demand "Check Prices" button that
fetches the current White Monster (Monster Energy Ultra White) price
from Woolworths and Coles via headless-browser scraping, and shows both
side by side.

**Architecture:** Two independent Playwright-based scraper modules (one
per store) each expose a `search_white_monster()` function. A Flask app
runs both concurrently behind one `/api/prices` endpoint, isolating
failures per store, and serves a single static HTML/JS page that calls
that endpoint and renders a results table.

**Tech Stack:** Python, Flask, Playwright (sync API), pytest.

**Spec:** `docs/superpowers/specs/2026-10-11-white-monster-price-checker-design.md`

## Global Constraints

- Local only — runs via `python app.py`; no production WSGI config, no deployment.
- No database or persistence — every check is a fresh live lookup.
- Scope is exactly two stores (Woolworths, Coles) and one product (White Monster) — no generalizing to other products/stores.
- No scheduling, price history, or notifications in this iteration.
- No retries or proxy rotation when a site blocks a request — surface it as a per-store error instead.

## Review Focus

- A store's request is blocked or times out — the other store's result must still come back successfully, not get taken down by a shared exception.
- A store returns zero matching products — must render as "no matching product found," not a crash or a blank row.
- Multiple pack sizes match "white" in the product name at one store — all must be shown, not silently truncated to the first match.
- A scraped price value is missing or non-numeric (e.g. `"N/A"`, `null`) — that item must be skipped rather than crashing the whole request.
- The frontend must handle a completely unreachable backend (Flask not running, network error) without leaving the button stuck disabled or the page silently blank.

---

### Task 1: Project Setup & Woolworths Scraper

**Files:**
- Create: `requirements.txt`
- Create: `conftest.py`
- Create: `scrapers/__init__.py`
- Create: `scrapers/woolworths.py`
- Test: `tests/test_woolworths.py`

**Interfaces:**
- Produces: `scrapers.woolworths.search_white_monster() -> list[dict]`, each dict shaped `{"name": str, "price": float, "url": str}`. Raises `RuntimeError` if Woolworths' search doesn't return usable data (e.g. blocked).
- Produces: `scrapers.woolworths._extract_products(data: dict) -> list[dict]` — pure function, same return shape, used internally and by tests.

- [ ] **Step 1: Create project scaffolding**

`requirements.txt`:
```
flask
playwright
pytest
```

`conftest.py` (empty — its presence makes pytest add the repo root to `sys.path` so `scrapers` and, later, `app` are importable from tests regardless of invocation directory):
```python
```

`scrapers/__init__.py` (empty):
```python
```

Run:
```bash
pip install -r requirements.txt
playwright install chromium
```

- [ ] **Step 2: Write the failing tests for the pure parsing logic**

```python
# tests/test_woolworths.py
from scrapers.woolworths import _extract_products


def test_extract_products_finds_matching_white_monster():
    data = {"Bundles": [{"Products": [
        {"Name": "Monster Energy Ultra White 500mL", "Price": 3.5, "Stockcode": 123},
        {"Name": "Monster Energy Original 500mL", "Price": 3.2, "Stockcode": 456},
    ]}]}
    result = _extract_products(data)
    assert len(result) == 1
    assert result[0]["name"] == "Monster Energy Ultra White 500mL"
    assert result[0]["price"] == 3.5
    assert result[0]["url"].endswith("/123")


def test_extract_products_returns_empty_list_when_no_match():
    data = {"Bundles": [{"Products": [
        {"Name": "Monster Energy Original 500mL", "Price": 3.2, "Stockcode": 456},
    ]}]}
    assert _extract_products(data) == []


def test_extract_products_skips_items_with_non_numeric_price():
    data = {"Bundles": [{"Products": [
        {"Name": "Monster Ultra White 500mL", "Price": "N/A", "Stockcode": 123},
    ]}]}
    assert _extract_products(data) == []


def test_extract_products_returns_all_matching_pack_sizes():
    data = {"Bundles": [{"Products": [
        {"Name": "Monster Ultra White 500mL", "Price": 3.5, "Stockcode": 1},
        {"Name": "Monster Ultra White 4pk 500mL", "Price": 12.0, "Stockcode": 2},
    ]}]}
    result = _extract_products(data)
    assert len(result) == 2
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_woolworths.py -v`
Expected: FAIL with `ImportError` / `ModuleNotFoundError` (`scrapers.woolworths` doesn't exist yet)

- [ ] **Step 4: Implement the scraper**

```python
# scrapers/woolworths.py
from playwright.sync_api import sync_playwright

SEARCH_URL = "https://www.woolworths.com.au/shop/search/products?searchTerm=monster+ultra+white"
SEARCH_API_PATTERN = "/apis/ui/Search/products"


def _extract_products(data):
    products = []
    bundles = data.get("Bundles") or [{"Products": data.get("Products", [])}]
    for bundle in bundles:
        for item in bundle.get("Products", []):
            name = item.get("Name") or item.get("DisplayName")
            price = item.get("Price")
            stockcode = item.get("Stockcode")
            if not name or price is None:
                continue
            if "white" not in name.lower():
                continue
            try:
                price = float(price)
            except (TypeError, ValueError):
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
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("response", handle_response)
        page.goto(SEARCH_URL, wait_until="networkidle", timeout=30000)
        browser.close()

    if "data" not in captured:
        raise RuntimeError("Woolworths search did not return product data (possibly blocked)")

    return _extract_products(captured["data"])
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_woolworths.py -v`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Manually verify against the live site**

Run:
```bash
python -c "from scrapers.woolworths import search_white_monster; import json; print(json.dumps(search_white_monster(), indent=2))"
```

Expected: a non-empty list with at least one product whose name contains
"white" and a plausible price (roughly $2-$6 for a single can, more for
multipacks).

If it raises `RuntimeError`, or returns an empty list when you know the
product is in stock, the real JSON shape doesn't match the guessed field
names above. Temporarily add `print(captured["data"])` (or
`print(captured)` if nothing was captured at all — check whether the
`SEARCH_API_PATTERN` matched any response) inside `search_white_monster`,
rerun, inspect the actual structure, and adjust `_extract_products` (and
its tests) to match the real field names. Remove the debug print before
committing.

- [ ] **Step 7: Commit**

```bash
git add requirements.txt conftest.py scrapers/__init__.py scrapers/woolworths.py tests/test_woolworths.py
git commit -m "feat: add Woolworths White Monster scraper"
```

---

### Task 2: Coles Scraper

**Files:**
- Create: `scrapers/coles.py`
- Test: `tests/test_coles.py`

**Interfaces:**
- Consumes: nothing from Task 1 — same shape, independent store.
- Produces: `scrapers.coles.search_white_monster() -> list[dict]`, identical shape to `scrapers.woolworths.search_white_monster`. Raises `RuntimeError` on failure.
- Produces: `scrapers.coles._extract_products(data: dict) -> list[dict]` — pure function, used internally and by tests.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_coles.py
from scrapers.coles import _extract_products


def test_extract_products_finds_matching_white_monster():
    data = {"pageProps": {"searchResults": {"results": [
        {"name": "Monster Energy Ultra White 500mL", "pricing": {"now": 3.5}, "_links": {"self": {"href": "/product/monster-ultra-white-500ml"}}},
        {"name": "Monster Energy Original 500mL", "pricing": {"now": 3.2}, "_links": {"self": {"href": "/product/monster-original-500ml"}}},
    ]}}}
    result = _extract_products(data)
    assert len(result) == 1
    assert result[0]["name"] == "Monster Energy Ultra White 500mL"
    assert result[0]["price"] == 3.5
    assert result[0]["url"] == "https://www.coles.com.au/product/monster-ultra-white-500ml"


def test_extract_products_returns_empty_list_when_no_match():
    data = {"pageProps": {"searchResults": {"results": [
        {"name": "Monster Energy Original 500mL", "pricing": {"now": 3.2}, "_links": {"self": {"href": "/product/monster-original-500ml"}}},
    ]}}}
    assert _extract_products(data) == []


def test_extract_products_skips_items_with_non_numeric_price():
    data = {"pageProps": {"searchResults": {"results": [
        {"name": "Monster Ultra White 500mL", "pricing": {"now": None}, "_links": {"self": {"href": "/product/x"}}},
    ]}}}
    assert _extract_products(data) == []


def test_extract_products_returns_all_matching_pack_sizes():
    data = {"pageProps": {"searchResults": {"results": [
        {"name": "Monster Ultra White 500mL", "pricing": {"now": 3.5}, "_links": {"self": {"href": "/product/a"}}},
        {"name": "Monster Ultra White 4pk 500mL", "pricing": {"now": 12.0}, "_links": {"self": {"href": "/product/b"}}},
    ]}}}
    result = _extract_products(data)
    assert len(result) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_coles.py -v`
Expected: FAIL with `ImportError` / `ModuleNotFoundError` (`scrapers.coles` doesn't exist yet)

- [ ] **Step 3: Implement the scraper**

```python
# scrapers/coles.py
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_coles.py -v`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Manually verify against the live site**

Run:
```bash
python -c "from scrapers.coles import search_white_monster; import json; print(json.dumps(search_white_monster(), indent=2))"
```

Expected: a non-empty list with at least one product whose name contains
"white" and a plausible price.

If it raises `RuntimeError` or returns an empty list unexpectedly, the
guessed URL pattern (`_next/data` + `search`) or JSON field names don't
match reality — Coles' bot protection (Imperva/Incapsula) may also be
blocking the request outright, which is an acceptable known limitation
per the spec, but confirm which case it is: temporarily
`print(page.url)` after `goto` and `print(captured)` to see whether any
matching response was captured at all, and if one was, print its raw
shape and adjust `_extract_products` (and its tests) to match. Remove
debug prints before committing. If the site is blocking the request
outright (no matching response ever captured, or a non-200 status on
the main page load), note this in the commit message — that's a known
risk documented in the spec, not a bug to keep chasing.

- [ ] **Step 6: Commit**

```bash
git add scrapers/coles.py tests/test_coles.py
git commit -m "feat: add Coles White Monster scraper"
```

---

### Task 3: Flask App — Combine Both Scrapers

**Files:**
- Create: `app.py`
- Test: `tests/test_app.py`

**Interfaces:**
- Consumes: `scrapers.woolworths.search_white_monster()` from Task 1, `scrapers.coles.search_white_monster()` from Task 2.
- Produces: Flask app object `app` (importable from `app.py`) with route `GET /api/prices` returning JSON:
  ```json
  {
    "woolworths": {"status": "ok", "products": [{"name": "...", "price": 0.0, "url": "..."}]},
    "coles": {"status": "error", "message": "..."}
  }
  ```

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_app.py
from unittest.mock import patch
from app import app


def test_get_prices_combines_both_stores_successfully():
    with patch(
        "app.woolworths.search_white_monster",
        return_value=[{"name": "Monster Ultra White 500mL", "price": 3.5, "url": "https://example.com/a"}],
    ), patch(
        "app.coles.search_white_monster",
        return_value=[{"name": "Monster Energy Ultra White 500mL", "price": 3.2, "url": "https://example.com/b"}],
    ):
        client = app.test_client()
        response = client.get("/api/prices")
        data = response.get_json()

    assert response.status_code == 200
    assert data["woolworths"]["status"] == "ok"
    assert data["woolworths"]["products"][0]["price"] == 3.5
    assert data["coles"]["status"] == "ok"
    assert data["coles"]["products"][0]["price"] == 3.2


def test_get_prices_reports_per_store_error_without_failing_whole_request():
    with patch(
        "app.woolworths.search_white_monster",
        return_value=[{"name": "Monster Ultra White 500mL", "price": 3.5, "url": "https://example.com/a"}],
    ), patch(
        "app.coles.search_white_monster",
        side_effect=RuntimeError("blocked"),
    ):
        client = app.test_client()
        response = client.get("/api/prices")
        data = response.get_json()

    assert response.status_code == 200
    assert data["woolworths"]["status"] == "ok"
    assert data["coles"]["status"] == "error"
    assert data["coles"]["message"] == "blocked"


def test_get_prices_passes_through_multiple_products_without_truncating():
    two_products = [
        {"name": "Monster Ultra White 500mL", "price": 3.5, "url": "https://example.com/a"},
        {"name": "Monster Ultra White 4pk 500mL", "price": 12.0, "url": "https://example.com/b"},
    ]
    with patch("app.woolworths.search_white_monster", return_value=two_products), patch(
        "app.coles.search_white_monster", return_value=[]
    ):
        client = app.test_client()
        response = client.get("/api/prices")
        data = response.get_json()

    assert len(data["woolworths"]["products"]) == 2
    assert data["coles"]["status"] == "ok"
    assert data["coles"]["products"] == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_app.py -v`
Expected: FAIL with `ModuleNotFoundError` (`app` doesn't exist yet)

- [ ] **Step 3: Implement the Flask app**

```python
# app.py
from concurrent.futures import ThreadPoolExecutor

from flask import Flask, jsonify

from scrapers import woolworths, coles

app = Flask(__name__)


def _run_scraper(name, fn):
    try:
        return name, {"status": "ok", "products": fn()}
    except Exception as exc:
        return name, {"status": "error", "message": str(exc)}


@app.get("/api/prices")
def get_prices():
    scrapers = {
        "woolworths": woolworths.search_white_monster,
        "coles": coles.search_white_monster,
    }
    results = {}
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(_run_scraper, name, fn) for name, fn in scrapers.items()]
        for future in futures:
            name, result = future.result()
            results[name] = result
    return jsonify(results)


if __name__ == "__main__":
    app.run(debug=True)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_app.py -v`
Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add app.py tests/test_app.py
git commit -m "feat: add /api/prices endpoint combining both scrapers"
```

---

### Task 4: Frontend Page

**Files:**
- Create: `static/index.html`
- Modify: `app.py` (serve the static page)

**Interfaces:**
- Consumes: `GET /api/prices` from Task 3, exact JSON shape documented there.
- Produces: `GET /` serving `static/index.html`.

- [ ] **Step 1: Create the frontend page**

```html
<!-- static/index.html -->
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>White Monster Price Checker</title>
  <style>
    body { font-family: sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
    button { font-size: 1rem; padding: 0.5rem 1rem; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
    th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #ddd; }
    .error { color: #b00020; }
    .loading { color: #666; }
  </style>
</head>
<body>
  <h1>White Monster Price Checker</h1>
  <button id="check-btn">Check Prices</button>
  <p id="status"></p>
  <table id="results" hidden>
    <thead>
      <tr><th>Store</th><th>Product</th><th>Price</th><th></th></tr>
    </thead>
    <tbody id="results-body"></tbody>
  </table>

  <script>
    const STORE_LABELS = { woolworths: "Woolworths", coles: "Coles" };

    const btn = document.getElementById("check-btn");
    const status = document.getElementById("status");
    const table = document.getElementById("results");
    const body = document.getElementById("results-body");

    btn.addEventListener("click", checkPrices);

    async function checkPrices() {
      btn.disabled = true;
      status.textContent = "Checking prices...";
      status.className = "loading";
      table.hidden = true;
      body.innerHTML = "";

      try {
        const response = await fetch("/api/prices");
        const data = await response.json();
        renderResults(data);
        status.textContent = "";
      } catch (err) {
        status.textContent = "Failed to reach the server: " + err.message;
        status.className = "error";
      } finally {
        btn.disabled = false;
      }
    }

    function renderResults(data) {
      let rowCount = 0;
      for (const store of Object.keys(STORE_LABELS)) {
        const result = data[store];
        if (!result) continue;

        if (result.status === "error") {
          body.appendChild(row([STORE_LABELS[store], "unavailable (" + result.message + ")", "", ""]));
          rowCount++;
          continue;
        }

        if (result.products.length === 0) {
          body.appendChild(row([STORE_LABELS[store], "no matching product found", "", ""]));
          rowCount++;
          continue;
        }

        for (const product of result.products) {
          const tr = row([STORE_LABELS[store], product.name, "$" + product.price.toFixed(2)]);
          const linkCell = document.createElement("td");
          const link = document.createElement("a");
          link.href = product.url;
          link.target = "_blank";
          link.textContent = "view";
          linkCell.appendChild(link);
          tr.appendChild(linkCell);
          body.appendChild(tr);
          rowCount++;
        }
      }
      table.hidden = rowCount === 0;
    }

    function row(cells) {
      const tr = document.createElement("tr");
      for (const cell of cells) {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      }
      return tr;
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Wire up Flask to serve it**

In `app.py`, change:
```python
from flask import Flask, jsonify
```
to:
```python
from flask import Flask, jsonify, send_from_directory
```

Change:
```python
app = Flask(__name__)
```
to:
```python
app = Flask(__name__, static_folder="static", static_url_path="")
```

Add, after the `get_prices` function and before `if __name__ == "__main__":`:
```python
@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `pytest -v`
Expected: PASS (all 7 tests from Tasks 1–3 still pass)

- [ ] **Step 4: Manually verify the happy path**

Run `python app.py`, open `http://localhost:5000/` in a browser, click
"Check Prices". Expected: after a few seconds, a table appears with a
row per store showing a product name and price (or a per-store
"unavailable" / "no matching product found" message — both are valid
outcomes depending on what the live scrapers found).

- [ ] **Step 5: Manually verify the error and empty states**

Temporarily edit `scrapers/coles.py`'s `search_white_monster` to begin
with `raise RuntimeError("blocked")`, restart `python app.py`, click
"Check Prices", and confirm the Coles row shows `unavailable (blocked)`
while the Woolworths row still shows its normal result.

Then temporarily change it to `return []` instead, restart, click
again, and confirm the Coles row shows `no matching product found`.

Revert both temporary edits to `scrapers/coles.py` afterward — confirm
with `git diff scrapers/coles.py` that it's clean before committing.

- [ ] **Step 6: Manually verify the unreachable-backend case**

Stop the Flask server (Ctrl+C), reload `http://localhost:5000/` in the
browser (it will fail to load, or use a previously cached page), click
"Check Prices". Expected: the status text shows a "Failed to reach the
server" message and the button re-enables — it doesn't stay stuck on
"Checking prices...".

- [ ] **Step 7: Commit**

```bash
git add static/index.html app.py
git commit -m "feat: add frontend page for checking White Monster prices"
```
