# Asset attribution

## Planet and Sun texture maps

All texture files in `assets/textures/` are stored locally for dependable static GitHub Pages delivery. They are used as equirectangular maps on Three.js sphere geometry; they are not ordinary single-view photographs.

| Local file | Source | Notes |
| --- | --- | --- |
| `mercury.jpg`, `venus.jpg`, `earth.jpg`, `mars.jpg`, `jupiter.jpg`, `saturn.jpg`, `uranus.jpg`, `neptune.jpg` | NASA Jet Propulsion Laboratory, [Solar System Maps](https://maps.jpl.nasa.gov/) | Global planet texture maps. JPL notes that gas-giant appearance maps are representative; textures are educational visualizations rather than live observations. |
| `moon.jpg` | NASA Scientific Visualization Studio / Lunar Reconnaissance Orbiter Camera, [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) (`lroc_color_2k.jpg`) | Global 2K lunar colour map in longitude–latitude projection, used unmodified as the Moon colour map. |
| `moon-elevation-nasa-1k.jpg` | NASA SVS CGI Moon Kit (`ldem_3_8bit.jpg`), derived from LRO Lunar Orbiter Laser Altimeter (LOLA) topography | Unmodified 1024×512 8-bit elevation map (about −9.1 km to +10.8 km), used as Three.js displacement and bump map. Relief is exaggerated about 4× for visibility. |
| `moon-original-backup.jpg` | Byte-identical copy of the previous `moon.jpg` | Recoverable backup of the Moon texture that existed before the terrain upgrade. |
| `sun.jpg` | NASA Scientific Visualization Studio, solar Carrington-map visualization | Now used only as the Sun's thumbnail in the information panel. The 3D Sun is rendered by original procedural shaders (`js/sun/`); no stock footage, video frames or textures are used. |
| `earth-clouds.png` | NASA Scientific Visualization Studio, [Earth with Clouds](https://svs.gsfc.nasa.gov/3615/) | A local 1024×512 RGBA cloud-shell texture derived from the aligned NASA/GSFC clouded and cloud-free Earth maps. The source describes the cloud coverage as a Climate Prediction Center multi-satellite global cloud composite. RGB preserves the satellite-derived cloud formations; alpha is derived from the difference between the paired maps so clear surface areas remain transparent. |

Earth’s cloud layer is a separate, transparent spherical shell just above the surface. It rotates independently at a slower illustrative rate; it is not a live weather product.

NASA media is generally usable for educational and informational purposes subject to NASA’s media-usage guidance. NASA identifiers, logos, and endorsements are not implied. See NASA’s [media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

## Educational data

The values and explanatory text in `js/data/celestial-bodies.js` are summarized for educational use from NASA Solar System Exploration and NASA/JPL mission resources. Moon-count values can change as discoveries and classifications are updated; Jupiter, Saturn, Uranus, and Neptune counts are explicitly dated September 2026 in the interface.