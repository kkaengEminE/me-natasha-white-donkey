// @ts-nocheck
let _stage5Initialized = false;
export function initStage5() {
  if (_stage5Initialized) return;
  _stage5Initialized = true;

const cursorEl=document.getElementById('s5cursor');
let mx=0,my=0;
document.addEventListener('mousemove',e=>{ mx=e.clientX; my=e.clientY; cursorEl.style.left=mx+'px'; cursorEl.style.top=my+'px'; });

const gc=document.getElementById('s5game_canvas');
const ctx=gc.getContext('2d');
let W=0,H=0;
function resize(){ W=gc.width=window.innerWidth; H=gc.height=window.innerHeight; buildWorld(); }
window.addEventListener('resize',resize);

const WORLD_W=3600;

// ─────────────────────────────────────────
//  @TUNABLES (stage 5)
// ─────────────────────────────────────────
const tunables = {
  playerStartX: 120,        // @TUNABLE 캐릭터 시작 X
  playerStartY: -46,        // @TUNABLE 캐릭터 시작 Y
  jumpForce: -18,           // @TUNABLE 점프 힘
  moveSpeed: 3.0,           // @TUNABLE 이동 속도
  gravity: 1,               // @TUNABLE 중력
  donkeySpeed: 4.8,         // @TUNABLE 당나귀 속도
  donkeyJump: -18,          // @TUNABLE 당나귀 점프
  donkeyStartX: 200,        // @TUNABLE 당나귀 시작 X
  fragments: [
    { x: 550,  yOffset: -85 }, // @TUNABLE 다이아 0
    { x: 1500, yOffset: -95 }, // @TUNABLE 다이아 1
    { x: 2500, yOffset: -85 }, // @TUNABLE 다이아 2
  ],
  labelOffsetY: -22,        // @TUNABLE 다이아 라벨 Y
  labelFontSize: 13,        // @TUNABLE 다이아 라벨 크기
  popupFontSize: 19,        // @TUNABLE 수집 팝업 크기
  popupFadeMs: 1100,        // @TUNABLE 수집 팝업 시간(ms)
};

let gameStarted=false,gameOver=false,collected=0;
const TOTAL=3;
let camX=0;
let groundY=0;
let platforms=[],fragments=[],interactables=[];

// Natasha
let natashaX=2800, natashaVisible=false, natashaTriggered=false, natashaAlpha=0;
let natashaWalkT=0, natashaDir=-1;
let natashaWaiting=false;
let natashaTalked=false;

// Ending
let endingTriggered=false, moonRising=false, moonRiseY=0;
let poemLinesReveal=[], poemRevealTimer=0;
let snowStop=false;

// Warm light from village
let villageGlow=0;

// Snow
const snowPtcls=[];
for(let i=0;i<140;i++) snowPtcls.push({x:Math.random()*4000,y:Math.random()*900,r:Math.random()*2+0.3,sp:Math.random()*0.55+0.15,dr:(Math.random()-0.5)*0.2,ph:Math.random()*Math.PI*2});

const FRAG_WORDS=['나타샤는 나를 사랑하고','어데서 흰 당나귀도 오늘밤이 좋아서','응앙응앙 울 것이다'];
const FRAG_LINES=[[0],[1],[2]];

const player={x:120,y:0,vx:0,vy:0,w:20,h:46,onGround:false,dir:1,walkT:0,breathT:0,mounted:false};
const donkey={x:200,y:0,vx:0,vy:0,w:72,h:52,onGround:false,dir:1,walkT:0,earsUp:false,earTimer:0,tailWag:0};
const keys={};
document.addEventListener('keydown',e=>{keys[e.key]=true;keys[e.code]=true;});
document.addEventListener('keyup',  e=>{keys[e.key]=false;keys[e.code]=false;});

let nearDonkey=false;
document.addEventListener('keydown',e=>{
  if((e.key==='r'||e.key==='R')&&gameStarted&&!gameOver){
    if(nearDonkey&&!player.mounted) mount();
    else if(player.mounted) dismount();
  }
  if((e.key==='e'||e.key==='E')&&gameStarted&&!gameOver){
    // talk to Natasha when she's waiting near the player
    const px = player.mounted ? donkey.x : player.x;
    if (natashaWaiting && !natashaTalked && Math.abs(px - natashaX) < 120) {
      if (!player.mounted) {
        showThought('당나귀와 같이 오세요', natashaX, groundY-90);
        return;
      }
      talkToNatasha();
      return;
    }
    const near=interactables.find(ob=>Math.abs(player.x-(ob.x+ob.w/2))<80&&Math.abs((player.y+player.h)-ob.y)<100);
    if(near) showThought(near.text,near.x,near.y-20);
  }
});

function mount(){ player.mounted=true; document.getElementById('s5mount_hint').classList.remove('show'); document.getElementById('s5mounted_bar').classList.add('show'); donkey.earsUp=true; donkey.earTimer=0; }
function dismount(){ player.mounted=false; document.getElementById('s5mounted_bar').classList.remove('show'); player.x=donkey.x+donkey.w+10; player.y=donkey.y; }

const thoughtEl=document.getElementById('s5thought'); let thoughtTimer=null;
function showThought(text,wx,wy){
  thoughtEl.innerHTML=text.replace(/\n/g,'<br>');
  thoughtEl.style.left=Math.min(wx-camX+10,W-260)+'px';
  thoughtEl.style.top=Math.max(wy-120,80)+'px';
  thoughtEl.classList.add('show');
  clearTimeout(thoughtTimer); thoughtTimer=setTimeout(()=>thoughtEl.classList.remove('show'),4000);
}

function buildWorld(){
  groundY=H*0.72;
  platforms=[
    {x:-200,y:groundY,w:WORLD_W+400,h:H},
    {x:400, y:groundY-55, w:120,h:18},
    {x:800, y:groundY-80, w:100,h:18},
    {x:1400,y:groundY-60, w:130,h:18},
    {x:2000,y:groundY-75, w:110,h:18},
    {x:2600,y:groundY-50, w:150,h:18},
  ];
  fragments = tunables.fragments.map((f, i) => ({
    id: i,
    x: f.x,
    y: groundY + f.yOffset,
    collected: false,
    bob: i * 1.4,
  }));
  interactables=[
    {x:300, y:groundY-20,w:50,h:30,label:'첫 번째 집',text:'불이 켜져 있다.\n누군가 기다리고 있는 것 같다.'},
    {x:1200,y:groundY-20,w:50,h:30,label:'눈 쌓인 나무',text:'나무도 쉬고 있다.\n오늘밤은 모두가 이 눈 속에 있다.'},
    {x:2200,y:groundY-20,w:50,h:30,label:'나타샤의 불빛',text:'저 불빛이 나타샤다.\n조금만 더.'},
  ];
  player.x = tunables.playerStartX;
  player.y = groundY + tunables.playerStartY;
  donkey.x = tunables.donkeyStartX; donkey.y = groundY - donkey.h;
  natashaX=2800;
  moonRiseY=H*0.08;
}

function resolveEntity(ent){
  ent.vy+=tunables.gravity; ent.x+=ent.vx; ent.y+=ent.vy;
  ent.x=Math.max(40,Math.min(ent.x,WORLD_W-40));
  ent.onGround=false;
  platforms.forEach(p=>{
    const eb=ent.y+ent.h,prev=eb-ent.vy;
    const cx=ent.x+(ent===donkey?ent.w/2:0);
    const hw=ent===donkey?ent.w*0.4:8;
    if(cx+hw>p.x&&cx-hw<p.x+p.w&&prev<=p.y+2&&eb>=p.y&&ent.vy>=0){
      ent.y=p.y-ent.h; ent.vy=0; ent.onGround=true;
    }
  });
}

function updateEntities(){
  if(!gameStarted||gameOver)return;
  const t=Date.now()/1000;
  const L=keys['ArrowLeft']||keys['KeyA'];
  const R=keys['ArrowRight']||keys['KeyD'];
  const J=keys['ArrowUp']||keys['KeyW']||keys[' '];

  if(player.mounted){
    if(L){donkey.vx=-tunables.donkeySpeed;donkey.dir=-1;} if(R){donkey.vx=tunables.donkeySpeed;donkey.dir=1;}
    if(!L&&!R)donkey.vx*=0.58;
    if(J&&donkey.onGround){donkey.vy=tunables.donkeyJump;donkey.onGround=false;}
    resolveEntity(donkey);
    player.x=donkey.x+donkey.w/2-player.w/2; player.y=donkey.y-player.h+6;
    player.vx=donkey.vx; player.vy=donkey.vy; player.onGround=donkey.onGround; player.dir=donkey.dir;
    if(Math.abs(donkey.vx)>0.4){donkey.walkT+=0.09; donkey.tailWag=Math.sin(t*3)*12;}
  } else {
    if(L){player.vx=-tunables.moveSpeed;player.dir=-1;} if(R){player.vx=tunables.moveSpeed;player.dir=1;}
    if(!L&&!R)player.vx*=0.62;
    if(J&&player.onGround){player.vy=tunables.jumpForce;player.onGround=false;}
    resolveEntity(player);
    if(Math.abs(player.vx)>0.3)player.walkT+=0.10;
    const dd=player.x-(donkey.x+donkey.w/2);
    if(Math.abs(dd)>170){donkey.vx+=(dd>0?0.11:-0.11); donkey.vx=Math.max(-2.5,Math.min(2.5,donkey.vx)); donkey.dir=dd>0?1:-1;}
    else donkey.vx*=0.8;
    resolveEntity(donkey);
    if(Math.abs(donkey.vx)>0.3){donkey.walkT+=0.07; donkey.tailWag=Math.sin(t*2.5)*9;}
    else donkey.tailWag*=0.9;
    const dist=Math.hypot(player.x-(donkey.x+donkey.w/2),player.y+player.h/2-(donkey.y+donkey.h/2));
    nearDonkey=dist<95;
    document.getElementById('s5mount_hint').classList.toggle('show',nearDonkey);
  }

  player.breathT+=0.015;
  if(donkey.earsUp){donkey.earTimer+=0.04;if(donkey.earTimer>1)donkey.earsUp=false;}

  const anchor=player.mounted?donkey.x:player.x;
  camX+=(anchor-W*0.35-camX)*0.065;
  camX=Math.max(0,Math.min(camX,WORLD_W-W));

  // Natasha appears when player gets close enough
  const px=player.mounted?donkey.x:player.x;
  if(!natashaTriggered && px>2400){
    natashaTriggered=true;
    showNatashaEvent();
  }
  if(natashaVisible){
    natashaAlpha=Math.min(natashaAlpha+0.008,1);
    // Natasha walks toward player slowly
    if(!natashaWaiting){
      const nd=px-(natashaX+20);
      if(Math.abs(nd)>80){
        natashaX+=nd>0?-0.6:0.6; natashaDir=nd>0?-1:1;
        natashaWalkT+=0.07;
      } else {
        natashaWaiting=true;
        // donkey hears and brays
        donkey.earsUp=true; donkey.earTimer=0;
        // hint: press E to talk to her
        showThought('[ E ] 나타샤에게 말을 건다', natashaX, groundY-90);
      }
    }
  }

  // village glow increases as player approaches
  villageGlow=Math.min(Math.max(0,(px-1800)/1000),1);

  fragments.forEach(f=>{
    if(f.collected)return;
    if(!player.mounted){
      const dist=Math.hypot(player.x-f.x,player.y+player.h/2-f.y);
      if(dist<60) showThought('당나귀와 같이 오세요',f.x,f.y);
      return;
    }
    const cx=donkey.x+donkey.w/2;
    const cy=donkey.y+donkey.h/2;
    if(Math.hypot(cx-f.x,cy-f.y)<72) collectFrag(f);
  });

  const nearObj=interactables.find(ob=>Math.abs(player.x-(ob.x+ob.w/2))<80&&Math.abs((player.y+player.h)-ob.y)<100);
  cursorEl.classList.toggle('interact',!!nearObj||nearDonkey||(natashaVisible&&Math.abs(px-natashaX)<100));
}

function collectFrag(f){
  f.collected=true; collected++;
  document.getElementById('s5d'+f.id).classList.add('lit');
  (FRAG_LINES[f.id]||[]).forEach(li=>{ const el=document.getElementById('s5l'+li); if(el)el.classList.add('lit'); });
  const fl=document.getElementById('s5word_flash');
  fl.textContent=FRAG_WORDS[f.id];
  const _m=220, _sx=f.x-camX;
  fl.style.left=Math.max(_m,Math.min(_sx,window.innerWidth-_m))+'px'; fl.style.top=(f.y-32)+'px';
  // @TUNABLE popupFontSize
  fl.style.fontSize = tunables.popupFontSize + 'px';
  fl.classList.add('show');
  // @TUNABLE popupFadeMs
  setTimeout(()=>fl.classList.remove('show'), tunables.popupFadeMs);
}

function talkToNatasha(){
  natashaTalked=true;
  const overlay=document.getElementById('s5natasha_overlay');
  const txt=document.getElementById('s5natasha_text');
  const lines=['나타샤: "왔구나."','"같이 산골로 가자."','응앙— 응앙—'];
  overlay.classList.add('show');
  let i=0;
  function next(){
    if(i>=lines.length){
      // start ending while the bubble fades out (CSS transition ~2s)
      overlay.classList.remove('show');
      triggerEnding();
      return;
    }
    txt.textContent=lines[i++];
    setTimeout(next, 1800);
  }
  next();
}

let natashaLines=['나타샤가 왔다','…','응앙—'];
function showNatashaEvent(){
  natashaVisible=true;
  const overlay=document.getElementById('s5natasha_overlay');
  overlay.classList.add('show');
  let i=0;
  function next(){
    if(i>=natashaLines.length){ overlay.classList.remove('show'); return; }
    document.getElementById('s5natasha_text').textContent=natashaLines[i++];
    setTimeout(next, i===1?2800:2000);
  }
  setTimeout(next,600);
}

function triggerEnding(){
  gameOver=true; snowStop=true;
  // light all poem lines
  ['s5l0','s5l1','s5l2'].forEach(id=>{ const el=document.getElementById(id); if(el)el.classList.add('lit'); });
  setTimeout(()=>{
    document.getElementById('s5ending_screen').classList.add('show');
    setTimeout(()=>{ if(window.onGameComplete) window.onGameComplete(); }, 5000);
  },2000);
}

// ── DRAW ──
function drawSky(){
  // warm shift as player approaches village
  const warm=villageGlow;
  const r0=Math.round(5+warm*20), g0=Math.round(8+warm*10), b0=Math.round(16-warm*4);
  const r1=Math.round(10+warm*40), g1=Math.round(18+warm*20), b1=Math.round(32-warm*8);
  const sg=ctx.createLinearGradient(0,0,0,H);
  sg.addColorStop(0,`rgb(${r0},${g0},${b0})`);
  sg.addColorStop(1,`rgb(${r1},${g1},${b1})`);
  ctx.fillStyle=sg; ctx.fillRect(0,0,W,H);
}

function drawStars(){
  const t=Date.now()/1000;
  // stars fade in as snow stops (ending)
  const starAlpha = snowStop ? Math.min((Date.now()-starStopTime)/3000,1) : 0.6;
  for(let i=0;i<100;i++){
    const seed=i*137.5, ox=camX*0.01;
    const sx=((seed*91+ox)%W+W)%W, sy=(seed*46)%(groundY*0.72)+8;
    const br=(0.15+(Math.sin(t*0.8+i*0.7)*0.5+0.5)*0.5)*starAlpha;
    ctx.beginPath(); ctx.arc(sx,sy,i%7?0.5:1,0,Math.PI*2);
    ctx.fillStyle=`rgba(215,225,255,${br})`; ctx.fill();
  }
}
let starStopTime=Date.now();

function drawMoon(){
  // moon rises fully at ending
  const riseExtra = snowStop ? Math.min((Date.now()-starStopTime)/4000,1)*H*0.12 : 0;
  const mmx=W*0.68-camX*0.006, mmy=H*0.09-riseExtra;
  // bigger glow at ending
  const glowR=snowStop?120:80;
  const mg=ctx.createRadialGradient(mmx,mmy,0,mmx,mmy,glowR);
  mg.addColorStop(0,`rgba(220,230,255,${snowStop?0.18:0.1})`);
  mg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=mg; ctx.fillRect(0,0,W,H);
  const moonR=snowStop?28:20;
  ctx.beginPath(); ctx.arc(mmx,mmy,moonR,0,Math.PI*2);
  ctx.fillStyle=snowStop?'rgba(235,240,255,0.95)':'rgba(195,215,255,0.65)'; ctx.fill();
}

function drawFarMountains(){
  ctx.save(); ctx.translate(-camX*0.05,0);
  ctx.beginPath(); ctx.moveTo(-100,groundY+10);
  [[0,groundY-15],[300,groundY-100],[700,groundY-55],[1100,groundY-160],
   [1500,groundY-110],[1900,groundY-190],[2300,groundY-130],[2700,groundY-170],
   [3100,groundY-100],[3500,groundY-140],[3800,groundY+10]].forEach(([px,py])=>ctx.lineTo(px,py));
  ctx.closePath(); ctx.fillStyle='#06090f'; ctx.fill(); ctx.restore();
}

function drawForest(){
  ctx.save(); ctx.translate(-camX*0.18,0);
  for(let i=0;i<70;i++){
    const tx=i*68+((i*41)%36), th=65+((i*55)%75), ts=17+((i*29)%15), ty=groundY+8;
    ctx.strokeStyle='rgba(12,20,14,0.8)'; ctx.lineWidth=2.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx,ty-th*0.3); ctx.stroke();
    for(let l=0;l<4;l++){
      const ly=ty-th*0.18-l*th*0.21, lw=ts*(1.1-l*0.22);
      ctx.beginPath(); ctx.moveTo(tx-lw,ly); ctx.lineTo(tx,ly-th*0.19); ctx.lineTo(tx+lw,ly); ctx.closePath();
      ctx.fillStyle='rgba(10,16,12,0.9)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(tx-lw+2,ly); ctx.lineTo(tx,ly-th*0.16); ctx.lineTo(tx+lw-2,ly); ctx.closePath();
      ctx.fillStyle='rgba(185,210,235,0.45)'; ctx.fill();
    }
  }
  ctx.restore();
}

