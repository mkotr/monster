import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import * as woolworths from "./scrapers/woolworths.js";
import * as coles from "./scrapers/coles.js";
import * as amazon from "./scrapers/amazon.js";
import { readCache, writeCache, todayKey, isFreshToday, mergeCacheUpdates, freshEntries } from "./cache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CACHE_PATH = path.join(__dirname, "cache.json");

async function runScraper(name, fn) {
  try {
    const products = await fn();
    return [name, { status: "ok", products }];
  } catch (err) {
    return [name, { status: "error", message: err.message }];
  }
}

export function createApp({
  woolworthsSearch = woolworths.searchWhiteMonster,
  colesSearch = coles.searchWhiteMonster,
  amazonSearch = amazon.searchWhiteMonster,
  cachePath = DEFAULT_CACHE_PATH,
} = {}) {
  const app = express();
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/prices/cached", async (req, res) => {
    const today = todayKey();
    const cache = await readCache(cachePath);
    res.json(freshEntries(cache, today));
  });

  app.get("/api/prices", async (req, res) => {
    const today = todayKey();
    const fetchedAt = new Date().toISOString();
    const cache = await readCache(cachePath);
    const scrapers = { woolworths: woolworthsSearch, coles: colesSearch, amazon: amazonSearch };
    const results = {};
    const updates = {};

    await Promise.all(
      Object.entries(scrapers).map(async ([name, fn]) => {
        const cached = cache[name];
        if (isFreshToday(cached, today)) {
          results[name] = { status: "ok", products: cached.products, checkedAt: cached.fetchedAt };
          return;
        }
        const [, result] = await runScraper(name, fn);
        if (result.status === "ok") {
          result.checkedAt = fetchedAt;
          updates[name] = result.products;
        }
        results[name] = result;
      }),
    );

    if (Object.keys(updates).length > 0) {
      await writeCache(cachePath, mergeCacheUpdates(cache, updates, today, fetchedAt));
    }

    res.json(results);
  });

  return app;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const app = createApp();
  const port = 5000;
  app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
}
