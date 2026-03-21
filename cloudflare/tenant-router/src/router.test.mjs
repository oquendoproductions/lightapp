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

test("apex slug redirects to canonical subdomain", () => {
  const res = resolveTenantRequest({
    hostname: "cityreport.io",
    pathname: "/ashtabulacity/reports",
    search: "?tab=open",
  });
  assert.equal(res.mode, "redirect");
  assert.equal(res.tenantKey, "ashtabulacity");
  assert.equal(res.redirectTo, "https://ashtabulacity.cityreport.io/reports?tab=open");
});

test("subdomain serves municipality app", () => {
  const res = resolveTenantRequest({
    hostname: "testcity1.cityreport.io",
    pathname: "/",
    search: "",
  });
  assert.equal(res.mode, "municipality_app");
  assert.equal(res.tenantKey, "testcity1");
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

test("dev host path mode resolves municipality app in staging", () => {
  const res = resolveTenantRequest({
    hostname: "dev.cityreport.io",
    pathname: "/testcity1/reports",
    search: "",
  });
  assert.equal(res.mode, "municipality_app");
  assert.equal(res.env, "staging");
  assert.equal(res.tenantKey, "testcity1");
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
