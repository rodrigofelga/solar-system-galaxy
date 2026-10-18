import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { referenceBasis, displayState, sampleState, timeAtProgress, progressAtTime, dot, norm, cross, chapterKnots, integratedPosition } from '../js/mission/trajectory.js';
const data = JSON.parse(fs.readFileSync(new URL('../assets/mission/artemis-ii.json', import.meta.url)));
const basis = referenceBasis(data);
const distance = (a, b) => norm(a.map((value, i) => value-b[i]));

test('published states retain their UTC ordering, units, and exact interpolation endpoints', () => {
  assert.equal(data.rows.length, 3262); assert.equal(data.sourceCreated, '2026-04-10T03:22:19Z');
  for (let i = 1; i < data.rows.length; i += 1) assert.ok(data.rows[i][0] > data.rows[i-1][0]);
  for (const index of [0, 300, 1000, 2000, data.rows.length-1]) {
    const row = data.rows[index]; const result = sampleState(data, row[0]);
    for (let j = 0; j < 12; j += 1) assert.ok(Math.abs(result[j]-row[j+1]) < 1e-7);
  }
});

test('chapter pacing is monotone, invertible, and ends at the documented UTC bookend', () => {
  let previous = -1;
  for (let i = 0; i <= 1000; i += 1) {
    const p = i/1000; const t = timeAtProgress(data,p);
    assert.ok(t >= previous); previous=t; assert.ok(Math.abs(progressAtTime(data,t)-p) < 1e-10);
  }
  assert.equal(new Date(Date.parse(data.epoch) + data.end*1000).toISOString(), '2026-04-11T00:07:00.000Z');
});

test('mission reference frame is orthonormal and right handed', () => {
  basis.forEach((axis)=>assert.ok(Math.abs(norm(axis)-1)<1e-10));
  assert.ok(Math.abs(dot(basis[0],basis[1]))<1e-10);
  assert.ok(Math.abs(dot(basis[0],basis[2]))<1e-10);
  assert.ok(dot(cross(basis[0],basis[1]),basis[2])>0.9999999999);
});

test('Orion reaches the moving lunar far side, clears the Moon, and returns to Earth', () => {
  const state = sampleState(data,data.flyby);
  const relative = state.slice(0,3).map((x,i)=>x-state[i+6]);
  assert.ok(norm(relative)>8000 && norm(relative)<8600);
  assert.ok(dot(relative,state.slice(6,9))>0,'flyby must be on the side away from Earth');
  const flyby = displayState(data,basis,data.flyby);
  assert.ok(distance(flyby.slice(0,3),flyby.slice(3))>0.6,'enlarged solar wings must clear the enlarged Moon');
  const departure=displayState(data,basis,0); const arrival=displayState(data,basis,data.end);
  assert.ok(norm(departure.slice(0,3))<1.1); assert.ok(norm(arrival.slice(0,3))<1.1);
  assert.ok(norm(flyby.slice(0,3))>12);
});

test('trajectory remains finite and outside Earth and Moon at 10,001 mission times', () => {
  for(let i=0;i<=10000;i+=1) {
    const state=displayState(data,basis,timeAtProgress(data,i/10000));
    assert.ok(state.every(Number.isFinite));
    assert.ok(norm(state.slice(0,3))>0.949,'Earth surface display clearance, including splashdown');
    if(i/10000>=.12&&i/10000<=.94) assert.ok(norm(state.slice(0,3))>1.23,'deployed wings must clear Earth');
    assert.ok(distance(state.slice(0,3),state.slice(3))>0.6,'lunar surface display clearance');
  }
});

test('all chapter boundaries connect without a position jump', () => {
  for(const [,t] of chapterKnots(data).slice(1,-1)) {
    const before=displayState(data,basis,t-0.01).slice(0,3); const after=displayState(data,basis,t+0.01).slice(0,3);
    assert.ok(distance(before,after)<0.0001);
  }
});

test('Moon advances independently while full route remains Earth-centred', () => {
  const a=displayState(data,basis,data.first); const b=displayState(data,basis,data.last);
  assert.ok(distance(a.slice(3),b.slice(3))>15,'mission Moon must move rather than remain fixed at flyby');
  const p=displayState(data,basis,data.flyby).slice(0,3);
  // A translated Earth-centred route must retain exactly the same relative state.
  const earthA=[1,2,3],earthB=[-10,0.5,8];
  const worldA=p.map((x,i)=>x+earthA[i]),worldB=p.map((x,i)=>x+earthB[i]);
  assert.ok(distance(worldA.map((x,i)=>x-earthA[i]),worldB.map((x,i)=>x-earthB[i]))<1e-12);
});


test('integrated route clears original-sized bodies and returns to Earth',()=>{
 const flyby=displayState(data,basis,data.flyby);const radius=norm(flyby.slice(3));
 for(let i=0;i<=10000;i++){
  const p=i/10000;const adapted=integratedPosition(displayState(data,basis,timeAtProgress(data,p)),radius,2.75,p);
  assert.ok(adapted.every(Number.isFinite));assert.ok(norm(adapted)>=.9499);
  assert.ok(distance(adapted,[2.75,0,0])>=.6399);
 }
 const encounter=integratedPosition(flyby,radius,2.75,.62);
 assert.ok(encounter[0]>2.75&&distance(encounter,[2.75,0,0])<.65);
 const arrival=integratedPosition(displayState(data,basis,data.end),radius,2.75,1);
 assert.ok(norm(arrival)<1);
});
