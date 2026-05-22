// @ts-nocheck
let _stage4Initialized = false;
export function initStage4() {
  if (_stage4Initialized) return;
  _stage4Initialized = true;

// ── CURSOR ──
const cursorEl = document.getElementById('s4cursor');
let mx=0,my=0;
document.addEventListener('mousemove',e=>{ mx=e.clientX; my=e.clientY; cursorEl.style.left=mx+'px'; cursorEl.style.top=my+'px'; });

// ── CANVAS ──
const gc=document.getElementById('s4game_canvas');
const ctx=gc.getContext('2d');
let W=0,H=0;
function resize(){ W=gc.width=window.innerWidth; H=gc.height=window.innerHeight; buildWorld(); }
window.addEventListener('resize',resize);

// ── CONSTANTS ──
const WORLD_W=4800;

// ─────────────────────────────────────────
//  @TUNABLES (stage 4)
// ─────────────────────────────────────────
const tunables = {
  playerStartX: 120,        // @TUNABLE 캐릭터 시작 X
  playerStartY: -46,        // @TUNABLE 캐릭터 시작 Y
  jumpForce: -18,           // @TUNABLE 점프 힘
  moveSpeed: 2.8,           // @TUNABLE 이동 속도
  gravity: 1,               // @TUNABLE 중력
  donkeySpeed: 4.6,         // @TUNABLE 당나귀 속도
  donkeyJump: -18,          // @TUNABLE 당나귀 점프
  donkeyStartX: 200,        // @TUNABLE 당나귀 시작 X
  fragments: [
    { x: 500,  yOffset: -80  }, // @TUNABLE 다이아 0
    { x: 1200, yOffset: -110 }, // @TUNABLE 다이아 1
    { x: 2000, yOffset: -90  }, // @TUNABLE 다이아 2
    { x: 3000, yOffset: -100 }, // @TUNABLE 다이아 3
    { x: 4100, yOffset: -80  }, // @TUNABLE 다이아 4
  ],
  labelOffsetY: -22,        // @TUNABLE 다이아 라벨 Y
  labelFontSize: 13,        // @TUNABLE 다이아 라벨 크기
  popupFontSize: 18,        // @TUNABLE 수집 팝업 크기
  popupFadeMs: 1000,        // @TUNABLE 수집 팝업 시간(ms)
};

// ── STATE ──
let gameStarted=false, gameOver=false;
let collected=0;
const TOTAL=5;
let camX=0;

// 초인 event flags
let choinTriggered=false, choinActive=false, choinX=3400;
let choinProgress=0; // 0→1 silhouette moving across screen
let choinPhase=0;    // 0=waiting, 1=approaching, 2=passing, 3=gone
let choinAlpha=0;

// snow depth increases over time
let snowDepth=0;
// bird (출출이) cry particles
let birds=[];
// footstep impressions in snow
let footsteps=[];
let footstepTimer=0;

const FRAG_WORDS=['눈은 푹푹 나리고','나는 나타샤를 생각하고','나타샤가 아니올 시 출출이 울고','백마 타고 오는 초인이 있어','이 밤이 지새도록 나는 우는 것이다'];
const FRAG_LINES=[[0],[1],[2],[3],[4]];

// ── WORLD ──
let platforms=[], fragments=[], interactables=[];
let groundY=0;

// deep snow tiles — thick accumulation on surfaces
let snowPiles=[];

function buildWorld(){
  groundY=H*0.72;

  // Deep mountain terrain — mostly flat, very snowy, oppressive sky
  platforms=[
    {x:-200,  y:groundY,     w:WORLD_W+400, h:H},   // main ground
    // buried boulders / snow mounds player can step on
    {x:600,   y:groundY-55,  w:110, h:20},
    {x:1100,  y:groundY-80,  w:130, h:20},
    {x:1700,  y:groundY-60,  w:100, h:20},
    {x:2200,  y:groundY-90,  w:120, h:20},
    {x:2800,  y:groundY-65,  w:110, h:20},
    {x:3500,  y:groundY-75,  w:130, h:20},
    {x:4000,  y:groundY-50,  w:120, h:20},
  ];

  fragments = tunables.fragments.map((f, i) => ({
    id: i,
    x: f.x,
    y: groundY + f.yOffset,
    collected: false,
    bob: i * 0.7,
  }));

  interactables=[
    {x:380,  y:groundY-20,  w:40, h:30, label:'발자국의 흔적',
     text:'눈이 발자국을 지우고 있다.\n누군가 지나갔다.\n나타샤일지도 모른다.'},
    {x:1500, y:groundY-20,  w:50, h:30, label:'새 울음소리',
     text:'출출—\n출출—\n나타샤가 오지 않으면\n새도 우는 것이다.'},
    {x:2600, y:groundY-20,  w:50, h:30, label:'눈 위의 그림자',
     text:'긴 그림자가 눈 위에 누워있다.\n나의 그림자다.\n혼자다.'},
    {x:3800, y:groundY-20,  w:50, h:30, label:'고요',
     text:'아무 소리도 없다.\n눈이 소리를 삼킨다.\n이 밤이 지새도록.'},
  ];

  donkey.x=tunables.donkeyStartX; donkey.y=groundY-donkey.h;
  // BUGFIX/preempt: place player on the ground from frame 1
  player.x = tunables.playerStartX;
  player.y = groundY + tunables.playerStartY;

  // pre-place some snow piles
  snowPiles=[];
  for(let i=0;i<60;i++){
    snowPiles.push({
      x: i*82+Math.random()*40,
      w: 40+Math.random()*60,
      depth: 8+Math.random()*14,
    });
  }
}

// ── PLAYER ──
const player={
  x:120, y:0, vx:0, vy:0, w:20, h:46,
  onGround:false, dir:1, walkT:0, breathT:0, mounted:false,
};

// ── DONKEY ──
const donkey={
  x:200, y:0, vx:0, vy:0, w:72, h:52,
  onGround:false, dir:1, walkT:0,
  earsUp:false, earTimer:0, tailWag:0,
  found:true, // already with player from stage 3
};

// ── KEYS ──
const keys={};
document.addEventListener('keydown',e=>{ keys[e.key]=true; keys[e.code]=true; });
document.addEventListener('keyup',  e=>{ keys[e.key]=false; keys[e.code]=false; });

let nearDonkey=false;
document.addEventListener('keydown',e=>{
  if((e.key==='r'||e.key==='R')&&gameStarted&&!gameOver){
    if(nearDonkey&&!player.mounted) mount();
    else if(player.mounted) dismount();
  }
  if((e.key==='e'||e.key==='E')&&gameStarted&&!gameOver){
    const near=interactables.find(ob=>Math.abs(player.x-(ob.x+ob.w/2))<75&&Math.abs((player.y+player.h)-ob.y)<100);
    if(near) showThought(near.text,near.x,near.y-20);
    // bird summon on '새 울음소리'
    if(near&&near.label==='새 울음소리') spawnBirds();
  }
});

function mount(){ player.mounted=true; document.getElementById('s4mount_hint').classList.remove('show'); document.getElementById('s4mounted_bar').classList.add('show'); donkey.earsUp=true; donkey.earTimer=0; }
function dismount(){ player.mounted=false; document.getElementById('s4mounted_bar').classList.remove('show'); player.x=donkey.x+donkey.w+10; player.y=donkey.y; }

const thoughtEl=document.getElementById('s4thought');
let thoughtTimer=null;
function showThought(text,wx,wy){
  thoughtEl.innerHTML=text.replace(/\n/g,'<br>');
  thoughtEl.style.left=Math.min(wx-camX+10,W-260)+'px';
  thoughtEl.style.top=Math.max(wy-115,80)+'px';
  thoughtEl.classList.add('show');
  clearTimeout(thoughtTimer);
  thoughtTimer=setTimeout(()=>thoughtEl.classList.remove('show'),4000);
}

// ── BIRDS ──
function spawnBirds(){
  const bx=1500-camX; const by=groundY*0.4;
  for(let i=0;i<6;i++){
    birds.push({
      x:bx+Math.random()*60-30,
      y:by+Math.random()*40-20,
      vx:-1.5-Math.random()*1.5,
      vy:-0.5-Math.random(),
      life:1, phase:Math.random()*Math.PI*2,
    });
  }
}
function updateBirds(){
  birds.forEach(b=>{ b.x+=b.vx; b.y+=b.vy; b.vy+=0.015; b.life-=0.008; b.phase+=0.12; });
  birds=birds.filter(b=>b.life>0);
}
function drawBirds(){
  birds.forEach(b=>{
    ctx.save(); ctx.globalAlpha=b.life*0.8;
    ctx.translate(b.x,b.y);
    // simple wing shape
    const flap=Math.sin(b.phase)*5;
    ctx.strokeStyle='rgba(160,185,230,0.9)'; ctx.lineWidth=1.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-6,flap); ctx.quadraticCurveTo(-3,0,0,0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6,flap);  ctx.quadraticCurveTo(3,0,0,0); ctx.stroke();
    ctx.restore();
  });
}

