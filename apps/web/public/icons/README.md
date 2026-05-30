# PWA Icons

These PNGs are the Mango Pet install icon assets for browser favicon, iOS,
Android, Windows tile, and PWA manifest surfaces.

`mango-pet-logo.png` is the original full-size logo artwork used by the landing
page and social preview metadata.

The root-level files under `public/` mirror the platform-specific icon files
here. Keep both copies in sync because iOS home-screen installs often probe
`/apple-touch-icon.png`, while Chromium installs read `public/manifest.json`.

`web-app-manifest-192x192.png` and `web-app-manifest-512x512.png` are the PWA
install icon paths referenced by the app manifest. The other files use common
RealFaviconGenerator names for platform-specific consumers.

Keep the mango and paw mark inside a maskable icon safe area when replacing the
artwork. The manifest and app metadata both reference these PNG renditions.
