// Pure numerical functions, shared by the renderer and the Node integration tests.
export const KM_TO_SCENE = 1 / 32000;
export const EARTH_KM = 6371;
export const MOON_KM = 1737.4;
export const PLAYBACK_SECONDS = 120;
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a) => Math.hypot(...a);
export const unit = (a) => { const n = norm(a) || 1; return a.map((v) => v / n); };
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export function chapterKnots(data) {
  return [[0, 0], [0.12, data.first], [0.26, data.tli], [0.30, data.tli + data.tliDuration],
    [0.56, data.flyby - 10800], [0.68, data.flyby + 10800], [0.94, data.last], [1, data.end]];
}

export function timeAtProgress(data, progress) {
  const p = clamp(progress); const knots = chapterKnots(data);
  for (let i = 1; i < knots.length; i += 1) {
    if (p <= knots[i][0]) {
      const [p0, t0] = knots[i - 1]; const [p1, t1] = knots[i];
      return t0 + (t1 - t0) * (p - p0) / (p1 - p0);
    }
  }
  return data.end;
}

export function progressAtTime(data, time) {
  const knots = chapterKnots(data); const t = clamp(time, 0, data.end);
  for (let i = 1; i < knots.length; i += 1) {
    if (t <= knots[i][1]) {
      const [p0, t0] = knots[i - 1]; const [p1, t1] = knots[i];
      return p0 + (p1 - p0) * (t - t0) / (t1 - t0);
    }
  }
  return 1;
}

// Cubic Hermite interpolates positions and published velocities in one inertial frame.
export function sampleState(data, time, out = new Array(12)) {
  const rows = data.rows; const t = clamp(time, data.first, data.last);
  let low = 0; let high = rows.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (rows[mid][0] <= t) low = mid; else high = mid; }
  const a = rows[low]; const b = rows[high]; const dt = b[0] - a[0]; const u = (t - a[0]) / dt;
  const h00 = 2*u*u*u - 3*u*u + 1; const h10 = u*u*u - 2*u*u + u;
  const h01 = -2*u*u*u + 3*u*u; const h11 = u*u*u - u*u;
  for (const offset of [0, 6]) {
    for (let axis = 0; axis < 3; axis += 1) {
      const p = 1 + offset + axis; const v = p + 3;
      out[offset + axis] = h00*a[p] + h10*dt*a[v] + h01*b[p] + h11*dt*b[v];
      out[offset + axis + 3] = ((6*u*u-6*u)*a[p] + (3*u*u-4*u+1)*dt*a[v] + (-6*u*u+6*u)*b[p] + (3*u*u-2*u)*dt*b[v]) / dt;
    }
  }
  return out;
}

export function referenceBasis(data) {
  const state = sampleState(data, data.flyby);
  const x = unit(state.slice(6, 9));
  const a = data.rows[0].slice(7, 10); const b = data.rows.at(-1).slice(7, 10);
  const normal = unit(cross(a, b)); const z = unit(cross(x, normal)); const y = unit(cross(z, x));
  return [x, y, z];
}

// Synthetic bookends intentionally never masquerade as spacecraft measurements.
function launchPosition(data, time) {
  const u = clamp(time/data.first); const first = data.rows[0];
  const x = unit(first.slice(1,4)); const y = unit(cross([0,0,1],x));
  const theta = -4*Math.PI*(1-u)*(1-u);
  const r = EARTH_KM+30+(norm(first.slice(1,4))-EARTH_KM-30)*u*u;
  return x.map((v,i)=>r*(v*Math.cos(theta)+y[i]*Math.sin(theta)));
}

export function physicalState(data, time, out = new Array(12)) {
  sampleState(data, time, out);
  if (time < data.first) {
    let position = launchPosition(data,time);
    // Match the first published velocity as well as its position, avoiding an attitude snap.
    const join = data.first*0.9;
    if(time>join) {
      const a=launchPosition(data,join); const before=launchPosition(data,join-1); const after=launchPosition(data,join+1);
      const dt=data.first-join; const u=(time-join)/dt; const first=data.rows[0];
      position=a.map((v,i)=>(2*u*u*u-3*u*u+1)*v+(u*u*u-2*u*u+u)*dt*(after[i]-before[i])/2+(-2*u*u*u+3*u*u)*first[i+1]+(u*u*u-u*u)*dt*first[i+4]);
    }
    for (let i = 0; i < 3; i += 1) out[i] = position[i];
  } else if (time > data.last) {
    const u = clamp((time - data.last) / (data.end - data.last));
    const last = data.rows.at(-1); const d = unit(last.slice(1, 4));
    const target = unit(last.slice(1, 4).map((v, i) => v + last[i + 4] * 140));
    const r = norm(last.slice(1, 4)) * (1 - u) + EARTH_KM * u;
    const turn = u*u*(3-2*u);
    const direction = unit(d.map((v, i) => v * (1-turn) + target[i] * turn));
    for (let i = 0; i < 3; i += 1) out[i] = direction[i] * r;
  }
  // Extrapolate the computed lunar model over only the short illustrative bookends.
  const delta = time - clamp(time, data.first, data.last);
  for (let i = 0; i < 3; i += 1) out[6+i] += delta * out[9+i];
  return out;
}

export function displayState(data, basis, time, out = new Array(6), scratch = new Array(12)) {
  physicalState(data, time, scratch);
  const earthDistance = Math.hypot(scratch[0], scratch[1], scratch[2]);
  const dx = scratch[0] - scratch[6]; const dy = scratch[1] - scratch[7]; const dz = scratch[2] - scratch[8];
  const moonDistance = Math.hypot(dx, dy, dz);
  let earthClearance = 1.24;
  if(time<data.first) { const u=clamp(time/data.first); earthClearance=1.04+0.20*u*u*(3-2*u); }
  if(time>data.last) { const u=clamp((time-data.last)/(data.end-data.last)); earthClearance=1.24-0.29*u*u*(3-2*u); }
  const earthBoost = (earthClearance - EARTH_KM * KM_TO_SCENE) * Math.exp(-Math.max(0, earthDistance-EARTH_KM) / 50000);
  const moonBoost = (0.50 - MOON_KM * KM_TO_SCENE) * Math.exp(-Math.max(0, moonDistance-MOON_KM) / 30000);
  const boosted = [scratch[0] * KM_TO_SCENE + scratch[0]/earthDistance * earthBoost + dx/moonDistance * moonBoost,
    scratch[1] * KM_TO_SCENE + scratch[1]/earthDistance * earthBoost + dy/moonDistance * moonBoost,
    scratch[2] * KM_TO_SCENE + scratch[2]/earthDistance * earthBoost + dz/moonDistance * moonBoost];
  for (let i = 0; i < 3; i += 1) {
    out[i] = dot(boosted, basis[i]);
    out[i+3] = (scratch[6]*basis[i][0] + scratch[7]*basis[i][1] + scratch[8]*basis[i][2]) * KM_TO_SCENE;
  }
  return out;
}
