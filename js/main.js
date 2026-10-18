
import { GalaxyView } from './galaxy-view.js';
import { SolarSystemView } from './solar-system-view.js';
import { CELESTIAL_BODIES } from './data/celestial-bodies.js';
import { ArtemisControls } from './mission/artemis-controls.js';
import { t } from './i18n/translations.js';

let currentLanguage = 'en';

function translate(key) {
  return t(currentLanguage, key);
}

// Translate visible text without replacing nested links, selects, or checkboxes.
const uiPairs = {
  'Our Journey Through the Milky Way': 'Nossa Jornada pela Via Láctea',
  'The Sun travels around the galaxy while the planets orbit and rotate with it.': 'O Sol viaja pela galáxia enquanto os planetas orbitam e giram com ele.',
  'Traveling with the Sun': 'Viajando com o Sol',
  'Milky Way — galactic explorer': 'Via Láctea — explorador galáctico',
  'Interactive 3D anatomy': 'Anatomia interativa em 3D',
  'Interactive 3D Solar System': 'Sistema Solar interativo em 3D',
  'Galaxy overview': 'Visão geral da galáxia',
  'Explore black hole': 'Explorar buraco negro',
  'Top-down': 'Vista superior',
  'Edge-on': 'Vista lateral',
  'View warp': 'Ver deformação',
  'Guided tour': 'Visita guiada',
  'Stop tour': 'Parar visita',
  'Hide labels': 'Ocultar rótulos',
  'Show labels': 'Mostrar rótulos',
  'Show dark halo': 'Mostrar halo escuro',
  'Hide dark halo': 'Ocultar halo escuro',
  'Fullscreen': 'Tela cheia',
  'Exit fullscreen': 'Sair da tela cheia',
  'Explore anatomy': 'Explorar estruturas',
  'Select a structure': 'Selecione uma estrutura',
  'Read the research': 'Ler a pesquisa',
  'Gaia research': 'Pesquisa Gaia',
  'Galactic warp research': 'Pesquisa sobre a deformação galáctica',
  'Pause': 'Pausar',
  'Play': 'Reproduzir',
  'Reset camera': 'Reiniciar câmera',
  'Hide galactic orbit': 'Ocultar órbita galáctica',
  'Show galactic orbit': 'Mostrar órbita galáctica',
  'Hide planetary orbits': 'Ocultar órbitas planetárias',
  'Show planetary orbits': 'Mostrar órbitas planetárias',
  'Explore': 'Explorar',
  'Select a body': 'Selecione um astro',
  'Previous': 'Anterior',
  'Next': 'Próximo',
  'Focus selected': 'Focar selecionado',
  'Follow selected': 'Seguir selecionado',
  'Stop following': 'Parar de seguir',
  'Earth & Moon': 'Terra e Lua',
  'Show Artemis II Mission': 'Mostrar missão Artemis II',
  'Full Solar System': 'Sistema Solar completo',
  'Animation speed': 'Velocidade da animação',
  'Drag to orbit · scroll to zoom · right-drag to pan · click a label to explore': 'Arraste para orbitar · role para ampliar · botão direito para mover · clique em um rótulo para explorar',
  'Drag to orbit, scroll or pinch to zoom, and right-drag or two-finger drag to pan. Planet sizes, distances, and animation speeds are magnified for learning and are not to scale.': 'Arraste para orbitar, role ou use dois dedos para ampliar e botão direito ou dois dedos para mover. Tamanhos, distâncias e velocidades são ampliados para fins educacionais e não estão em escala.',
  'Galactic and planetary animations use independently accelerated educational time scales; they are not synchronized to physical time.': 'As animações galácticas e planetárias usam escalas de tempo educacionais aceleradas e independentes; não são sincronizadas com o tempo físico.',
  'Galactic orbit: approximately 230 million years': 'Órbita galáctica: aproximadamente 230 milhões de anos',
  "Sun's orbital speed: approximately 230 km/s": 'Velocidade orbital do Sol: aproximadamente 230 km/s',
  'Distance from galactic centre: approximately 26,000 light-years': 'Distância ao centro galáctico: aproximadamente 26.000 anos-luz',
  'Created by Rodrigo Felga de Castro. Educational model, not to scale. The Milky Way is a stylized depiction. Planet sizes, distances, orbital speeds, and the Earth–Moon spacing are magnified for learning; texture maps and facts are documented in the project attribution notes.':
  'Criado por Rodrigo Felga de Castro. Modelo educacional, fora de escala. A Via Láctea é uma representação estilizada. Os tamanhos dos planetas, as distâncias, as velocidades orbitais e a distância entre a Terra e a Lua foram ampliados para fins didáticos; os mapas de textura e as informações científicas estão documentados nas notas de atribuição do projeto.',
  'Focus': 'Focar',
  'Explore Moon': 'Explorar a Lua',
  'Diameter': 'Diâmetro',
  'Distance': 'Distância',
  'Rotation': 'Rotação',
  'Orbit': 'Órbita',
  'Temperature': 'Temperatura',
  'Axial tilt': 'Inclinação axial',
  'Moons': 'Luas',
  'Mercury': 'Mercúrio',
  'Venus': 'Vênus',
  'Earth': 'Terra',
  'Moon': 'Lua',
  'Mars': 'Marte',
  'Jupiter': 'Júpiter',
  'Saturn': 'Saturno',
  'Uranus': 'Urano',
  'Neptune': 'Netuno',
  'Sun': 'Sol',
  'MILKY WAY': 'VIA LÁCTEA',
  '3D EXPLORER': 'EXPLORADOR 3D'
};

