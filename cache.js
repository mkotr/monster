import { readFile, writeFile } from "node:fs/promises";

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isFreshToday(entry, today) {
  return Boolean(entry) && entry.date === today;
}

export function mergeCacheUpdates(cache, updates, today, fetchedAt) {
  const merged = { ...cache };
  for (const [name, products] of Object.entries(updates)) {
    merged[name] = { date: today, fetchedAt, products };
  }
  return merged;
}

export function freshEntries(cache, today) {
  const result = {};
  for (const [name, entry] of Object.entries(cache)) {
    if (isFreshToday(entry, today)) {
      result[name] = { status: "ok", products: entry.products, checkedAt: entry.fetchedAt };
    }
  }
  return result;
}

export async function readCache(cachePath) {
  try {
    const text = await readFile(cachePath, "utf-8");
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function writeCache(cachePath, cache) {
  await writeFile(cachePath, JSON.stringify(cache, null, 2));
}
