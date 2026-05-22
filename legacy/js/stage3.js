(function() {
// ─── CURSOR ───
const cursorEl = document.getElementById('s3cursor');
let mx=0, my=0;
document.addEventListener('mousemove', e => { mx=e.clientX; my=e.clientY; cursorEl.style.left=mx+'px'; cursorEl.style.top=my+'px'; });

// ─── CANVAS ───
const gc = document.getElementById('s3game_canvas');
const ctx = gc.getContext('2d');
let W=0, H=0;
function resize() { W=gc.width=window.innerWidth; H=gc.height=window.innerHeight; buildWorld(); }
window.addEventListener('resize', resize);

// ─── WORLD ───
// 3 sections: town exit → mountain path → mountain pass summit
const WORLD_W = 4200;
let groundY = 0;
let platforms = [];
let interactables = [];
let fragments = [];
let cityLights = []; // city receding behind

function buildWorld() {
  groundY = H * 0.70;

  // The terrain rises gently — we simulate an uphill by
  // placing the "ground" platform in rising segments
  platforms = [
    // flat start (town exit)
    { x:-200,  y:groundY,       w:900,  h:H },
    // first rise
    { x:700,   y:groundY-55,    w:600,  h:H },
    // second rise
    { x:1300,  y:groundY-130,   w:700,  h:H },
    // plateau
    { x:2000,  y:groundY-195,   w:500,  h:H },
    // final rise (summit)
    { x:2500,  y:groundY-270,   w:800,  h:H },
    // summit flat
    { x:3300,  y:groundY-310,   w:1100, h:H },
    // mid-slope boulders (stepping stones)
    { x:820,   y:groundY-100,   w:90,   h:18 },
    { x:1000,  y:groundY-160,   w:80,   h:18 },
    { x:1150,  y:groundY-185,   w:90,   h:18 },
    { x:1700,  y:groundY-255,   w:100,  h:18 },
    { x:1870,  y:groundY-280,   w:80,   h:18 },
    { x:2200,  y:groundY-330,   w:110,  h:18 },
    { x:2380,  y:groundY-360,   w:90,   h:18 },
  ];

  fragments = [
    { id:0, x:480,  y:groundY-60,    collected:false, bob:0   },
    { id:1, x:1080, y:groundY-230,   collected:false, bob:1.3 },
    { id:2, x:1900, y:groundY-360,   collected:false, bob:2.6 },
    { id:3, x:2600, y:groundY-440,   collected:false, bob:0.7 },
    { id:4, x:3500, y:groundY-460,   collected:false, bob:1.8 },
  ];

  interactables = [
    { x:350,  y:groundY-20, w:40, h:40, label:'마을을 돌아보며',
      text:'멀어지는 불빛들.\n세상이 작아진다.\n작아지는 게 맞다.' },
    { x:1600, y:groundY-210, w:50, h:40, label:'이정표',
      text:'산골 ↑ 12리\n마을 ↓ 8리\n당나귀 발자국이 남아있다.' },
    { x:3100, y:groundY-400, w:50, h:40, label:'고개마루',
      text:'여기서부터는\n세상이 보이지 않는다.\n이제 진짜 떠난 것이다.' },
  ];

  // donkey initial position
  donkey.x = 900; donkey.y = groundY - 55 - donkey.h;

  // city lights array (behind, parallax)
  cityLights = [];
  for (let i=0; i<35; i++) {
    cityLights.push({
      x: -(i*85+30), y: groundY - 40 - Math.random()*120,
      w: 40+Math.random()*50, h: 50+Math.random()*80,
      lit: Math.random()>0.4,
      seed: Math.random()*10,
    });
  }
}

// ─── PLAYER ───
const player = {
  x:120, y:0, vx:0, vy:0,
  w:20, h:46,
  onGround:false, dir:1,
  walkT:0, breathT:0,
  mounted:false,
};

// ─── DONKEY ───
const donkey = {
  x:900, y:0, vx:0, vy:0,
  w:72, h:52,
  onGround:false, dir:1,
  walkT:0, found:false, // found = player has approached once
  earsUp:false, earTimer:0,
  tailWag:0,
};

// ─── KEYS ───
const keys={};
document.addEventListener('keydown', e=>{ keys[e.key]=true; keys[e.code]=true; });
document.addEventListener('keyup',   e=>{ keys[e.key]=false; keys[e.code]=false; });

// ─── GAME STATE ───
let gameStarted=false, gameOver=false;
let collected=0;
const TOTAL=5;
let camX=0;
const FRAG_WORDS=['산골로 가는 것은','세상한테 지는 것이 아니다','세상 같은 건','더러워','버리는 것이다'];
const FRAG_LINES=[[0],[1],[0],[1],[]];

// ─── MOUNT SYSTEM ───
let nearDonkey = false;
let mountHintTimer = null;

function checkNearDonkey() {
  const dist = Math.hypot(player.x - (donkey.x + donkey.w/2), player.y + player.h - (donkey.y + donkey.h/2));
  nearDonkey = dist < 90 && !player.mounted;
  const hint = document.getElementById('s3mount_hint');
  if (nearDonkey) hint.classList.add('show');
  else hint.classList.remove('show');
}

document.addEventListener('keydown', e => {
  if ((e.key==='r'||e.key==='R') && gameStarted && !gameOver) {
    if (nearDonkey && !player.mounted) mount();
    else if (player.mounted) dismount();
  }
  if ((e.key==='e'||e.key==='E') && gameStarted && !gameOver) {
    const near = interactables.find(ob => Math.abs(player.x-(ob.x+ob.w/2))<75 && Math.abs((player.y+player.h)-ob.y)<90);
    if (near) showThought(near.text, near.x, near.y-20);
  }
});

function mount() {
  player.mounted = true;
  document.getElementById('s3mount_hint').classList.remove('show');
  document.getElementById('s3mounted_indicator').classList.add('show');
  donkey.earsUp = true;
  donkey.earTimer = 0;
}
function dismount() {
  player.mounted = false;
  document.getElementById('s3mounted_indicator').classList.remove('show');
  player.x = donkey.x + donkey.w + 10;
  player.y = donkey.y;
}

// ─── THOUGHT ───
const thoughtEl = document.getElementById('s3thought');
let thoughtTimer = null;
function showThought(text, wx, wy) {
  thoughtEl.innerHTML = text.replace(/\n/g,'<br>');
  const sx = wx - camX;
  const sy = wy;
  thoughtEl.style.left = Math.min(sx+10, W-250)+'px';
  thoughtEl.style.top  = Math.max(sy-110, 80)+'px';
  thoughtEl.classList.add('show');
  clearTimeout(thoughtTimer);
  thoughtTimer = setTimeout(()=>thoughtEl.classList.remove('show'), 3500);
}

// ─── PHYSICS ───
const GRAV=0.44;
const P_SPEED=3.0, P_JUMP=-10.5;
const D_SPEED=4.8, D_JUMP=-11.5; // donkey faster

function getGroundAt(x) {
  // find which terrain platform is under x
  let highestY = groundY + H; // fallback deep
  platforms.forEach(p => {
    if (x > p.x && x < p.x + p.w) {
      if (p.y < highestY) highestY = p.y;
    }
  });
  return highestY;
}

function resolveEntity(ent, speed, jumpForce) {
  ent.vy += GRAV;
  ent.x  += ent.vx;
  ent.y  += ent.vy;
  // world bounds
  ent.x = Math.max(40, Math.min(ent.x, WORLD_W - 40));
  // platform collision
  ent.onGround = false;
  platforms.forEach(p => {
    const eb = ent.y + ent.h;
    const prevEb = eb - ent.vy;
    if (ent.x + ent.w*0.4 > p.x && ent.x + ent.w*0.6 < p.x + p.w) {
      if (prevEb <= p.y + 2 && eb >= p.y && ent.vy >= 0) {
        ent.y = p.y - ent.h; ent.vy = 0; ent.onGround = true;
      }
    }
  });
}

function updateEntities() {
  if (!gameStarted || gameOver) return;
  const t = Date.now()/1000;

  const L = keys['ArrowLeft']||keys['KeyA'];
  const R = keys['ArrowRight']||keys['KeyD'];
  const J = keys['ArrowUp']||keys['KeyW']||keys[' '];

  if (player.mounted) {
    // player controls donkey
    if (L) { donkey.vx=-D_SPEED; donkey.dir=-1; }
    if (R) { donkey.vx= D_SPEED; donkey.dir= 1; }
    if (!L&&!R) donkey.vx*=0.6;
    if (J && donkey.onGround) { donkey.vy=D_JUMP; donkey.onGround=false; }
    resolveEntity(donkey, D_SPEED, D_JUMP);
    // player rides on donkey
    player.x = donkey.x + donkey.w/2 - player.w/2;
    player.y = donkey.y - player.h + 6;
    player.vx = donkey.vx; player.vy = donkey.vy;
    player.onGround = donkey.onGround;
    player.dir = donkey.dir;
    if (Math.abs(donkey.vx)>0.4) donkey.walkT += 0.09;
    donkey.tailWag = Math.sin(t*3)*12;
  } else {
    // player moves independently
    if (L) { player.vx=-P_SPEED; player.dir=-1; }
    if (R) { player.vx= P_SPEED; player.dir= 1; }
    if (!L&&!R) player.vx*=0.65;
    if (J && player.onGround) { player.vy=P_JUMP; player.onGround=false; }
    resolveEntity(player, P_SPEED, P_JUMP);
    if (Math.abs(player.vx)>0.3) player.walkT+=0.11;
    // donkey AI: follow player gently when found
    if (donkey.found) {
      const ddist = player.x - (donkey.x + donkey.w/2);
      if (Math.abs(ddist) > 180) {
        donkey.vx += (ddist > 0 ? 0.12 : -0.12);
        donkey.vx = Math.max(-2.5, Math.min(2.5, donkey.vx));
        donkey.dir = ddist > 0 ? 1 : -1;
      } else {
        donkey.vx *= 0.8;
      }
      resolveEntity(donkey, D_SPEED, D_JUMP);
      if (Math.abs(donkey.vx)>0.3) donkey.walkT+=0.07;
      donkey.tailWag = Math.sin(t*2)*8;
    }
    checkNearDonkey();
    // first approach → donkey found
    if (!donkey.found && Math.hypot(player.x-donkey.x, player.y-donkey.y) < 200) {
      donkey.found = true;
      donkey.earsUp = true;
    }
  }

  player.breathT += 0.015;
  if (donkey.earsUp) { donkey.earTimer += 0.04; if (donkey.earTimer > 1) donkey.earsUp = false; }

  // camera
  const anchor = player.mounted ? donkey.x : player.x;
  const targetCam = anchor - W*0.35;
  camX += (targetCam - camX) * 0.07;
  camX = Math.max(0, Math.min(camX, WORLD_W - W));

  // fragment collection
  fragments.forEach(f => {
    if (f.collected) return;
    const cx = player.mounted ? donkey.x+donkey.w/2 : player.x;
    const cy = player.mounted ? donkey.y+donkey.h/2 : player.y+player.h/2;
    const range = player.mounted ? 70 : 44;
    if (Math.hypot(cx-f.x, cy-f.y) < range) collectFrag(f);
  });

  // cursor interact hint
  const nearObj = interactables.find(ob=>Math.abs(player.x-(ob.x+ob.w/2))<75&&Math.abs((player.y+player.h)-ob.y)<90);
  cursorEl.classList.toggle('interact', !!nearObj || nearDonkey);
}

function collectFrag(f) {
  f.collected=true; collected++;
  document.getElementById('s3d'+f.id).classList.add('lit');
  (FRAG_LINES[f.id]||[]).forEach(li=>{
    const el=document.getElementById('s3l'+li);
    if(el) el.classList.add('lit');
  });
  const fl=document.getElementById('s3word_flash');
  fl.textContent=FRAG_WORDS[f.id];
  fl.style.left=(f.x-camX)+'px'; fl.style.top=(f.y-30)+'px';
  fl.classList.add('show');
  setTimeout(()=>fl.classList.remove('show'),1100);
  if(collected>=TOTAL) setTimeout(showClear,1800);
}

function showClear() {
  gameOver=true;
  document.getElementById('s3stage_clear').classList.add('show');
  setTimeout(() => { if(window.onStageClear) window.onStageClear(3); }, 3000);
}

// ─── DRAWING ───

function drawSky() {
  // Sky gradient — gets slightly lighter / more violet at top of hill
  const elevation = Math.min(camX / WORLD_W, 1);
  const skyTop = lerpColor([5,8,16],[10,12,25], elevation);
  const skyBot = lerpColor([12,22,40],[20,30,50], elevation);
  const sg = ctx.createLinearGradient(0,0,0,groundY);
  sg.addColorStop(0, `rgb(${skyTop})`);
  sg.addColorStop(1, `rgb(${skyBot})`);
  ctx.fillStyle=sg; ctx.fillRect(0,0,W,H);
}

function lerpColor(a,b,t) { return a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(','); }

function drawStars() {
  const elev = Math.min(camX/WORLD_W,1);
  // more stars visible higher up
  const count = Math.floor(60 + elev*50);
  for(let i=0;i<count;i++){
    const seed=i*137.5;
    const ox=camX*0.012;
    const sx=((seed*93+ox)%W+W)%W;
    const sy=(seed*47)%(groundY*0.68)+10;
    const br=0.2+(Math.sin(Date.now()/1000+i)*0.5+0.5)*0.5;
    ctx.beginPath(); ctx.arc(sx,sy,i%5?0.5:1,0,Math.PI*2);
    ctx.fillStyle=`rgba(215,225,255,${br})`; ctx.fill();
  }
}

function drawMoon() {
  const mmx=W*0.8-camX*0.008, mmy=H*0.1;
  const mg=ctx.createRadialGradient(mmx,mmy,0,mmx,mmy,80);
  mg.addColorStop(0,'rgba(200,220,255,0.1)'); mg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=mg; ctx.fillRect(0,0,W,H);
  ctx.beginPath(); ctx.arc(mmx,mmy,24,0,Math.PI*2); ctx.fillStyle='#c0d8f0'; ctx.fill();
  ctx.beginPath(); ctx.arc(mmx+5,mmy-2,20,0,Math.PI*2); ctx.fillStyle='#0a1428'; ctx.fill();
}

function drawCityReceding() {
  // city behind (parallax negative x) fades out as player moves up
  const elev = Math.min(camX/1500,1);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1-elev*0.9);
  ctx.translate(-camX*0.08,0);
  cityLights.forEach(b=>{
    const bx=b.x+3000; // offset so they appear behind start
    ctx.fillStyle='rgba(8,14,24,0.9)';
    ctx.fillRect(bx,b.y,b.w,b.h+4);
    if(b.lit){
      const fl=0.65+Math.sin(Date.now()/700+b.seed)*0.12;
      const wg=ctx.createRadialGradient(bx+8,b.y+12,0,bx+8,b.y+12,22);
      wg.addColorStop(0,`rgba(250,190,80,${0.32*fl})`); wg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=wg; ctx.fillRect(bx-8,b.y-8,32,32);
      ctx.fillStyle=`rgba(255,205,110,${0.8*fl})`; ctx.fillRect(bx+4,b.y+8,9,11);
    }
  });
  ctx.restore();
}

function drawFarMountains() {
  ctx.save(); ctx.translate(-camX*0.06,0);
  ctx.beginPath(); ctx.moveTo(-100,groundY+10);
  const pts=[
    [0,groundY-30],[200,groundY-90],[500,groundY-50],[800,groundY-160],
    [1200,groundY-100],[1600,groundY-220],[2000,groundY-140],[2400,groundY-200],
    [2800,groundY-100],[3200,groundY-180],[3600,groundY-80],[4000,groundY-130],
    [4200,groundY+10],
  ];
  pts.forEach(([px,py])=>ctx.lineTo(px,py));
  ctx.closePath();
  ctx.fillStyle='#080f1c'; ctx.fill();
  ctx.restore();
}

function drawMidMountains() {
  ctx.save(); ctx.translate(-camX*0.22,0);
  // pine forest silhouette
  for(let i=0;i<60;i++){
    const tx=i*72+((i*37)%40); const th=60+((i*53)%70); const ts=16+((i*29)%14);
    const ty=groundY+20;
    // trunk
    ctx.strokeStyle='rgba(20,32,18,0.8)'; ctx.lineWidth=2.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx,ty-th*0.35); ctx.stroke();
    for(let l=0;l<4;l++){
      const ly=ty-th*0.2-l*th*0.2; const lw=ts*(1.1-l*0.22);
      ctx.beginPath(); ctx.moveTo(tx-lw,ly); ctx.lineTo(tx,ly-th*0.2); ctx.lineTo(tx+lw,ly); ctx.closePath();
      ctx.fillStyle=`rgba(12,24,14,${0.85+l*0.04})`; ctx.fill();
      // snow on branches
      ctx.beginPath(); ctx.moveTo(tx-lw+3,ly); ctx.lineTo(tx,ly-th*0.17); ctx.lineTo(tx+lw-3,ly); ctx.closePath();
      ctx.fillStyle='rgba(175,205,230,0.45)'; ctx.fill();
    }
  }
  ctx.restore();
}

