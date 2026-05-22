// @ts-nocheck
let _stage1Initialized = false;
export function initStage1() {
  if (_stage1Initialized) return;
  _stage1Initialized = true;

// ─────────────────────────────────────────
//  CURSOR
// ─────────────────────────────────────────
const cursorEl = document.getElementById('s1cursor');
let mx = 0, my = 0;
document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursorEl.style.left = mx + 'px';
  cursorEl.style.top  = my + 'px';
});

// ─────────────────────────────────────────
//  SNOW PARTICLES (overlay)
// ─────────────────────────────────────────
const snowCanvas = document.getElementById('s1snow_canvas');
const snowCtx = snowCanvas.getContext('2d');
let snowflakes = [];

function resizeSnow() {
  snowCanvas.width  = window.innerWidth;
  snowCanvas.height = window.innerHeight;
}
resizeSnow();
window.addEventListener('resize', resizeSnow);

function initSnow() {
  snowflakes = [];
  for (let i = 0; i < 120; i++) {
    snowflakes.push({
      x: Math.random() * snowCanvas.width,
      y: Math.random() * snowCanvas.height,
      r: Math.random() * 2.2 + 0.4,
      speed: Math.random() * 0.8 + 0.2,
      drift: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.5 + 0.15,
      phase: Math.random() * Math.PI * 2,
    });
  }
}
initSnow();

function animateSnow() {
  snowCtx.clearRect(0, 0, snowCanvas.width, snowCanvas.height);
  const t = Date.now() / 1000;
  snowflakes.forEach(s => {
    s.y += s.speed;
    s.x += s.drift + Math.sin(t * 0.4 + s.phase) * 0.15;
    if (s.y > snowCanvas.height + 5) { s.y = -5; s.x = Math.random() * snowCanvas.width; }
    if (s.x > snowCanvas.width) s.x = 0;
    if (s.x < 0) s.x = snowCanvas.width;
    snowCtx.beginPath();
    snowCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    snowCtx.fillStyle = `rgba(210,230,250,${s.opacity})`;
    snowCtx.fill();
  });
  requestAnimationFrame(animateSnow);
}
animateSnow();

// ─────────────────────────────────────────
//  GAME ENGINE
// ─────────────────────────────────────────
const canvas = document.getElementById('s1game_canvas');
const ctx = canvas.getContext('2d');

let W, H;
function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', () => { resize(); buildWorld(); });

// ── State ──
const WORLD_W = 3200;
let camX = 0;
let gameStarted = false;
let gameOver = false;
let collectedCount = 0;
const TOTAL_FRAGMENTS = 3;

// ─────────────────────────────────────────
//  @TUNABLES  (stage 1) — adjust via admin panel,
//  then hardcode here for production build.
// ─────────────────────────────────────────
const tunables = {
  playerStartX: 160,        // @TUNABLE 캐릭터 시작 X
  playerStartY: -48,        // @TUNABLE 캐릭터 시작 Y (groundY 기준 오프셋, 음수=위)
  jumpForce: -18,           // @TUNABLE 점프 힘 (음수가 강함)
  moveSpeed: 2.8,           // @TUNABLE 이동 속도
  gravity: 1,               // @TUNABLE 중력
  // fragments: [x, y는 groundY 기준 오프셋]
  fragments: [
    { x: 680,  yOffset: -150 }, // @TUNABLE 다이아 0
    { x: 1380, yOffset: -175 }, // @TUNABLE 다이아 1
    { x: 2550, yOffset: -160 }, // @TUNABLE 다이아 2
  ],
  labelOffsetY: -25,        // @TUNABLE 다이아 위 시구 라벨 Y 오프셋
  labelFontSize: 14,        // @TUNABLE 다이아 위 라벨 폰트 크기
  popupFontSize: 22,        // @TUNABLE 수집 시 팝업 폰트 크기 (CSS도 함께)
  popupFadeMs: 1200,        // @TUNABLE 수집 팝업 표시 시간(ms)
};

