#!/usr/bin/env node

import { chromium } from "playwright-core";
import fs from "node:fs/promises";

const targetUrl = process.argv[2] || "https://testcity.cityreport.io";

const chromeCandidates = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
];

async function findExecutablePath() {
  for (const candidate of chromeCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Keep checking.
    }
  }
  throw new Error("No supported browser executable found.");
}

function summarizeError(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack || value.message || String(value);
  return String(value);
}

const executablePath = await findExecutablePath();
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
  ],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const consoleMessages = [];
const pageErrors = [];
const httpErrors = [];

page.on("console", (message) => {
  consoleMessages.push({
    type: message.type(),
    text: message.text(),
    location: message.location(),
  });
});

page.on("pageerror", (error) => {
  pageErrors.push({ message: summarizeError(error) });
});

page.on("response", async (response) => {
  const status = response.status();
  if (status < 400) return;
  const url = response.url();
  if (!/supabase|googleapis|cityreport\.io|lightapp-ak2\.pages\.dev/i.test(url)) return;
  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "";
  }
  httpErrors.push({
    status,
    url,
    body: body.slice(0, 500),
  });
});

async function maybeClickText(text) {
  const locator = page.getByText(text, { exact: true });
  const count = await locator.count();
  if (count !== 1) return false;
  await locator.click();
  return true;
}

async function settle(ms = 2500) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(ms);
}

try {
  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await settle(6000);

  await maybeClickText("Continue").catch(() => false);
  await settle(2500);

  const initialState = await page.evaluate(() => ({
    title: document.title,
    href: window.location.href,
    bodyText: String(document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 500),
  }));

  const reportsClicked = await maybeClickText("Reports").catch(() => false);
  await settle(2500);

  const streetlightsClicked = await maybeClickText("Streetlights").catch(() => false);
  await settle(2500);

  const incidentsInView = await page.evaluate(() => {
    const text = String(document.body?.innerText || "");
    const match = text.match(/Incidents in view:\s*(\d+)/i);
    return match ? Number(match[1]) : null;
  });

  const markerCandidates = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("[aria-label], button, div"));
    return nodes
      .map((node) => ({
        text: String(node.textContent || "").trim(),
        ariaLabel: String(node.getAttribute("aria-label") || "").trim(),
      }))
      .filter((row) => /streetlight|incident|pothole|sign|marker/i.test(`${row.text} ${row.ariaLabel}`))
      .slice(0, 20);
  });

  const summary = {
    targetUrl,
    initialState,
    reportsClicked,
    streetlightsClicked,
    incidentsInView,
    markerCandidates,
    pageErrors,
    consoleMessages: consoleMessages.filter((entry) => ["error", "warn"].includes(entry.type)),
    httpErrors,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
}
