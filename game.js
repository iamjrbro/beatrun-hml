/* ═══════════════════════════════════════════════════════════════════
   BEATRUN — Complete Game Engine v2.0
   
   Systems:
   ├── AudioEngine      — Web Audio API, beat detection, freq analysis
   ├── BeatSync         — Real-time BPM tracking, move timing
   ├── World            — Procedural city generation, obstacle pulsing
   ├── Player           — Physics, movement, wallrun, slide, bhop
   ├── CameraSystem     — Dynamic FOV, cinematic rolls, motion blur
   ├── ComboSystem      — Beat-sync combos, expression scoring
   ├── OverdriveSystem  — Flow state, music layers
   ├── TrailRenderer    — Per-line neon trails
   ├── ParticleSystem   — Beat-reactive particles
   ├── FreqVisualizer   — Real-time frequency bar
   ├── GhostSystem      — Record/playback of runs
   ├── ClipRecorder     — Last-N-seconds ring buffer
   ├── HUD              — Reactive UI updates
   └── SaveSystem       — localStorage persistence
═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ─── CONSTANTS ─────────────────────────────────────────────────── */
const TAU = Math.PI * 2;
const GRAVITY = 22;
const JUMP_FORCE = 9.5;
const WALLRUN_JUMP = 8.5;
const MOVE_SPEED = 12;
const SPRINT_SPEED = 18;
const SLIDE_SPEED = 22;
const BHOP_BOOST = 1.18;
const MAX_BHOP_CHAIN = 8;
const BEAT_WINDOW_MS = 120;   // ±ms around a beat to count as synced
const COMBO_TIMEOUT = 2000;   // ms without a move to break combo
const OVERDRIVE_THRESHOLD = 10; // combos to enter overdrive
const CLIP_BUFFER_SECONDS = 25;
const TRAIL_ALPHA_DECAY = 0.03;

/* ─── UTILS ────────────────────────────────────────────────────── */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const easeOut = t => 1 - Math.pow(1 - t, 3);

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sc = s % 60;
  const msec = Math.floor((ms % 1000) / 10);
  return `${m}:${String(sc).padStart(2,'0')}.${String(msec).padStart(2,'0')}`;
}

/* ─── SAVE SYSTEM ───────────────────────────────────────────────── */
const SaveSystem = {
  KEY: 'beatrun_v2',
  defaults() {
    return {
      runs: 0,
      pb: null,
      stylePoints: 0,
      ghosts: [],
      cosmetics: { owned: ['default'], selected: 'default' },
      leaderboard: [],
    };
  },
  load() {
    try {
      return { ...this.defaults(), ...JSON.parse(localStorage.getItem(this.KEY) || '{}') };
    } catch { return this.defaults(); }
  },
  save(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch {}
  },
};

/* ─── AUDIO ENGINE ──────────────────────────────────────────────── */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.source = null;
    this.buffer = null;
    this.analyser = null;
    this.bassAnalyser = null;
    this.midAnalyser = null;
    this.highAnalyser = null;
    this.gainNode = null;
    this.started = false;
    this.startTime = 0;
    this.currentTime = 0;

    // Beat detection state
    this.bpm = 120;
    this.beatInterval = 0;
    this.lastBeatTime = 0;
    this.nextBeatTime = 0;
    this.beatPhase = 0;          // 0..1 within current beat
    this.energyHistory = new Float32Array(43);
    this.energyIdx = 0;
    this.onBeat = false;
    this.beatCallbacks = [];

    // Freq data arrays
    this.freqData = null;
    this.bassData = null;
    this.midData = null;
    this.highData = null;

    // Adaptive music layers (gain nodes per layer)
    this.layers = {};   // name → GainNode
    this.layerTargets = {}; // name → 0..1
  }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0.9;
    this.gainNode.connect(this.ctx.destination);
    return this;
  }

  async loadFile(file) {
    const ab = await file.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(ab);
    this._setupAnalysers();
    this._detectBPM();
  }

  async loadURL(url) {
    const res = await fetch(url);
    const ab = await res.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(ab);
    this._setupAnalysers();
    this._detectBPM();
  }

  _setupAnalysers() {
    // Full-spectrum analyser
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    // Band-split analysers for gameplay
    const makeFilter = (type, freq) => {
      const f = this.ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq;
      return f;
    };

    this.bassFilter = makeFilter('lowpass', 250);
    this.midFilter  = makeFilter('bandpass', 2000);
    this.highFilter = makeFilter('highpass', 6000);

    this.bassAnalyser = this.ctx.createAnalyser(); this.bassAnalyser.fftSize = 256;
    this.midAnalyser  = this.ctx.createAnalyser(); this.midAnalyser.fftSize  = 256;
    this.highAnalyser = this.ctx.createAnalyser(); this.highAnalyser.fftSize = 256;

    this.bassData = new Uint8Array(this.bassAnalyser.frequencyBinCount);
    this.midData  = new Uint8Array(this.midAnalyser.frequencyBinCount);
    this.highData = new Uint8Array(this.highAnalyser.frequencyBinCount);
  }

  _detectBPM() {
    // Onset-energy BPM detection on the decoded PCM
    const sr = this.buffer.sampleRate;
    const raw = this.buffer.getChannelData(0);
    const winSize = Math.floor(sr * 0.025); // 25ms windows
    const hopSize = Math.floor(winSize / 2);
    const energies = [];

    for (let i = 0; i + winSize < raw.length; i += hopSize) {
      let e = 0;
      for (let j = i; j < i + winSize; j++) e += raw[j] * raw[j];
      energies.push(e / winSize);
    }

    // Autocorrelation on energy envelope
    const minBPM = 80, maxBPM = 200;
    const hopsPerSec = sr / hopSize;
    const minLag = Math.floor(hopsPerSec * 60 / maxBPM);
    const maxLag = Math.floor(hopsPerSec * 60 / minBPM);
    let bestCorr = -Infinity, bestLag = minLag;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      const n = Math.min(energies.length - lag, 4000);
      for (let i = 0; i < n; i++) corr += energies[i] * energies[i + lag];
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }

    this.bpm = Math.round(60 * hopsPerSec / bestLag);
    this.bpm = clamp(this.bpm, 80, 200);
    this.beatInterval = 60000 / this.bpm;
    console.log(`[AudioEngine] Detected BPM: ${this.bpm}`);
  }

  play() {
    if (this.started) this._stop();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;

    // Wire: src → bass/mid/high filters → analysers → gain → out
    // Also: src → main analyser
    src.connect(this.analyser);
    src.connect(this.bassFilter); this.bassFilter.connect(this.bassAnalyser);
    src.connect(this.midFilter);  this.midFilter.connect(this.midAnalyser);
    src.connect(this.highFilter); this.highFilter.connect(this.highAnalyser);
    src.connect(this.gainNode);

    src.start(0);
    this.source = src;
    this.started = true;
    this.startTime = this.ctx.currentTime;
    this.lastBeatTime = performance.now();
    this.nextBeatTime = performance.now() + this.beatInterval;

    // Update bpm label
    document.getElementById('bpm-val').textContent = this.bpm;
  }

  _stop() {
    try { this.source?.stop(); } catch {}
    this.started = false;
  }

  stop() { this._stop(); }

  tick(now) {
    if (!this.started) return;
    this.currentTime = (this.ctx.currentTime - this.startTime) * 1000;

    // Update freq data
    this.analyser?.getByteFrequencyData(this.freqData);
    this.bassAnalyser?.getByteFrequencyData(this.bassData);
    this.midAnalyser?.getByteFrequencyData(this.midData);
    this.highAnalyser?.getByteFrequencyData(this.highData);

    // Beat clock
    this.beatPhase = ((now - this.lastBeatTime) / this.beatInterval) % 1;

    if (now >= this.nextBeatTime) {
      this.lastBeatTime = this.nextBeatTime;
      this.nextBeatTime += this.beatInterval;
      this.onBeat = true;
      this.beatCallbacks.forEach(cb => cb(this.bpm));
    } else {
      this.onBeat = false;
    }
  }

  /** Returns 0..1 energy in a frequency range */
  getBandEnergy(band) {
    const data = band === 'bass' ? this.bassData : band === 'mid' ? this.midData : this.highData;
    if (!data) return 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return sum / (data.length * 255);
  }

  /** Is the current moment within ±BEAT_WINDOW_MS of a beat? */
  isNearBeat() {
    const now = performance.now();
    const distToLast = now - this.lastBeatTime;
    const distToNext = this.nextBeatTime - now;
    return Math.min(distToLast, distToNext) <= BEAT_WINDOW_MS;
  }

  /** 0..1 how close to perfect beat timing */
  beatAccuracy() {
    const now = performance.now();
    const dist = Math.min(now - this.lastBeatTime, this.nextBeatTime - now);
    return clamp(1 - dist / BEAT_WINDOW_MS, 0, 1);
  }

  onBeatEvent(cb) { this.beatCallbacks.push(cb); }
  offBeatEvent(cb) { this.beatCallbacks = this.beatCallbacks.filter(f => f !== cb); }

  /** Adaptive music: fade gain node for a layer */
  setLayerGain(name, target, fadeSecs = 1.5) {
    if (!this.layers[name]) return;
    this.layers[name].gain.cancelScheduledValues(this.ctx.currentTime);
    this.layers[name].gain.linearRampToValueAtTime(target, this.ctx.currentTime + fadeSecs);
  }

  resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }
}

