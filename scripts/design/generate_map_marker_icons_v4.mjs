import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "public", "icon-concepts-v4");
const DOMAIN_DIR = path.join(ROOT, "domain");
const MARKER_DIR = path.join(ROOT, "markers");

const PALETTE = {
  ink: "#17324d",
  badge: "#ffffff",
  bg: "#eef4f8",
  border: "#c8d7e4",
  road: "#d7e4ee",
};

const domains = [
  {
    slug: "streetlight",
    label: "Streetlight",
    glyph: `
      <path d="M136 430h128v-34h-38V168c0-16 13-29 29-29h92v-34h-92c-35 0-63 28-63 63v228h-56z" fill="currentColor"/>
      <rect x="314" y="132" width="96" height="132" rx="24" fill="currentColor"/>
      <rect x="292" y="132" width="24" height="132" rx="12" fill="currentColor"/>
    `,
  },
  {
    slug: "potholes",
    label: "Potholes",
    glyph: `
      <path fill="currentColor" fill-rule="evenodd" d="M92 258c0-69 74-118 164-118s164 49 164 118-74 118-164 118S92 327 92 258zm112 18c0 24 24 42 54 42s54-18 54-42-24-42-54-42-54 18-54 42z"/>
      <path d="M152 174l-34-30M232 144l-12-40M334 168l34-24M386 258l40 0M338 352l26 34M222 388l-12 36M122 340l-38 20" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round"/>
    `,
  },
  {
    slug: "storm_drain",
    label: "Storm Drain",
    glyph: `
      <path d="M96 174c28-26 60-38 98-38 36 0 62 12 86 30 20 16 38 28 64 28 22 0 42-6 64-20" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
      <path fill="currentColor" fill-rule="evenodd" d="M132 220h248c20 0 36 16 36 36v108c0 20-16 36-36 36H132c-20 0-36-16-36-36V256c0-20 16-36 36-36zm34 36v108h28V256zm60 0v108h28V256zm60 0v108h28V256zm60 0v108h28V256z"/>
    `,
  },
  {
    slug: "sewer_drain",
    label: "Sewer Drain",
    glyph: `
      <path fill="currentColor" fill-rule="evenodd" d="M256 96c88 0 160 72 160 160s-72 160-160 160S96 344 96 256 168 96 256 96zm0 48c-62 0-112 50-112 112s50 112 112 112 112-50 112-112-50-112-112-112z"/>
      <path d="M176 226h160M166 256h180M176 286h160" fill="none" stroke="currentColor" stroke-width="22" stroke-linecap="round"/>
      <path d="M256 166v180" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" opacity="0.9"/>
    `,
  },
  {
    slug: "downed_tree",
    label: "Downed Tree",
    glyph: `
      <circle cx="344" cy="180" r="52" fill="currentColor"/>
      <circle cx="286" cy="184" r="40" fill="currentColor"/>
      <circle cx="376" cy="138" r="34" fill="currentColor"/>
      <path d="M116 338c-18 0-32-14-32-32s14-32 32-32h94l114-98c14-12 35-11 47 3 12 14 11 35-3 47L250 326c-12 8-26 12-40 12H116z" fill="currentColor"/>
      <path d="M126 272l44 18-38 34z" fill="currentColor"/>
    `,
  },
  {
    slug: "encampment",
    label: "Encampment",
    glyph: `
      <path fill="currentColor" fill-rule="evenodd" d="M82 368 220 152c14-22 46-22 60 0l150 216H82zm174-64 64 64H194z"/>
      <rect x="104" y="386" width="304" height="28" rx="14" fill="currentColor"/>
    `,
  },
  {
    slug: "dumping",
    label: "Dumping",
    glyph: `
      <path d="M226 118c-18 0-34 10-42 24l-14 24-30 8c-20 6-30 28-20 46 4 8 10 14 18 18l16 8-30 68c-18 40 12 84 56 84h152c44 0 74-44 56-84l-30-68 16-8c18-8 26-30 18-46-4-8-12-14-20-18l-30-8-14-24c-8-14-24-24-42-24h-36z" fill="currentColor"/>
      <rect x="322" y="292" width="76" height="76" rx="12" transform="rotate(-10 360 330)" fill="currentColor"/>
      <circle cx="178" cy="356" r="16" fill="currentColor"/>
    `,
  },
  {
    slug: "graffiti",
    label: "Graffiti",
    glyph: `
      <rect x="188" y="144" width="136" height="230" rx="34" fill="currentColor"/>
      <rect x="218" y="116" width="76" height="34" rx="14" fill="currentColor"/>
      <rect x="244" y="90" width="24" height="36" rx="10" fill="currentColor"/>
      <circle cx="360" cy="176" r="18" fill="currentColor"/>
      <circle cx="398" cy="146" r="12" fill="currentColor"/>
      <circle cx="396" cy="196" r="10" fill="currentColor"/>
      <path d="M162 362c44 0 82 20 112 54" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round"/>
    `,
  },
  {
    slug: "street_sign",
    label: "Street Sign",
    glyph: `
      <path d="M152 146h170l44 55-44 55H152z" fill="currentColor"/>
      <rect x="122" y="256" width="34" height="158" rx="17" fill="currentColor"/>
      <rect x="152" y="382" width="92" height="28" rx="14" fill="currentColor"/>
    `,
  },
];

