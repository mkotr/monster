import { test } from "node:test";
import assert from "node:assert/strict";

import { errors } from "playwright";
const { TimeoutError } = errors;
import { gotoAndWait } from "../scrapers/playwrightUtils.js";

function makePage({ gotoRejects = false, waitRejects = false } = {}) {
  const calls = { goto: [] };
  return {
    calls,
    async goto(url, options) {
      calls.goto.push([url, options]);
      if (gotoRejects) throw new TimeoutError("timed out");
    },
    async waitForLoadState(state, options) {
      if (waitRejects) throw new TimeoutError("timed out");
    },
  };
}

test("gotoAndWait tolerates a networkidle timeout after navigating", async () => {
  const page = makePage({ waitRejects: true });
  await gotoAndWait(page, "https://example.com", 1000);
  assert.deepEqual(page.calls.goto[0], [
    "https://example.com",
    { waitUntil: "domcontentloaded", timeout: 1000 },
  ]);
});

test("gotoAndWait does not swallow a navigation timeout", async () => {
  const page = makePage({ gotoRejects: true });
  await assert.rejects(
    () => gotoAndWait(page, "https://example.com", 1000),
    TimeoutError,
  );
});
