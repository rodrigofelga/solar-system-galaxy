// UI is loaded up front; the mission data and all 3D objects are lazy and optional.
export class ArtemisControls {
  constructor(view, getGlobal, resumeGlobal) {
    this.view = view; this.getGlobal = getGlobal; this.resumeGlobal = resumeGlobal; this.request = 0;
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
    if (!enabled) { this.view.setArtemisEnabled(false); this.message.textContent = ''; return; }
    this.fieldset.disabled = true; this.panel.setAttribute('aria-busy', 'true'); this.message.textContent = 'Loading the local mission route…';
    try {
      const mission = await this.view.setArtemisEnabled(true);
      if (request !== this.request || !mission) return;
      this.mission = mission; this.phases = (await import('./artemis-mission.js')).MISSION_PHASES;
      if (request !== this.request) return;
      mission.onChange = () => this.sync();
      const chapters = document.querySelector('#mission-chapters'); chapters.replaceChildren();
      this.phases.forEach((phase, index) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = `${String(index+1).padStart(2, '0')} ${phase.title}`;
        button.addEventListener('click', () => { mission.seek(phase.start); mission.setCamera(index === 4 ? 'flyby' : index === 5 ? 'return' : 'overview'); this.sync(); });
        chapters.append(button);
      });
      this.fieldset.disabled = false; this.message.hidden = true; this.panel.setAttribute('aria-busy', 'false'); this.sync();
      document.querySelector('#solar-heading').scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (error) {
      if (request !== this.request) return;
      this.view.setArtemisEnabled(false); this.toggle.checked = false; this.fieldset.disabled = true;
      this.panel.setAttribute('aria-busy', 'false'); this.message.hidden = false; this.message.textContent = `Mission unavailable: ${error.message}. Toggle it on to retry.`;
    }
  }

  syncGlobal() { const global = this.getGlobal(); const stamp = `${global.isPlaying}/${global.speed}`; if (stamp !== this.globalStamp) { this.globalStamp = stamp; this.sync(); } }

  sync() {
    const mission = this.mission; if (!mission?.active || !this.phases) return;
    const global = this.getGlobal(); const phase = this.phases[mission.phase];
    const phaseTitle = document.querySelector('#mission-phase'); if (phaseTitle.textContent !== phase.title) phaseTitle.textContent = phase.title;
    document.querySelector('#mission-explanation').textContent = phase.text;
    document.querySelector('#mission-progress').value = String(Math.round(mission.progress * 1000));
    document.querySelector('#mission-progress').setAttribute('aria-valuetext', `${Math.round(mission.progress*100)} percent. ${phase.title}`);
    document.querySelector('#mission-progress-value').textContent = `${Math.round(mission.progress*100)}%`;
    const elapsed = mission.elapsed ?? 0;
    const inCoverage = elapsed >= mission.data.first && elapsed <= mission.data.last;
    const timestamp = Date.parse(mission.data.epoch) + elapsed*1000;
    const sourceKind = timestamp > Date.parse(mission.data.sourceCreated) ? 'forecast OEM' : 'interpolated OEM';
    document.querySelector('#mission-clock').textContent = inCoverage ? `${new Date(timestamp).toISOString().slice(0,16).replace('T',' ')} UTC source · ${sourceKind} · adapted geometry` : (elapsed < mission.data.first ? 'Illustrated launch & early orbit' : 'Illustrated entry & splashdown');
    const play = document.querySelector('#mission-play');
    play.textContent = !global.isPlaying ? 'Resume global + mission' : mission.playing ? 'Pause mission' : 'Play mission';
    play.setAttribute('aria-pressed', String(!mission.playing));
    document.querySelector('#mission-global-note').textContent = !global.isPlaying ? 'Held by global Pause. Resume here or use the global Play control.' : global.speed === 0 ? 'Held by global speed 0×. Increase global speed to advance.' : !mission.playing ? 'Orion replay paused. Earth and the Moon continue their normal motion.' : `Mission ${mission.speed}× × global ${global.speed}×. Chapter pacing is accelerated.`;
    const path = document.querySelector('#mission-path'); path.textContent = mission.trajectoryVisible ? 'Hide trajectory' : 'Show trajectory'; path.setAttribute('aria-pressed', String(mission.trajectoryVisible));
    document.querySelectorAll('[data-mission-camera]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.missionCamera === mission.cameraMode)));
    document.querySelectorAll('#mission-chapters button').forEach((button, index) => { if (index === mission.phase) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current'); });
    document.querySelector('#mission-hud-phase').textContent = phase.title;
  }
}