// Village — the warm destination
function drawVillage(){
  const vx=2600; // world coords
  const glow=villageGlow;
  // warm ambient
  if(glow>0){
    const vsx=vx-camX;
    const ag=ctx.createRadialGradient(vsx+180,groundY-50,0,vsx+180,groundY-50,350);
    ag.addColorStop(0,`rgba(240,170,60,${0.12*glow})`);
    ag.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=ag; ctx.fillRect(0,0,W,H);
  }
  // houses
  const houses=[
    {ox:0,  h:90, w:70, lit:true,  winX:0.25, winY:0.3},
    {ox:85, h:75, w:60, lit:true,  winX:0.3,  winY:0.35},
    {ox:160,h:100,w:80, lit:true,  winX:0.2,  winY:0.28},
    {ox:255,h:70, w:55, lit:false, winX:0.4,  winY:0.4},
    {ox:320,h:85, w:65, lit:true,  winX:0.3,  winY:0.32},
  ];
  const t=Date.now()/1000;
  houses.forEach(h=>{
    const hx=vx+h.ox-camX, hy=groundY-h.h;
    ctx.fillStyle='#0a1018'; ctx.fillRect(hx,hy,h.w,h.h+4);
    // roof
    ctx.beginPath(); ctx.moveTo(hx-4,hy); ctx.lineTo(hx+h.w/2,hy-24); ctx.lineTo(hx+h.w+4,hy); ctx.closePath();
    ctx.fillStyle='#080d14'; ctx.fill();
    // snow on roof
    ctx.beginPath(); ctx.moveTo(hx-2,hy); ctx.lineTo(hx+h.w/2,hy-22); ctx.lineTo(hx+h.w+2,hy); ctx.closePath();
    ctx.fillStyle='rgba(210,228,250,0.55)'; ctx.fill();
    if(h.lit){
      const wx=hx+h.w*h.winX, wy=hy+h.h*h.winY;
      const fl=0.8+Math.sin(t*1.2+h.ox)*0.1;
      const wg=ctx.createRadialGradient(wx+5,wy+5,0,wx+5,wy+5,28);
      wg.addColorStop(0,`rgba(255,200,90,${0.38*fl*glow})`); wg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=wg; ctx.fillRect(wx-18,wy-18,46,46);
      ctx.fillStyle=`rgba(255,215,120,${0.85*fl})`; ctx.fillRect(wx,wy,9,11);
    }
  });
  // village sign
  const sx=vx-30-camX;
  ctx.fillStyle='rgba(60,40,16,0.8)'; ctx.fillRect(sx,groundY-80,50,22);
  ctx.fillStyle='rgba(60,40,16,0.8)'; ctx.fillRect(sx+22,groundY-80,4,80);
  ctx.font='11px "Noto Serif KR",serif'; ctx.fillStyle='rgba(240,210,140,0.85)'; ctx.textAlign='center';
  ctx.fillText('산골마을',sx+25,groundY-64);
}