const uiReverse = Object.fromEntries(
  Object.entries(uiPairs).map(([en, pt]) => [pt, en])
);

function translatedText(value) {
  const raw = value.trim();
  if (!raw) return value;

  const en = uiReverse[raw] || raw;
  const replacement = currentLanguage === 'pt-BR'
    ? (uiPairs[en] || en)
    : en;

  return value.replace(raw, replacement);
}

function translateTextNodes(element) {
  if (!element) return;

  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      child.nodeValue = translatedText(child.nodeValue);
    }
  }
}

const translatableSelectors = [
  'main h1',
  'main > p',
  '#solar-heading',
  '#galaxy-heading',
  '.heading > span',
  '.galaxy-badge',
  '#galaxy-status',
  '.galaxy-controls button',
  '.galaxy-controls label',
  '.galaxy-controls option',
  '#galaxy-info-source',
  '.galaxy-disclaimer a',
  '.solar-note',
  '.controls-note',
  '.footer-note',
  '.facts span',
  '.controls-panel button',
  '.controls-panel label',
  '.controls-panel option',
  '#panel-focus',
  '#panel-moon',
  '#body-name',
  '#body-details dt'
];

function refreshLanguage() {
  document.querySelectorAll(
    translatableSelectors.join(',')
  ).forEach(translateTextNodes);

  // Preserve scientific research links in the galactic disclaimer.
  const disclaimer = document.querySelector('.galaxy-disclaimer');

  if (disclaimer) {
    const first = disclaimer.firstChild;

    if (first?.nodeType === Node.TEXT_NODE) {
      first.nodeValue = currentLanguage === 'pt-BR'
        ? 'Modelo ilustrativo inspirado na estrutura da Via Láctea, nas pesquisas Gaia e no mapa de Cefeidas OGLE. Estrelas e nebulosas são posicionadas proceduralmente; a espessura e a deformação do disco são exageradas, e as dimensões do halo são reduzidas. Este não é um visualizador de dados do Gaia. '
        : 'Illustrative model inspired by Milky Way anatomy, Gaia research, and the OGLE Cepheid map. Stars and nebulae are procedurally placed; disk thickness and warp are exaggerated and halo sizes compressed. This is not a Gaia data viewer. ';
    }
  }

  // Update dynamic controls based on their actual state.
  if (typeof state !== 'undefined') {
    updatePlayButton();
    updateGalaxyOrbitButton();
    updatePlanetaryOrbitButton();

    elements.follow.textContent = currentLanguage === 'pt-BR'
      ? (state.following ? 'Parar de seguir' : 'Seguir selecionado')
      : (state.following ? 'Stop following' : 'Follow selected');
  }
}

function setLanguage(language) {
  currentLanguage = language === 'pt-BR' ? 'pt-BR' : 'en';
  document.documentElement.lang = currentLanguage;

  refreshLanguage();

  if (state.selectedName) {
    renderPanel(state.selectedName);
  }
}

document.querySelector('#language-select').addEventListener(
  'change',
  (event) => {
    setLanguage(event.target.value);
  }
);

