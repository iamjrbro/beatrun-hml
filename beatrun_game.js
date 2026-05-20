/* ═══════════════════════════════════════════════════════
   BEATRUN — Functional Game Engine
   Gameplay: endless side-scroller platformer
   Music: music.mp3 (fixed), beat-synced mechanics
═══════════════════════════════════════════════════════ */
'use strict';

// ── UTILS ────────────────────────────────────────────
const lerp  = (a,b,t) => a + (b-a)*t;
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const rand  = (a,b) => Math.random()*(b-a)+a;
const TAU   = Math.PI*2;

function fmtTime(ms){
  const s=Math.floor(ms/1000), m=Math.floor(s/60), sc=s%60;
  return `${m}:${String(sc).padStart(2,'0')}`;
}

// ── CANVAS SETUP ─────────────────────────────────────
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const freqC  = document.getElementById('freq-canvas');
const freqCtx= freqC.getContext('2d');

function resize(){
  canvas.width = freqC.width = window.innerWidth;
  canvas.height = window.innerHeight;
  freqC.height  = 48;
  GND = canvas.height - 110;
}
window.addEventListener('resize', ()=>{ resize(); if(G.state==='play') resetCamera(); });
resize();
let GND = canvas.height - 110;

// ── AUDIO ENGINE ─────────────────────────────────────
const Audio = {
  ctx: null, buf: null, src: null,
  analyser: null, bassAn: null,
  freqData: null, bassData: null,
  bpm: 128, beatInterval: 60000/128,
  lastBeat: 0, nextBeat: 0,
  onBeat: false, beatAccuracy: 0,
  playing: false,

  async load(url){
    this.ctx = new (window.AudioContext||window.webkitAudioContext)();
    const res = await fetch(url);
    const ab  = await res.arrayBuffer();
    this.buf  = await this.ctx.decodeAudioData(ab);
    this._detectBPM();
    this._setupAnalysers();
  },

  _detectBPM(){
    const sr  = this.buf.sampleRate;
    const raw = this.buf.getChannelData(0);
    const hop = Math.floor(sr*0.01);
    const win = hop*2;
    const energies = [];
    for(let i=0;i+win<raw.length;i+=hop){
      let e=0; for(let j=i;j<i+win;j++) e+=raw[j]*raw[j];
      energies.push(e/win);
    }
    const hps = sr/hop;
    const minL = Math.floor(hps*60/200);
    const maxL = Math.floor(hps*60/70);
    let best=-1, bestL=minL;
    for(let lag=minL;lag<=maxL;lag++){
      let c=0; const n=Math.min(energies.length-lag,5000);
      for(let i=0;i<n;i++) c+=energies[i]*energies[i+lag];
      if(c>best){best=c;bestL=lag;}
    }
    this.bpm = clamp(Math.round(60*hps/bestL),70,200);
    this.beatInterval = 60000/this.bpm;
    console.log('BPM detected:', this.bpm);
  },

  _setupAnalysers(){
    this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 1024;
    this.bassAn   = this.ctx.createAnalyser(); this.bassAn.fftSize   = 256;
    const bass    = this.ctx.createBiquadFilter();
    bass.type = 'lowpass'; bass.frequency.value = 200;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.bassData = new Uint8Array(this.bassAn.frequencyBinCount);
  },

  play(){
    if(!this.ctx||!this.buf) return;
    if(this.src){ try{this.src.stop();}catch(e){} }
    this.src = this.ctx.createBufferSource();
    this.src.buffer = this.buf;
    this.src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    // bass chain
    const bf = this.ctx.createBiquadFilter();
    bf.type='lowpass'; bf.frequency.value=200;
    this.src.connect(bf); bf.connect(this.bassAn);
    this.src.start(0);
    this.playing = true;
    this.lastBeat = performance.now();
    this.nextBeat = this.lastBeat + this.beatInterval;
  },

  stop(){ try{this.src?.stop();}catch(e){} this.playing=false; },
  resume(){ if(this.ctx?.state==='suspended') this.ctx.resume(); },

  tick(now){
    if(!this.playing) return;
    this.analyser?.getByteFrequencyData(this.freqData);
    this.bassAn?.getByteFrequencyData(this.bassData);
    this.onBeat = false;
    if(now >= this.nextBeat){
      this.onBeat = true;
      this.lastBeat = this.nextBeat;
      this.nextBeat += this.beatInterval;
    }
    const toL = now - this.lastBeat;
    const toN = this.nextBeat - now;
    const closest = Math.min(toL,toN);
    this.beatAccuracy = clamp(1 - closest/100, 0, 1);
    this.isNearBeat = closest < 120;
  },

  bassEnergy(){
    if(!this.bassData) return 0;
    let s=0; for(let i=0;i<this.bassData.length;i++) s+=this.bassData[i];
    return s/(this.bassData.length*255);
  },

  beatPhase(){
    const d = performance.now() - this.lastBeat;
    return (d/this.beatInterval)%1;
  }
};