function drawGround(){
  const gg=ctx.createLinearGradient(0,groundY,0,H);
  gg.addColorStop(0,'#b8d0e8'); gg.addColorStop(0.1,'#98b8d2'); gg.addColorStop(1,'#486888');
  ctx.fillStyle=gg; ctx.fillRect(0,groundY,W,H-groundY);
  ctx.fillStyle='rgba(220,238,255,0.5)'; ctx.fillRect(0,groundY,W,4);
  platforms.slice(1).forEach(p=>{
    const px=p.x-camX; if(px>W+50||px+p.w<-50)return;
    ctx.fillStyle='#6a8aaa'; ctx.beginPath(); ctx.ellipse(px+p.w/2,p.y+p.h/2+4,p.w/2+4,p.h+2,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(200,222,245,0.65)'; ctx.beginPath(); ctx.ellipse(px+p.w/2,p.y,p.w/2+2,7,0,Math.PI,0); ctx.fill();
  });
}

function drawInteractableHints(){
  interactables.forEach(ob=>{
    const ox=ob.x-camX, dist=Math.abs(player.x-(ob.x+ob.w/2));
    if(dist<90){ ctx.font='11px "Noto Sans KR",sans-serif'; ctx.textAlign='center';
      ctx.fillStyle=`rgba(255,210,120,${Math.max(0,(90-dist)/90)*0.65})`;
      ctx.fillText('[ E ] '+ob.label,ox+ob.w/2,ob.y-14); }
  });
}

function drawFragments(){
  const t=Date.now()/1000;
  fragments.forEach(f=>{
    if(f.collected)return;
    const fx=f.x-camX; if(fx<-80||fx>W+80)return;
    const bob=Math.sin(t*1.3+f.bob)*5, fy=f.y-16+bob;
    const glw=ctx.createRadialGradient(fx,fy,0,fx,fy,52);
    glw.addColorStop(0,'rgba(255,200,80,0.22)'); glw.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glw; ctx.fillRect(fx-52,fy-52,104,104);
    ctx.save(); ctx.translate(fx,fy); ctx.rotate(Math.sin(t*0.65+f.bob)*0.1);
    const sc=1+Math.sin(t*1.7+f.bob)*0.04; ctx.scale(sc,sc);
    ctx.beginPath(); ctx.moveTo(0,-13);ctx.lineTo(9,0);ctx.lineTo(0,13);ctx.lineTo(-9,0);ctx.closePath();
    ctx.fillStyle='rgba(255,200,80,0.18)'; ctx.fill();
    ctx.strokeStyle='rgba(255,215,100,0.7)'; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fillStyle='rgba(255,230,150,0.95)'; ctx.fill();
    ctx.restore();
    const dist=Math.hypot((player.mounted?donkey.x+donkey.w/2:player.x)-f.x,(player.mounted?donkey.y+donkey.h/2:player.y+player.h/2)-f.y);
    if(dist<75){
      ctx.save(); ctx.globalAlpha=Math.max(0,(75-dist)/75);
      // @TUNABLE labelFontSize / labelOffsetY
      ctx.font=`${tunables.labelFontSize}px "Noto Serif KR",serif`; ctx.fillStyle='rgba(255,220,150,0.9)'; ctx.textAlign='center';
      ctx.fillText(FRAG_WORDS[f.id],fx,fy + tunables.labelOffsetY); ctx.restore();
    }
  });
}

// Natasha character
function drawNatasha(){
  if(!natashaVisible) return;
  const nx=natashaX-camX, ny=groundY-56;
  if(nx<-60||nx>W+60) return;
  ctx.save(); ctx.globalAlpha=natashaAlpha;
  ctx.translate(nx,ny); ctx.scale(natashaDir,1);
  const t=Date.now()/1000;
  const moving=!natashaWaiting;
  const legSw=moving?Math.sin(natashaWalkT)*11:0;
  const armSw=moving?Math.cos(natashaWalkT)*8:0;
  // shadow
  ctx.save(); ctx.scale(1,0.27); ctx.beginPath(); ctx.ellipse(0,56+12,10,4,0,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fill(); ctx.restore();
  // legs
  ctx.strokeStyle='#4a2a40'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-4,56*0.62); ctx.lineTo(-5-legSw*0.3,56); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4,56*0.62); ctx.lineTo(5+legSw*0.3,56); ctx.stroke();
  // dress/coat
  ctx.beginPath(); ctx.moveTo(-12,56*0.3); ctx.lineTo(-14,56*0.72); ctx.lineTo(14,56*0.72); ctx.lineTo(12,56*0.3); ctx.closePath();
  ctx.fillStyle='#4a2240'; ctx.fill();
  // arms
  ctx.strokeStyle='#4a2240'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(-9,56*0.33); ctx.lineTo(-15-armSw*0.4,56*0.54); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9,56*0.33); ctx.lineTo(15+armSw*0.4,56*0.5); ctx.stroke();
  // head
  const hy=56*0.12+Math.sin(t*1.3)*0.4;
  ctx.beginPath(); ctx.arc(0,hy,9,0,Math.PI*2); ctx.fillStyle='#c8a882'; ctx.fill();
  // hair (long)
  ctx.beginPath(); ctx.arc(0,hy-1,9,Math.PI,0); ctx.fillStyle='#1a0a0e'; ctx.fill();
  ctx.fillStyle='#1a0a0e';
  ctx.beginPath(); ctx.moveTo(-9,hy+2); ctx.quadraticCurveTo(-14,hy+20,-10,56*0.4); ctx.lineWidth=6; ctx.strokeStyle='#1a0a0e'; ctx.stroke();
  // breath
  const ba=(Math.sin(t*1.3)*0.5+0.5)*0.28;
  ctx.beginPath(); ctx.arc(-11,hy,4,0,Math.PI*2); ctx.fillStyle=`rgba(215,230,248,${ba})`; ctx.fill();
  // warm glow around Natasha
  ctx.save(); ctx.globalAlpha=0.15*natashaAlpha;
  const ng=ctx.createRadialGradient(0,56*0.4,0,0,56*0.4,60);
  ng.addColorStop(0,'rgba(255,200,100,0.4)'); ng.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=ng; ctx.fillRect(-60,-10,120,100);
  ctx.restore();
  ctx.restore();
}

