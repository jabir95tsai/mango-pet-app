// Web preview has no react-native-maps (same as route-map.web.tsx).
import type { ReactNode } from "react";
import { View } from "react-native";
import type { WalkRoutePoint } from "@mango/shared-types";

export function HomeWalkMap(_: { recheckKey: unknown }) {
  return null;
}
export function LiveWalkMap({ children }: { path: WalkRoutePoint[]; padding: { top: number; bottom: number }; children?: ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}