// ── GLOBAL STATE ─────────────────────────────────────
const G = {
  state: 'menu',   // menu | play | dead
  score: 0,
  combo: 1,
  bestCombo: 1,
  flow: 0,          // 0..1 overdrive meter
  overdrive: false,
  overdriveTimer: 0,
  elapsed: 0,
  totalMoves: 0,
  syncedMoves: 0,
  pb: null,
  runs: 0,
};
try{ const s=JSON.parse(localStorage.getItem('br2')||'{}'); G.pb=s.pb||null; G.runs=s.runs||0; }catch(e){}

// ── PLAYER ────────────────────────────────────────────
const P = {
  x: 120, y: 0,
  vx: 0, vy: 0,
  w: 22, h: 40,
  onGround: false,
  onWall: null,      // null|'left'|'right'
  sliding: false,
  coyote: 0,
  jumpBuf: 0,
  bhop: 0,           // bhop chain count
  bhopTimer: 0,
  trailPts: [],

  reset(){
    this.x=120; this.y=0; this.vx=6; this.vy=0;
    this.onGround=false; this.onWall=null; this.sliding=false;
    this.coyote=0; this.jumpBuf=0; this.bhop=0; this.bhopTimer=0;
    this.trailPts=[];
  },

  update(dt, keys, platforms, walls){
    const GRAV  = 28;
    const SPEED = G.overdrive ? 22 : 14;
    const JUMP  = 11.5;
    const WALL_JUMP = 10;
    const bhopMult = 1 + (this.bhop/8)*0.5;

    // Timers
    if(this.coyote>0)   this.coyote  -= dt;
    if(this.jumpBuf>0)  this.jumpBuf -= dt;
    if(this.bhopTimer>0)this.bhopTimer-= dt; else this.bhop=0;

    // Horizontal
    let targetVX = SPEED * bhopMult;
    // auto-run right + optional left/right input
    if(keys.left && !this.sliding)  targetVX = -SPEED*0.6;
    if(keys.right|| !keys.left)     targetVX = SPEED * bhopMult;
    if(this.sliding) targetVX = Math.max(Math.abs(this.vx), SPEED*1.4) * Math.sign(this.vx||1);

    if(!this.sliding){
      this.vx = lerp(this.vx, targetVX, this.onGround ? 0.22 : 0.10);
    } else {
      this.vx = lerp(this.vx, targetVX, 0.04);
    }

    // Gravity
    if(this.onWall && this.vy < 0){
      this.vy = Math.max(this.vy - GRAV*0.15*dt, -5);
    } else {
      this.vy -= GRAV*dt;
    }

    // Jump input → buffer
    if(keys.jump && !keys._jumpWas){
      this.jumpBuf = 0.14;
    }
    keys._jumpWas = keys.jump;

    // Execute jump
    const canJump = this.onGround || this.coyote>0 || this.onWall;
    if(this.jumpBuf>0 && canJump){
      let ev = null;
      if(this.onWall){
        const dir = this.onWall==='left' ? 1 : -1;
        this.vx = dir*(SPEED*1.3);
        this.vy = WALL_JUMP;
        this.onWall = null;
        ev = 'walljump';
      } else {
        const bhopActive = this.bhopTimer > 0;
        this.vy = JUMP * (bhopActive ? 1.12 : 1);
        if(bhopActive){ this.bhop = Math.min(this.bhop+1,8); }
        else { this.bhop=0; }
        this.bhopTimer = 0.28;
        ev = bhopActive ? 'bhop' : 'jump';
      }
      this.onGround=false; this.coyote=0; this.jumpBuf=0;
      return ev;
    }

    // Slide
    if(keys.slide && this.onGround && !this.sliding){ this.sliding=true; return 'slide'; }
    if(!keys.slide && this.sliding){ this.sliding=false; }

    // Move
    this.x += this.vx*dt;
    this.y += this.vy*dt;

    // Ground
    const prevOnGround = this.onGround;
    this.onGround = false;

    // Platform collisions
    let landEvent = null;
    for(const p of platforms){
      if(this.x+this.w/2 > p.x && this.x-this.w/2 < p.x+p.w &&
         this.y       <= p.y+p.h && this.y >= p.y && this.vy<=0){
        this.y = p.y+p.h; this.vy=0; this.onGround=true;
        this.coyote=0.1; this.sliding&&(this.vx*=0.98);
        if(!prevOnGround) landEvent = 'land';
      }
    }

    // World ground
    if(this.y <= 0){
      const was = prevOnGround;
      this.y=0; this.vy=0; this.onGround=true; this.coyote=0.1;
      if(!was) landEvent = 'land';
    }

    // Wall collisions
    this.onWall = null;
    for(const w of walls){
      const inY = this.y+this.h > w.y && this.y < w.y+w.h;
      if(!inY) continue;
      if(this.x+this.w/2 >= w.x && this.x-this.w/2 < w.x && this.vx>0){
        this.x = w.x - this.w/2; this.vx=0; if(!this.onGround) this.onWall='right';
      } else if(this.x-this.w/2 <= w.x+w.w && this.x+this.w/2 > w.x+w.w && this.vx<0){
        this.x = w.x+w.w+this.w/2; this.vx=0; if(!this.onGround) this.onWall='left';
      }
    }

    // Trail
    this.trailPts.push({x:this.x, y:this.y+this.h/2, t:performance.now()});
    if(this.trailPts.length>60) this.trailPts.shift();

    if(!this.onGround && prevOnGround) this.coyote=0.09;

    return landEvent;
  }
};

