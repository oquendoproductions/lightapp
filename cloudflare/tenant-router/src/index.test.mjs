import assert from "node:assert/strict";
import test from "node:test";

import worker from "./index.js";

test("forwards tenant headers to upstream Pages request", async () => {
  const seen = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (req) => {
    seen.push(req);
    return new Response("ok", {
      status: 200,
      headers: {
        "content-type": "text/plain",
      },
    });
  };

  try {
    const request = new Request("https://ashtabulacity.cityreport.io/");
    const response = await worker.fetch(request, {
      PAGES_ORIGIN: "lightapp-ak2.pages.dev",
      DEFAULT_TENANT_KEY: "ashtabulacity",
      KNOWN_TENANT_KEYS: "ashtabulacity",
    });

    assert.equal(seen.length, 1);
    assert.equal(seen[0].headers.get("x-tenant-key"), "ashtabulacity");
    assert.equal(seen[0].headers.get("x-tenant-mode"), "municipality_app");
    assert.equal(seen[0].headers.get("x-tenant-env"), "prod");
    assert.equal(response.headers.get("x-cityreport-resolver-mode"), "municipality_app");
    assert.equal(response.headers.get("x-cityreport-tenant-key"), "ashtabulacity");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unknown tenant does not proxy upstream and returns 404", async () => {
  let called = false;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    called = true;
    return new Response("unexpected", { status: 200 });
  };

  try {
    const request = new Request("https://unknown-slug.cityreport.io/");
    const response = await worker.fetch(request, {
      PAGES_ORIGIN: "lightapp-ak2.pages.dev",
      DEFAULT_TENANT_KEY: "ashtabulacity",
      KNOWN_TENANT_KEYS: "ashtabulacity",
    });

    assert.equal(response.status, 404);
    assert.match(String(response.headers.get("content-type") || ""), /text\/html/i);
    const body = await response.text();
    assert.match(body, /Municipality Not Found/);
    assert.match(body, /CityReport\.io/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("auto-syncs active tenant keys from Supabase before resolving host", async () => {
  const seen = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (req) => {
    const url = typeof req === "string" ? req : req.url;
    if (String(url).includes("/rest/v1/tenants")) {
      return new Response(JSON.stringify([{ tenant_key: "testcity1" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    seen.push(req);
    return new Response("ok", { status: 200 });
  };

  try {
    const request = new Request("https://testcity1.cityreport.io/");
    const response = await worker.fetch(request, {
      PAGES_ORIGIN: "lightapp-ak2.pages.dev",
      DEFAULT_TENANT_KEY: "ashtabulacity",
      KNOWN_TENANT_KEYS: "ashtabulacity",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "sb_publishable_test_123",
      TENANT_KEYS_SYNC_TTL_SEC: "1",
    });

    assert.equal(response.status, 200);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].headers.get("x-tenant-key"), "testcity1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