/* ─── WORLD GENERATOR ───────────────────────────────────────────── */
class World {
  constructor() {
    this.buildings = [];
    this.platforms = [];
    this.walls = [];
    this.drones = [];
    this.rainDrops = [];
    this.seed = Math.random();
    this.scrollX = 0;
    this.scrollSpeed = 0;
    this.length = 3000;         // world units
    this.generated = false;
    this.obstaclePhase = 0;    // beats elapsed
  }

  generate(line, bpm) {
    this.buildings = [];
    this.platforms = [];
    this.walls = [];
    this.drones = [];

    const beatDist = (60 / bpm) * MOVE_SPEED * 60; // px per beat at normal speed

    // Building skyline
    let x = -200;
    while (x < this.length + 200) {
      const w = rand(80, 220);
      const h = rand(120, 500);
      const floorCount = Math.floor(h / 18);
      const color = this._buildingColor();
      this.buildings.push({ x, y: 0, w, h, floorCount, color,
        neonColor: this._neonColor(),
        windowRows: Math.floor(h / 20),
        windowCols: Math.floor(w / 14),
      });
      x += w + rand(8, 40);
    }

    // Platforms — spaced to BPM
    let px = 400;
    let py = 180; // ground level in screen coords
    let beatCount = 0;

    while (px < this.length) {
      const beatsToNext = randInt(1, 3);
      const gap = beatDist * beatsToNext * rand(0.6, 1.1);
      const nextPY = clamp(py + rand(-80, 80), 100, 340);
      const w = rand(120, 280);
      const isWall = Math.random() < 0.25 && py !== nextPY;

      this.platforms.push({
        x: px, y: py, w, h: 20,
        beat: beatCount,
        type: 'platform',
        color: this._neonColor(),
        pulsePhase: Math.random() * TAU,
        pulseAmp: rand(0.3, 1.0),
      });

      if (isWall) {
        this.walls.push({
          x: px + gap * 0.5,
          y: nextPY - 120,
          w: 16, h: 140,
          beat: beatCount + beatsToNext * 0.5,
          side: Math.random() < 0.5 ? 'left' : 'right',
        });
      }

      px += gap;
      py = nextPY;
      beatCount += beatsToNext;
    }

    // Drone paths
    for (let i = 0; i < 8; i++) {
      this.drones.push({
        x: rand(200, this.length - 200),
        y: rand(40, 120),
        vx: rand(-0.8, 0.8),
        vy: rand(-0.3, 0.3),
        size: rand(6, 14),
        color: this._neonColor(),
        lightPhase: Math.random() * TAU,
      });
    }

    // Rain
    for (let i = 0; i < 200; i++) {
      this.rainDrops.push({
        x: rand(0, this.length),
        y: rand(0, 600),
        len: rand(8, 22),
        speed: rand(8, 18),
        alpha: rand(0.1, 0.4),
      });
    }

    this.generated = true;
  }

  _buildingColor() {
    const palette = ['#0d0b1f','#0e0c22','#0a0820','#100d24'];
    return palette[Math.floor(Math.random() * palette.length)];
  }

  _neonColor() {
    const palette = ['#00f5ff','#ff2d78','#a855f7','#ffde00','#00ff9f','#ff6b35'];
    return palette[Math.floor(Math.random() * palette.length)];
  }

  update(dt, playerX, bassEnergy, beatPhase, bpm) {
    this.scrollX = playerX;

    // Rain physics
    this.rainDrops.forEach(r => {
      r.y += r.speed * dt * 60 * (1 + bassEnergy * 2);
      if (r.y > 600) r.y = 0;
    });

    // Drone movement
    this.drones.forEach(d => {
      d.x += d.vx * dt * 60;
      d.y += d.vy * dt * 60;
      if (d.x < 0 || d.x > this.length) d.vx *= -1;
      if (d.y < 20 || d.y > 140) d.vy *= -1;
      d.lightPhase += dt * 2;
    });

    // Update obstacle pulse phase
    this.obstaclePhase = beatPhase;
  }

  draw(ctx, W, H, bassEnergy, beatPhase, overdriveActive, line) {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (overdriveActive) {
      skyGrad.addColorStop(0, '#1a0020');
      skyGrad.addColorStop(1, '#0a000f');
    } else {
      skyGrad.addColorStop(0, '#06040d');
      skyGrad.addColorStop(1, '#0b0818');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    const ox = W * 0.35 - this.scrollX; // camera offset

    // Rain
    ctx.save();
    this.rainDrops.forEach(r => {
      const rx = r.x + ox;
      if (rx < -10 || rx > W + 10) return;
      const intensity = 0.5 + bassEnergy * 0.5;
      ctx.globalAlpha = r.alpha * intensity;
      ctx.strokeStyle = overdriveActive ? '#ff2d7844' : '#a0c0ff33';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx, r.y);
      ctx.lineTo(rx + 2, r.y + r.len);
      ctx.stroke();
    });
    ctx.restore();

    // Buildings
    this.buildings.forEach(b => {
      const bx = b.x + ox;
      if (bx + b.w < -50 || bx > W + 50) return;
      this._drawBuilding(ctx, b, bx, H, bassEnergy, overdriveActive);
    });

    // Drones
    this.drones.forEach(d => {
      const dx = d.x + ox;
      if (dx < -20 || dx > W + 20) return;
      this._drawDrone(ctx, d, dx);
    });

    // Platforms (beat-pulsing)
    const groundY = H - 80;
    this.platforms.forEach(p => {
      const px = p.x + ox;
      if (px + p.w < -20 || px > W + 20) return;
      const pulse = Math.sin(beatPhase * TAU + p.pulsePhase) * p.pulseAmp;
      const glow = bassEnergy + pulse * 0.3;
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6 + glow * 20;
      ctx.fillStyle = '#0d0b1f';
      ctx.fillRect(px, groundY - p.y - p.h, p.w, p.h);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.8 + pulse * 0.2;
      ctx.fillRect(px, groundY - p.y - p.h, p.w, 3);
      ctx.restore();
    });

    // Walls
    this.walls.forEach(w => {
      const wx = w.x + ox;
      if (wx + w.w < -10 || wx > W + 10) return;
      const col = w.side === 'left' ? '#00f5ff' : '#ff2d78';
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 8 + bassEnergy * 15;
      ctx.fillStyle = '#0d0b1f';
      ctx.fillRect(wx, H - 80 - w.y - w.h, w.w, w.h);
      // neon edge
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.9;
      const edgeX = w.side === 'left' ? wx + w.w - 2 : wx;
      ctx.fillRect(edgeX, H - 80 - w.y - w.h, 2, w.h);
      ctx.restore();
    });

    // Ground line
    ctx.save();
    ctx.strokeStyle = overdriveActive ? '#ff2d78' : '#a855f7';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = overdriveActive ? '#ff2d78' : '#a855f7';
    ctx.shadowBlur = 8 + bassEnergy * 20;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, H - 80);
    ctx.lineTo(W, H - 80);
    ctx.stroke();
    ctx.restore();
  }

  _drawBuilding(ctx, b, bx, H, bass, overdrive) {
    const by = H - 80 - b.h;
    ctx.fillStyle = b.color;
    ctx.fillRect(bx, by, b.w, b.h);

    // Windows
    const ww = 6, wh = 5;
    const cols = b.windowCols, rows = b.windowRows;
    const padX = (b.w - cols * 10) / 2;
    const padY = 10;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = bx + padX + c * ((b.w - padX * 2) / (cols || 1));
        const wy = by + padY + r * (b.h / (rows + 1));
        const lit = Math.random() < 0.6;
        if (!lit) continue;
        ctx.fillStyle = Math.random() < 0.15 ? b.neonColor : '#ffe8a033';
        ctx.globalAlpha = 0.4 + bass * 0.3;
        ctx.fillRect(wx, wy, ww, wh);
        ctx.globalAlpha = 1;
      }
    }

    // Neon sign on some buildings
    if (Math.random() < 0.3 || overdrive) {
      ctx.save();
      ctx.strokeStyle = b.neonColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = b.neonColor;
      ctx.shadowBlur = 10 + bass * 20;
      ctx.globalAlpha = 0.7 + bass * 0.3;
      ctx.strokeRect(bx + 4, by + 8, b.w - 8, 20);
      ctx.restore();
    }
  }

  _drawDrone(ctx, d, dx) {
    const pulse = Math.sin(d.lightPhase) * 0.5 + 0.5;
    ctx.save();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.ellipse(dx, d.y, d.size, d.size * 0.4, 0, 0, TAU);
    ctx.fill();
    // Light
    ctx.fillStyle = d.color;
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.beginPath();
    ctx.arc(dx, d.y, 3, 0, TAU);
    ctx.fill();
    // Beam
    const grad = ctx.createLinearGradient(dx, d.y, dx, d.y + 60);
    grad.addColorStop(0, d.color + '44');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.2 + pulse * 0.15;
    ctx.fillRect(dx - 8, d.y, 16, 60);
    ctx.restore();
  }

  getPlatformAt(px, py) {
    const groundY = 0; // in game coords (0 = ground)
    return this.platforms.find(p =>
      px >= p.x && px <= p.x + p.w &&
      py >= p.y - 2 && py <= p.y + p.h + 4
    ) || null;
  }

  getWallAt(px, py) {
    return this.walls.find(w =>
      px >= w.x - 8 && px <= w.x + w.w + 8 &&
      py >= w.y && py <= w.y + w.h
    ) || null;
  }
}

