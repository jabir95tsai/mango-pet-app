# PWA Icons

`icon.svg` is shipped — works on modern Chrome/Edge/Firefox PWA.

**iOS Safari** still requires PNG for "Add to Home Screen". Before launching:

1. Open `icon.svg` in [https://realfavicongenerator.net](https://realfavicongenerator.net) or
   [https://maskable.app/editor](https://maskable.app/editor)
2. Export `icon-192.png` and `icon-512.png` to this folder
3. Commit them

Or generate locally with ImageMagick:

```powershell
magick convert -background transparent -size 192x192 icon.svg icon-192.png
magick convert -background transparent -size 512x512 icon.svg icon-512.png
```

The manifest references both SVG and PNG, so the browser picks the format it supports.
