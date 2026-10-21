/* ============================================================
   BEAT RUNNER – game.js
   Presente para o DJ – personagem inspirado na arte fornecida
   ============================================================ */

const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const levelEl = document.getElementById('level');
const music   = document.getElementById('music');

/* Character choices are validated before restoring browser preferences. */
const choiceOptions = { outfit: ['black', 'white', 'neon', 'orange'], hair: ['blond', 'pink'], pants: ['sparkle', 'plain', 'camo'], shoes: ['sneakers', 'boots', 'nike'], view: ['front', 'profile'] };
const characterChoice = { outfit: 'black', hair: 'blond', pants: 'sparkle', shoes: 'sneakers', view: 'front' };
try {
  const saved = JSON.parse(localStorage.getItem('beat-runner-character') || '{}');
  for (const key of Object.keys(choiceOptions)) {
    // Always open with blond hair; pink is an explicit choice for this visit.
    if (key !== 'hair' && choiceOptions[key].includes(saved?.[key])) characterChoice[key] = saved[key];
  }
} catch {}
function selectCharacter(key, value) {
  if (!choiceOptions[key]?.includes(value)) return;
  characterChoice[key] = value;
  for (const option of choiceOptions[key]) {
    document.getElementById(key + '-' + option).setAttribute('aria-pressed', String(option === value));
  }
  try { localStorage.setItem('beat-runner-character', JSON.stringify(characterChoice)); } catch {}
}
for (const [key, values] of Object.entries(choiceOptions)) {
  for (const value of values) document.getElementById(key + '-' + value).addEventListener('click', () => selectCharacter(key, value));
  selectCharacter(key, characterChoice[key]);
}
const wardrobe = document.getElementById('wardrobe');
const playButton = document.getElementById('play');
const changeLookButton = document.getElementById('change-look');
playButton.addEventListener('click', () => { resetGame(); canvas.focus(); });
changeLookButton.addEventListener('click', () => {
  document.getElementById('start-controls').hidden = false;
  document.getElementById('start-best').textContent = 'SEU MELHOR SET: ' + highScore + ' PTS';
  STATE = 'start'; wardrobe.hidden = false; playButton.hidden = false;
  beats = []; particles = []; trail = []; comboTexts = [];
  changeLookButton.hidden = true; document.getElementById('hud').hidden = true;
  playButton.focus();
});

/* ── RESIZE ── */
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', () => {
  const oldGround = getGround(); resize();
  player.y += getGround() - oldGround;
  beats.forEach(b => { b.y = getBeatY(b.size); });
  buildStars();
});

/* ── ÁUDIO SINTÉTICO ── */
let audioCtx = null;
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, duration, vol = 0.2) {
  if (muted) return;
  try {
    const a = ac();
    const o = a.createOscillator();
    const g = a.createGain();
    o.connect(g); g.connect(a.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, a.currentTime);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + duration);
    o.start(); o.stop(a.currentTime + duration);
  } catch (e) {}
}
function sfxJump()  { playTone(300,'sine',0.2); setTimeout(()=>playTone(550,'sine',0.12),60); }
function sfxScore() { playTone(440,'sine',0.08,0.15); setTimeout(()=>playTone(660,'sine',0.08,0.12),50); }
function sfxDead()  { playTone(120,'sawtooth',0.5,0.35); }
function startMusic() {
  if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {});
  music.volume = 0.45;
  music.play().catch(()=>{});
}

/* ── ESTADO ── */
let STATE       = 'start'; // 'start' | 'playing' | 'dead'
let score       = 0;
let combo       = 0;
let level       = 1;
let frame       = 0;
let highScore = 0;
try { highScore = Number(localStorage.getItem('beat-runner-best')) || 0; } catch {}
document.getElementById('start-best').textContent = 'SEU MELHOR SET: ' + highScore + ' PTS';
let muted = false;
const soundButton = document.getElementById('sound');
soundButton.addEventListener('click', () => {
  muted = !muted; music.muted = muted;
  soundButton.textContent = muted ? 'SOM OFF' : 'SOM ON';
  soundButton.setAttribute('aria-pressed', String(muted));
});
let spawnTimer  = 0;
// A gentle first set, with one shared pace for the runner and incoming obstacles.
function getRunSpeed() { return Math.min(8.5, 2.8 + (level - 1) * 0.45 + Math.min(frame / 3600, 1.5)); }

/* ── PLAYER ── */
const player = {
  x: 0, y: 0,
  vy: 0,
  w: 54, h: 110,
  jumpCount: 0,
  maxJumps: 2,
  onGround: false,
  squish: 1,
  squishV: 0,
  runFrame: 0,
};

