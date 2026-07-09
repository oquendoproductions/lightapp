export const EMPTY_COMMUNITY_ALERT_FORM = {
  topic_key: "",
  title: "",
  summary: "",
  body: "",
  severity: "info",
  location_name: "",
  location_address: "",
  cta_label: "",
  cta_url: "",
  starts_at: "",
  ends_at: "",
  pinned: false,
  status: "published",
  publish_at: "",
};

export const EMPTY_COMMUNITY_EVENT_FORM = {
  topic_key: "",
  title: "",
  summary: "",
  body: "",
  location_name: "",
  location_address: "",
  cta_label: "",
  cta_url: "",
  starts_at: "",
  ends_at: "",
  all_day: false,
  status: "published",
  publish_at: "",
};

export const COMMUNITY_FEED_STATUS_OPTIONS = [
  {
    value: "draft",
    label: "Draft",
    description: "Hidden from residents while you work.",
  },
  {
    value: "scheduled",
    label: "Scheduled",
    description: "Goes public at the time you choose.",
  },
  {
    value: "published",
    label: "Published",
    description: "Visible in the public app.",
  },
  {
    value: "archived",
    label: "Archived",
    description: "Hidden, but kept for records.",
  },
];
