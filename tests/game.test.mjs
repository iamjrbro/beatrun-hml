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
    play: () => Promise.resolve(), pause() {}, focus() {}, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } });
  return elements.get(id);
}
const scope = vm.createContext({ console, Math, performance: { now: () => 0 },
  document: { getElementById: element, addEventListener: (type, fn) => { events[type] = fn; } },
  window: { innerWidth: 390, innerHeight: 844, addEventListener: (type, fn) => { events[type] = fn; } },
  localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  CanvasRenderingContext2D: function () {}, requestAnimationFrame() {}, setTimeout() {} });
for (const file of ['character.js', 'game.js']) vm.runInContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), scope);
const run = code => vm.runInContext(code, scope);
events['outfit-white:click'](); events['pants-plain:click'](); events['shoes-nike:click'](); events['view-profile:click']();
assert.equal(run('characterChoice.outfit'), 'white');
assert.equal(run('characterChoice.view'), 'profile');
assert.equal(JSON.parse(storage.get('beat-runner-character')).shoes, 'nike');
assert.equal(JSON.parse(storage.get('beat-runner-character')).pants, 'plain');
assert.equal(element('outfit-white').attributes['aria-pressed'], 'true');
assert.equal(element('outfit-black').attributes['aria-pressed'], 'false');
run("selectCharacter('outfit', 'invalid');");
assert.equal(run('characterChoice.outfit'), 'white');
run(`for (const outfit of choiceOptions.outfit) for (const pants of choiceOptions.pants) for (const shoes of choiceOptions.shoes)
  for (const view of choiceOptions.view) for (const airborne of [false, true]) {
    drawDJ(ctx, {x: 0, y: 0, outfit, pants, shoes, view, airborne, running: true, phase: 10});
  }`);
events['play:click']();
assert.equal(element('wardrobe').hidden, true);
run(`const originalDrawDJ = drawDJ; let renderedChoice;
  drawDJ = (ctx, choice) => { renderedChoice = choice; }; drawPlayer(); drawDJ = originalDrawDJ;`);
assert.equal(run('renderedChoice.view'), 'profile');
assert.equal(run('renderedChoice.outfit'), 'white');
assert.equal(run('renderedChoice.shoes'), 'nike');
assert.equal(run('renderedChoice.pants'), 'plain');
events['change-look:click']();
assert.equal(run('STATE'), 'start');
assert.equal(element('wardrobe').hidden, false);
assert.equal(run('characterChoice.view'), 'profile');
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
