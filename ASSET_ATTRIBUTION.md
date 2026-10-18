# Asset attribution

## Interactive galactic anatomy

The 3D Milky Way uses original procedural point geometry and soft-particle shaders. No reference images, video frames, Gaia stellar catalogue positions, or OGLE catalogue positions are embedded. The supplied anatomy infographic and Gaia illustration informed the visual direction. Particle positions and pink star-forming clusters are schematic; thickness and warp are exaggerated, and halo extents are compressed. The dark matter outline is conceptual, not visible matter or a measured boundary.

The guided tour pauses with the main Pause control and stops when camera navigation begins. The anatomy selector provides keyboard access to every structure, including labels outside the current view.

Educational references:

- [NASA: Galaxy types](https://science.nasa.gov/universe/galaxies/types/) — barred spirals, disks, bulges, stellar populations, and halos.
- [ESA: Fly through Gaia’s 3D map of stellar nurseries](https://www.esa.int/Science_Exploration/Space_Science/Gaia/Fly_through_Gaia_s_3D_map_of_stellar_nurseries) — local gas and dust mapping, extending 4,000 light-years from the Sun; the explorer does not reproduce this dataset.
- [OGLE: A three-dimensional map of the Milky Way using classical Cepheid variable stars](https://ogle.astrouw.edu.pl/cont/4_main/str/3dgal/) — evidence for the warped disk.

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
