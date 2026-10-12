import { chromium } from "playwright";

import { gotoAndWait } from "./playwrightUtils.js";
import { isWhiteMonster } from "./productMatching.js";

export const SEARCH_URL = "https://www.woolworths.com.au/shop/search/products?searchTerm=monster+ultra+white";
const SEARCH_API_PATTERN = "/apis/ui/Search/products";

export function extractProducts(data) {
  const products = [];
  const bundles = data.Bundles || data.Products || [];
  for (const bundle of bundles) {
    for (const item of bundle.Products || []) {
      const name = item.DisplayName || item.Name;
      const rawPrice = item.Price;
      const stockcode = item.Stockcode;
      if (!name || rawPrice === null || rawPrice === undefined) continue;
      if (!isWhiteMonster(name)) continue;
      const price = Number(rawPrice);
      if (Number.isNaN(price) || !Number.isFinite(price)) continue;
      products.push({
        name,
        price,
        url: stockcode
          ? `https://www.woolworths.com.au/shop/productdetails/${stockcode}`
          : SEARCH_URL,
      });
    }
  }
  return products;
}

export async function searchWhiteMonster() {
  let captured;

  const browser = await chromium.launch({ headless: false });
  try {
    const page = await browser.newPage();
    page.on("response", async (response) => {
      if (response.url().includes(SEARCH_API_PATTERN) && response.status() === 200) {
        try {
          captured = await response.json();
        } catch {
          // ignore non-JSON responses
        }
      }
    });
    await gotoAndWait(page, SEARCH_URL, 30000);
  } finally {
    await browser.close();
  }

  if (captured === undefined) {
    throw new Error("Woolworths search did not return product data (possibly blocked)");
  }

  return extractProducts(captured);
}
