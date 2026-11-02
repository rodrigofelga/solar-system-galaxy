import * as THREE from 'three';
import { JOURNEY_SOURCES, JOURNEY_TEXT } from '../data/journey-text.js';
import { JourneyScene, TRAIL_SPANS } from './journey-scene.js';
import {
  BODIES, GALACTIC_ORBIT_SECONDS, MAGNIFICATION, REAL_GALACTIC_YEAR_MILLIONS, REAL_ORBIT_SPEEDS, SECONDS_PER_EARTH_YEAR, earthOrbits, galacticOrbits, isAhead, pathLength, planetIndex,
  planetOffset, planetPosition, sunPosition, vortexPosition,
} from './journey-model.js';

const PLAY_ICON = 'M4.5 2.2 13 8l-8.5 5.8z';
const PAUSE_ICON = 'M4 2.5h3v11H4zM9 2.5h3v11H9z';
const RESET_ICON = 'M8 2.5a5.5 5.5 0 1 1-5.2 7.3l1.4-.5A4 4 0 1 0 8 4v2.5L4 3.25 8 0z';
const SPEEDS = [0.25, 1, 2, 5];
const READOUT_SECONDS = 0.25;
const TAP_DISTANCE = 7;
const PICK_MARGIN = 28;
const PREDICT_ORBIT_FRACTION = 1 / 4;
const PREDICT_DISTANCE = 34;
const TAG_MIN_WIDTH = 520;
const TAG_MIN_HEIGHT = 320;
const LABEL_NAMES = ['Sun', ...BODIES.map(({ name }) => name)];

const el = (tag, attributes = {}, ...children) => {
  const node = document.createElement(tag);
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  });
  node.append(...children);
  return node;
};
const icon = (path) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shape.setAttribute('d', path); svg.append(shape);
  return { svg, shape };
};

/** Owns the journey's clock and interface. The scene only draws the state held here. */
export class JourneyControls {
  constructor(galaxy, language = 'en') {
    this.galaxy = galaxy;
    this.language = language;
    this.active = false;
    this.playing = true;
    this.speed = 1;
    this.mode = 'B';
    this.selected = null;
    this.playUntil = null;
    this.readoutClock = 0;
    this.visible = true;
    this.host = galaxy.container;
    this.section = document.querySelector('#galaxy-panel');
    this.panel = document.querySelector('#journey-panel');
    this.labels = { main: new Map(), second: new Map() };
    this.strings = new Map();
    this.buildViewport();
    this.buildPanel();
    this.applyLanguage();
  }

  get t() { return JOURNEY_TEXT[this.language]; }

  /** Registers a node's text so a language change updates it in place, without touching the simulation. */
  say(node, key, attribute = null) {
    this.strings.set(node, { key, attribute });
    return node;
  }

  buildViewport() {
    this.panes = { main: el('div', { class: 'journey-pane', role: 'group' }), second: el('div', { class: 'journey-pane', role: 'group' }) };
    this.say(this.panes.main, 'regionLabel', 'aria-label');
    this.say(this.panes.second, 'regionLabel', 'aria-label');
    this.captionMain = el('span', { class: 'journey-caption' });
    this.captionSecond = el('span', { class: 'journey-caption' });
    this.badge = el('p', { class: 'journey-badge' });
    this.labelLayer = el('div', { class: 'journey-labels' });
    this.choiceLayer = el('div', { class: 'journey-choices' });
    this.directionLabel = this.say(el('span', { class: 'journey-tag journey-tag--direction' }), 'direction');
    this.tiltLabel = this.say(el('span', { class: 'journey-tag journey-tag--tilt' }), 'tilt');
    this.labelLayer.append(this.directionLabel, this.tiltLabel);
    const play = icon(PAUSE_ICON);
    this.playIcon = play.shape;
    this.playButton = el('button', { type: 'button', class: 'sim-icon', id: 'journey-play' }, play.svg);
    this.playButton.addEventListener('click', () => {
      if (!this.playing && this.prediction) this.clearPrediction();
      this.setPlaying(!this.playing);
    });
    this.resetButton = el('button', { type: 'button', class: 'sim-icon', id: 'journey-reset' }, icon(RESET_ICON).svg);
    this.resetButton.addEventListener('click', () => this.reset());
    this.speedGroup = el('div', { class: 'sim-presets', role: 'group' });
    this.say(this.speedGroup, 'speedPresets', 'aria-label');
    this.speedButtons = SPEEDS.map((speed) => {
      const button = el('button', { type: 'button', 'data-speed': speed, 'aria-pressed': String(speed === this.speed) });
      button.addEventListener('click', () => this.setSpeed(speed));
      this.speedGroup.append(button);
      return button;
    });
    this.dock = el('div', { class: 'sim-dock journey-dock', role: 'group' }, this.playButton, this.resetButton, this.speedGroup);
    this.say(this.dock, 'dockLabel', 'aria-label');
    this.overlay = [this.panes.second, this.panes.main, this.captionMain, this.captionSecond, this.badge, this.labelLayer, this.choiceLayer, this.dock];
    this.overlay.forEach((node) => { node.hidden = true; this.host.append(node); });
    Object.entries(this.panes).forEach(([key, pane]) => this.bindPicking(key, pane));
    LABEL_NAMES.forEach((name) => ['main', 'second'].forEach((viewKey) => {
      const button = el('button', { type: 'button', class: 'galaxy-label journey-label', 'aria-pressed': 'false' });
      if (name !== 'Sun') button.addEventListener('click', () => this.select(name));
      else button.addEventListener('click', () => this.select(null));
      button.hidden = true;
      this.labelLayer.append(button);
      this.labels[viewKey].set(name, button);
    }));
  }