const GRAVITY    = 0.65;
const JUMP_FORCE = -13.5;

function getGround() { return canvas.height - 145; }
function getBeatY(size) { return getGround() + player.h / 2 + 6 - size; }

/* ── LISTAS ── */
let beats      = [];
let particles  = [];
let stars      = [];
let comboTexts = [];
let trail      = [];
let scanLines  = [];

/* ── ESTRELAS ── */
function buildStars() {
  stars = [];
  for (let i = 0; i < 100; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.75,
      r: Math.random() * 1.6 + 0.3,
      speed: Math.random() * 0.6 + 0.15,
      phase: Math.random() * Math.PI * 2,
    });
  }
}
buildStars();

/* ── RESET ── */
function resetGame() {
  document.getElementById('start-controls').hidden = true;
  document.getElementById('hud').hidden = false;
  wardrobe.hidden = true; playButton.hidden = true; changeLookButton.hidden = true;
  score = 0; combo = 0; level = 1; frame = 0; spawnTimer = 0;
  beats = []; particles = []; comboTexts = []; trail = [];
  player.y = getGround();
  player.vy = 0;
  player.onGround = true;
  player.jumpCount = 0;
  player.squish = 1;
  player.squishV = 0;
  player.runFrame = 0;
  scoreEl.textContent = '0';
  comboEl.textContent = 'x0';
  levelEl.textContent = '1';
  STATE = 'playing';
  startMusic();
}

/* ── PULO ── */
function doJump() {
  if (STATE === 'start') { resetGame(); return; }
  if (STATE === 'dead')  { resetGame(); return; }
  if (player.jumpCount < player.maxJumps) {
    player.onGround = false;
    player.vy = JUMP_FORCE;
    player.jumpCount++;
    player.squish = 1.45;
    sfxJump();
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: player.x, y: player.y + player.h / 2,
        vx: (Math.random() - 0.5) * 5,
        vy:  Math.random() * 3 + 1,
        life: 1, r: Math.random() * 4 + 2,
        color: '#00ffc8',
      });
    }
  }
}

/* ── INPUTS ── */
document.addEventListener('keydown', e => {
  if ((e.code === 'Space' || e.code === 'ArrowUp') && e.target.tagName !== 'BUTTON') { e.preventDefault(); if (!e.repeat) doJump(); }
});
canvas.addEventListener('pointerdown', () => doJump());

/* ── SPAWN ── */
const BEAT_TYPES = ['note','note','diamond','circle','vinyl'];

function spawnBeat() {
  const type = BEAT_TYPES[Math.floor(Math.random() * BEAT_TYPES.length)];
  const size = 34 + Math.random() * 14;
  beats.push({
    x: canvas.width + 40,
    y: getBeatY(size),
    size,
    type,
    rot: 0,
    speed: getRunSpeed(),
    color: type === 'diamond' ? '#ffaa00'
         : type === 'vinyl'   ? '#cc88ff'
         : '#ff44cc',
  });
}

/* ── PARTÍCULA DE HIT ── */
function hitParticles(x, y, color) {
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 7 + 2;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 1,
      r: Math.random() * 5 + 2,
      color,
    });
  }
}

/* ── COMBO TEXT ── */
function addComboText(x, y, text, color) {
  comboTexts.push({ x, y, text, color, life: 1, vy: -2.2 });
}