function drawTerrain() {
  // draw each terrain segment as a snow-covered slope
  const terrainSegs = [
    { x:-200,  y:groundY,       w:900  },
    { x:700,   y:groundY-55,    w:600  },
    { x:1300,  y:groundY-130,   w:700  },
    { x:2000,  y:groundY-195,   w:500  },
    { x:2500,  y:groundY-270,   w:800  },
    { x:3300,  y:groundY-310,   w:1100 },
  ];

  // fill ground all the way down
  terrainSegs.forEach((s,i) => {
    const sx=s.x-camX;
    // slope connection to next
    const next=terrainSegs[i+1];
    if(next){
      // draw trapezoid connecting this seg to next
      ctx.beginPath();
      ctx.moveTo(sx+s.w, s.y);
      ctx.lineTo(next.x-camX, next.y);
      ctx.lineTo(next.x-camX, H);
      ctx.lineTo(sx+s.w, H);
      ctx.closePath();
      const sg=ctx.createLinearGradient(0,s.y,0,H);
      sg.addColorStop(0,'#9ab8d4'); sg.addColorStop(0.15,'#7a9ab8'); sg.addColorStop(1,'#3a5878');
      ctx.fillStyle=sg; ctx.fill();
      // slope snow top line
      ctx.beginPath();
      ctx.moveTo(sx+s.w-2, s.y);
      ctx.lineTo(next.x-camX+2, next.y);
      ctx.strokeStyle='rgba(210,232,252,0.55)'; ctx.lineWidth=3; ctx.stroke();
    }
    // main flat segment
    ctx.beginPath();
    ctx.moveTo(sx, s.y);
    ctx.lineTo(sx+s.w, s.y);
    ctx.lineTo(sx+s.w, H);
    ctx.lineTo(sx, H);
    ctx.closePath();
    const gg=ctx.createLinearGradient(0,s.y,0,H);
    gg.addColorStop(0,'#b0cce4'); gg.addColorStop(0.1,'#92aec8'); gg.addColorStop(1,'#4a6888');
    ctx.fillStyle=gg; ctx.fill();
    // snow surface
    ctx.beginPath();
    ctx.moveTo(sx,s.y);
    for(let px=0;px<=s.w;px+=30){
      ctx.lineTo(sx+px, s.y - Math.sin((sx+px+camX)*0.012)*3 - Math.cos((sx+px+camX)*0.02)*2);
    }
    ctx.lineTo(sx+s.w,s.y+4); ctx.lineTo(sx,s.y+4); ctx.closePath();
    ctx.fillStyle='rgba(220,238,255,0.5)'; ctx.fill();
  });

  // boulder platforms
  platforms.slice(6).forEach(p=>{
    const px=p.x-camX; if(px>W+40||px+p.w<-40) return;
    // draw rock/snow boulder
    ctx.fillStyle='#6a88a4';
    ctx.beginPath(); ctx.ellipse(px+p.w/2,p.y+p.h/2+4, p.w/2+4, p.h+2,0,0,Math.PI*2); ctx.fill();
    // snow cap
    ctx.fillStyle='rgba(200,222,244,0.7)';
    ctx.beginPath(); ctx.ellipse(px+p.w/2,p.y, p.w/2+2, 7,0,Math.PI,0); ctx.fill();
  });
}

