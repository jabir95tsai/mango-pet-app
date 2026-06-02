/** AsyncStorage key marking that first-login onboarding was completed/skipped.
 *  Read once on the sign-in transition (root navigator) to decide whether to
 *  land a new user on /onboarding. */
export const ONBOARDED_KEY = "mango.onboarded";
