# Solar System Galactic Journey

An interactive part of the Milky Way explorer. It shows the Sun travelling around the galaxy, the planets travelling with it, and each planet orbiting the Sun throughout. It is opened from the Milky Way controls and uses that view's scene, renderer and spiral arms.

## One simulation

`js/journey/journey-model.js` holds all the motion, as pure functions of one model time `t` in seconds:

```text
planetPosition(t) = sunPosition(t) + planetOffset(t)
planetOffset(t)   = orbit × (cos a(t) × ECLIPTIC_X + sin a(t) × ECLIPTIC_Y)
```

- Planets are never animated on their own paths, so they cannot detach from the Sun.
- Every view reads the same `t`. Compare mode draws one instant twice.
- Trails are evaluated from the same formula in a vertex shader, using a fixed number of vertices. They use no stored history, so they stay bounded and follow any change of time.
- Reference frames only change the centre of a trail: the Sun now for Sun-centred, the Sun at that earlier moment for galactic. This is why a closed ring opens into a wave.
- `js/journey/journey-scene.js` draws the state, `js/journey/journey-controls.js` owns the clock and interface, and `js/data/journey-text.js` holds the English and Brazilian Portuguese text.

## Time and scale

Both clocks are compressed, by very different amounts, so the trails illustrate the model and are not measured paths.

| Quantity | Real | Shown |
| --- | --- | --- |
| Earth orbit | 1 year | 16 s at 1× |
| Galactic orbit | about 220–250 million years | about 60 s at 1×, about 3.7 Earth orbits |
| Sun speed around the galaxy | very roughly 200–230 km/s | 2.73 units/s |
| Earth speed around the Sun | about 30 km/s | 0.82 units/s |
| Sun-to-Earth speed ratio | about 7.7 to 1 | about 3.3 to 1 |
| Solar System size | about 9 billion km across | enlarged about 16 million times, with planet sizes enlarged further |

The Sun is still faster than every planet, as it is in reality. The planets' waves are exaggerated because the ratio is smaller than the real one.

## Geometry and approximations

- The planets' plane uses the J2000 ecliptic converted with the Hipparcos equatorial-to-galactic rotation. This gives 60.19° to the galactic plane, with the ecliptic pole at about l = 96.4°, b = 29.8°.
- The plane is held fixed in space while the Sun moves. The angle between the direction of travel and the plane therefore changes around the orbit.
- The Sun's galactic path is a circle with a gentle vertical bob. The amplitude and the 3.2 cycles per orbit are approximate, and the real path also moves in and out. The gold ring shows the mean path, and the Sun's own trail includes the bob.
- Planet orbits are circles in one plane, and starting positions are illustrative.
- The galaxy is a still backdrop so that motion is easy to read, though real neighbouring stars orbit too.
- The "vortex" illustration in the fourth activity is deliberately wrong and is labelled as inaccurate on screen. It is built from `vortexPosition()` and is not part of the real simulation.

## References

- The video "The helical model - our solar system is a vortex" was the prompt for this feature. Only its YouTube page title was accessible during development and the video itself was not watched, so nothing here is based on or copied from its footage.
- Ethan Siegel, [Our Motion Through Space Isn't A Vortex](https://www.forbes.com/sites/startswithabang/2018/08/30/our-motion-through-space-isnt-a-vortex-but-something-far-more-interesting/), Forbes, 2018.
- GRAVITY Collaboration, [A geometric distance measurement to the Galactic center black hole](https://www.aanda.org/articles/aa/abs/2019/05/aa35656-19/aa35656-19.html), A&A, 2019.
- NASA, [Planetary fact sheets](https://nssdc.gsfc.nasa.gov/planetary/factsheet/).
- Wikipedia, [Galactic coordinate system](https://en.wikipedia.org/wiki/Galactic_coordinate_system), [Ecliptic](https://en.wikipedia.org/wiki/Ecliptic) and [Galactic year](https://en.wikipedia.org/wiki/Galactic_year).

## Tests

```bash
node --test tests/journey-model.test.mjs
```
