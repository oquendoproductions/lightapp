export async function fetchOpenAbuseFlagSummary({ supabaseClient } = {}) {
  const { data, error } = await supabaseClient
    .from("metrics_open_abuse_flags_v1")
    .select("open_flag_count,severity");

  if (error) throw error;

  let total = 0;
  let maxSeverity = 0;
  for (const row of data || []) {
    const count = Math.max(0, Number(row?.open_flag_count || 0));
    const severity = Math.max(0, Number(row?.severity || 0));
    total += count;
    if (severity > maxSeverity) maxSeverity = severity;
  }

  return { total, maxSeverity };
}
