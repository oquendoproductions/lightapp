import { Hero } from "./components/Hero";
import { LeadForm } from "./components/LeadForm";
import { ProblemOutcome } from "./components/ProblemOutcome";
import { Capabilities } from "./components/Capabilities";
import { Workflow } from "./components/Workflow";
import { Domains } from "./components/Domains";
import { Trust } from "./components/Trust";
import { SiteFooter } from "./components/SiteFooter";
import { trackEvent } from "./lib/analytics";

function smoothScrollTo(sectionId: string) {
  const target = document.getElementById(sectionId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function App() {
  function onBookDemo() {
    trackEvent("hero_primary_cta_click", { target: "lead" });
    smoothScrollTo("lead");
  }

  function onViewWorkflow() {
    trackEvent("hero_secondary_cta_click", { target: "workflow" });
    smoothScrollTo("workflow");
  }

  return (
    <div className="page-shell">
      <header className="top-bar" aria-label="Site header">
        <a className="brand" href="#hero" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark" aria-hidden="true">
            CR
          </span>
          <span>CityReport.io</span>
        </a>
        <button className="btn btn-secondary" onClick={onBookDemo}>
          Book pilot demo
        </button>
      </header>

      <main>
        <section id="hero" className="hero section">
          <Hero onBookDemo={onBookDemo} onViewWorkflow={onViewWorkflow} />
          <div id="lead" className="hero-form-wrap">
            <LeadForm />
          </div>
        </section>

        <ProblemOutcome />
        <Capabilities />
        <Workflow />
        <Domains />
        <Trust />
      </main>

      <SiteFooter />
    </div>
  );
}