function drawDonkey(){
  const t=Date.now()/1000;
  const dx=donkey.x-camX, dy=donkey.y;
  if(dx<-120||dx>W+120)return;
  ctx.save(); ctx.translate(dx,dy);
  if(donkey.dir<0) ctx.translate(donkey.w,0);
  ctx.scale(donkey.dir,1);
  const moving=Math.abs(donkey.vx)>0.3;
  const legSw=moving?Math.sin(donkey.walkT)*13:0;
  ctx.save(); ctx.scale(1,0.25); ctx.beginPath(); ctx.ellipse(donkey.w/2,donkey.h+14,donkey.w/2+4,8,0,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fill(); ctx.restore();
  ctx.strokeStyle='#d8d0c0'; ctx.lineWidth=5; ctx.lineCap='round';
  [[14,-1],[24,1],[44,-1],[56,1]].forEach(([lx,ph],i)=>{
    const sw=legSw*ph*(i<2?1:-1);
    ctx.beginPath(); ctx.moveTo(lx,donkey.h*0.72); ctx.lineTo(lx+sw*0.4,donkey.h); ctx.stroke();
  });
  ctx.beginPath(); ctx.ellipse(donkey.w/2,donkey.h*0.52,donkey.w/2-2,donkey.h*0.28,0,0,Math.PI*2);
  ctx.fillStyle='#ece4d4'; ctx.fill(); ctx.strokeStyle='#ccc4b4'; ctx.lineWidth=0.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(donkey.w*0.72,donkey.h*0.3); ctx.quadraticCurveTo(donkey.w*0.85,donkey.h*0.1,donkey.w*0.88,donkey.h*0.04);
  ctx.strokeStyle='#e4dcd0'; ctx.lineWidth=11; ctx.lineCap='round'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(donkey.w*0.88,donkey.h*0.04,10,8,0.3,0,Math.PI*2); ctx.fillStyle='#e4dcd0'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(donkey.w*0.96,donkey.h*0.06,7,5,0.2,0,Math.PI*2); ctx.fillStyle='#ccc0b0'; ctx.fill();
  ctx.beginPath(); ctx.arc(donkey.w*0.9,donkey.h*0.0,2.5,0,Math.PI*2); ctx.fillStyle='#2a1a08'; ctx.fill();
  const earR=donkey.earsUp?-donkey.earTimer*8:0;
  ctx.fillStyle='#dcd4c4';
  ctx.beginPath(); ctx.moveTo(donkey.w*0.83,donkey.h*-0.02); ctx.lineTo(donkey.w*0.80,donkey.h*-0.12+earR); ctx.lineTo(donkey.w*0.87,donkey.h*-0.06+earR); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(donkey.w*0.91,donkey.h*-0.03); ctx.lineTo(donkey.w*0.89,donkey.h*-0.14+earR); ctx.lineTo(donkey.w*0.95,donkey.h*-0.07+earR); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#e8a8a0';
  ctx.beginPath(); ctx.moveTo(donkey.w*0.83,donkey.h*-0.01); ctx.lineTo(donkey.w*0.81,donkey.h*-0.10+earR); ctx.lineTo(donkey.w*0.86,donkey.h*-0.05+earR); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(6,donkey.h*0.42); ctx.quadraticCurveTo(-12+(donkey.tailWag||0),donkey.h*0.28,-8+(donkey.tailWag||0)*1.4,donkey.h*0.15);
  ctx.strokeStyle='#c4bca8'; ctx.lineWidth=4; ctx.lineCap='round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(-8+(donkey.tailWag||0)*1.4,donkey.h*0.14,5,0,Math.PI*2); ctx.fillStyle='#aaa098'; ctx.fill();
  if(player.mounted){
    ctx.fillStyle='#4a2e14'; ctx.beginPath(); ctx.ellipse(donkey.w/2,donkey.h*0.24,18,8,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#6a4022'; ctx.beginPath(); ctx.ellipse(donkey.w/2,donkey.h*0.22,14,5,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#7a5030'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(donkey.w/2-12,donkey.h*0.24); ctx.lineTo(donkey.w/2-14,donkey.h*0.48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(donkey.w/2+12,donkey.h*0.24); ctx.lineTo(donkey.w/2+14,donkey.h*0.48); ctx.stroke();
  }
  // happy bray when near natasha
  if(natashaWaiting&&Math.sin(Date.now()/1800)>0.88){
    ctx.font='13px "Noto Serif KR",serif'; ctx.fillStyle='rgba(255,225,150,0.85)'; ctx.textAlign='center';
    ctx.fillText('응앙—',donkey.w/2,donkey.h*-0.25);
  }
  ctx.restore();
}

function drawPlayer(){
  if(player.mounted){ drawPlayerMounted(); return; }
  const px=player.x-camX, py=player.y;
  const t=Date.now()/1000;
  const moving=Math.abs(player.vx)>0.3;
  const legSw=moving?Math.sin(player.walkT)*12:0;
  const armSw=moving?Math.cos(player.walkT)*8:0;
  ctx.save(); ctx.translate(px,py); ctx.scale(player.dir,1);
  ctx.save(); ctx.scale(1,0.27); ctx.beginPath(); ctx.ellipse(0,player.h+12,11,5,0,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fill(); ctx.restore();
  ctx.strokeStyle='#162030'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-4,player.h*0.62); ctx.lineTo(-6-legSw*0.3,player.h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4,player.h*0.62); ctx.lineTo(6+legSw*0.3,player.h); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-10,player.h*0.28,20,player.h*0.42,3); ctx.fillStyle='#162030'; ctx.fill();
  ctx.strokeStyle='#162030'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(-9,player.h*0.33); ctx.lineTo(-15-armSw*0.4,player.h*0.54); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9,player.h*0.33); ctx.lineTo(15+armSw*0.4,player.h*0.5); ctx.stroke();
  const hy=player.h*0.14+Math.sin(player.breathT*1.4)*0.5;
  ctx.beginPath(); ctx.arc(0,hy,9,0,Math.PI*2); ctx.fillStyle='#c0a07a'; ctx.fill();
  ctx.beginPath(); ctx.arc(0,hy-2,9,Math.PI,0); ctx.fillStyle='#180e06'; ctx.fill();
  ctx.fillStyle='#1a2840'; ctx.beginPath(); ctx.ellipse(0,hy-8,10,4,0,0,Math.PI*2); ctx.fill();
  ctx.fillRect(-9,hy-16,18,10);
  ctx.beginPath(); ctx.ellipse(0,hy-16,9,3,0,0,Math.PI*2); ctx.fill();
  const ba=(Math.sin(Date.now()/700)*0.5+0.5)*0.28+0.08;
  ctx.beginPath(); ctx.arc(11,hy,4.5,0,Math.PI*2); ctx.fillStyle=`rgba(215,230,248,${ba})`; ctx.fill();
  ctx.restore();
}
function drawPlayerMounted(){
  const px=donkey.x-camX+donkey.w/2-player.w/2, py=donkey.y-player.h+6;
  ctx.save(); ctx.translate(px+player.w/2,py); ctx.scale(donkey.dir,1);
  ctx.strokeStyle='#162030'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-8,player.h*0.65); ctx.lineTo(-14,player.h*0.95); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8,player.h*0.65); ctx.lineTo(14,player.h*0.95); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-10,player.h*0.25,20,player.h*0.45,3); ctx.fillStyle='#162030'; ctx.fill();
  ctx.strokeStyle='#162030'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(9,player.h*0.35); ctx.lineTo(20,player.h*0.55); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9,player.h*0.35); ctx.lineTo(-18,player.h*0.55); ctx.stroke();
  const hy=player.h*0.12;
  ctx.beginPath(); ctx.arc(0,hy,9,0,Math.PI*2); ctx.fillStyle='#c0a07a'; ctx.fill();
  ctx.beginPath(); ctx.arc(0,hy-2,9,Math.PI,0); ctx.fillStyle='#180e06'; ctx.fill();
  ctx.fillStyle='#1a2840'; ctx.beginPath(); ctx.ellipse(0,hy-8,10,4,0,0,Math.PI*2); ctx.fill();
  ctx.fillRect(-9,hy-16,18,10); ctx.beginPath(); ctx.ellipse(0,hy-16,9,3,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawSnow(){
  if(snowStop){
    // snow fading out at ending
    const fade=Math.max(0,1-(Date.now()-starStopTime)/2500);
    if(fade<=0) return;
    ctx.save(); ctx.globalAlpha=fade;
    snowPtcls.forEach(s=>{ ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fillStyle=`rgba(200,218,245,0.2)`; ctx.fill(); });
    ctx.restore(); return;
  }
  const t=Date.now()/1000;
  snowPtcls.forEach(s=>{
    s.y+=s.sp; s.x+=s.dr+Math.sin(t*0.3+s.ph)*0.1;
    if(s.y>H+5){s.y=-5;s.x=Math.random()*W;}
    if(s.x>W)s.x=0; if(s.x<0)s.x=W;
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle=`rgba(205,222,248,${0.18+s.r*0.06})`; ctx.fill();
  });
}

// Ending: floating poem lines in the sky
let floatingPoems=[];
let floatingStarted=false;
function startFloatingPoems(){
  if(floatingStarted)return; floatingStarted=true;
  const lines=[
    '가난한 내가','아름다운 나타샤를 사랑해서','오늘밤은 푹푹 눈이 나린다',
    '나타샤와 나는','눈이 푹푹 쌓이는 밤 흰 당나귀 타고','산골로 가자',
    '나타샤는 나를 사랑하고','응앙응앙 울 것이다',
  ];
  lines.forEach((line,i)=>{
    setTimeout(()=>{
      floatingPoems.push({
        text:line, x:W*(0.2+Math.random()*0.6), y:groundY*0.8,
        targetY:groundY*(0.1+Math.random()*0.55),
        alpha:0, size:13+Math.random()*3,
      });
    }, i*400+500);
  });
}
function updateDrawFloatingPoems(){
  if(!snowStop)return;
  if(floatingPoems.length===0&&snowStop) startFloatingPoems();
  floatingPoems.forEach(p=>{
    p.alpha=Math.min(p.alpha+0.008,0.75);
    p.y+=(p.targetY-p.y)*0.012;
    ctx.save(); ctx.globalAlpha=p.alpha;
    ctx.font=`${p.size}px "Noto Serif KR",serif`;
    ctx.fillStyle='rgba(255,225,160,0.95)';
    ctx.textAlign='center';
    ctx.shadowColor='rgba(220,170,60,0.5)'; ctx.shadowBlur=15;
    ctx.fillText(p.text,p.x,p.y);
    ctx.restore();
  });
}

let _running = false;
function gameLoop(){
  if (!_running) return;
  ctx.clearRect(0,0,W,H);
  drawSky(); drawStars(); drawMoon();
  drawFarMountains(); drawForest();
  drawVillage(); drawGround();
  drawSnow();
  drawInteractableHints(); drawFragments();
  drawNatasha();
  drawDonkey(); drawPlayer();
  updateDrawFloatingPoems();
  updateEntities();
  requestAnimationFrame(gameLoop);
}

function resetStateS5(){
  resize();
  player.x = tunables.playerStartX;
  player.y = groundY + tunables.playerStartY;
  player.vx = 0; player.vy = 0; player.dir = 1; player.mounted = false; player.onGround = false;
  donkey.x = tunables.donkeyStartX;
  donkey.y = groundY - donkey.h;
  donkey.vx = 0; donkey.vy = 0;
  collected = 0;
  gameOver = false;
  camX = 0;
  natashaTriggered = false; natashaVisible = false; natashaAlpha = 0;
  natashaWaiting = false; natashaTalked = false;
  endingTriggered = false; moonRising = false; snowStop = false;
  fragments.forEach((f) => (f.collected = false));
  for (let i = 0; i < fragments.length; i++) {
    document.getElementById('s5d' + i)?.classList.remove('lit');
  }
  document.querySelectorAll('#sw5 .poem-line').forEach((l) => l.classList.remove('lit'));
  document.getElementById('s5ending_screen')?.classList.remove('show');
  document.getElementById('s5natasha_overlay')?.classList.remove('show');
  document.getElementById('s5mounted_bar')?.classList.remove('show');
}

function gameStartS5(){
  gameStarted = true;
  resetStateS5();
  if (!_running) {
    _running = true;
    requestAnimationFrame(gameLoop);
  }
}

// ─────────────────────────────────────────
//  ADMIN API
// ─────────────────────────────────────────
(window as any).s5API = {
  tunables,
  schema: {
    playerStartX:  { min: 0,    max: 3500, step: 10,  label: '캐릭터 시작 X' },
    playerStartY:  { min: -200, max: 0,    step: 1,   label: '캐릭터 시작 Y' },
    jumpForce:     { min: -20,  max: -3,   step: 0.5, label: '점프 힘' },
    moveSpeed:     { min: 0.5,  max: 8,    step: 0.1, label: '이동 속도' },
    gravity:       { min: 0.1,  max: 1.5,  step: 0.05,label: '중력' },
    donkeySpeed:   { min: 0.5,  max: 10,   step: 0.1, label: '당나귀 속도' },
    donkeyJump:    { min: -20,  max: -3,   step: 0.5, label: '당나귀 점프' },
    donkeyStartX:  { min: 0,    max: 3500, step: 10,  label: '당나귀 시작 X' },
    labelOffsetY:  { min: -80,  max: 0,    step: 1,   label: '다이아 라벨 Y' },
    labelFontSize: { min: 8,    max: 32,   step: 1,   label: '다이아 라벨 크기' },
    popupFontSize: { min: 10,   max: 48,   step: 1,   label: '수집 팝업 크기' },
    popupFadeMs:   { min: 200,  max: 5000, step: 100, label: '수집 팝업 시간(ms)' },
  },
  fragmentSchema: { xMin: 0, xMax: 3600, yOffsetMin: -300, yOffsetMax: 0 },
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
  restart: gameStartS5,
};

resize();

window.gameStartS5 = gameStartS5;
window.initStage5 = function() { resize(); };

}