/* ─── PLAYER ────────────────────────────────────────────────────── */
class Player {
  constructor() {
    this.x = 100;
    this.y = 0;          // 0 = ground level
    this.vx = 0;
    this.vy = 0;

    this.onGround = false;
    this.onWall = null;    // null | 'left' | 'right'
    this.sliding = false;
    this.wallrunTimer = 0;
    this.bhopChain = 0;
    this.bhopTimer = 0;

    this.height = 40;
    this.width = 20;

    this.jumpBuffer = 0;
    this.coyoteTime = 0;

    this.inputLeft = false;
    this.inputRight = false;
    this.inputJump = false;
    this.inputSlide = false;
    this.inputSprint = false;

    this._jumpPressed = false;
    this._slidePressed = false;

    // For trail recording
    this.trailPoints = [];
    this.maxTrail = 80;
  }

  update(dt, world) {
    const groundY = 0;

    // Timers
    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
    if (this.coyoteTime > 0) this.coyoteTime -= dt;
    if (this.bhopTimer > 0) this.bhopTimer -= dt;
    else if (this.bhopTimer <= 0 && this.bhopChain > 0) this.bhopChain = 0;

    // Horizontal movement
    const targetSpeed = this.sliding ? SLIDE_SPEED
      : this.inputSprint ? SPRINT_SPEED : MOVE_SPEED;
    const bhopMult = 1 + (this.bhopChain / MAX_BHOP_CHAIN) * (BHOP_BOOST - 1);
    const speed = targetSpeed * bhopMult;

    if (!this.sliding) {
      if (this.inputLeft)  this.vx = lerp(this.vx, -speed, 0.25);
      if (this.inputRight) this.vx = lerp(this.vx,  speed, 0.25);
      if (!this.inputLeft && !this.inputRight) {
        this.vx = lerp(this.vx, this.onGround ? 0 : this.vx, 0.18);
      }
    } else {
      // Slide: preserve momentum
      this.vx = lerp(this.vx, this.vx > 0 ? speed : -speed, 0.04);
    }

    // Gravity
    if (!this.onWall) {
      this.vy -= GRAVITY * dt;
    } else {
      // Wall sticking — slow fall
      this.vy = Math.max(this.vy - GRAVITY * 0.2 * dt, -4);
      this.wallrunTimer += dt;
    }

    // Jump input
    if (this.inputJump && !this._jumpPressed) {
      this._jumpPressed = true;
      this.jumpBuffer = 0.12;
    }
    if (!this.inputJump) this._jumpPressed = false;

    // Execute jump
    if (this.jumpBuffer > 0 && (this.onGround || this.coyoteTime > 0 || this.onWall)) {
      if (this.onWall) {
        const dir = this.onWall === 'left' ? 1 : -1;
        this.vx = dir * MOVE_SPEED * 1.2;
        this.vy = WALLRUN_JUMP;
        this.onWall = null;
      } else {
        this.vy = JUMP_FORCE * bhopMult;
        if (this.bhopTimer > 0) {
          this.bhopChain = Math.min(this.bhopChain + 1, MAX_BHOP_CHAIN);
        }
        this.bhopTimer = 0.3;
      }
      this.onGround = false;
      this.coyoteTime = 0;
      this.jumpBuffer = 0;
      return 'jump';
    }

    // Slide input
    if (this.inputSlide && !this._slidePressed && this.onGround) {
      this._slidePressed = true;
      this.sliding = true;
      return 'slide';
    }
    if (!this.inputSlide) {
      this._slidePressed = false;
      if (this.sliding) this.sliding = false;
    }

    // Physics integration
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Ground collision
    const wasOnGround = this.onGround;
    this.onGround = false;

    if (this.y <= groundY) {
      if (this.vy < -2 && wasOnGround === false) {
        // Landing
        const hardLand = this.vy < -8;
        this.y = groundY;
        this.vy = 0;
        this.onGround = true;
        this.coyoteTime = 0.1;
        this.wallrunTimer = 0;
        return hardLand ? 'land_hard' : 'land';
      }
      this.y = groundY;
      this.vy = 0;
      this.onGround = true;
      this.coyoteTime = 0.1;
    }

    // Platform collision (simplified for this world)
    const platform = world.getPlatformAt(this.x, this.y);
    if (platform && this.vy <= 0) {
      this.y = platform.y + platform.h;
      this.vy = 0;
      this.onGround = true;
      this.coyoteTime = 0.1;
    }

    // Wall detection
    const wall = world.getWallAt(this.x, this.y);
    if (wall && !this.onGround && this.vy < 0) {
      this.onWall = wall.side;
      return 'wallrun';
    } else {
      this.onWall = null;
    }

    if (!this.onGround && wasOnGround && this.coyoteTime <= 0) {
      this.coyoteTime = 0.08;
    }

    // Trail
    this.trailPoints.push({ x: this.x, y: this.y, t: performance.now() });
    if (this.trailPoints.length > this.maxTrail) this.trailPoints.shift();

    return null;
  }

