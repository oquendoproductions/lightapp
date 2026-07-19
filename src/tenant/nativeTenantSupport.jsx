import React from "react";
import AppLaunchInteractiveScreen from "../AppLaunchInteractiveScreen.jsx";

export function TenantInitialSelectionScreen({
  step = "login",
  loginEmail = "",
  onLoginEmailChange,
  loginPassword = "",
  onLoginPasswordChange,
  loginBusy = false,
  loginError = "",
  onSignIn,
  onOpenSignup,
  onContinueGuest,
  signupName = "",
  onSignupNameChange,
  signupPhone = "",
  onSignupPhoneChange,
  signupEmail = "",
  onSignupEmailChange,
  signupPassword = "",
  onSignupPasswordChange,
  signupPasswordConfirmation = "",
  onSignupPasswordConfirmationChange,
  signupLegalAccepted = false,
  onSignupLegalAcceptedChange,
  signupBusy = false,
  signupError = "",
  onCreateAccount,
  onReturnToSignIn,
  tenantSearch = "",
  onTenantSearchChange,
  tenantSearchTerm = "",
  options = [],
  savedOptions = [],
  optionsReady = false,
  onSelectTenant,
}) {
  if (step === "login") {
    return (
      <AppLaunchInteractiveScreen
        eyebrow="Welcome"
        title="Sign In"
        subtitle="Sign in to load your saved locations, or continue as a guest to find a city."
        status=""
      >
        <form
          style={{ display: "grid", gap: 12 }}
          onSubmit={(event) => {
            event.preventDefault();
            void onSignIn?.();
          }}
        >
          <input
            type="email"
            value={loginEmail}
            onChange={(event) => onLoginEmailChange?.(event.target.value)}
            placeholder="Email address"
            autoComplete="email"
            inputMode="email"
            style={launchInputStyle}
          />
          <input
            type="password"
            value={loginPassword}
            onChange={(event) => onLoginPasswordChange?.(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            style={launchInputStyle}
          />
          {loginError ? (
            <div style={{ color: "#ffd1d1", fontSize: 13.5, fontWeight: 750, lineHeight: 1.4, textAlign: "left" }}>
              {loginError}
            </div>
          ) : null}
          <button type="submit" disabled={loginBusy} style={launchPrimaryButtonStyle}>
            {loginBusy ? "Signing In..." : "Sign In"}
          </button>
          <button type="button" onClick={() => onOpenSignup?.()} style={launchSecondaryButtonStyle}>
            Create Account
          </button>
          <button type="button" onClick={() => onContinueGuest?.()} style={launchTextButtonStyle}>
            Continue as Guest
          </button>
        </form>
      </AppLaunchInteractiveScreen>
    );
  }

  if (step === "signup") {
    const passwordChecks = {
      length: signupPassword.length >= 8,
      uppercase: /[A-Z]/.test(signupPassword),
      lowercase: /[a-z]/.test(signupPassword),
      number: /[0-9]/.test(signupPassword),
      special: /[^A-Za-z0-9]/.test(signupPassword),
      match: Boolean(signupPasswordConfirmation) && signupPassword === signupPasswordConfirmation,
    };
    return (
      <AppLaunchInteractiveScreen
        eyebrow="Welcome"
        title="Create Account"
        subtitle="Create an account to save locations, reports, and notification preferences."
        status=""
      >
        <form
          style={{ display: "grid", gap: 11, textAlign: "left" }}
          onSubmit={(event) => {
            event.preventDefault();
            void onCreateAccount?.();
          }}
        >
          <input
            type="text"
            value={signupName}
            onChange={(event) => onSignupNameChange?.(event.target.value)}
            placeholder="Full name"
            autoComplete="name"
            style={launchInputStyle}
          />
          <input
            type="tel"
            value={signupPhone}
            onChange={(event) => onSignupPhoneChange?.(event.target.value)}
            placeholder="Phone (optional)"
            autoComplete="tel"
            style={launchInputStyle}
          />
          <input
            type="email"
            value={signupEmail}
            onChange={(event) => onSignupEmailChange?.(event.target.value)}
            placeholder="Email address"
            autoComplete="email"
            inputMode="email"
            style={launchInputStyle}
          />
          <input
            type="password"
            value={signupPassword}
            onChange={(event) => onSignupPasswordChange?.(event.target.value)}
            placeholder="Password"
            autoComplete="new-password"
            style={launchInputStyle}
          />
          <input
            type="password"
            value={signupPasswordConfirmation}
            onChange={(event) => onSignupPasswordConfirmationChange?.(event.target.value)}
            placeholder="Re-enter password"
            autoComplete="new-password"
            style={launchInputStyle}
          />
          <div style={{ display: "grid", gap: 3, fontSize: 12.5, lineHeight: 1.35 }}>
            <PasswordCheck ok={passwordChecks.length}>8 or more characters</PasswordCheck>
            <PasswordCheck ok={passwordChecks.uppercase}>1 uppercase letter</PasswordCheck>
            <PasswordCheck ok={passwordChecks.lowercase}>1 lowercase letter</PasswordCheck>
            <PasswordCheck ok={passwordChecks.number}>1 number</PasswordCheck>
            <PasswordCheck ok={passwordChecks.special}>1 special character</PasswordCheck>
            <PasswordCheck ok={passwordChecks.match}>Passwords match</PasswordCheck>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12.5, lineHeight: 1.4 }}>
            <input
              type="checkbox"
              checked={Boolean(signupLegalAccepted)}
              onChange={(event) => onSignupLegalAcceptedChange?.(event.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              I agree to the{" "}
              <a href="https://cityreport.io/legal/terms.html" target="_blank" rel="noreferrer" style={launchLegalLinkStyle}>
                Terms of Use
              </a>{" "}
              and{" "}
              <a href="https://cityreport.io/legal/privacy.html" target="_blank" rel="noreferrer" style={launchLegalLinkStyle}>
                Privacy Policy
              </a>.
            </span>
          </label>
          {signupError ? <div style={launchErrorStyle}>{signupError}</div> : null}
          <button type="submit" disabled={signupBusy || !signupLegalAccepted} style={launchPrimaryButtonStyle}>
            {signupBusy ? "Creating Account..." : "Create Account"}
          </button>
          <button type="button" onClick={() => onReturnToSignIn?.()} style={launchTextButtonStyle}>
            Back to Sign In
          </button>
        </form>
      </AppLaunchInteractiveScreen>
    );
  }

  if (step === "signup-confirmation") {
    return (
      <AppLaunchInteractiveScreen
        eyebrow="Almost There"
        title="Check Your Email"
        subtitle={`We sent a confirmation link to ${signupEmail}. Confirm your account, then return to sign in.`}
        status=""
      >
        <div style={{ display: "grid", gap: 10 }}>
          <button type="button" onClick={() => onReturnToSignIn?.()} style={launchPrimaryButtonStyle}>
            Back to Sign In
          </button>
          <button type="button" onClick={() => onContinueGuest?.()} style={launchTextButtonStyle}>
            Continue as Guest
          </button>
        </div>
      </AppLaunchInteractiveScreen>
    );
  }

  return (
    <AppLaunchInteractiveScreen
      eyebrow="Locations"
      title="Choose a City"
      subtitle="Open a saved location or search for another CityReport.io community."
      status={optionsReady ? "" : "Loading available cities..."}
    >
      <div style={{ display: "grid", gap: 12 }}>
        {savedOptions.length ? (
          <div style={{ display: "grid", gap: 9 }}>
            <div style={launchSectionLabelStyle}>Saved Locations</div>
            {savedOptions.map((option) => (
              <TenantLaunchOption key={`saved-${option.tenantKey}`} option={option} onSelectTenant={onSelectTenant} />
            ))}
          </div>
        ) : null}
        <div style={launchSectionLabelStyle}>{savedOptions.length ? "Add Another Location" : "Find a Location"}</div>
        <input
          type="search"
          value={tenantSearch}
          onChange={(e) => onTenantSearchChange?.(e.target.value)}
          placeholder="Search by city name"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          style={launchInputStyle}
        />
        {tenantSearchTerm ? (
          options.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {options.map((option) => (
                <TenantLaunchOption key={option.tenantKey} option={option} onSelectTenant={onSelectTenant} />
              ))}
            </div>
          ) : optionsReady ? (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 18,
                border: "1px solid rgba(214, 231, 248, 0.12)",
                background: "rgba(17, 39, 64, 0.82)",
                color: "rgba(228, 239, 249, 0.82)",
                fontSize: 14,
                lineHeight: 1.5,
                textAlign: "left",
              }}
            >
              No cities found for that search.
            </div>
          ) : null
        ) : (
          <div
            style={{
              padding: "10px 4px 2px",
              color: "rgba(228, 239, 249, 0.78)",
              fontSize: 13.5,
              lineHeight: 1.45,
              textAlign: "left",
            }}
          >
            Start typing to find your city.
          </div>
        )}
      </div>
    </AppLaunchInteractiveScreen>
  );
}

const launchInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  borderRadius: 18,
  border: "1px solid rgba(214, 231, 248, 0.18)",
  background: "rgba(17, 39, 64, 0.98)",
  color: "#eef6ff",
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1.2,
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
};

const launchPrimaryButtonStyle = {
  width: "100%",
  padding: "15px 16px",
  borderRadius: 18,
  border: "1px solid rgba(214, 231, 248, 0.16)",
  background: "linear-gradient(180deg, #2f9b84 0%, #2a7262 100%)",
  color: "#f7fffe",
  fontSize: 15.5,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 14px 24px rgba(4, 10, 16, 0.18)",
};

const launchSecondaryButtonStyle = {
  ...launchPrimaryButtonStyle,
  background: "linear-gradient(180deg, rgba(36, 91, 137, 0.98) 0%, rgba(23, 61, 99, 0.98) 100%)",
};

const launchErrorStyle = {
  color: "#ffd1d1",
  fontSize: 13.5,
  fontWeight: 750,
  lineHeight: 1.4,
  textAlign: "left",
};

const launchLegalLinkStyle = {
  color: "#84e8df",
  fontWeight: 900,
};

function PasswordCheck({ ok, children }) {
  return (
    <div style={{ color: ok ? "#88e8bd" : "rgba(228, 239, 249, 0.68)", fontWeight: 800 }}>
      {ok ? "✓" : "-"} {children}
    </div>
  );
}

