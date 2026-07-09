export const REPORTING_MIN_ZOOM = 17;

export const STREETLIGHT_UTILITY_REPORT_URL =
  String(import.meta.env.VITE_STREETLIGHT_UTILITY_REPORT_URL || "").trim()
  || "https://www.firstenergycorp.com/outages_help/Report_Power_Outages.html?_gl=1*te1hi8*_up*MQ..*_ga*MTEyODI2NTQ5OS4xNzcyMjU3MDQ4*_ga_TVQJK7Z44E*czE3NzI0Mzc3NzEkbzIkZzEkdDE3NzI0Mzc3ODQkajQ3JGwwJGgw";

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
