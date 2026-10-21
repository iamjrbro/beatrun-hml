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
assert.equal(run('characterChoice.hair'), 'blond', 'default hair stays blond');
events['hair-pink:click']();
events['outfit-orange:click']();
events['pants-camo:click']();
assert.equal(JSON.parse(storage.get('beat-runner-character')).hair, 'pink');
assert.equal(JSON.parse(storage.get('beat-runner-character')).outfit, 'orange');
assert.equal(JSON.parse(storage.get('beat-runner-character')).pants, 'camo');
events['outfit-white:click'](); events['pants-plain:click'](); events['shoes-nike:click'](); events['view-profile:click']();
assert.equal(run('characterChoice.outfit'), 'white');
assert.equal(run('characterChoice.view'), 'profile');
assert.equal(JSON.parse(storage.get('beat-runner-character')).shoes, 'nike');
assert.equal(JSON.parse(storage.get('beat-runner-character')).pants, 'plain');
assert.equal(element('outfit-white').attributes['aria-pressed'], 'true');
assert.equal(element('outfit-black').attributes['aria-pressed'], 'false');
run("selectCharacter('outfit', 'invalid');");
assert.equal(run('characterChoice.outfit'), 'white');
run(`for (const outfit of choiceOptions.outfit) for (const hair of choiceOptions.hair) for (const pants of choiceOptions.pants) for (const shoes of choiceOptions.shoes)
  for (const view of choiceOptions.view) for (const airborne of [false, true]) {
    drawDJ(ctx, {x: 0, y: 0, outfit, hair, pants, shoes, view, airborne, running: true, phase: 10});
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
run('spawnTimer = -10000; for (let i = 0; i < 180; i++) update();');
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
// Reproduce landing on the same obstacle at the initial slow speed; also
// check larger obstacles, varied timing, later levels and both screen widths.
for (const width of [390, 1024]) for (const points of [0, 1000, 4000]) {
  for (const size of [34, 48]) for (const distance of [60, 100, 150]) {
    run(`window.innerWidth = ${width}; resize(); resetGame();
      player.x = Math.min(160, canvas.width * 0.18); score = ${points}; spawnTimer = -10000;
      beats = [{x: player.x + ${distance}, y: getBeatY(${size}), size: ${size}, rot: 0}];
      doJump();
      for (let i = 0; i < 200 && STATE === 'playing'; i++) {
        update(); if (player.onGround) break;
      }`);
    const scenario = `width=${width}, score=${points}, size=${size}, gap=${distance}`;
    assert.equal(run('STATE'), 'playing', `single jump must clear obstacle: ${scenario}`);
    assert.equal(run('player.onGround'), true, `must land safely: ${scenario}`);
    assert.ok(run('beats.length === 0 || beats[0].x + beats[0].size < player.x - player.w / 2'),
      `obstacle must be behind the player on landing: ${scenario}`);
  }
}
run(`resetGame(); spawnTimer = -10000;
  beats = [{x: player.x, y: getBeatY(48), size: 48, rot: 0}]; doJump(); update();`);
assert.equal(run('STATE'), 'dead', 'jumping after contact still counts as collision');
console.log('OK: 36 jump-clearance scenarios, customization combinations, double jump, collision, score, record, resize and mute.');
