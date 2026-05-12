export function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Footer">
      <div>
        <p className="footer-brand">CityReport.io</p>
        <p className="footer-copy">A CRAKD LLC-operated municipal infrastructure accountability platform.</p>
      </div>
      <nav aria-label="Legal and contact">
        <a href="#" onClick={(event) => event.preventDefault()}>
          Terms
        </a>
        <a href="#" onClick={(event) => event.preventDefault()}>
          Privacy
        </a>
        <a href="mailto:pilot@cityreport.io">Contact</a>
      </nav>
    </footer>
  );
}