const launchTextButtonStyle = {
  width: "100%",
  padding: "10px 8px",
  border: "none",
  background: "transparent",
  color: "#d8fffb",
  fontSize: 14.5,
  fontWeight: 850,
  cursor: "pointer",
};

const launchSectionLabelStyle = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#6ce0d5",
  textAlign: "left",
};

function TenantLaunchOption({ option, onSelectTenant }) {
  return (
    <button
      type="button"
      onClick={() => {
        void onSelectTenant?.(option.tenantKey);
      }}
      style={{
        width: "100%",
        display: "grid",
        gap: 4,
        textAlign: "left",
        padding: "14px 16px",
        borderRadius: 18,
        border: "1px solid rgba(214, 231, 248, 0.16)",
        background: "linear-gradient(180deg, rgba(29, 62, 103, 0.98) 0%, rgba(20, 46, 77, 0.98) 100%)",
        color: "#eef6ff",
        boxShadow: "0 10px 18px rgba(4, 10, 16, 0.18)",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.15 }}>
        {option.displayName || option.name}
      </span>
      <span style={{ fontSize: 12.5, lineHeight: 1.45, color: "rgba(228, 239, 249, 0.76)" }}>
        {option.primarySubdomain || `${option.tenantKey}.cityreport.io`}
      </span>
    </button>
  );
}

