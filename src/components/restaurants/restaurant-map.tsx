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
  const meMarkerRef = useRef<google.maps.Marker | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Map error"));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep "me" marker in sync with center
  useEffect(() => {
    if (meMarkerRef.current) meMarkerRef.current.setPosition(center);
    if (mapRef.current) mapRef.current.panTo(center);
  }, [center.lat, center.lng]);

  // Render restaurant markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = markersRef.current;
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
        marker.addListener("click", () => onSelect?.(r.restaurantId));
        existing.set(r.restaurantId, marker);
      } else {
        marker.setPosition(r.location);
      }

      marker.setZIndex(isSelected ? 999 : undefined);
    });

    // Remove stale markers
    for (const [id, marker] of existing) {
      if (!seen.has(id)) {
        marker.setMap(null);
        existing.delete(id);
      }
    }
  }, [restaurants, selectedId, onSelect]);

  return (
    <div className={className ?? "h-80 w-full rounded-2xl overflow-hidden border border-amber-200/60 dark:border-zinc-800"}>
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
