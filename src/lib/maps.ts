"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let loaderPromise: Promise<typeof google> | null = null;

// Surface auth failures (invalid key / referer block) as a rejected promise
// rather than a silent console warning that leaves the UI hanging on "loading".
let authFailureRejecter: ((err: Error) => void) | null = null;
if (typeof window !== "undefined") {
  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
    const err = new Error(
      "Google Maps authentication failed (check API key referrer + enabled APIs).",
    );
    authFailureRejecter?.(err);
    // Reset the singleton so the next mount can retry once keys are fixed.
    loaderPromise = null;
  };
}

const LOAD_TIMEOUT_MS = 15_000;

export function loadGoogleMaps(): Promise<typeof google> {
  if (loaderPromise) return loaderPromise;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error(
        "Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — enable Maps JavaScript API and set the key.",
      ),
    );
  }

  setOptions({
    key: apiKey,
    v: "weekly",
    libraries: ["places", "marker"],
    language: "zh-TW",
    region: "TW",
  });

  loaderPromise = new Promise<typeof google>((resolve, reject) => {
    authFailureRejecter = reject;
    const timer = setTimeout(() => {
      reject(new Error("Google Maps load timed out after 15s."));
      loaderPromise = null;
    }, LOAD_TIMEOUT_MS);

    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(() => {
        clearTimeout(timer);
        if (typeof window !== "undefined" && window.google) {
          resolve(window.google);
        } else {
          reject(new Error("Google Maps loaded but global is missing."));
          loaderPromise = null;
        }
      })
      .catch((err) => {
        clearTimeout(timer);
        loaderPromise = null;
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });

  return loaderPromise;
}

const FALLBACK_LOCATION = { lat: 25.0339, lng: 121.5644 }; // Taipei 101

export async function getCurrentLocation(): Promise<{
  lat: number;
  lng: number;
  fromBrowser: boolean;
}> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return { ...FALLBACK_LOCATION, fromBrowser: false };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          fromBrowser: true,
        }),
      () => resolve({ ...FALLBACK_LOCATION, fromBrowser: false }),
      { timeout: 8000, maximumAge: 60_000 },
    );
  });
}

export const DEFAULT_LOCATION = FALLBACK_LOCATION;
