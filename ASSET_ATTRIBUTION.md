# Asset attribution

## Artemis II interactive mission

The mission is an original interactive Three.js implementation, not an embedded video or NASA-produced interactive. The original procedural Orion model (`js/mission/orion-model.js`) depicts the capsule, European Service Module, four solar wings, and illustrative parachutes. No NASA/ESA 3D model, logo, astronaut likeness, Al Jazeera graphic, or Al Jazeera text is redistributed. The spacecraft is intentionally enlarged and its attitude follows the displayed path rather than measured spacecraft attitude.

Primary conceptual and visual reference: [NASA SVS 20412, Artemis II Flight Path Animations](https://svs.gsfc.nasa.gov/20412/), specifically the linked JSC 2025 mission map. Reference credit: NASA/JSC/Goddard; animators Kim Dongjae and Jonathan North (eMITS), producer Dan Gallagher (eMITS), art director Michael Lentz, project manager Walt Feimer, data provider Ernie Wright, public affairs Lonnie Shekhtman. The map is preflight nominal artwork, not a record of the completed flight. The interaction uses the single-pass flyby/free-return storytelling; it does not copy video frames.

Flight positions: [NASA/JSC Artemis II OEM archive](https://www.nasa.gov/wp-content/uploads/2026/03/all-artemis-ii-oem-files.zip), linked from the [official ephemeris page](https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/). The included source `assets/mission/orion-nasa-source.oem` is the member `Artemis_II_OEM_2026_04_10_Post-ICPS-Sep-to-EI.asc` (originator NASA/JSC/FOD/FDO, creation 2026-04-10 03:22:19 UTC). It contains Earth-centred EME2000 positions and velocities from 2026-04-02 01:57:37.084 UTC to entry interface at 2026-04-10 23:53:16.723 UTC. It is a published reconstructed/predicted ephemeris, including a forecast tail after creation. Do not describe the full file as recorded telemetry. Its SHA-256 and provenance are retained in `artemis-ii.json`.

Lunar coordinates: generated offline using [Astronomy Engine](https://github.com/cosinekitty/astronomy), GeoMoonState in equatorial J2000, Don Cross, MIT. The MIT notice is retained in `assets/mission/ASTRONOMY_ENGINE_LICENSE.txt`. These are calculated Moon positions, not NASA spacecraft tracking data. EME2000/EQJ alignment is sufficient for this enlarged illustration; it is not a high-precision mission-navigation reference frame solution. The calculator is not downloaded or executed by the website; only the generated local data is loaded on demand. These reference Moon coordinates define the source trajectory basis only. The visible Moon always uses the original Solar System hierarchy and animation. The displayed Orion route is compressed to the existing lunar distance and rotated with that hierarchy, with enlarged-body clearance adjustments; it is an educational adaptation, not an exact NASA ephemeris reconstruction.

Timing references: [NASA TLI report](https://www.nasa.gov/blogs/missions/2026/04/02/artemis-ii-flight-day-2-orion-completes-tli-burn-crew-begins-journey-to-the-moon/) (2 April, 19:49 EDT; 5 minutes 50 seconds), [NASA entry updates](https://www.nasa.gov/blogs/missions/2026/04/10/artemis-ii-flight-day-10-re-entry-live-updates/), and the [NASA mission overview](https://www.nasa.gov/mission/artemis-ii/). Launch and splashdown timestamps are rounded to the minute. The earlier launch/orbit and later descent extensions are synthetic and labelled accordingly. Chapter boundaries around the flyby and rendering of separation/deployment are illustrative. The [flight-derived SVS 5632 visualization](https://svs.gsfc.nasa.gov/5632/) is linked separately from the preflight map.

Reuse follows the [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) for educational information, credit, and absence of implied endorsement. NASA does not review or endorse the generated model. Existing planet/Moon texture credits below continue to apply. See `ARTEMIS_II_IMPLEMENTATION.md` for transformations, display exaggeration, timing, tests, and review screenshots.

## Interactive galactic anatomy

Sagittarius A* is an enormously enlarged procedural teaching model (`js/galactic-black-hole.js`), with a dark shadow proxy, animated hot-gas disk, camera-facing light ring, and a schematic broad wind. It is not a relativistic lensing calculation, EHT reconstruction, photograph, or a measured representation of the gas flow. Wind particles appear in the close-up; nearby galactic stars dim for readability. No supplied image pixels are embedded.

Black-hole references: [EHT first-image release](https://eventhorizontelescope.org/blog/astronomers-reveal-first-image-black-hole-heart-our-galaxy) (released 12 May 2022, observations in April 2017); [NASA/JPL overview](https://www.jpl.nasa.gov/edu/resources/teachable-moment/telescopes-get-extraordinary-view-of-milky-ways-black-hole/); [NRAO discovery archives](https://www.nrao.edu/archives/brown-finding-aid); [2020 Nobel Prize](https://www.nobelprize.org/prizes/physics/2020/summary/); [ALMA wind evidence, 4 June 2026](https://www.almaobservatory.org/en/press-releases/alma-finally-catches-the-milky-ways-black-hole-breathing/). The outflow is represented as a broad wind rather than a narrow relativistic jet.

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
| `earth.jpg` | NASA Jet Propulsion Laboratory, [Solar System Maps](https://maps.jpl.nasa.gov/) | Global Earth texture map; an educational visualization rather than a live observation. |
| `moon.jpg` | NASA Scientific Visualization Studio / Lunar Reconnaissance Orbiter Camera, [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) (`lroc_color_2k.jpg`) | Global 2K lunar colour map in longitude–latitude projection, used unmodified as the Moon colour map. |
| `moon-elevation-nasa-1k.jpg` | NASA SVS CGI Moon Kit (`ldem_3_8bit.jpg`), derived from LRO Lunar Orbiter Laser Altimeter (LOLA) topography | Unmodified 1024×512 8-bit elevation map (about −9.1 km to +10.8 km), used as Three.js displacement and bump map. Relief is exaggerated about 4× for visibility. |
| `moon-original-backup.jpg` | Byte-identical copy of the previous `moon.jpg` | Recoverable backup of the Moon texture that existed before the terrain upgrade. |
| `sun.jpg` | NASA Scientific Visualization Studio, solar Carrington-map visualization | Now used only as the Sun's thumbnail in the information panel. The 3D Sun is rendered by original procedural shaders (`js/sun/`); no stock footage, video frames or textures are used. |
| `earth-clouds.png` | NASA Scientific Visualization Studio, [Earth with Clouds](https://svs.gsfc.nasa.gov/3615/) | A local 1024×512 RGBA cloud-shell texture derived from the aligned NASA/GSFC clouded and cloud-free Earth maps. The source describes the cloud coverage as a Climate Prediction Center multi-satellite global cloud composite. RGB preserves the satellite-derived cloud formations; alpha is derived from the difference between the paired maps so clear surface areas remain transparent. |

### Planet texture register

`-high` files are loaded only for the selected planet on non-touch screens at least 640 px in both directions, with a GPU limit of at least 4096 px. All other views use the standard file. No file was upscaled: every output is at or below its source resolution.

| Planet | File | Resolution | Source | Licence or usage basis | Changes |
| --- | --- | --- | --- | --- | --- |
| Mercury | `mercury-high.jpg`, `mercury.jpg` | 4096×2048, 2048×1024 | [Solar System Scope](https://www.solarsystemscope.com/textures/) `8k_mercury.jpg` (8192×4096) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), © Solar System Scope / INOVE | Downsampled |
| Venus | `venus-high.jpg`, `venus.jpg` | 4096×2048, 2048×1024 | Solar System Scope `4k_venus_atmosphere.jpg` (4096×2048) | CC BY 4.0, © Solar System Scope / INOVE | Wrap seam feathered; downsampled. This is an artist-processed cloud map, not one photographic mosaic. |
| Mars | `mars-high.jpg`, `mars.jpg` | 4096×2048, 2048×1024 | Solar System Scope `8k_mars.jpg` (8192×4096) | CC BY 4.0, © Solar System Scope / INOVE | Saturation reduced to 82% to offset the source's stated colour boost; downsampled |
| Jupiter | `jupiter-high.jpg`, `jupiter.jpg` | 3600×1800, 2048×1024 | NASA/JPL/Space Science Institute, Cassini [PIA07782](https://photojournal.jpl.nasa.gov/catalog/PIA07782) full-resolution TIFF (3601×1801), December 2000 | NASA [media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/); no endorsement implied | Duplicate wrap column and row removed; seam feathered; downsampled for the standard file. Polar regions are less clear because Cassini viewed them obliquely. |
| Saturn | `saturn-high.jpg`, `saturn.jpg` | 4096×2048, 2048×1024 | Solar System Scope `8k_saturn.jpg` (delivered as 4096×2048) | CC BY 4.0, © Solar System Scope / INOVE | Wrap seam feathered; downsampled for the standard file. Its fine detail is low, because the source is smooth. |
| Saturn rings | `saturn-rings.png` | 4096×8 RGBA | Solar System Scope `8k_saturn_ring_alpha.png` (8192×500) | CC BY 4.0, © Solar System Scope / INOVE | Reduced to a radial strip. Ring radii of 1.20–2.33 Saturn radii were fitted to the map's Encke Gap and B-ring edge; expect about 1–2% radial error. |
| Uranus | `uranus.jpg` | 1024×512 | Solar System Scope `2k_uranus.jpg` (2048×1024) | CC BY 4.0, © Solar System Scope / INOVE | Downsampled, because the source is a smooth gradient with no finer detail |
| Neptune | `neptune.jpg` | 2048×1024 | Solar System Scope `2k_neptune.jpg` (2048×1024) | CC BY 4.0, © Solar System Scope / INOVE | Features resembling the storms Voyager 2 saw in 1989, including the Great Dark Spot, painted out by cloning same-latitude atmosphere from another longitude, because they are not permanent; wrap seam feathered. Small bright clouds kept. Source detail is soft. |

Solar System Scope states that its textures are based on NASA elevation and imagery data, with colours tuned to true-colour photographs from Messenger, Viking, Cassini, and the Hubble Space Telescope. It also states that colours are slightly more saturated than real life and that unmapped areas are filled with fictional terrain matching the surroundings. These maps are therefore scientifically informed educational textures, not raw mission mosaics. Only the Jupiter map comes directly from a mission product.

The planet maps above replace the earlier files of the same names; the previous versions remain in Git history. Exposure gains and removal of the warm tint of the display light are applied in `js/data/planets.js` and `js/solar-system-view.js`; they are display choices, not measured albedo.

Earth’s cloud layer is a separate, transparent spherical shell just above the surface. It rotates independently at a slower illustrative rate; it is not a live weather product.

NASA media is generally usable for educational and informational purposes subject to NASA’s media-usage guidance. NASA identifiers, logos, and endorsements are not implied. See NASA’s [media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

## Educational data

The values and explanatory text in `js/data/celestial-bodies.js` are summarized for educational use from NASA Solar System Exploration and NASA/JPL mission resources. Moon-count values can change as discoveries and classifications are updated; Jupiter, Saturn, Uranus, and Neptune counts are explicitly dated September 2026 in the interface.
