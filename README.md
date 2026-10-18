# Solar System & Milky Way Explorer

### An Interactive Journey Through Our Solar System and Galaxy

An interactive, browser-based astronomy visualization designed to help users explore the Solar System, understand planetary motion, and discover how our Sun and its planets travel through the Milky Way.

The project combines animated celestial mechanics, educational astronomy content, and interactive visual experiences to make space exploration accessible to students, educators, enthusiasts, and curious minds of all ages.

**Live Website:** https://rodrigofelga.github.io/solar-system-galaxy/

**GitHub Repository:** https://github.com/rodrigofelga/solar-system-galaxy

---

## Project Overview

Our Solar System is constantly in motion. Earth rotates on its axis while orbiting the Sun. Other planets follow their own orbital paths, each with different rotational characteristics, orbital periods, and physical properties.

Meanwhile, the Sun carries the entire Solar System along its journey around the centre of the Milky Way galaxy.

The Solar System & Milky Way Explorer aims to demonstrate these interconnected movements through intuitive visualizations and interactive astronomical models.

### Core Objectives

- Visualize the relationship between planetary rotation, orbital revolution, and galactic movement.
- Allow users to explore celestial bodies and learn about their characteristics.
- Illustrate astronomical concepts through accessible, interactive experiences.
- Provide educational explanations grounded in established astronomy research.
- Develop a responsive experience accessible through desktop and mobile browsers.
- Progressively introduce enhanced 3D visualization and scientifically informed simulation features.

## Current Features

### Milky Way Visualization

- Animated representation of the Solar System's movement around the galactic centre.
- Stylized spiral galaxy with thousands of procedurally distributed stars.
- Highlighted galactic orbital path and direction of travel.
- Adjustable animation speed.
- Pause, resume, and reset controls.

### Solar System Visualization

- Animated orbits of all eight recognized planets.
- Visual representation of planetary axial rotation.
- Distinct planetary colours and stylized surface characteristics.
- Saturn's ring visualization.
- Magnified planetary view for improved visibility.
- Responsive rendering across browser window sizes.

### Interactive Controls

Users can control playback, adjust animation speed, reset the simulation, and toggle the galactic orbital path.

The current experience uses illustrative animation scales to make planetary and galactic motion observable within a practical viewing period.

## Planned Development — Interactive 3D Exploration

The project is being developed toward a more immersive, realistic, and educational 3D astronomy experience.

### 3D Solar System

- WebGL-based 3D environment using Three.js.
- Interactive camera rotation, zoom, and navigation.
- Three-dimensional planetary models.
- Enhanced solar lighting, shadows, and atmospheric effects.
- Realistic planetary textures from appropriately licensed astronomical sources.
- Orbital paths, axial tilts, and planet-specific rotational behaviour.

### Planetary Exploration

- Select individual planets for focused viewing.
- Smooth camera movement toward selected celestial bodies.
- Detailed educational information panels.
- Planetary diameter, temperature, orbital period, rotational period, and astronomical characteristics.
- Interactive presentation of notable planetary features.

### Earth and Moon

- Three-dimensional representation of Earth's Moon.
- Lunar orbit around Earth.
- Synchronous lunar rotation.
- Realistic lunar surface appearance.
- Interactive navigation between Earth and the Moon.
- Educational information about lunar phases, tides, and orbital mechanics.

### Galactic Exploration

- Enhanced visualization of the Milky Way's structure.
- Representation of the Sun's approximate position within the galaxy.
- More immersive galactic perspective and camera navigation.
- Improved transitions between galactic and planetary scales.

*Planned features are development objectives and should not be interpreted as currently available functionality.*

## Technology and Architecture

The initial application is designed as a lightweight static website.

**Current implementation:**

- HTML5 — Application structure.
- CSS3 — Responsive design and visual styling.
- JavaScript — Animation logic and interactive controls.
- Canvas 2D — Procedural astronomical rendering.
- Git and GitHub — Version control.
- GitHub Pages — Public static website hosting.