export function TenantPublicOnboardingScreen({
  organizationName = "your city",
  onSignIn,
  onSignUp,
  onExploreGuest,
}) {
  const onboardingCards = [
    {
      key: "map",
      eyebrow: "Report",
      title: "Tap the map to report",
      body: "Choose incident reporting for potholes and water/drain issues, or switch to Streetlights for asset-based reporting.",
    },
    {
      key: "reports",
      eyebrow: "Follow",
      title: "Check Reports",
      body: "Reports shows your submitted issues and nearby activity so you can see what is already being tracked.",
    },
    {
      key: "alerts",
      eyebrow: "Stay Updated",
      title: "Use Alerts and Events",
      body: "Public notices are available right away. Sign in later if you want notification preferences and saved history.",
    },
  ];

  return (
    <AppLaunchInteractiveScreen
      eyebrow={organizationName}
      title={`Welcome to ${organizationName}`}
      subtitle="Choose how you want to start. You can explore as a guest, or sign in to keep reports, followed cities, and notifications connected to you."
      status="Quick tour"
    >
      <div style={{ display: "grid", gap: 12 }}>
        {onboardingCards.map((card) => (
          <div
            key={card.key}
            style={{
              display: "grid",
              gap: 5,
              textAlign: "left",
              padding: "14px 16px",
              borderRadius: 18,
              border: "1px solid rgba(214, 231, 248, 0.14)",
              background: "linear-gradient(180deg, rgba(29, 62, 103, 0.96) 0%, rgba(20, 46, 77, 0.96) 100%)",
              color: "#eef6ff",
              boxShadow: "0 10px 18px rgba(4, 10, 16, 0.14)",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#6ce0d5",
              }}
            >
              {card.eyebrow}
            </span>
            <span style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.15 }}>
              {card.title}
            </span>
            <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "rgba(228, 239, 249, 0.82)" }}>
              {card.body}
            </span>
          </div>
        ))}

        <div
          style={{
            padding: "13px 15px",
            borderRadius: 18,
            border: "1px solid rgba(108, 224, 213, 0.16)",
            background: "rgba(108, 224, 213, 0.10)",
            color: "#d8fffb",
            fontSize: 13.5,
            lineHeight: 1.5,
            textAlign: "left",
          }}
        >
          Best first step: open <b>Map</b>, choose a layer, and explore what is already being reported in {organizationName}.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 9 }}>
          <button
            type="button"
            onClick={() => onSignIn?.()}
            style={{
              width: "100%",
              padding: "15px 16px",
              borderRadius: 18,
              border: "1px solid rgba(214, 231, 248, 0.16)",
              background: "linear-gradient(180deg, #2f9b84 0%, #2a7262 100%)",
              color: "#f7fffe",
              fontSize: 15.5,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 14px 24px rgba(4, 10, 16, 0.18)",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onSignUp?.()}
            style={{
              width: "100%",
              padding: "15px 16px",
              borderRadius: 18,
              border: "1px solid rgba(108, 224, 213, 0.24)",
              background: "linear-gradient(180deg, rgba(36, 123, 105, 0.88) 0%, rgba(31, 91, 80, 0.88) 100%)",
              color: "#f7fffe",
              fontSize: 15,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => onExploreGuest?.()}
            style={{
              width: "100%",
              padding: "13px 16px",
              borderRadius: 18,
              border: "1px solid rgba(214, 231, 248, 0.18)",
              background: "rgba(17, 39, 64, 0.74)",
              color: "#eef6ff",
              fontSize: 14.5,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Explore as Guest
          </button>
        </div>
      </div>
    </AppLaunchInteractiveScreen>
  );
}
