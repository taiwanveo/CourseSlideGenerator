export const ONBOARDING_DISMISSED_KEY = "csg:onboarding:dismissed:v1";

export function isOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOnboardingDismissed(value: boolean): void {
  try {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}
