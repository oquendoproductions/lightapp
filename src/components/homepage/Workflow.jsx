const STEPS = [
  {
    title: "1. Capture",
    detail: "Infrastructure report enters a governed intake channel with consistent metadata.",
  },
  {
    title: "2. Triage",
    detail: "Operations teams route and prioritize incidents using domain-aware context.",
  },
  {
    title: "3. Lifecycle",
    detail: "Status changes are tracked through open, fixed, and reopened transitions.",
  },
  {
    title: "4. Review",
    detail: "Decision-ready exports and trend visibility support sponsor and board check-ins.",
  },
];

export function Workflow() {
  return (
    <section id="workflow" className="section" aria-labelledby="workflow-title">
      <h2 id="workflow-title">How the platform workflow operates</h2>
      <ol className="workflow-list">
        {STEPS.map((step) => (
          <li key={step.title} className="workflow-item">
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