// ── WORLD / PLATFORMS ────────────────────────────────
let platforms = [], walls = [], coins = [];
let worldX = 0;   // camera scroll
let nextGenX = 0; // where to generate next chunk

const COLORS = ['#00f5ff','#ff2d78','#a855f7','#ffde00','#00ff9f','#ff6b35'];

function platformColor(){ return COLORS[Math.floor(Math.random()*COLORS.length)]; }

function genChunk(startX){
  const beatDist = (60/Audio.bpm) * 14 * 60; // px per beat at normal speed
  let x = startX;
  const chunkEnd = x + 900;

  while(x < chunkEnd){
    const beatsApart = Math.floor(rand(1,3.5));
    const gap = beatDist * beatsApart * rand(0.7,1.2);
    const w   = rand(110,250);
    const h   = rand(12,18);
    const py  = rand(40,GND-60);   // platform Y from bottom
    const col = platformColor();

    platforms.push({ x, y:py, w, h, color:col,
      beat: Math.round(x / beatDist),
      pulse: Math.random()*TAU, pulseAmp:rand(0.3,0.9) });

    // Occasionally add walls for wallrun
    if(Math.random()<0.25){
      const wx = x + gap*rand(0.3,0.7);
      walls.push({
        x: wx, y: rand(20,py+60),
        w: 14, h: rand(80,180),
        color: Math.random()<0.5?'#00f5ff':'#ff2d78',
        side: Math.random()<0.5?'left':'right'
      });
    }

    // Coins on beat positions
    for(let b=0;b<beatsApart;b++){
      if(Math.random()<0.55){
        const cx = x + beatDist*(b+0.5);
        coins.push({ x:cx, y:py+h+rand(20,60), collected:false, pulse:Math.random()*TAU });
      }
    }

    x += gap;
  }
  nextGenX = x;
}

function resetWorld(){
  platforms=[]; walls=[]; coins=[]; worldX=0; nextGenX=0;
  // Starting ground platforms
  for(let i=0;i<5;i++) platforms.push({x:i*200-100,y:0,w:220,h:16,color:'#333',beat:0,pulse:0,pulseAmp:0});
  genChunk(800);
}

// ── PARTICLES ─────────────────────────────────────────
let particles = [];

function burst(x,y,color,n=12,spread=60){
  for(let i=0;i<n;i++){
    const a=rand(0,TAU), s=rand(1,spread/15);
    particles.push({
      x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      color, size:rand(2,5), life:1, decay:rand(0.025,0.055)
    });
  }
}

function updateParticles(dt){
  particles=particles.filter(p=>{
    p.x+=p.vx*dt*60; p.y+=p.vy*dt*60;
    p.vy-=0.06*dt*60; p.life-=p.decay*dt*60;
    return p.life>0;
  });
}

// ── BUILDINGS (background) ─────────────────────────────
const buildings = [];
function initBuildings(){
  for(let i=0;i<30;i++){
    buildings.push({
      x: rand(-200,6000), h:rand(120,500),
      w: rand(60,180), color:`hsl(${rand(240,280)},${rand(20,40)}%,${rand(5,12)}%)`,
      neon: COLORS[Math.floor(Math.random()*COLORS.length)],
      windowAlpha: rand(0.1,0.4)
    });
  }
}
initBuildings();

// ── RAIN ──────────────────────────────────────────────
const rainDrops=[];
for(let i=0;i<180;i++) rainDrops.push({
  x:rand(0,4000),y:rand(0,700),
  len:rand(8,22),speed:rand(9,20),alpha:rand(0.08,0.3)
});

// ── CAMERA ────────────────────────────────────────────
let camX=0, camY=0, camRoll=0, camFOV=1, camShake={x:0,y:0,power:0};
let targetCamX=0, targetCamY=0, targetRoll=0, targetFOV=1;

function resetCamera(){ camX=0; camY=0; }