/* ── UPDATE ── */
function update() {
  frame++;
  player.runFrame += getRunSpeed() / 6;

  /* nível */
  level = 1 + Math.floor(score / 250);
  levelEl.textContent = level;
  const spawnInterval = Math.max(48, 130 - level * 7);

  /* spawn */
  spawnTimer++;
  if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnBeat(); }

  /* física */
  // Keep the jump arc aligned with the distance obstacles travel.
  const jumpStep = getRunSpeed() / 6;
  player.vy += GRAVITY * jumpStep;
  player.y  += player.vy * jumpStep;
  const ground = getGround();
  if (player.y >= ground) {
    if (!player.onGround) player.squish = 0.9;
    player.y = ground;
    player.vy = 0;
    player.onGround = true;
    player.jumpCount = 0;
  } else {
    player.onGround = false;
  }

  /* squish spring */
  player.squishV += (1 - player.squish) * 0.28;
  player.squishV *= 0.62;
  player.squish  += player.squishV;

  /* trail */
  trail.push({ x: player.x, y: player.y, life: 1 });
  if (trail.length > 14) trail.shift();
  trail.forEach(t => t.life -= 0.07);

  /* beats */
  for (let i = beats.length - 1; i >= 0; i--) {
    const b = beats[i];
    b.x  -= getRunSpeed();
    b.rot += 0.06;

    /* colisão (hitbox reduzida) */
    const margin = 10;
    const px = player.x - player.w / 2 + margin;
    const py = player.y - player.h / 2 + margin;
    const pw = player.w - margin * 2;
    const ph = player.h - margin * 2;
    if (px < b.x + b.size && px + pw > b.x && py < b.y + b.size && py + ph > b.y) {
      STATE = 'dead';
      changeLookButton.hidden = false;
      if (score > highScore) {
        highScore = score;
        try { localStorage.setItem('beat-runner-best', String(highScore)); } catch {}
      }
      music.pause();
      sfxDead();
      hitParticles(player.x, player.y, '#ff4466');
      beats = [];
      return;
    }

    /* passou */
    if (b.x < -80) {
      const bonus = 10 * (1 + Math.floor(combo / 5));
      score += bonus;
      combo++;
      scoreEl.textContent = score;
      comboEl.textContent = 'x' + combo;
      sfxScore();
      const label = combo > 1 ? '+' + bonus + '  x' + combo + ' COMBO!' : '+10';
      const col   = combo > 14 ? '#ffdd00' : combo > 7 ? '#00ffc8' : '#ffffff';
      addComboText(canvas.width / 2, getGround() - 60, label, col);
      beats.splice(i, 1);
    }
  }

  /* particles */
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.18;
    p.life -= 0.032;
  });
  particles = particles.filter(p => p.life > 0);

  /* comboTexts */
  comboTexts.forEach(c => { c.y += c.vy; c.life -= 0.022; });
  comboTexts = comboTexts.filter(c => c.life > 0);
}

/* ================================================================
   DRAW – FUNDO
   ================================================================ */
