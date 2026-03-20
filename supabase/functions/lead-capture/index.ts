import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_WINDOW_MS = Number(Deno.env.get("LEAD_CAPTURE_RATE_WINDOW_MS") || 15 * 60 * 1000);
const RATE_LIMIT_MAX_SUBMISSIONS = Number(Deno.env.get("LEAD_CAPTURE_RATE_MAX") || 5);
const HASH_SALT = Deno.env.get("LEAD_CAPTURE_HASH_SALT");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LEAD_NOTIFY_TO = Deno.env.get("LEAD_NOTIFY_TO") || Deno.env.get("PW_REPORT_TO") || "";
const LEAD_NOTIFY_FROM =
  Deno.env.get("LEAD_NOTIFY_FROM") ||
  Deno.env.get("PW_REPORT_FROM") ||
  "CityReport.io <noreply@auth.cityreport.io>";
const LEAD_NOTIFY_WEBHOOK_URL = Deno.env.get("LEAD_NOTIFY_WEBHOOK_URL") || "";
const LEAD_NOTIFY_WEBHOOK_BEARER = Deno.env.get("LEAD_NOTIFY_WEBHOOK_BEARER") || "";

const PRIORITY_DOMAINS = new Set([
  "potholes",
  "street_signs",
  "water_drain_issues",
  "streetlights",
  "other",
]);

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function validatePayload(payload: any) {
  const errors: string[] = [];

  if (normalizeText(payload.fullName || "").length < 2) {
    errors.push("fullName is required");
  }

  const email = normalizeText(payload.workEmail || "").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("workEmail must be valid");
  }

  if (normalizeText(payload.cityAgency || "").length < 2) {
    errors.push("cityAgency is required");
  }

  if (normalizeText(payload.roleTitle || "").length < 2) {
    errors.push("roleTitle is required");
  }

  if (!PRIORITY_DOMAINS.has((payload.priorityDomain || "").trim())) {
    errors.push("priorityDomain is invalid");
  }

  if (payload.source !== "homepage") {
    errors.push("source must be homepage");
  }

  const notes = normalizeText(payload.notes || "");
  if (notes.length > 1000) {
    errors.push("notes exceeds max length");
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      fullName: normalizeText(payload.fullName || ""),
      workEmail: email,
      cityAgency: normalizeText(payload.cityAgency || ""),
      roleTitle: normalizeText(payload.roleTitle || ""),
      priorityDomain: (payload.priorityDomain || "").trim(),
      notes,
    },
  };
}

function escapeHtml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendLeadEmailNotification(leadId: string, lead: any) {
  if (!RESEND_API_KEY || !LEAD_NOTIFY_TO) {
    return;
  }

  const subject = `New CityReport lead: ${lead.cityAgency} (${lead.priorityDomain})`;
  const prettyNotes = lead.notes || "No notes provided";
  const submittedAt = new Date().toISOString();
  const text = [
    "New CityReport homepage lead received",
    "",
    `Lead ID: ${leadId}`,
    `Submitted at (UTC): ${submittedAt}`,
    `Name: ${lead.fullName}`,
    `Work email: ${lead.workEmail}`,
    `City/Agency: ${lead.cityAgency}`,
    `Role/Title: ${lead.roleTitle}`,
    `Priority domain: ${lead.priorityDomain}`,
    `Notes: ${prettyNotes}`,
  ].join("\n");

  const html = `
    <h2>New CityReport homepage lead received</h2>
    <p><b>Lead ID:</b> ${escapeHtml(leadId)}</p>
    <p><b>Submitted at (UTC):</b> ${escapeHtml(submittedAt)}</p>
    <p><b>Name:</b> ${escapeHtml(lead.fullName)}</p>
    <p><b>Work email:</b> ${escapeHtml(lead.workEmail)}</p>
    <p><b>City/Agency:</b> ${escapeHtml(lead.cityAgency)}</p>
    <p><b>Role/Title:</b> ${escapeHtml(lead.roleTitle)}</p>
    <p><b>Priority domain:</b> ${escapeHtml(lead.priorityDomain)}</p>
    <p><b>Notes:</b> ${escapeHtml(prettyNotes)}</p>
  `;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: LEAD_NOTIFY_FROM,
      to: [LEAD_NOTIFY_TO],
      subject,
      text,
      html,
    }),
  });

  if (!resendRes.ok) {
    const body = await resendRes.text().catch(() => "");
    throw new Error(`lead email notification failed (${resendRes.status}): ${body}`);
  }
}

