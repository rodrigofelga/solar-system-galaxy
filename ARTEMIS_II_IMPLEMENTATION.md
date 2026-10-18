# Artemis II — integrated Solar System review

Implemented and visually reviewed locally. The user authorized committing and pushing this refactor on 18 October 2026.

## What changed

The normal SolarSystemView.update loop is now the only authority for Earth orbit, Earth rotation/clouds, Moon orbit and Moon rotation. Artemis never reparents, moves, rotates, rescales, hides, restores, or disposes either celestial object. Toggling Artemis, seeking and changing replay speed leave those transforms untouched. The existing textures, lunar relief, atmosphere, lighting and orbit visibility remain in place.

Artemis uses a scene-level Earth-relative frame. Each frame reads Earth and Moon world positions. The frame origin follows the existing Earth. During replay its orientation reads the existing Moon-parent world quaternion, so its +X direction follows the Moon. There is no new lunar or Earth clock and no additional celestial mesh. The ghost sphere and Moon-at-flyby label are removed completely.

## Trajectory interpretation and limits

The original NASA-derived data and interpolation remain in trajectory.js. The precomputed source curve is compressed by existing lunar radius / source flyby lunar radius. Radial clearance adjustments keep the exaggerated Orion model outside Earth (1.24 scene units during flight) and Moon (0.64 units). The illustrated capsule arrival approaches 0.95 units from Earth's centre. The route's frame turns with the existing 2.7-second educational lunar orbit, so the single far-side arc meets the existing moving Moon at the flyby chapter. It is not a sustained lunar orbit around the Moon, nor an exact NASA ephemeris reconstruction. The whole route co-rotates with the educational Moon; world-space motion therefore includes this deliberately exaggerated rotation.

No real-world position or timestamp is claimed for the adapted geometry. The UI calls the clock a source timestamp and labels the geometry as adapted. NASA data defines the reference shape and chapter sequence, not the displayed celestial positions. The first and last bookends remain synthetic illustrations. The published OEM includes a forecast tail. Reference Moon calculations remain source-basis calculations only; they never animate the visible Moon.

Primary references remain [NASA SVS 20412](https://svs.gsfc.nasa.gov/20412/), the [NASA OEM source page](https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/), and the separate [flight-derived visualization](https://svs.gsfc.nasa.gov/5632/). Attribution and source licensing are retained in ASSET_ATTRIBUTION.md. Orion remains original procedural geometry; no new external model or image was added.

## Playback and camera

One Orion replay takes 120 seconds at replay 1x and global 1x, with nonuniform chapter pacing. Enabling starts playback automatically. Replay speed and progress change only Orion. Global Pause/0x holds the entire simulation. Mission Pause freezes Orion's progress and its Earth-relative route orientation; Earth and Moon keep their ordinary motion. The frozen frame still translates with Earth. On resume its orientation catches up smoothly to the current lunar frame. During that brief catch-up, the future encounter is an illustration rather than an exact simultaneous match.

Camera/chapter shortcuts and seeking preserve playback. Flyby and Return seek the replay only. Camera tracking applies moving-target deltas while preserving the user's orbit/zoom/pan offset. Camera mode changes blend into position without directly snapping. Host Earth/Moon Focus releases the mission camera so only one camera owner updates. Switching Artemis off retains the current camera pose and any active host planet Focus. It does not rewind celestial state or change orbital visibility.

## Files changed by this refactor

- js/solar-system-view.js: remove Artemis exceptions from ordinary Earth/Moon updates and orbit visibility.
- js/mission/artemis-mission.js: read-only host reference frame, adapted route, no celestial ownership/ghost, tracking and independent replay.
- js/mission/trajectory.js: pure integratedPosition scale/clearance helper; original NASA interpolation preserved.
- js/mission/artemis-controls.js: seeking preserves playback, independent pause explanations and source-clock disclosure.
- index.html: corrected mission scale/clock explanations.
- ASSET_ATTRIBUTION.md: distinguish reference lunar data from the host Moon animation.
- tests/artemis-trajectory.test.mjs and tests/artemis-browser.html: numerical and actual host-update regression coverage.
- artifacts/artemis-review/: test evidence and integrated desktop/mobile screenshots.

Unrelated working-tree edits from earlier/concurrent work are preserved. Existing lighting, translation and Milky Way code was not refactored.

## Validation

Node suite: 8 passed, 0 failed. This includes original source/interpolation checks and adapted-body clearance at 10,001 progress values.

Browser suite: 13 passed, 0 failed. Uses the actual SolarSystemView.prototype.update and Focus methods with real Three.js scene transforms and OrbitControls. Checks original OFF motion, identical ON orbital rates, unchanged hierarchy/transforms/materials/visibility, seek at seven phases, far-side encounter at four lunar angles, departure/return, absence of duplicate Moon, independent mission pause/speed, global pause/0x, camera ownership/continuous tracking, OFF without an orbital jump, repeated toggles and disposal safety.

Actual explorer: desktop and mobile-width toggle, flyby camera, progress, speed and trajectory controls exercised; no captured JavaScript/WebGL warnings or errors. Desktop screenshot: integrated-desktop-flyby.jpg. Mobile screenshot: integrated-mobile-flyby.jpg. Mobile viewport 390x844; document width and scroll width both 375, no horizontal overflow. Temporary viewport override reset. Physical touch hardware and frame-time/GPU benchmarks were not tested.

Visual approval received; approved for deployment.