function updateCamera(dt){
  targetCamX = P.x - canvas.width*0.32;
  targetCamY = clamp(-P.y*0.8, -150, 0);
  const speed = Math.abs(P.vx);
  targetFOV  = 1 + clamp((speed-14)/14, 0, 0.12);
  targetRoll = P.onWall ? (P.onWall==='left'?-0.05:0.05) : 0;

  camX  = lerp(camX, targetCamX, 1-Math.pow(0.01,dt));
  camY  = lerp(camY, targetCamY, 1-Math.pow(0.04,dt));
  camFOV= lerp(camFOV, targetFOV, 1-Math.pow(0.05,dt));
  camRoll=lerp(camRoll, targetRoll, 1-Math.pow(0.06,dt));

  if(camShake.power>0){
    camShake.power=lerp(camShake.power,0,1-Math.pow(0.001,dt));
    camShake.x=(Math.random()-.5)*camShake.power;
    camShake.y=(Math.random()-.5)*camShake.power;
  }
}

// ── INPUT ─────────────────────────────────────────────
const keys={left:false,right:false,jump:false,slide:false,_jumpWas:false};
document.addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') keys.left=true;
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') keys.right=true;
  if(e.key===' '||e.key==='ArrowUp'||e.key==='w'||e.key==='W') keys.jump=true;
  if(e.key==='ArrowDown'||e.key==='s'||e.key==='S'||e.key==='c'||e.key==='C') keys.slide=true;
  if(e.key==='Escape') pauseToggle();
  e.preventDefault();
},{passive:false});
document.addEventListener('keyup',e=>{
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') keys.left=false;
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') keys.right=false;
  if(e.key===' '||e.key==='ArrowUp'||e.key==='w'||e.key==='W') keys.jump=false;
  if(e.key==='ArrowDown'||e.key==='s'||e.key==='S'||e.key==='c'||e.key==='C') keys.slide=false;
});

// Mobile buttons
function bindMobile(id,key){
  const el=document.getElementById(id);
  if(!el) return;
  el.addEventListener('touchstart',e=>{e.preventDefault();keys[key]=true;el.classList.add('pressed');},{passive:false});
  el.addEventListener('touchend',  e=>{e.preventDefault();keys[key]=false;el.classList.remove('pressed');},{passive:false});
  el.addEventListener('mousedown', ()=>{ keys[key]=true;  el.classList.add('pressed'); });
  el.addEventListener('mouseup',   ()=>{ keys[key]=false; el.classList.remove('pressed'); });
}
bindMobile('m-left','left');
bindMobile('m-right','right');
bindMobile('m-jump','jump');
bindMobile('m-slide','slide');

// ── HUD HELPERS ───────────────────────────────────────
const $ = id => document.getElementById(id);
let moveTagTimeout = null;

function showMove(label, color){
  const wrap = $('hud-move');
  const el = document.createElement('div');
  el.className='move-tag';
  el.textContent=label;
  el.style.color=color;
  el.style.background=color+'18';
  wrap.appendChild(el);
  if(wrap.children.length>4) wrap.firstElementChild.remove();
  setTimeout(()=>{ el.style.transition='opacity .4s,transform .4s'; el.style.opacity='0'; el.style.transform='translateY(-16px)'; setTimeout(()=>el.remove(),400); },900);
}

function showBeat(text,color='#ffde00'){
  const el=$('hud-beat');
  el.textContent=text; el.style.color=color;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.classList.remove('show'),400);
}

function comboColor(c){
  if(c>=20) return '#ff2d78';
  if(c>=10) return '#a855f7';
  if(c>=5)  return '#ffde00';
  return '#fff';
}

function updateHUD(){
  $('hud-combo').textContent = '×'+G.combo;
  $('hud-combo').style.color = comboColor(G.combo);
  $('hud-score').textContent = G.score.toLocaleString();
  $('hud-timer').textContent = fmtTime(G.elapsed);
  $('hud-flow-bar').style.width = (G.flow*100)+'%';

  // Overdrive
  if(G.overdrive){
    $('overdrive-wrap').classList.add('active');
    $('overdrive-text').classList.add('show');
    document.body.style.setProperty('--glow','rgba(255,45,120,.2)');
  } else {
    $('overdrive-wrap').classList.remove('active');
    $('overdrive-text').classList.remove('show');
  }
}

// ── COMBO / SCORING ───────────────────────────────────
let comboDecayTimer = 0;

