import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { todayKey, isFreshToday, mergeCacheUpdates, readCache, writeCache, freshEntries } from "../cache.js";

test("todayKey formats a date as YYYY-MM-DD", () => {
  assert.equal(todayKey(new Date(2026, 0, 5)), "2026-01-05");
});

test("todayKey pads single-digit month and day", () => {
  assert.equal(todayKey(new Date(2026, 8, 3)), "2026-09-03");
});

test("isFreshToday is true when entry date matches today", () => {
  assert.equal(isFreshToday({ date: "2026-10-12", products: [] }, "2026-10-12"), true);
});

test("isFreshToday is false when entry date differs from today", () => {
  assert.equal(isFreshToday({ date: "2026-10-11", products: [] }, "2026-10-12"), false);
});

test("isFreshToday is false when entry is missing", () => {
  assert.equal(isFreshToday(undefined, "2026-10-12"), false);
  assert.equal(isFreshToday(null, "2026-10-12"), false);
});

test("mergeCacheUpdates adds new entries with today's date and fetchedAt", () => {
  const result = mergeCacheUpdates(
    {},
    { woolworths: [{ name: "x", price: 1, url: "u" }] },
    "2026-10-12",
    "2026-10-12T03:42:00.000Z",
  );
  assert.deepEqual(result, {
    woolworths: {
      date: "2026-10-12",
      fetchedAt: "2026-10-12T03:42:00.000Z",
      products: [{ name: "x", price: 1, url: "u" }],
    },
  });
});

test("mergeCacheUpdates preserves untouched existing entries", () => {
  const existing = {
    coles: { date: "2026-10-12", fetchedAt: "2026-10-12T01:00:00.000Z", products: [{ name: "c", price: 2, url: "u2" }] },
  };
  const result = mergeCacheUpdates(
    existing,
    { woolworths: [{ name: "w", price: 1, url: "u1" }] },
    "2026-10-12",
    "2026-10-12T03:42:00.000Z",
  );
  assert.deepEqual(result.coles, existing.coles);
  assert.deepEqual(result.woolworths, {
    date: "2026-10-12",
    fetchedAt: "2026-10-12T03:42:00.000Z",
    products: [{ name: "w", price: 1, url: "u1" }],
  });
});

test("mergeCacheUpdates overwrites an existing entry for the same store", () => {
  const existing = {
    woolworths: { date: "2026-10-11", fetchedAt: "2026-10-11T01:00:00.000Z", products: [{ name: "old", price: 1, url: "u" }] },
  };
  const result = mergeCacheUpdates(
    existing,
    { woolworths: [{ name: "new", price: 2, url: "u2" }] },
    "2026-10-12",
    "2026-10-12T03:42:00.000Z",
  );
  assert.deepEqual(result.woolworths, {
    date: "2026-10-12",
    fetchedAt: "2026-10-12T03:42:00.000Z",
    products: [{ name: "new", price: 2, url: "u2" }],
  });
});

test("freshEntries returns only entries dated today, mapped to API shape", () => {
  const cache = {
    woolworths: { date: "2026-10-12", fetchedAt: "2026-10-12T03:00:00.000Z", products: [{ name: "w", price: 1, url: "u1" }] },
    coles: { date: "2026-10-11", fetchedAt: "2026-10-11T03:00:00.000Z", products: [{ name: "c", price: 2, url: "u2" }] },
  };
  const result = freshEntries(cache, "2026-10-12");
  assert.deepEqual(result, {
    woolworths: {
      status: "ok",
      products: [{ name: "w", price: 1, url: "u1" }],
      checkedAt: "2026-10-12T03:00:00.000Z",
    },
  });
});

test("freshEntries returns an empty object when nothing is cached for today", () => {
  assert.deepEqual(freshEntries({}, "2026-10-12"), {});
});

test("readCache returns an empty object when the file does not exist", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "monster-cache-"));
  try {
    const result = await readCache(path.join(dir, "missing.json"));
    assert.deepEqual(result, {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readCache returns an empty object for invalid JSON", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "monster-cache-"));
  const file = path.join(dir, "cache.json");
  try {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, "not json");
    const result = await readCache(file);
    assert.deepEqual(result, {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writeCache then readCache round-trips the data", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "monster-cache-"));
  const file = path.join(dir, "cache.json");
  try {
    const data = { woolworths: { date: "2026-10-12", products: [{ name: "x", price: 1, url: "u" }] } };
    await writeCache(file, data);
    const result = await readCache(file);
    assert.deepEqual(result, data);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