  bindPicking(key, pane) {
    let start = null;
    pane.addEventListener('pointerdown', (event) => { start = [event.clientX, event.clientY]; });
    pane.addEventListener('pointerup', (event) => {
      if (!start || !this.scene || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > TAP_DISTANCE) return;
      const view = this.scene.views[key];
      const rect = pane.getBoundingClientRect();
      let nearest = null; let best = PICK_MARGIN;
      BODIES.forEach((body) => {
        const place = this.scene.project(view, new THREE.Vector3().fromArray(this.scene.bodyPosition(body, view)));
        if (!place) return;
        const gap = Math.hypot(place.x - (event.clientX - rect.left), place.y - (event.clientY - rect.top));
        if (gap < best) { best = gap; nearest = body.name; }
      });
      if (nearest) this.select(nearest);
    });
  }

  buildPanel() {
    const button = (key, handler, attributes = {}) => {
      const node = this.say(el('button', { type: 'button', ...attributes }), key);
      node.addEventListener('click', handler);
      return node;
    };
    const check = (key, id, property) => {
      const input = el('input', { type: 'checkbox', id });
      input.checked = true;
      input.addEventListener('change', () => { if (this.scene) this.scene[property] = input.checked; });
      const label = el('label', { for: id }, input, this.say(el('span'), key));
      return { label, input };
    };
    this.status = el('p', { class: 'note journey-status', role: 'status' });
    this.modeButtons = { A: button('modeA', () => this.setMode('A')), B: button('modeB', () => this.setMode('B')), C: button('modeC', () => this.setMode('C')) };
    const modeGroup = el('div', { class: 'journey-segment', role: 'group' }, ...Object.values(this.modeButtons));
    this.say(modeGroup, 'frameGroup', 'aria-label');
    this.levelButtons = { galaxy: button('levelGalaxy', () => this.setLevel('galaxy')), journey: button('levelJourney', () => this.setLevel('journey')) };
    const levelGroup = el('div', { class: 'journey-segment', role: 'group' }, ...Object.values(this.levelButtons));
    this.say(levelGroup, 'levelGroup', 'aria-label');
    this.followButtons = {
      sun: button('followSun', () => this.setFollow('sun')),
      system: button('followSystem', () => this.setFollow('system')),
      planet: button('followPlanet', () => this.setFollow('planet')),
      free: button('followFree', () => this.setFollow('free')),
    };
    this.planetSelect = el('select', { id: 'journey-planet' });
    this.planetOptions = BODIES.map(({ name }) => { const option = el('option', { value: name }); this.planetSelect.append(option); return option; });
    this.planetSelect.value = 'Earth';
    this.planetSelect.addEventListener('change', () => { this.select(this.planetSelect.value); this.setFollow('planet'); });
    const followGroup = el('div', { class: 'journey-segment', role: 'group' }, ...Object.values(this.followButtons));
    this.say(followGroup, 'followGroup', 'aria-label');
    this.followNote = this.say(el('p', { class: 'note journey-follow-note' }), 'followFreeNote');
    this.toggles = { trails: check('showTrails', 'journey-trails', 'showTrails'), sunPath: check('showSunPath', 'journey-sun-path', 'showSunPath'), planes: check('showPlanes', 'journey-planes', 'showPlanes') };
    this.labelsToggle = el('input', { type: 'checkbox', id: 'journey-labels' });
    this.labelsToggle.checked = true;
    const labelsLabel = el('label', { for: 'journey-labels' }, this.labelsToggle, this.say(el('span'), 'showLabels'));
    this.trailSelect = el('select', { id: 'journey-trail-length' });
    this.trailOptions = Object.keys(TRAIL_SPANS).map((key) => { const option = el('option', { value: key }); this.trailSelect.append(option); return option; });
    this.trailSelect.value = 'medium';
    this.trailSelect.addEventListener('change', () => { if (this.scene) this.scene.trailSpan = TRAIL_SPANS[this.trailSelect.value]; });
    this.readoutLine = el('p', { class: 'journey-readout' });
    this.compareBox = el('div', { class: 'journey-explain' },
      this.say(el('h3'), 'compareTitle'), this.say(el('p'), 'compareText'));
    this.selectedBox = el('div', { class: 'journey-selected', 'aria-live': 'polite' });
    this.selectedBox.hidden = true;
    const row = (key, ...children) => el('div', { class: 'journey-row' }, this.say(el('span', { class: 'journey-row-label' }), key), ...children);
    const planetField = el('label', { for: 'journey-planet', class: 'journey-field' }, this.say(el('span'), 'planetSelect'), this.planetSelect);
    const trailField = el('label', { for: 'journey-trail-length', class: 'journey-field' }, this.say(el('span'), 'trailLength'), this.trailSelect);
    this.fullscreenButton = el('button', { type: 'button', id: 'journey-fullscreen' });
    this.fullscreenButton.addEventListener('click', () => document.querySelector('#galaxy-fullscreen').click());
    this.exitButton = button('exit', () => this.close(), { id: 'journey-exit', class: 'journey-exit' });
    const header = el('div', { class: 'journey-header' },
      el('div', {}, this.say(el('p', { class: 'eyebrow' }), 'eyebrow'), this.say(el('h2', { id: 'journey-title' }), 'title')),
      el('div', { class: 'journey-header-actions' }, this.fullscreenButton, this.exitButton));
    this.panel.replaceChildren(
      header,
      this.say(el('p', { class: 'journey-intro' }), 'intro'),
      this.status,
      row('frameGroup', modeGroup),
      row('levelGroup', levelGroup),
      row('followGroup', followGroup, planetField),
      this.followNote,
      row('displayGroup', el('div', { class: 'journey-checks' }, this.toggles.trails.label, this.toggles.sunPath.label, this.toggles.planes.label, labelsLabel), trailField),
      this.readoutLine,
      this.buildTimescale(),
      this.scaleNote = el('p', { class: 'note' }),
      this.compareBox,
      this.selectedBox,
      this.buildActivities(),
      this.buildScience(),
    );
    document.addEventListener('fullscreenchange', () => { this.updateFullscreenLabel(); });
  }