function drawInteractables() {
  interactables.forEach(ob=>{
    const ox=ob.x-camX;
    const dist=Math.abs(player.x-(ob.x+ob.w/2));
    if(dist<90){
      ctx.font='11px "Noto Sans KR",sans-serif';
      ctx.fillStyle=`rgba(200,235,150,${Math.max(0,(90-dist)/90)*0.7})`;
      ctx.textAlign='center';
      ctx.fillText('[ E ] '+ob.label, ox+ob.w/2, ob.y-16);
    }
  });
  // inanimate signpost at x=1600
  const spx=1600-camX;
  ctx.fillStyle='rgba(55,40,20,0.8)'; ctx.fillRect(spx+20,groundY-310,6,120);
  ctx.fillStyle='rgba(70,50,25,0.9)'; ctx.fillRect(spx,groundY-310,46,22);
  ctx.fillStyle='rgba(70,50,25,0.9)'; ctx.fillRect(spx+5,groundY-334,36,22);
  ctx.font='10px "Noto Serif KR",serif'; ctx.fillStyle='rgba(220,200,150,0.8)'; ctx.textAlign='center';
  ctx.fillText('산골 ↑',spx+23,groundY-295);
  ctx.fillText('마을 ↓',spx+23,groundY-318);
}

function drawFragments() {
  const t=Date.now()/1000;
  fragments.forEach(f=>{
    if(f.collected) return;
    const fx=f.x-camX; if(fx<-80||fx>W+80) return;
    const by=Math.sin(t*1.3+f.bob)*5;
    const fy=f.y-18+by;
    // soft green glow (forest energy)
    const glw=ctx.createRadialGradient(fx,fy,0,fx,fy,52);
    glw.addColorStop(0,'rgba(140,220,100,0.2)'); glw.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glw; ctx.fillRect(fx-52,fy-52,104,104);
    // crystal
    ctx.save(); ctx.translate(fx,fy); ctx.rotate(Math.sin(t*0.65+f.bob)*0.12);
    const sc=1+Math.sin(t*1.7+f.bob)*0.045; ctx.scale(sc,sc);
    ctx.beginPath(); ctx.moveTo(0,-13); ctx.lineTo(9,0); ctx.lineTo(0,13); ctx.lineTo(-9,0); ctx.closePath();
    ctx.fillStyle='rgba(150,235,110,0.16)'; ctx.fill();
    ctx.strokeStyle='rgba(170,235,120,0.65)'; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fillStyle='rgba(200,245,160,0.9)'; ctx.fill();
    ctx.restore();
    // label proximity
    const dist=Math.hypot((player.mounted?donkey.x+donkey.w/2:player.x)-f.x, (player.mounted?donkey.y+donkey.h/2:player.y+player.h/2)-f.y);
    if(dist<75){
      ctx.save(); ctx.globalAlpha=Math.max(0,(75-dist)/75);
      ctx.font='13px "Noto Serif KR",serif'; ctx.fillStyle='rgba(210,240,170,0.9)'; ctx.textAlign='center';
      ctx.fillText(FRAG_WORDS[f.id],fx,fy-24); ctx.restore();
    }
  });
}

