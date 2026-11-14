// WEB PREVIEW ONLY (metro.config.js routes react-native-safe-area-context's
// internal ./NativeSafeAreaProvider here when platform === "web").
//
// A desktop browser has no notch / home indicator, so env(safe-area-inset-*)
// is 0 and every screen sits flush to the edges. Inside the iphone.html device
// frame, report real iPhone insets instead so headers, the floating tab bar
// and bottom docks land where they do on the phone. Outside the frame, the
// library's own browser implementation runs unchanged.
import * as React from "react";
import { View } from "react-native";
import { NativeSafeAreaProvider as BrowserSafeAreaProvider } from "react-native-safe-area-context/src/NativeSafeAreaProvider.web";

import { IN_IPHONE_FRAME, IPHONE_INSETS } from "../device-mode";

function IPhoneFrameSafeAreaProvider({ children, style, onInsetsChange }) {
  React.useEffect(() => {
    const report = () =>
      onInsetsChange({
        nativeEvent: {
          insets: IPHONE_INSETS,
          frame: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
        },
      });
    report();
    window.addEventListener("resize", report);
    return () => window.removeEventListener("resize", report);
  }, [onInsetsChange]);
  return <View style={style}>{children}</View>;
}

export const NativeSafeAreaProvider = IN_IPHONE_FRAME
  ? IPhoneFrameSafeAreaProvider
  : BrowserSafeAreaProvider;
