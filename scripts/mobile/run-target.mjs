import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const TARGET_PRESETS = {
  map: {
    appId: "cityreport.io.map",
    appName: "CityReport.io",
    appScope: "map",
    authRedirectUrl: "cityreport://auth/callback",
  },
  hub: {
    appId: "cityreport.io.hub",
    appName: "CityReport Hub",
    appScope: "hub",
    authRedirectUrl: "cityreporthub://auth/callback",
  },
};

const VALID_ACTIONS = new Set(["prepare", "open"]);
const VALID_PLATFORMS = new Set(["ios", "android"]);
const ROOT_DIR = process.cwd();
const IOS_INFO_PLIST_PATH = path.join(ROOT_DIR, "ios", "App", "App", "Info.plist");
const IOS_PROJECT_PATH = path.join(ROOT_DIR, "ios", "App", "App.xcodeproj", "project.pbxproj");
const ANDROID_BUILD_GRADLE_PATH = path.join(ROOT_DIR, "android", "app", "build.gradle");
const ANDROID_MANIFEST_PATH = path.join(ROOT_DIR, "android", "app", "src", "main", "AndroidManifest.xml");
const ANDROID_STRINGS_PATH = path.join(ROOT_DIR, "android", "app", "src", "main", "res", "values", "strings.xml");
const ANDROID_JAVA_ROOT = path.join(ROOT_DIR, "android", "app", "src", "main", "java");
const DEFAULT_CALLBACK_HOST = "auth";
const DEFAULT_CALLBACK_PATH_PREFIX = "/callback";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function normalizeTarget(rawTarget) {
  const target = String(rawTarget || "")
    .trim()
    .toLowerCase();
  if (!TARGET_PRESETS[target]) {
    fail(`Unknown mobile target: ${rawTarget || "(empty)"}`);
  }
  return target;
}

function normalizeAction(rawAction) {
  const action = String(rawAction || "")
    .trim()
    .toLowerCase();
  if (!VALID_ACTIONS.has(action)) {
    fail(`Unknown mobile action: ${rawAction || "(empty)"}`);
  }
  return action;
}

function normalizePlatform(rawPlatform) {
  const platform = String(rawPlatform || "")
    .trim()
    .toLowerCase();
  if (!platform) return "";
  if (!VALID_PLATFORMS.has(platform)) {
    fail(`Unknown mobile platform: ${rawPlatform}`);
  }
  return platform;
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function readText(filePath) {
  return readFileSync(filePath, "utf8");
}

function writeText(filePath, value) {
  writeFileSync(filePath, value, "utf8");
}

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    fail(`Unable to update ${label}.`);
  }
  return source.replace(pattern, replacement);
}

function getUrlScheme(authRedirectUrl) {
  const match = String(authRedirectUrl || "").trim().match(/^([a-z][a-z0-9+.-]*):\/\//i);
  return match?.[1] || "";
}

function getAuthCallbackParts(authRedirectUrl) {
  try {
    const parsed = new URL(String(authRedirectUrl || "").trim());
    return {
      scheme: parsed.protocol.replace(/:$/, ""),
      host: parsed.hostname || DEFAULT_CALLBACK_HOST,
      pathPrefix: parsed.pathname || DEFAULT_CALLBACK_PATH_PREFIX,
    };
  } catch {
    return {
      scheme: getUrlScheme(authRedirectUrl),
      host: DEFAULT_CALLBACK_HOST,
      pathPrefix: DEFAULT_CALLBACK_PATH_PREFIX,
    };
  }
}

function buildEnv(preset, target) {
  return {
    ...process.env,
    CITYREPORT_APP_TARGET: target,
    CITYREPORT_APP_ID: preset.appId,
    CITYREPORT_APP_NAME: preset.appName,
    VITE_NATIVE_APP_SCOPE: preset.appScope,
    VITE_NATIVE_AUTH_REDIRECT_URL: preset.authRedirectUrl,
  };
}

function ensurePlatform(platform, env) {
  const platformDir = path.join(ROOT_DIR, platform);
  if (!existsSync(platformDir)) {
    run("npx", ["cap", "add", platform], env);
  }
}

function findMainActivityPath() {
  const stack = [ANDROID_JAVA_ROOT];
  while (stack.length) {
    const current = stack.pop();
    if (!current || !existsSync(current)) continue;
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (entry.isFile() && entry.name === "MainActivity.java") {
        return nextPath;
      }
    }
  }
  fail("Unable to locate Android MainActivity.java.");
}

function removeEmptyParentDirs(startPath, stopPath) {
  let current = startPath;
  while (current.startsWith(stopPath) && current !== stopPath) {
    const entries = readdirSync(current);
    if (entries.length) break;
    rmSync(current, { recursive: true, force: true });
    current = path.dirname(current);
  }
}

function ensureAndroidMainActivityPackage(appId) {
  const desiredPackage = String(appId || "").trim();
  const currentPath = findMainActivityPath();
  const currentContents = readText(currentPath);
  const updatedContents = replaceRequired(
    currentContents,
    /^package\s+[\w.]+;/m,
    `package ${desiredPackage};`,
    "Android MainActivity package declaration"
  );
  const relativeDir = desiredPackage.split(".").join(path.sep);
  const targetDir = path.join(ANDROID_JAVA_ROOT, relativeDir);
  const targetPath = path.join(targetDir, "MainActivity.java");
  mkdirSync(targetDir, { recursive: true });
  if (currentPath !== targetPath) {
    renameSync(currentPath, targetPath);
    removeEmptyParentDirs(path.dirname(currentPath), ANDROID_JAVA_ROOT);
  }
  writeText(targetPath, updatedContents);
}