  buildActivities() {
    const card = (titleKey, textKey, ...children) => {
      const details = el('details', { class: 'journey-activity' }, this.say(el('summary'), titleKey), this.say(el('p'), textKey), ...children);
      return details;
    };
    this.activityAAnswer = this.say(el('p', { class: 'journey-answer' }), 'activityAAnswer');
    this.activityAAnswer.hidden = true;
    const activityA = card('activityATitle', 'activityAText', el('div', { class: 'journey-activity-actions' },
      this.say(el('button', { type: 'button', id: 'journey-a-sun' }), 'activityAShowSun'),
      this.say(el('button', { type: 'button', id: 'journey-a-galaxy' }), 'activityAShowGalaxy')), this.activityAAnswer);
    activityA.querySelector('#journey-a-sun').addEventListener('click', () => { this.setMode('A'); this.showViewport(); this.activityAAnswer.hidden = false; });
    activityA.querySelector('#journey-a-galaxy').addEventListener('click', () => { this.setMode('B'); this.showViewport(); this.activityAAnswer.hidden = false; });

    this.activityBResult = el('p', { class: 'journey-answer' });
    this.activityBResult.hidden = true;
    const startB = this.say(el('button', { type: 'button', id: 'journey-b-start' }), 'start');
    startB.addEventListener('click', () => this.startFollowEarth());
    const activityB = card('activityBTitle', 'activityBText', el('div', { class: 'journey-activity-actions' }, startB), this.activityBResult);

    this.predictQuestion = this.say(el('p', { class: 'journey-answer' }), 'activityCChoose');
    this.predictQuestion.hidden = true;
    this.predictButtons = ['A', 'B', 'C'].map((letter) => {
      const choice = el('button', { type: 'button', 'data-choice': letter, text: letter });
      choice.hidden = true;
      choice.addEventListener('click', () => this.answerPrediction(letter));
      return choice;
    });
    this.predictResult = el('p', { class: 'journey-answer', 'aria-live': 'polite' });
    this.predictResult.hidden = true;
    this.predictStart = this.say(el('button', { type: 'button', id: 'journey-c-start' }), 'start');
    this.predictStart.addEventListener('click', () => this.startPrediction());
    const activityC = card('activityCTitle', 'activityCText', el('div', { class: 'journey-activity-actions' }, this.predictStart, ...this.predictButtons), this.predictQuestion, this.predictResult);

    this.vortexButton = el('button', { type: 'button', id: 'journey-d-toggle', 'aria-pressed': 'false' });
    this.vortexButton.addEventListener('click', () => { this.setMode(this.mode === 'D' ? 'B' : 'D'); this.showViewport(); });
    this.vortexExplain = this.say(el('p', { class: 'journey-answer' }), 'activityDExplain');
    this.vortexExplain.hidden = true;
    this.vortexCount = el('p', { class: 'journey-answer', role: 'status' });
    this.vortexCount.hidden = true;
    const activityD = card('activityDTitle', 'activityDText', el('div', { class: 'journey-activity-actions' }, this.vortexButton), this.vortexExplain, this.vortexCount);
    return el('section', { class: 'journey-activities' }, this.say(el('h3'), 'activitiesTitle'), activityA, activityB, activityC, activityD);
  }