function registerMove(type){
  G.totalMoves++;
  const synced = Audio.isNearBeat;
  const acc    = Audio.beatAccuracy;

  if(synced){
    G.syncedMoves++;
    G.combo = Math.min(G.combo+1, 99);
  }

  comboDecayTimer = 2.2; // reset decay

  const base = {jump:10,bhop:35,walljump:28,slide:18,land:6}[type]||8;
  const sync  = synced ? Math.round(acc*60) : 0;
  const mult  = G.overdrive ? 2 : 1;
  const pts   = Math.round((base+sync)*G.combo*mult);
  G.score += pts;

  if(G.combo > G.bestCombo) G.bestCombo = G.combo;

  // Overdrive meter
  G.flow = Math.min(1, G.flow + (synced?0.14:0.04));
  if(G.flow>=1 && !G.overdrive){
    G.overdrive=true; G.overdriveTimer=8; G.flow=0;
    showBeat('◈ OVERDRIVE ◈','#ff2d78');
  }

  // Feedback
  const COLOR = {jump:'#00f5ff',bhop:'#ffde00',walljump:'#ff2d78',slide:'#a855f7',land:'#00ff9f'};
  const LABEL = {
    jump:   synced?'♪ JUMP':'↑ JUMP',
    bhop:   synced?'♪ BHOP !!':'BHOP',
    walljump:synced?'♪ WALL JUMP':'WALL JUMP',
    slide:  synced?'♪ SLIDE':'▶ SLIDE',
    land:   'LAND',
  };
  const col = COLOR[type]||'#fff';
  showMove(LABEL[type]||type.toUpperCase(), col);
  if(synced && acc>0.65) showBeat(acc>0.88?'PERFECT':'ON BEAT');

  // Particles
  const sx = canvas.width*0.32 + camShake.x;
  const sy = GND - P.y - P.h/2;
  burst(sx,sy,col, synced?18:8, synced?80:40);

  return pts;
}

// ── DEATH ──────────────────────────────────────────────
function die(){
  if(G.state!=='play') return;
  G.state='dead';
  Audio.stop();
  burst(canvas.width*0.32, GND-P.y, '#ff2d78', 30, 100);

  // Results
  const grade = calcGrade();
  const syncPct = G.totalMoves>0?Math.round(G.syncedMoves/G.totalMoves*100):0;
  $('go-grade').textContent = grade;
  $('go-grade').style.background = {S:'linear-gradient(135deg,#fff,#ffde00)',A:'linear-gradient(135deg,#fff,#00ff9f)',B:'linear-gradient(135deg,#fff,#00f5ff)',C:'linear-gradient(135deg,#fff,#a855f7)',D:'linear-gradient(135deg,#fff,#ff2d78)'}[grade]||'';
  $('go-grade').style['-webkit-background-clip']='text';
  $('go-grade').style.backgroundClip='text';
  $('go-grade').style['-webkit-text-fill-color']='transparent';
  $('go-title').textContent = grade==='S'?'— PERFECT —': grade==='A'?'— GREAT RUN —':'— RUN COMPLETE —';
  $('go-time').textContent = fmtTime(G.elapsed);

  const stats = [
    ['SCORE',         G.score.toLocaleString()],
    ['BEST COMBO',    '×'+G.bestCombo],
    ['BEAT SYNC',     syncPct+'%'],
    ['OVERDRIVE',     G.overdrive?'YES':'—'],
    ['DISTANCE',      Math.round(P.x)+'m'],
  ];
  $('go-stats').innerHTML = stats.map(([l,v])=>`<div class="go-stat"><span class="go-stat-label">${l}</span><span class="go-stat-val">${v}</span></div>`).join('');

  G.runs++;
  if(!G.pb || G.elapsed > G.pb) G.pb=G.elapsed;
  try{localStorage.setItem('br2',JSON.stringify({pb:G.pb,runs:G.runs}));}catch(e){}
  $('menu-best-val').textContent = G.pb?fmtTime(G.pb):'—';

  $('gameover').classList.add('show');
}

function calcGrade(){
  const syncPct = G.totalMoves>0?G.syncedMoves/G.totalMoves:0;
  const c=G.bestCombo;
  if(syncPct>=0.8 && c>=15) return 'S';
  if(syncPct>=0.65&& c>=8)  return 'A';
  if(syncPct>=0.5 && c>=4)  return 'B';
  if(syncPct>=0.35)          return 'C';
  return 'D';
}

// ── START RUN ─────────────────────────────────────────
async function startRun(){
  $('menu').style.display='none';
  $('gameover').classList.remove('show');

  G.state='play'; G.score=0; G.combo=1; G.bestCombo=1;
  G.flow=0; G.overdrive=false; G.overdriveTimer=0;
  G.elapsed=0; G.totalMoves=0; G.syncedMoves=0;

  particles=[];
  P.reset();
  resetWorld();
  resetCamera();

  Audio.resume();
  Audio.play();

  $('hud-move').innerHTML='';

  if(!looping){ looping=true; requestAnimationFrame(loop); }
}

let looping = false;
let lastTime = 0;
let paused   = false;

function pauseToggle(){
  if(G.state!=='play') return;
  paused=!paused;
}