function updateAndroidProject(preset) {
  const callback = getAuthCallbackParts(preset.authRedirectUrl);

  let buildGradle = readText(ANDROID_BUILD_GRADLE_PATH);
  buildGradle = replaceRequired(
    buildGradle,
    /namespace\s*=\s*"[^"]+"/,
    `namespace = "${preset.appId}"`,
    "Android namespace"
  );
  buildGradle = replaceRequired(
    buildGradle,
    /applicationId\s+"[^"]+"/,
    `applicationId "${preset.appId}"`,
    "Android applicationId"
  );
  writeText(ANDROID_BUILD_GRADLE_PATH, buildGradle);

  let stringsXml = readText(ANDROID_STRINGS_PATH);
  stringsXml = replaceRequired(
    stringsXml,
    /<string name="app_name">[^<]*<\/string>/,
    `<string name="app_name">${preset.appName}</string>`,
    "Android app_name"
  );
  stringsXml = replaceRequired(
    stringsXml,
    /<string name="title_activity_main">[^<]*<\/string>/,
    `<string name="title_activity_main">${preset.appName}</string>`,
    "Android title_activity_main"
  );
  stringsXml = replaceRequired(
    stringsXml,
    /<string name="package_name">[^<]*<\/string>/,
    `<string name="package_name">${preset.appId}</string>`,
    "Android package_name"
  );
  stringsXml = replaceRequired(
    stringsXml,
    /<string name="custom_url_scheme">[^<]*<\/string>/,
    `<string name="custom_url_scheme">${callback.scheme}</string>`,
    "Android custom_url_scheme"
  );
  writeText(ANDROID_STRINGS_PATH, stringsXml);

  const deepLinkIntentFilter = `
            <!-- CityReport auth callback -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data
                    android:scheme="${callback.scheme}"
                    android:host="${callback.host}"
                    android:pathPrefix="${callback.pathPrefix}" />
            </intent-filter>
`;

  let manifestXml = readText(ANDROID_MANIFEST_PATH);
  manifestXml = manifestXml.replace(/\n\s*<!-- CityReport auth callback -->[\s\S]*?<\/intent-filter>\n/g, "\n");
  manifestXml = replaceRequired(
    manifestXml,
    /(\s*<intent-filter>\s*<action android:name="android\.intent\.action\.MAIN" \/>[\s\S]*?<\/intent-filter>\s*)/,
    `$1${deepLinkIntentFilter}`,
    "Android auth callback intent-filter"
  );
  writeText(ANDROID_MANIFEST_PATH, manifestXml);

  ensureAndroidMainActivityPackage(preset.appId);
}

function updateIosProject(preset) {
  const callback = getAuthCallbackParts(preset.authRedirectUrl);

  let projectFile = readText(IOS_PROJECT_PATH);
  projectFile = replaceRequired(
    projectFile,
    /PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g,
    `PRODUCT_BUNDLE_IDENTIFIER = ${preset.appId};`,
    "iOS bundle identifier"
  );
  writeText(IOS_PROJECT_PATH, projectFile);

  let infoPlist = readText(IOS_INFO_PLIST_PATH);
  infoPlist = replaceRequired(
    infoPlist,
    /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
    `<key>CFBundleDisplayName</key>\n        <string>${preset.appName}</string>`,
    "iOS display name"
  );
  const urlTypesBlock = `
\t<key>CFBundleURLTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>CFBundleURLName</key>
\t\t\t<string>${preset.appId}.auth</string>
\t\t\t<key>CFBundleURLSchemes</key>
\t\t\t<array>
\t\t\t\t<string>${callback.scheme}</string>
\t\t\t</array>
\t\t</dict>
\t</array>`;
  infoPlist = replaceRequired(
    infoPlist,
    /(<key>UIViewControllerBasedStatusBarAppearance<\/key>\s*<true\/>)[\s\S]*?<\/plist>/,
    `$1${urlTypesBlock}\n</dict>\n</plist>`,
    "iOS auth callback block"
  );
  writeText(IOS_INFO_PLIST_PATH, infoPlist);
}

function syncNativeMetadata(target) {
  const preset = TARGET_PRESETS[target];
  if (!preset) fail(`Unable to sync metadata for unknown target: ${target}`);
  if (existsSync(path.join(ROOT_DIR, "android"))) {
    updateAndroidProject(preset);
  }
  if (existsSync(path.join(ROOT_DIR, "ios"))) {
    updateIosProject(preset);
  }
}

function prepareTarget(target, platform, env) {
  run("npx", ["vite", "build"], env);
  if (platform) {
    ensurePlatform(platform, env);
    run("npx", ["cap", "sync", platform], env);
    syncNativeMetadata(target);
    return;
  }
  ensurePlatform("ios", env);
  ensurePlatform("android", env);
  run("npx", ["cap", "sync"], env);
  syncNativeMetadata(target);
}

function openTarget(target, platform, env) {
  if (!platform) fail("Open requires a platform: ios or android.");
  ensurePlatform(platform, env);
  syncNativeMetadata(target);
  run("npx", ["cap", "open", platform], env);
}

const target = normalizeTarget(process.argv[2]);
const action = normalizeAction(process.argv[3]);
const platform = normalizePlatform(process.argv[4]);
const preset = TARGET_PRESETS[target];
const env = buildEnv(preset, target);

if (action === "prepare") {
  prepareTarget(target, platform, env);
} else if (action === "open") {
  openTarget(target, platform, env);
}