const elements = {
  galaxy: document.querySelector('#galaxy'),
  solarHost: document.querySelector('#solar-system'),
  fallback: document.querySelector('#webgl-fallback'),
  toggle: document.querySelector('#toggle'),
  reset: document.querySelector('#reset'),
  galaxyOrbit: document.querySelector('#path'),
  planetaryOrbits: document.querySelector('#solar-paths'),
  speed: document.querySelector('#speed'),
  speedOutput: document.querySelector('#out'),
  selector: document.querySelector('#body-selector'),
  previous: document.querySelector('#previous-body'),
  next: document.querySelector('#next-body'),
  focus: document.querySelector('#focus-body'),
  follow: document.querySelector('#follow-body'),
  earthMoon: document.querySelector('#earth-moon'),
  overview: document.querySelector('#overview'),
  panel: document.querySelector('#body-panel'),
  closePanel: document.querySelector('#close-panel'),
  panelFocus: document.querySelector('#panel-focus'),
  panelMoon: document.querySelector('#panel-moon'),
  bodyName: document.querySelector('#body-name'),
  classification: document.querySelector('#body-classification'),
  thumbnail: document.querySelector('#body-thumbnail'),
  description: document.querySelector('#body-description'),
  details: document.querySelector('#body-details'),
  facts: document.querySelector('#body-facts')
};

const state = {
  isPlaying: true,
  speed: 1,
  lastFrameTime: 0,
  isGalaxyOrbitVisible: true,
  arePlanetaryOrbitsVisible: true,
  selectedName: null,
  following: false
};

const galaxy = new GalaxyView(elements.galaxy);

const solarSystem = new SolarSystemView(
  elements.solarHost,
  elements.fallback,
  selectBody
);

const missionControls = new ArtemisControls(
  solarSystem,
  () => state,
  () => {
    state.isPlaying = true;
    updatePlayButton();
  }
);

document.querySelector('#artemis-toggle').addEventListener(
  'change',
  (event) => {
    if (!event.target.checked) return;

    state.following = false;
    elements.follow.textContent = currentLanguage === 'pt-BR'
      ? 'Seguir selecionado'
      : 'Follow selected';

    elements.follow.setAttribute('aria-pressed', 'false');
  }
);

function populateSelector() {
  solarSystem.getBodyNames().forEach((name) => {
    const option = document.createElement('option');
    option.value = name;

    option.textContent = currentLanguage === 'pt-BR'
      ? (uiPairs[name] || name)
      : name;

    elements.selector.append(option);
  });
}

function renderPanel(name) {
  const body = CELESTIAL_BODIES[name];
  if (!body) return;

  elements.bodyName.textContent = currentLanguage === 'pt-BR'
    ? (uiPairs[body.name] || body.name)
    : body.name;

  elements.classification.textContent = body.classification;
  elements.thumbnail.src = body.texture;
  elements.thumbnail.alt = `${body.name} global texture map`;
  elements.thumbnail.hidden = false;
  elements.description.textContent = body.description;

  const fields = [
    ['Diameter', body.diameter],
    ['Distance', body.distance],
    ['Rotation', body.rotation],
    ['Orbit', body.orbit],
    ['Temperature', body.temperature],
    ['Axial tilt', body.axialTilt],
    ['Moons', body.moons]
  ];

  elements.details.replaceChildren(
    ...fields.map(([label, value]) => {
      const wrapper = document.createElement('div');
      const term = document.createElement('dt');

      term.textContent = currentLanguage === 'pt-BR'
        ? (uiPairs[label] || label)
        : label;

      const definition = document.createElement('dd');
      definition.textContent = value;

      wrapper.append(term, definition);
      return wrapper;
    })
  );

  elements.facts.replaceChildren(
    ...body.facts.map((fact) => {
      const item = document.createElement('li');
      item.textContent = fact;
      return item;
    })
  );

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

  elements.follow.textContent = currentLanguage === 'pt-BR'
    ? 'Seguir selecionado'
    : 'Follow selected';

  if (solarSystem.getSelectedName() !== name) {
    solarSystem.selectBody(name, focus);
  } else if (focus) {
    solarSystem.focusBody(name);
  }

  renderPanel(name);
}

function returnToOverview() {
  state.selectedName = null;
  state.following = false;
  elements.selector.value = '';
  elements.focus.disabled = true;
  elements.follow.disabled = true;

  elements.follow.textContent = currentLanguage === 'pt-BR'
    ? 'Seguir selecionado'
    : 'Follow selected';

  elements.follow.setAttribute('aria-pressed', 'false');
  elements.panel.hidden = true;

  solarSystem.returnToOverview();
}

function navigateBody(direction) {
  const names = solarSystem.getBodyNames();
  const currentIndex = Math.max(0, names.indexOf(state.selectedName));

  selectBody(
    names[(currentIndex + direction + names.length) % names.length]
  );
}

function updatePlayButton() {
  elements.toggle.textContent = state.isPlaying
    ? translate('pause')
    : translate('play');

  elements.toggle.setAttribute(
    'aria-pressed',
    String(!state.isPlaying)
  );
}