async function sendLeadWebhookNotification(leadId: string, lead: any) {
  if (!LEAD_NOTIFY_WEBHOOK_URL) {
    return;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (LEAD_NOTIFY_WEBHOOK_BEARER) {
    headers.Authorization = `Bearer ${LEAD_NOTIFY_WEBHOOK_BEARER}`;
  }

  const webhookRes = await fetch(LEAD_NOTIFY_WEBHOOK_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "cityreport.lead.created",
      leadId,
      submittedAt: new Date().toISOString(),
      lead,
    }),
  });

  if (!webhookRes.ok) {
    const body = await webhookRes.text().catch(() => "");
    throw new Error(`lead webhook notification failed (${webhookRes.status}): ${body}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return response({ ok: false, code: "SERVER_ERROR", message: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey || !HASH_SALT) {
    return response(
      { ok: false, code: "SERVER_ERROR", message: "Missing server configuration." },
      500,
    );
  }

  let payload: any;

  try {
    payload = await req.json();
  } catch {
    return response(
      { ok: false, code: "VALIDATION_ERROR", message: "Malformed JSON payload." },
      400,
    );
  }

  if (String(payload.website || "").trim().length > 0) {
    return response({
      ok: true,
      leadId: crypto.randomUUID(),
      message: "Request received. We will follow up within one business day.",
    });
  }

  const validation = validatePayload(payload);

  if (!validation.valid) {
    return response(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Invalid request data.",
        details: validation.errors,
      },
      400,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const clientIp = getClientIp(req);
  const ipHash = await sha256Hex(`${clientIp}:${HASH_SALT}`);
  const emailHash = await sha256Hex(`${validation.normalized.workEmail}:${HASH_SALT}`);
  const windowStartIso = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const [ipWindow, emailWindow] = await Promise.all([
    supabase
      .from("client_leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", windowStartIso),
    supabase
      .from("client_leads")
      .select("id", { count: "exact", head: true })
      .eq("email_hash", emailHash)
      .gte("created_at", windowStartIso),
  ]);

  if (ipWindow.error || emailWindow.error) {
    console.error("rate-limit query failed", ipWindow.error || emailWindow.error);
    return response(
      { ok: false, code: "SERVER_ERROR", message: "Temporary submission issue. Please retry." },
      500,
    );
  }

  if (
    (ipWindow.count || 0) >= RATE_LIMIT_MAX_SUBMISSIONS ||
    (emailWindow.count || 0) >= RATE_LIMIT_MAX_SUBMISSIONS
  ) {
    return response(
      {
        ok: false,
        code: "RATE_LIMITED",
        message: "Too many requests in a short window. Please retry in a few minutes.",
      },
      429,
    );
  }

  const { data, error } = await supabase
    .from("client_leads")
    .insert({
      full_name: validation.normalized.fullName,
      work_email: validation.normalized.workEmail,
      city_agency: validation.normalized.cityAgency,
      role_title: validation.normalized.roleTitle,
      priority_domain: validation.normalized.priorityDomain,
      notes: validation.normalized.notes || null,
      source: "homepage",
      ip_hash: ipHash,
      email_hash: emailHash,
      user_agent: req.headers.get("user-agent"),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("insert failed", error);
    return response(
      { ok: false, code: "SERVER_ERROR", message: "Could not save your request. Please retry." },
      500,
    );
  }

  const leadForNotify = {
    fullName: validation.normalized.fullName,
    workEmail: validation.normalized.workEmail,
    cityAgency: validation.normalized.cityAgency,
    roleTitle: validation.normalized.roleTitle,
    priorityDomain: validation.normalized.priorityDomain,
    notes: validation.normalized.notes || "",
    source: "homepage",
  };

  const notifyResults = await Promise.allSettled([
    sendLeadEmailNotification(data.id, leadForNotify),
    sendLeadWebhookNotification(data.id, leadForNotify),
  ]);
  for (const result of notifyResults) {
    if (result.status === "rejected") {
      console.error("lead notification warning", result.reason);
    }
  }

  return response({
    ok: true,
    leadId: data.id,
    message: "Request received. A scheduling follow-up will be sent within one business day.",
  });
});
