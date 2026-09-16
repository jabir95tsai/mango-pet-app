// Shared preview fixtures — inline SVG "photos" so cards render offline.
const svg = (bg1: string, bg2: string, label: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>` +
      `<rect width="640" height="480" fill="url(#g)"/>` +
      `<circle cx="320" cy="215" r="90" fill="rgba(255,255,255,.35)"/>` +
      `<text x="320" y="245" font-size="96" text-anchor="middle">🐶</text>` +
      `<text x="320" y="400" font-family="sans-serif" font-size="30" fill="#231b14" text-anchor="middle">${label}</text>` +
      `</svg>`,
  );

export const petPhotos = [
  svg("#ffe7bf", "#f39800", "芒果 · 公園散步"),
  svg("#e7f2dc", "#5fa858", "芒果 · 草地打滾"),
  svg("#ffe4e6", "#ffb3ba", "芒果 · 午睡"),
];