// ── Player ──
const player = {
  x: 160, y: 0, vy: 0, vx: 0,
  w: 22, h: 48,
  onGround: false, dir: 1,
  walkFrame: 0, walkTimer: 0,
  breathPhase: 0,
};

// ── Keys ──
const keys = {};
document.addEventListener('keydown', e => { keys[e.key] = true; });
document.addEventListener('keyup',   e => { keys[e.key] = false; });

// ── Platforms / ground ──
let platforms = [];
let groundY = 0;

function buildWorld() {
  groundY = H * 0.72;
  platforms = [
    // main ground strip (very long)
    { x: -200, y: groundY, w: WORLD_W + 400, h: H },
    // raised platforms
    { x: 600,  y: groundY - 80,  w: 160, h: 20 },
    { x: 900,  y: groundY - 140, w: 120, h: 20 },
    { x: 1300, y: groundY - 90,  w: 180, h: 20 },
    { x: 1700, y: groundY - 60,  w: 140, h: 20 },
    { x: 2100, y: groundY - 110, w: 160, h: 20 },
    { x: 2500, y: groundY - 80,  w: 130, h: 20 },
    { x: 2800, y: groundY - 50,  w: 200, h: 20 },
  ];
  player.y = groundY - player.h;
}
buildWorld();

// ── Word fragments ──
const WORDS = ['가난한 내가', '아름다운 나타샤를 사랑해서', '오늘밤은 푹푹 눈이 나린다'];
let fragments = [];

function initFragments() {
  fragments = tunables.fragments.map((f, i) => ({
    x: f.x,
    y: groundY + f.yOffset,
    word: WORDS[i],
    collected: false,
    bob: i,
  }));
}
initFragments();

// ── Snow accumulation on ground ──
let snowDepth = 0; // grows over time

// ── Background layers (parallax) ──
// Houses silhouettes
const houses = [];
for (let i = 0; i < 28; i++) {
  houses.push({
    x: i * 120 + Math.random() * 60,
    w: 55 + Math.random() * 45,
    h: 70 + Math.random() * 80,
    layers: Math.floor(Math.random() * 3),
    lit: Math.random() > 0.5,
    litX: Math.random(),
    litY: Math.random(),
    parallax: 0.25 + Math.random() * 0.15,
  });
}

// Trees
const trees = [];
for (let i = 0; i < 40; i++) {
  trees.push({
    x: i * 82 + Math.random() * 40,
    h: 60 + Math.random() * 80,
    spread: 18 + Math.random() * 20,
    parallax: 0.5 + Math.random() * 0.2,
  });
}

// Lamp posts
const lamps = [300, 750, 1200, 1600, 2000, 2450, 2850].map(x => ({ x, glow: Math.random() * Math.PI * 2 }));

// Natasha footprint hints (subtle)
const footprints = [500, 1100, 1800, 2400].map(x => ({ x, alpha: 0 }));

// ── Easing ──
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// ─────────────────────────────────────────
//  DRAW FUNCTIONS
// ─────────────────────────────────────────