  draw(ctx, W, H, beatPhase, bassEnergy, overdriveActive, line) {
    const groundY = H - 80;
    const sx = W * 0.35; // screen x = fixed
    const sy = groundY - this.y - this.height;

    ctx.save();

    // Overdrive aura
    if (overdriveActive) {
      const aura = ctx.createRadialGradient(sx, sy + this.height / 2, 0, sx, sy + this.height / 2, 50);
      aura.addColorStop(0, 'rgba(255,45,120,0.3)');
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(sx, sy + this.height / 2, 50, 50, 0, 0, TAU);
      ctx.fill();
    }

    // Body
    const bodyColor = line === 'speed' ? '#00f5ff' : line === 'flow' ? '#a855f7' : '#ff2d78';
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = overdriveActive ? 30 : 12 + bassEnergy * 15;

    if (this.sliding) {
      // Crouched capsule
      ctx.fillStyle = bodyColor + 'cc';
      ctx.beginPath();
      ctx.roundRect(sx - this.width / 2, sy + this.height * 0.5, this.width, this.height * 0.5, 4);
      ctx.fill();
    } else {
      // Standing
      ctx.fillStyle = bodyColor + 'cc';
      ctx.beginPath();
      ctx.roundRect(sx - this.width / 2, sy, this.width, this.height, [8, 8, 4, 4]);
      ctx.fill();
    }

    // Beat pulse on body
    const pulse = Math.sin(beatPhase * TAU) * 0.5 + 0.5;
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4 + pulse * 0.4;
    ctx.beginPath();
    ctx.roundRect(sx - this.width / 2 - 2, sy - 2, this.width + 4, this.height + 4, 10);
    ctx.stroke();

    // Wall run indicator
    if (this.onWall) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#00f5ff';
      ctx.fillRect(
        this.onWall === 'left' ? sx - this.width / 2 - 8 : sx + this.width / 2 + 2,
        sy + 4,
        6, this.height - 8
      );
    }

    ctx.restore();
  }
}

/* ─── CAMERA SYSTEM ─────────────────────────────────────────────── */
class CameraSystem {
  constructor() {
    this.fov = 1.0;           // scale factor
    this.targetFov = 1.0;
    this.roll = 0;             // canvas tilt (radians)
    this.targetRoll = 0;
    this.shake = { x: 0, y: 0, power: 0 };
    this.offsetY = 0;
    this.targetOffsetY = 0;
  }

  onWallrun(side) {
    this.targetRoll = side === 'left' ? -0.06 : 0.06;
    this.targetFov = 1.08;
  }

  onLand(hard) {
    this.shake.power = hard ? 6 : 3;
    this.targetFov = 0.97;
    setTimeout(() => { this.targetFov = 1.0; }, 150);
  }

  onOverdrive(active) {
    this.targetFov = active ? 1.12 : 1.0;
  }

  onHighSpeed(speed) {
    this.targetFov = 1 + clamp(speed / SPRINT_SPEED - 1, 0, 0.15);
  }

  update(dt, player) {
    // Smooth FOV
    this.fov = lerp(this.fov, this.targetFov, 1 - Math.pow(0.04, dt));

    // Roll: wallrun → tilt, grounded → return
    if (player.onGround) this.targetRoll = 0;
    this.roll = lerp(this.roll, this.targetRoll, 1 - Math.pow(0.06, dt));

    // Shake decay
    if (this.shake.power > 0) {
      this.shake.power = lerp(this.shake.power, 0, 1 - Math.pow(0.001, dt));
      this.shake.x = (Math.random() - 0.5) * this.shake.power;
      this.shake.y = (Math.random() - 0.5) * this.shake.power;
    }

    // Vertical offset tracking
    this.targetOffsetY = clamp(-player.y * 1.2, -120, 0);
    this.offsetY = lerp(this.offsetY, this.targetOffsetY, 1 - Math.pow(0.05, dt));
  }

  apply(ctx, W, H) {
    ctx.translate(W / 2 + this.shake.x, H / 2 + this.shake.y + this.offsetY);
    ctx.rotate(this.roll);
    ctx.scale(this.fov, this.fov);
    ctx.translate(-W / 2, -H / 2);
  }
}

/* ─── COMBO SYSTEM ──────────────────────────────────────────────── */
class ComboSystem {
  constructor() {
    this.combo = 1;
    this.score = 0;
    this.bestCombo = 1;
    this.comboTimer = 0;
    this.lastMoveTime = 0;
    this.beatSyncCount = 0;
    this.totalMoves = 0;
    this.expressionScore = 0;
    this.moveHistory = [];      // last N move types
    this.flowTime = 0;          // seconds in flow state
    this.inFlow = false;
    this.overdriveCount = 0;
  }

  registerMove(moveType, synced, accuracy, audio) {
    const now = performance.now();
    this.totalMoves++;

    if (synced) {
      this.beatSyncCount++;
      this.combo = Math.min(this.combo + 1, 99);
    } else if (now - this.lastMoveTime > COMBO_TIMEOUT) {
      this.combo = Math.max(1, this.combo - 1);
    }

    this.lastMoveTime = now;
    this.comboTimer = COMBO_TIMEOUT;

    // Expression: reward variety
    const recent = this.moveHistory.slice(-5);
    const isNew = !recent.includes(moveType);
    if (isNew) this.expressionScore += this.combo * 10;

    this.moveHistory.push(moveType);
    if (this.moveHistory.length > 20) this.moveHistory.shift();

    // Base score
    const basePoints = { jump: 10, land: 5, land_hard: 15, wallrun: 20, slide: 15, bhop: 30 }[moveType] || 10;
    const syncBonus = synced ? Math.round(accuracy * 50) : 0;
    const lineBonus = this.inFlow ? 1.5 : 1;
    const gained = Math.round((basePoints + syncBonus) * this.combo * lineBonus);
    this.score += gained;

    if (this.combo > this.bestCombo) this.bestCombo = this.combo;

    return { points: gained, synced, syncBonus, combo: this.combo };
  }

  update(dt, overdriveActive) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt * 1000;
      if (this.comboTimer <= 0 && this.combo > 1) {
        this.combo = Math.max(1, this.combo - 1);
        this.comboTimer = COMBO_TIMEOUT * 0.5;
      }
    }

    this.inFlow = overdriveActive;
    if (overdriveActive) this.flowTime += dt;
  }

  get beatSyncPct() {
    return this.totalMoves > 0 ? Math.round((this.beatSyncCount / this.totalMoves) * 100) : 0;
  }

  grade() {
    const pct = this.beatSyncPct;
    const c = this.bestCombo;
    if (pct >= 85 && c >= 20) return 'S';
    if (pct >= 70 && c >= 12) return 'A';
    if (pct >= 55 && c >= 7)  return 'B';
    if (pct >= 40 && c >= 4)  return 'C';
    return 'D';
  }
}

/* ─── OVERDRIVE SYSTEM ──────────────────────────────────────────── */
class OverdriveSystem {
  constructor() {
    this.meter = 0;         // 0..1
    this.active = false;
    this.driveTimer = 0;    // seconds remaining
    this.driveDuration = 8;
    this.activations = 0;
  }

  feed(amount) {
    this.meter = Math.min(1, this.meter + amount);
  }

  drain(dt) {
    this.meter = Math.max(0, this.meter - dt * 0.05);
  }

  tryActivate() {
    if (this.meter >= 1 && !this.active) {
      this.active = true;
      this.driveTimer = this.driveDuration;
      this.activations++;
      this.meter = 0;
      return true;
    }
    return false;
  }

  update(dt) {
    if (this.active) {
      this.driveTimer -= dt;
      if (this.driveTimer <= 0) {
        this.active = false;
        this.driveTimer = 0;
      }
    }
  }
}

