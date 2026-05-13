"use client";

import type { WalkPathPoint } from "./types";

/**
 * Haversine distance in km.
 */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

const MIN_ACCEPTABLE_ACCURACY_M = 50;
const MIN_DISTANCE_M_BETWEEN_SAMPLES = 5;
const MAX_PATH_POINTS = 500;

export type WalkSessionState = {
  isTracking: boolean;
  startedAt: Date | null;
  totalDistanceKm: number;
  durationMin: number;
  path: WalkPathPoint[];
  lastError: string | null;
};

export type WalkSessionListener = (state: WalkSessionState) => void;

export class WalkSession {
  private watchId: number | null = null;
  private state: WalkSessionState = {
    isTracking: false,
    startedAt: null,
    totalDistanceKm: 0,
    durationMin: 0,
    path: [],
    lastError: null,
  };
  private listeners = new Set<WalkSessionListener>();
  private ticker: ReturnType<typeof setInterval> | null = null;

  on(listener: WalkSessionListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l(this.state);
  }

  private update(patch: Partial<WalkSessionState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  start() {
    if (this.state.isTracking) return;
    if (!("geolocation" in navigator)) {
      this.update({ lastError: "Browser does not support geolocation" });
      return;
    }

    this.update({
      isTracking: true,
      startedAt: new Date(),
      totalDistanceKm: 0,
      durationMin: 0,
      path: [],
      lastError: null,
    });

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos),
      (err) => this.update({ lastError: err.message }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );

    this.ticker = setInterval(() => {
      if (!this.state.startedAt) return;
      const mins = (Date.now() - this.state.startedAt.getTime()) / 60_000;
      this.update({ durationMin: Math.round(mins * 100) / 100 });
    }, 1000);
  }

  stop(): WalkSessionState {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    this.update({ isTracking: false });
    return this.state;
  }

  reset() {
    this.stop();
    this.state = {
      isTracking: false,
      startedAt: null,
      totalDistanceKm: 0,
      durationMin: 0,
      path: [],
      lastError: null,
    };
    this.emit();
  }

  private handlePosition(pos: GeolocationPosition) {
    const accuracy = pos.coords.accuracy ?? Infinity;
    if (accuracy > MIN_ACCEPTABLE_ACCURACY_M) return;

    const point: WalkPathPoint = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      t: pos.timestamp,
    };

    const last = this.state.path[this.state.path.length - 1];
    if (last) {
      const distM = distanceKm(last, point) * 1000;
      if (distM < MIN_DISTANCE_M_BETWEEN_SAMPLES) return;

      const nextDistance = this.state.totalDistanceKm + distM / 1000;
      const nextPath =
        this.state.path.length >= MAX_PATH_POINTS
          ? [...this.state.path.slice(-MAX_PATH_POINTS + 1), point]
          : [...this.state.path, point];
      this.update({
        totalDistanceKm: Math.round(nextDistance * 1000) / 1000,
        path: nextPath,
      });
    } else {
      this.update({ path: [point] });
    }
  }
}