**Planned technology:**

- Three.js and WebGL for interactive 3D visualization.
- Modular JavaScript architecture for improved maintainability.
- Optimized astronomical textures and assets.
- Responsive mouse and touchscreen camera controls.

The project is intended to remain compatible with static website hosting without requiring a dedicated application server.

## Run Locally

### Current Static Version

Clone the repository:

```bash
git clone https://github.com/rodrigofelga/solar-system-galaxy.git
```

Navigate to the project:

```bash
cd solar-system-galaxy
```

Open `index.html` in a modern web browser.

The current static version does not require a package manager, build process, or additional runtime dependencies.

Future WebGL development may introduce a local development server and updated setup instructions.

## Development Workflow

Development takes place locally using Visual Studio Code, with AI-assisted development tools where appropriate.

The standard workflow is:

1. Clone or pull the latest repository changes.
2. Open the project in VS Code.
3. Implement and test modifications locally.
4. Review changes before committing.
5. Commit changes with descriptive messages.
6. Push approved changes to GitHub.
7. Verify the GitHub Pages deployment.
8. Confirm functionality on the published website.

Example:

```bash
git add .
git commit -m "Improve planetary visualization"
git push origin main
```

Changes pushed to the configured publishing branch are automatically deployed through GitHub Pages.

## GitHub Pages Deployment

The application is published using GitHub Pages.

To configure deployment:

1. Open the repository's **Settings**.
2. Navigate to **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch.
5. Select the `/(root)` directory.
6. Save the configuration.

The public website is available at:

https://rodrigofelga.github.io/solar-system-galaxy/

For future versions introducing a build process, deployment configuration may need to be updated accordingly.

## Educational Accuracy and Simulation Limitations

This project is designed primarily as an interactive educational visualization rather than a high-precision astronomical simulation.

To improve usability and visibility:

- Planetary sizes are exaggerated relative to orbital distances.
- Distances between celestial bodies are not uniformly represented to scale.
- Planetary orbital and axial rotation speeds are accelerated.
- Galactic and planetary animations use different illustrative timescales.
- The Milky Way's appearance is a stylized approximation of its structure.
- Current planetary surface patterns are procedurally illustrated rather than actual photographic maps.
- Planet positions are not intended to represent real-time astronomical ephemerides.

Future improvements will aim to incorporate more accurate planetary characteristics while clearly distinguishing scientifically grounded data from illustrative visual scaling.

## Educational and Reference Resources

Astronomical information and future texture assets may be sourced from established scientific organizations, subject to applicable usage requirements.

Useful references include:

- [NASA Solar System Exploration](https://science.nasa.gov/solar-system/)
- [NASA Planetary Science](https://science.nasa.gov/planetary-science/)
- [NASA Solar System Treks](https://trek.nasa.gov/)
- [NASA Visible Earth](https://visibleearth.nasa.gov/)
- [NASA Image and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)

Specific third-party assets should be individually credited when introduced into the project.

## Project Roadmap

| Phase | Development Focus |
|---|---|
| Phase 1 | Foundational 2D astronomical visualization |
| Phase 2 | Interactive 3D solar system and camera navigation |
| Phase 3 | Realistic planetary textures and Earth–Moon exploration |
| Phase 4 | Planetary information panels and educational content |
| Phase 5 | Advanced astronomical controls and orbital visualization |
| Phase 6 | Enhanced Milky Way exploration and performance optimization |

The roadmap may evolve as features are implemented, tested, and refined.

## Project Vision

The long-term vision is to transform the Solar System & Milky Way Explorer into an engaging digital astronomy learning environment where users can move seamlessly between planetary and galactic perspectives.

By combining scientific information, interactive visualization, and accessible user interface design, the platform seeks to make the vast scale and complex motion of our cosmic neighbourhood easier to explore and understand.

---

**Created and maintained by Rodrigo Felga de Castro**

**Project:** Solar System & Milky Way Explorer

**Platform:** Interactive Astronomy Visualization

**Hosting:** GitHub Pages