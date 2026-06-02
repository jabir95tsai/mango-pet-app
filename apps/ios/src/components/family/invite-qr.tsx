/**
 * Invite QR (P4b) — react-native-qrcode-svg (depends on react-native-svg).
 * H-level error correction (survives logo overlay + print/screen scaling),
 * mango-amber on white, matching the web my-qr-dialog look. Encodes a full URL
 * (family `${SITE_URL}/join/{code}` or friend add link), so a scan from any
 * camera opens the cross-platform web flow.
 */
import { StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { colors } from "@/theme/theme";

export function InviteQR({ url, size = 240 }: { url: string; size?: number }) {
  return (
    <View style={styles.box}>
      <QRCode
        value={url}
        size={size}
        color="#b45309"
        backgroundColor="#ffffff"
        ecl="H"
        quietZone={8}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignSelf: "center",
  },
});
