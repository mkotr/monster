import { errors } from "playwright";

const { TimeoutError } = errors;

export async function gotoAndWait(page, url, timeout) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  try {
    await page.waitForLoadState("networkidle", { timeout });
  } catch (err) {
    if (!(err instanceof TimeoutError)) throw err;
  }
}