// ─── DONKEY DRAW ───
function drawDonkey() {
  const t=Date.now()/1000;
  const dx=donkey.x-camX, dy=donkey.y;
  if(dx<-120||dx>W+120) return;

  ctx.save(); ctx.translate(dx,dy);
  const flip=donkey.dir<0?-1:1;
  ctx.scale(flip,1);

  const moving=Math.abs(donkey.vx)>0.3;

  // shadow
  ctx.save(); ctx.scale(1,0.25);
  ctx.beginPath(); ctx.ellipse(donkey.w/2,donkey.h+14,donkey.w/2+4,8,0,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fill(); ctx.restore();

  // legs (4 legs)
  const legSw = moving ? Math.sin(donkey.walkT)*14 : 0;
  ctx.strokeStyle='#d0c8b8'; ctx.lineWidth=5; ctx.lineCap='round';
  const legY=donkey.h*0.72;
  [[14,-1],[24,1],[44,-1],[56,1]].forEach(([lx,phase],i)=>{
    const sw=legSw*phase*(i<2?1:-1);
    ctx.beginPath(); ctx.moveTo(lx,legY); ctx.lineTo(lx+sw*0.4,donkey.h); ctx.stroke();
  });

  // body
  ctx.beginPath();
  ctx.ellipse(donkey.w/2, donkey.h*0.52, donkey.w/2-2, donkey.h*0.28, 0, 0, Math.PI*2);
  ctx.fillStyle='#e8e0d0'; ctx.fill();
  ctx.strokeStyle='#c8c0b0'; ctx.lineWidth=0.5; ctx.stroke();

  // neck + head
  ctx.beginPath();
  ctx.moveTo(donkey.w*0.72, donkey.h*0.3);
  ctx.quadraticCurveTo(donkey.w*0.85, donkey.h*0.1, donkey.w*0.88, donkey.h*0.04);
  ctx.strokeStyle='#ddd5c4'; ctx.lineWidth=11; ctx.lineCap='round'; ctx.stroke();

  // head
  ctx.beginPath();
  ctx.ellipse(donkey.w*0.88, donkey.h*0.04, 10, 8, 0.3, 0, Math.PI*2);
  ctx.fillStyle='#e0d8c8'; ctx.fill();

  // snout
  ctx.beginPath();
  ctx.ellipse(donkey.w*0.96, donkey.h*0.06, 7, 5, 0.2, 0, Math.PI*2);
  ctx.fillStyle='#c8b8a8'; ctx.fill();

  // eye
  ctx.beginPath(); ctx.arc(donkey.w*0.9, donkey.h*0.0, 2.5, 0, Math.PI*2);
  ctx.fillStyle='#2a1a08'; ctx.fill();
  ctx.beginPath(); ctx.arc(donkey.w*0.9-0.5, donkey.h*0.0-0.5, 0.8, 0, Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fill();

  // ears
  const earRaise = donkey.earsUp ? -donkey.earTimer*8 : 0;
  ctx.fillStyle='#d8d0c0';
  ctx.beginPath(); ctx.moveTo(donkey.w*0.83,donkey.h*-0.02); ctx.lineTo(donkey.w*0.80,donkey.h*-0.12+earRaise); ctx.lineTo(donkey.w*0.87,donkey.h*-0.06+earRaise); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(donkey.w*0.91,donkey.h*-0.03); ctx.lineTo(donkey.w*0.89,donkey.h*-0.14+earRaise); ctx.lineTo(donkey.w*0.95,donkey.h*-0.07+earRaise); ctx.closePath(); ctx.fill();
  // inner ear
  ctx.fillStyle='#e8a8a0';
  ctx.beginPath(); ctx.moveTo(donkey.w*0.83,donkey.h*-0.01); ctx.lineTo(donkey.w*0.81,donkey.h*-0.10+earRaise); ctx.lineTo(donkey.w*0.86,donkey.h*-0.05+earRaise); ctx.closePath(); ctx.fill();

  // mane
  ctx.strokeStyle='#b0a898'; ctx.lineWidth=3; ctx.lineCap='round';
  for(let m=0;m<5;m++){
    ctx.beginPath();
    ctx.moveTo(donkey.w*0.75-m*3, donkey.h*0.12-m*2);
    ctx.lineTo(donkey.w*0.72-m*3, donkey.h*0.22-m*2);
    ctx.stroke();
  }

  // tail
  const tw = donkey.tailWag || 0;
  ctx.beginPath();
  ctx.moveTo(6, donkey.h*0.42);
  ctx.quadraticCurveTo(-12+tw, donkey.h*0.28, -8+tw*1.4, donkey.h*0.15);
  ctx.strokeStyle='#c0b8a8'; ctx.lineWidth=4; ctx.lineCap='round'; ctx.stroke();
  // tail tuft
  ctx.beginPath(); ctx.arc(-8+tw*1.4, donkey.h*0.14, 5, 0, Math.PI*2);
  ctx.fillStyle='#a8a098'; ctx.fill();

  // saddle (if mounted)
  if(player.mounted){
    ctx.fillStyle='#5a3a18';
    ctx.beginPath(); ctx.ellipse(donkey.w/2, donkey.h*0.24, 18, 8, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#7a5028';
    ctx.beginPath(); ctx.ellipse(donkey.w/2, donkey.h*0.22, 14, 5, 0, 0, Math.PI*2); ctx.fill();
    // stirrups
    ctx.strokeStyle='#8a6030'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(donkey.w/2-12, donkey.h*0.24); ctx.lineTo(donkey.w/2-14, donkey.h*0.48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(donkey.w/2+12, donkey.h*0.24); ctx.lineTo(donkey.w/2+14, donkey.h*0.48); ctx.stroke();
  }

  ctx.restore();

  // "응앙" speech bubble occasionally
  if(donkey.found && !player.mounted && Math.sin(Date.now()/3000)>0.92){
    const bx=dx+donkey.w*0.8-camX*0+camX*0, by2=dy-22;
    ctx.font='12px "Noto Serif KR",serif';
    ctx.fillStyle='rgba(240,230,205,0.8)';
    ctx.textAlign='center';
    ctx.fillText('응앙—', dx+donkey.w*flip*0.6+donkey.w*(1-flip)/2*0+donkey.w/2, dy-18);
  }
}

// ─── PLAYER DRAW ───
function drawPlayer() {
  if(player.mounted) { drawPlayerMounted(); return; }
  const px=player.x-camX, py=player.y;
  const t=Date.now()/1000;
  const moving=Math.abs(player.vx)>0.3;
  const legSw=moving?Math.sin(player.walkT)*13:0;
  const armSw=moving?Math.cos(player.walkT)*9:0;
  ctx.save(); ctx.translate(px,py);
  ctx.scale(player.dir,1);
  // shadow
  ctx.save(); ctx.scale(1,0.28);
  ctx.beginPath(); ctx.ellipse(0,player.h+12,12,5,0,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fill(); ctx.restore();
  // legs
  ctx.strokeStyle='#253a28'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-4,player.h*0.62); ctx.lineTo(-6-legSw*0.3,player.h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4,player.h*0.62); ctx.lineTo(6+legSw*0.3,player.h); ctx.stroke();
  // coat
  ctx.beginPath(); ctx.roundRect(-10,player.h*0.28,20,player.h*0.42,3);
  ctx.fillStyle='#1e3422'; ctx.fill();
  // arms
  ctx.strokeStyle='#1e3422'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(-9,player.h*0.33); ctx.lineTo(-15-armSw*0.4,player.h*0.54); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9,player.h*0.33); ctx.lineTo(15+armSw*0.4,player.h*0.5); ctx.stroke();
  // head
  const by2=Math.sin(player.breathT*1.4)*0.5, hy=player.h*0.14+by2;
  ctx.beginPath(); ctx.arc(0,hy,9,0,Math.PI*2); ctx.fillStyle='#c8a882'; ctx.fill();
  ctx.beginPath(); ctx.arc(0,hy-2,9,Math.PI,0); ctx.fillStyle='#1e1008'; ctx.fill();
  // scarf (green for this stage)
  ctx.beginPath(); ctx.arc(0,hy+7,6,-0.3,Math.PI+0.3); ctx.strokeStyle='#3a5a30'; ctx.lineWidth=3; ctx.stroke();
  // breath
  if(!moving){ const ba=(Math.sin(t*1.5)*0.5+0.5)*0.28;
    ctx.beginPath(); ctx.arc(11,hy,4,0,Math.PI*2); ctx.fillStyle=`rgba(215,232,248,${ba})`; ctx.fill();
  }
  ctx.restore();
}

function drawPlayerMounted() {
  // player sits on donkey — separate draw at donkey position
  const px=donkey.x-camX+donkey.w/2-player.w/2;
  const py=donkey.y-player.h+6;
  const t=Date.now()/1000;
  ctx.save(); ctx.translate(px+player.w/2, py);
  ctx.scale(donkey.dir,1);
  // legs hang down
  ctx.strokeStyle='#253a28'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-8,player.h*0.65); ctx.lineTo(-14,player.h*0.95); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8,player.h*0.65); ctx.lineTo(14,player.h*0.95); ctx.stroke();
  // body
  ctx.beginPath(); ctx.roundRect(-10,player.h*0.25,20,player.h*0.45,3); ctx.fillStyle='#1e3422'; ctx.fill();
  // arms forward (holding reins)
  ctx.strokeStyle='#1e3422'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(9,player.h*0.35); ctx.lineTo(20,player.h*0.55); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9,player.h*0.35); ctx.lineTo(-18,player.h*0.55); ctx.stroke();
  // reins
  ctx.strokeStyle='rgba(100,70,30,0.6)'; ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(20,player.h*0.55); ctx.lineTo(donkey.w*donkey.dir*0.9,player.h*0.7); ctx.stroke();
  ctx.setLineDash([]);
  // head
  const hy=player.h*0.12;
  ctx.beginPath(); ctx.arc(0,hy,9,0,Math.PI*2); ctx.fillStyle='#c8a882'; ctx.fill();
  ctx.beginPath(); ctx.arc(0,hy-2,9,Math.PI,0); ctx.fillStyle='#1e1008'; ctx.fill();
  ctx.beginPath(); ctx.arc(0,hy+7,6,-0.3,Math.PI+0.3); ctx.strokeStyle='#3a5a30'; ctx.lineWidth=3; ctx.stroke();
  ctx.restore();
}

