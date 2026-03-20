export function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Footer">
      <div>
        <p className="footer-brand">CityReport.io</p>
        <p className="footer-copy">Municipal infrastructure accountability engine.</p>
      </div>
      <nav aria-label="Legal and contact">
        <a href="/legal/terms.html">
          Terms
        </a>
        <a href="/legal/privacy.html">
          Privacy
        </a>
        <a href="mailto:cityreport.io@gmail.com">Contact</a>
      </nav>
    </footer>
  );
}
