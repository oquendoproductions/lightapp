export function repairActionButtonStyle(baseStyle, disabled, overrides = {}) {
  if (!disabled) return { ...baseStyle, ...overrides };
  return {
    ...baseStyle,
    ...overrides,
    background: "rgba(203, 213, 225, 0.94)",
    border: "1px solid rgba(100, 116, 139, 0.92)",
    color: "rgba(51, 65, 85, 0.98)",
    cursor: "not-allowed",
    opacity: 1,
    boxShadow: "none",
    filter: "grayscale(0.2)",
  };
}