function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, groundY + 30);
  grad.addColorStop(0,   '#060d18');
  grad.addColorStop(0.4, '#0d1f35');
  grad.addColorStop(0.75,'#152840');
  grad.addColorStop(1,   '#1a3050');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawStars() {
  // Static starfield based on position (no random per frame)
  ctx.save();
  const offsetX = camX * 0.02;
  for (let i = 0; i < 80; i++) {
    const seed = i * 137.508;
    const sx = ((seed * 93.7 + offsetX) % W + W) % W;
    const sy = ((seed * 51.3) % (groundY * 0.7)) + 20;
    const br = 0.3 + (Math.sin(Date.now() / 1000 + i) * 0.5 + 0.5) * 0.4;
    const r  = i % 5 === 0 ? 1.2 : 0.6;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(210,230,255,${br})`;
    ctx.fill();
  }
  ctx.restore();
}

function drawMoon() {
  const mx = W * 0.78 - camX * 0.02;
  const my = H * 0.13;
  // glow
  const grd = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
  grd.addColorStop(0,   'rgba(200,225,255,0.12)');
  grd.addColorStop(0.4, 'rgba(160,200,255,0.06)');
  grd.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
  // moon disc
  ctx.beginPath();
  ctx.arc(mx, my, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#c8dff5';
  ctx.fill();
  // crescent shadow
  ctx.beginPath();
  ctx.arc(mx + 7, my - 2, 24, 0, Math.PI * 2);
  ctx.fillStyle = '#0d1f35';
  ctx.fill();
}

function drawDistantMountains() {
  ctx.save();
  ctx.translate(-camX * 0.08, 0);
  // far mountains
  ctx.beginPath();
  ctx.moveTo(0, groundY + 20);
  const mpts = [
    [100,groundY-60],[250,groundY-110],[420,groundY-70],
    [600,groundY-140],[800,groundY-90],[1000,groundY-160],
    [1200,groundY-80],[1400,groundY-120],[1600,groundY-60],
    [1800,groundY-100],[2000,groundY-140],[2200,groundY-80],
    [2400,groundY-110],[2600,groundY-60],[2800,groundY-90],
    [3000,groundY-120],[3200,groundY-60],[3200,groundY+20],
  ];
  mpts.forEach(([px,py]) => ctx.lineTo(px,py));
  ctx.closePath();
  ctx.fillStyle = '#0d1e30';
  ctx.fill();
  ctx.restore();
}

function drawBuildings() {
  ctx.save();
  houses.forEach(h => {
    ctx.translate(-camX * h.parallax, 0);
    const bx = h.x;
    const by = groundY - h.h;
    // building body
    ctx.fillStyle = '#0a1520';
    ctx.fillRect(bx, by, h.w, h.h + 5);
    // roof
    ctx.beginPath();
    ctx.moveTo(bx - 4, by);
    ctx.lineTo(bx + h.w / 2, by - 22);
    ctx.lineTo(bx + h.w + 4, by);
    ctx.closePath();
    ctx.fillStyle = '#08121c';
    ctx.fill();
    // snow on roof
    ctx.beginPath();
    ctx.moveTo(bx - 2, by);
    ctx.lineTo(bx + h.w / 2, by - 20 + snowDepth * 0.05);
    ctx.lineTo(bx + h.w + 2, by);
    ctx.closePath();
    ctx.fillStyle = `rgba(200,220,240,${0.5 + snowDepth * 0.003})`;
    ctx.fill();
    // window lights
    if (h.lit) {
      const wx = bx + h.w * h.litX * 0.7 + 4;
      const wy = by + h.h * 0.3 + h.litY * h.h * 0.4;
      const flicker = 0.7 + Math.sin(Date.now() / 600 + h.litX * 10) * 0.08;
      const glw = ctx.createRadialGradient(wx+4, wy+4, 0, wx+4, wy+4, 22);
      glw.addColorStop(0, `rgba(240,180,80,${0.35 * flicker})`);
      glw.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glw;
      ctx.fillRect(wx - 14, wy - 14, 36, 36);
      ctx.fillStyle = `rgba(255,210,120,${0.85 * flicker})`;
      ctx.fillRect(wx, wy, 8, 9);
    }
    ctx.translate(camX * h.parallax, 0);
  });
  ctx.restore();
}

function drawTrees() {
  ctx.save();
  trees.forEach(t => {
    ctx.translate(-camX * t.parallax, 0);
    const tx = t.x;
    const ty = groundY;
    // trunk
    ctx.strokeStyle = 'rgba(40,55,70,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx, ty - t.h * 0.35);
    ctx.stroke();
    // pine layers (snowy)
    for (let layer = 0; layer < 4; layer++) {
      const ly = ty - t.h * 0.25 - layer * t.h * 0.2;
      const lw = t.spread * (1 - layer * 0.2);
      ctx.beginPath();
      ctx.moveTo(tx - lw, ly);
      ctx.lineTo(tx, ly - t.h * 0.22);
      ctx.lineTo(tx + lw, ly);
      ctx.closePath();
      ctx.fillStyle = `rgba(18,35,50,0.9)`;
      ctx.fill();
      // snow on pine
      ctx.beginPath();
      ctx.moveTo(tx - lw + 2, ly);
      ctx.lineTo(tx, ly - t.h * 0.2);
      ctx.lineTo(tx + lw - 2, ly);
      ctx.fillStyle = `rgba(195,215,235,0.55)`;
      ctx.fill();
    }
    ctx.translate(camX * t.parallax, 0);
  });
  ctx.restore();
}

function drawLamps() {
  lamps.forEach(l => {
    const lx = l.x - camX;
    const ly = groundY;
    l.glow += 0.015;
    const flicker = 0.8 + Math.sin(l.glow) * 0.1;
    // post
    ctx.strokeStyle = 'rgba(80,100,120,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx, ly - 100);
    ctx.lineTo(lx + 18, ly - 100);
    ctx.stroke();
    // lamp glow
    const glw = ctx.createRadialGradient(lx + 18, ly - 100, 0, lx + 18, ly - 100, 70);
    glw.addColorStop(0, `rgba(255,200,100,${0.25 * flicker})`);
    glw.addColorStop(0.3, `rgba(240,170,80,${0.12 * flicker})`);
    glw.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glw;
    ctx.fillRect(lx - 52, ly - 170, 140, 140);
    // bulb
    ctx.beginPath();
    ctx.arc(lx + 18, ly - 100, 6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,220,150,${0.9 * flicker})`;
    ctx.fill();
  });
}

