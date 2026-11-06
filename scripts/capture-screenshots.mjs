// ============================================================
// scripts/capture-screenshots.mjs
//
// Takes the README screenshots of the FalconEye dashboard with Playwright,
// on a phone-sized viewport:
//
//   dashboard.png                   overview: throughput, summary stats, request
//                                   log and a DB timing breakdown
//   dashboard-error.png             an error request (404) opened, errors counted
//   dashboard-connection-lost.png   the metrics endpoint unreachable: the page
//                                   keeps its last data and says it lost the server
//
// Run by .github/workflows/screenshots.yml, which installs Playwright
// next to this script and starts the demo (server, traffic generator and
// dashboard) first. Config comes from the environment:
//
//   DASHBOARD_URL   dashboard to open   (default http://localhost:4173)
//   OUT_DIR         where PNGs go       (default ./docs/images)
// ============================================================

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const URL_ = process.env.DASHBOARD_URL ?? "http://localhost:4173";
const OUT = process.env.OUT_DIR ?? "docs/images";

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
  reducedMotion: "reduce",
});
const page = await context.newPage();

const shot = async (name) => {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log("saved", file);
};

try {
  console.log("opening", URL_);
  await page.goto(URL_, { waitUntil: "domcontentloaded" });

  // The request log fills in once the first poll returns data.
  await page.waitForFunction(() => document.querySelectorAll("button").length >= 8, null, {
    timeout: 120_000,
  });

  // The sparkline is derived from successive polls (every 3 s); give it some history.
  await page.waitForTimeout(24_000);

  // 1. Overview, with a database-backed request's timing breakdown open.
  await page.locator("button", { hasText: "/api/todos/:id" }).first().click();
  await page.waitForTimeout(1_000);
  await shot("dashboard.png");

  // 2. An error request: the demo's traffic includes lookups that 404.
  await page.locator("button", { hasText: "404" }).first().click({ timeout: 60_000 });
  await page.waitForTimeout(1_000);
  await shot("dashboard-error.png");

  // 3. Connection lost: refuse the next polls, wait for two of them to fail.
  await page.route("**/api/metrics", (route) => route.abort());
  await page.getByText("connection lost").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1_000);
  await shot("dashboard-connection-lost.png");
} catch (error) {
  // Keep a picture of whatever the page showed, to debug from.
  await page.screenshot({ path: path.join(OUT, "_debug-failure.png"), fullPage: true });
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
