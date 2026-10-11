import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import * as woolworths from "./scrapers/woolworths.js";
import * as coles from "./scrapers/coles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
} = {}) {
  const app = express();
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/prices", async (req, res) => {
    const scrapers = { woolworths: woolworthsSearch, coles: colesSearch };
    const entries = await Promise.all(
      Object.entries(scrapers).map(([name, fn]) => runScraper(name, fn)),
    );
    res.json(Object.fromEntries(entries));
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
