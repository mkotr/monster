import { test } from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../server.js";

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    return await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET /api/prices combines both stores successfully", async () => {
  const app = createApp({
    woolworthsSearch: async () => [
      { name: "Monster Ultra White 500mL", price: 3.5, url: "https://example.com/a" },
    ],
    colesSearch: async () => [
      { name: "Monster Energy Ultra White 500mL", price: 3.2, url: "https://example.com/b" },
    ],
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/prices`);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.woolworths.status, "ok");
    assert.equal(data.woolworths.products[0].price, 3.5);
    assert.equal(data.coles.status, "ok");
    assert.equal(data.coles.products[0].price, 3.2);
  });
});

test("GET /api/prices reports per-store error without failing whole request", async () => {
  const app = createApp({
    woolworthsSearch: async () => [
      { name: "Monster Ultra White 500mL", price: 3.5, url: "https://example.com/a" },
    ],
    colesSearch: async () => {
      throw new Error("blocked");
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/prices`);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.woolworths.status, "ok");
    assert.equal(data.coles.status, "error");
    assert.equal(data.coles.message, "blocked");
  });
});

test("GET /api/prices passes through multiple products without truncating", async () => {
  const twoProducts = [
    { name: "Monster Ultra White 500mL", price: 3.5, url: "https://example.com/a" },
    { name: "Monster Ultra White 4pk 500mL", price: 12.0, url: "https://example.com/b" },
  ];
  const app = createApp({
    woolworthsSearch: async () => twoProducts,
    colesSearch: async () => [],
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/prices`);
    const data = await response.json();

    assert.equal(data.woolworths.products.length, 2);
    assert.equal(data.coles.status, "ok");
    assert.deepEqual(data.coles.products, []);
  });
});

test("GET / serves the frontend page", async () => {
  const app = createApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.ok(body.includes("White Monster Price Checker"));
  });
});
