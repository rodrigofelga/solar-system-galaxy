import { GalaxyView } from './galaxy-view.js';
import { SolarSystemView } from './solar-system-view.js';
import { CELESTIAL_BODIES } from './data/celestial-bodies.js';

const elements = {
  galaxy: document.querySelector('#galaxy'), solarHost: document.querySelector('#solar-system'), fallback: document.querySelector('#webgl-fallback'),
  toggle: document.querySelector('#toggle'), reset: document.querySelector('#reset'), galaxyOrbit: document.querySelector('#path'), planetaryOrbits: document.querySelector('#solar-paths'), speed: document.querySelector('#speed'), speedOutput: document.querySelector('#out'),
  selector: document.querySelector('#body-selector'), previous: document.querySelector('#previous-body'), next: document.querySelector('#next-body'), focus: document.querySelector('#focus-body'), follow: document.querySelector('#follow-body'), earthMoon: document.querySelector('#earth-moon'), overview: document.querySelector('#overview'),
  panel: document.querySelector('#body-panel'), closePanel: document.querySelector('#close-panel'), panelFocus: document.querySelector('#panel-focus'), panelMoon: document.querySelector('#panel-moon'), bodyName: document.querySelector('#body-name'), classification: document.querySelector('#body-classification'), thumbnail: document.querySelector('#body-thumbnail'), description: document.querySelector('#body-description'), details: document.querySelector('#body-details'), facts: document.querySelector('#body-facts'),
};
const state = { isPlaying: true, speed: 1, lastFrameTime: 0, isGalaxyOrbitVisible: true, arePlanetaryOrbitsVisible: true, selectedName: null, following: false };
const galaxy = new GalaxyView(elements.galaxy);
const solarSystem = new SolarSystemView(elements.solarHost, elements.fallback, selectBody);

function populateSelector() {
  solarSystem.getBodyNames().forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    elements.selector.append(option);
  });
}

function renderPanel(name) {
  const body = CELESTIAL_BODIES[name];
  if (!body) return;
  elements.bodyName.textContent = body.name;
  elements.classification.textContent = body.classification;
  elements.thumbnail.src = body.texture;
  elements.thumbnail.alt = `${body.name} global texture map`;
  elements.thumbnail.hidden = false;
  elements.description.textContent = body.description;
  const fields = [['Diameter', body.diameter], ['Distance', body.distance], ['Rotation', body.rotation], ['Orbit', body.orbit], ['Temperature', body.temperature], ['Axial tilt', body.axialTilt], ['Moons', body.moons]];
  elements.details.replaceChildren(...fields.map(([label, value]) => {
    const wrapper = document.createElement('div');
    const term = document.createElement('dt'); term.textContent = label;
    const definition = document.createElement('dd'); definition.textContent = value;
    wrapper.append(term, definition);
    return wrapper;
  }));
  elements.facts.replaceChildren(...body.facts.map((fact) => { const item = document.createElement('li'); item.textContent = fact; return item; }));
  elements.panelMoon.hidden = name !== 'Earth';
  elements.panel.hidden = false;
}

function selectBody(name, focus = true) {
  if (!CELESTIAL_BODIES[name]) return;
  state.selectedName = name;
  state.following = false;
  elements.selector.value = name;
  elements.focus.disabled = false;
  elements.follow.disabled = false;
  elements.follow.setAttribute('aria-pressed', 'false');
  elements.follow.textContent = 'Follow selected';
  if (solarSystem.getSelectedName() !== name) solarSystem.selectBody(name, focus);
  else if (focus) solarSystem.focusBody(name);
  renderPanel(name);
}

function returnToOverview() {
  state.selectedName = null;
  state.following = false;
  elements.selector.value = '';
  elements.focus.disabled = true;
  elements.follow.disabled = true;
  elements.follow.textContent = 'Follow selected';
  elements.follow.setAttribute('aria-pressed', 'false');
  elements.panel.hidden = true;
  solarSystem.returnToOverview();
}