// ── DRAW ───────────────────────────────────────────────
function drawScene(now){
  const W=canvas.width, H=canvas.height;
  const bass  = Audio.bassEnergy();
  const bphase= Audio.beatPhase();

  ctx.clearRect(0,0,W,H);

  // Sky
  const sky=ctx.createLinearGradient(0,0,0,H);
  if(G.overdrive){
    sky.addColorStop(0,'#1a0022'); sky.addColorStop(1,'#0a0014');
  } else {
    sky.addColorStop(0,'#06040d'); sky.addColorStop(1,'#0c0820');
  }
  ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

  // Save + camera transform
  ctx.save();
  ctx.translate(W/2+camShake.x, H/2+camShake.y+camY);
  ctx.rotate(camRoll);
  ctx.scale(camFOV,camFOV);
  ctx.translate(-W/2, -H/2);
  ctx.translate(-camX, 0);

  // ── Buildings (parallax 0.3) ──
  ctx.save();
  const px03 = camX*0.3;
  ctx.translate(px03,0);
  buildings.forEach(b=>{
    const bx=b.x-px03, by=H-110-b.h;
    if(bx+b.w<-50||bx>W+50) return;
    ctx.fillStyle=b.color; ctx.fillRect(bx,by,b.w,b.h);
    // windows
    const cols=Math.floor(b.w/16), rows=Math.floor(b.h/20);
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      if(Math.random()<0.55){
        ctx.fillStyle=`rgba(255,240,180,${b.windowAlpha*(0.5+bass*0.5)})`;
        ctx.fillRect(bx+4+c*14,by+4+r*18,8,10);
      }
    }
    // neon stripe
    ctx.save();
    ctx.fillStyle=b.neon;
    ctx.shadowColor=b.neon; ctx.shadowBlur=6+bass*16;
    ctx.globalAlpha=0.5+bass*0.4;
    ctx.fillRect(bx,by,b.w,3);
    ctx.restore();
  });
  ctx.restore();

  // ── Rain (parallax 0.6) ──
  ctx.save();
  const px06=camX*0.6;
  ctx.translate(px06,0);
  const rainColor = G.overdrive?'rgba(255,45,120,0.18)':'rgba(140,160,255,0.18)';
  ctx.strokeStyle=rainColor; ctx.lineWidth=1;
  rainDrops.forEach(r=>{
    const rx=r.x-px06;
    if(rx<-10||rx>W+10) return;
    ctx.globalAlpha=r.alpha*(0.6+bass*0.6);
    ctx.beginPath(); ctx.moveTo(rx,r.y); ctx.lineTo(rx+1,r.y+r.len); ctx.stroke();
  });
  ctx.globalAlpha=1;
  ctx.restore();

  // ── Ground line ──
  ctx.save();
  ctx.strokeStyle=G.overdrive?'#ff2d78':'#a855f7';
  ctx.lineWidth=1.5; ctx.shadowColor=ctx.strokeStyle; ctx.shadowBlur=8+bass*20;
  ctx.globalAlpha=0.7;
  ctx.beginPath(); ctx.moveTo(-1000,H-110); ctx.lineTo(10000,H-110); ctx.stroke();
  ctx.restore();

  // ── Platforms ──
  const beatPulse=Math.sin(bphase*TAU)*0.5+0.5;
  platforms.forEach(p=>{
    if(p.x-camX>W+100||p.x+p.w-camX<-100) return;
    const py=H-110-p.y-p.h;
    const glow=bass+Math.sin(bphase*TAU+p.pulse)*p.pulseAmp*0.3;
    ctx.save();
    ctx.shadowColor=p.color; ctx.shadowBlur=4+glow*22;
    ctx.fillStyle='#0e0b1e'; ctx.fillRect(p.x,py,p.w,p.h);
    ctx.fillStyle=p.color; ctx.globalAlpha=0.9+beatPulse*0.1;
    ctx.fillRect(p.x,py,p.w,3);
    ctx.restore();
  });

  // ── Walls ──
  walls.forEach(w=>{
    if(w.x-camX>W+60||w.x+w.w-camX<-60) return;
    const wy=H-110-w.y-w.h;
    ctx.save();
    ctx.shadowColor=w.color; ctx.shadowBlur=8+bass*14;
    ctx.fillStyle='#0e0b1e'; ctx.fillRect(w.x,wy,w.w,w.h);
    ctx.fillStyle=w.color; ctx.globalAlpha=0.9;
    const ex = w.side==='right'?w.x:w.x+w.w-2;
    ctx.fillRect(ex,wy,2,w.h);
    ctx.restore();
  });

  // ── Coins ──
  coins.forEach(coin=>{
    if(coin.collected) return;
    if(coin.x-camX>W+60||coin.x-camX<-60) return;
    coin.pulse=(coin.pulse||0)+0.07;
    const cy=H-110-coin.y;
    const r=7+Math.sin(coin.pulse)*2;
    ctx.save();
    ctx.fillStyle='#ffde00'; ctx.shadowColor='#ffde00'; ctx.shadowBlur=10+bass*10;
    ctx.beginPath(); ctx.arc(coin.x,cy,r,0,TAU); ctx.fill();
    ctx.restore();
    // Collect
    const dx=Math.abs(coin.x-(P.x)),dy=Math.abs((H-110-coin.y)-(H-110-P.y-P.h/2));
    if(dx<20&&dy<24){ coin.collected=true; G.score+=G.combo*5; burst(coin.x,cy,'#ffde00',8,40); }
  });

  // ── Player trail ──
  const trailColor = G.overdrive?'#ff2d78':'#a855f7';
  P.trailPts.forEach((pt,i)=>{
    if(i===0) return;
    const age=(performance.now()-pt.t)/800;
    const alpha=(1-age)*0.5;
    if(alpha<=0) return;
    const p0=P.trailPts[i-1];
    const sy0=H-110-p0.y, sy1=H-110-pt.y;
    ctx.strokeStyle=trailColor;
    ctx.lineWidth=G.overdrive?4:2;
    ctx.globalAlpha=alpha;
    ctx.shadowColor=trailColor; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.moveTo(p0.x,sy0); ctx.lineTo(pt.x,sy1); ctx.stroke();
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  });

  // ── Player ──
  {
    const sx=P.x, sy=H-110-P.y-(P.sliding?P.h*0.5:P.h);
    const ph=P.sliding?P.h*0.5:P.h;
    const col=G.overdrive?'#ff2d78':'#a855f7';

    // Glow aura
    if(G.overdrive){
      const aura=ctx.createRadialGradient(sx,sy+ph/2,0,sx,sy+ph/2,55);
      aura.addColorStop(0,'rgba(255,45,120,0.35)'); aura.addColorStop(1,'transparent');
      ctx.fillStyle=aura;
      ctx.beginPath(); ctx.ellipse(sx,sy+ph/2,55,55,0,0,TAU); ctx.fill();
    }

    ctx.save();
    ctx.shadowColor=col; ctx.shadowBlur=G.overdrive?28:12+bass*14;
    ctx.fillStyle=col+'cc';
    ctx.beginPath();
    ctx.roundRect(sx-P.w/2,sy,P.w,ph,[6,6,3,3]);
    ctx.fill();

    // Beat pulse ring
    const bp=Math.sin(bphase*TAU)*0.5+0.5;
    ctx.strokeStyle=col; ctx.lineWidth=1.5;
    ctx.globalAlpha=0.3+bp*0.4;
    ctx.beginPath(); ctx.roundRect(sx-P.w/2-3,sy-3,P.w+6,ph+6,[9,9,5,5]); ctx.stroke();

    // Wall grab indicator
    if(P.onWall){
      const gx=P.onWall==='right'?sx+P.w/2+2:sx-P.w/2-8;
      ctx.globalAlpha=0.9; ctx.fillStyle='#00f5ff';
      ctx.shadowColor='#00f5ff'; ctx.shadowBlur=12;
      ctx.fillRect(gx,sy+4,6,ph-8);
    }
    ctx.restore();
  }

  // ── Particles ──
  particles.forEach(p=>{
    const sy=H-110-p.y; // wait no—particles are in screen space
    ctx.save();
    ctx.globalAlpha=p.life;
    ctx.fillStyle=p.color;
    ctx.shadowColor=p.color; ctx.shadowBlur=G.overdrive?14:5;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size*p.life,0,TAU); ctx.fill();
    ctx.restore();
  });

  ctx.restore(); // end camera transform

  // ── Vignette ──
  const vig=ctx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.85);
  vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

  // ── Speed streaks ──
  const speed=Math.abs(P.vx);
  if(speed>16){
    const alpha=(speed-16)/10*0.12;
    ctx.save(); ctx.globalAlpha=alpha;
    for(let i=0;i<10;i++){
      const sy=Math.random()*H;
      const len=Math.random()*200+80;
      ctx.fillStyle='#fff';
      ctx.fillRect(0,sy,len,1);
      ctx.fillRect(W-len,sy,len,1);
    }
    ctx.restore();
  }

  // ── Freq visualizer ──
  drawFreqViz(bass);

  // Beat ring (top center)
  drawBeatRing(bphase, bass);
}

