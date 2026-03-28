export const STANDARD_LOGIN_FORM_PROPS = {
  autoComplete: "on",
};

export const STANDARD_LOGIN_EMAIL_INPUT_PROPS = {
  type: "email",
  autoComplete: "email",
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
  placeholder: "Email",
};

export function getStandardLoginPasswordInputProps(showPassword = false) {
  return {
    type: showPassword ? "text" : "password",
    autoComplete: "current-password",
    placeholder: "Password",
  };
}