function updateGalaxyOrbitButton() {
  elements.galaxyOrbit.textContent = currentLanguage === 'pt-BR'
    ? (state.isGalaxyOrbitVisible
      ? 'Ocultar órbita galáctica'
      : 'Mostrar órbita galáctica')
    : (state.isGalaxyOrbitVisible
      ? 'Hide galactic orbit'
      : 'Show galactic orbit');

  elements.galaxyOrbit.setAttribute(
    'aria-pressed',
    String(state.isGalaxyOrbitVisible)
  );
}

function updatePlanetaryOrbitButton() {
  elements.planetaryOrbits.textContent = currentLanguage === 'pt-BR'
    ? (state.arePlanetaryOrbitsVisible
      ? 'Ocultar órbitas planetárias'
      : 'Mostrar órbitas planetárias')
    : (state.arePlanetaryOrbitsVisible
      ? 'Hide planetary orbits'
      : 'Show planetary orbits');

  elements.planetaryOrbits.setAttribute(
    'aria-pressed',
    String(state.arePlanetaryOrbitsVisible)
  );
}

elements.toggle.addEventListener('click', () => {
  state.isPlaying = !state.isPlaying;
  updatePlayButton();
});

elements.reset.addEventListener('click', () => {
  state.isPlaying = true;
  state.speed = 1;
  state.isGalaxyOrbitVisible = true;
  state.arePlanetaryOrbitsVisible = true;

  elements.speed.value = '1';
  elements.speedOutput.value = '1×';
  elements.speedOutput.textContent = '1×';

  galaxy.reset();
  solarSystem.reset();
  solarSystem.setOrbitsVisible(true);
  returnToOverview();

  updatePlayButton();
  updateGalaxyOrbitButton();
  updatePlanetaryOrbitButton();
});

elements.galaxyOrbit.addEventListener('click', () => {
  state.isGalaxyOrbitVisible = !state.isGalaxyOrbitVisible;
  galaxy.showOrbit = state.isGalaxyOrbitVisible;
  updateGalaxyOrbitButton();
});

elements.planetaryOrbits.addEventListener('click', () => {
  state.arePlanetaryOrbitsVisible = !state.arePlanetaryOrbitsVisible;
  solarSystem.setOrbitsVisible(state.arePlanetaryOrbitsVisible);
  updatePlanetaryOrbitButton();
});

elements.speed.addEventListener('input', (event) => {
  state.speed = Number(event.target.value);
  const value = `${state.speed}×`;
  elements.speedOutput.value = value;
  elements.speedOutput.textContent = value;
});

elements.selector.addEventListener('change', (event) => {
  if (event.target.value) {
    selectBody(event.target.value);
  }
});

elements.previous.addEventListener('click', () => navigateBody(-1));
elements.next.addEventListener('click', () => navigateBody(1));

elements.focus.addEventListener('click', () => {
  if (state.selectedName) {
    solarSystem.focusBody(state.selectedName);
  }
});

elements.follow.addEventListener('click', () => {
  state.following = !state.following;
  solarSystem.setFollowSelected(state.following);

  elements.follow.textContent = currentLanguage === 'pt-BR'
    ? (state.following ? 'Parar de seguir' : 'Seguir selecionado')
    : (state.following ? 'Stop following' : 'Follow selected');

  elements.follow.setAttribute(
    'aria-pressed',
    String(state.following)
  );
});

elements.earthMoon.addEventListener('click', () => {
  selectBody('Earth', false);
  solarSystem.focusEarthMoon();
});

elements.overview.addEventListener('click', returnToOverview);

elements.closePanel.addEventListener('click', () => {
  elements.panel.hidden = true;
});

elements.panelFocus.addEventListener('click', () => {
  if (state.selectedName) {
    solarSystem.focusBody(state.selectedName);
  }
});

elements.panelMoon.addEventListener('click', () => selectBody('Moon'));

populateSelector();

// GalaxyView rewrites several button captions when clicked.
// Restore their language afterwards.
document.querySelectorAll('.galaxy-controls button').forEach((button) => {
  button.addEventListener('click', () => {
    queueMicrotask(refreshLanguage);
  });
});

new ResizeObserver(() => {
  galaxy.resize();
  solarSystem.resize();
}).observe(document.body);

function animate(now) {
  const delta = state.lastFrameTime
    ? Math.min((now - state.lastFrameTime) / 1000, 0.06)
    : 0;

  state.lastFrameTime = now;

  galaxy.update(delta, state.speed, state.isPlaying);
  solarSystem.update(delta, state.speed, state.isPlaying);
  missionControls.syncGlobal();

  window.requestAnimationFrame(animate);
}

window.requestAnimationFrame(animate);
