#!/usr/bin/env node

import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);

function getFlag(name, defaultValue = "") {
  const index = args.indexOf(name);
  if (index < 0) return defaultValue;
  return args[index + 1] ?? defaultValue;
}

function hasFlag(name) {
  return args.includes(name);
}

const targetUrl = args.find((arg) => !arg.startsWith("--")) || getFlag("--url", "");
const waitMs = Number(getFlag("--wait-ms", "7000")) || 7000;
const timeoutMs = Number(getFlag("--timeout-ms", "45000")) || 45000;
const outputPath = getFlag("--output", "");

if (!targetUrl) {
  console.error("Usage: node scripts/smoke/check_pages_startup.mjs <url> [--wait-ms 7000] [--timeout-ms 45000] [--output file.json]");
  process.exit(1);
}

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
      // keep checking
    }
  }
  return "";
}

function summarizeError(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack || value.message || String(value);
  return String(value);
}

const executablePath = await findExecutablePath();

if (!executablePath) {
  console.error("No supported browser executable found for startup smoke.");
  process.exit(2);
}

let browser;
let page;
const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
let navigationError = "";

try {
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
    ],
  });

  page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    consoleErrors.push({
      type: message.type(),
      text: message.text(),
      location: message.location(),
    });
  });

  page.on("pageerror", (error) => {
    pageErrors.push({
      message: summarizeError(error),
    });
  });

  page.on("requestfailed", (request) => {
    const resourceType = request.resourceType();
    if (!["document", "script", "stylesheet", "fetch", "xhr"].includes(resourceType)) return;
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      resourceType,
      failureText: request.failure()?.errorText || "",
    });
  });

  try {
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
  } catch (error) {
    navigationError = summarizeError(error);
  }

  await page.waitForTimeout(waitMs);

  const state = await page.evaluate(() => {
    const bodyText = String(document.body?.innerText || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);
    const root = document.querySelector("#root");
    return {
      documentTitle: document.title,
      bodyText,
      bodyChildCount: document.body?.childElementCount ?? 0,
      rootChildCount: root?.childElementCount ?? 0,
      readyState: document.readyState,
      href: window.location.href,
    };
  });

  const summary = {
    ok:
      !navigationError
      && pageErrors.length === 0
      && consoleErrors.length === 0
      && (state.rootChildCount > 0 || state.bodyText.length > 0),
    targetUrl,
    executablePath,
    waitMs,
    timeoutMs,
    navigationError,
    pageErrors,
    consoleErrors,
    requestFailures,
    state,
    checkedAt: new Date().toISOString(),
  };

  if (outputPath) {
    const resolvedOutputPath = path.resolve(outputPath);
    await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
    await fs.writeFile(resolvedOutputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(summary.ok ? 0 : 1);
} catch (error) {
  const message = summarizeError(error);
  const summary = {
    ok: false,
    skipped: true,
    targetUrl,
    executablePath,
    waitMs,
    timeoutMs,
    browserLaunchError: message,
    checkedAt: new Date().toISOString(),
  };
  if (outputPath) {
    const resolvedOutputPath = path.resolve(outputPath);
    await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
    await fs.writeFile(resolvedOutputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(2);
} finally {
  if (page) {
    await page.close().catch(() => {});
  }
  if (browser) {
    await browser.close().catch(() => {});
  }
}
