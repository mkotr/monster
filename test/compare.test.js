import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseVolumeMl,
  formatVolumeLabel,
  costPerLitre,
  buildComparisonRows,
  findBestDeal,
  storeNotices,
} from "../public/compare.js";

test("parseVolumeMl reads a plain mL size", () => {
  assert.equal(parseVolumeMl("Monster Energy Ultra Can 500mL"), 500);
});

test("parseVolumeMl reads a plain L size", () => {
  assert.equal(parseVolumeMl("Monster Energy Cans Ultra 6x250ml | 1.5L"), 1500);
});

test("parseVolumeMl reads a count-x-size mL pack (count first)", () => {
  assert.equal(parseVolumeMl("Monster Energy Drink Ultra 4x500ml | 2L"), 2000);
});

test("parseVolumeMl reads a size-x-count mL pack (size first)", () => {
  assert.equal(parseVolumeMl("Monster Energy Ultra Cans 500mL x 4 pack"), 2000);
});

test("parseVolumeMl reads the Coles single-can format", () => {
  assert.equal(parseVolumeMl("Monster Energy Ultra Can | 500mL"), 500);
});

test("parseVolumeMl returns null when no volume is mentioned", () => {
  assert.equal(parseVolumeMl("Ultra Pro Card Deck Box (White)"), null);
});

test("parseVolumeMl returns null for empty or missing input", () => {
  assert.equal(parseVolumeMl(""), null);
  assert.equal(parseVolumeMl(null), null);
  assert.equal(parseVolumeMl(undefined), null);
});

test("formatVolumeLabel formats whole litres", () => {
  assert.equal(formatVolumeLabel(2000), "2 L");
});

test("formatVolumeLabel formats fractional litres", () => {
  assert.equal(formatVolumeLabel(1500), "1.5 L");
});

test("formatVolumeLabel formats sub-litre volumes as mL", () => {
  assert.equal(formatVolumeLabel(500), "500 mL");
});

test("costPerLitre computes dollars per litre for a sub-litre volume", () => {
  assert.equal(costPerLitre(4.7, 500), 9.4);
});

test("costPerLitre computes dollars per litre for a multi-litre volume", () => {
  assert.equal(costPerLitre(68.5, 12000), Math.round((68.5 / 12) * 100) / 100);
});

test("costPerLitre returns null when volume is null or zero", () => {
  assert.equal(costPerLitre(4.7, null), null);
  assert.equal(costPerLitre(4.7, 0), null);
});

test("buildComparisonRows groups matching volumes from both stores into one row", () => {
  const data = {
    woolworths: {
      status: "ok",
      checkedAt: "2026-10-12T09:00:00.000Z",
      products: [
        { name: "Monster Energy Ultra Can 500mL", price: 4.7, url: "https://ww/a" },
        { name: "Monster Energy Ultra Cans 500mL x 4 pack", price: 17.5, url: "https://ww/b" },
      ],
    },
    coles: {
      status: "ok",
      checkedAt: "2026-10-12T09:05:00.000Z",
      products: [
        { name: "Monster Energy Ultra Can | 500mL", price: 4.7, url: "https://coles/a" },
        { name: "Monster Energy Drink Ultra 4x500ml | 2L", price: 17.5, url: "https://coles/b" },
        { name: "Monster Energy Cans Ultra 6x250ml | 1.5L", price: 15.0, url: "https://coles/c" },
      ],
    },
  };

  const rows = buildComparisonRows(data);

  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.volumeMl), [500, 1500, 2000]);

  const row500 = rows[0];
  assert.equal(row500.stores.woolworths.price, 4.7);
  assert.equal(row500.stores.coles.price, 4.7);

  const row1500 = rows[1];
  assert.equal(row1500.stores.woolworths, null);
  assert.equal(row1500.stores.coles.price, 15.0);

  const row2000 = rows[2];
  assert.equal(row2000.stores.woolworths.price, 17.5);
  assert.equal(row2000.stores.coles.price, 17.5);
});

test("buildComparisonRows groups a third store's products alongside the other two", () => {
  const data = {
    woolworths: {
      status: "ok",
      checkedAt: "x",
      products: [{ name: "Monster Energy Ultra Can 500mL", price: 4.7, url: "https://ww/a" }],
    },
    coles: {
      status: "ok",
      checkedAt: "x",
      products: [{ name: "Monster Energy Ultra Can | 500mL", price: 4.7, url: "https://coles/a" }],
    },
    amazon: {
      status: "ok",
      checkedAt: "x",
      products: [
        { name: "Monster Ultra White Energy Drink Pack 4 x 500ml", price: 26.0, url: "https://amazon/a" },
        { name: "Monster Energy Drink Zero Ultra 24 x 500ml", price: 68.5, url: "https://amazon/b" },
      ],
    },
  };

  const rows = buildComparisonRows(data);

  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.volumeMl), [500, 2000, 12000]);

  const row500 = rows[0];
  assert.equal(row500.stores.woolworths.price, 4.7);
  assert.equal(row500.stores.coles.price, 4.7);
  assert.equal(row500.stores.amazon, null);

  const row2000 = rows[1];
  assert.equal(row2000.stores.woolworths, null);
  assert.equal(row2000.stores.coles, null);
  assert.equal(row2000.stores.amazon.price, 26.0);

  const row12000 = rows[2];
  assert.equal(row12000.stores.woolworths, null);
  assert.equal(row12000.stores.amazon.price, 68.5);
});

