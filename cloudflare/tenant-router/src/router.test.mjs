import assert from "node:assert/strict";
import test from "node:test";

import { buildUnknownTenantSlugEvent, resolveTenantRequest } from "./router.js";

test("apex root resolves marketing home", () => {
  const res = resolveTenantRequest({ hostname: "cityreport.io", pathname: "/", search: "" });
  assert.equal(res.mode, "marketing_home");
  assert.equal(res.tenantKey, null);
});

test("apex /platform resolves platform admin", () => {
  const res = resolveTenantRequest({ hostname: "cityreport.io", pathname: "/platform", search: "" });
  assert.equal(res.mode, "platform_admin");
});

test("assets host is passthrough and not tenant-resolved", () => {
  const res = resolveTenantRequest({ hostname: "assets.cityreport.io", pathname: "/index.js", search: "" });
  assert.equal(res.mode, "marketing_home");
  assert.equal(res.tenantKey, null);
  assert.equal(res.reason, "passthrough_host");
});

test("apex static assets are passthrough and not tenant redirects", () => {
  const js = resolveTenantRequest({ hostname: "cityreport.io", pathname: "/assets/index-abc123.js", search: "" });
  assert.equal(js.mode, "marketing_home");
  assert.equal(js.redirectTo, null);

  const icon = resolveTenantRequest({ hostname: "cityreport.io", pathname: "/favicon.ico", search: "" });
  assert.equal(icon.mode, "marketing_home");
  assert.equal(icon.redirectTo, null);
});

test("apex legal path stays on apex for static legal page serving", () => {
  const res = resolveTenantRequest({ hostname: "cityreport.io", pathname: "/legal/terms.html", search: "" });
  assert.equal(res.mode, "marketing_home");
  assert.equal(res.redirectTo, null);
  assert.equal(res.reason, "apex_legal_passthrough");
});

test("apex slug redirects to canonical subdomain", () => {
  const res = resolveTenantRequest(
    {
      hostname: "cityreport.io",
      pathname: "/ashtabulacity/reports",
      search: "?tab=open",
    },
    {
      knownTenantKeys: new Set(["ashtabulacity"]),
    },
  );
  assert.equal(res.mode, "redirect");
  assert.equal(res.tenantKey, "ashtabulacity");
  assert.equal(res.redirectTo, "https://ashtabulacity.cityreport.io/hub/reports?tab=open");
});

test("apex unknown tenant slug returns not found when known tenant set is provided", () => {
  const res = resolveTenantRequest(
    {
      hostname: "cityreport.io",
      pathname: "/unknowncity/reports",
      search: "",
    },
    {
      knownTenantKeys: new Set(["ashtabulacity"]),
    },
  );
  assert.equal(res.mode, "not_found");
  assert.equal(res.reason, "apex_unknown_slug");
  assert.equal(res.unknownSlug, "unknowncity");
});

test("subdomain root serves public map scope", () => {
  const res = resolveTenantRequest(
    {
      hostname: "testcity1.cityreport.io",
      pathname: "/",
      search: "",
    },
    {
      knownTenantKeys: new Set(["testcity1"]),
    },
  );
  assert.equal(res.mode, "municipality_app");
  assert.equal(res.tenantKey, "testcity1");
  assert.equal(res.appScope, "map");
});

test("subdomain hub path serves hub scope", () => {
  const res = resolveTenantRequest(
    {
      hostname: "testcity1.cityreport.io",
      pathname: "/hub/reports",
      search: "",
    },
    {
      knownTenantKeys: new Set(["testcity1"]),
    },
  );
  assert.equal(res.mode, "municipality_app");
  assert.equal(res.tenantKey, "testcity1");
  assert.equal(res.appScope, "hub");
});

test("unknown subdomain returns not found when known tenant set is provided", () => {
  const res = resolveTenantRequest(
    {
      hostname: "unknowncity.cityreport.io",
      pathname: "/",
      search: "",
    },
    {
      knownTenantKeys: new Set(["ashtabulacity"]),
    },
  );
  assert.equal(res.mode, "not_found");
  assert.equal(res.reason, "unknown_subdomain_slug");
  assert.equal(res.unknownSlug, "unknowncity");
});

test("legacy /gmaps redirects to tenant root", () => {
  const res = resolveTenantRequest({
    hostname: "testcity1.cityreport.io",
    pathname: "/gmaps",
    search: "",
  });
  assert.equal(res.mode, "redirect");
  assert.equal(res.redirectTo, "https://testcity1.cityreport.io/");
});

test("dev legacy hub path redirects into the hub namespace in staging", () => {
  const res = resolveTenantRequest(
    {
      hostname: "dev.cityreport.io",
      pathname: "/testcity1/reports",
      search: "",
    },
    {
      knownTenantKeys: new Set(["testcity1"]),
    },
  );
  assert.equal(res.mode, "redirect");
  assert.equal(res.env, "staging");
  assert.equal(res.tenantKey, "testcity1");
  assert.equal(res.redirectTo, "https://dev.cityreport.io/testcity1/hub/reports");
});

test("reserved slug subdomain returns not found + event", () => {
  const res = resolveTenantRequest({
    hostname: "platform.cityreport.io",
    pathname: "/",
    search: "",
  });
  assert.equal(res.mode, "not_found");
  const event = buildUnknownTenantSlugEvent(res, {
    hostname: "platform.cityreport.io",
    pathname: "/",
  });
  assert.equal(event.slug, "platform");
});

test("defaults tenant key for unknown host /gmaps", () => {
  const res = resolveTenantRequest(
    {
      hostname: "preview.anything.com",
      pathname: "/gmaps",
      search: "",
    },
    { defaultTenant: "ashtabulacity" },
  );
  assert.equal(res.mode, "redirect");
  assert.equal(res.redirectTo, "https://ashtabulacity.cityreport.io/");
});
