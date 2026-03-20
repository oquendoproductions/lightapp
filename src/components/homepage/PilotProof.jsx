const PILOT_PROOF_ITEMS = [
  {
    title: "Scope Lock",
    detail:
      "Pilot delivery can stay constrained to potholes and street signs while lifecycle and export contracts remain stable.",
    evidence: "No structural domain expansion during active pilot windows.",
  },
  {
    title: "Weekly Ops Cadence",
    detail:
      "Sponsor and operations teams align on recurring accountability signals, not ad hoc status snapshots.",
    evidence: "Core KPI review: open, fixed, time-to-fix, reopen and chronic trends.",
  },
  {
    title: "Deterministic Reviews",
    detail:
      "Exports and visibility boundaries support repeatable sponsor reviews without exposing protected operational detail.",
    evidence: "Public/internal separation and versioned export behavior remain consistent.",
  },
];

export function PilotProof() {
  return (
    <section id="pilot-proof" className="section" aria-labelledby="pilot-proof-title">
      <div className="section-headline-wrap">
        <h2 id="pilot-proof-title">Pilot proof for municipal buyers</h2>
        <p>Concrete operating structure you can evaluate before broader rollout decisions.</p>
      </div>
      <div className="proof-grid">
        {PILOT_PROOF_ITEMS.map((item) => (
          <article key={item.title} className="proof-card">
            <p className="proof-kicker">{item.title}</p>
            <h3>{item.detail}</h3>
            <p>{item.evidence}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
