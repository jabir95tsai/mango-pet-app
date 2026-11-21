/**
 * Walk-page maps (docs/features/ios-walk-map-redesign.md):
 *  - HomeWalkMap: static 280pt "where you are" map on the walks tab. Never
 *    asks for permission (that stays on Start); without permission / a fix it
 *    shows the same-height illustration card so the layout never jumps.
 *  - LiveWalkMap: full-bleed map behind the tracking screen; live polyline per
 *    segment (pauses never join), follows the newest point until the user
 *    drags. `padding` keeps the camera centre and the overlays clear of the
 *    floating header / bottom card.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, StyleSheet, View } from "react-native";
import * as Location from "expo-location";
import MapView, { Polyline, type LatLng } from "react-native-maps";
import { LocateFixed, MapPin } from "lucide-react-native";
import type { WalkRoutePoint } from "@mango/shared-types";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { routeSegments } from "@/lib/walk-route-read-policy";
import { colors, radius, spacing } from "@/theme/theme";

// Taller than the spec's 280 (user 2026-11-21): the map leads, records scroll below.
const HOME_MAP_HEIGHT = 420;
const CLOSE_DELTA = 0.004;

/** `recheckKey` change (e.g. tracking modal closed) re-reads permission + fix. */
export function HomeWalkMap({ recheckKey }: { recheckKey: unknown }) {
  const [coord, setCoord] = useState<LatLng | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const { granted } = await Location.getForegroundPermissionsAsync();
        if (!granted) {
          if (alive) setCoord(null);
          return;
        }
        const pos =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (alive) setCoord({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        // No fix → keep whatever is shown (card on first load).
      }
    };
    void check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [recheckKey]);

  if (!coord) {
    return (
      <EmptyState
        icon={MapPin}
        title={t("Walks.map.noLocation")}
        style={styles.homeCard}
      />
    );
  }
  return (
    // pointerEvents none: display-only, the page scroll keeps every gesture.
    <View style={styles.homeMap} pointerEvents="none">
      <MapView
        style={StyleSheet.absoluteFill}
        accessibilityLabel={t("Walks.map.label")}
        region={{ ...coord, latitudeDelta: CLOSE_DELTA, longitudeDelta: CLOSE_DELTA }}
        showsUserLocation
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      />
    </View>
  );
}

type MapInsets = { top: number; bottom: number };

/** `children` float centred at the top (status pill, in-walk hints). */
export function LiveWalkMap({
  path,
  padding,
  children,
}: {
  path: WalkRoutePoint[];
  padding: MapInsets;
  children?: ReactNode;
}) {
  const ref = useRef<MapView>(null);
  const zoomed = useRef(false);
  const ready = useRef(false);
  const userCoord = useRef<LatLng | null>(null);
  const [follow, setFollow] = useState(true);
  const reduced = useReducedMotion();

  const center = useCallback(
    (c: LatLng) => {
      const map = ref.current;
      // Camera calls before onMapReady are dropped; onMapReady re-centres.
      if (!map || !ready.current) return;
      const duration = reduced ? 0 : 400;
      // First fix sets a street-level zoom; later moves keep the user's zoom.
      if (zoomed.current) map.animateCamera({ center: c }, { duration });
      else {
        zoomed.current = true;
        map.animateToRegion({ ...c, latitudeDelta: CLOSE_DELTA, longitudeDelta: CLOSE_DELTA }, duration);
      }
    },
    [reduced],
  );

  const last = path[path.length - 1];
  const lastLat = last?.lat;
  const lastLng = last?.lng;
  useEffect(() => {
    if (follow && lastLat != null && lastLng != null) center({ latitude: lastLat, longitude: lastLng });
  }, [follow, lastLat, lastLng, center]);

  // Newest route point, else the blue dot; a stationary phone may not have
  // sent a location event yet, so fall back to the last known fix.
  const centerOnMe = () => {
    const c = last ? { latitude: last.lat, longitude: last.lng } : userCoord.current;
    if (c) return center(c);
    void Location.getLastKnownPositionAsync()
      .then((p) => {
        if (p) center({ latitude: p.coords.latitude, longitude: p.coords.longitude });
      })
      .catch(() => {});
  };

  return (
    <View style={styles.live}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={t("Walks.map.label")}
        showsUserLocation
        mapPadding={{ top: padding.top, bottom: padding.bottom, left: 0, right: 0 }}
        onMapReady={() => {
          ready.current = true;
          centerOnMe();
        }}
        onPanDrag={() => {
          if (follow) setFollow(false);
        }}
        onUserLocationChange={(e) => {
          const c = e.nativeEvent.coordinate;
          if (!c) return;
          userCoord.current = { latitude: c.latitude, longitude: c.longitude };
          // Before the first accepted route point, follow the blue dot.
          if (follow && !last) center(userCoord.current);
        }}
      >
        {routeSegments(path)
          .filter((s) => s.length > 1)
          .map((s, i) => (
            <Polyline
              key={i}
              coordinates={s.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
              strokeColor={colors.brandDeep}
              strokeWidth={4}
            />
          ))}
      </MapView>
      {children ? (
        <View style={[styles.banners, { top: padding.top - 56 }]} pointerEvents="box-none">
          {children}
        </View>
      ) : null}
      {!follow ? (
        <View style={[styles.recenter, { bottom: padding.bottom + spacing.sm }]}>
          <Button
            variant="secondary"
            size="sm"
            pill
            icon={LocateFixed}
            label={t("Walks.map.recenter")}
            onPress={() => {
              setFollow(true);
              centerOnMe();
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  homeCard: { height: HOME_MAP_HEIGHT, justifyContent: "center", marginBottom: spacing.xl },
  homeMap: {
    height: HOME_MAP_HEIGHT,
    marginBottom: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    overflow: "hidden",
  },
  live: { flex: 1 },
  banners: { position: "absolute", left: spacing.md, right: spacing.md, alignItems: "center", gap: spacing.xs },
  recenter: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
