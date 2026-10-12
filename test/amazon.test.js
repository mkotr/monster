import { test } from "node:test";
import assert from "node:assert/strict";

import { extractProducts, searchWhiteMonster, SEARCH_URL } from "../scrapers/amazon.js";

function card({ asin, alt, price, priceClass = "a-price" }) {
  const priceHtml = price
    ? `<span class="${priceClass}" data-a-size="xl"><span class="a-offscreen">$${price}</span></span>`
    : "";
  return `data-asin="${asin}" data-component-type="s-search-result"><div class="s-product-image-container"><img class="s-image" src="https://m.media-amazon.com/x.jpg" alt="${alt}" /></div><a href="/Some-Title/dp/${asin}/ref=sr_1_1">${priceHtml}</a>`;
}

test("extractProducts finds a matching product with its price and dp URL", () => {
  const html = card({ asin: "B07D89LCW6", alt: "Monster Energy Drink Zero Ultra 24 x 500ml", price: "68.50" });
  const result = extractProducts(html);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Monster Energy Drink Zero Ultra 24 x 500ml");
  assert.equal(result[0].price, 68.5);
  assert.equal(result[0].url, "https://www.amazon.com.au/dp/B07D89LCW6");
});

test("extractProducts skips flavoured and unrelated marketplace noise", () => {
  const html = [
    card({ asin: "A1", alt: "Monster Energy Drink Ultra Violet 24 x 500mL", price: "68.50" }),
    card({ asin: "A2", alt: "Ultra Monster Series 81 Tyrant", price: "15.00" }),
    card({ asin: "A3", alt: "BANDAI Ultraman Decker Ultra Kaiju Series 55 Micras", price: "9.99" }),
  ].join("");
  assert.deepEqual(extractProducts(html), []);
});

test("extractProducts decodes HTML entities in the name", () => {
  const html = card({
    asin: "B1",
    alt: "Monster Energy Ultra Bundle: Monster Zero Ultra 24pk &amp; Monster Ultra Rosa 24pk",
    price: "99.00",
  });
  // whole bundle is correctly rejected (contains "rosa"), proving entity decoding ran before matching
  assert.deepEqual(extractProducts(html), []);
});

test("extractProducts skips a matching item with no price found", () => {
  const html = card({ asin: "B2", alt: "Monster Energy Drink Zero Ultra 24 x 500ml", price: null });
  assert.deepEqual(extractProducts(html), []);
});

test("extractProducts ignores the smaller unit-price span and uses the main price", () => {
  const html =
    'data-asin="B3" data-component-type="s-search-result">' +
    '<img class="s-image" alt="Monster Energy Drink Zero Ultra 24 x 500ml" />' +
    '<span class="a-price" data-a-size="xl"><span class="a-offscreen">$68.50</span></span>' +
    '<span class="a-price a-text-price" data-a-size="b"><span class="a-offscreen">$2.85</span></span>';
  const result = extractProducts(html);
  assert.equal(result.length, 1);
  assert.equal(result[0].price, 68.5);
});

test("extractProducts de-duplicates repeated asins", () => {
  const single = card({ asin: "B4", alt: "Monster Energy Drink Zero Ultra 24 x 500ml", price: "68.50" });
  const html = single + single;
  const result = extractProducts(html);
  assert.equal(result.length, 1);
});

test("searchWhiteMonster throws when the response is not ok", async (t) => {
  t.mock.method(global, "fetch", async () => ({ status: 503, text: async () => "" }));
  await assert.rejects(() => searchWhiteMonster(), /possibly blocked/);
});

test("searchWhiteMonster throws when the page has no product cards", async (t) => {
  t.mock.method(global, "fetch", async () => ({
    status: 200,
    text: async () => "<html><body>Enter the characters you see below</body></html>",
  }));
  await assert.rejects(() => searchWhiteMonster(), /possibly blocked/);
});

test("searchWhiteMonster throws when fetch itself rejects", async (t) => {
  t.mock.method(global, "fetch", async () => {
    throw new Error("network down");
  });
  await assert.rejects(() => searchWhiteMonster(), /possibly blocked/);
});

test("searchWhiteMonster returns parsed products on success", async (t) => {
  const html = card({ asin: "B5", alt: "Monster Energy Drink Zero Ultra 24 x 500ml", price: "68.50" });
  t.mock.method(global, "fetch", async (url) => {
    assert.equal(url, SEARCH_URL);
    return { status: 200, text: async () => html };
  });
  const result = await searchWhiteMonster();
  assert.equal(result.length, 1);
  assert.equal(result[0].price, 68.5);
});