function svgDocument({ viewBox, title, body, color = PALETTE.ink }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-labelledby="title" style="color:${color}">
  <title>${title}</title>
  ${body}
</svg>
`;
}

function standaloneDomainSvg(domain) {
  return svgDocument({
    viewBox: "0 0 512 512",
    title: `${domain.label} domain icon`,
    body: `
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${domain.glyph}
  </g>`,
  });
}

function pinShell(innerContent = "") {
  return `
  <path fill="currentColor" d="M256 32c-104.897 0-190 85.103-190 190 0 73.426 33.9 129.847 80.67 188.403L256 574l109.33-163.597C412.1 351.847 446 295.426 446 222 446 117.103 360.897 32 256 32z"/>
  <circle cx="256" cy="222" r="116" fill="${PALETTE.badge}"/>
  ${innerContent}
`;
}

function generalMarkerSvg() {
  return svgDocument({
    viewBox: "0 0 512 640",
    title: "General location marker",
    body: `
  ${pinShell('<path fill="currentColor" fill-rule="evenodd" d="M256 146c-42 0-76 34-76 76 0 52 76 132 76 132s76-80 76-132c0-42-34-76-76-76zm0 40a36 36 0 1 1 0 72 36 36 0 0 1 0-72z"/>')}`,
  });
}

function basePinSvg() {
  return svgDocument({
    viewBox: "0 0 512 640",
    title: "Reusable location pin shell",
    body: `
  ${pinShell("")}`,
  });
}

function compositeMarkerSvg(domain) {
  return svgDocument({
    viewBox: "0 0 512 640",
    title: `${domain.label} map marker`,
    body: `
  ${pinShell(`
    <g transform="translate(156 122) scale(0.390625)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      ${domain.glyph}
    </g>
  `)}`,
  });
}

function manifest() {
  return JSON.stringify(
    {
      version: "v4",
      generatedAt: new Date().toISOString(),
      notes: [
        "SVG sources are sized for crisp small-scale map use and can be scaled up without quality loss.",
        "Each domain includes a standalone one-color glyph and a composite map marker with a shared pin shell.",
      ],
      general: {
        pinShell: "markers/location_pin_base_v4.svg",
        marker: "markers/general_location_marker_v4.svg",
      },
      domains: domains.map((domain) => ({
        slug: domain.slug,
        label: domain.label,
        domainIcon: `domain/${domain.slug}_domain_icon_v4.svg`,
        markerIcon: `markers/${domain.slug}_marker_v4.svg`,
      })),
    },
    null,
    2,
  );
}

function previewHtml() {
  const cards = domains
    .map(
      (domain) => `
      <article class="card">
        <img class="domain" src="domain/${domain.slug}_domain_icon_v4.svg" alt="${domain.label} icon" />
        <div class="marker-row">
          <img class="marker sm" src="markers/${domain.slug}_marker_v4.svg" alt="${domain.label} marker small" />
          <img class="marker md" src="markers/${domain.slug}_marker_v4.svg" alt="${domain.label} marker medium" />
          <img class="marker lg" src="markers/${domain.slug}_marker_v4.svg" alt="${domain.label} marker large" />
        </div>
        <div class="label">${domain.label}</div>
      </article>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CityReport Marker Concepts v4</title>
<style>
  :root {
    --ink: ${PALETTE.ink};
    --paper: #f6f9fb;
    --card: rgba(255,255,255,0.92);
    --border: ${PALETTE.border};
    --road: ${PALETTE.road};
    --text: #22405f;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Avenir Next", "Segoe UI", sans-serif;
    color: var(--text);
    background:
      radial-gradient(circle at top left, rgba(255,255,255,0.85), transparent 32%),
      linear-gradient(135deg, #dbe9f2 0%, #eef4f8 42%, #d8e7ef 100%);
  }
  main {
    width: min(1200px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 32px 0 48px;
  }
  h1 {
    margin: 0 0 10px;
    font-size: clamp(2rem, 3.8vw, 3.4rem);
    line-height: 0.94;
    letter-spacing: -0.04em;
  }
  p {
    margin: 0;
    max-width: 760px;
    line-height: 1.5;
  }
  .hero {
    position: relative;
    overflow: hidden;
    padding: 28px;
    border: 1px solid rgba(255,255,255,0.6);
    border-radius: 28px;
    background:
      linear-gradient(145deg, rgba(255,255,255,0.94), rgba(255,255,255,0.82)),
      linear-gradient(90deg, transparent 0 47%, rgba(23,50,77,0.05) 47% 53%, transparent 53%),
      linear-gradient(0deg, transparent 0 47%, rgba(23,50,77,0.05) 47% 53%, transparent 53%);
    box-shadow: 0 24px 70px rgba(33, 58, 85, 0.12);
  }
  .hero::after {
    content: "";
    position: absolute;
    inset: auto -30px -42px auto;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(23,50,77,0.14), rgba(23,50,77,0));
  }
  .hero-grid {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 22px;
    align-items: end;
  }
  .hero-panel {
    min-height: 200px;
    border-radius: 22px;
    border: 1px solid var(--border);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.78)),
      repeating-linear-gradient(0deg, transparent 0 44px, rgba(23,50,77,0.05) 44px 46px),
      repeating-linear-gradient(90deg, transparent 0 44px, rgba(23,50,77,0.05) 44px 46px);
    display: grid;
    place-items: center;
    padding: 24px;
  }
  .hero-panel img {
    display: block;
    width: clamp(76px, 15vw, 124px);
    height: auto;
  }
  .legend {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 18px;
    font-size: 13px;
    font-weight: 700;
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .legend i {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    display: inline-block;
    background: var(--ink);
  }
  h2 {
    margin: 28px 0 14px;
    font-size: 1.05rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 18px;
  }
  .card {
    position: relative;
    overflow: hidden;
    border-radius: 22px;
    border: 1px solid rgba(255,255,255,0.75);
    background: var(--card);
    padding: 18px;
    box-shadow: 0 18px 48px rgba(33, 58, 85, 0.08);
  }
  .card::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, transparent 0 46%, rgba(23,50,77,0.03) 46% 54%, transparent 54%),
      linear-gradient(0deg, transparent 0 46%, rgba(23,50,77,0.03) 46% 54%, transparent 54%);
    opacity: 0.8;
    pointer-events: none;
  }
  .domain {
    width: 92px;
    height: 92px;
    display: block;
    margin: 0 auto 12px;
    object-fit: contain;
  }
  .marker-row {
    position: relative;
    display: flex;
    align-items: end;
    justify-content: center;
    gap: 14px;
    min-height: 106px;
    padding: 10px 0 8px;
  }
  .marker {
    display: block;
    height: auto;
    filter: drop-shadow(0 10px 14px rgba(23, 50, 77, 0.16));
  }
  .marker.sm { width: 22px; }
  .marker.md { width: 30px; }
  .marker.lg { width: 40px; }
  .label {
    position: relative;
    z-index: 1;
    text-align: center;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.01em;
  }
  @media (max-width: 860px) {
    .hero-grid { grid-template-columns: 1fr; }
    .hero-panel { min-height: 160px; }
  }
