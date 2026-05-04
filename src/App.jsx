import { useEffect, useState } from "react";
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
  { id: "capabilities", label: "Features" },
  { id: "workflow", label: "Workflow" },
  { id: "domains", label: "Domains" },
  { id: "trust", label: "Trust" },
];

function smoothScrollTo(sectionId) {
  const target = document.getElementById(sectionId);
  if (!target) return;
  const topBar = document.querySelector(".top-bar");
  const sectionRail = document.querySelector(".section-rail");
  const topBarHeight = topBar ? topBar.getBoundingClientRect().height : 0;
  const railVisible = sectionRail && window.getComputedStyle(sectionRail).display !== "none";
  const railHeight = railVisible && sectionRail ? sectionRail.getBoundingClientRect().height : 0;
  const offset = topBarHeight + railHeight + 16;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

export default function App() {
  const [activeMobileSection, setActiveMobileSection] = useState(SECTION_LINKS[0]?.id || "");

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
    setActiveMobileSection(sectionId);
  }

  return (
    <div className="page-shell">
      <header className="top-bar" aria-label="Site header">
        <div className="top-bar-inner">
          <div className="marketing-header-left-slot">
            <div className="marketing-header-spacer" aria-hidden="true" />
            <div className="marketing-menu-toggle" aria-hidden="true" />
          </div>
          <a className="brand marketing-header-brand" href="#hero" onClick={(event) => event.preventDefault()}>
            <img className="brand-logo" src="/Logos/cityreport_logo.svg" alt="CityReport.io" />
          </a>
          <button className="btn btn-secondary marketing-header-cta" onClick={onBookDemo}>
            <span className="marketing-header-cta-desktop">Book Pilot Demo</span>
            <span className="marketing-header-cta-mobile">Demo</span>
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

      <nav className="marketing-mobile-nav" aria-label="Homepage mobile sections">
        {SECTION_LINKS.map((link) => (
          <button
            key={link.id}
            type="button"
            className={`marketing-mobile-nav-link${activeMobileSection === link.id ? " is-active" : ""}`}
            onClick={() => onJumpToSection(link.id)}
          >
            {link.label}
          </button>
        ))}
      </nav>

      <SiteFooter />
    </div>
  );
}
