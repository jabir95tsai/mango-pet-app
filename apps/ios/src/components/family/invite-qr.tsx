/**
 * Invite QR (P4b) — react-native-qrcode-svg (depends on react-native-svg).
 * H-level error correction (survives logo overlay + print/screen scaling),
 * mango-amber on white, matching the web my-qr-dialog look. Encodes a full URL
 * (family `${SITE_URL}/join/{code}` or friend add link), so a scan from any
 * camera opens the cross-platform web flow.
 */
import { StyleSheet, View, type ImageSourcePropType } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { colors, radius } from "@/theme/theme";

export function InviteQR({
  url,
  size = 240,
  logo,
}: {
  url: string;
  size?: number;
  /** Centre logo (web my-qr-dialog Mango mark); H-level ECL survives it. */
  logo?: ImageSourcePropType;
}) {
  return (
    <View style={styles.box}>
      <QRCode
        value={url}
        size={size}
        color="#b45309"
        backgroundColor="#ffffff"
        ecl="H"
        quietZone={8}
        logo={logo}
        logoSize={logo ? Math.round(size * 0.2) : undefined}
        logoBackgroundColor="#ffffff"
        logoBorderRadius={12}
        logoMargin={2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: radius.xl2,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignSelf: "center",
  },
});