// ─── CITY FADE TEXT (world leaving effect) ───
function drawLeavingCity() {
  const elev=Math.min(camX/800,1);
  if(elev<0.05) return;
  ctx.save();
  ctx.globalAlpha=Math.min(elev*1.5,0.5)*Math.max(0,1-elev*2.5);
  ctx.font='13px "Noto Serif KR",serif'; ctx.fillStyle='rgba(180,200,220,1)'; ctx.textAlign='center';
  ctx.fillText('세상이 작아진다', W/2, H*0.35);
  ctx.restore();
}

// ─── MAIN LOOP ───
function gameLoop() {
  ctx.clearRect(0,0,W,H);
  drawSky();
  drawStars();
  drawMoon();
  drawCityReceding();
  drawFarMountains();
  drawMidMountains();
  drawTerrain();
  drawInteractables();
  drawFragments();
  drawDonkey();
  drawPlayer();
  drawLeavingCity();
  updateEntities();
  requestAnimationFrame(gameLoop);
}

function gameStartS3() {
  resize();
  player.y=groundY-player.h;
  requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&!gameStarted){
    const ts=document.getElementById('s3title_screen');
    if(ts&&!ts.classList.contains('out')) gameStartS3();
  }
});

// Initial setup
resize();

window.gameStartS3 = gameStartS3;
window.initStage3 = function() { resize(); };
})();
