"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let loaderPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (loaderPromise) return loaderPromise;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error(
        "Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — enable Maps JavaScript API in GCP and add the key to .env.local.",
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

  loaderPromise = (async () => {
    await Promise.all([importLibrary("maps"), importLibrary("marker")]);
    return window.google;
  })();

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
