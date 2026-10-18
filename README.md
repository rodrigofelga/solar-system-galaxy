# Solar System & Milky Way Explorer

An interactive, browser-based educational visualization of the Solar System traveling around the Milky Way. The site combines a stylized 2D galactic overview with a navigable WebGL Solar System explorer.

## Current features

- Preserved animated Milky Way canvas showing the Solar System's illustrative galactic orbit.
- Three.js/WebGL Solar System with the Sun and all eight planets as true 3D sphere geometry.
- Mouse and touch navigation: orbit, zoom, and pan using Three.js `OrbitControls`.
- Locally stored NASA/JPL texture maps for the Sun, eight planets, and Earth’s Moon, with procedural fallback while textures load.
- NASA CGI Moon Kit terrain: LROC colour map plus LOLA elevation as displacement/bump maps on an adaptive-resolution sphere (320×160 segments on desktop, 128×64 on mobile/coarse-pointer devices).
- Procedural animated Sun (`js/sun/`): GPU fBM plasma shader, camera-facing corona, and arcing prominences, with automatic quality scaling (add `?sunQuality=low|medium|high` to force a level).
- Raycast selection, smooth focus camera transitions, optional follow mode, Earth–Moon focus, previous/next navigation, and responsive educational information panels.
- Independently animated planetary revolutions, axial rotations, axial tilts, retrograde Venus/Uranus rotation, solar lighting, a starfield, Saturn's rings, and a selectable Moon orbiting Earth.
- Animation, reset-camera, galactic-orbit, planetary-orbit, speed, body-navigation, and overview controls.

## Run locally

Use a local static web server rather than opening `index.html` directly, because the app loads JavaScript modules:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/` in a modern browser. The site uses a pinned Three.js CDN module and has no build-time dependencies.

## Publish with GitHub Pages

1. Push this folder to a public GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/(root)**, and **Save**.
4. Your site will be published at `https://YOUR_USERNAME.github.io/solar-system-galaxy/`.

## Notes

- Planet distances, sizes, orbital speed, rotation speed, and galactic movement are illustrative and not to scale.
- Galactic and planetary motion use separate accelerated educational time scales and are not physically synchronized.
- See `ASSET_ATTRIBUTION.md` for texture sources, NASA/JPL attribution, and educational-data notes.
- The project is static and continues to deploy from the repository root with GitHub Pages; no Vite configuration is required.
