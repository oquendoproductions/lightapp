import packageJson from "../package.json";

export const APP_VERSION = `v${String(packageJson?.version || "0.0.0").trim()}`;