</style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="hero-grid">
        <div>
          <h1>Marker Concepts v4</h1>
          <p>A reusable location-pin shell plus one-color domain glyphs designed for fast recognition at small map sizes. All exported assets are SVG so they can scale up cleanly without losing detail.</p>
          <div class="legend">
            <span><i></i> Shared pin system</span>
            <span><i style="background:#ffffff;border:1px solid ${PALETTE.border};"></i> White badge keeps glyphs readable on map imagery</span>
            <span><i style="background:${PALETTE.ink};opacity:0.78;"></i> Domain icons stay single-color</span>
          </div>
        </div>
        <div class="hero-panel">
          <img src="markers/general_location_marker_v4.svg" alt="General location marker" />
        </div>
      </div>
    </section>

    <h2>Domain Markers</h2>
    <div class="grid">
      ${cards}
    </div>
  </main>
</body>
</html>
`;
}

for (const dir of [ROOT, DOMAIN_DIR, MARKER_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(path.join(MARKER_DIR, "location_pin_base_v4.svg"), basePinSvg());
fs.writeFileSync(path.join(MARKER_DIR, "general_location_marker_v4.svg"), generalMarkerSvg());

for (const domain of domains) {
  fs.writeFileSync(
    path.join(DOMAIN_DIR, `${domain.slug}_domain_icon_v4.svg`),
    standaloneDomainSvg(domain),
  );
  fs.writeFileSync(
    path.join(MARKER_DIR, `${domain.slug}_marker_v4.svg`),
    compositeMarkerSvg(domain),
  );
}

fs.writeFileSync(path.join(ROOT, "manifest.json"), manifest());
fs.writeFileSync(path.join(ROOT, "preview.html"), previewHtml());

console.log(`Generated ${domains.length} domain icon sets in ${ROOT}`);