function drawBeatRing(phase,bass){
  const W=canvas.width;
  const cx=W/2, cy=38, r=18;
  const pulse=Math.sin(phase*TAU)*0.5+0.5;
  ctx.save();
  ctx.strokeStyle=`rgba(255,222,0,${0.15+pulse*0.5})`;
  ctx.lineWidth=2;
  ctx.shadowColor='#ffde00'; ctx.shadowBlur=pulse*20;
  ctx.beginPath(); ctx.arc(cx,cy,r+pulse*6,0,TAU); ctx.stroke();
  ctx.fillStyle=`rgba(255,222,0,${0.2+pulse*0.6})`;
  ctx.beginPath(); ctx.arc(cx,cy,6,0,TAU); ctx.fill();
  ctx.restore();
}

function drawFreqViz(bass){
  const W=freqC.width, H=freqC.height;
  freqCtx.clearRect(0,0,W,H);
  if(!Audio.freqData) return;
  const barW=3,gap=1,count=Math.floor(W/(barW+gap));
  const step=Math.floor(Audio.freqData.length/count);
  const col=G.overdrive?'#ff2d78':G.combo>=10?'#a855f7':'#00f5ff';
  for(let i=0;i<count;i++){
    let s=0; for(let j=0;j<step;j++) s+=Audio.freqData[i*step+j];
    const val=s/step/255;
    const bh=val*H*(G.overdrive?1.5:1);
    const grad=freqCtx.createLinearGradient(0,H,0,H-bh);
    grad.addColorStop(0,col+'99'); grad.addColorStop(1,col+'11');
    freqCtx.fillStyle=grad;
    freqCtx.fillRect(i*(barW+gap),H-bh,barW,bh);
  }
}