function navigateBody(direction) {
  const names = solarSystem.getBodyNames();
  const currentIndex = Math.max(0, names.indexOf(state.selectedName));
  selectBody(names[(currentIndex + direction + names.length) % names.length]);
}

function updatePlayButton() { elements.toggle.textContent = state.isPlaying ? 'Pause' : 'Play'; elements.toggle.setAttribute('aria-pressed', String(!state.isPlaying)); }
function updateGalaxyOrbitButton() { elements.galaxyOrbit.textContent = state.isGalaxyOrbitVisible ? 'Hide galactic orbit' : 'Show galactic orbit'; elements.galaxyOrbit.setAttribute('aria-pressed', String(state.isGalaxyOrbitVisible)); }
function updatePlanetaryOrbitButton() { elements.planetaryOrbits.textContent = state.arePlanetaryOrbitsVisible ? 'Hide planetary orbits' : 'Show planetary orbits'; elements.planetaryOrbits.setAttribute('aria-pressed', String(state.arePlanetaryOrbitsVisible)); }

elements.toggle.addEventListener('click', () => { state.isPlaying = !state.isPlaying; updatePlayButton(); });
elements.reset.addEventListener('click', () => { state.isPlaying = true; state.speed = 1; state.isGalaxyOrbitVisible = true; state.arePlanetaryOrbitsVisible = true; elements.speed.value = '1'; elements.speedOutput.value = '1×'; elements.speedOutput.textContent = '1×'; galaxy.reset(); solarSystem.reset(); solarSystem.setOrbitsVisible(true); returnToOverview(); updatePlayButton(); updateGalaxyOrbitButton(); updatePlanetaryOrbitButton(); });
elements.galaxyOrbit.addEventListener('click', () => { state.isGalaxyOrbitVisible = !state.isGalaxyOrbitVisible; galaxy.showOrbit = state.isGalaxyOrbitVisible; updateGalaxyOrbitButton(); });
elements.planetaryOrbits.addEventListener('click', () => { state.arePlanetaryOrbitsVisible = !state.arePlanetaryOrbitsVisible; solarSystem.setOrbitsVisible(state.arePlanetaryOrbitsVisible); updatePlanetaryOrbitButton(); });
elements.speed.addEventListener('input', (event) => { state.speed = Number(event.target.value); const value = `${state.speed}×`; elements.speedOutput.value = value; elements.speedOutput.textContent = value; });
elements.selector.addEventListener('change', (event) => { if (event.target.value) selectBody(event.target.value); });
elements.previous.addEventListener('click', () => navigateBody(-1));
elements.next.addEventListener('click', () => navigateBody(1));
elements.focus.addEventListener('click', () => { if (state.selectedName) solarSystem.focusBody(state.selectedName); });
elements.follow.addEventListener('click', () => { state.following = !state.following; solarSystem.setFollowSelected(state.following); elements.follow.textContent = state.following ? 'Stop following' : 'Follow selected'; elements.follow.setAttribute('aria-pressed', String(state.following)); });
elements.earthMoon.addEventListener('click', () => { selectBody('Earth', false); solarSystem.focusEarthMoon(); });
elements.overview.addEventListener('click', returnToOverview);
elements.closePanel.addEventListener('click', () => { elements.panel.hidden = true; });
elements.panelFocus.addEventListener('click', () => { if (state.selectedName) solarSystem.focusBody(state.selectedName); });
elements.panelMoon.addEventListener('click', () => selectBody('Moon'));

populateSelector();
new ResizeObserver(() => { galaxy.resize(); solarSystem.resize(); }).observe(document.body);
function animate(now) { const delta = state.lastFrameTime ? Math.min((now - state.lastFrameTime) / 1000, 0.06) : 0; state.lastFrameTime = now; galaxy.update(delta, state.speed, state.isPlaying); solarSystem.update(delta, state.speed, state.isPlaying); window.requestAnimationFrame(animate); }
window.requestAnimationFrame(animate);