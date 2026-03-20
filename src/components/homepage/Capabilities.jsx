const CAPABILITIES = [
  {
    title: "Lifecycle Event Tracking",
    detail:
      "Track each incident through open, in progress, fixed, and reopened outcomes with deterministic state history.",
  },
  {
    title: "Public vs Internal Separation",
    detail:
      "Maintain transparency while preserving sensitive operational detail through clear role-based visibility boundaries.",
  },
  {
    title: "Open Reports Queue",
    detail:
      "Give operations teams a focused queue for triage and status progression across active incidents.",
  },
  {
    title: "Deterministic Export Contract",
    detail:
      "Generate stable summary and detail exports for sponsor reviews, internal alignment, and audit readiness.",
  },
  {
    title: "Reopen and Chronic Signals",
    detail:
      "Surface recurring problem patterns early so city teams can address systemic risk, not only single events.",
  },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="section" aria-labelledby="capabilities-title">
      <h2 id="capabilities-title">Capability proof designed for procurement clarity</h2>
      <div className="capability-grid">
        {CAPABILITIES.map((item) => (
          <article key={item.title} className="capability-card">
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