function drawBackground() {
  const w = canvas.width, h = canvas.height;

  /* céu */
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#03030f');
  sky.addColorStop(1, '#08081a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  /* grade perspectiva (chão) */
  const vanishY = h * 0.55;
  const gridOff = (player.runFrame * 2) % 60;
  ctx.strokeStyle = 'rgba(0,255,200,0.06)';
  ctx.lineWidth = 1;

  /* linhas verticais perspectiva */
  for (let i = -20; i <= 20; i++) {
    const bx = w / 2 + i * 80;
    ctx.beginPath();
    ctx.moveTo(w / 2, vanishY);
    ctx.lineTo(bx, h);
    ctx.stroke();
  }
  /* linhas horizontais */
  for (let d = 0; d < 1; d += 0.06) {
    const y = vanishY + (h - vanishY) * Math.pow((d + (gridOff / 600)) % 1, 1.3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  /* estrelas */
  const starSpeed = getRunSpeed() / 7;
  stars.forEach(s => {
    s.x -= s.speed * starSpeed;
    if (s.x < 0) { s.x = w + 5; s.y = Math.random() * h * 0.55; }
    const pulse = 0.5 + 0.5 * Math.sin(frame * 0.05 + s.phase);
    ctx.fillStyle = `rgba(180,220,255,${0.25 + pulse * 0.5})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  /* chão glow */
  const gY = getGround() + player.h / 2 + 6;
  ctx.save();
  ctx.shadowColor = '#00ffc8';
  ctx.shadowBlur  = 18;
  ctx.strokeStyle = '#00ffc8';
  ctx.lineWidth   = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, gY);
  ctx.lineTo(w, gY);
  ctx.stroke();
  ctx.restore();

  /* reflexo chão */
  const ref = ctx.createLinearGradient(0, gY, 0, gY + 40);
  ref.addColorStop(0, 'rgba(0,255,200,0.12)');
  ref.addColorStop(1, 'rgba(0,255,200,0)');
  ctx.fillStyle = ref;
  ctx.fillRect(0, gY, w, 40);
}

/* ================================================================
   DRAW – PERSONAGEM DJ
   Arte original inspirada nas fotos, com roupas, calçados e vista selecionáveis
   ================================================================ */
function drawPlayer() {
  if (STATE === 'start') return;
  ctx.save();
  ctx.translate(player.x, player.y + player.h / 2 + 6);
  ctx.scale(1 / player.squish, player.squish);
  ctx.fillStyle = 'rgba(0,255,200,0.15)';
  ctx.beginPath(); ctx.ellipse(0, 0, 29, 5, 0, 0, Math.PI * 2); ctx.fill();
  drawDJ(ctx, { ...characterChoice, x: 0, y: -54, phase: player.runFrame,
    running: STATE === 'playing' && player.onGround, airborne: !player.onGround });
  ctx.restore();
}

function drawTrail() {
  trail.forEach((t, i) => {
    const a = t.life * 0.25 * (i / trail.length);
    ctx.fillStyle = `rgba(0,255,200,${a})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, (i / trail.length) * player.w * 0.35, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ================================================================
   DRAW – BEATS (obstáculos musicais)
   ================================================================ */
function drawNote(ctx, size) {
  /* nota musical clássica */
  ctx.fillStyle = '#ff44cc';
  ctx.shadowColor = '#ff44cc';
  ctx.shadowBlur = 14;
  // haste
  ctx.fillRect(-size * 0.08, -size * 0.55, size * 0.15, size * 0.65);
  // cabeça oval
  ctx.save();
  ctx.translate(-size * 0.18, size * 0.1);
  ctx.rotate(-0.4);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.22, size * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // bandeira
  ctx.strokeStyle = '#ff44cc';
  ctx.lineWidth = size * 0.1;
  ctx.beginPath();
  ctx.moveTo(size * 0.07, -size * 0.55);
  ctx.bezierCurveTo(size * 0.35, -size * 0.3, size * 0.35, -size * 0.05, size * 0.1, size * 0.0);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawDiamond(ctx, size, color) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.55);
  ctx.lineTo(size * 0.45, 0);
  ctx.lineTo(0, size * 0.55);
  ctx.lineTo(-size * 0.45, 0);
  ctx.closePath();
  ctx.fill();
  // brilho
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.5);
  ctx.lineTo(size * 0.2, -size * 0.1);
  ctx.lineTo(0, 0);
  ctx.lineTo(-size * 0.2, -size * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawVinyl(ctx, size) {
  /* disco de vinil */
  ctx.fillStyle = '#1a0a2e';
  ctx.shadowColor = '#cc88ff';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
  ctx.fill();
  // sulcos
  for (let r = 0.15; r < 0.45; r += 0.08) {
    ctx.strokeStyle = `rgba(180,100,255,${0.4 - r * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, size * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // label central
  ctx.fillStyle = '#cc88ff';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.13, 0, Math.PI * 2);
  ctx.fill();
  // buraco
  ctx.fillStyle = '#1a0a2e';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawCircleObstacle(ctx, size) {
  /* anel pulsante */
  const p = 0.5 + 0.5 * Math.sin(frame * 0.15);
  ctx.strokeStyle = '#ff44cc';
  ctx.shadowColor = '#ff44cc';
  ctx.lineWidth = 3 + p * 2;
  ctx.shadowBlur = 10 + p * 10;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,68,204,${0.08 + p * 0.08})`;
  ctx.fill();
  // símbolo de onda (EQ)
  ctx.strokeStyle = '#ff88ee';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  for (let x = -size * 0.3; x <= size * 0.3; x += 2) {
    const y = Math.sin((x / (size * 0.15)) * Math.PI + frame * 0.2) * size * 0.12;
    x === -size * 0.3 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawBeats() {
  beats.forEach(b => {
    ctx.save();
    ctx.translate(b.x + b.size / 2, b.y + b.size / 2);
    ctx.rotate(b.rot);
    const s = b.size;
    switch (b.type) {
      case 'note':    drawNote(ctx, s);                   break;
      case 'diamond': drawDiamond(ctx, s, b.color);       break;
      case 'vinyl':   drawVinyl(ctx, s);                  break;
      case 'circle':  drawCircleObstacle(ctx, s);         break;
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  });
}

/* ================================================================
   DRAW – PARTICLES
   ================================================================ */
function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
}

/* ================================================================
   DRAW – COMBO TEXTS
   ================================================================ */
function drawComboTexts() {
  comboTexts.forEach(c => {
    ctx.globalAlpha = c.life;
    ctx.fillStyle   = c.color;
    ctx.shadowColor = c.color;
    ctx.shadowBlur  = 8;
    ctx.font        = `bold ${16 + Math.min(combo, 15)}px 'Courier New'`;
    ctx.textAlign   = 'center';
    ctx.fillText(c.text, c.x, c.y);
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
  ctx.textAlign   = 'left';
}

/* ================================================================
   TELAS – START / GAME OVER
   ================================================================ */
function drawStart() {
  const w = canvas.width, h = canvas.height;
  const compact = h <= 500 && w >= 600;
  const short = h <= 700;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a4beb9';
  ctx.font = "11px 'Courier New'";
  ctx.fillText('PARA QUEM FAZ O BEAT ACONTECER', w / 2, h * 0.19 - 55);
  ctx.font = "bold " + Math.min(w * 0.1, h * 0.1, 62) + "px 'Courier New'";
  ctx.fillStyle = '#c8fff0'; ctx.shadowColor = '#00ffc8'; ctx.shadowBlur = 22;
  ctx.fillText('BEAT RUNNER', w / 2, h * 0.19 + 10);
  ctx.shadowBlur = 0;
  // Reserve the entire subtitle line before fitting the portrait above the menu.
  const portraitTop = h * 0.19 + 38 + 20;
  const portraitBottom = compact ? h - 72 : h * (short ? 0.54 : 0.58) - 12;
  const avatarY = (portraitTop + portraitBottom) / 2 + 7;
  const avatarX = w * (compact ? 0.24 : 0.5);
  const scale = Math.max(0.1, Math.min(1.7, (portraitBottom - portraitTop) / 146));
  ctx.fillStyle = 'rgba(0,255,200,0.06)';
  ctx.strokeStyle = 'rgba(0,255,200,0.22)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(avatarX, avatarY - 7, scale * 73, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  drawDJ(ctx, { ...characterChoice, x: avatarX, y: avatarY, scale, phase: performance.now() / 17 });
  ctx.textAlign = 'center';
  ctx.font = "12px 'Courier New'"; ctx.fillStyle = '#b5c8c5';
  ctx.fillText('Para sempre o DJ', w / 2, h * 0.19 + 38);

  ctx.textAlign = 'left';
}

function drawDead() {
  const w = canvas.width, h = canvas.height;

  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.min(w * 0.09, 54)}px 'Courier New'`;
  ctx.shadowColor = '#ff4466';
  ctx.shadowBlur  = 28;
  ctx.fillStyle   = '#ff4466';
  ctx.fillText('GAME OVER', w / 2, h / 2 - 90);

  ctx.shadowBlur = 0;
  ctx.fillStyle  = '#ffffff';
  ctx.font       = `${Math.min(w * 0.04, 20)}px 'Courier New'`;
  ctx.fillText('Score: ' + score, w / 2, h / 2 - 44);

  ctx.fillStyle = 'rgba(255,220,80,0.9)';
  ctx.font      = `${Math.min(w * 0.033, 16)}px 'Courier New'`;
  ctx.fillText('Melhor: ' + highScore, w / 2, h / 2 - 14);

  _drawButton(w / 2, h / 2 + 30, 240, 52, 'JOGAR DE NOVO');

  ctx.textAlign = 'left';
}

function _drawButton(cx, cy, bw, bh, label) {
  const x = cx - bw / 2;
  const y = cy - bh / 2;
  ctx.shadowColor = '#00ffc8';
  ctx.shadowBlur  = 20;
  ctx.strokeStyle = '#00ffc8';
  ctx.lineWidth   = 2;
  ctx.fillStyle   = 'rgba(0,255,200,0.12)';
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, 10);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle  = '#00ffc8';
  ctx.font       = `bold 17px 'Courier New'`;
  ctx.fillText(label, cx, cy + 6);
}

/* ================================================================
   LOOP PRINCIPAL
   ================================================================ */
let lastTime = null;
let accumulator = 0;
function gameLoop(now) {
  const elapsed = lastTime === null ? 0 : Math.min(now - lastTime, 100);
  lastTime = now;
  if (STATE === 'playing') {
    accumulator += elapsed;
    while (accumulator >= 1000 / 60 && STATE === 'playing') {
      update(); accumulator -= 1000 / 60;
    }
  } else accumulator = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  /* posição X do player */
  player.x = Math.min(160, canvas.width * 0.18);

  drawBackground();
  drawTrail();
  drawPlayer();
  drawBeats();
  drawParticles();
  drawComboTexts();

  if (STATE === 'start')        drawStart();
  else if (STATE === 'playing') update();
  else                          drawDead();

  requestAnimationFrame(gameLoop);
}

/* ── polyfill roundRect para Safari antigo ── */
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') r = [r, r, r, r];
    this.beginPath();
    this.moveTo(x + r[0], y);
    this.arcTo(x + w, y,     x + w, y + h, r[1]);
    this.arcTo(x + w, y + h, x,     y + h, r[2]);
    this.arcTo(x,     y + h, x,     y,     r[3]);
    this.arcTo(x,     y,     x + w, y,     r[0]);
    this.closePath();
  };
}

/* inicia */
requestAnimationFrame(gameLoop);
