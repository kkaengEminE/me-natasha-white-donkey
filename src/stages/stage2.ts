// @ts-nocheck
let _stage2Initialized = false;
export function initStage2() {
  if (_stage2Initialized) return;
  _stage2Initialized = true;

// ─── CURSOR ───
const cursorEl = document.getElementById('s2cursor');
let mx=0, my=0;
document.addEventListener('mousemove', e => {
  mx=e.clientX; my=e.clientY;
  cursorEl.style.left=mx+'px'; cursorEl.style.top=my+'px';
});

// ─── CANVAS SETUP ───
const bgC  = document.getElementById('s2bg_canvas');
const bgX  = bgC.getContext('2d');
const gc   = document.getElementById('s2game_canvas');
const ctx  = gc.getContext('2d');
let W=0, H=0;
function resize() {
  W = bgC.width = gc.width = window.innerWidth;
  H = bgC.height= gc.height= window.innerHeight;
}
resize();
window.addEventListener('resize', () => { resize(); });

// ─── ROOMS ───
// Two rooms: 0=주막 외부(좁은 골목→입구), 1=주막 내부
const ROOMS = [
  { name:'눈 내리는 골목', worldW: 1800 },
  { name:'주막 안',        worldW: 2200 },
];
let currentRoom = 0;
let transitioning = false;

// ─── GAME STATE ───
let gameStarted = false;
let gameOver    = false;
let collected   = 0;
const TOTAL     = 6;
const LINES     = ['l1','l2','l3','l4','l5','l6'];
// fragments → which lines they unlock (one fragment per poem line)
const FRAG_LINES = [[0],[1],[2],[3],[4],[5]];
const FRAG_WORDS = [
  '나타샤를 사랑은 하고',
  '눈은 푹푹 날리고',
  '나는 혼자 쓸쓸히 앉어 소주를 마신다',
  '나타샤와 나는',
  '눈이 푹푹 쌓이는 밤 흰 당나귀 타고',
  '산골로 가자 출출이 우는 깊은 산골로 가자',
];

// ─────────────────────────────────────────
//  @TUNABLES (stage 2) — adjust via admin panel
// ─────────────────────────────────────────
const tunables = {
  playerStartX: 160,        // @TUNABLE 캐릭터 시작 X
  playerStartY: -46,        // @TUNABLE 캐릭터 시작 Y (groundY 기준)
  jumpForce: -18,           // @TUNABLE 점프 힘
  moveSpeed: 3.0,           // @TUNABLE 이동 속도
  gravity: 1,               // @TUNABLE 중력
  // room 0 fragments (alley)
  fragments: [
    { x: 420,  yOffset: -80  }, // @TUNABLE r0 다이아 0
    { x: 900,  yOffset: -120 }, // @TUNABLE r0 다이아 1
    { x: 1400, yOffset: -90  }, // @TUNABLE r0 다이아 2
  ],
  labelOffsetY: -22,        // @TUNABLE 다이아 라벨 Y
  labelFontSize: 13,        // @TUNABLE 다이아 라벨 크기
  popupFontSize: 20,        // @TUNABLE 수집 팝업 크기
  popupFadeMs: 1000,        // @TUNABLE 수집 팝업 시간(ms)
};

// ─── PLAYER ───
const player = {
  x:160, y:0, vx:0, vy:0,
  w:20, h:46,
  onGround:false, dir:1,
  walkT:0, breathT:0,
  room:0,
};

// ─── KEYS ───
const keys={};
document.addEventListener('keydown',e=>{keys[e.key]=true; keys[e.code]=true;});
document.addEventListener('keyup',  e=>{keys[e.key]=false; keys[e.code]=false;});

// ─── PLATFORMS per room ───
let platforms=[];
let groundY=0;

function buildPlatforms(room) {
  groundY = H * 0.74;
  if (room===0) {
    platforms = [
      { x:-200, y:groundY, w:2200, h:H },
      { x:600,  y:groundY-70,  w:120, h:16 },
      { x:1000, y:groundY-110, w:100, h:16 },
      { x:1300, y:groundY-55,  w:140, h:16 },
    ];
  } else {
    platforms = [
      { x:-200, y:groundY, w:2600, h:H },
      // table surfaces inside the inn
      { x:350,  y:groundY-88,  w:180, h:16 },
      { x:700,  y:groundY-88,  w:180, h:16 },
      { x:1100, y:groundY-88,  w:180, h:16 },
      // shelf — matched to shelfX=1480, visual surfaces at groundY-175 and groundY-275
      { x:1475, y:groundY-175, w:262, h:14 },
      { x:1475, y:groundY-275, w:162, h:14 },
      // step stool to climb onto shelf
      { x:1420, y:groundY-88,  w:60,  h:12 },
    ];
  }
}

// ─── FRAGMENTS per room ───
let fragments = [];
function buildFragments(room) {
  if (room===0) {
    fragments = tunables.fragments.map((f, i) => ({
      id: i,
      x: f.x,
      y: groundY + f.yOffset,
      collected: false,
      bobPhase: i * 1.2,
    }));
  } else {
    fragments = [
      { id:3, x:440,  y:groundY-165, collected:false, bobPhase:0   }, // on first table
      { id:4, x:1180, y:groundY-165, collected:false, bobPhase:1.5 }, // on middle table
      { id:5, x:1530, y:groundY-295, collected:false, bobPhase:2.1 }, // on upper shelf
    ];
  }
}

// ─── INTERACTABLES per room (E key objects) ───
let interactables = [];
function buildInteractables(room) {
  if (room===0) {
    interactables = [
      { x:750,  y:groundY-20, w:30, h:20, label:'눈 위의 발자국',
        text:'누군가 방금 지나간 듯\n눈 위에 발자국이 남아있다.\n…나타샤일까.' },
      { x:1560, y:groundY-20, w:40, h:50, label:'주막 문',
        text:'문틈으로 불빛이 새어나온다.\n안으로 들어가볼까.', isDoor:true },
    ];
  } else {
    interactables = [
      { x:360,  y:groundY-105, w:60, h:20, label:'소주병',
        text:'차갑다.\n한 잔을 따라 마신다.\n생각이 나타샤에게로 흘러간다.' },
      { x:720,  y:groundY-100, w:40, h:14, label:'편지 봉투',
        text:'주소가 없다.\n받는 사람 이름만 써있다.\n— 나타샤에게' },
      { x:1110, y:groundY-100, w:50, h:16, label:'탁자 위 촛불',
        text:'바람도 없는데 흔들린다.\n밖에 누군가 있는 건가.' },
      { x:1530, y:groundY-178, w:40, h:18, label:'낡은 지도',
        text:'산골 마을 하나가\n빨간 동그라미로 표시되어 있다.\n거기로 가면 될까.' },
      { x:1850, y:groundY-20, w:50, h:50, label:'뒷문',
        text:'눈 덮인 마당으로 나가는 문.\n이제 떠날 시간이다.', isExit:true },
    ];
  }
}

// ─── DECORATIONS per room ───
// Room 0: alley snow scene
// Room 1: inn interior objects (drawn in canvas)

// ─── CAMERA ───
let camX=0;

// ─── THOUGHT BUBBLE ───
const thoughtEl = document.getElementById('s2thought');
let thoughtTimer = null;
function showThought(text, wx, wy) {
  thoughtEl.innerHTML = text.replace(/\n/g,'<br>');
  const sx = wx - camX;
  const sy = wy;
  thoughtEl.style.left = Math.min(sx + 10, W - 250) + 'px';
  thoughtEl.style.top  = Math.max(sy - 110, 80) + 'px';
  thoughtEl.classList.add('show');
  clearTimeout(thoughtTimer);
  thoughtTimer = setTimeout(()=>thoughtEl.classList.remove('show'), 3200);
}

// E key interaction
document.addEventListener('keydown', e => {
  if ((e.key==='e'||e.key==='E') && gameStarted && !gameOver) {
    const near = interactables.find(ob=>{
      return Math.abs(player.x - (ob.x + ob.w/2)) < 70 && Math.abs(player.y + player.h - ob.y) < 90;
    });
    if (near) {
      if (near.isDoor && !transitioning) {
        doRoomTransition(1);
      } else if (near.isExit && !transitioning) {
        if (collected >= TOTAL) {
          // all gems collected — leave through the back door, end stage
          showClear();
        } else {
          showThought('아직 보석이 남아있다.\n방 안의 보석을 모두 모아야 한다.', near.x, near.y - 20);
        }
      } else {
        showThought(near.text, near.x, near.y - 20);
      }
    }
  }
});

function doRoomTransition(toRoom) {
  transitioning = true;
  const overlay = document.getElementById('s2room_transition');
  overlay.classList.add('black');
  setTimeout(()=>{
    currentRoom = toRoom;
    buildPlatforms(toRoom);
    buildFragments(toRoom);
    buildInteractables(toRoom);
    player.x = 100; player.y = groundY - player.h; player.vx=0; player.vy=0;
    camX=0;
    // room caption
    const cap = document.getElementById('s2room_caption');
    cap.textContent = ROOMS[toRoom].name;
    cap.classList.add('show');
    setTimeout(()=>cap.classList.remove('show'), 2000);
    overlay.classList.remove('black');
    transitioning=false;
  }, 900);
}

// ─── PHYSICS ─── (constants live in `tunables` block above)
function updatePlayer() {
  if (!gameStarted||gameOver||transitioning) return;
  const L=keys['ArrowLeft']||keys['KeyA'];
  const R=keys['ArrowRight']||keys['KeyD'];
  const J=keys['ArrowUp']||keys['KeyW']||keys[' '];
  if(L){player.vx=-tunables.moveSpeed; player.dir=-1;}
  if(R){player.vx= tunables.moveSpeed; player.dir= 1;}
  if(!L&&!R) player.vx*=0.65;
  if(J&&player.onGround){player.vy=tunables.jumpForce; player.onGround=false;}
  player.vy+=tunables.gravity;
  player.x+=player.vx; player.y+=player.vy;
  // world bounds
  const worldW = ROOMS[currentRoom].worldW;
  player.x=Math.max(50, Math.min(player.x, worldW-50));
  // platform collision
  player.onGround=false;
  platforms.forEach(p=>{
    const pb=player.y+player.h, prevPb=pb-player.vy;
    if(player.x+8>p.x&&player.x-8<p.x+p.w){
      if(prevPb<=p.y&&pb>=p.y&&player.vy>=0){
        player.y=p.y-player.h; player.vy=0; player.onGround=true;
      }
    }
  });
  // walk anim
  if(Math.abs(player.vx)>0.3) player.walkT+=0.11;
  player.breathT+=0.015;
  // cam
  const target = player.x - W/3;
  camX+=(target-camX)*0.07;
  camX=Math.max(0, Math.min(camX, ROOMS[currentRoom].worldW - W));
  // collect
  fragments.forEach(f=>{
    if(f.collected) return;
    const dist=Math.hypot(player.x-f.x, player.y+player.h/2-f.y+10);
    if(dist<42) collectFrag(f);
  });
  // near interactable hint
  const near = interactables.find(ob=>Math.abs(player.x-(ob.x+ob.w/2))<70 && Math.abs(player.y+player.h-ob.y)<90);
  cursorEl.classList.toggle('interact', !!near);
}

function collectFrag(f) {
  f.collected=true; collected++;
  document.getElementById('s2d'+f.id).classList.add('lit');
  // light up poem lines
  (FRAG_LINES[f.id]||[]).forEach(li=>{
    const el=document.getElementById('s2'+LINES[li]);
    if(el) el.classList.add('lit');
  });
  // flash word
  const fl=document.getElementById('s2word_flash');
  fl.textContent=FRAG_WORDS[f.id]||'';
  const sx=f.x-camX;
  // sit clearly above the E thought bubble so the two never overlap
  const sy=Math.max(f.y-200, 30);
  const margin=220;
  const cx=Math.max(margin,Math.min(sx,window.innerWidth-margin));
  fl.style.left=cx+'px'; fl.style.top=sy+'px';
  // @TUNABLE popupFontSize
  fl.style.fontSize = tunables.popupFontSize + 'px';
  fl.classList.add('show');
  // @TUNABLE popupFadeMs
  setTimeout(()=>fl.classList.remove('show'), tunables.popupFadeMs);
  // stage clears only when player exits through 뒷문 after collecting all
}

function showClear() {
  gameOver=true;
  document.getElementById('s2stage_clear').classList.add('show');
  setTimeout(() => { if(window.onStageClear) window.onStageClear(2); }, 3000);
}

// ─── BG DRAW: Room 0 (alley) ───
const flameT=[0,0,0,0];
function drawRoom0Bg() {
  // night sky
  const sg=bgX.createLinearGradient(0,0,0,groundY);
  sg.addColorStop(0,'#07080f'); sg.addColorStop(1,'#10182a');
  bgX.fillStyle=sg; bgX.fillRect(0,0,W,H);
  // stars
  for(let i=0;i<60;i++){
    const ox=camX*0.015; const seed=i*173.1;
    const sx=((seed*87+ox)%W+W)%W;
    const sy=(seed*43.7)%(groundY*0.65)+15;
    const br=0.25+(Math.sin(Date.now()/900+i)*0.5+0.5)*0.45;
    bgX.beginPath(); bgX.arc(sx,sy,i%4?0.5:1,0,Math.PI*2);
    bgX.fillStyle=`rgba(210,225,255,${br})`; bgX.fill();
  }
  // moon
  const mmx=W*0.72-camX*0.012, mmy=H*0.12;
  const mg=bgX.createRadialGradient(mmx,mmy,0,mmx,mmy,70);
  mg.addColorStop(0,'rgba(200,220,255,0.1)'); mg.addColorStop(1,'rgba(0,0,0,0)');
  bgX.fillStyle=mg; bgX.fillRect(0,0,W,H);
  bgX.beginPath(); bgX.arc(mmx,mmy,22,0,Math.PI*2); bgX.fillStyle='#b8d0ee'; bgX.fill();
  bgX.beginPath(); bgX.arc(mmx+6,mmy-2,18,0,Math.PI*2); bgX.fillStyle='#10182a'; bgX.fill();
}

function drawRoom0World() {
  ctx.save(); ctx.translate(-camX*0.18,0);
  for(let i=0;i<22;i++){
    const bx=i*140+30; const bh=55+((i*73)%70); const bw=55+((i*41)%40);
    ctx.fillStyle='#080d16';
    ctx.fillRect(bx,groundY-bh,bw,bh+4);
    // snow on roof
    ctx.fillStyle='rgba(180,210,240,0.45)';
    ctx.fillRect(bx,groundY-bh,bw,5);
    // window
    if(i%3!==1){ const wx=bx+8,wy=groundY-bh+14,fl=0.6+Math.sin(Date.now()/700+i)*0.15;
      const wg=ctx.createRadialGradient(wx+5,wy+5,0,wx+5,wy+5,20);
      wg.addColorStop(0,`rgba(250,190,80,${0.3*fl})`); wg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=wg; ctx.fillRect(wx-10,wy-10,30,30);
      ctx.fillStyle=`rgba(255,200,110,${0.8*fl})`; ctx.fillRect(wx,wy,10,11);
    }
  }
  ctx.restore();
  // mid parallax trees
  ctx.save(); ctx.translate(-camX*0.45,0);
  for(let i=0;i<30;i++){
    const tx=i*65+20+((i*31)%40); const th=50+((i*57)%55); const ts2=14+((i*23)%14);
    ctx.strokeStyle='rgba(30,40,55,0.7)'; ctx.lineWidth=2.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(tx,groundY); ctx.lineTo(tx,groundY-th*0.35); ctx.stroke();
    for(let l=0;l<3;l++){
      const ly=groundY-th*0.2-l*th*0.22; const lw=ts2*(1-l*0.2);
      ctx.beginPath(); ctx.moveTo(tx-lw,ly); ctx.lineTo(tx,ly-th*0.2); ctx.lineTo(tx+lw,ly); ctx.closePath();
      ctx.fillStyle='rgba(14,24,38,0.9)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(tx-lw+2,ly); ctx.lineTo(tx,ly-th*0.18); ctx.lineTo(tx+lw-2,ly); ctx.closePath();
      ctx.fillStyle='rgba(185,210,235,0.5)'; ctx.fill();
    }
  }
  ctx.restore();
  // lamps
  [250,650,1100,1500].forEach((lx,i)=>{
    const px=lx-camX; const fl=0.75+Math.sin(Date.now()/500+i)*0.12;
    ctx.strokeStyle='rgba(70,90,110,0.65)'; ctx.lineWidth=2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(px,groundY); ctx.lineTo(px,groundY-95); ctx.lineTo(px+15,groundY-95); ctx.stroke();
    const lg=ctx.createRadialGradient(px+15,groundY-95,0,px+15,groundY-95,65);
    lg.addColorStop(0,`rgba(255,195,90,${0.28*fl})`); lg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=lg; ctx.fillRect(px-48,groundY-160,126,126);
    ctx.beginPath(); ctx.arc(px+15,groundY-95,5,0,Math.PI*2); ctx.fillStyle=`rgba(255,220,140,${0.92*fl})`; ctx.fill();
  });
  // ground snow
  const gg=ctx.createLinearGradient(0,groundY,0,H);
  gg.addColorStop(0,'#b8d0e6'); gg.addColorStop(0.1,'#a0bcda'); gg.addColorStop(1,'#6888a8');
  ctx.fillStyle=gg; ctx.fillRect(0,groundY,W,H-groundY);
  ctx.fillStyle='rgba(215,235,252,0.55)'; ctx.fillRect(0,groundY,W,4);
  // door at 1560
  const dx=1560-camX;
  ctx.fillStyle='#1a1208';
  ctx.fillRect(dx,groundY-85,55,85);
  ctx.strokeStyle='rgba(180,130,60,0.5)'; ctx.lineWidth=1;
  ctx.strokeRect(dx,groundY-85,55,85);
  // light from door crack
  const dlg=ctx.createLinearGradient(dx,0,dx+20,0);
  dlg.addColorStop(0,'rgba(240,180,80,0.25)'); dlg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=dlg; ctx.fillRect(dx-30,groundY-85,50,85);
  ctx.fillStyle='rgba(240,190,100,0.7)'; ctx.fillRect(dx,groundY-85,3,85);
  // 주막 sign
  ctx.save(); ctx.translate(dx+27,groundY-105);
  ctx.fillStyle='rgba(160,110,50,0.8)'; ctx.fillRect(-18,-14,36,14);
  ctx.font='bold 11px "Noto Serif KR",serif'; ctx.fillStyle='rgba(240,210,140,0.9)';
  ctx.textAlign='center'; ctx.fillText('주막',0,-2);
  ctx.restore();
  // platforms
  platforms.slice(1).forEach(p=>{
    const px=p.x-camX;
    if(px>W+40||px+p.w<-40) return;
    ctx.fillStyle='#7a98b8'; ctx.fillRect(px,p.y+3,p.w,p.h);
    ctx.fillStyle='rgba(190,215,240,0.65)'; ctx.fillRect(px,p.y,p.w,5);
  });
  // interactable hints
  interactables.forEach(ob=>{
    const ox=ob.x-camX;
    const dist=Math.abs(player.x-ob.x-ob.w/2);
    if(dist<80){
      ctx.font='11px "Noto Sans KR",sans-serif';
      ctx.fillStyle=`rgba(220,190,110,${Math.max(0,(80-dist)/80)*0.7})`;
      ctx.textAlign='center';
      ctx.fillText('[ E ] '+ob.label, ox+ob.w/2, ob.y-14);
    }
  });
  // footprints hint
  [480,820,1080].forEach((fx,i)=>{
    const fpx=fx-camX; const a=Math.max(0,1-Math.abs(fpx-W/2)/(W*0.4))*0.3;
    if(a<=0) return;
    ctx.save(); ctx.globalAlpha=a;
    ctx.fillStyle='rgba(160,195,225,0.8)';
    ctx.beginPath(); ctx.ellipse(fpx-5,groundY-2,3,5,-0.1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(fpx+5,groundY-2,3,5, 0.1,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

// ─── BG DRAW: Room 1 (inn interior) ───
function drawRoom1Bg() {
  // warm interior gradient
  const ig=bgX.createLinearGradient(0,0,0,H);
  ig.addColorStop(0,'#0e0906'); ig.addColorStop(0.5,'#160d07'); ig.addColorStop(1,'#0a0704');
  bgX.fillStyle=ig; bgX.fillRect(0,0,W,H);
  // ceiling beams
  ctx.save(); ctx.translate(-camX*0.0,0);
  for(let i=0;i<8;i++){
    const bx=i*280-40; const bw=55;
    bgX.fillStyle='rgba(40,25,12,0.9)';
    bgX.fillRect(bx,0,bw,H*0.18);
    bgX.strokeStyle='rgba(60,38,16,0.5)'; bgX.lineWidth=0.5;
    bgX.strokeRect(bx,0,bw,H*0.18);
  }
  ctx.restore();
  // warm ambient glow patches
  [200,600,1000,1400,1800].forEach((gx,i)=>{
    const gg=bgX.createRadialGradient(gx,groundY-50,0,gx,groundY-50,180);
    gg.addColorStop(0,`rgba(200,120,40,${0.07+i%2*0.03})`);
    gg.addColorStop(1,'rgba(0,0,0,0)');
    bgX.fillStyle=gg; bgX.fillRect(0,0,W,H);
  });
}

function drawRoom1World() {
  const t=Date.now()/1000;
  // floor boards
  for(let i=0;i<Math.ceil(W/40)+1;i++){
    const fx=(i*40 - camX%40);
    ctx.fillStyle=i%2?'rgba(60,35,15,0.4)':'rgba(50,28,10,0.4)';
    ctx.fillRect(fx,groundY,40,H-groundY);
  }
  ctx.fillStyle='rgba(100,65,25,0.5)'; ctx.fillRect(0,groundY,W,3);
  // back wall (paneling)
  ctx.fillStyle='rgba(25,14,6,0.7)'; ctx.fillRect(0,0,W,groundY);
  for(let i=0;i<Math.ceil(W/60)+1;i++){
    ctx.strokeStyle='rgba(50,30,12,0.5)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(i*60-camX%60,0); ctx.lineTo(i*60-camX%60,groundY); ctx.stroke();
  }
  // window (back wall, snow outside)
  [400,1200].forEach(wx=>{
    const wsx=wx-camX;
    ctx.fillStyle='rgba(40,60,90,0.6)'; ctx.fillRect(wsx-35,groundY*0.25,70,80);
    // frost
    ctx.strokeStyle='rgba(160,200,240,0.3)'; ctx.lineWidth=1;
    ctx.strokeRect(wsx-35,groundY*0.25,70,80);
    // cross bars
    ctx.beginPath(); ctx.moveTo(wsx,groundY*0.25); ctx.lineTo(wsx,groundY*0.25+80); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wsx-35,groundY*0.25+40); ctx.lineTo(wsx+35,groundY*0.25+40); ctx.stroke();
    // snow on sill
    ctx.fillStyle='rgba(180,210,240,0.5)'; ctx.fillRect(wsx-37,groundY*0.25+80,74,8);
    // faint outside glow (moonlight)
    const wg=ctx.createRadialGradient(wsx,groundY*0.25+40,0,wsx,groundY*0.25+40,60);
    wg.addColorStop(0,'rgba(140,180,230,0.06)'); wg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=wg; ctx.fillRect(wsx-60,groundY*0.25-20,120,120);
  });
  // tables (3 tables)
  [[350,1],[700,1],[1100,1]].forEach(([tx,_],i)=>{
    const tpx=tx-camX;
    // table legs
    ctx.fillStyle='rgba(60,35,14,0.9)';
    ctx.fillRect(tpx+10,groundY-88,10,88);
    ctx.fillRect(tpx+160,groundY-88,10,88);
    // table top
    ctx.fillStyle='rgba(80,46,18,0.95)';
    ctx.fillRect(tpx-8,groundY-92,196,12);
    ctx.fillStyle='rgba(100,60,22,0.7)'; ctx.fillRect(tpx-8,groundY-92,196,3);
    // objects on table
    const objX=[tpx+20, tpx+70, tpx+140];
    if(i===0) {
      // 소주병
      drawBottle(objX[0], groundY-92, t);
      drawCup(objX[1]+15, groundY-92, t, i);
    } else if(i===1) {
      // 편지봉투
      drawLetter(objX[0]+5, groundY-92, t);
      drawCandle(objX[2]-5, groundY-92, t, i+2);
    } else {
      // 촛불
      drawCandle(objX[0]+5, groundY-92, t, i*3);
      drawCandle(objX[2]-10, groundY-92, t, i*3+1);
    }
    // candle glow on table
    const cg=ctx.createRadialGradient(tpx+90,groundY-110,0,tpx+90,groundY-110,90);
    cg.addColorStop(0,`rgba(220,150,50,${0.10+Math.sin(t*1.2+i)*0.03})`);
    cg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=cg; ctx.fillRect(tpx-90,groundY-200,360,200);
  });
  // step stool near shelf
  const stoolX = 1420 - camX;
  ctx.fillStyle='rgba(65,38,14,0.85)'; ctx.fillRect(stoolX, groundY-88, 60, 88);
  ctx.fillStyle='rgba(90,55,20,0.7)';  ctx.fillRect(stoolX, groundY-88, 60,  6);
  // stool legs
  ctx.strokeStyle='rgba(50,28,10,0.8)'; ctx.lineWidth=4; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(stoolX+10,groundY-82); ctx.lineTo(stoolX+8, groundY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(stoolX+50,groundY-82); ctx.lineTo(stoolX+52,groundY); ctx.stroke();
  // shelf unit on wall
  const shelfX=1480-camX;
  ctx.fillStyle='rgba(55,32,12,0.9)';
  ctx.fillRect(shelfX,groundY-175,260,12);
  ctx.fillRect(shelfX,groundY-275,160,12);
  ctx.fillRect(shelfX-5,groundY-275,10,275);
  ctx.fillRect(shelfX+255,groundY-175,10,175);
  // items on shelves
  drawJar(shelfX+30, groundY-175, t, 0);
  drawJar(shelfX+90, groundY-175, t, 1);
  drawJar(shelfX+150,groundY-175, t, 2);
  drawJar(shelfX+20, groundY-275, t, 3);
  drawJar(shelfX+75, groundY-275, t, 4);
  // exit door right
  const edx=1840-camX;
  ctx.fillStyle='rgba(40,22,8,0.9)'; ctx.fillRect(edx,groundY-100,60,100);
  ctx.strokeStyle='rgba(120,80,35,0.4)'; ctx.lineWidth=1; ctx.strokeRect(edx,groundY-100,60,100);
  ctx.fillStyle='rgba(150,100,40,0.5)'; ctx.fillRect(edx+50,groundY-55,6,10);
  // platforms
  platforms.slice(1).forEach(p=>{
    const px2=p.x-camX; if(px2>W+40||px2+p.w<-40) return;
    ctx.fillStyle='rgba(65,38,14,0.85)'; ctx.fillRect(px2,p.y+3,p.w,p.h);
    ctx.fillStyle='rgba(90,55,20,0.6)'; ctx.fillRect(px2,p.y,p.w,5);
  });
  // interactable hints
  interactables.forEach(ob=>{
    const ox2=ob.x-camX;
    const dist=Math.abs(player.x-ob.x-ob.w/2);
    if(dist<80){
      ctx.font='11px "Noto Sans KR",sans-serif';
      ctx.fillStyle=`rgba(220,175,90,${Math.max(0,(80-dist)/80)*0.75})`;
      ctx.textAlign='center';
      ctx.fillText('[ E ] '+ob.label, ox2+ob.w/2, ob.y-16);
    }
  });
}

// ─── Object helpers ───
function drawBottle(bx, by, t) {
  // sooju bottle shape
  ctx.fillStyle='rgba(120,160,100,0.75)';
  ctx.fillRect(bx,by-44,14,44); // body
  ctx.fillRect(bx+3,by-54,8,12); // neck
  ctx.fillRect(bx+5,by-57,4,5); // cap
  ctx.fillStyle='rgba(200,230,180,0.15)'; ctx.fillRect(bx+2,by-44,3,40); // glint
}
function drawCup(cx, cy, t, i) {
  ctx.fillStyle='rgba(130,90,45,0.8)';
  ctx.beginPath();
  ctx.moveTo(cx-8,cy); ctx.lineTo(cx-10,cy-22); ctx.lineTo(cx+10,cy-22); ctx.lineTo(cx+8,cy); ctx.closePath(); ctx.fill();
  // sooju inside
  const liq=0.4+Math.sin(t*0.4+i)*0.05;
  ctx.fillStyle=`rgba(200,180,140,${liq})`;
  ctx.beginPath();
  ctx.moveTo(cx-8+1,cy-2); ctx.lineTo(cx-10+1,cy-22+6); ctx.lineTo(cx+10-1,cy-22+6); ctx.lineTo(cx+8-1,cy-2); ctx.closePath(); ctx.fill();
}
function drawLetter(lx, ly, t) {
  ctx.fillStyle='rgba(230,210,170,0.85)'; ctx.fillRect(lx,ly-18,40,22);
  ctx.strokeStyle='rgba(160,130,80,0.5)'; ctx.lineWidth=0.5; ctx.strokeRect(lx,ly-18,40,22);
  // envelope flap
  ctx.beginPath(); ctx.moveTo(lx,ly-18); ctx.lineTo(lx+20,ly-6); ctx.lineTo(lx+40,ly-18); ctx.strokeStyle='rgba(150,120,70,0.4)'; ctx.stroke();
  // 나타샤 text hint
  ctx.font='7px "Noto Serif KR",serif'; ctx.fillStyle='rgba(80,55,25,0.7)'; ctx.textAlign='left';
  ctx.fillText('나타샤에게', lx+4, ly-7);
}
function drawCandle(cx, cy, t, seed) {
  const fl=0.85+Math.sin(t*3.1+seed)*0.1;
  ctx.fillStyle='rgba(230,220,200,0.9)'; ctx.fillRect(cx-5,cy-30,10,30);
  // flame
  ctx.beginPath(); ctx.moveTo(cx-4,cy-30); ctx.quadraticCurveTo(cx-5,cy-42,cx,cy-46); ctx.quadraticCurveTo(cx+5,cy-42,cx+4,cy-30); ctx.closePath();
  ctx.fillStyle=`rgba(255,180,60,${fl})`; ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx-2,cy-30); ctx.quadraticCurveTo(cx-2,cy-38,cx,cy-40); ctx.quadraticCurveTo(cx+2,cy-38,cx+2,cy-30); ctx.closePath();
  ctx.fillStyle=`rgba(255,240,160,${fl*0.9})`; ctx.fill();
  // glow
  const fg=ctx.createRadialGradient(cx,cy-40,0,cx,cy-40,40);
  fg.addColorStop(0,`rgba(255,180,60,${0.22*fl})`); fg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=fg; ctx.fillRect(cx-40,cy-80,80,80);
}
function drawJar(jx, jy, t, seed) {
  const c=seed%3;
  const cols=['rgba(80,100,130,0.6)','rgba(120,80,60,0.6)','rgba(90,110,80,0.55)'];
  ctx.fillStyle=cols[c];
  ctx.beginPath();
  ctx.ellipse(jx+12,jy-5,12,5,0,0,Math.PI*2); ctx.fill();
  ctx.fillRect(jx,jy-30,24,28);
  ctx.beginPath(); ctx.ellipse(jx+12,jy-30,12,4,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(180,180,180,0.4)';
  ctx.beginPath(); ctx.ellipse(jx+12,jy-30,12,4,0,Math.PI*2,Math.PI*3); ctx.fill();
  ctx.fillStyle='rgba(200,220,200,0.12)'; ctx.fillRect(jx+4,jy-30,4,26);
}

// ─── DRAW PLAYER ───
function drawPlayer() {
  const px=player.x-camX, py=player.y;
  const t=Date.now()/1000;
  const moving=Math.abs(player.vx)>0.3;
  const legSw=moving?Math.sin(player.walkT)*13:0;
  const armSw=moving?Math.cos(player.walkT)*9:0;
  ctx.save();
  ctx.translate(px,py);
  const flip=player.dir<0?-1:1;
  ctx.scale(flip,1);
  // shadow
  ctx.save(); ctx.scale(1,0.28);
  ctx.beginPath(); ctx.ellipse(0,player.h+12,13,5,0,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fill(); ctx.restore();
  // legs
  ctx.strokeStyle=currentRoom===1?'#2a1808':'#1e3050'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-4,player.h*0.62); ctx.lineTo(-6-legSw*0.3,player.h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4,player.h*0.62); ctx.lineTo(6+legSw*0.3,player.h); ctx.stroke();
  // body
  ctx.beginPath(); ctx.roundRect(-10,player.h*0.28,20,player.h*0.42,3);
  ctx.fillStyle=currentRoom===1?'#2a1510':'#152a45'; ctx.fill();
  // arms
  ctx.strokeStyle=currentRoom===1?'#2a1510':'#152a45'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(-9,player.h*0.33); ctx.lineTo(-15-armSw*0.4,player.h*0.54); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9,player.h*0.33); ctx.lineTo(15+armSw*0.4,player.h*0.5); ctx.stroke();
  // head
  const by=Math.sin(player.breathT*1.4)*0.5, hy=player.h*0.14+by;
  ctx.beginPath(); ctx.arc(0,hy,9,0,Math.PI*2); ctx.fillStyle='#c8a882'; ctx.fill();
  ctx.beginPath(); ctx.arc(0,hy-2,9,Math.PI,0); ctx.fillStyle='#1e1008'; ctx.fill();
  // scarf
  ctx.beginPath(); ctx.arc(0,hy+7,6,-0.3,Math.PI+0.3);
  ctx.strokeStyle=currentRoom===1?'#8a2020':'#6a2020'; ctx.lineWidth=3; ctx.stroke();
  // breath (cold outside, none inside)
  if(currentRoom===0&&!moving){
    const ba=(Math.sin(t*1.5)*0.5+0.5)*0.3;
    ctx.beginPath(); ctx.arc(11,hy,4,0,Math.PI*2); ctx.fillStyle=`rgba(215,230,248,${ba})`; ctx.fill();
    ctx.beginPath(); ctx.arc(16,hy-2,2.5,0,Math.PI*2); ctx.fillStyle=`rgba(215,230,248,${ba*0.5})`; ctx.fill();
  }
  ctx.restore();
}

// ─── DRAW FRAGMENTS ───
function drawFragments() {
  const t=Date.now()/1000;
  fragments.forEach(f=>{
    if(f.collected) return;
    const fx=f.x-camX; if(fx<-80||fx>W+80) return;
    const bob=Math.sin(t*1.4+f.bobPhase)*5;
    const fy=f.y-15+bob;
    // warm glow (amber in inn, cool outside)
    const col=currentRoom===1?'rgba(240,180,80,':'rgba(160,210,255,';
    const glw=ctx.createRadialGradient(fx,fy,0,fx,fy,50);
    glw.addColorStop(0,col+'0.22)'); glw.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glw; ctx.fillRect(fx-50,fy-50,100,100);
    // crystal
    ctx.save(); ctx.translate(fx,fy);
    ctx.rotate(Math.sin(t*0.7+f.bobPhase)*0.1);
    const sc=1+Math.sin(t*1.8+f.bobPhase)*0.04; ctx.scale(sc,sc);
    ctx.beginPath(); ctx.moveTo(0,-13); ctx.lineTo(9,0); ctx.lineTo(0,13); ctx.lineTo(-9,0); ctx.closePath();
    const col2=currentRoom===1?'rgba(240,190,90,0.18)':'rgba(160,210,255,0.15)';
    ctx.fillStyle=col2; ctx.fill();
    ctx.strokeStyle=currentRoom===1?'rgba(240,190,80,0.65)':'rgba(180,220,255,0.6)'; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2);
    ctx.fillStyle=currentRoom===1?'rgba(255,210,120,0.95)':'rgba(200,230,255,0.9)'; ctx.fill();
    ctx.restore();
    // proximity word label
    const dist=Math.hypot(player.x-f.x,player.y+player.h/2-f.y+10);
    if(dist<70){
      ctx.save(); ctx.globalAlpha=Math.max(0,(70-dist)/70);
      // @TUNABLE labelFontSize / labelOffsetY
      ctx.font=`${tunables.labelFontSize}px "Noto Serif KR",serif`;
      ctx.fillStyle=currentRoom===1?'rgba(240,205,140,0.9)':'rgba(200,235,255,0.9)';
      ctx.textAlign='center'; ctx.fillText(FRAG_WORDS[f.id],fx,fy + tunables.labelOffsetY); ctx.restore();
    }
  });
}

// ─── SNOW OVERLAY (room 0 only) ───
const snowPtcls=[];
for(let i=0;i<100;i++) snowPtcls.push({x:Math.random()*3000,y:Math.random()*800,r:Math.random()*2+0.3,sp:Math.random()*0.7+0.2,dr:(Math.random()-0.5)*0.25,ph:Math.random()*Math.PI*2});

function drawSnow() {
  if(currentRoom!==0) return;
  const t=Date.now()/1000;
  snowPtcls.forEach(s=>{
    s.y+=s.sp; s.x+=s.dr+Math.sin(t*0.35+s.ph)*0.12;
    if(s.y>H+5){s.y=-5; s.x=Math.random()*W;}
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle=`rgba(205,225,248,${0.2+s.r*0.1})`; ctx.fill();
  });
}

// ─── MAIN LOOP ───
let raf;
let _running = false;
function gameLoop() {
  if (!_running) return;
  bgX.clearRect(0,0,W,H);
  ctx.clearRect(0,0,W,H);
  // bg layer
  if(currentRoom===0) drawRoom0Bg();
  else drawRoom1Bg();
  // world
  if(currentRoom===0) drawRoom0World();
  else drawRoom1World();
  // entities
  drawFragments();
  drawPlayer();
  if(currentRoom===0) drawSnow();
  updatePlayer();
  raf=requestAnimationFrame(gameLoop);
}

function resetStateS2() {
  resize();
  currentRoom = 0;
  buildPlatforms(0); buildFragments(0); buildInteractables(0);
  player.x = tunables.playerStartX;
  player.y = groundY + tunables.playerStartY;
  player.vx = 0; player.vy = 0; player.dir = 1; player.onGround = false;
  collected = 0;
  gameOver = false;
  transitioning = false;
  camX = 0;
  for (let i = 0; i < 7; i++) {
    document.getElementById('s2d' + i)?.classList.remove('lit');
  }
  document.querySelectorAll('#sw2 .poem-line').forEach((l) => l.classList.remove('lit'));
  document.getElementById('s2stage_clear')?.classList.remove('show');
}

function gameStartS2() {
  gameStarted = true;
  resetStateS2();
  if (!_running) {
    _running = true;
    raf = requestAnimationFrame(gameLoop);
  }
}

// ─────────────────────────────────────────
//  ADMIN API
// ─────────────────────────────────────────
(window as any).s2API = {
  tunables,
  schema: {
    playerStartX:  { min: 0,    max: 2000, step: 10,  label: '캐릭터 시작 X' },
    playerStartY:  { min: -200, max: 0,    step: 1,   label: '캐릭터 시작 Y' },
    jumpForce:     { min: -20,  max: -3,   step: 0.5, label: '점프 힘' },
    moveSpeed:     { min: 0.5,  max: 8,    step: 0.1, label: '이동 속도' },
    gravity:       { min: 0.1,  max: 1.5,  step: 0.05,label: '중력' },
    labelOffsetY:  { min: -80,  max: 0,    step: 1,   label: '다이아 라벨 Y' },
    labelFontSize: { min: 8,    max: 32,   step: 1,   label: '다이아 라벨 크기' },
    popupFontSize: { min: 10,   max: 48,   step: 1,   label: '수집 팝업 크기' },
    popupFadeMs:   { min: 200,  max: 5000, step: 100, label: '수집 팝업 시간(ms)' },
  },
  fragmentSchema: { xMin: 0, xMax: 1800, yOffsetMin: -300, yOffsetMax: 0 },
  setTunable(key: string, value: number) { (tunables as any)[key] = value; },
  setFragment(idx: number, x: number, yOffset: number) {
    if (tunables.fragments[idx]) {
      tunables.fragments[idx].x = x;
      tunables.fragments[idx].yOffset = yOffset;
      if (currentRoom === 0 && fragments[idx]) {
        fragments[idx].x = x;
        fragments[idx].y = groundY + yOffset;
      }
    }
  },
  restart: gameStartS2,
};

document.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ') && !gameStarted){
    const ts=document.getElementById('s2title_screen');
    if(ts&&!ts.classList.contains('out')) startGame();
  }
});

// ─── EXPORTS ───
window.gameStartS2 = gameStartS2;
window.initStage2 = function() { resize(); buildPlatforms(0); buildFragments(0); buildInteractables(0); };

}
