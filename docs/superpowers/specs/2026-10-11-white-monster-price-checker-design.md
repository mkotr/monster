# White Monster Price Checker — Design

## Purpose

A local web app that checks the current price of White Monster (Monster
Energy Ultra White) at Woolworths and Coles, on demand. The user opens
the app, clicks a button, and sees the current price at each store side
by side, so they know where it's cheaper before shopping.

## Scope

- Two stores: Woolworths and Coles (both Australian).
- One product: White Monster (Monster Energy Ultra White can).
- On-demand only — the user triggers a check manually; no scheduling,
  no history, no price alerts.
- Runs locally only (`python app.py`), not deployed anywhere.

Out of scope for this iteration: other stores, other products, price
history/charts, scheduled/background checks, notifications, proxies or
anti-bot evasion beyond a real headless browser session.

## Context: why scraping is non-trivial

Neither Woolworths nor Coles offers a public partner API. Both sites
sit behind bot-protection:

- **Woolworths** exposes a JSON search endpoint
  (`/apis/ui/Search/products`) but requires Akamai bot-protection
  cookies (`_abck`, `bm_sv`, `ak_bmsc`), which a plain HTTP request
  won't have.
- **Coles** sits behind Imperva/Incapsula, which blocks plain HTTP
  requests outright regardless of headers.

A real headless browser session (Playwright) picks up these cookies
and renders the page the same way a real visitor's browser would, so
it's used for both stores for consistency, even though Woolworths'
protection is lighter.

## Architecture

A local Flask app with two parts:

- A Python backend that does the scraping via Playwright.
- A single static HTML/JS page as the frontend.

No database and no persistence — every check is a fresh live lookup
against both stores.

## Components

- **`scrapers/woolworths.py`** — `search_white_monster()`: launches
  Playwright, navigates to Woolworths' search results for "monster
  ultra white", waits for results to render, extracts product name,
  price, and product URL for matches.
- **`scrapers/coles.py`** — same shape, same function name, against
  Coles' search results.
- **`app.py`** — Flask app with one route, `GET /api/prices`, which
  runs both scrapers concurrently (via threads, so one slow/blocked
  store doesn't double the wait) and returns JSON:
  ```json
  {
    "woolworths": {"status": "ok", "products": [{"name": "...", "price": 0.0, "url": "..."}]},
    "coles": {"status": "error", "message": "..."}
  }
  ```
- **`static/index.html`** — a "Check Prices" button, a loading
  indicator, and a results table (store, product name, price, link to
  product page).

## Data flow

User clicks the button → frontend calls `/api/prices` → backend runs
both scrapers concurrently → results (or per-store errors) come back
as JSON → frontend renders a table.

## Error handling

Each scraper is independent. If a store blocks the request, times out,
or the page layout no longer matches the expected selectors, that
store's entry comes back with `status: "error"` and a short message,
while the other store's result still displays normally. No retries and
no proxy rotation in this iteration — if a site blocks the request, the
UI just shows that store as unavailable.

## Testing

Scraping logic is network- and site-layout-dependent, so unit tests
against mocked HTML would pass while the real scraper silently breaks
against a real layout change — low value. Instead, verification is
manual: run each scraper against the live site and confirm it finds
the correct product and a plausible price. This is re-checked whenever
a scraper is modified.

## Setup

- Python dependencies: `flask`, `playwright`.
- One-time setup: `playwright install chromium` (downloads the
  headless browser binary).
- Run with `python app.py`, open `http://localhost:5000`.
