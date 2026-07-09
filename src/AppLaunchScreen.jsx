import React from "react";

const TITLE_LOGO_ALT = "CityReport.io";
const MOBILE_TITLE_LOGO_SRC =
  import.meta.env.VITE_TITLE_LOGO_DARK_SRC || "/Logos/cityreport_logo_dark_mode.svg";
const LAUNCH_SCREEN_BACKGROUND =
  "radial-gradient(circle at top, rgba(96, 182, 214, 0.26) 0%, rgba(28, 62, 103, 0.96) 34%, rgba(17, 39, 64, 1) 100%)";

export default function AppLaunchScreen({
  eyebrow = "CityReport.io",
  title = "Loading CityReport",
  subtitle = "",
  status = "",
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: LAUNCH_SCREEN_BACKGROUND,
        overflow: "hidden",
        fontFamily: "Manrope, sans-serif",
        color: "#eef6ff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px 18px",
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          display: "grid",
          justifyItems: "center",
          gap: 18,
          textAlign: "center",
          padding: "32px 24px 28px",
          borderRadius: 28,
          border: "1px solid rgba(214, 231, 248, 0.14)",
          background: "linear-gradient(180deg, rgba(21, 49, 80, 0.92) 0%, rgba(17, 39, 64, 0.92) 100%)",
          boxShadow: "0 26px 44px rgba(4, 10, 16, 0.34)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            width: "min(404px, calc(100% - 4px))",
            display: "grid",
            placeItems: "center",
            paddingTop: 4,
          }}
        >
          <img
            src={MOBILE_TITLE_LOGO_SRC}
            alt={TITLE_LOGO_ALT}
            style={{
              width: "100%",
              maxWidth: 396,
              height: "auto",
              maxHeight: 144,
              objectFit: "contain",
              display: "block",
              filter: "drop-shadow(0 12px 18px rgba(4, 10, 16, 0.24))",
            }}
          />
        </div>

        <div style={{ display: "grid", gap: 10, justifyItems: "center", marginTop: -2 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#6ce0d5",
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 950,
              lineHeight: 1.04,
              color: "#f4f9ff",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                maxWidth: 320,
                fontSize: 14,
                lineHeight: 1.5,
                color: "rgba(228, 239, 249, 0.86)",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        {status ? (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(108, 224, 213, 0.18)",
              background: "rgba(108, 224, 213, 0.10)",
              color: "#d5fffb",
              fontSize: 12.5,
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            {status}
          </div>
        ) : null}

        <div
          style={{
            width: 64,
            height: 6,
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.12)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 999,
              background: "linear-gradient(90deg, rgba(108,224,213,0.18) 0%, rgba(244,249,255,0.98) 50%, rgba(108,224,213,0.18) 100%)",
              animation: "cityreport-launch-pulse 1.5s ease-in-out infinite",
              transformOrigin: "center",
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes cityreport-launch-pulse {
          0% { transform: translateX(-55%) scaleX(0.58); opacity: 0.55; }
          50% { transform: translateX(0%) scaleX(1); opacity: 1; }
          100% { transform: translateX(55%) scaleX(0.58); opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