// ── FOOTSTEPS ──
function addFootstep(x,y){
  footsteps.push({x,y,alpha:0.5,decay:0.0008});
  if(footsteps.length>60) footsteps.shift();
}
function updateFootsteps(){
  footsteps.forEach(f=>{ f.alpha=Math.max(0,f.alpha-f.decay); });
}
function drawFootsteps(){
  footsteps.forEach(f=>{
    if(f.alpha<=0.01) return;
    const fx=f.x-camX;
    ctx.save(); ctx.globalAlpha=f.alpha;
    ctx.fillStyle='rgba(155,185,220,0.9)';
    ctx.beginPath(); ctx.ellipse(fx-4,f.y,2.5,4,-0.15,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(fx+4,f.y,2.5,4,0.15,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

// ── CHOIN (초인) EVENT ──
let choinTextLines=[
  '백마 타고 오는 초인이 있어',
  '…',
  '잡을 수 없다',
];
let choinTextIdx=0;

function triggerChoin(){
  choinTriggered=true; choinPhase=1; choinActive=true;
  choinProgress=0;
  // show overlay text sequence
  const overlay=document.getElementById('s4choin_overlay');
  overlay.classList.add('show');
  showChoinLine(0);
}

function showChoinLine(idx){
  if(idx>=choinTextLines.length){
    setTimeout(()=>{ document.getElementById('s4choin_overlay').classList.remove('show'); choinPhase=3; },1500);
    return;
  }
  document.getElementById('s4choin_text').textContent=choinTextLines[idx];
  setTimeout(()=>showChoinLine(idx+1), idx===0?3500:2200);
}

// ── PHYSICS ──
function resolveEntity(ent){
  ent.vy+=tunables.gravity; ent.x+=ent.vx; ent.y+=ent.vy;
  ent.x=Math.max(40,Math.min(ent.x,WORLD_W-40));
  ent.onGround=false;
  platforms.forEach(p=>{
    const eb=ent.y+ent.h, prev=eb-ent.vy;
    const cx=ent.x+(ent===donkey?ent.w/2:0);
    const hw=ent===donkey?ent.w*0.4:8;
    if(cx+hw>p.x&&cx-hw<p.x+p.w&&prev<=p.y+2&&eb>=p.y&&ent.vy>=0){
      ent.y=p.y-ent.h; ent.vy=0; ent.onGround=true;
    }
  });
}

function updateEntities(){
  if(!gameStarted||gameOver) return;
  const t=Date.now()/1000;
  const L=keys['ArrowLeft']||keys['KeyA'];
  const R=keys['ArrowRight']||keys['KeyD'];
  const J=keys['ArrowUp']||keys['KeyW']||keys[' '];

  if(player.mounted){
    if(L){donkey.vx=-tunables.donkeySpeed;donkey.dir=-1;}
    if(R){donkey.vx= tunables.donkeySpeed;donkey.dir= 1;}
    if(!L&&!R) donkey.vx*=0.58;
    if(J&&donkey.onGround){donkey.vy=tunables.donkeyJump;donkey.onGround=false;}
    resolveEntity(donkey);
    player.x=donkey.x+donkey.w/2-player.w/2;
    player.y=donkey.y-player.h+6;
    player.vx=donkey.vx; player.vy=donkey.vy;
    player.onGround=donkey.onGround; player.dir=donkey.dir;
    if(Math.abs(donkey.vx)>0.4){donkey.walkT+=0.09; donkey.tailWag=Math.sin(t*3)*12;}
  } else {
    if(L){player.vx=-tunables.moveSpeed;player.dir=-1;} // slower — deep snow
    if(R){player.vx= tunables.moveSpeed;player.dir= 1;}
    if(!L&&!R) player.vx*=0.6;
    if(J&&player.onGround){player.vy=tunables.jumpForce;player.onGround=false;}
    resolveEntity(player);
    if(Math.abs(player.vx)>0.3) player.walkT+=0.09;
    // footstep trail
    if(player.onGround&&Math.abs(player.vx)>0.5){
      footstepTimer++;
      if(footstepTimer>14){footstepTimer=0; addFootstep(player.x,player.y+player.h-2);}
    }
    // donkey follows
    const dd=player.x-(donkey.x+donkey.w/2);
    if(Math.abs(dd)>160){donkey.vx+=(dd>0?0.1:-0.1); donkey.vx=Math.max(-2.2,Math.min(2.2,donkey.vx)); donkey.dir=dd>0?1:-1;}
    else donkey.vx*=0.78;
    resolveEntity(donkey);
    if(Math.abs(donkey.vx)>0.3){donkey.walkT+=0.07; donkey.tailWag=Math.sin(t*2)*7;}
    else donkey.tailWag*=0.9;
    // mount hint
    const dist=Math.hypot(player.x-(donkey.x+donkey.w/2),player.y+player.h/2-(donkey.y+donkey.h/2));
    nearDonkey=dist<95;
    document.getElementById('s4mount_hint').classList.toggle('show',nearDonkey);
  }

  player.breathT+=0.015;
  if(donkey.earsUp){donkey.earTimer+=0.04;if(donkey.earTimer>1)donkey.earsUp=false;}

  // camera
  const anchor=player.mounted?donkey.x:player.x;
  camX+=(anchor-W*0.35-camX)*0.065;
  camX=Math.max(0,Math.min(camX,WORLD_W-W));

  // snow depth
  snowDepth=Math.min(snowDepth+0.018,100);

  // 초인 trigger (when player reaches ~x=3400)
  if(!choinTriggered&&(player.mounted?donkey.x:player.x)>3200) triggerChoin();

  // update choin silhouette
  if(choinPhase===1||choinPhase===2){
    choinProgress=Math.min(choinProgress+0.0015,1);
    if(choinProgress>0.3) choinPhase=2;
    if(choinProgress>=1) choinPhase=3;
  }

  updateBirds(); updateFootsteps();

  // fragment collection — must be on the donkey
  fragments.forEach(f=>{
    if(f.collected)return;
    if(!player.mounted){
      const dist=Math.hypot(player.x-f.x,player.y+player.h/2-f.y);
      if(dist<60) showThought('당나귀와 같이 오세요',f.x,f.y);
      return;
    }
    const cx=donkey.x+donkey.w/2;
    const cy=donkey.y+donkey.h/2;
    if(Math.hypot(cx-f.x,cy-f.y)<70) collectFrag(f);
  });

  // cursor
  const nearObj=interactables.find(ob=>Math.abs(player.x-(ob.x+ob.w/2))<75&&Math.abs((player.y+player.h)-ob.y)<100);
  cursorEl.classList.toggle('interact',!!nearObj||nearDonkey);

  maybeClear();
}

function collectFrag(f){
  f.collected=true; collected++;
  document.getElementById('s4d'+f.id).classList.add('lit');
  (FRAG_LINES[f.id]||[]).forEach(li=>{
    const el=document.getElementById('s4l'+li); if(el)el.classList.add('lit');
  });
  const fl=document.getElementById('s4word_flash');
  fl.textContent=FRAG_WORDS[f.id];
  const _m=220, _sx=f.x-camX;
  fl.style.left=Math.max(_m,Math.min(_sx,window.innerWidth-_m))+'px'; fl.style.top=(f.y-32)+'px';
  // @TUNABLE popupFontSize
  fl.style.fontSize = tunables.popupFontSize + 'px';
  fl.classList.add('show');
  // @TUNABLE popupFadeMs
  setTimeout(()=>fl.classList.remove('show'), tunables.popupFadeMs);
}

let clearTriggered = false;
function maybeClear(){
  if(clearTriggered) return;
  if(collected<TOTAL) return;
  if(!player.mounted) return;
  clearTriggered = true;
  setTimeout(showClear, 1800);
}

function showClear(){
  gameOver=true;
  document.getElementById('s4stage_clear').classList.add('show');
  setTimeout(() => { if(window.onStageClear) window.onStageClear(4); }, 3000);
}

// ── DRAW SKY ──
function drawSky(){
  // very deep, oppressive night sky
  const sg=ctx.createLinearGradient(0,0,0,H);
  sg.addColorStop(0,'#020408');
  sg.addColorStop(0.5,'#050a14');
  sg.addColorStop(1,'#0a1428');
  ctx.fillStyle=sg; ctx.fillRect(0,0,W,H);
}

// ── STARS (many, cold) ──
function drawStars(){
  const t=Date.now()/1000;
  for(let i=0;i<120;i++){
    const seed=i*137.5;
    const ox=camX*0.01;
    const sx=((seed*91+ox)%W+W)%W;
    const sy=(seed*46)%(groundY*0.75)+8;
    const br=0.15+(Math.sin(t*0.8+i*0.7)*0.5+0.5)*0.55;
    const r=i%7===0?1.2:i%3===0?0.8:0.5;
    ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2);
    ctx.fillStyle=`rgba(210,220,255,${br})`; ctx.fill();
  }
}

// ── MOON (covered by snow clouds) ──
function drawMoon(){
  const mmx=W*0.65-camX*0.006, mmy=H*0.09;
  // faint glow through clouds
  const mg=ctx.createRadialGradient(mmx,mmy,0,mmx,mmy,100);
  mg.addColorStop(0,'rgba(180,200,255,0.12)');
  mg.addColorStop(0.4,'rgba(160,185,255,0.06)');
  mg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=mg; ctx.fillRect(0,0,W,H);
  // moon disc
  ctx.beginPath(); ctx.arc(mmx,mmy,20,0,Math.PI*2);
  ctx.fillStyle='rgba(190,210,255,0.6)'; ctx.fill();
  // cloud cover (dark smear)
  ctx.beginPath(); ctx.ellipse(mmx-15,mmy,40,14,0.2,0,Math.PI*2);
  ctx.fillStyle='rgba(8,12,24,0.65)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(mmx+20,mmy+5,35,12,-0.1,0,Math.PI*2);
  ctx.fillStyle='rgba(6,10,20,0.55)'; ctx.fill();
}

// ── SNOW CLOUDS (heavy, pressing down) ──
function drawClouds(){
  const t=Date.now()/1000;
  // slow drifting cloud masses
  const cloudDefs=[
    {bx:0,   by:H*0.04, w:W*0.55, h:H*0.12, speed:0.03},
    {bx:W*0.3,by:H*0.02,w:W*0.6, h:H*0.10, speed:0.018},
    {bx:-W*0.1,by:H*0.06,w:W*0.5,h:H*0.11,speed:0.025},
  ];
  cloudDefs.forEach((c,i)=>{
    const ox=(t*c.speed*30)%W;
    const cx=(c.bx+ox)%(W+200)-100;
    const g=ctx.createRadialGradient(cx+c.w/2,c.by+c.h/2,0,cx+c.w/2,c.by+c.h/2,c.w/2);
    g.addColorStop(0,'rgba(12,18,36,0.75)');
    g.addColorStop(0.6,'rgba(8,14,28,0.5)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(cx,c.by,c.w,c.h*2);
  });
}

// ── FAR MOUNTAINS ──
function drawFarMountains(){
  ctx.save(); ctx.translate(-camX*0.05,0);
  ctx.beginPath(); ctx.moveTo(-100,groundY+10);
  [[0,groundY-20],[300,groundY-120],[700,groundY-70],[1100,groundY-190],[1500,groundY-130],
   [1900,groundY-220],[2300,groundY-150],[2700,groundY-200],[3100,groundY-120],[3500,groundY-180],
   [3900,groundY-90],[4200,groundY+10]].forEach(([px,py])=>ctx.lineTo(px,py));
  ctx.closePath();
  const mg=ctx.createLinearGradient(0,groundY-220,0,groundY);
  mg.addColorStop(0,'#06090f'); mg.addColorStop(1,'#0a1020');
  ctx.fillStyle=mg; ctx.fill(); ctx.restore();
}

// ── PINE FOREST (dense, dark, snowy) ──
function drawForest(){
  ctx.save(); ctx.translate(-camX*0.2,0);
  for(let i=0;i<80;i++){
    const tx=i*62+((i*43)%38); const th=70+((i*57)%80); const ts=18+((i*31)%16);
    const ty=groundY+10;
    ctx.strokeStyle='rgba(14,24,16,0.85)'; ctx.lineWidth=2.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx,ty-th*0.3); ctx.stroke();
    for(let l=0;l<4;l++){
      const ly=ty-th*0.18-l*th*0.21; const lw=ts*(1.12-l*0.22);
      ctx.beginPath(); ctx.moveTo(tx-lw,ly); ctx.lineTo(tx,ly-th*0.2); ctx.lineTo(tx+lw,ly); ctx.closePath();
      ctx.fillStyle=`rgba(10,18,12,0.92)`; ctx.fill();
      // heavy snow on branches
      const snowLoad=0.4+snowDepth*0.004;
      ctx.beginPath(); ctx.moveTo(tx-lw+2,ly); ctx.lineTo(tx,ly-th*0.16); ctx.lineTo(tx+lw-2,ly); ctx.closePath();
      ctx.fillStyle=`rgba(180,205,230,${snowLoad})`; ctx.fill();
    }
  }
  ctx.restore();
}

// ── GROUND ──
function drawGround(){
  // deep snow ground
  const sd=snowDepth/100;
  const gg=ctx.createLinearGradient(0,groundY,0,H);
  gg.addColorStop(0,`rgb(${Math.round(170+sd*30)},${Math.round(190+sd*20)},${Math.round(210+sd*20)})`);
  gg.addColorStop(0.08,'#8aaccA'); gg.addColorStop(1,'#3a5878');
  ctx.fillStyle=gg; ctx.fillRect(0,groundY,W,H-groundY);

  // surface shimmer
  ctx.fillStyle=`rgba(220,238,255,${0.3+sd*0.25})`; ctx.fillRect(0,groundY,W,4);

  // snow mounds on ground
  snowPiles.forEach(p=>{
    const px=p.x-camX; if(px>W+80||px+p.w<-80) return;
    const ht=p.depth*(0.5+sd*0.5);
    ctx.beginPath();
    ctx.ellipse(px+p.w/2, groundY, p.w/2+3, ht, 0, Math.PI, 0);
    ctx.fillStyle=`rgba(215,232,252,${0.4+sd*0.3})`; ctx.fill();
  });

  // boulders (snow-buried)
  platforms.slice(1).forEach(p=>{
    const px=p.x-camX; if(px>W+50||px+p.w<-50) return;
    ctx.fillStyle='#5a7898';
    ctx.beginPath(); ctx.ellipse(px+p.w/2,p.y+p.h/2+5,p.w/2+5,p.h+3,0,0,Math.PI*2); ctx.fill();
    const snowCap=p.depth*(0.6+sd*0.4)||10;
    ctx.fillStyle=`rgba(205,225,248,0.75)`;
    ctx.beginPath(); ctx.ellipse(px+p.w/2,p.y,p.w/2+3,8,0,Math.PI,0); ctx.fill();
  });
}

// ── SNOW PARTICLES ──
const snowPtcls=[];
for(let i=0;i<160;i++) snowPtcls.push({
  x:Math.random()*5000, y:Math.random()*900,
  r:Math.random()*2.2+0.3, sp:Math.random()*0.5+0.15,
  dr:(Math.random()-0.5)*0.2, ph:Math.random()*Math.PI*2,
});
function drawSnow(){
  const t=Date.now()/1000;
  snowPtcls.forEach(s=>{
    s.y+=s.sp*(0.8+snowDepth*0.008); s.x+=s.dr+Math.sin(t*0.3+s.ph)*0.1;
    if(s.y>H+5){s.y=-5;s.x=Math.random()*W;}
    if(s.x>W)s.x=0; if(s.x<0)s.x=W;
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle=`rgba(200,218,245,${0.18+s.r*0.07})`; ctx.fill();
  });
}

// ── INTERACTABLE HINTS ──
function drawInteractableHints(){
  interactables.forEach(ob=>{
    const ox=ob.x-camX;
    const dist=Math.abs(player.x-(ob.x+ob.w/2));
    if(dist<90){
      ctx.font='11px "Noto Sans KR",sans-serif'; ctx.textAlign='center';
      ctx.fillStyle=`rgba(175,200,248,${Math.max(0,(90-dist)/90)*0.65})`;
      ctx.fillText('[ E ] '+ob.label, ox+ob.w/2, ob.y-14);
    }
  });
}

// ── FRAGMENTS ──
function drawFragments(){
  const t=Date.now()/1000;
  fragments.forEach(f=>{
    if(f.collected)return;
    const fx=f.x-camX; if(fx<-80||fx>W+80)return;
    const bob=Math.sin(t*1.2+f.bob)*5;
    const fy=f.y-16+bob;
    // cold blue glow
    const glw=ctx.createRadialGradient(fx,fy,0,fx,fy,52);
    glw.addColorStop(0,'rgba(120,160,255,0.18)'); glw.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glw; ctx.fillRect(fx-52,fy-52,104,104);
    ctx.save(); ctx.translate(fx,fy); ctx.rotate(Math.sin(t*0.6+f.bob)*0.1);
    const sc=1+Math.sin(t*1.6+f.bob)*0.04; ctx.scale(sc,sc);
    ctx.beginPath(); ctx.moveTo(0,-13);ctx.lineTo(9,0);ctx.lineTo(0,13);ctx.lineTo(-9,0);ctx.closePath();
    ctx.fillStyle='rgba(130,165,255,0.14)'; ctx.fill();
    ctx.strokeStyle='rgba(155,185,255,0.65)'; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2);
    ctx.fillStyle='rgba(190,210,255,0.9)'; ctx.fill();
    ctx.restore();
    const dist=Math.hypot((player.mounted?donkey.x+donkey.w/2:player.x)-f.x,(player.mounted?donkey.y+donkey.h/2:player.y+player.h/2)-f.y);
    if(dist<75){
      ctx.save(); ctx.globalAlpha=Math.max(0,(75-dist)/75);
      // @TUNABLE labelFontSize / labelOffsetY
      ctx.font=`${tunables.labelFontSize}px "Noto Serif KR",serif`; ctx.fillStyle='rgba(190,212,255,0.9)'; ctx.textAlign='center';
      ctx.fillText(FRAG_WORDS[f.id],fx,fy + tunables.labelOffsetY); ctx.restore();
    }
  });
}

// ── 초인 SILHOUETTE ──
function drawChoin(){
  if(choinPhase===0||choinPhase===3) return;
  if(choinProgress<=0||choinProgress>=1) return;

  // silhouette moves from far right (off-screen) across to far left
  const t=Date.now()/1000;
  // screen x: start from right edge, move left
  const sx=W*(1.15-choinProgress*1.6);
  const sy=groundY-180;

  // glow behind silhouette
  ctx.save();
  ctx.globalAlpha=Math.min(choinProgress*4, 1-Math.max(0,(choinProgress-0.7)*3))*0.85;
  const gw=ctx.createRadialGradient(sx,sy,0,sx,sy,150);
  gw.addColorStop(0,'rgba(220,235,255,0.55)');
  gw.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gw; ctx.fillRect(sx-150,sy-150,300,300);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha=Math.min(choinProgress*5, 1-Math.max(0,(choinProgress-0.78)*4))*1.0;

  // silhouette of rider on horse — pure dark shape
  // horse body
  ctx.fillStyle='rgba(20,28,50,0.92)';
  // horse legs (galloping)
  const gallop=Math.sin(t*8)*12;
  ctx.strokeStyle='rgba(20,28,50,0.9)'; ctx.lineWidth=5; ctx.lineCap='round';
  [[sx-20,-1],[sx-6,1],[sx+10,-1],[sx+24,1]].forEach(([lx,ph])=>{
    ctx.beginPath(); ctx.moveTo(lx,sy+30); ctx.lineTo(lx+gallop*ph,sy+68); ctx.stroke();
  });
  // horse body ellipse
  ctx.beginPath(); ctx.ellipse(sx,sy+18,36,18,0,0,Math.PI*2); ctx.fill();
  // neck
  ctx.beginPath(); ctx.moveTo(sx+26,sy+10); ctx.quadraticCurveTo(sx+40,sy-5,sx+44,sy-15); ctx.strokeStyle='rgba(20,28,50,0.92)'; ctx.lineWidth=12; ctx.stroke();
  // head
  ctx.beginPath(); ctx.ellipse(sx+46,sy-20,10,8,0.5,0,Math.PI*2); ctx.fill();
  // mane
  ctx.strokeStyle='rgba(30,40,65,0.8)'; ctx.lineWidth=3;
  for(let m=0;m<4;m++){
    ctx.beginPath(); ctx.moveTo(sx+32+m*3,sy+5-m*3); ctx.lineTo(sx+28+m*3,sy+16-m*3); ctx.stroke();
  }
  // tail
  ctx.beginPath(); ctx.moveTo(sx-36,sy+10); ctx.quadraticCurveTo(sx-55,sy-5,sx-52,sy-20);
  ctx.strokeStyle='rgba(20,28,50,0.85)'; ctx.lineWidth=4; ctx.stroke();
  // rider body
  ctx.fillStyle='rgba(15,22,42,0.95)';
  ctx.beginPath(); ctx.ellipse(sx+4,sy-16,8,14,-0.2,0,Math.PI*2); ctx.fill();
  // rider head
  ctx.beginPath(); ctx.arc(sx+6,sy-33,7,0,Math.PI*2); ctx.fill();
  // rider cape
  ctx.beginPath(); ctx.moveTo(sx-2,sy-28); ctx.quadraticCurveTo(sx-20+gallop*0.3,sy-10,sx-18,sy+8);
  ctx.strokeStyle='rgba(12,18,38,0.88)'; ctx.lineWidth=6; ctx.stroke();

  // motion blur streaks
  ctx.globalAlpha*=0.3;
  for(let b=1;b<=4;b++){
    const bx=sx+b*18; const ba=1-b*0.22;
    ctx.save(); ctx.globalAlpha=ba*0.15;
    ctx.beginPath(); ctx.ellipse(bx,sy+18,36-b*2,18-b*2,0,0,Math.PI*2);
    ctx.fillStyle='rgba(180,200,255,0.4)'; ctx.fill(); ctx.restore();
  }

  ctx.restore();
}

// ── DONKEY ──
function drawDonkey(){
  const t=Date.now()/1000;
  const dx=donkey.x-camX, dy=donkey.y;
  if(dx<-120||dx>W+120)return;
  ctx.save(); ctx.translate(dx,dy);
  if(donkey.dir<0) ctx.translate(donkey.w,0);
  ctx.scale(donkey.dir,1);
  const moving=Math.abs(donkey.vx)>0.3;
  const legSw=moving?Math.sin(donkey.walkT)*13:0;
  // shadow
  ctx.save(); ctx.scale(1,0.25);
  ctx.beginPath(); ctx.ellipse(donkey.w/2,donkey.h+14,donkey.w/2+4,8,0,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fill(); ctx.restore();
  // legs
  ctx.strokeStyle='#d0c8b8'; ctx.lineWidth=5; ctx.lineCap='round';
  [[14,-1],[24,1],[44,-1],[56,1]].forEach(([lx,ph],i)=>{
    const sw=legSw*ph*(i<2?1:-1);
    ctx.beginPath(); ctx.moveTo(lx,donkey.h*0.72); ctx.lineTo(lx+sw*0.4,donkey.h); ctx.stroke();
  });
  // body
  ctx.beginPath(); ctx.ellipse(donkey.w/2,donkey.h*0.52,donkey.w/2-2,donkey.h*0.28,0,0,Math.PI*2);
  ctx.fillStyle='#e8e0d0'; ctx.fill();
  ctx.strokeStyle='#c8c0b0'; ctx.lineWidth=0.5; ctx.stroke();
  // neck+head
  ctx.beginPath(); ctx.moveTo(donkey.w*0.72,donkey.h*0.3);
  ctx.quadraticCurveTo(donkey.w*0.85,donkey.h*0.1,donkey.w*0.88,donkey.h*0.04);
  ctx.strokeStyle='#ddd5c4'; ctx.lineWidth=11; ctx.lineCap='round'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(donkey.w*0.88,donkey.h*0.04,10,8,0.3,0,Math.PI*2);
  ctx.fillStyle='#e0d8c8'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(donkey.w*0.96,donkey.h*0.06,7,5,0.2,0,Math.PI*2);
  ctx.fillStyle='#c8b8a8'; ctx.fill();
  // eye
  ctx.beginPath(); ctx.arc(donkey.w*0.9,donkey.h*0.0,2.5,0,Math.PI*2); ctx.fillStyle='#2a1a08'; ctx.fill();
  // ears
  const earR=donkey.earsUp?-donkey.earTimer*8:0;
  ctx.fillStyle='#d8d0c0';
  ctx.beginPath(); ctx.moveTo(donkey.w*0.83,donkey.h*-0.02); ctx.lineTo(donkey.w*0.80,donkey.h*-0.12+earR); ctx.lineTo(donkey.w*0.87,donkey.h*-0.06+earR); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(donkey.w*0.91,donkey.h*-0.03); ctx.lineTo(donkey.w*0.89,donkey.h*-0.14+earR); ctx.lineTo(donkey.w*0.95,donkey.h*-0.07+earR); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#e8a8a0';
  ctx.beginPath(); ctx.moveTo(donkey.w*0.83,donkey.h*-0.01); ctx.lineTo(donkey.w*0.81,donkey.h*-0.10+earR); ctx.lineTo(donkey.w*0.86,donkey.h*-0.05+earR); ctx.closePath(); ctx.fill();
  // snow on back
  const snd=snowDepth/100;
  ctx.fillStyle=`rgba(210,228,248,${snd*0.55})`;
  ctx.beginPath(); ctx.ellipse(donkey.w/2,donkey.h*0.26,donkey.w/2-6,6,0,0,Math.PI*2); ctx.fill();
  // tail
  ctx.beginPath(); ctx.moveTo(6,donkey.h*0.42);
  ctx.quadraticCurveTo(-12+(donkey.tailWag||0),donkey.h*0.28,-8+(donkey.tailWag||0)*1.4,donkey.h*0.15);
  ctx.strokeStyle='#c0b8a8'; ctx.lineWidth=4; ctx.lineCap='round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(-8+(donkey.tailWag||0)*1.4,donkey.h*0.14,5,0,Math.PI*2); ctx.fillStyle='#a8a098'; ctx.fill();
  // saddle
  if(player.mounted){
    ctx.fillStyle='#4a2e14';
    ctx.beginPath(); ctx.ellipse(donkey.w/2,donkey.h*0.24,18,8,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#6a4022';
    ctx.beginPath(); ctx.ellipse(donkey.w/2,donkey.h*0.22,14,5,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#7a5030'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(donkey.w/2-12,donkey.h*0.24); ctx.lineTo(donkey.w/2-14,donkey.h*0.48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(donkey.w/2+12,donkey.h*0.24); ctx.lineTo(donkey.w/2+14,donkey.h*0.48); ctx.stroke();
  }
  ctx.restore();
}

// ── PLAYER ──
function drawPlayer(){
  if(player.mounted){ drawPlayerMounted(); return; }
  const px=player.x-camX, py=player.y;
  const t=Date.now()/1000;
  const moving=Math.abs(player.vx)>0.3;
  const legSw=moving?Math.sin(player.walkT)*12:0;
  const armSw=moving?Math.cos(player.walkT)*8:0;
  ctx.save(); ctx.translate(px,py); ctx.scale(player.dir,1);
  ctx.save(); ctx.scale(1,0.27); ctx.beginPath(); ctx.ellipse(0,player.h+12,11,5,0,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fill(); ctx.restore();
  ctx.strokeStyle='#1c2e40'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-4,player.h*0.62); ctx.lineTo(-6-legSw*0.3,player.h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4,player.h*0.62); ctx.lineTo(6+legSw*0.3,player.h); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-10,player.h*0.28,20,player.h*0.42,3); ctx.fillStyle='#162030'; ctx.fill();
  ctx.strokeStyle='#162030'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(-9,player.h*0.33); ctx.lineTo(-15-armSw*0.4,player.h*0.54); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9,player.h*0.33); ctx.lineTo(15+armSw*0.4,player.h*0.5); ctx.stroke();
  const by2=Math.sin(player.breathT*1.4)*0.5, hy=player.h*0.14+by2;
  ctx.beginPath(); ctx.arc(0,hy,9,0,Math.PI*2); ctx.fillStyle='#c0a07a'; ctx.fill();
  ctx.beginPath(); ctx.arc(0,hy-2,9,Math.PI,0); ctx.fillStyle='#180e06'; ctx.fill();
  // hat (cold weather)
  ctx.fillStyle='#1a2840';
  ctx.beginPath(); ctx.ellipse(0,hy-8,10,4,0,0,Math.PI*2); ctx.fill();
  ctx.fillRect(-9,hy-16,18,10);
  ctx.beginPath(); ctx.ellipse(0,hy-16,9,3,0,0,Math.PI*2); ctx.fill();
  // breath (more visible — very cold)
  const ba=(Math.sin(t*1.4)*0.5+0.5)*0.4+0.1;
  ctx.beginPath(); ctx.arc(11,hy,5,0,Math.PI*2); ctx.fillStyle=`rgba(210,228,248,${ba})`; ctx.fill();
  ctx.beginPath(); ctx.arc(17,hy-3,3,0,Math.PI*2); ctx.fillStyle=`rgba(210,228,248,${ba*0.55})`; ctx.fill();
  ctx.beginPath(); ctx.arc(22,hy-6,2,0,Math.PI*2); ctx.fillStyle=`rgba(210,228,248,${ba*0.25})`; ctx.fill();
  ctx.restore();
}

function drawPlayerMounted(){
  const px=donkey.x-camX+donkey.w/2-player.w/2;
  const py=donkey.y-player.h+6;
  const t=Date.now()/1000;
  ctx.save(); ctx.translate(px+player.w/2,py); ctx.scale(donkey.dir,1);
  ctx.strokeStyle='#1c2e40'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-8,player.h*0.65); ctx.lineTo(-14,player.h*0.95); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8,player.h*0.65); ctx.lineTo(14,player.h*0.95); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-10,player.h*0.25,20,player.h*0.45,3); ctx.fillStyle='#162030'; ctx.fill();
  ctx.strokeStyle='#162030'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(9,player.h*0.35); ctx.lineTo(20,player.h*0.55); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9,player.h*0.35); ctx.lineTo(-18,player.h*0.55); ctx.stroke();
  ctx.strokeStyle='rgba(80,55,25,0.55)'; ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(20,player.h*0.55); ctx.lineTo(34,player.h*0.65); ctx.stroke();
  ctx.setLineDash([]);
  const hy=player.h*0.12;
  ctx.beginPath(); ctx.arc(0,hy,9,0,Math.PI*2); ctx.fillStyle='#c0a07a'; ctx.fill();
  ctx.beginPath(); ctx.arc(0,hy-2,9,Math.PI,0); ctx.fillStyle='#180e06'; ctx.fill();
  // hat
  ctx.fillStyle='#1a2840';
  ctx.beginPath(); ctx.ellipse(0,hy-8,10,4,0,0,Math.PI*2); ctx.fill();
  ctx.fillRect(-9,hy-16,18,10);
  ctx.beginPath(); ctx.ellipse(0,hy-16,9,3,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// ── MAIN LOOP ──
let _running = false;
function gameLoop(){
  if (!_running) return;
  ctx.clearRect(0,0,W,H);
  drawSky(); drawStars(); drawMoon(); drawClouds();
  drawFarMountains(); drawForest(); drawGround();
  drawFootsteps(); drawSnow();
  drawInteractableHints(); drawFragments();
  drawChoin();
  drawDonkey(); drawPlayer();
  drawBirds();
  updateEntities();
  requestAnimationFrame(gameLoop);
}

function resetStateS4(){
  resize();
  player.x = tunables.playerStartX;
  player.y = groundY + tunables.playerStartY;
  player.vx = 0; player.vy = 0; player.dir = 1; player.mounted = false; player.onGround = false;
  donkey.x = tunables.donkeyStartX;
  donkey.y = groundY - donkey.h;
  donkey.vx = 0; donkey.vy = 0;
  collected = 0;
  gameOver = false;
  clearTriggered = false;
  camX = 0;
  choinTriggered = false; choinActive = false; choinPhase = 0; choinAlpha = 0;
  fragments.forEach((f) => (f.collected = false));
  for (let i = 0; i < fragments.length; i++) {
    document.getElementById('s4d' + i)?.classList.remove('lit');
  }
  document.querySelectorAll('#sw4 .poem-line').forEach((l) => l.classList.remove('lit'));
  document.getElementById('s4stage_clear')?.classList.remove('show');
  document.getElementById('s4mounted_bar')?.classList.remove('show');
}

function gameStartS4(){
  gameStarted = true;
  resetStateS4();
  if (!_running) {
    _running = true;
    requestAnimationFrame(gameLoop);
  }
}

// ─────────────────────────────────────────
//  ADMIN API
// ─────────────────────────────────────────
(window as any).s4API = {
  tunables,
  schema: {
    playerStartX:  { min: 0,    max: 4500, step: 10,  label: '캐릭터 시작 X' },
    playerStartY:  { min: -200, max: 0,    step: 1,   label: '캐릭터 시작 Y' },
    jumpForce:     { min: -20,  max: -3,   step: 0.5, label: '점프 힘' },
    moveSpeed:     { min: 0.5,  max: 8,    step: 0.1, label: '이동 속도' },
    gravity:       { min: 0.1,  max: 1.5,  step: 0.05,label: '중력' },
    donkeySpeed:   { min: 0.5,  max: 10,   step: 0.1, label: '당나귀 속도' },
    donkeyJump:    { min: -20,  max: -3,   step: 0.5, label: '당나귀 점프' },
    donkeyStartX:  { min: 0,    max: 4500, step: 10,  label: '당나귀 시작 X' },
    labelOffsetY:  { min: -80,  max: 0,    step: 1,   label: '다이아 라벨 Y' },
    labelFontSize: { min: 8,    max: 32,   step: 1,   label: '다이아 라벨 크기' },
    popupFontSize: { min: 10,   max: 48,   step: 1,   label: '수집 팝업 크기' },
    popupFadeMs:   { min: 200,  max: 5000, step: 100, label: '수집 팝업 시간(ms)' },
  },
  fragmentSchema: { xMin: 0, xMax: 4800, yOffsetMin: -300, yOffsetMax: 0 },
  setTunable(key: string, value: number) {
    (tunables as any)[key] = value;
    if (key === 'donkeyStartX') donkey.x = value;
  },
  setFragment(idx: number, x: number, yOffset: number) {
    if (tunables.fragments[idx]) {
      tunables.fragments[idx].x = x;
      tunables.fragments[idx].yOffset = yOffset;
      if (fragments[idx]) {
        fragments[idx].x = x;
        fragments[idx].y = groundY + yOffset;
      }
    }
  },
  restart: gameStartS4,
};

resize();

window.gameStartS4 = gameStartS4;
window.initStage4 = function() { resize(); };

}
