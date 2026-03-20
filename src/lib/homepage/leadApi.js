function resolveEndpoint() {
  const explicit = String(import.meta.env.VITE_LEAD_CAPTURE_URL || "").trim();
  if (explicit) return explicit;

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  if (supabaseUrl) return `${supabaseUrl}/functions/v1/lead-capture`;

  return "/functions/v1/lead-capture";
}

function extractMessage(data, fallback) {
  if (data && typeof data === "object" && typeof data.message === "string") {
    return data.message;
  }
  return fallback;
}

export async function submitLead(payload, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(resolveEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      return {
        ok: false,
        code: response.status === 429 ? "RATE_LIMITED" : "SERVER_ERROR",
        message: extractMessage(data, "Temporary submission issue. Please try again."),
      };
    }

    return data;
  } catch {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message: "Could not reach the booking service. Please retry shortly.",
    };
  }
}
