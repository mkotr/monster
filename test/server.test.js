import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createApp } from "../server.js";
import { todayKey } from "../cache.js";

function todayStr() {
  return todayKey();
}

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

async function withTempCachePath(run) {
  const dir = await mkdtemp(path.join(tmpdir(), "monster-cache-"));
  try {
    return await run(path.join(dir, "cache.json"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("GET /api/prices combines both stores successfully", async () => {
  await withTempCachePath(async (cachePath) => {
    const app = createApp({
      woolworthsSearch: async () => [
        { name: "Monster Ultra White 500mL", price: 3.5, url: "https://example.com/a" },
      ],
      colesSearch: async () => [
        { name: "Monster Energy Ultra White 500mL", price: 3.2, url: "https://example.com/b" },
      ],
      cachePath,
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
});

test("GET /api/prices reports per-store error without failing whole request", async () => {
  await withTempCachePath(async (cachePath) => {
    const app = createApp({
      woolworthsSearch: async () => [
        { name: "Monster Ultra White 500mL", price: 3.5, url: "https://example.com/a" },
      ],
      colesSearch: async () => {
        throw new Error("blocked");
      },
      cachePath,
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
});

test("GET /api/prices passes through multiple products without truncating", async () => {
  await withTempCachePath(async (cachePath) => {
    const twoProducts = [
      { name: "Monster Ultra White 500mL", price: 3.5, url: "https://example.com/a" },
      { name: "Monster Ultra White 4pk 500mL", price: 12.0, url: "https://example.com/b" },
    ];
    const app = createApp({
      woolworthsSearch: async () => twoProducts,
      colesSearch: async () => [],
      cachePath,
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/prices`);
      const data = await response.json();

      assert.equal(data.woolworths.products.length, 2);
      assert.equal(data.coles.status, "ok");
      assert.deepEqual(data.coles.products, []);
    });
  });
});

test("GET /api/prices includes a checkedAt timestamp for successful results", async () => {
  await withTempCachePath(async (cachePath) => {
    const app = createApp({
      woolworthsSearch: async () => [
        { name: "Monster Ultra White 500mL", price: 3.5, url: "https://example.com/a" },
      ],
      colesSearch: async () => [],
      cachePath,
    });

    await withServer(app, async (baseUrl) => {
      const data = await (await fetch(`${baseUrl}/api/prices`)).json();
      assert.ok(data.woolworths.checkedAt);
      assert.ok(!Number.isNaN(Date.parse(data.woolworths.checkedAt)));
    });
  });
});

test("GET /api/prices reuses the cached checkedAt on a cache hit", async () => {
  await withTempCachePath(async (cachePath) => {
    const app = createApp({
      woolworthsSearch: async () => [
        { name: "Monster Ultra White 500mL", price: 3.5, url: "https://example.com/a" },
      ],
      colesSearch: async () => [],
      cachePath,
    });

    await withServer(app, async (baseUrl) => {
      const first = await (await fetch(`${baseUrl}/api/prices`)).json();
      const second = await (await fetch(`${baseUrl}/api/prices`)).json();
      assert.equal(second.woolworths.checkedAt, first.woolworths.checkedAt);
    });
  });
});

test("GET /api/prices caches a successful result and skips re-scraping the same day", async () => {
  await withTempCachePath(async (cachePath) => {
    let woolworthsCalls = 0;
    const app = createApp({
      woolworthsSearch: async () => {
        woolworthsCalls++;
        return [{ name: "Monster Ultra White 500mL", price: 3.5, url: "https://example.com/a" }];
      },
      colesSearch: async () => [],
      cachePath,
    });

    await withServer(app, async (baseUrl) => {
      const first = await (await fetch(`${baseUrl}/api/prices`)).json();
      const second = await (await fetch(`${baseUrl}/api/prices`)).json();
      assert.deepEqual(second.woolworths, first.woolworths);
    });

    assert.equal(woolworthsCalls, 1);
  });
});

test("GET /api/prices does not cache an errored store and retries it next request", async () => {
  await withTempCachePath(async (cachePath) => {
    let colesCalls = 0;
    const app = createApp({
      woolworthsSearch: async () => [],
      colesSearch: async () => {
        colesCalls++;
        throw new Error("blocked");
      },
      cachePath,
    });

    await withServer(app, async (baseUrl) => {
      await fetch(`${baseUrl}/api/prices`);
      await fetch(`${baseUrl}/api/prices`);
    });

    assert.equal(colesCalls, 2);
  });
});

test("GET /api/prices ignores a cached entry from a previous day", async () => {
  await withTempCachePath(async (cachePath) => {
    await writeFile(
      cachePath,
      JSON.stringify({
        woolworths: { date: "2000-01-01", products: [{ name: "stale", price: 0, url: "https://example.com/stale" }] },
      }),
    );
    let calls = 0;
    const app = createApp({
      woolworthsSearch: async () => {
        calls++;
        return [{ name: "fresh", price: 1, url: "https://example.com/fresh" }];
      },
      colesSearch: async () => [],
      cachePath,
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/prices`);
      const data = await response.json();
      assert.equal(data.woolworths.products[0].name, "fresh");
    });

    assert.equal(calls, 1);
  });
});

test("GET /api/prices/cached returns today's cached entries without scraping", async () => {
  await withTempCachePath(async (cachePath) => {
    await writeFile(
      cachePath,
      JSON.stringify({
        woolworths: {
          date: todayStr(),
          fetchedAt: "2026-10-12T03:00:00.000Z",
          products: [{ name: "Monster Ultra White 500mL", price: 3.5, url: "https://example.com/a" }],
        },
      }),
    );
    let woolworthsCalls = 0;
    let colesCalls = 0;
    const app = createApp({
      woolworthsSearch: async () => {
        woolworthsCalls++;
        return [];
      },
      colesSearch: async () => {
        colesCalls++;
        return [];
      },
      cachePath,
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/prices/cached`);
      const data = await response.json();
      assert.equal(response.status, 200);
      assert.equal(data.woolworths.status, "ok");
      assert.equal(data.woolworths.products[0].name, "Monster Ultra White 500mL");
      assert.equal(data.coles, undefined);
    });

    assert.equal(woolworthsCalls, 0);
    assert.equal(colesCalls, 0);
  });
});

test("GET /api/prices/cached returns an empty object when nothing is cached", async () => {
  await withTempCachePath(async (cachePath) => {
    const app = createApp({ cachePath });
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/prices/cached`);
      const data = await response.json();
      assert.deepEqual(data, {});
    });
  });
});

test("GET / serves the frontend page", async () => {
  await withTempCachePath(async (cachePath) => {
    const app = createApp({ cachePath });
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/`);
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.ok(body.includes("White Monster Price Checker"));
    });
  });
});
