export function Hero({ onBookDemo, onViewWorkflow }) {
  return (
    <div className="hero-copy" aria-labelledby="hero-title">
      <p className="eyebrow">Municipal Infrastructure Accountability</p>
      <h1 id="hero-title">Move from report intake to auditable city outcomes.</h1>
      <p className="hero-subtext">
        CityReport.io gives municipal teams one operational system for infrastructure issue intake,
        triage, lifecycle tracking, and governance-ready exports.
      </p>
      <div className="hero-actions">
        <button className="btn btn-primary" onClick={onBookDemo}>
          Book pilot demo
        </button>
        <button className="btn btn-secondary" onClick={onViewWorkflow}>
          View platform workflow
        </button>
      </div>
      <ul className="hero-checks" aria-label="Key outcomes">
        <li>Operational clarity across public and internal views</li>
        <li>Deterministic exports for sponsor reviews</li>
        <li>Domain ownership nuance across city and utility workflows</li>
      </ul>
    </div>
  );
}
