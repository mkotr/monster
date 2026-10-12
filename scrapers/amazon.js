import { isWhiteMonster } from "./productMatching.js";

export const SEARCH_URL = "https://www.amazon.com.au/s?k=monster+ultra";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const CARD_START_PATTERN = /data-asin="([a-zA-Z0-9]+)"/g;
// The main listing price (data-a-size="xl"); excludes the smaller
// "a-price a-text-price" span used for the per-unit price breakdown.
const PRICE_PATTERN = /<span class="a-price"(?! a-text-price)[^>]*><span class="a-offscreen">([^<]*)<\/span>/;
const IMAGE_ALT_PATTERN = /<img class="s-image"[^>]*alt="([^"]*)"/;

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function extractProducts(html) {
  const products = [];
  const seenAsins = new Set();
  const starts = [...html.matchAll(CARD_START_PATTERN)];

  for (let i = 0; i < starts.length; i++) {
    const asin = starts[i][1];
    if (!asin || seenAsins.has(asin)) continue;
    seenAsins.add(asin);

    const blockStart = starts[i].index;
    const blockEnd = i + 1 < starts.length ? starts[i + 1].index : html.length;
    const block = html.slice(blockStart, blockEnd);

    const altMatch = IMAGE_ALT_PATTERN.exec(block);
    if (!altMatch) continue;
    const name = decodeHtmlEntities(altMatch[1]);
    if (!isWhiteMonster(name)) continue;

    const priceMatch = PRICE_PATTERN.exec(block);
    if (!priceMatch) continue;
    const price = Number(priceMatch[1].replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(price) || price <= 0) continue;

    products.push({
      name,
      price,
      url: `https://www.amazon.com.au/dp/${asin}`,
    });
  }

  return products;
}

export async function searchWhiteMonster() {
  let response;
  try {
    response = await fetch(SEARCH_URL, { headers: { "User-Agent": USER_AGENT } });
  } catch {
    throw new Error("Amazon search did not return product data (possibly blocked)");
  }

  if (response.status !== 200) {
    throw new Error("Amazon search did not return product data (possibly blocked)");
  }

  const html = await response.text();
  if (!html.includes("data-asin")) {
    throw new Error("Amazon search did not return product data (possibly blocked)");
  }

  return extractProducts(html);
}
