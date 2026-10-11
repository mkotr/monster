import { test, mock } from "node:test";
import assert from "node:assert/strict";

import { extractProducts, parseNextData, fetchViaRequests } from "../scrapers/coles.js";

test("extractProducts finds matching white monster", () => {
  const data = {
    pageProps: {
      searchResults: {
        results: [
          { id: 2787147, brand: "Monster", name: "Energy Ultra Can", size: "500mL", pricing: { now: 4.7 } },
          { id: 8593020, brand: "Monster", name: "Energy Ultra Violet Can", size: "500mL", pricing: { now: 4.7 } },
        ],
      },
    },
  };
  const result = extractProducts(data);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Monster Energy Ultra Can | 500mL");
  assert.equal(result[0].price, 4.7);
  assert.equal(result[0].url, "https://www.coles.com.au/product/monster-energy-ultra-can-500ml-2787147");
});

test("extractProducts returns empty list when no match", () => {
  const data = {
    pageProps: {
      searchResults: {
        results: [{ id: 8593020, brand: "Monster", name: "Energy Ultra Violet Can", size: "500mL", pricing: { now: 4.7 } }],
      },
    },
  };
  assert.deepEqual(extractProducts(data), []);
});

test("extractProducts skips items with non-numeric price", () => {
  const data = {
    pageProps: {
      searchResults: {
        results: [{ id: 2787147, brand: "Monster", name: "Energy Ultra Can", size: "500mL", pricing: { now: null } }],
      },
    },
  };
  assert.deepEqual(extractProducts(data), []);
});

test("extractProducts skips items with non-finite price", () => {
  const data = {
    pageProps: {
      searchResults: {
        results: [
          { id: 2787147, brand: "Monster", name: "Energy Ultra Can", size: "500mL", pricing: { now: NaN } },
          { id: 2785108, brand: "Monster", name: "Energy Drink Ultra 4x500ml", size: "2L", pricing: { now: Infinity } },
        ],
      },
    },
  };
  assert.deepEqual(extractProducts(data), []);
});

test("extractProducts returns all matching pack sizes", () => {
  const data = {
    pageProps: {
      searchResults: {
        results: [
          { id: 2787147, brand: "Monster", name: "Energy Ultra Can", size: "500mL", pricing: { now: 4.7 } },
          { id: 2785108, brand: "Monster", name: "Energy Drink Ultra 4x500ml", size: "2L", pricing: { now: 17.5 } },
        ],
      },
    },
  };
  const result = extractProducts(data);
  assert.equal(result.length, 2);
});

test("parseNextData extracts props for extractProducts", () => {
  const nextDataText = JSON.stringify({
    props: {
      pageProps: {
        searchResults: {
          results: [{ id: 2787147, brand: "Monster", name: "Energy Ultra Can", size: "500mL", pricing: { now: 4.7 } }],
        },
      },
    },
  });
  const props = parseNextData(nextDataText);
  const result = extractProducts(props);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Monster Energy Ultra Can | 500mL");
});

test("parseNextData returns empty object for invalid json", () => {
  assert.deepEqual(parseNextData("not json"), {});
});

test("parseNextData returns empty object for missing text", () => {
  assert.deepEqual(parseNextData(null), {});
  assert.deepEqual(parseNextData(""), {});
});

test("fetchViaRequests returns null on non-200", async (t) => {
  t.mock.method(global, "fetch", async () => ({ status: 403, text: async () => "blocked" }));
  const result = await fetchViaRequests();
  assert.equal(result, null);
});

test("fetchViaRequests returns null when __NEXT_DATA__ missing", async (t) => {
  t.mock.method(global, "fetch", async () => ({
    status: 200,
    text: async () => "<html><body>Incapsula challenge, no next data</body></html>",
  }));
  const result = await fetchViaRequests();
  assert.equal(result, null);
});

test("fetchViaRequests returns null on fetch rejection", async (t) => {
  t.mock.method(global, "fetch", async () => {
    throw new Error("connection error");
  });
  const result = await fetchViaRequests();
  assert.equal(result, null);
});

test("fetchViaRequests returns parsed props when __NEXT_DATA__ present", async (t) => {
  const nextDataJson = JSON.stringify({
    props: {
      pageProps: {
        searchResults: {
          results: [{ id: 2787147, brand: "Monster", name: "Energy Ultra Can", size: "500mL", pricing: { now: 4.7 } }],
        },
      },
    },
  });
  const html = `<html><body><script id="__NEXT_DATA__" type="application/json">${nextDataJson}</script></body></html>`;
  t.mock.method(global, "fetch", async () => ({ status: 200, text: async () => html }));
  const props = await fetchViaRequests();
  const result = extractProducts(props);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Monster Energy Ultra Can | 500mL");
});
