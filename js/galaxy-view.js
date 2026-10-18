export class GalaxyView {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.phase = -0.7;
    this.showOrbit = true;
    this.random = (seed) => {
      const value = Math.sin(seed * 127.13 + 7.913) * 43758.5453;
      return value - Math.floor(value);
    };
    this.galaxyStars = Array.from({ length: 5000 }, (_, index) => {
      const arm = index % 4;
      const radius = Math.pow(this.random(index + 41), 0.73) * 0.98;
      const angle = arm * Math.PI / 2 + radius * 5.4 + (this.random(index + 821) - 0.5) * (0.25 + 0.65 * radius);
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, alpha: 0.13 + this.random(index + 987) * 0.63, arm, radius: 0.3 + this.random(index + 201) * 0.8 };
    });
    this.backgroundStars = Array.from({ length: 260 }, (_, index) => ({ x: this.random(index + 991), y: this.random(index + 345), radius: 0.25 + this.random(index + 720) }));
    this.resize();
  }

  resize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * pixelRatio);
    this.canvas.height = Math.round(this.height * pixelRatio);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  project(x, y) {
    const scale = Math.min(this.width * 0.43, this.height * 0.46);
    const angle = -0.3;
    return { x: this.width * 0.5 + (x * Math.cos(angle) - y * Math.sin(angle)) * scale, y: this.height * 0.52 + (x * Math.sin(angle) + y * Math.cos(angle)) * scale * 0.78 };
  }

  reset() { this.phase = -0.7; this.showOrbit = true; }

  update(delta, speed, isPlaying) {
    if (isPlaying) this.phase += delta * speed * 0.105;
    this.draw();
  }

  draw() {
    if (!this.width || !this.height) return;
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    for (const star of this.backgroundStars) {
      context.fillStyle = 'rgba(219,232,255,.46)';
      context.beginPath();
      context.arc(star.x * this.width, star.y * this.height, star.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.save();
    context.globalCompositeOperation = 'screen';
    const shades = ['148,185,255', '226,211,251', '152,209,255', '252,199,152'];
    for (const star of this.galaxyStars) {
      const point = this.project(star.x, star.y);
      context.fillStyle = `rgba(${shades[star.arm]},${star.alpha})`;
      context.beginPath();
      context.arc(point.x, point.y, star.radius, 0, Math.PI * 2);
      context.fill();
    }
    const center = this.project(0, 0);
    const coreRadius = Math.min(this.width, this.height) * 0.24;
    const core = context.createRadialGradient(center.x, center.y, 1, center.x, center.y, coreRadius);
    core.addColorStop(0, 'rgba(255,238,177,.99)');
    core.addColorStop(0.12, 'rgba(255,196,117,.6)');
    core.addColorStop(0.45, 'rgba(208,135,198,.15)');
    core.addColorStop(1, 'rgba(135,101,215,0)');
    context.fillStyle = core;
    context.beginPath();
    context.arc(center.x, center.y, coreRadius, 0, Math.PI * 2);
    context.fill();
    context.restore();

    const orbitRadius = 0.68;
    if (this.showOrbit) {
      context.beginPath();
      for (let step = 0; step <= 220; step += 1) {
        const angle = step / 220 * Math.PI * 2;
        const point = this.project(Math.cos(angle) * orbitRadius, Math.sin(angle) * orbitRadius);
        if (step === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
      }
      context.strokeStyle = 'rgba(255,211,128,.48)';
      context.setLineDash([4, 5]);
      context.lineWidth = 1;
      context.stroke();
      context.setLineDash([]);
    }
    const sun = this.project(Math.cos(this.phase) * orbitRadius, Math.sin(this.phase) * orbitRadius);
    const next = this.project(Math.cos(this.phase + 0.02) * orbitRadius, Math.sin(this.phase + 0.02) * orbitRadius);
    const glow = context.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, 25);
    glow.addColorStop(0, '#fff2a1');
    glow.addColorStop(0.2, 'rgba(255,198,72,.6)');
    glow.addColorStop(1, 'rgba(255,150,30,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(sun.x, sun.y, 25, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff4bc';
    context.beginPath();
    context.arc(sun.x, sun.y, 4.2, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffe39b';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(sun.x, sun.y);
    context.lineTo(sun.x + (next.x - sun.x) * 2.2, sun.y + (next.y - sun.y) * 2.2);
    context.stroke();
    context.font = '600 12px system-ui';
    context.fillStyle = '#ffefb9';
    context.textAlign = 'left';
    context.fillText('Solar system', Math.max(8, Math.min(this.width - 90, sun.x + 12)), sun.y - 13);
    context.font = '11px system-ui';
    context.textAlign = 'center';
    context.fillStyle = '#ffd9a6';
    context.fillText('Galactic centre', center.x, center.y + 22);
  }
}