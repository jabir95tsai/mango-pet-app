"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/maps";
import type { Restaurant } from "@/lib/types";

type Props = {
  restaurants: Restaurant[];
  center: { lat: number; lng: number };
  selectedId?: string;
  onSelect?: (restaurantId: string) => void;
  className?: string;
};

export function RestaurantMap({
  restaurants,
  center,
  selectedId,
  onSelect,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const markerListenersRef = useRef<Map<string, google.maps.MapsEventListener>>(
    new Map(),
  );
  const meMarkerRef = useRef<google.maps.Marker | null>(null);
  // Keep latest onSelect in a ref so marker click handlers don't need to be
  // re-registered every render (which would otherwise leak listeners).
  const onSelectRef = useRef(onSelect);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Init map once
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new g.maps.Map(containerRef.current, {
          center,
          zoom: 14,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          zoomControl: true,
          clickableIcons: false,
        });

        meMarkerRef.current = new g.maps.Marker({
          position: center,
          map: mapRef.current,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
          title: "You",
          zIndex: 1000,
        });

        setMapReady(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Map error"));

    return () => {
      cancelled = true;
      // Dispose markers + listeners
      for (const listener of markerListenersRef.current.values()) {
        listener.remove();
      }
      markerListenersRef.current.clear();
      for (const marker of markersRef.current.values()) {
        marker.setMap(null);
      }
      markersRef.current.clear();
      if (meMarkerRef.current) {
        meMarkerRef.current.setMap(null);
        meMarkerRef.current = null;
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep "me" marker + map center in sync
  useEffect(() => {
    if (meMarkerRef.current) meMarkerRef.current.setPosition(center);
    if (mapRef.current) mapRef.current.panTo(center);
  }, [center.lat, center.lng]);

  // Render restaurant markers — NOTE: onSelect intentionally NOT in deps
  // because we read it via onSelectRef.current to avoid re-creating listeners.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = markersRef.current;
    const listeners = markerListenersRef.current;
    const seen = new Set<string>();

    restaurants.forEach((r) => {
      seen.add(r.restaurantId);
      let marker = existing.get(r.restaurantId);
      const isSelected = r.restaurantId === selectedId;

      if (!marker) {
        marker = new google.maps.Marker({
          position: r.location,
          map,
          title: r.name,
          label: {
            text: "🐾",
            fontSize: "16px",
          },
        });
        const listener = marker.addListener("click", () => {
          onSelectRef.current?.(r.restaurantId);
        });
        existing.set(r.restaurantId, marker);
        listeners.set(r.restaurantId, listener);
      } else {
        marker.setPosition(r.location);
      }

      marker.setZIndex(isSelected ? 999 : undefined);
    });

    // Remove stale markers + their listeners
    for (const [id, marker] of existing) {
      if (!seen.has(id)) {
        listeners.get(id)?.remove();
        listeners.delete(id);
        marker.setMap(null);
        existing.delete(id);
      }
    }
  }, [restaurants, selectedId, mapReady]);

  return (
    <div
      className={
        className ??
        "h-80 w-full overflow-hidden rounded-lg border border-zinc-200/80 dark:border-zinc-800"
      }
    >
      {error ? (
        <div className="h-full grid place-items-center p-6 text-center text-sm text-zinc-500">
          地圖載入失敗：{error}
        </div>
      ) : (
        <div ref={containerRef} className="h-full w-full" />
      )}
    </div>
  );
}