/* ─── TRAIL RENDERER ────────────────────────────────────────────── */
class TrailRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.points = [];
    this.maxAge = 1500; // ms
  }

  add(sx, sy, color, overdriveActive) {
    this.points.push({
      x: sx, y: sy,
      t: performance.now(),
      color,
      width: overdriveActive ? 4 : 2,
    });
    if (this.points.length > 300) this.points.shift();
  }

  draw() {
    const now = performance.now();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Remove old points
    this.points = this.points.filter(p => now - p.t < this.maxAge);

    if (this.points.length < 2) return;

    for (let i = 1; i < this.points.length; i++) {
      const p0 = this.points[i - 1];
      const p1 = this.points[i];
      const age = (now - p0.t) / this.maxAge;
      const alpha = easeOut(1 - age) * 0.7;

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = p0.color;
      ctx.lineWidth = p0.width;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = p0.color;
      ctx.shadowBlur = 8;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

/* ─── PARTICLE SYSTEM ───────────────────────────────────────────── */
class ParticleSystem {
  constructor() { this.particles = []; }

  burst(x, y, color, count = 12, spread = 80, sizeRange = [2, 6]) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, TAU);
      const speed = rand(1, spread / 20);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: rand(sizeRange[0], sizeRange[1]),
        life: 1,
        decay: rand(0.02, 0.05),
      });
    }
  }

  beatBurst(x, y, bassEnergy, color) {
    const count = Math.floor(4 + bassEnergy * 20);
    this.burst(x, y, color, count, 60 + bassEnergy * 80);
  }

  update(dt) {
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vy -= 0.08 * dt * 60;
      p.life -= p.decay * dt * 60;
      return p.life > 0;
    });
  }

  draw(ctx, cameraOffsetY, overdriveActive) {
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = overdriveActive ? 16 : 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y + cameraOffsetY, p.size * p.life, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
  }
}

/* ─── FREQ VISUALIZER ───────────────────────────────────────────── */
class FreqVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(freqData, W, line, beatPhase, overdriveActive) {
    const ctx = this.ctx;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (!freqData) return;

    const barW = 3;
    const gap = 1;
    const count = Math.floor(W / (barW + gap));
    const step = Math.floor(freqData.length / count);
    const lineColor = line === 'speed' ? '#00f5ff' : line === 'flow' ? '#a855f7' : '#ff2d78';

    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += freqData[i * step + j];
      const val = sum / step / 255;
      const barH = val * H * (overdriveActive ? 1.4 : 1);
      const alpha = 0.4 + val * 0.6;

      const grad = ctx.createLinearGradient(0, H, 0, H - barH);
      grad.addColorStop(0, lineColor + Math.round(alpha * 255).toString(16).padStart(2, '0'));
      grad.addColorStop(1, lineColor + '22');

      ctx.fillStyle = grad;
      ctx.fillRect(i * (barW + gap), H - barH, barW, barH);
    }
  }
}

/* ─── GHOST SYSTEM ──────────────────────────────────────────────── */
class GhostSystem {
  constructor() {
    this.recording = false;
    this.frames = [];
    this.currentGhost = null;
    this.playbackIdx = 0;
    this.playbackFrames = null;
    this.playing = false;
  }

  startRecord() {
    this.recording = true;
    this.frames = [];
  }

  recordFrame(player, score, combo, t) {
    if (!this.recording) return;
    this.frames.push({ x: player.x, y: player.y, vx: player.vx, vy: player.vy,
      onGround: player.onGround, onWall: player.onWall, sliding: player.sliding,
      score, combo, t });
  }

  stopRecord(meta) {
    this.recording = false;
    return { frames: this.frames, meta, savedAt: Date.now() };
  }

  startPlayback(ghost) {
    this.playbackFrames = ghost.frames;
    this.playbackIdx = 0;
    this.playing = true;
    this.currentGhost = ghost;
  }

  tickPlayback(gameTime) {
    if (!this.playing || !this.playbackFrames) return null;
    const frame = this.playbackFrames[this.playbackIdx];
    if (!frame) { this.playing = false; return null; }
    if (frame.t <= gameTime) {
      this.playbackIdx++;
      return frame;
    }
    return null;
  }

  drawGhost(ctx, frame, W, H, camOffsetY) {
    if (!frame) return;
    const groundY = H - 80;
    const sx = W * 0.35 + (frame.x - 100); // ghost world offset
    const sy = groundY - frame.y - 40;

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#00f5ff';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(sx - 10, sy, 20, 40, 6);
    ctx.fill();
    ctx.restore();
  }
}

/* ─── CLIP RECORDER ─────────────────────────────────────────────── */
class ClipRecorder {
  constructor() {
    this.buffer = [];   // { canvas snapshot, t }
    this.maxDuration = CLIP_BUFFER_SECONDS * 1000;
    this.lastCapture = 0;
    this.captureInterval = 100; // ms between snapshots
    this.recording = false;
  }

  start() {
    this.recording = true;
    document.getElementById('clip-indicator').classList.add('recording');
  }

  stop() {
    this.recording = false;
    document.getElementById('clip-indicator').classList.remove('recording');
  }

  capture(canvas) {
    const now = performance.now();
    if (!this.recording || now - this.lastCapture < this.captureInterval) return;
    this.lastCapture = now;

    // Prune old
    const cutoff = now - this.maxDuration;
    while (this.buffer.length && this.buffer[0].t < cutoff) this.buffer.shift();

    // Store URL (non-blocking)
    try {
      this.buffer.push({ dataURL: canvas.toDataURL('image/jpeg', 0.5), t: now });
    } catch {}
  }

  exportFrames() {
    // Returns last N seconds as array of dataURLs
    return this.buffer.map(f => f.dataURL);
  }