// ── MAIN LOOP ──────────────────────────────────────────
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min((now-lastTime)/1000,0.05);
  lastTime=now;

  if(G.state==='menu'){ drawMenuBg(now); return; }
  if(G.state==='dead' || paused){ return; }

  // Time
  G.elapsed += dt*1000;

  // Audio
  Audio.tick(now);
  const bass=Audio.bassEnergy();

  // Rain physics
  const groundH=canvas.height;
  rainDrops.forEach(r=>{
    r.y+=r.speed*dt*60*(1+bass*1.5);
    if(r.y>groundH) r.y=-20;
    r.x-=0.5*dt*60;
    if(r.x<-500) r.x+=6000;
  });

  // Overdrive timer
  if(G.overdrive){
    G.overdriveTimer-=dt;
    if(G.overdriveTimer<=0){ G.overdrive=false; G.overdriveTimer=0; G.flow=0; }
  } else {
    // Auto-drain flow when not overdrive
    G.flow=Math.max(0, G.flow-dt*0.04);
  }

  // Combo decay
  comboDecayTimer-=dt;
  if(comboDecayTimer<=0 && G.combo>1){
    G.combo=Math.max(1,G.combo-1);
    comboDecayTimer=1.0;
  }

  // Generate more world
  if(nextGenX - P.x < 1200) genChunk(nextGenX);

  // Cull far-left objects
  const cullX=P.x-400;
  platforms=platforms.filter(p=>p.x+p.w>cullX);
  walls=walls.filter(w=>w.x+w.w>cullX);
  coins=coins.filter(c=>c.x>cullX);

  // Player update
  const moveEv=P.update(dt,keys,platforms,walls);
  if(moveEv) registerMove(moveEv);

  // Death: fell off screen or way left
  if(P.y < -600 || P.x < camX-200){
    die(); return;
  }

  // Particles (in screen space — convert now)
  // Keep them world-independent: just update
  updateParticles(dt);

  // Camera
  updateCamera(dt);

  // Draw
  drawScene(now);
  updateHUD();
}

// Menu background animation
let menuT=0;
function drawMenuBg(now){
  menuT+=0.006;
  const W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);
  // Animated gradient bg
  const sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#06040d'); sky.addColorStop(1,'#0c0820');
  ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
  // Grid
  ctx.strokeStyle='rgba(168,85,247,0.05)'; ctx.lineWidth=1;
  const gs=60,ox=(menuT*25)%gs;
  for(let x=-gs+ox;x<W+gs;x+=gs){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
  for(let y=0;y<H+gs;y+=gs){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
  // Orbs
  [{cx:.12,cy:.3,r:160,c:'#a855f7'},{cx:.88,cy:.7,r:200,c:'#ff2d78'},{cx:.5,cy:.95,r:120,c:'#00f5ff'}].forEach((o,i)=>{
    const x=W*o.cx+Math.sin(menuT+i*2.1)*35;
    const y=H*o.cy+Math.cos(menuT*.8+i)*22;
    const g=ctx.createRadialGradient(x,y,0,x,y,o.r);
    g.addColorStop(0,o.c+'1a'); g.addColorStop(1,'transparent');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,o.r,0,TAU); ctx.fill();
  });
  drawFreqViz(0);
}

// ── INIT ───────────────────────────────────────────────
$('btn-play').addEventListener('click',async()=>{
  Audio.resume();
  // Try loading music.mp3
  if(!Audio.buf){
    try{
      $('btn-play').textContent='LOADING...';
      await Audio.load('music.mp3');
      $('btn-play').textContent='▶  START RUN';
    } catch(e){
      console.warn('music.mp3 not found, using silent mode');
      Audio.bpm=128; Audio.beatInterval=60000/128;
      Audio.lastBeat=performance.now(); Audio.nextBeat=Audio.lastBeat+Audio.beatInterval;
      Audio.playing=true;
    }
  }
  startRun();
});

$('go-retry').addEventListener('click',()=>startRun());
$('go-menu').addEventListener('click',()=>{
  $('gameover').classList.remove('show');
  $('menu').style.display='';
  G.state='menu';
});

// Update menu PB
$('menu-best-val').textContent = G.pb?fmtTime(G.pb):'—';

// Start menu BG loop
G.state='menu';
looping=true;
lastTime=performance.now();
requestAnimationFrame(loop);

