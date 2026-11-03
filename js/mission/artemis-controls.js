import { MISSION_TEXT } from '../data/mission-text.js';

// UI is loaded up front; the mission data and all 3D objects are lazy and optional.
export class ArtemisControls {
  constructor(view, getGlobal, resumeGlobal) {
    this.view = view; this.getGlobal = getGlobal; this.resumeGlobal = resumeGlobal; this.request = 0;
    this.language = 'en'; this.text = MISSION_TEXT.en; this.status = null; this.failure = '';
    this.toggle = document.querySelector('#artemis-toggle'); this.panel = document.querySelector('#artemis-panel');
    this.fieldset = document.querySelector('#artemis-controls'); this.message = document.querySelector('#artemis-load-status');
    this.toggle.addEventListener('change', () => this.enable(this.toggle.checked));
    document.querySelector('#mission-play').addEventListener('click', () => {
      const global = this.getGlobal();
      if (!global.isPlaying) { this.resumeGlobal(); this.mission.playing = true; }
      else this.mission.playing = !this.mission.playing;
      if (this.mission.progress >= 1 && this.mission.playing) this.mission.restart();
      this.sync();
    });
    document.querySelector('#mission-progress').addEventListener('input', (event) => { this.mission.seek(Number(event.target.value) / 1000); this.sync(); });
    document.querySelector('#mission-restart').addEventListener('click', () => { this.mission.restart(); this.sync(); });
    document.querySelector('#mission-speed').addEventListener('change', (event) => { this.mission.speed = Number(event.target.value); this.sync(); });
    document.querySelectorAll('[data-mission-camera]').forEach((button) => button.addEventListener('click', () => this.mission.setCamera(button.dataset.missionCamera)));
    document.querySelector('#mission-path').addEventListener('click', () => this.mission.setTrajectory(!this.mission.trajectoryVisible));
    document.querySelector('#mission-exit').addEventListener('click', () => { this.toggle.checked = false; this.enable(false); });
    window.addEventListener('pagehide', (event) => { if (!event.persisted) this.view.disposeArtemis(); });
  }

  async enable(enabled) {
    const request = ++this.request;
    this.panel.hidden = !enabled; this.message.hidden = !enabled;
    if (!enabled) { this.view.setArtemisEnabled(false); this.showStatus(null); return; }
    this.fieldset.disabled = true; this.panel.setAttribute('aria-busy', 'true'); this.showStatus('loading');
    try {
      const mission = await this.view.setArtemisEnabled(true);
      if (request !== this.request || !mission) return;
      this.mission = mission; this.phases = (await import('./artemis-mission.js')).MISSION_PHASES;
      mission.setLanguage(this.language);
      if (request !== this.request) return;
      mission.onChange = () => this.sync();
      const chapters = document.querySelector('#mission-chapters'); chapters.replaceChildren();
      this.phases.forEach((phase, index) => {
        const button = document.createElement('button'); button.type = 'button';
        button.addEventListener('click', () => { mission.seek(phase.start); mission.setCamera(index === 4 ? 'flyby' : index === 5 ? 'return' : 'overview'); this.sync(); });
        chapters.append(button);
      });
      this.labelChapters();
      this.fieldset.disabled = false; this.message.hidden = true; this.panel.setAttribute('aria-busy', 'false'); this.sync();
      document.querySelector('#solar-heading').scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (error) {
      if (request !== this.request) return;
      this.view.setArtemisEnabled(false); this.toggle.checked = false; this.fieldset.disabled = true;
      this.panel.setAttribute('aria-busy', 'false'); this.message.hidden = false; this.failure = error.message; this.showStatus('failed');
    }
  }

  showStatus(status) {
    this.status = status;
    this.message.textContent = status === 'loading' ? this.text.loading : status === 'failed' ? this.text.unavailable(this.failure) : '';
  }

  labelChapters() {
    document.querySelectorAll('#mission-chapters button').forEach((button, index) => { button.textContent = `${String(index+1).padStart(2, '0')} ${this.text.phases[index].title}`; });
  }

  // Only rewrites words: playback, camera, progress and selection all live elsewhere and are left alone.
  setLanguage(language) {
    this.language = language; this.text = MISSION_TEXT[language] ?? MISSION_TEXT.en;
    document.querySelectorAll('[data-mission-text]').forEach((node) => { node.textContent = this.text[node.dataset.missionText]; });
    document.querySelectorAll('[data-mission-aria]').forEach((node) => node.setAttribute('aria-label', this.text[node.dataset.missionAria]));
    document.querySelector('#mission-phase').textContent = this.text.phases[0].title;
    document.querySelectorAll('#mission-speed option').forEach((option) => { option.textContent = `${this.text.number(option.value)}×`; });
    this.showStatus(this.status); this.labelChapters(); this.mission?.setLanguage(language); this.sync();
  }

  syncGlobal() { const global = this.getGlobal(); const stamp = `${global.isPlaying}`; if (stamp !== this.globalStamp) { this.globalStamp = stamp; this.sync(); } }

  sync() {
    const mission = this.mission; if (!mission?.active || !this.phases) return;
    const global = this.getGlobal(); const text = this.text; const phase = text.phases[mission.phase];
    const phaseTitle = document.querySelector('#mission-phase'); if (phaseTitle.textContent !== phase.title) phaseTitle.textContent = phase.title;
    document.querySelector('#mission-explanation').textContent = phase.text;
    document.querySelector('#mission-progress').value = String(Math.round(mission.progress * 1000));
    document.querySelector('#mission-progress').setAttribute('aria-valuetext', text.progress(Math.round(mission.progress*100), phase.title));
    document.querySelector('#mission-progress-value').textContent = `${Math.round(mission.progress*100)}%`;
    const elapsed = mission.elapsed ?? 0;
    const inCoverage = elapsed >= mission.data.first && elapsed <= mission.data.last;
    const timestamp = Date.parse(mission.data.epoch) + elapsed*1000;
    const forecast = timestamp > Date.parse(mission.data.sourceCreated);
    document.querySelector('#mission-clock').textContent = inCoverage ? text.clock(text.stamp(...new Date(timestamp).toISOString().slice(0,16).split('T')), forecast) : (elapsed < mission.data.first ? text.clockLaunch : text.clockEntry);
    const play = document.querySelector('#mission-play');
    play.textContent = !global.isPlaying ? text.resume : mission.playing ? text.pause : text.play;
    play.setAttribute('aria-pressed', String(!mission.playing));
    document.querySelector('#mission-global-note').textContent = !global.isPlaying ? text.globalHeld : !mission.playing ? text.orionPaused : text.running(text.number(mission.speed));
    const path = document.querySelector('#mission-path'); path.textContent = mission.trajectoryVisible ? text.hidePath : text.showPath; path.setAttribute('aria-pressed', String(mission.trajectoryVisible));
    document.querySelectorAll('[data-mission-camera]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.missionCamera === mission.cameraMode)));
    document.querySelectorAll('#mission-chapters button').forEach((button, index) => { if (index === mission.phase) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current'); });
    document.querySelector('#mission-hud-phase').textContent = phase.title;
  }
}
