const DOMAINS = [
  {
    title: "Potholes",
    detail: "Proximity-driven aggregation to reduce duplicate dispatch and improve triage visibility.",
    icon: "◉",
  },
  {
    title: "Street Signs",
    detail: "Asset-oriented reporting that clarifies damaged, missing, and visibility-impact incidents.",
    icon: "▣",
  },
  {
    title: "Water/Drain Issues",
    detail: "Structured intake path for flooding and drain blockage patterns with operational traceability.",
    icon: "◇",
  },
  {
    title: "Streetlights",
    detail: "Utility-owned context support when ownership boundaries differ from municipal scope.",
    icon: "◌",
  },
];

export function Domains() {
  return (
    <section id="domains" className="section" aria-labelledby="domains-title">
      <div className="section-headline-wrap">
        <h2 id="domains-title">Multi-domain accountability with a controlled pilot focus</h2>
        <p>
          Pilot scope can stay intentionally narrow while the platform model remains extensible across
          infrastructure domains.
        </p>
      </div>
      <div className="domain-grid">
        {DOMAINS.map((domain) => (
          <article key={domain.title} className="domain-card">
            <p className="domain-icon" aria-hidden="true">
              {domain.icon}
            </p>
            <h3>{domain.title}</h3>
            <p>{domain.detail}</p>
          </article>
        ))}
      </div>
      <p className="pilot-note">
        Pilot-ready baseline: potholes and street signs with stable governance contracts.
      </p>
    </section>
  );
}