function drawGround() {
  // ground base
  const grad = ctx.createLinearGradient(0, groundY, 0, H);
  grad.addColorStop(0, '#c0d8f0');
  grad.addColorStop(0.08, '#a8c8e4');
  grad.addColorStop(1, '#7090b0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, groundY, W, H - groundY);
  // snow surface highlights
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  // undulating snow surface
  for (let px = 0; px <= W; px += 40) {
    const wx = px + camX;
    ctx.lineTo(px, groundY - Math.sin(wx * 0.008) * 4 - Math.cos(wx * 0.015) * 3);
  }
  ctx.lineTo(W, groundY + 4);
  ctx.lineTo(0, groundY + 4);
  ctx.closePath();
  ctx.fillStyle = 'rgba(225,240,255,0.6)';
  ctx.fill();
}

function drawRaisedPlatforms() {
  platforms.slice(1).forEach(p => {
    const px = p.x - camX;
    if (px > W + 50 || px + p.w < -50) return;
    // snow block
    ctx.fillStyle = '#9ab8d4';
    ctx.fillRect(px, p.y + 4, p.w, p.h);
    ctx.fillStyle = '#c8dff0';
    ctx.fillRect(px, p.y, p.w, 5);
    // snow top
    ctx.beginPath();
    ctx.ellipse(px + p.w/2, p.y, p.w/2 + 4, 6, 0, Math.PI, 0);
    ctx.fillStyle = 'rgba(210,230,250,0.7)';
    ctx.fill();
  });
}

function drawFootprints() {
  footprints.forEach(fp => {
    const fx = fp.x - camX;
    if (Math.abs(fx - W / 2) < W * 0.7) {
      fp.alpha = Math.min(fp.alpha + 0.005, 0.35);
    }
    if (fp.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = fp.alpha;
    // small footprint pair
    [-6, 6].forEach((offset, i) => {
      ctx.beginPath();
      ctx.ellipse(fx + offset, groundY - 2, 3, 5, i * 0.2 - 0.1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(160,200,230,0.8)';
      ctx.fill();
    });
    ctx.restore();
  });
}

function drawFragments() {
  const t = Date.now() / 1000;
  fragments.forEach((f, i) => {
    if (f.collected) return;
    const fx = f.x - camX;
    if (fx < -100 || fx > W + 100) return;
    const bob = Math.sin(t * 1.5 + f.bob * 2) * 5;
    const fy = f.y - 20 + bob;
    // glow aura
    const glw = ctx.createRadialGradient(fx, fy, 0, fx, fy, 55);
    glw.addColorStop(0, 'rgba(160,210,255,0.2)');
    glw.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glw;
    ctx.fillRect(fx - 55, fy - 55, 110, 110);
    // crystal shard
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(Math.sin(t * 0.8 + i) * 0.12);
    const pulse = 1 + Math.sin(t * 2 + i) * 0.05;
    ctx.scale(pulse, pulse);
    // outer diamond
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(10, 0); ctx.lineTo(0, 14); ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(180,220,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,210,255,0.15)';
    ctx.fill();
    // inner dot
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,230,255,0.9)';
    ctx.fill();
    ctx.restore();
    // hover: check proximity to player
    const dist = Math.hypot((f.x - player.x), (f.y - player.y + 30));
    if (dist < 70) {
      cursorEl.querySelector('circle').setAttribute('fill', 'rgba(255,200,120,0.8)');
      // word label appears
      ctx.save();
      ctx.globalAlpha = Math.max(0, (70 - dist) / 70);
      // @TUNABLE labelFontSize
      ctx.font = `${tunables.labelFontSize}px "Noto Serif KR", serif`;
      ctx.fillStyle = 'rgba(200,235,255,0.9)';
      ctx.textAlign = 'center';
      // @TUNABLE labelOffsetY
      ctx.fillText(f.word, fx, fy + tunables.labelOffsetY);
      ctx.restore();
    }
  });
}

function drawPlayer() {
  const px = player.x - camX;
  const py = player.y;
  const t = Date.now() / 1000;
  player.breathPhase = t;

  ctx.save();
  ctx.translate(px, py);

  // walking wobble
  let legSwing = 0;
  let armSwing = 0;
  const moving = Math.abs(player.vx) > 0.5;
  if (moving) {
    player.walkTimer += 0.12;
    legSwing = Math.sin(player.walkTimer) * 12;
    armSwing = Math.cos(player.walkTimer) * 8;
  }

  const flip = player.dir < 0 ? -1 : 1;
  ctx.scale(flip, 1);

  // shadow
  ctx.save();
  ctx.scale(1, 0.3);
  ctx.beginPath();
  ctx.ellipse(0, player.h + 10, 14, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();
  ctx.restore();

  // legs
  const legY = player.h * 0.62;
  ctx.strokeStyle = '#2a4a6a';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  // left leg
  ctx.beginPath();
  ctx.moveTo(-4, legY);
  ctx.lineTo(-6 - legSwing * 0.3, player.h);
  ctx.stroke();
  // right leg
  ctx.beginPath();
  ctx.moveTo(4, legY);
  ctx.lineTo(6 + legSwing * 0.3, player.h);
  ctx.stroke();

  // coat body
  ctx.beginPath();
  ctx.roundRect(-10, player.h * 0.3, 20, player.h * 0.4, 4);
  ctx.fillStyle = '#1a3555';
  ctx.fill();
  ctx.strokeStyle = '#2a4a72';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // arms
  ctx.strokeStyle = '#1a3555';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  // left arm
  ctx.beginPath();
  ctx.moveTo(-9, player.h * 0.35);
  ctx.lineTo(-16 - armSwing * 0.4, player.h * 0.55);
  ctx.stroke();
  // right arm (slightly raised, holding something imaginary)
  ctx.beginPath();
  ctx.moveTo(9, player.h * 0.35);
  ctx.lineTo(16 + armSwing * 0.4, player.h * 0.5);
  ctx.stroke();

  // head + face
  const breathY = Math.sin(player.breathPhase * 1.5) * 0.5;
  const headY = player.h * 0.15 + breathY;
  ctx.beginPath();
  ctx.arc(0, headY, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#d4b896';
  ctx.fill();

  // hair
  ctx.beginPath();
  ctx.arc(0, headY - 2, 9, Math.PI, 0);
  ctx.fillStyle = '#2a1a0a';
  ctx.fill();

  // scarf
  ctx.beginPath();
  ctx.arc(0, headY + 7, 6, -0.3, Math.PI + 0.3);
  ctx.strokeStyle = '#8a3030';
  ctx.lineWidth = 3;
  ctx.stroke();

  // breath cloud (cold air)
  if (!moving) {
    const breathAlpha = (Math.sin(t * 1.5) * 0.5 + 0.5) * 0.35;
    ctx.beginPath();
    ctx.arc(12, headY, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,235,250,${breathAlpha})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(18, headY - 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,235,250,${breathAlpha * 0.6})`;
    ctx.fill();
  }

  ctx.restore();
}

// ─────────────────────────────────────────
//  PHYSICS & COLLISION
//  (constants defined in `tunables` block above)
// ─────────────────────────────────────────

function updatePlayer() {
  if (!gameStarted || gameOver) return;

  // input
  const left  = keys['ArrowLeft']  || keys['a'] || keys['A'];
  const right = keys['ArrowRight'] || keys['d'] || keys['D'];
  const jump  = keys['ArrowUp']    || keys['w'] || keys['W'] || keys[' '];

  if (left)  { player.vx = -tunables.moveSpeed; player.dir = -1; }
  if (right) { player.vx =  tunables.moveSpeed; player.dir =  1; }
  if (!left && !right) player.vx *= 0.7;

  if (jump && player.onGround) {
    player.vy = tunables.jumpForce;
    player.onGround = false;
  }

  player.vy += tunables.gravity;
  player.x  += player.vx;
  player.y  += player.vy;

  // clamp world bounds
  if (player.x < 80) player.x = 80;
  if (player.x > WORLD_W - 80) player.x = WORLD_W - 80;

  // platform collision
  player.onGround = false;
  platforms.forEach(p => {
    const pr = player.x, pb = player.y + player.h;
    const prevB = pb - player.vy;
    if (pr + 10 > p.x && pr - 10 < p.x + p.w) {
      if (prevB <= p.y && pb >= p.y && player.vy >= 0) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
      }
    }
  });

  // check fragment collection
  fragments.forEach((f, i) => {
    if (f.collected) return;
    const dist = Math.hypot(player.x - f.x, player.y + player.h/2 - f.y + 10);
    if (dist < 45) {
      f.collected = true;
      collectedCount++;
      collectFragment(i, f.word);
    }
  });

  // camera follow (smooth)
  const targetCam = player.x - W / 3;
  camX += (targetCam - camX) * 0.06;
  camX = Math.max(0, Math.min(camX, WORLD_W - W));
}

// ─────────────────────────────────────────
//  COLLECTION EFFECTS
// ─────────────────────────────────────────
function collectFragment(i, word) {
  // update HUD dots
  document.getElementById('s1dot' + i).classList.add('collected');
  // update poem lines
  const lineEl = document.getElementById('s1line' + (i + 1));
  if (lineEl) lineEl.classList.add('collected');
  // show word popup
  const popup = document.getElementById('word-popup');
  popup.textContent = word;
  const fx = (fragments[i].x - camX);
  const fy = fragments[i].y;
  // 화면 가장자리에 너무 붙으면 잘릴 수 있어 클램프 (translateX(-50%)로 중앙정렬됨)
  const margin = 220;
  const clampedX = Math.max(margin, Math.min(fx, W - margin));
  popup.style.left = clampedX + 'px';
  popup.style.top  = fy + 'px';
  // @TUNABLE popupFontSize
  popup.style.fontSize = tunables.popupFontSize + 'px';
  popup.classList.add('show');
  // @TUNABLE popupFadeMs
  setTimeout(() => popup.classList.remove('show'), tunables.popupFadeMs);
  // check complete
  if (collectedCount >= TOTAL_FRAGMENTS) {
    setTimeout(showStageClear, 1500);
  }
}

function showStageClear() {
  gameOver = true;
  document.getElementById('s1stage_clear').classList.add('show');
  setTimeout(() => { if(window.onStageClear) window.onStageClear(1); }, 3000);
}

// ─────────────────────────────────────────
//  SNOWDEPTH PROGRESS
// ─────────────────────────────────────────
let lastTime = 0;
function updateSnowDepth(dt) {
  snowDepth = Math.min(snowDepth + dt * 2, 100);
}

// ─────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────
let _running = false;
function gameLoop(ts) {
  if (!_running) return;
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  ctx.clearRect(0, 0, W, H);
  updatePlayer();
  updateSnowDepth(dt);

  // Draw layers
  drawSky();
  drawStars();
  drawMoon();
  drawDistantMountains();
  drawBuildings();
  drawTrees();
  drawLamps();
  drawGround();
  drawFootprints();
  drawRaisedPlatforms();
  drawFragments();
  drawPlayer();

  requestAnimationFrame(gameLoop);
}

// ─────────────────────────────────────────
//  START / RESTART
// ─────────────────────────────────────────
function resetStateS1() {
  resize();
  buildWorld();
  initFragments();
  // reset player position (uses tunables)
  player.x = tunables.playerStartX;
  player.y = groundY + tunables.playerStartY;
  player.vx = 0; player.vy = 0;
  player.dir = 1;
  player.onGround = false;
  // reset progress
  collectedCount = 0;
  gameOver = false;
  camX = 0;
  snowDepth = 0;
  // clear DOM state
  for (let i = 0; i < 3; i++) {
    document.getElementById('s1dot' + i)?.classList.remove('collected');
    document.getElementById('s1line' + (i + 1))?.classList.remove('collected');
  }
  document.getElementById('s1stage_clear')?.classList.remove('show');
}
function gameStartS1() {
  gameStarted = true;
  resetStateS1();
  if (!_running) {
    _running = true;
    requestAnimationFrame(gameLoop);
  }
}

// ─────────────────────────────────────────
//  ADMIN API
// ─────────────────────────────────────────
(window as any).s1API = {
  tunables,
  schema: {
    playerStartX:   { min: 0,    max: 3000, step: 10,  label: '캐릭터 시작 X' },
    playerStartY:   { min: -200, max: 0,    step: 1,   label: '캐릭터 시작 Y (groundY 기준)' },
    jumpForce:      { min: -20,  max: -3,   step: 0.5, label: '점프 힘' },
    moveSpeed:      { min: 0.5,  max: 8,    step: 0.1, label: '이동 속도' },
    gravity:        { min: 0.1,  max: 1.5,  step: 0.05,label: '중력' },
    labelOffsetY:   { min: -80,  max: 0,    step: 1,   label: '다이아 라벨 Y 오프셋' },
    labelFontSize:  { min: 8,    max: 32,   step: 1,   label: '다이아 라벨 폰트 크기' },
    popupFontSize:  { min: 10,   max: 48,   step: 1,   label: '수집 팝업 폰트 크기' },
    popupFadeMs:    { min: 200,  max: 5000, step: 100, label: '수집 팝업 표시 시간(ms)' },
  },
  fragmentSchema: { xMin: 0, xMax: 3200, yOffsetMin: -400, yOffsetMax: 0 },
  setTunable(key: string, value: number) {
    (tunables as any)[key] = value;
  },
  setFragment(idx: number, x: number, yOffset: number) {
    if (tunables.fragments[idx]) {
      tunables.fragments[idx].x = x;
      tunables.fragments[idx].yOffset = yOffset;
      // re-init fragments to apply
      initFragments();
    }
  },
  restart: gameStartS1,
};

// ─────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────
window.gameStartS1 = gameStartS1;
window.initStage1 = function() { resize(); buildWorld(); initFragments(); };


}
