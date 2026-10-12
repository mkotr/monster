import { test } from "node:test";
import assert from "node:assert/strict";

import { extractProducts } from "../scrapers/woolworths.js";

test("extractProducts finds matching white monster", () => {
  const data = {
    Products: [
      {
        Products: [
          { Name: "Monster Energy Ultra Can", DisplayName: "Monster Energy Ultra Can 500mL", Price: 4.7, Stockcode: 489787 },
          { Name: "Monster Energy Drink Ultra Violet Can", DisplayName: "Monster Energy Drink Ultra Violet Can 500mL", Price: 4.7, Stockcode: 919631 },
        ],
      },
    ],
  };
  const result = extractProducts(data);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Monster Energy Ultra Can 500mL");
  assert.equal(result[0].price, 4.7);
  assert.ok(result[0].url.endsWith("/489787"));
});

test("extractProducts returns empty list when no match", () => {
  const data = {
    Products: [
      { Products: [{ Name: "Monster Energy Drink Ultra Violet Can", Price: 4.7, Stockcode: 919631 }] },
    ],
  };
  assert.deepEqual(extractProducts(data), []);
});

test("extractProducts skips items with non-numeric price", () => {
  const data = {
    Products: [
      { Products: [{ Name: "Monster Energy Ultra Can", Price: "N/A", Stockcode: 489787 }] },
    ],
  };
  assert.deepEqual(extractProducts(data), []);
});

test("extractProducts skips items with non-finite price", () => {
  const data = {
    Products: [
      {
        Products: [
          { Name: "Monster Energy Ultra Can", Price: NaN, Stockcode: 489787 },
          { Name: "Monster Energy Ultra Cans", Price: Infinity, Stockcode: 511504 },
        ],
      },
    ],
  };
  assert.deepEqual(extractProducts(data), []);
});

test("extractProducts returns all matching pack sizes", () => {
  const data = {
    Products: [
      {
        Products: [
          { Name: "Monster Energy Ultra Can", Price: 4.7, Stockcode: 489787 },
          { Name: "Monster Energy Ultra Cans", DisplayName: "Monster Energy Ultra Cans 500mL x 4 pack", Price: 17.5, Stockcode: 511504 },
        ],
      },
    ],
  };
  const result = extractProducts(data);
  assert.equal(result.length, 2);
});
