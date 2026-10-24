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

/* ── RESIZE ── */
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

/* ── ÁUDIO SINTÉTICO ── */
let audioCtx = null;
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, duration, vol = 0.2) {
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
  music.play().catch(()=>{});
}

/* ── ESTADO ── */
let STATE       = 'start'; // 'start' | 'playing' | 'dead'
let score       = 0;
let combo       = 0;
let level       = 1;
let frame       = 0;
let highScore   = 0;
let spawnTimer  = 0;

/* ── PLAYER ── */
const player = {
  x: 0, y: 0,
  vy: 0,
  w: 52, h: 52,
  jumpCount: 0,
  maxJumps: 2,
  onGround: false,
  squish: 1,
  squishV: 0,
  runFrame: 0,
};

const GRAVITY    = 0.65;
const JUMP_FORCE = -15;

function getGround() { return canvas.height - 90; }
function getBeatY()  { return getGround(); }

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
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); doJump(); }
});
canvas.addEventListener('pointerdown', () => doJump());

/* ── SPAWN ── */
const BEAT_TYPES = ['note','note','diamond','circle','vinyl'];

function spawnBeat() {
  const type = BEAT_TYPES[Math.floor(Math.random() * BEAT_TYPES.length)];
  const size = 34 + Math.random() * 14;
  beats.push({
    x: canvas.width + 40,
    y: getBeatY(),
    size,
    type,
    rot: 0,
    speed: 5 + level * 0.6,
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
  player.runFrame++;

  /* nível */
  level = 1 + Math.floor(score / 250);
  levelEl.textContent = level;
  const spawnInterval = Math.max(38, 95 - level * 9);

  /* spawn */
  spawnTimer++;
  if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnBeat(); }

  /* física */
  player.vy += GRAVITY;
  player.y  += player.vy;
  const ground = getGround();
  if (player.y >= ground) {
    player.y = ground;
    player.vy = 0;
    player.onGround = true;
    player.jumpCount = 0;
    player.squish = 0.72;
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
    b.x  -= b.speed + level * 0.35;
    b.rot += 0.06;

    /* colisão (hitbox reduzida) */
    const margin = 10;
    const px = player.x - player.w / 2 + margin;
    const py = player.y - (player.h * player.squish) / 2 + margin;
    const pw = player.w - margin * 2;
    const ph = player.h * player.squish - margin * 2;
    if (px < b.x + b.size && px + pw > b.x && py < b.y + b.size && py + ph > b.y) {
      STATE = 'dead';
      if (score > highScore) highScore = score;
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
  const gridOff = (frame * 2) % 60;
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
  const starSpeed = 0.5 + level * 0.3;
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
   Inspirado na arte: cabelo loiro, jaqueta escura, tênis azul
   ================================================================ */
function drawPlayer() {
  const px  = player.x;
  const py  = player.y;
  const sq  = player.squish;
  const leg = player.runFrame;

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(1 / sq, sq);

  const W  = player.w;   // 52
  const H  = player.h;   // 52
  const hH = H / 2;      // centro vertical

  /* ── SOMBRA NO CHÃO ── */
  if (player.onGround) {
    ctx.fillStyle = 'rgba(0,255,200,0.15)';
    ctx.beginPath();
    ctx.ellipse(0, hH + 4, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ── PERNAS (animação corrida) ── */
  const legSwing = player.onGround ? Math.sin(leg * 0.25) * 12 : 0;
  // Perna esquerda
  ctx.save();
  ctx.translate(-10, hH - 4);
  ctx.rotate((legSwing * Math.PI) / 180);
  // calça
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(-6, 0, 11, 18);
  // tênis azul
  ctx.fillStyle = '#2288ff';
  ctx.beginPath();
  ctx.roundRect(-8, 16, 14, 7, [3, 3, 3, 3]);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-7, 21, 12, 2);
  ctx.restore();

  // Perna direita
  ctx.save();
  ctx.translate(10, hH - 4);
  ctx.rotate((-legSwing * Math.PI) / 180);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(-5, 0, 11, 18);
  ctx.fillStyle = '#2288ff';
  ctx.beginPath();
  ctx.roundRect(-6, 16, 14, 7, [3, 3, 3, 3]);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-5, 21, 12, 2);
  ctx.restore();

  /* ── CORPO – jaqueta escura com detalhes azuis ── */
  ctx.fillStyle = '#1c1c3a';
  ctx.beginPath();
  ctx.roundRect(-W / 2 + 2, -hH + 16, W - 4, H * 0.52, [5, 5, 5, 5]);
  ctx.fill();
  // listras laterais azuis da jaqueta
  ctx.fillStyle = '#2288ff';
  ctx.fillRect(-W / 2 + 3, -hH + 18, 5, H * 0.48);
  ctx.fillRect( W / 2 - 8, -hH + 18, 5, H * 0.48);

  /* camiseta interior branca */
  ctx.fillStyle = '#e8e8f0';
  ctx.fillRect(-8, -hH + 22, 16, H * 0.3);

  /* ── BRAÇOS (swing na corrida) ── */
  const armSwing = player.onGround ? Math.cos(leg * 0.25) * 18 : 5;
  // Braço esquerdo
  ctx.save();
  ctx.translate(-W / 2 + 5, -hH + 20);
  ctx.rotate((armSwing * Math.PI) / 180);
  ctx.fillStyle = '#1c1c3a';
  ctx.fillRect(-4, 0, 10, 22);
  ctx.fillStyle = '#f5c8a0'; // mão
  ctx.beginPath();
  ctx.arc(1, 24, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Braço direito
  ctx.save();
  ctx.translate(W / 2 - 5, -hH + 20);
  ctx.rotate((-armSwing * Math.PI) / 180);
  ctx.fillStyle = '#1c1c3a';
  ctx.fillRect(-6, 0, 10, 22);
  ctx.fillStyle = '#f5c8a0';
  ctx.beginPath();
  ctx.arc(-1, 24, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  /* ── CABEÇA ── */
  const headY = -hH + 2;
  // pescoço
  ctx.fillStyle = '#f5c8a0';
  ctx.fillRect(-5, headY + 20, 10, 8);
  // rosto
  ctx.fillStyle = '#f5c8a0';
  ctx.beginPath();
  ctx.ellipse(0, headY + 12, 14, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  /* bochechas (blush) */
  ctx.fillStyle = 'rgba(255,150,130,0.45)';
  ctx.beginPath(); ctx.ellipse(-9, headY + 15, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 9, headY + 15, 5, 3, 0, 0, Math.PI * 2); ctx.fill();

  /* olhos */
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(-5, headY + 10, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 5, headY + 10, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a0a00';
  ctx.beginPath(); ctx.arc(-5, headY + 11, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 5, headY + 11, 2.5, 0, Math.PI * 2); ctx.fill();
  // brilho olho
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(-4, headY + 10, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 6, headY + 10, 1, 0, Math.PI * 2); ctx.fill();

  /* boca aberta / sorriso */
  ctx.fillStyle = '#cc3344';
  ctx.beginPath();
  ctx.arc(0, headY + 17, 5, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-4, headY + 16, 8, 3);

  /* ── CABELO LOIRO ── */
  ctx.fillStyle = '#f5c832';
  // topo
  ctx.beginPath();
  ctx.ellipse(0, headY + 2, 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // mechas
  ctx.beginPath();
  ctx.moveTo(-14, headY + 4);
  ctx.bezierCurveTo(-20, headY - 6, -16, headY - 14, -8, headY - 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, headY + 4);
  ctx.bezierCurveTo(18, headY - 4, 15, headY - 12, 7, headY - 3);
  ctx.fill();
  // franja
  ctx.beginPath();
  ctx.moveTo(-12, headY + 7);
  ctx.bezierCurveTo(-10, headY - 2, 0, headY - 3, 12, headY + 7);
  ctx.fill();
}

/* ================================================================
   DRAW – TRAIL
   ================================================================ */
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

  /* título */
  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.min(w * 0.08, 52)}px 'Courier New'`;
  ctx.shadowColor = '#00ffc8';
  ctx.shadowBlur  = 30;
  ctx.fillStyle   = '#00ffc8';
  ctx.fillText('BEAT RUNNER', w / 2, h / 2 - 90);

  ctx.shadowBlur = 0;
  ctx.font = `${Math.min(w * 0.035, 18)}px 'Courier New'`;
  ctx.fillStyle = 'rgba(200,255,240,0.8)';
  ctx.fillText('Para quem faz o beat acontecer 🎧', w / 2, h / 2 - 48);

  ctx.fillStyle = 'rgba(0,255,200,0.6)';
  ctx.font = `${Math.min(w * 0.03, 15)}px 'Courier New'`;
  ctx.fillText('ESPAÇO / TOQUE = pular  •  Duplo pulo disponível', w / 2, h / 2 - 14);

  /* botão */
  _drawButton(w / 2, h / 2 + 30, 220, 52, 'COMEÇAR');

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
function gameLoop() {
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
gameLoop();