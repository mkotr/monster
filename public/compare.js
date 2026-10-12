const STORE_LABELS = { woolworths: "Woolworths", coles: "Coles" };

// Checked in order: multi-pack patterns before the plain single-unit
// pattern, so e.g. "500mL x 4 pack" resolves to 2000, not 500.
const VOLUME_PATTERNS = [
  // "4x500ml", "4 x 500 mL"
  { re: /(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*ml/i, calc: (m) => Number(m[1]) * Number(m[2]) },
  // "500mL x 4 pack", "500ml x 4"
  { re: /(\d+(?:\.\d+)?)\s*ml\s*x\s*(\d+)/i, calc: (m) => Number(m[1]) * Number(m[2]) },
  // "2L", "1.5L" - not part of "mL"
  { re: /(?<!m)(\d+(?:\.\d+)?)\s*l\b/i, calc: (m) => Number(m[1]) * 1000 },
  // "500mL"
  { re: /(\d+(?:\.\d+)?)\s*ml\b/i, calc: (m) => Number(m[1]) },
];

export function parseVolumeMl(name) {
  if (!name) return null;
  for (const { re, calc } of VOLUME_PATTERNS) {
    const match = name.match(re);
    if (match) {
      const value = calc(match);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
}

export function formatVolumeLabel(volumeMl) {
  if (volumeMl >= 1000) {
    const litres = volumeMl / 1000;
    const formatted = Number.isInteger(litres) ? String(litres) : litres.toFixed(1);
    return `${formatted} L`;
  }
  return `${volumeMl} mL`;
}

export function buildComparisonRows(data) {
  const groups = new Map();
  const unmatched = [];

  for (const store of Object.keys(STORE_LABELS)) {
    const result = data[store];
    if (!result || result.status !== "ok") continue;

    for (const product of result.products) {
      const entry = { name: product.name, price: product.price, url: product.url };
      const volumeMl = parseVolumeMl(product.name);

      if (volumeMl === null) {
        unmatched.push({
          volumeMl: null,
          stores: { woolworths: null, coles: null, [store]: entry },
        });
        continue;
      }

      if (!groups.has(volumeMl)) {
        groups.set(volumeMl, { volumeMl, stores: { woolworths: null, coles: null } });
      }
      groups.get(volumeMl).stores[store] = entry;
    }
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) => a.volumeMl - b.volumeMl);
  return [...sortedGroups, ...unmatched];
}

export function storeNotices(data) {
  const notices = [];
  for (const store of Object.keys(STORE_LABELS)) {
    const result = data[store];
    if (!result) continue;
    if (result.status === "error") {
      notices.push(`${STORE_LABELS[store]}: unavailable (${result.message})`);
    } else if (result.products.length === 0) {
      notices.push(`${STORE_LABELS[store]}: no matching product found`);
    }
  }
  return notices;
}
