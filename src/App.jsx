import { useEffect } from "react";
import { Hero } from "./components/homepage/Hero.jsx";
import { LeadForm } from "./components/homepage/LeadForm.jsx";
import { ProblemOutcome } from "./components/homepage/ProblemOutcome.jsx";
import { Capabilities } from "./components/homepage/Capabilities.jsx";
import { PilotProof } from "./components/homepage/PilotProof.jsx";
import { Workflow } from "./components/homepage/Workflow.jsx";
import { Domains } from "./components/homepage/Domains.jsx";
import { Trust } from "./components/homepage/Trust.jsx";
import { SiteFooter } from "./components/homepage/SiteFooter.jsx";
import { trackEvent } from "./lib/homepage/analytics.js";
import "./headerStandards.css";
import "./homepage.css";

const SECTION_LINKS = [
  { id: "problem-outcome", label: "Problem" },
  { id: "capabilities", label: "Capabilities" },
  { id: "workflow", label: "Workflow" },
  { id: "domains", label: "Domains" },
  { id: "trust", label: "Trust" },
  { id: "lead", label: "Demo" },
];

function smoothScrollTo(sectionId) {
  const target = document.getElementById(sectionId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function App() {
  useEffect(() => {
    trackEvent("homepage_view", { page: "marketing_home" });

    const firedThresholds = new Set();
    const thresholds = [25, 50, 75, 100];

    function onScroll() {
      const doc = document.documentElement;
      const maxScroll = doc.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) return;

      const scrollPercent = Math.min(100, Math.round((window.scrollY / maxScroll) * 100));
      for (const threshold of thresholds) {
        if (scrollPercent >= threshold && !firedThresholds.has(threshold)) {
          firedThresholds.add(threshold);
          trackEvent("homepage_scroll_depth", { percent: threshold });
        }
      }
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function onBookDemo() {
    trackEvent("hero_primary_cta_click", { target: "lead" });
    smoothScrollTo("lead");
  }

  function onViewWorkflow() {
    trackEvent("hero_secondary_cta_click", { target: "workflow" });
    smoothScrollTo("workflow");
  }

  function onJumpToSection(sectionId) {
    trackEvent("section_rail_click", { target: sectionId });
    smoothScrollTo(sectionId);
  }

  return (
    <div className="page-shell">
      <header className="top-bar" aria-label="Site header">
        <div className="top-bar-inner">
          <div className="marketing-header-spacer" aria-hidden="true" />
          <a className="brand marketing-header-brand" href="#hero" onClick={(event) => event.preventDefault()}>
            <img className="brand-logo" src="/CityReport-logo.png" alt="CityReport.io" />
          </a>
          <button className="btn btn-secondary marketing-header-cta" onClick={onBookDemo}>
            <span className="marketing-header-cta-desktop">Book Pilot Demo</span>
            <span className="marketing-header-cta-mobile">Book Demo</span>
          </button>
        </div>
      </header>

      <nav className="section-rail" aria-label="Homepage sections">
        {SECTION_LINKS.map((link) => (
          <button
            key={link.id}
            type="button"
            className="rail-link"
            onClick={() => onJumpToSection(link.id)}
          >
            {link.label}
          </button>
        ))}
      </nav>

      <main className="home-main">
        <section id="hero" className="hero section">
          <Hero onBookDemo={onBookDemo} onViewWorkflow={onViewWorkflow} />
          <div id="lead" className="hero-form-wrap">
            <LeadForm />
          </div>
        </section>

        <ProblemOutcome />
        <Capabilities />
        <PilotProof />
        <Workflow />
        <Domains />
        <Trust />
      </main>

      <SiteFooter />
    </div>
  );
}