  /** Download the last clip as a "video" by piping frames to MediaRecorder */
  async downloadClip(canvas, duration = 15000) {
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const chunks = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start();

    await new Promise(r => setTimeout(r, Math.min(duration, 15000)));
    recorder.stop();

    await new Promise(r => { recorder.onstop = r; });
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beatrun_clip_${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/* ─── HUD CONTROLLER ────────────────────────────────────────────── */
class HUD {
  constructor() {
    this.$combo     = document.getElementById('combo-val');
    this.$comboNum  = document.getElementById('hud-combo-num');
    this.$flowFill  = document.getElementById('hud-flow-fill');
    this.$timer     = document.getElementById('timer-val');
    this.$score     = document.getElementById('score-val');
    this.$feedback  = document.getElementById('hud-beat-feedback');
    this.$moveList  = document.getElementById('move-tag-list');
    this.$beatOuter = document.getElementById('beat-ring-outer');
    this.$beatInner = document.getElementById('beat-ring-inner');
    this.$overdrive = document.getElementById('overdrive-banner');
    this.$freqCanvas= document.getElementById('freq-canvas');

    this.lastCombo  = 1;
    this.tagQueue   = [];
  }

  update(combo, flowPct, elapsed, score, overdriveActive) {
    // Combo
    this.$combo.textContent = combo;
    if (combo !== this.lastCombo) {
      this.$comboNum.classList.add('pop');
      setTimeout(() => this.$comboNum.classList.remove('pop'), 150);
      this.lastCombo = combo;
    }

    // Combo color
    const color = combo >= 20 ? '#ff2d78' : combo >= 10 ? '#a855f7' : combo >= 5 ? '#ffde00' : '#fff';
    this.$comboNum.style.color = color;
    if (combo >= 5) this.$comboNum.style.textShadow = `0 0 20px ${color}`;
    else this.$comboNum.style.textShadow = '';

    // Flow bar
    this.$flowFill.style.width = `${clamp(flowPct, 0, 100)}%`;

    // Timer
    this.$timer.textContent = fmtTime(elapsed);

    // Score (formatted with commas)
    this.$score.textContent = score.toLocaleString();

    // Overdrive
    if (overdriveActive) {
      this.$overdrive.classList.add('active');
      document.body.classList.add('overdrive-active');
    } else {
      this.$overdrive.classList.remove('active');
      document.body.classList.remove('overdrive-active');
    }
  }

  beatFlash(onBeat, bassEnergy) {
    if (onBeat) {
      this.$beatOuter.classList.add('on-beat');
      this.$beatInner.classList.add('on-beat');
      setTimeout(() => {
        this.$beatOuter.classList.remove('on-beat');
        this.$beatInner.classList.remove('on-beat');
      }, 100);
    }
  }

  showFeedback(text, color) {
    this.$feedback.textContent = text;
    this.$feedback.style.color = color;
    this.$feedback.classList.add('show');
    clearTimeout(this._fbTimeout);
    this._fbTimeout = setTimeout(() => this.$feedback.classList.remove('show'), 500);
  }

  addMoveTag(label, color) {
    const el = document.createElement('div');
    el.className = 'move-tag';
    el.textContent = label;
    el.style.color = color;
    el.style.background = color + '18';
    this.$moveList.appendChild(el);

    // Auto-remove
    setTimeout(() => {
      el.classList.add('fade');
      setTimeout(() => el.remove(), 400);
    }, 900);

    // Limit tags shown
    while (this.$moveList.children.length > 4) {
      this.$moveList.firstElementChild?.remove();
    }
  }

  resizeFreqCanvas(W) {
    this.$freqCanvas.width  = W;
    this.$freqCanvas.height = 48;
  }
}

/* ─── MAIN GAME ─────────────────────────────────────────────────── */
class BeatrunGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx    = this.canvas.getContext('2d');

    this.trailCanvas = document.getElementById('trail-canvas');

    this.audio    = new AudioEngine();
    this.world    = new World();
    this.player   = new Player();
    this.camera   = new CameraSystem();
    this.combo    = new ComboSystem();
    this.overdrive= new OverdriveSystem();
    this.particles= new ParticleSystem();
    this.ghost    = new GhostSystem();
    this.clip     = new ClipRecorder();
    this.hud      = new HUD();
    this.freqViz  = null; // created after canvas resize
    this.trail    = null; // created after canvas resize

    this.state = 'menu';
    this.line  = 'style';
    this.running = false;
    this.paused  = false;

    this.elapsed  = 0;
    this.lastTime = 0;

    this.saveData = SaveSystem.load();
    this.musicFile = null;
    this.musicLoaded = false;

    this.keys = {};
    this.menuBgCanvas = document.getElementById('menu-bg-canvas');
    this.menuBgCtx    = this.menuBgCanvas.getContext('2d');
    this.menuAnimT = 0;
  }

  async boot() {
    await this.audio.init();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._bindKeys();
    this._bindUI();
    this._updateMenuStats();
    this._populateGhosts();
    this._populateLeaderboard();
    this._populateCosmetics();
    this._menuLoop(performance.now());
  }

  _resize() {
    const W = window.innerWidth, H = window.innerHeight;
    this.canvas.width  = W; this.canvas.height  = H;
    this.trailCanvas.width = W; this.trailCanvas.height = H;
    this.menuBgCanvas.width = W; this.menuBgCanvas.height = H;
    if (this.freqViz) this.hud.resizeFreqCanvas(W);

    // Re-create freq viz and trail
    this.freqViz = new FreqVisualizer(document.getElementById('freq-canvas'));
    this.trail   = new TrailRenderer(this.trailCanvas);
    this.hud.resizeFreqCanvas(W);
  }

  _bindKeys() {
    const map = {
      ArrowLeft:'left', a:'left', A:'left',
      ArrowRight:'right', d:'right', D:'right',
      ' ':'jump', ArrowUp:'jump', w:'jump', W:'jump',
      Shift:'sprint',
      ArrowDown:'slide', s:'slide', S:'slide', c:'slide', C:'slide',
    };

    window.addEventListener('keydown', e => {
      const k = map[e.key];
      if (k) { this.keys[k] = true; e.preventDefault(); }
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') this._togglePause();
      if (e.key === 'o' || e.key === 'O') this.overdrive.tryActivate();
    });

    window.addEventListener('keyup', e => {
      const k = map[e.key];
      if (k) this.keys[k] = false;
    });

    // Touch controls (simple left/right/jump regions)
    let touchStartX = 0, touchStartY = 0;
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      const W = this.canvas.width;
      if (t.clientX < W * 0.25) this.keys.left = true;
      else if (t.clientX > W * 0.75) this.keys.right = true;
      else this.keys.jump = true;
    }, { passive: false });

