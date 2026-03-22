import { type LeadCaptureRequest, type LeadCaptureResponse } from "./types";

function resolveEndpoint() {
  const explicit = String(import.meta.env.VITE_LEAD_CAPTURE_URL || "").trim();
  if (explicit) return explicit;

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  if (supabaseUrl) return `${supabaseUrl}/functions/v1/lead-capture`;

  return "/functions/v1/lead-capture";
}

function extractMessage(data: unknown, fallback: string) {
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof (data as Record<string, unknown>).message === "string"
  ) {
    return (data as Record<string, string>).message;
  }
  return fallback;
}

export async function submitLead(
  payload: LeadCaptureRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<LeadCaptureResponse> {
  try {
    const response = await fetchImpl(resolveEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as LeadCaptureResponse | null;

    if (!response.ok || !data) {
      return {
        ok: false,
        code: response.status === 429 ? "RATE_LIMITED" : "SERVER_ERROR",
        message: extractMessage(data, "Temporary submission issue. Please try again."),
      };
    }

    if (!data.ok) {
      return data;
    }

    return data;
  } catch (_error) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message: "Could not reach the booking service. Please retry shortly.",
    };
  }
}