test("buildComparisonRows ignores a store with error or empty status", () => {
  const data = {
    woolworths: {
      status: "ok",
      checkedAt: "2026-10-12T09:00:00.000Z",
      products: [{ name: "Monster Energy Ultra Can 500mL", price: 4.7, url: "https://ww/a" }],
    },
    coles: { status: "error", message: "blocked" },
  };

  const rows = buildComparisonRows(data);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stores.coles, null);
});

test("buildComparisonRows places unparseable products in their own row at the end", () => {
  const data = {
    woolworths: {
      status: "ok",
      checkedAt: "2026-10-12T09:00:00.000Z",
      products: [
        { name: "Monster Energy Ultra Can 500mL", price: 4.7, url: "https://ww/a" },
        { name: "Mystery Monster Product", price: 9.99, url: "https://ww/mystery" },
      ],
    },
    coles: { status: "ok", checkedAt: "2026-10-12T09:05:00.000Z", products: [] },
  };

  const rows = buildComparisonRows(data);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].volumeMl, 500);
  assert.equal(rows[1].volumeMl, null);
  assert.equal(rows[1].stores.woolworths.name, "Mystery Monster Product");
  assert.equal(rows[1].stores.coles, null);
});

test("findBestDeal picks the lowest cost-per-litre across all rows and stores", () => {
  const rows = buildComparisonRows({
    woolworths: {
      status: "ok",
      checkedAt: "x",
      products: [{ name: "Monster Energy Ultra Can 500mL", price: 4.7, url: "https://ww/a" }],
    },
    coles: {
      status: "ok",
      checkedAt: "x",
      products: [{ name: "Monster Energy Drink Ultra 4x500ml | 2L", price: 17.5, url: "https://coles/a" }],
    },
    amazon: {
      status: "ok",
      checkedAt: "x",
      products: [{ name: "Monster Energy Drink Zero Ultra 24 x 500ml", price: 68.5, url: "https://amazon/a" }],
    },
  });

  const deal = findBestDeal(rows);
  assert.equal(deal.store, "amazon");
  assert.equal(deal.price, 68.5);
  assert.equal(deal.volumeMl, 12000);
  assert.equal(deal.perLitre, costPerLitre(68.5, 12000));
  assert.equal(deal.name, "Monster Energy Drink Zero Ultra 24 x 500ml");
  assert.equal(deal.url, "https://amazon/a");
});

test("findBestDeal ignores the unmatched Other row since volume is unknown", () => {
  const rows = buildComparisonRows({
    woolworths: {
      status: "ok",
      checkedAt: "x",
      products: [
        { name: "Mystery Monster Bundle", price: 0.5, url: "https://ww/mystery" },
        { name: "Monster Energy Ultra Can 500mL", price: 4.7, url: "https://ww/a" },
      ],
    },
  });

  const deal = findBestDeal(rows);
  assert.equal(deal.name, "Monster Energy Ultra Can 500mL");
});

test("findBestDeal breaks ties by earliest row then store order", () => {
  const rows = buildComparisonRows({
    woolworths: {
      status: "ok",
      checkedAt: "x",
      products: [{ name: "Monster Energy Ultra Can 500mL", price: 4.7, url: "https://ww/a" }],
    },
    coles: {
      status: "ok",
      checkedAt: "x",
      products: [{ name: "Monster Energy Ultra Can | 500mL", price: 4.7, url: "https://coles/a" }],
    },
  });

  const deal = findBestDeal(rows);
  assert.equal(deal.store, "woolworths");
});

test("findBestDeal returns null when there are no rows", () => {
  assert.equal(findBestDeal([]), null);
});

test("storeNotices reports an error message for a blocked store", () => {
  const data = {
    woolworths: { status: "ok", checkedAt: "x", products: [{ name: "a", price: 1, url: "u" }] },
    coles: { status: "error", message: "blocked" },
  };
  assert.deepEqual(storeNotices(data), ["Coles: unavailable (blocked)"]);
});

test("storeNotices reports no-match for a store with zero products", () => {
  const data = {
    woolworths: { status: "ok", checkedAt: "x", products: [] },
    coles: { status: "ok", checkedAt: "x", products: [{ name: "a", price: 1, url: "u" }] },
  };
  assert.deepEqual(storeNotices(data), ["Woolworths: no matching product found"]);
});

test("storeNotices returns an empty array when both stores succeed with results", () => {
  const data = {
    woolworths: { status: "ok", checkedAt: "x", products: [{ name: "a", price: 1, url: "u" }] },
    coles: { status: "ok", checkedAt: "x", products: [{ name: "b", price: 2, url: "u2" }] },
  };
  assert.deepEqual(storeNotices(data), []);
});
