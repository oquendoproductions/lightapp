import test from "node:test";
import assert from "node:assert/strict";
import { resolveTenantRequest } from "./tenantResolver.js";

test("apex root resolves to marketing home", () => {
  const res = resolveTenantRequest({
    hostname: "cityreport.io",
    pathname: "/",
    search: "",
  });
  assert.equal(res.mode, "marketing_home");
  assert.equal(res.tenantKey, null);
});

test("apex platform route resolves to platform admin", () => {
  const res = resolveTenantRequest({
    hostname: "cityreport.io",
    pathname: "/platform",
    search: "",
  });
  assert.equal(res.mode, "platform_admin");
});

test("apex slug route redirects to municipality subdomain", () => {
  const res = resolveTenantRequest({
    hostname: "cityreport.io",
    pathname: "/ashtabulacity/reports",
    search: "?tab=open",
  });
  assert.equal(res.mode, "redirect");
  assert.equal(res.tenantKey, "ashtabulacity");
  assert.equal(res.redirectTo, "https://ashtabulacity.cityreport.io/hub/reports?tab=open");
});

test("municipality subdomain root resolves to public map", () => {
  const res = resolveTenantRequest({
    hostname: "ashtabulacity.cityreport.io",
    pathname: "/",
    search: "",
  });
  assert.equal(res.mode, "municipality_app");
  assert.equal(res.tenantKey, "ashtabulacity");
  assert.equal(res.env, "prod");
  assert.equal(res.appScope, "map");
});

test("dev slug hub path resolves to staging municipality hub", () => {
  const res = resolveTenantRequest({
    hostname: "dev.cityreport.io",
    pathname: "/ashtabulacity/hub/reports",
    search: "",
  });
  assert.equal(res.mode, "municipality_app");
  assert.equal(res.tenantKey, "ashtabulacity");
  assert.equal(res.env, "staging");
  assert.equal(res.appScope, "hub");
});

test("legacy gmaps path redirects to Ashtabula during transition", () => {
  const res = resolveTenantRequest({
    hostname: "cityreport.io",
    pathname: "/gmaps",
    search: "",
  });
  assert.equal(res.mode, "redirect");
  assert.equal(res.tenantKey, "ashtabulacity");
  assert.equal(res.redirectTo, "https://ashtabulacity.cityreport.io/");
});

test("reserved slug never resolves as municipality tenant", () => {
  const res = resolveTenantRequest({
    hostname: "platform.cityreport.io",
    pathname: "/",
    search: "",
  });
  assert.equal(res.mode, "not_found");
  assert.equal(res.tenantKey, null);
  assert.equal(res.unknownSlug, "platform");
});

test("ashtabula subdomain resolves as independent tenant slug (reserved for county)", () => {
  const res = resolveTenantRequest({
    hostname: "ashtabula.cityreport.io",
    pathname: "/reports",
    search: "?tab=open",
  });
  assert.equal(res.mode, "redirect");
  assert.equal(res.tenantKey, "ashtabula");
  assert.equal(res.redirectTo, "https://ashtabula.cityreport.io/hub/reports?tab=open");
});

test("apex ashtabula slug redirects to its own subdomain (reserved for county)", () => {
  const res = resolveTenantRequest({
    hostname: "cityreport.io",
    pathname: "/ashtabula",
    search: "",
  });
  assert.equal(res.mode, "redirect");
  assert.equal(res.tenantKey, "ashtabula");
  assert.equal(res.redirectTo, "https://ashtabula.cityreport.io/");
});

test("localhost gmaps stays in municipality app for dev testing", () => {
  const res = resolveTenantRequest({
    hostname: "localhost",
    pathname: "/gmaps",
    search: "",
  });
  assert.equal(res.mode, "municipality_app");
  assert.equal(res.tenantKey, "ashtabulacity");
  assert.equal(res.env, "staging");
});

test("ngrok gmaps stays in municipality app for dev testing", () => {
  const res = resolveTenantRequest({
    hostname: "6f2f-100-10-10-10.ngrok-free.app",
    pathname: "/gmaps",
    search: "",
  });
  assert.equal(res.mode, "municipality_app");
  assert.equal(res.tenantKey, "ashtabulacity");
  assert.equal(res.env, "staging");
});
