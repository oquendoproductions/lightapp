import fs from "node:fs";
import path from "node:path";
import {
  MAP_UI_ICON_KEYS,
  MAP_UI_NOTICE_ICON_KEYS,
  MAP_UI_REQUIRED_ICON_KEYS,
  MAP_UI_ICON_SURFACE_REQUIREMENTS,
  validateMapUiIconCatalog,
} from "../src/mapUiIconCatalog.js";

const rootDir = path.resolve(import.meta.dirname, "..");
const mapSurfaceSourcePaths = [
  path.join(rootDir, "src", "MapGoogleFull.jsx"),
  path.join(rootDir, "src", "mapLazyMobileChrome.jsx"),
  path.join(rootDir, "src", "mapLazyInfoPanels.jsx"),
  path.join(rootDir, "src", "lib", "mapUserLocationOverlay.jsx"),
];
const sourceEntries = mapSurfaceSourcePaths.map((filePath) => ({
  filePath,
  source: fs.readFileSync(filePath, "utf8"),
}));
const combinedSource = sourceEntries.map((entry) => entry.source).join("\n");
const issues = [...validateMapUiIconCatalog()];

const catalogKeySet = new Set(MAP_UI_ICON_KEYS);
const noticeIconKeySet = new Set(MAP_UI_NOTICE_ICON_KEYS);
const requiredKeySet = new Set(MAP_UI_REQUIRED_ICON_KEYS);
const staticIconKeys = new Set();
const staticIconKeyPattern = /iconKey\s*[:=]\s*["'`]([^"'`]+)["'`]/g;

for (const { source } of sourceEntries) {
  for (const match of source.matchAll(staticIconKeyPattern)) {
    const key = String(match[1] || "").trim();
    if (key) staticIconKeys.add(key);
  }
}

for (const key of staticIconKeys) {
  if (!catalogKeySet.has(key)) {
    issues.push(`Map surface source uses iconKey "${key}" but MAP_UI_ICON_CATALOG does not define it.`);
  }
}

for (const key of requiredKeySet) {
  if (noticeIconKeySet.has(key)) continue;
  if (
    !combinedSource.includes(`"${key}"`) &&
    !combinedSource.includes(`'${key}'`) &&
    !combinedSource.includes(`\`${key}\``)
  ) {
    issues.push(`Required map UI icon key "${key}" is not referenced in the scanned map surface modules. If a new surface replaced it, update MAP_UI_ICON_SURFACE_REQUIREMENTS.`);
  }
}

for (const [groupName, requiredKeys] of Object.entries(MAP_UI_ICON_SURFACE_REQUIREMENTS)) {
  const duplicates = requiredKeys.filter((key, index) => requiredKeys.indexOf(key) !== index);
  if (duplicates.length) {
    issues.push(`Duplicate keys in MAP_UI_ICON_SURFACE_REQUIREMENTS.${groupName}: ${duplicates.join(", ")}.`);
  }
}

if (issues.length) {
  console.error("Map UI icon validation failed:\n");
  issues.forEach((issue) => {
    console.error(`- ${issue}`);
  });
  process.exit(1);
}

console.log("Map UI icon validation passed.");
