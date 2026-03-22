const TRUST_ITEMS = [
  {
    title: "Data handling discipline",
    detail:
      "Lead capture and incident workflows follow explicit data boundaries with no public exposure of sensitive operational context.",
  },
  {
    title: "Role-based visibility",
    detail:
      "Public summary and internal operations views remain separated to preserve transparency without leaking protected detail.",
  },
  {
    title: "Export integrity",
    detail:
      "Deterministic export schema supports repeatable sponsor review and internal audit readiness.",
  },
];

export function Trust() {
  return (
    <section id="trust" className="section" aria-labelledby="trust-title">
      <h2 id="trust-title">Compact trust and governance alignment</h2>
      <div className="trust-grid">
        {TRUST_ITEMS.map((item) => (
          <article key={item.title} className="trust-card">
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <p className="trust-link-row">
        <a href="#" onClick={(event) => event.preventDefault()}>
          Governance documentation slot (pilot packet)
        </a>
      </p>
    </section>
  );
}
