import { chromium } from "playwright";

import { gotoAndWait } from "./playwrightUtils.js";
import { isWhiteMonster } from "./productMatching.js";

export const SEARCH_URL = "https://www.coles.com.au/search/products?q=monster%20ultra%20white";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const NEXT_DATA_PATTERN = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function extractProducts(data) {
  const products = [];
  const results = data?.pageProps?.searchResults?.results || [];
  for (const item of results) {
    const name = item.name;
    if (!name) continue;
    const brand = item.brand || "";
    const size = item.size || "";
    let fullName = `${brand} ${name}`.trim();
    if (size) fullName = `${fullName} | ${size}`;
    if (!isWhiteMonster(fullName)) continue;
    const rawPrice = item.pricing?.now;
    if (rawPrice === null || rawPrice === undefined) continue;
    const price = Number(rawPrice);
    if (Number.isNaN(price) || !Number.isFinite(price)) continue;
    const productId = item.id;
    const url = productId
      ? `https://www.coles.com.au/product/${slugify(fullName)}-${productId}`
      : SEARCH_URL;
    products.push({ name: fullName, price, url });
  }
  return products;
}

export function parseNextData(text) {
  if (!text) return {};
  try {
    const data = JSON.parse(text);
    return data.props || {};
  } catch {
    return {};
  }
}

export async function fetchViaRequests() {
  let response;
  try {
    response = await fetch(SEARCH_URL, { headers: { "User-Agent": USER_AGENT } });
  } catch {
    return null;
  }
  if (response.status !== 200) return null;
  const text = await response.text();
  const match = NEXT_DATA_PATTERN.exec(text);
  if (!match) return null;
  return parseNextData(match[1]);
}

export async function searchWhiteMonster() {
  const fastPathData = await fetchViaRequests();
  if (fastPathData !== null) {
    return extractProducts(fastPathData);
  }

  let captured;

  const browser = await chromium.launch({ headless: false });
  try {
    const page = await browser.newPage();
    page.on("response", async (response) => {
      if (response.url().includes("_next/data") && response.url().includes("search") && response.status() === 200) {
        try {
          captured = await response.json();
        } catch {
          // ignore non-JSON responses
        }
      }
    });
    await gotoAndWait(page, SEARCH_URL, 30000);

    if (captured === undefined) {
      let nextDataText;
      try {
        nextDataText = await page.locator("#__NEXT_DATA__").textContent({ timeout: 5000 });
      } catch {
        nextDataText = null;
      }
      const props = parseNextData(nextDataText);
      if (Object.keys(props).length > 0) {
        captured = props;
      }
    }
  } finally {
    await browser.close();
  }

  if (captured === undefined) {
    throw new Error("Coles search did not return product data (possibly blocked)");
  }

  return extractProducts(captured);
}
