// Auth / guest surfaces. Import from "@/components/auth".
export {
  GuestUpgradeProvider,
  useGuestUpgrade,
  GuestLockedNotice,
  GuestUpgradeNudge,
  GUEST_NUDGE_DISMISS_KEY,
  type GuestLockedFeature,
  type GuestUpgradeContextValue,
} from "./guest-upgrade";
export { signInErrorMessage, upgradeErrorMessage } from "./auth-errors";
export { GoogleIcon, AppleIcon } from "./provider-icons";
export { withAlpha } from "./color";