  buildTimescale() {
    this.timeAnimValue = el('strong');
    this.timeText = el('p', { class: 'note' });
    const card = (labelKey, value) => el('div', { class: 'journey-clock' }, this.say(el('span'), labelKey), value, this.say(el('small'), 'timeOrbitNote'));
    return el('div', { class: 'journey-timescale' },
      this.say(el('h3'), 'timeTitle'),
      el('div', { class: 'journey-clocks' }, card('timeRealLabel', this.say(el('strong'), 'timeRealValue')), card('timeAnimLabel', this.timeAnimValue)),
      this.timeText);
  }

  buildScience() {
    this.realList = el('ul');
    this.displayList = el('ul');
    const sources = el('ul');
    JOURNEY_SOURCES.forEach(({ label, url }) => sources.append(el('li', {}, el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: label }))));
    return el('details', { class: 'journey-science' }, this.say(el('summary'), 'scienceTitle'),
      el('div', { class: 'journey-science-grid' },
        el('div', {}, this.say(el('h4'), 'realHeading'), this.realList),
        el('div', {}, this.say(el('h4'), 'displayHeading'), this.displayList),
        el('div', {}, this.say(el('h4'), 'sourcesHeading'), sources)));
  }

  async open() {
    if (this.active || !this.galaxy.available) return;
    this.galaxy.stopTour();
    this.galaxy.closePanel();
    this.overlay.forEach((node) => { node.hidden = false; });
    this.panel.hidden = false;
    this.section.classList.add('journey-on');
    this.host.classList.add('journey-active');
    this.galaxy.resize();
    const compact = window.matchMedia?.('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 640;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.scene = new JourneyScene(this.galaxy, { compact, reduceMotion, panes: this.panes });
    this.scene.startAt(this.galaxy.phase);
    this.scene.trailSpan = TRAIL_SPANS[this.trailSelect.value];
    this.scene.showTrails = this.toggles.trails.input.checked;
    this.scene.showSunPath = this.toggles.sunPath.input.checked;
    this.scene.showPlanes = this.toggles.planes.input.checked;
    this.observer = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; });
    this.observer.observe(this.host);
    this.active = true;
    this.galaxy.journey = this;
    this.setPlaying(true);
    this.setMode('B', true);
    this.applyLanguage();
    this.host.scrollIntoView?.({ block: 'nearest' });
  }

  close() {
    if (!this.active) return;
    this.active = false;
    this.galaxy.journey = null;
    this.observer?.disconnect();
    this.overlay.forEach((node) => { node.hidden = true; });
    this.labels.main.forEach((label) => { label.hidden = true; });
    this.labels.second.forEach((label) => { label.hidden = true; });
    this.panel.hidden = true;
    this.section.classList.remove('journey-on');
    this.host.classList.remove('journey-active');
    this.clearPrediction();
    this.selected = null;
    this.selectedBox.hidden = true;
    this.vortexExplain.hidden = true;
    this.vortexCount.hidden = true;
    this.activityBResult.hidden = true;
    this.activityAAnswer.hidden = true;
    this.scene.dispose();
    this.scene = null;
    this.galaxy.resize();
    this.galaxy.setView('overview');
    document.querySelector('#galaxy-journey')?.focus();
  }

  setPlaying(playing) {
    this.playing = playing;
    if (!playing) this.playUntil = null;
    this.updatePlayButton();
  }

  updatePlayButton() {
    const label = this.playing ? this.t.pause : this.t.play;
    this.playButton.setAttribute('aria-label', label);
    this.playButton.title = label;
    this.playIcon.setAttribute('d', this.playing ? PAUSE_ICON : PLAY_ICON);
  }

  setSpeed(speed) {
    this.speed = speed;
    this.speedButtons.forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === speed)));
    this.updateSpeedLabels();
  }

  updateSpeedLabels() {
    const format = (speed) => `${speed.toLocaleString(this.t.locale, { maximumFractionDigits: 2 })}×`;
    this.speedButtons.forEach((button) => {
      const speed = Number(button.dataset.speed);
      button.textContent = format(speed);
      button.setAttribute('aria-label', `${this.t.speed} ${format(speed)}`);
    });
  }

  setMode(mode, instant = false) {
    if (this.prediction) this.clearPrediction();
    this.mode = mode;
    if (this.scene) {
      this.scene.setMode(mode, instant);
      if (mode === 'C' || mode === 'D') this.levelFollowCleanup();
    }
    Object.entries(this.modeButtons).forEach(([key, button]) => button.setAttribute('aria-pressed', String(key === mode)));
    const free = this.followButtons.free;
    free.disabled = mode !== 'B';
    this.compareBox.hidden = mode !== 'C';
    this.vortexExplain.hidden = mode !== 'D';
    this.vortexCount.hidden = mode !== 'D';
    this.vortexButton.setAttribute('aria-pressed', String(mode === 'D'));
    this.renderCopy();
    this.updateFollowButtons();
    this.updateCaptions();
  }

  levelFollowCleanup() { this.updateFollowButtons(); this.updateLevelButtons(); }

  setLevel(level) {
    if (!this.scene) return;
    if (this.prediction) this.clearPrediction();
    if (level === 'galaxy' && (this.mode === 'C' || this.mode === 'D')) this.setMode('B');
    this.scene.setLevel(level);
    this.updateLevelButtons();
  }

  updateLevelButtons() {
    if (!this.scene) return;
    const galaxy = this.scene.levelTarget === 0;
    this.levelButtons.galaxy.setAttribute('aria-pressed', String(galaxy));
    this.levelButtons.journey.setAttribute('aria-pressed', String(!galaxy));
  }

  setFollow(follow) {
    if (!this.scene) return;
    if (this.scene.levelTarget === 0) { this.scene.setLevel('journey'); this.updateLevelButtons(); }
    this.scene.setFollow(this.scene.views.main, follow, this.planetSelect.value);
    this.updateFollowButtons();
  }

  updateFollowButtons() {
    if (!this.scene) return;
    const { follow } = this.scene.views.main;
    Object.entries(this.followButtons).forEach(([key, button]) => button.setAttribute('aria-pressed', String(key === follow)));
    this.followNote.hidden = follow !== 'free';
  }

  select(name) {
    this.selected = name;
    this.scene.highlight = name;
    if (name) this.planetSelect.value = name;
    this.renderSelected();
    if (name && this.scene.views.main.follow === 'planet') this.scene.setFollow(this.scene.views.main, 'planet', name);
  }

  renderSelected() {
    const body = this.selected && BODIES[planetIndex(this.selected)];
    this.selectedBox.hidden = !body;
    if (!body) return;
    const number = (value) => value.toLocaleString(this.t.locale, { maximumFractionDigits: 2 });
    const period = body.orbitPeriod < 1 ? this.t.days(number(Math.round(body.orbitPeriod * 365.25))) : body.orbitPeriod === 1 ? this.t.oneYear : this.t.years(number(body.orbitPeriod));
    this.selectedBox.replaceChildren(
      el('p', { class: 'eyebrow', text: this.t.selected }),
      el('strong', { text: this.t.names[body.name] }),
      el('p', { text: this.t.bodyFacts(period, number(REAL_ORBIT_SPEEDS[body.name])) }));
  }

  reset() {
    this.clearPrediction();
    this.scene?.reset();
    this.setPlaying(true);
    this.setSpeed(1);
  }

  // An activity started from the panel must not play out of sight.
  showViewport() { this.host.scrollIntoView?.({ block: 'nearest' }); }

  startFollowEarth() {
    this.showViewport();
    this.select('Earth');
    this.setMode('C');
    this.scene.trailSpan = TRAIL_SPANS.medium;
    this.trailSelect.value = 'medium';
    this.setPlaying(true);
    const earth = BODIES[planetIndex('Earth')];
    const format = (value) => Math.round(value).toLocaleString(this.t.locale);
    this.earthLengths = { sun: pathLength(earth, SECONDS_PER_EARTH_YEAR, 'sun'), galaxy: pathLength(earth, SECONDS_PER_EARTH_YEAR) };
    this.activityBResult.hidden = false;
    this.renderEarthResult = () => { this.activityBResult.textContent = this.t.activityBResult(format(this.earthLengths.sun), format(this.earthLengths.galaxy)); };
    this.renderEarthResult();
  }

  startPrediction() {
    this.clearPrediction();
    this.showViewport();
    if (this.mode !== 'B') this.setMode('B');
    if (this.scene.levelTarget !== 1 || this.scene.level < 1) { this.scene.setLevel('journey'); this.updateLevelButtons(); this.scene.level = 1; this.scene.levelClock = undefined; this.scene.scaleNow = 1; }
    this.setPlaying(false);
    this.select('Earth');
    this.scene.setFollow(this.scene.views.main, 'system');
    this.scene.frameSolarSystem(PREDICT_DISTANCE);
    this.updateFollowButtons();
    const earth = BODIES[planetIndex('Earth')];
    const now = this.scene.time;
    const span = SECONDS_PER_EARTH_YEAR * PREDICT_ORBIT_FRACTION;
    const later = now + span;
    const sunThen = sunPosition(later);
    const sunNow = sunPosition(now);
    const offset = planetOffset(earth, later);
    const places = [
      { kind: 'right', point: planetPosition(earth, later) },
      { kind: 'still', point: [sunNow[0] + offset[0], sunNow[1] + offset[1], sunNow[2] + offset[2]] },
      // Halfway back along the Sun's own path: what "left behind" would look like.
      { kind: 'trail', point: [(sunNow[0] + sunThen[0]) / 2, (sunNow[1] + sunThen[1]) / 2, (sunNow[2] + sunThen[2]) / 2] },
    ];
    // Rotate the order, so the right answer is not always on the same letter.
    const shift = Math.floor(now * 7) % 3;
    this.prediction = { later, choices: ['A', 'B', 'C'].map((letter, i) => ({ letter, ...places[(i + shift) % 3] })), answered: false };
    this.choiceLayer.replaceChildren(...this.prediction.choices.map((choice) => {
      choice.node = el('button', { type: 'button', class: 'journey-choice', text: choice.letter, 'aria-label': `${this.t.activityCChoose} ${choice.letter}` });
      choice.node.addEventListener('click', () => this.answerPrediction(choice.letter));
      return choice.node;
    }));
    this.predictQuestion.hidden = false;
    this.predictButtons.forEach((button) => { button.hidden = false; button.disabled = false; });
    this.predictResult.hidden = true;
    this.say(this.predictStart, 'activityCAgain');
    this.predictStart.textContent = this.t.activityCAgain;
  }

  answerPrediction(letter) {
    if (!this.prediction || this.prediction.answered) return;
    const choice = this.prediction.choices.find((item) => item.letter === letter);
    this.prediction.answered = true;
    this.prediction.kind = choice.kind;
    this.predictButtons.forEach((button) => { button.disabled = true; });
    this.playUntil = this.prediction.later;
    this.playing = true;
    this.updatePlayButton();
    this.prediction.choices.forEach((item) => {
      item.node.disabled = true;
      item.node.classList.toggle('is-picked', item.letter === letter);
      item.node.classList.toggle('is-right', item.kind === 'right');
    });
  }

  finishPrediction() {
    this.predictResult.hidden = false;
    this.renderPredictionResult();
    this.predictResult.scrollIntoView?.({ block: 'nearest' });
  }

  renderPredictionResult() {
    if (!this.prediction?.kind) return;
    const keys = { right: 'activityCRight', still: 'activityCStill', trail: 'activityCTrail' };
    this.predictResult.textContent = this.t[keys[this.prediction.kind]];
  }

  clearPrediction() {
    this.prediction = null;
    this.playUntil = null;
    this.choiceLayer.replaceChildren();
    this.predictQuestion.hidden = true;
    this.predictButtons.forEach((button) => { button.hidden = true; });
    this.predictResult.hidden = true;
    this.say(this.predictStart, 'start');
    this.predictStart.textContent = this.t.start;
  }

  setLanguage(language) {
    this.language = language === 'pt-BR' ? 'pt-BR' : 'en';
    this.applyLanguage();
  }

  applyLanguage() {
    const { t } = this;
    this.strings.forEach(({ key, attribute }, node) => {
      if (attribute) node.setAttribute(attribute, t[key]);
      else node.textContent = t[key];
    });
    this.resetButton.setAttribute('aria-label', t.reset);
    this.resetButton.title = t.reset;
    this.updatePlayButton();
    this.updateSpeedLabels();
    this.updateFullscreenLabel();
    this.planetOptions.forEach((option) => { option.textContent = t.names[option.value]; });
    this.trailOptions.forEach((option) => { option.textContent = t[{ short: 'trailShort', medium: 'trailMedium', long: 'trailLong' }[option.value]]; });
    this.labels.main.forEach((label, name) => { label.textContent = t.names[name]; });
    this.labels.second.forEach((label, name) => { label.textContent = t.names[name]; });
    const number = (value, digits = 0) => value.toLocaleString(t.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    this.timeAnimValue.textContent = t.timeAnimValue(number(GALACTIC_ORBIT_SECONDS));
    this.timeText.textContent = t.timeText(number(REAL_GALACTIC_YEAR_MILLIONS / GALACTIC_ORBIT_SECONDS, 1), number(earthOrbits(GALACTIC_ORBIT_SECONDS), 1));
    this.realList.replaceChildren(...t.realItems.map((text) => el('li', { text })));
    this.displayList.replaceChildren(...t.displayItems.map((text) => el('li', { text })));
    this.renderCopy();
    this.renderSelected();
    this.renderEarthResult?.();
    this.renderPredictionResult();
    this.prediction?.choices.forEach((choice) => choice.node?.setAttribute('aria-label', `${t.activityCChoose} ${choice.letter}`));
    this.updateReadout();
    this.updateCaptions();
  }

  updateFullscreenLabel() {
    this.fullscreenButton.textContent = document.fullscreenElement === this.section ? this.t.exitFullscreen : this.t.fullscreen;
  }

  renderCopy() {
    this.status.textContent = this.t[`status${this.mode}`];
    this.vortexButton.textContent = this.mode === 'D' ? this.t.activityDLeave : this.t.activityDShow;
  }

  updateCaptions() {
    const split = this.mode === 'C' || this.mode === 'D';
    this.captionMain.hidden = !split;
    this.captionSecond.hidden = !split;
    if (!split) return;
    this.captionSecond.classList.toggle('journey-caption--wrong', this.mode === 'D');
    this.captionSecond.textContent = this.mode === 'D' ? this.t.captionVortex : this.t.captionSun;
    this.captionMain.textContent = this.mode === 'D' ? this.t.captionShared : this.t.captionGalaxy;
    if (!this.scene) return;
    const place = (node, view) => Object.assign(node.style, { left: `${view.rect.x + 8}px`, top: `${view.rect.y + 8}px` });
    place(this.captionMain, this.scene.views.main);
    place(this.captionSecond, this.scene.views.second);
  }

  updateReadout() {
    if (!this.scene) return;
    const number = (value, digits) => value.toLocaleString(this.t.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    this.readoutLine.textContent = this.t.readout(number(earthOrbits(this.scene.time), 1), number(galacticOrbits(this.scene.time), 2));
    this.badge.textContent = this.scene.levelTarget === 1 ? this.t.badgeJourney(Math.round(MAGNIFICATION / 1e6).toLocaleString(this.t.locale)) : this.t.badgeGalaxy;
    this.scaleNote.textContent = this.badge.textContent;
    if (this.mode === 'D') {
      const ahead = (place) => BODIES.filter((body) => isAhead(place(body, this.scene.time), this.scene.time)).length;
      this.vortexCount.textContent = this.t.activityDCount(ahead(planetPosition), ahead(vortexPosition));
    }
  }

  /** Called from the explorer's frame instead of its own render, so the journey has exactly one clock. */
  update(delta) {
    if (!this.scene) return;
    let simDelta = this.playing ? delta * this.speed : 0;
    if (this.playUntil !== null && this.scene.time + simDelta >= this.playUntil) {
      simDelta = Math.max(0, this.playUntil - this.scene.time);
      this.playUntil = null;
      this.playing = false;
      this.updatePlayButton();
      this.finishPrediction();
    }
    this.scene.update(delta, simDelta);
    this.readoutClock += delta;
    if (this.readoutClock >= READOUT_SECONDS) { this.readoutClock = 0; this.updateReadout(); this.updateLevelButtons(); }
    if (!this.visible) return;
    this.scene.render();
    this.updateLabels();
  }

  resize() {
    if (!this.scene) return;
    this.scene.resize();
    this.updateCaptions();
  }

  updateLabels() {
    const { scene } = this;
    const show = this.labelsToggle.checked;
    const point = new THREE.Vector3();
    let mainBoxes = [];
    const place = (node, view, world, offsetY = 0) => {
      const at = scene.project(view, world);
      if (!at || at.x < 12 || at.y < 12 || at.x > view.rect.width - 12 || at.y > view.rect.height - 12) { node.hidden = true; return null; }
      node.hidden = false;
      node.style.left = `${view.rect.x + at.x}px`;
      node.style.top = `${view.rect.y + at.y + offsetY}px`;
      return at;
    };
    [['main', scene.views.main], ['second', scene.views.second]].forEach(([key, view]) => {
      const occupied = [];
      const active = view === scene.views.main || scene.split;
      const order = this.selected ? [this.selected, ...LABEL_NAMES.filter((name) => name !== this.selected)] : LABEL_NAMES;
      order.forEach((name) => {
        const label = this.labels[key].get(name);
        const quiet = this.prediction && name !== 'Sun' && name !== 'Earth';
        if (!show || !active || quiet || (name !== 'Sun' && scene.level < 0.6)) { label.hidden = true; return; }
        if (name === 'Sun') point.fromArray(sunPosition(scene.time));
        else point.fromArray(scene.bodyPosition(BODIES[planetIndex(name)], view));
        const at = place(label, view, point, -18);
        label.setAttribute('aria-pressed', String(name === this.selected));
        if (!at) return;
        const halfWidth = label.offsetWidth / 2 + 2; const halfHeight = label.offsetHeight / 2 + 1;
        const box = { left: at.x - halfWidth, right: at.x + halfWidth, top: at.y - 18 - halfHeight, bottom: at.y - 18 + halfHeight };
        if (name !== this.selected && occupied.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) { label.hidden = true; return; }
        occupied.push(box);
      });
      if (view === scene.views.main) mainBoxes = occupied;
    });
    const main = scene.views.main;
    const roomy = main.rect.width >= TAG_MIN_WIDTH && main.rect.height >= TAG_MIN_HEIGHT;
    const showTags = show && roomy && scene.level > 0.9 && !this.prediction;
    const tag = (node, wanted, world, offsetY = 0) => {
      const at = wanted ? place(node, main, world, offsetY) : null;
      if (!at) { node.hidden = true; return; }
      const halfWidth = node.offsetWidth / 2; const halfHeight = node.offsetHeight / 2;
      const box = { left: at.x - halfWidth, right: at.x + halfWidth, top: at.y + offsetY - halfHeight, bottom: at.y + offsetY + halfHeight };
      if (mainBoxes.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) { node.hidden = true; return; }
      mainBoxes.push(box);
    };
    tag(this.directionLabel, showTags && main.frame > 0.5, scene.arrowTip, -10);
    tag(this.tiltLabel, showTags && scene.showPlanes, scene.tiltPoint);
    this.prediction?.choices.forEach((choice) => {
      const at = scene.project(main, point.fromArray(choice.point));
      if (!at) { choice.node.hidden = true; return; }
      choice.node.hidden = false;
      choice.node.style.left = `${main.rect.x + at.x}px`;
      choice.node.style.top = `${main.rect.y + at.y}px`;
    });
  }
}
