export default function TenantNotFoundApp() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: "Manrope, sans-serif",
      }}
    >
      <section style={{ maxWidth: 620, textAlign: "center" }}>
        <h1 style={{ marginBottom: 8 }}>Municipality not found</h1>
        <p style={{ margin: 0, opacity: 0.82 }}>
          This municipality URL is not configured. Please verify the subdomain or contact CityReport support.
        </p>
      </section>
    </main>
  );
}
