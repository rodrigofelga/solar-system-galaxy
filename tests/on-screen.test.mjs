import assert from 'node:assert/strict';
import test from 'node:test';
import { watchOnScreen } from '../js/on-screen.js';

class FakeObserver {
  constructor(callback) { this.callback = callback; FakeObserver.last = this; }
  observe(element) { this.element = element; }
  deliver(...states) { this.callback(states.map((isIntersecting) => ({ isIntersecting }))); }
}

const watch = () => {
  globalThis.IntersectionObserver = FakeObserver;
  const seen = [];
  const element = {};
  const observer = watchOnScreen(element, (state) => seen.push(state));
  return { seen, element, observer };
};

test('observes the element it was given', () => {
  const { element, observer } = watch();
  assert.equal(observer.element, element);
});

test('off screen then on screen in one batch reads as on screen, the batch that froze the Journey', () => {
  const { seen, observer } = watch();
  observer.deliver(false, true);
  assert.deepEqual(seen, [true]);
});

test('on screen then off screen in one batch reads as off screen', () => {
  const { seen, observer } = watch();
  observer.deliver(true, false);
  assert.deepEqual(seen, [false]);
});

test('single entries report as they come', () => {
  const { seen, observer } = watch();
  observer.deliver(false);
  observer.deliver(true);
  assert.deepEqual(seen, [false, true]);
});
