export function shouldOpenExpiredSessionPrompt({
  nextSession,
  shouldHydrateMapAuthEagerly,
  userInitiatedLogout,
}) {
  return !nextSession && shouldHydrateMapAuthEagerly && !userInitiatedLogout;
}
