import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const gradient = { addColorStop() {} };
const context = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' ? () => gradient : () => {}, set: () => true });
const events = {};
const elements = new Map();
const storage = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { textContent: '', getContext: () => context,
    addEventListener: (type, fn) => { events[id + ':' + type] = fn; },
    play: () => Promise.resolve(), pause() {}, setAttribute() {} });
  return elements.get(id);
}
const scope = vm.createContext({ console, Math, performance: { now: () => 0 },
  document: { getElementById: element, addEventListener: (type, fn) => { events[type] = fn; } },
  window: { innerWidth: 390, innerHeight: 844, addEventListener: (type, fn) => { events[type] = fn; } },
  localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  CanvasRenderingContext2D: function () {}, requestAnimationFrame() {}, setTimeout() {} });
for (const file of ['character.js', 'game.js']) vm.runInContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), scope);
const run = code => vm.runInContext(code, scope);
run('resetGame(); gameLoop(0);');
assert.equal(run('STATE'), 'playing');
run('doJump(); update();');
assert.equal(run('player.jumpCount'), 1);
assert.equal(run('player.onGround'), false);
run('doJump(); doJump();');
assert.equal(run('player.jumpCount'), 2, 'third jump must be ignored');
run('for (let i = 0; i < 70; i++) update();');
assert.equal(run('player.onGround'), true);
assert.equal(run('player.jumpCount'), 0);
run('beats = []; spawnBeat();');
assert.equal(run('beats[0].y + beats[0].size'), run('getGround() + player.h / 2 + 6'));
run('score = 100; beats[0].x = player.x - 12; update();');
assert.equal(run('STATE'), 'dead', 'ground obstacle must collide with player');
assert.equal(storage.get('beat-runner-best'), '100');
run('resetGame(); beats = [{ x: -90, y: 0, size: 40, speed: 0, rot: 0 }]; update(); update();');
assert.equal(run('score'), 10, 'one obstacle awards points only once');
assert.equal(run('combo'), 1);
run('doJump(); update();');
const distance = run('getGround() - player.y');
run('window.innerHeight = 600;'); events.resize();
assert.equal(run('getGround() - player.y'), distance);
events['sound:click']();
assert.equal(element('music').muted, true);
assert.equal(element('sound').textContent, 'SOM OFF');
run('resetGame(); gameLoop(1000); gameLoop(1017);');
assert.ok(run('frame') >= 1);
run('resetGame();');
const initialSpeed = run('getRunSpeed()');
assert.equal(initialSpeed, 2.8, 'start at a relaxed pace');
run('update();');
assert.ok(run('player.runFrame') < 1, 'walking animation starts slowly too');
run('frame = 1800; level = 3;');
assert.ok(run('getRunSpeed()') > initialSpeed, 'pace increases as the run advances');
run('frame = 999999; level = 100;');
assert.equal(run('getRunSpeed()'), 8.5, 'speed has a playable upper limit');
console.log('OK: render smoke, double jump, landing, collision, record, scoring, resize and mute.');