    this.canvas.addEventListener('touchend', e => {
      this.keys.left = false; this.keys.right = false; this.keys.jump = false;
    });
  }

  _bindUI() {
    // Screen navigation
    document.getElementById('btn-play').addEventListener('click', () => this._goLine());
    document.getElementById('btn-ghosts').addEventListener('click', () => this._showScreen('screen-ghosts'));
    document.getElementById('btn-cosmetics').addEventListener('click', () => this._showScreen('screen-cosmetics'));
    document.getElementById('btn-leaderboard').addEventListener('click', () => this._showScreen('screen-leaderboard'));

    document.getElementById('btn-line-back').addEventListener('click', () => this._showScreen('screen-menu'));
    document.getElementById('btn-line-start').addEventListener('click', () => this._startRun());

    document.getElementById('btn-ghost-back').addEventListener('click', () => this._showScreen('screen-menu'));
    document.getElementById('btn-cos-back').addEventListener('click', () => this._showScreen('screen-menu'));
    document.getElementById('btn-board-back').addEventListener('click', () => this._showScreen('screen-menu'));

    // Line cards
    document.querySelectorAll('.line-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.line-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.line = card.dataset.line;
      });
    });

    // Music upload
    const zone = document.getElementById('upload-zone');
    const inp  = document.getElementById('music-upload');

    zone.addEventListener('click', () => inp.click());
    inp.addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      this.musicFile = f;
      document.getElementById('upload-track-name').textContent = f.name;
      this.musicLoaded = false;
    });

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', async e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (!f) return;
      this.musicFile = f;
      document.getElementById('upload-track-name').textContent = f.name;
      this.musicLoaded = false;
    });

    // Pause
    document.getElementById('btn-pause').addEventListener('click', () => this._togglePause());
    document.getElementById('btn-resume').addEventListener('click', () => this._togglePause());
    document.getElementById('btn-restart').addEventListener('click', () => this._startRun());
    document.getElementById('btn-quit').addEventListener('click', () => this._endRun(true));

    // Results
    document.getElementById('btn-retry').addEventListener('click', () => this._startRun());
    document.getElementById('btn-save-ghost').addEventListener('click', () => this._saveGhost());
    document.getElementById('btn-clip').addEventListener('click', () => this._exportClip());
    document.getElementById('btn-results-menu').addEventListener('click', () => this._showScreen('screen-menu'));

    // Beat event: visual
    this.audio.onBeatEvent(() => {
      this.hud.beatFlash(true, this.audio.getBandEnergy('bass'));
      if (this.running && !this.paused) {
        const color = this.line === 'speed' ? '#00f5ff' : this.line === 'flow' ? '#a855f7' : '#ff2d78';
        const W = this.canvas.width, H = this.canvas.height;
        const sx = W * 0.35;
        const sy = H - 80 - this.player.y - this.player.height / 2;
        this.particles.beatBurst(sx, sy, this.audio.getBandEnergy('bass'), color);
      }
    });
  }

  _showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    this.state = id.replace('screen-', '');
  }

  _goLine() {
    this._showScreen('screen-line');
  }

  async _startRun() {
    // Load music if needed
    if (!this.musicLoaded) {
      try {
        if (this.musicFile) {
          await this.audio.loadFile(this.musicFile);
        } else {
          await this.audio.loadURL('music.mp3');
        }
        this.musicLoaded = true;
      } catch(e) {
        console.warn('Music load failed, using silent mode:', e);
        this.audio.bpm = 128;
        this.audio.beatInterval = 60000 / 128;
        this.musicLoaded = true;
      }
    }

    // Reset state
    this.player   = new Player();
    this.combo    = new ComboSystem();
    this.overdrive= new OverdriveSystem();
    this.particles= new ParticleSystem();
    this.ghost.startRecord();
    this.clip.start();

    this.world.generate(this.line, this.audio.bpm);
    this.audio.resume();
    this.audio.play();

    this.elapsed  = 0;
    this.lastTime = performance.now();
    this.running  = true;
    this.paused   = false;

    this._applyLineTraits();
    this.trailCanvas.classList.add('active');
    document.getElementById('pause-overlay').classList.add('hidden');

    this._showScreen('screen-game');
    this._gameLoop(performance.now());
  }

  _applyLineTraits() {
    // Each line modifies base parameters
    switch (this.line) {
      case 'speed':
        // Player already at base speed, wallrun grants bigger boost
        this.player.vx = MOVE_SPEED * 0.8; // running start
        break;
      case 'flow':
        // Overdrive fills faster
        this.overdrive.driveDuration = 12;
        break;
      case 'style':
        // No mechanical change — expression score ×2 handled in combo
        break;
    }
  }

  _togglePause() {
    if (!this.running) return;
    this.paused = !this.paused;
    if (this.paused) {
      document.getElementById('pause-overlay').classList.remove('hidden');
    } else {
      document.getElementById('pause-overlay').classList.add('hidden');
      this.lastTime = performance.now();
      this._gameLoop(performance.now());
    }
  }

  _menuLoop(now) {
    if (this.state !== 'menu') return;
    this.menuAnimT += 0.008;
    this._drawMenuBg(this.menuAnimT);
    requestAnimationFrame(t => this._menuLoop(t));
  }

  _drawMenuBg(t) {
    const ctx = this.menuBgCtx;
    const W = this.menuBgCanvas.width, H = this.menuBgCanvas.height;
    ctx.clearRect(0, 0, W, H);

    // Animated grid
    ctx.save();
    ctx.strokeStyle = 'rgba(168,85,247,0.06)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    const ox = (t * 30) % gridSize;
    for (let x = -gridSize + ox; x < W + gridSize; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H + gridSize; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    // Floating neon orbs
    const orbs = [
      { cx: W * 0.1, cy: H * 0.3, r: 120, color: '#a855f7' },
      { cx: W * 0.9, cy: H * 0.7, r: 160, color: '#ff2d78' },
      { cx: W * 0.5, cy: H * 0.9, r: 100, color: '#00f5ff' },
    ];

    orbs.forEach((o, i) => {
      const x = o.cx + Math.sin(t + i * 2.1) * 30;
      const y = o.cy + Math.cos(t * 0.7 + i) * 20;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, o.r);
      grad.addColorStop(0, o.color + '18');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, o.r, 0, TAU);
      ctx.fill();
    });
  }

  _gameLoop(now) {
    if (!this.running || this.paused) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.elapsed += dt * 1000;

    this._update(dt, now);
    this._draw(now);

    this.clip.capture(this.canvas);
    requestAnimationFrame(t => this._gameLoop(t));
  }

  _update(dt, now) {
    const W = this.canvas.width, H = this.canvas.height;

    // Audio tick
    this.audio.tick(now);
    const bassEnergy = this.audio.getBandEnergy('bass');
    const midEnergy  = this.audio.getBandEnergy('mid');

    // Player input
    this.player.inputLeft   = !!this.keys.left;
    this.player.inputRight  = !!this.keys.right;
    this.player.inputJump   = !!this.keys.jump;
    this.player.inputSlide  = !!this.keys.slide;
    this.player.inputSprint = !!this.keys.sprint;

    const moveResult = this.player.update(dt, this.world);

    // Process move events
    if (moveResult) {
      const synced  = this.audio.isNearBeat();
      const accuracy= this.audio.beatAccuracy();
      const result  = this.combo.registerMove(moveResult, synced, accuracy, this.audio);

      // Overdrive feed
      this.overdrive.feed(synced ? 0.12 : 0.03);

      // Feedback
      const color = this.line === 'speed' ? '#00f5ff' : this.line === 'flow' ? '#a855f7' : '#ff2d78';
      const moveLabels = {
        jump: '↑ JUMP', land: '▼ LAND', land_hard: '⚡ IMPACT',
        wallrun: '→ WALL', slide: '▶ SLIDE',
      };
      const label = (synced ? '♪ ' : '') + (moveLabels[moveResult] || moveResult.toUpperCase());
      this.hud.addMoveTag(label, synced ? '#ffde00' : color);

      if (synced && accuracy > 0.7) {
        const feedbacks = ['ON BEAT', 'PERFECT', 'SYNC'];
        this.hud.showFeedback(feedbacks[Math.floor(Math.random() * feedbacks.length)], '#ffde00');
      }

      // Particles on moves
      const sx = W * 0.35, sy = H - 80 - this.player.y - this.player.height / 2;
      const count = synced ? 16 : 6;
      this.particles.burst(sx, sy, color, count);
    }

    // Auto-trigger overdrive when combo >= threshold
    if (this.combo.combo >= OVERDRIVE_THRESHOLD && this.overdrive.meter >= 0.8) {
      if (this.overdrive.tryActivate()) {
        this.camera.onOverdrive(true);
        this.hud.showFeedback('◈ OVERDRIVE ◈', '#ff2d78');
        this.combo.overdriveCount++;
      }
    }

    this.overdrive.update(dt);
    this.combo.update(dt, this.overdrive.active);

    if (!this.overdrive.active) {
      this.overdrive.feed(bassEnergy * dt * 0.3);
      this.overdrive.drain(dt);
    }

    // Camera
    if (moveResult === 'wallrun') this.camera.onWallrun(this.player.onWall);
    if (moveResult === 'land' || moveResult === 'land_hard') this.camera.onLand(moveResult === 'land_hard');
    this.camera.onHighSpeed(Math.abs(this.player.vx));
    if (!this.overdrive.active) this.camera.onOverdrive(false);
    this.camera.update(dt, this.player);

    // World
    this.world.update(dt, this.player.x, bassEnergy, this.audio.beatPhase, this.audio.bpm);

    // Particles
    this.particles.update(dt);

    // Ghost record
    this.ghost.recordFrame(this.player, this.combo.score, this.combo.combo, this.elapsed);

    // HUD
    const flowPct = (this.overdrive.meter * 100);
    this.hud.update(this.combo.combo, flowPct, this.elapsed, this.combo.score, this.overdrive.active);
    this.hud.beatFlash(this.audio.onBeat, bassEnergy);
  }

  _draw(now) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const bassEnergy = this.audio.getBandEnergy('bass');

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    this.camera.apply(ctx, W, H);

    // World
    this.world.draw(ctx, W, H, bassEnergy, this.audio.beatPhase, this.overdrive.active, this.line);

    // Player
    this.player.draw(ctx, W, H, this.audio.beatPhase, bassEnergy, this.overdrive.active, this.line);

    // Particles
    this.particles.draw(ctx, this.camera.offsetY, this.overdrive.active);

    ctx.restore();

    // Trail canvas (fixed, not affected by camera)
    const trailColor = this.line === 'speed' ? '#00f5ff' : this.line === 'flow' ? '#a855f7' : '#ff2d78';
    const sx = W * 0.35;
    const sy = H - 80 - this.player.y - this.player.height / 2 + this.camera.offsetY;
    this.trail?.add(sx, sy, trailColor, this.overdrive.active);
    this.trail?.draw();

    // Motion blur overlay on overdrive
    if (this.overdrive.active) {
      ctx.fillStyle = 'rgba(6,4,13,0.18)';
      ctx.fillRect(0, 0, W, H);
    }

    // Freq visualizer
    this.freqViz?.draw(this.audio.freqData, W, this.line, this.audio.beatPhase, this.overdrive.active);

    // Vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // FOV indicator (subtle horizontal streaks at high speed)
    const speed = Math.abs(this.player.vx);
    if (speed > SPRINT_SPEED * 0.8) {
      const streakAlpha = (speed - SPRINT_SPEED * 0.8) / (SPRINT_SPEED * 0.4);
      ctx.save();
      ctx.globalAlpha = streakAlpha * 0.15;
      for (let i = 0; i < 8; i++) {
        const y = rand(0, H);
        const len = rand(80, 250);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, y, len, 1);
        ctx.fillRect(W - len, y, len, 1);
      }
      ctx.restore();
    }
  }

  _endRun(quit = false) {
    this.running = false;
    this.audio.stop();
    this.clip.stop();
    this.trailCanvas.classList.remove('active');
    document.body.classList.remove('overdrive-active');

    if (quit) {
      this._showScreen('screen-menu');
      this._menuLoop(performance.now());
      return;
    }

    this._showResults();
  }

  _showResults() {
    const grade = this.combo.grade();
    const gradeColors = { S: '#ffde00', A: '#00ff9f', B: '#00f5ff', C: '#a855f7', D: '#ff2d78' };

    document.getElementById('results-grade').textContent = grade;
    document.getElementById('results-grade').style.background = `linear-gradient(135deg, #fff, ${gradeColors[grade] || '#fff'})`;
    document.getElementById('results-title').textContent =
      grade === 'S' ? '— PERFECT RUN —' : grade === 'A' ? '— GREAT RUN —' : '— RUN COMPLETE —';
    document.getElementById('results-time').textContent = fmtTime(this.elapsed);

    document.getElementById('rs-score').textContent = this.combo.score.toLocaleString();
    document.getElementById('rs-combo').textContent = '×' + this.combo.bestCombo;
    document.getElementById('rs-flow').textContent = Math.round(this.combo.flowTime) + 's';
    document.getElementById('rs-expr').textContent = this.combo.expressionScore.toLocaleString();
    document.getElementById('rs-sync').textContent = this.combo.beatSyncPct + '%';
    document.getElementById('rs-overdrive').textContent = this.combo.overdriveCount + '×';

    // Persist
    this.saveData.runs++;
    if (!this.saveData.pb || this.elapsed < this.saveData.pb) this.saveData.pb = this.elapsed;
    this.saveData.stylePoints += this.combo.expressionScore;
    this._updateMenuStats();
    SaveSystem.save(this.saveData);

    // Add to leaderboard
    this.saveData.leaderboard.push({
      name: 'YOU', time: this.elapsed, score: this.combo.score,
      grade, line: this.line, date: Date.now(),
    });
    this.saveData.leaderboard.sort((a, b) => b.score - a.score);
    this.saveData.leaderboard = this.saveData.leaderboard.slice(0, 20);
    SaveSystem.save(this.saveData);

    this._showScreen('screen-results');
    this._menuLoop(performance.now()); // run bg behind results
  }

  _saveGhost() {
    const ghostData = this.ghost.stopRecord({
      time: this.elapsed,
      score: this.combo.score,
      grade: this.combo.grade(),
      line: this.line,
      bpm: this.audio.bpm,
      name: 'MY RUN',
      date: Date.now(),
    });

    this.saveData.ghosts.unshift(ghostData);
    this.saveData.ghosts = this.saveData.ghosts.slice(0, 10);
    SaveSystem.save(this.saveData);
    this._populateGhosts();

    const btn = document.getElementById('btn-save-ghost');
    btn.textContent = '✓ SAVED';
    btn.disabled = true;
  }

  _exportClip() {
    this.clip.downloadClip(this.canvas, 15000)
      .catch(() => alert('Clip export requires a run in progress. Try using the record button during gameplay.'));
  }

  _updateMenuStats() {
    document.getElementById('stat-runs').textContent = this.saveData.runs;
    document.getElementById('stat-pb').textContent = this.saveData.pb ? fmtTime(this.saveData.pb) : '—';
    document.getElementById('stat-style').textContent = this.saveData.stylePoints.toLocaleString();
  }

  _populateGhosts() {
    const list = document.getElementById('ghost-list');
    const ghosts = this.saveData.ghosts;

    if (!ghosts.length) {
      list.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-family:var(--font-mono);font-size:12px;text-align:center;padding:40px 0">No saved ghosts yet.<br>Complete a run and hit SAVE GHOST.</div>';
      return;
    }

    list.innerHTML = '';
    ghosts.forEach((g, i) => {
      const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      const row = document.createElement('div');
      row.className = 'ghost-row';
      row.innerHTML = `
        <div class="ghost-pos ${posClass}">${i + 1}</div>
        <div class="ghost-info">
          <div class="ghost-name">${g.meta?.name || 'RUN'} — ${g.meta?.grade || '?'}</div>
          <div class="ghost-meta">${g.meta?.line?.toUpperCase() || '?'} · ${g.meta?.bpm || '?'} BPM · ${new Date(g.meta?.date || 0).toLocaleDateString()}</div>
        </div>
        <div class="ghost-time">${fmtTime(g.meta?.time || 0)}</div>
        <button class="ghost-play-btn" data-idx="${i}">RACE</button>
      `;
      list.appendChild(row);
    });

    list.querySelectorAll('.ghost-play-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        const idx = parseInt(e.target.dataset.idx);
        // TODO: implement ghost playback in next game start
        alert('Ghost race: start a run to race against this ghost!');
      });
    });
  }

  _populateLeaderboard() {
    const list = document.getElementById('board-list');
    // Seed with NPC entries
    const npc = [
      { name: 'NEONSTREAK', score: 98420, time: 62800, grade: 'S', line: 'speed' },
      { name: 'RITMATICA',  score: 87350, time: 71200, grade: 'A', line: 'flow'  },
      { name: 'PARKOUR_GOD',score: 74100, time: 88400, grade: 'A', line: 'style' },
      { name: 'BASSRUNNER', score: 61200, time: 95100, grade: 'B', line: 'flow'  },
      { name: 'GHOSTSPEED', score: 52800, time: 110000,grade: 'B', line: 'speed' },
    ];

    const combined = [
      ...npc,
      ...this.saveData.leaderboard.map(e => ({ ...e, name: 'YOU', isYou: true })),
    ].sort((a, b) => b.score - a.score).slice(0, 15);

    list.innerHTML = '';
    combined.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'board-row' + (e.isYou ? ' you' : '');
      row.innerHTML = `
        <div class="board-rank">${i + 1}</div>
        <div class="board-name">${e.name}${e.isYou ? ' 👤' : ''} <span style="font-size:10px;color:rgba(255,255,255,0.3)">${e.line?.toUpperCase() || ''}</span></div>
        <div class="board-score">${e.score.toLocaleString()}</div>
        <div class="board-time">${fmtTime(e.time)}</div>
      `;
      list.appendChild(row);
    });
  }

  _populateCosmetics() {
    const items = [
      { id: 'default',   name: 'DEFAULT',    icon: '◎', desc: 'Classic neon trail',      color: '#ff2d78' },
      { id: 'ice',       name: 'ICE COLD',   icon: '❄', desc: 'Cryo-blue trail',          color: '#00f5ff' },
      { id: 'void',      name: 'VOID',       icon: '◈', desc: 'Dark purple ghost trail',  color: '#a855f7' },
      { id: 'gold',      name: 'GOLDEN',     icon: '✦', desc: 'Earned: 50k style pts',    color: '#ffde00', locked: this.saveData.stylePoints < 50000 },
      { id: 'fire',      name: 'INFERNO',    icon: '🔥', desc: 'Earned: 10 runs',          color: '#ff6b35', locked: this.saveData.runs < 10 },
      { id: 'matrix',    name: 'MATRIX',     icon: '⬡', desc: 'Earned: grade S',          color: '#00ff9f', locked: !this.saveData.leaderboard.some(r => r.grade === 'S') },
    ];

    const grid = document.getElementById('cosmetics-grid');
    grid.innerHTML = '';

    items.forEach(item => {
      const owned = this.saveData.cosmetics.owned.includes(item.id);
      const selected = this.saveData.cosmetics.selected === item.id;
      const card = document.createElement('div');
      card.className = 'cosmetic-card' + (owned ? ' owned' : '') + (selected ? ' selected' : '');
      card.style.setProperty('--tc', item.color);
      card.innerHTML = `
        <span class="cosmetic-icon" style="color:${item.color}">${item.icon}</span>
        <div class="cosmetic-name">${item.name}</div>
        <div class="cosmetic-status">${selected ? '✓ ACTIVE' : owned ? 'OWNED' : item.locked ? '🔒 ' + item.desc : 'UNLOCK'}</div>
      `;

      if (owned && !selected) {
        card.addEventListener('click', () => {
          this.saveData.cosmetics.selected = item.id;
          SaveSystem.save(this.saveData);
          this._populateCosmetics();
        });
      }

      // Unlock unlockable items
      if (!item.locked && !owned) {
        card.addEventListener('click', () => {
          this.saveData.cosmetics.owned.push(item.id);
          this.saveData.cosmetics.selected = item.id;
          SaveSystem.save(this.saveData);
          this._populateCosmetics();
        });
      }

      grid.appendChild(card);
    });
  }
}

/* ─── BOOT ──────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', async () => {
  const game = new BeatrunGame();
  window.__game = game; // dev access
  await game.boot();
  document.getElementById('screen-menu').classList.add('active');
});
