"use strict";

// ─── PERSIST ──────────────────────────────────────────────────
const DB = {
  d: { rb:null,ravg:null,rn:0,rt:[],tb:0,cb:0 },
  load(){ try{ Object.assign(this.d, JSON.parse(localStorage.getItem('mtracer_v2')||'{}')); }catch(e){} },
  save(){ localStorage.setItem('mtracer_v2', JSON.stringify(this.d)); },
};
DB.load();

// ─── ROUTING ──────────────────────────────────────────────────
function showPage(id){
  ['pgHome','pgReact','pgTrack','pgCPS'].forEach(p=>{
    const el=document.getElementById(p);
    if(p===id){ el.classList.remove('pg-hide'); el.classList.add('pg-show'); }
    else       { el.classList.remove('pg-show'); el.classList.add('pg-hide'); }
  });
}

// ═══════════════════════════════════════════════════════════════
//  AUDIO ENGINE
// ═══════════════════════════════════════════════════════════════
let _ac=null;
function AC(){
  if(!_ac){
    _ac=new(window.AudioContext||window.webkitAudioContext)();
    const u=()=>{if(_ac.state==='suspended')_ac.resume();['mousedown','touchstart'].forEach(e=>removeEventListener(e,u));};
    ['mousedown','touchstart'].forEach(e=>addEventListener(e,u));
  }
  if(_ac.state==='suspended')_ac.resume();
  return _ac;
}
let _sfxG=null;
function SFX(){ const a=AC(); if(!_sfxG){_sfxG=a.createGain();_sfxG.gain.value=.65;_sfxG.connect(a.destination);} return _sfxG; }
let _nb=null;
function NB(){ const a=AC(); if(_nb)return _nb; const b=a.createBuffer(1,a.sampleRate*.4,a.sampleRate); const d=b.getChannelData(0); for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1; return(_nb=b); }

function tone(f1,f2,dur,vol,tp='sine'){
  try{
    const a=AC(),t=a.currentTime,m=SFX();
    const g=a.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); g.connect(m);
    const o=a.createOscillator(); o.type=tp; o.frequency.setValueAtTime(f1,t); o.frequency.exponentialRampToValueAtTime(f2,t+dur*.85); o.connect(g); o.start(t); o.stop(t+dur+.02);
  }catch(e){}
}
function nz(fc,dur,vol){
  try{
    const a=AC(),t=a.currentTime,m=SFX();
    const ns=a.createBufferSource(); ns.buffer=NB();
    const f=a.createBiquadFilter(); f.type='lowpass'; f.frequency.value=fc;
    const g=a.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
    ns.connect(f); f.connect(g); g.connect(m); ns.start(t); ns.stop(t+dur+.05);
  }catch(e){}
}

const sfx={
  go()     { tone(380,820,.14,.42,'triangle'); setTimeout(()=>tone(620,1200,.1,.28,'triangle'),60); },
  hit()    { tone(680,280,.08,.38); nz(2600,.06,.42); },
  miss()   { tone(180,60,.2,.35,'sawtooth'); nz(280,.15,.28); },
  early()  { tone(130,60,.22,.45,'sawtooth'); },
  click()  { tone(800,320,.055,.18,'triangle'); },
  ding()   { tone(900,1200,.1,.3,'sine'); },
  beep3()  { tone(460,460,.1,.3,'sine'); },
  beepGo() { tone(700,1200,.2,.5,'triangle'); },
  spawn()  { tone(520,420,.06,.12,'sine'); },  // subtle target-appear tick
};

// ═══════════════════════════════════════════════════════════════
//  MUSIC — ambient generative electronic
// ═══════════════════════════════════════════════════════════════
let MUS=null, musOn=false;

function startMusic(){
  if(MUS||!musOn) return;
  try{
    const a=AC();
    const mGain=a.createGain(); mGain.gain.value=0;
    mGain.gain.linearRampToValueAtTime(.22, a.currentTime+2);
    mGain.connect(a.destination);

    // Master compressor for polish
    const comp=a.createDynamicsCompressor();
    comp.threshold.value=-18; comp.knee.value=6;
    comp.ratio.value=3; comp.attack.value=.003; comp.release.value=.25;
    comp.connect(mGain);

    // Reverb convolver (simple IR)
    const revLen=a.sampleRate*2.2;
    const revBuf=a.createBuffer(2,revLen,a.sampleRate);
    for(let ch=0;ch<2;ch++){const d=revBuf.getChannelData(ch);for(let i=0;i<revLen;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/revLen,2.2);}
    const rev=a.createConvolver(); rev.buffer=revBuf;
    const revGain=a.createGain(); revGain.gain.value=.28; rev.connect(revGain); revGain.connect(comp);
    const dryGain=a.createGain(); dryGain.gain.value=.72; dryGain.connect(comp);

    const hz=n=>440*Math.pow(2,(n-69)/12);

    // Chord progression — Am → F → C → G (dreamy electronic)
    const CHORDS=[
      [57,60,64,69],  // Am7
      [53,57,60,65],  // Fmaj7
      [48,52,55,60],  // Cmaj7
      [55,59,62,67],  // G add9
    ];
    const BAS=[45,41,48,43]; // bass notes

    let sc=a.currentTime+.1, bar=0;
    const BLEN=1.85; // seconds per bar

    function sched(){
      if(!MUS)return;
      while(sc < a.currentTime+4){
        const ci=bar%CHORDS.length;
        const chord=CHORDS[ci];

        // ── PAD (slow attack chords) ──
        chord.forEach((note,i)=>{
          const pO=a.createOscillator(); const pG=a.createGain();
          pO.type='sine'; pO.frequency.value=hz(note)+(i%2===0?0:.18);
          pG.gain.setValueAtTime(0,sc);
          pG.gain.linearRampToValueAtTime(.038+i*.006,sc+.35);
          pG.gain.linearRampToValueAtTime(.03+i*.005,sc+BLEN*.85);
          pG.gain.linearRampToValueAtTime(0,sc+BLEN);
          pO.connect(pG); pG.connect(dryGain); pG.connect(rev);
          pO.start(sc); pO.stop(sc+BLEN+.05);
        });

        // ── BASS ──
        const bO=a.createOscillator(); const bG=a.createGain();
        bO.type='triangle'; bO.frequency.value=hz(BAS[ci]);
        bG.gain.setValueAtTime(0,sc);
        bG.gain.linearRampToValueAtTime(.09,sc+.04);
        bG.gain.exponentialRampToValueAtTime(.001,sc+BLEN*.9);
        bO.connect(bG); bG.connect(dryGain); bO.start(sc); bO.stop(sc+BLEN);

        // ── KICK (every bar) ──
        {const kG=a.createGain();kG.gain.setValueAtTime(.55,sc);kG.gain.exponentialRampToValueAtTime(.001,sc+.24);kG.connect(comp);const kO=a.createOscillator();kO.frequency.setValueAtTime(120,sc);kO.frequency.exponentialRampToValueAtTime(28,sc+.18);kO.connect(kG);kO.start(sc);kO.stop(sc+.26);}

        // ── SNARE (on beat 2) ──
        {const sn=a.createBufferSource();sn.buffer=NB();const sf=a.createBiquadFilter();sf.type='bandpass';sf.frequency.value=1800;sf.Q.value=.8;const sg=a.createGain();sg.gain.setValueAtTime(.28,sc+BLEN*.5);sg.gain.exponentialRampToValueAtTime(.001,sc+BLEN*.5+.11);sn.connect(sf);sf.connect(sg);sg.connect(comp);sn.start(sc+BLEN*.5);sn.stop(sc+BLEN*.5+.13);}

        // ── HI-HAT (every beat) ──
        [0,.5,1,1.5].forEach(beat=>{
          const hh=a.createBufferSource();hh.buffer=NB();
          const hf=a.createBiquadFilter();hf.type='highpass';hf.frequency.value=9000;
          const hg=a.createGain();hg.gain.setValueAtTime(.07,sc+beat*(BLEN/2));
          hg.gain.exponentialRampToValueAtTime(.001,sc+beat*(BLEN/2)+.07);
          hh.connect(hf);hf.connect(hg);hg.connect(comp);
          hh.start(sc+beat*(BLEN/2));hh.stop(sc+beat*(BLEN/2)+.08);
        });

        // ── ARPEGGIO (sparse high notes) ──
        if(bar%2===0){
          const arpNotes=chord.map(n=>n+12);
          [0,.25,.75,1.25].forEach((off,i)=>{
            const nn=arpNotes[i%arpNotes.length];
            const aO=a.createOscillator();const aG=a.createGain();
            aO.type='triangle';aO.frequency.value=hz(nn);
            aG.gain.setValueAtTime(0,sc+off*BLEN*.5);
            aG.gain.linearRampToValueAtTime(.025,sc+off*BLEN*.5+.02);
            aG.gain.exponentialRampToValueAtTime(.001,sc+off*BLEN*.5+.18);
            aO.connect(aG);aG.connect(dryGain);aG.connect(rev);
            aO.start(sc+off*BLEN*.5);aO.stop(sc+off*BLEN*.5+.2);
          });
        }

        sc+=BLEN; bar++;
      }
      MUS._raf=requestAnimationFrame(sched);
    }

    MUS={ _raf:null, gain:mGain,
      stop(){
        cancelAnimationFrame(this._raf);
        this.gain.gain.setTargetAtTime(0,a.currentTime,.4);
        setTimeout(()=>{try{this.gain.disconnect();}catch(e){}},1500);
      }
    };
    sched();
  }catch(e){ MUS=null; }
}

function stopMusic(){
  if(MUS){ MUS.stop(); MUS=null; }
}

function toggleMusic(){
  musOn=!musOn;
  const btn=document.getElementById('musicBtn');
  if(musOn){ btn.classList.add('playing'); btn.textContent='♪'; startMusic(); }
  else      { btn.classList.remove('playing'); stopMusic(); }
}

document.getElementById('musicBtn').addEventListener('click',()=>{ AC(); toggleMusic(); });

// ─── FLOAT TEXT ───────────────────────────────────────────────
function ft(x,y,txt,cls){
  const el=document.createElement('div');
  el.className='ft '+(cls||'');
  el.textContent=txt; el.style.left=x+'px'; el.style.top=y+'px';
  document.getElementById('fl').appendChild(el);
  setTimeout(()=>{ if(el.parentNode)el.remove(); },900);
}
function shake(){ document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); }

// ─── SYNC HOME ────────────────────────────────────────────────
function syncHome(){
  const d=DB.d;
  const re=document.getElementById('hReactBest');
  const te=document.getElementById('hTrackBest');
  const ce=document.getElementById('hCPSBest');
  if(re) re.textContent=d.rb?'BEST  '+d.rb+'ms':'';
  if(te) te.textContent=d.tb?'BEST  '+d.tb:'';
  if(ce) ce.textContent=d.cb?'BEST  '+d.cb+' cps':'';
}

// ═══════════════════════════════════════════════════════════════
//  MODE 1 — REACTION TEST
// ═══════════════════════════════════════════════════════════════
const R={state:'idle',timer:null,goAt:null,sess:[]};

function rScreen(id){
  ['rIdle','rWait','rGo','rEarly','rResult'].forEach(s=>{
    const el=document.getElementById(s);
    if(!el) return;
    el.style.display=(s===id)?'flex':'none';
  });
  R.state=id;
}

function rUpdateRecords(){
  const d=DB.d,lines=[];
  if(d.rb)   lines.push(`BEST &nbsp;&nbsp;&nbsp;&nbsp; <b>${d.rb}ms</b>`);
  if(d.ravg) lines.push(`AVERAGE &nbsp;<b>${d.ravg}ms</b>`);
  if(d.rn)   lines.push(`ATTEMPTS &nbsp;<b>${d.rn}</b>`);
  document.getElementById('rRecords').innerHTML=lines.join('<br>');
}

function rStart(){ AC(); R.sess=[]; rRound(); }

function rRound(){
  rScreen('rWait');
  R.timer=setTimeout(rGo, 1500+Math.random()*4500);
}

function rGo(){
  rScreen('rGo');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    R.goAt=performance.now(); sfx.go();
  }));
}

document.getElementById('pgReact').addEventListener('pointerdown',e=>{
  AC();
  if(e.target.closest('button')) return;
  if(R.state==='rIdle') return;
  if(R.state==='rWait'){ clearTimeout(R.timer); sfx.early(); rScreen('rEarly'); return; }
  if(R.state==='rGo'&&R.goAt!==null){
    const ms=Math.round(performance.now()-R.goAt);
    rRecord(ms);
  }
});

function rRecord(ms){
  R.sess.push(ms); sfx.hit();
  const d=DB.d;
  d.rn=(d.rn||0)+1;
  d.rt=d.rt||[]; d.rt.push(ms); if(d.rt.length>200)d.rt=d.rt.slice(-200);
  d.rb=d.rb?Math.min(d.rb,ms):ms;
  d.ravg=Math.round(d.rt.reduce((a,b)=>a+b,0)/d.rt.length);
  DB.save(); syncHome(); rResult(ms);
}

function rResult(ms){
  const g=rGrade(ms);
  const te=document.getElementById('rTime');
  te.textContent=ms+'ms'; te.style.color=g.col;
  const ge=document.getElementById('rGrade');
  ge.textContent=g.txt; ge.style.color=g.col;
  const d=DB.d;
  const sAvg=R.sess.length>1?Math.round(R.sess.reduce((a,b)=>a+b,0)/R.sess.length):null;
  const parts=[];
  if(d.rb)   parts.push(`<div><div>ALL TIME BEST</div><b>${d.rb}ms</b></div>`);
  if(d.ravg) parts.push(`<div><div>LIFETIME AVG</div><b>${d.ravg}ms</b></div>`);
  if(sAvg&&R.sess.length>1) parts.push(`<div><div>SESSION AVG</div><b>${sAvg}ms</b></div>`);
  document.getElementById('rStats').innerHTML=parts.join('');
  rScreen('rResult');
}

const RGRADES=[
  {ms:150,txt:'⚡ SUPERHUMAN',   col:'#c47fff'},
  {ms:200,txt:'🏆 ELITE',        col:'#ffd65c'},
  {ms:250,txt:'🔥 EXCELLENT',    col:'#24f07a'},
  {ms:300,txt:'💪 ABOVE AVERAGE',col:'#49d9ff'},
  {ms:400,txt:'📈 AVERAGE',      col:'#ffb347'},
  {ms:500,txt:'👍 BELOW AVERAGE',col:'#ff8a65'},
  {ms:9999,txt:'🐢 SLOW CLICK',  col:'#4a5a72'},
];
function rGrade(ms){ return RGRADES.find(g=>ms<=g.ms)||RGRADES[RGRADES.length-1]; }

document.getElementById('rBtnStart').addEventListener('click',      e=>{ e.stopPropagation(); sfx.click(); rStart(); });
document.getElementById('rBtnEarlyRetry').addEventListener('click', e=>{ e.stopPropagation(); sfx.click(); rRound(); });
document.getElementById('rBtnAgain').addEventListener('click',      e=>{ e.stopPropagation(); sfx.click(); rRound(); });
document.getElementById('rBtnDone').addEventListener('click',       e=>{ e.stopPropagation(); sfx.click(); rUpdateRecords(); rScreen('rIdle'); });
document.getElementById('rBack').addEventListener('click',          e=>{ e.stopPropagation(); clearTimeout(R.timer); R.goAt=null; rScreen('rIdle'); showPage('pgHome'); });

// ═══════════════════════════════════════════════════════════════
//  MODE 2 — AIM TRAINER
// ═══════════════════════════════════════════════════════════════
const tcv=document.getElementById('trackCv');
const tcx=tcv.getContext('2d');
let TW,TH;
function tRez(){ TW=tcv.width=innerWidth; TH=tcv.height=innerHeight; }
window.addEventListener('resize',tRez); tRez();

// ── Aim mode toggle ───────────────────────────────────────────
let tInputMode = 'click'; // 'click' | 'hover'

document.querySelectorAll('.mtog-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    tInputMode = btn.dataset.mode;
    document.querySelectorAll('.mtog-btn').forEach(b=>b.classList.remove('mtog-active'));
    btn.classList.add('mtog-active');
    const hint=document.getElementById('tModeHint');
    if(hint) hint.textContent = tInputMode==='click' ? 'Click targets to score' : 'Hover over targets to score';
    sfx.click();
  });
});

const T={
  on:false, mx:TW/2, my:TH/2,
  targets:[], sparks:[],
  score:0, hits:0, misses:0, lives:3,
  level:1, hitsThisLevel:0,
  combo:0, bestCombo:0,
  startTime:0, lf:0,
};
const LEVEL_HIT=6; // level up every 6 hits — snappier progression
let tSpawnTimer=0;

function tLvlCfg(l){
  const k=l-1;
  return{
    // Life drains faster each level, floor at 600ms
    targetLife:  Math.max(600, 2400 - k*80),
    // Spawn delay shrinks — floor at 100ms  
    spawnDelay:  Math.max(100, 1000 - k*40),
    // Targets get smaller — floor at 14px radius
    radius:      Math.max(14, 36 - k*0.8),
    // How many can be on screen simultaneously
    // 1 → 2 → 3 → 4 → 5 at higher levels
    multi:       k<3?1 : k<7?2 : k<11?3 : k<16?4 : 5,
  };
}

function tMkTarget(){
  const cfg=tLvlCfg(T.level), r=cfg.radius, pad=r+60;
  return{
    x:pad+Math.random()*(TW-pad*2),
    y:pad+85+Math.random()*(TH-pad*2-85),
    r, life:cfg.targetLife, spawnT:Date.now(), hit:false,
  };
}

function tSpawn(){
  const cfg=tLvlCfg(T.level);
  const alive=T.targets.filter(t=>!t.hit).length;
  // At high levels, fill ALL empty slots every spawn tick
  const toSpawn=Math.min(cfg.multi-alive, cfg.multi);
  for(let i=0;i<toSpawn;i++) T.targets.push(tMkTarget());
}

function tCheckHit(mx,my){
  for(const t of T.targets){
    if(t.hit) continue;
    const dx=mx-t.x, dy=my-t.y;
    if(Math.sqrt(dx*dx+dy*dy)<=t.r*1.2) tHitTarget(t);
  }
}

function tHitTarget(t){
  t.hit=true; sfx.hit();
  T.hits++; T.combo++; if(T.combo>T.bestCombo)T.bestCombo=T.combo;
  T.score+=Math.round(10*T.level); T.hitsThisLevel++;
  for(let i=0;i<14;i++){
    const a=Math.PI*2*i/14+Math.random()*.5, sp=120+Math.random()*240;
    T.sparks.push({x:t.x,y:t.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,decay:.03+Math.random()*.03,sz:2.5+Math.random()*5,col:'#24f07a'});
  }
  // Streak bonuses — score only, no distracting toast mid-game
  if(T.combo===5)  { T.score+=50;  sfx.ding(); }
  if(T.combo===10) { T.score+=150; sfx.ding(); }
  if(T.combo===20) { T.score+=400; sfx.ding(); }
  // Level up
  if(T.hitsThisLevel>=LEVEL_HIT){
    T.level++; T.hitsThisLevel=0; sfx.ding();
    // Flash HUD badge
    const lb=document.getElementById('tHudLevelBadge');
    if(lb){ lb.style.color='#fff'; lb.style.boxShadow='0 0 18px #24f07a'; setTimeout(()=>{ lb.style.color=''; lb.style.boxShadow=''; },500); }
    // Small announcement near the top — not centre screen
    tLevelToast('LEVEL '+T.level);
  }
  tHudUpdate();
}

function tMissTarget(t){
  t.hit=true; T.misses++; T.combo=0; T.lives--;
  shake();
  // Flash miss sparks
  for(let i=0;i<8;i++){
    const a=Math.PI*2*i/8, sp=80+Math.random()*120;
    T.sparks.push({x:t.x,y:t.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,decay:.045+Math.random()*.03,sz:2+Math.random()*3,col:'#ff4060'});
  }
  tHudUpdate();
  if(T.lives<=0) setTimeout(tOver,400);
}

tcv.addEventListener('pointerdown',e=>{
  if(!T.on) return;
  T.mx=e.clientX; T.my=e.clientY;
  if(tInputMode==='click') tCheckHit(e.clientX,e.clientY);
});
tcv.addEventListener('mousemove',e=>{
  T.mx=e.clientX; T.my=e.clientY;
  if(T.on && tInputMode==='hover') tCheckHit(e.clientX,e.clientY);
});
tcv.addEventListener('touchstart',e=>{
  e.preventDefault(); if(!T.on) return;
  T.mx=e.touches[0].clientX; T.my=e.touches[0].clientY;
  tCheckHit(T.mx,T.my);
},{passive:false});

function tLevelToast(txt){
  const el=document.createElement('div');
  el.style.cssText=[
    'position:fixed',
    'left:50%',
    'top:88px',           // just below the HUD bar
    'transform:translateX(-50%) scale(.8)',
    'font-family:Syne,sans-serif',
    'font-size:clamp(.9rem,2.5vw,1.15rem)',
    'font-weight:800',
    'letter-spacing:.22em',
    'color:#24f07a',
    'background:rgba(8,9,15,.82)',
    'border:1px solid rgba(36,240,122,.28)',
    'border-radius:999px',
    'padding:7px 22px',
    'white-space:nowrap',
    'pointer-events:none',
    'z-index:300',
    'backdrop-filter:blur(8px)',
    'animation:lvlToast .9s cubic-bezier(.34,1.56,.64,1) forwards',
  ].join(';');
  el.textContent=txt;
  if(!document.getElementById('_ltkf')){
    const s=document.createElement('style');
    s.id='_ltkf';
    s.textContent='@keyframes lvlToast{0%{opacity:0;transform:translateX(-50%) scale(.75)}15%{opacity:1;transform:translateX(-50%) scale(1.04)}70%{opacity:1;transform:translateX(-50%) scale(1)}100%{opacity:0;transform:translateX(-50%) scale(.95) translateY(-8px)}}';
    document.head.appendChild(s);
  }
  document.body.appendChild(el);
  setTimeout(()=>{ if(el.parentNode)el.remove(); },950);
}

function tToast(txt){
  const el=document.createElement('div');
  el.style.cssText='position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);font-family:Syne,sans-serif;font-size:clamp(1.2rem,4vw,1.8rem);font-weight:800;letter-spacing:.14em;color:#24f07a;text-shadow:0 0 26px #24f07a;pointer-events:none;z-index:300;white-space:nowrap;animation:tst 1.1s ease forwards;';
  el.textContent=txt;
  if(!document.getElementById('_tstkf')){const s=document.createElement('style');s.id='_tstkf';s.textContent='@keyframes tst{0%{opacity:0;transform:translate(-50%,-50%) scale(.75)}12%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}78%{opacity:1}100%{opacity:0;transform:translate(-50%,-60%)}}';document.head.appendChild(s);}
  document.body.appendChild(el);
  setTimeout(()=>{if(el.parentNode)el.remove();},1100);
}

function tOvShow(id){
  ['tOvStart','tOvEnd'].forEach(s=>{ document.getElementById(s).style.display=(s===id)?'flex':'none'; });
}
function tHudShow(v){
  document.getElementById('tHud').style.display=v?'flex':'none';
  const bg=document.getElementById('tBackGame');
  if(bg) bg.style.display=v?'block':'none';
  tcv.style.display=v?'block':'none';
}

// (no pause system — back button handles exit)

function tStart(){
  AC();
  Object.assign(T,{on:true,targets:[],sparks:[],score:0,hits:0,misses:0,lives:3,level:1,hitsThisLevel:0,combo:0,bestCombo:0});
  T.startTime=performance.now(); tSpawnTimer=0;
  tOvShow('__none__'); tHudShow(true); tHudUpdate();
  T.lf=performance.now();
  requestAnimationFrame(tLoop);
}

function tOver(){
  T.on=false; tHudShow(false);
  const acc=T.hits+T.misses>0?Math.round(T.hits/(T.hits+T.misses)*100):0;
  if(T.score>(DB.d.tb||0)){ DB.d.tb=T.score; DB.save(); syncHome(); }
  document.getElementById('tRTracking').textContent=acc+'%';
  document.getElementById('tRTime').textContent=T.hits;
  document.getElementById('tRScore').textContent=T.score;
  document.getElementById('tRLevel').textContent=T.level;
  document.getElementById('tRStreak').textContent=T.bestCombo+'×';
  document.getElementById('tRBest').textContent=DB.d.tb||'—';
  tOvShow('tOvEnd');
}

function tHudUpdate(){
  const acc=T.hits+T.misses>0?Math.round(T.hits/(T.hits+T.misses)*100):0;
  document.getElementById('tHudScore').textContent=T.score;
  document.getElementById('tHudFill').style.width=acc+'%';
  document.getElementById('tHudTime').textContent=((performance.now()-T.startTime)/1000).toFixed(1)+'s';
  const lb=document.getElementById('tHudLevelBadge');
  if(lb) lb.textContent='LEVEL '+T.level;
  const lw=document.getElementById('tHudLives');
  if(lw){
    lw.innerHTML='';
    for(let i=0;i<3;i++){const d=document.createElement('div');d.className='t-life-pip'+(i>=T.lives?' gone':'');lw.appendChild(d);}
  }
}

// ── Canvas rendering ──────────────────────────────────────────
let _bgT=0;
function tDrawBg(dt){
  _bgT+=dt;
  tcx.fillStyle='#08090f'; tcx.fillRect(0,0,TW,TH);
  // Subtle grid
  tcx.strokeStyle='rgba(124,107,255,.04)'; tcx.lineWidth=1;
  const g=56;
  for(let x=0;x<TW;x+=g){tcx.beginPath();tcx.moveTo(x,0);tcx.lineTo(x,TH);tcx.stroke();}
  for(let y=0;y<TH;y+=g){tcx.beginPath();tcx.moveTo(0,y);tcx.lineTo(TW,y);tcx.stroke();}
  // Vignette
  const vg=tcx.createRadialGradient(TW/2,TH/2,TH*.1,TW/2,TH/2,TH*.88);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.55)');
  tcx.fillStyle=vg; tcx.fillRect(0,0,TW,TH);
  // HUD gradient
  const hg=tcx.createLinearGradient(0,0,0,80);
  hg.addColorStop(0,'rgba(8,9,15,.92)'); hg.addColorStop(1,'rgba(8,9,15,0)');
  tcx.fillStyle=hg; tcx.fillRect(0,0,TW,80);
  // Level tint — subtly shifts colour as you go deeper
  const tint=Math.min((T.level-1)/20,.06);
  if(tint>0){
    const wg=tcx.createRadialGradient(TW/2,TH/2,0,TW/2,TH/2,TH*.6);
    wg.addColorStop(0,`rgba(124,107,255,${tint})`); wg.addColorStop(1,'rgba(0,0,0,0)');
    tcx.fillStyle=wg; tcx.fillRect(0,0,TW,TH);
  }
}

function tDrawTarget(t,now){
  const age=now-t.spawnT;
  const urgency=Math.min(age/t.life,1);
  const sc=Math.min(age/100,1);
  const x=t.x,y=t.y,r=t.r;

  // Colour: violet→green→red as urgency rises
  let col;
  if(urgency<.5){ const f=urgency*2; col=`rgb(${Math.round(124+f*(-124+36))},${Math.round(107+f*133)},${Math.round(255+f*(-255+122))})`;  }
  else           { const f=(urgency-.5)*2; col=`rgb(${Math.round(36+f*219)},${Math.round(240-f*176)},${Math.round(122-f*122)})`; }

  tcx.save();
  if(sc<1){ tcx.translate(x,y); tcx.scale(sc,sc); tcx.translate(-x,-y); }

  // Drain arc
  tcx.strokeStyle=col.replace('rgb','rgba').replace(')',`,.6)`);
  tcx.lineWidth=3.5; tcx.lineCap='round';
  tcx.beginPath(); tcx.arc(x,y,r+10,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-urgency)); tcx.stroke();

  // Outer glow halo
  const grd=tcx.createRadialGradient(x,y,r*.4,x,y,r*2.5);
  grd.addColorStop(0,col.replace('rgb','rgba').replace(')',`,.2)`));
  grd.addColorStop(1,'rgba(0,0,0,0)');
  tcx.fillStyle=grd; tcx.beginPath(); tcx.arc(x,y,r*2.5,0,Math.PI*2); tcx.fill();

  // Body
  const bodyGrd=tcx.createRadialGradient(x-r*.3,y-r*.3,0,x,y,r);
  bodyGrd.addColorStop(0,'rgba(255,255,255,.38)');
  bodyGrd.addColorStop(.2,col);
  bodyGrd.addColorStop(1,col.replace('rgb','rgba').replace(')',`,.9)`));
  tcx.fillStyle=bodyGrd;
  tcx.strokeStyle='rgba(255,255,255,.18)'; tcx.lineWidth=2;
  tcx.shadowColor=col; tcx.shadowBlur=urgency>.65?32:18;
  tcx.beginPath(); tcx.arc(x,y,r,0,Math.PI*2); tcx.fill(); tcx.stroke();
  tcx.shadowBlur=0;

  // Center dot
  tcx.fillStyle='rgba(255,255,255,.92)'; tcx.shadowColor='#fff'; tcx.shadowBlur=10;
  tcx.beginPath(); tcx.arc(x,y,r*.15,0,Math.PI*2); tcx.fill(); tcx.shadowBlur=0;

  // Crosshair
  tcx.strokeStyle=col.replace('rgb','rgba').replace(')',`,.4)`); tcx.lineWidth=1;
  tcx.beginPath(); tcx.moveTo(x-r*.7,y); tcx.lineTo(x+r*.7,y); tcx.stroke();
  tcx.beginPath(); tcx.moveTo(x,y-r*.7); tcx.lineTo(x,y+r*.7); tcx.stroke();

  tcx.restore();
}

function tDrawSparks(dt){
  for(const p of T.sparks){
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=160*dt; p.life-=p.decay*dt;
    if(p.life<=0) continue;
    tcx.save(); tcx.globalAlpha=p.life; tcx.shadowColor=p.col; tcx.shadowBlur=8;
    tcx.fillStyle=p.col;
    tcx.beginPath(); tcx.arc(p.x,p.y,p.sz*p.life,0,Math.PI*2); tcx.fill();
    tcx.restore();
  }
  T.sparks=T.sparks.filter(p=>p.life>0);
}

function tDrawCursor(){
  const x=T.mx, y=T.my;
  const hov=T.targets.some(t=>!t.hit&&Math.sqrt((T.mx-t.x)**2+(T.my-t.y)**2)<=t.r*1.2);
  const col=hov?'rgba(36,240,122,.85)':'rgba(255,255,255,.5)';
  tcx.save();
  tcx.strokeStyle=col; tcx.lineWidth=1.5;
  if(hov){ tcx.shadowColor='#24f07a'; tcx.shadowBlur=16; }
  tcx.beginPath(); tcx.arc(x,y,11,0,Math.PI*2); tcx.stroke();
  tcx.beginPath(); tcx.moveTo(x-6,y); tcx.lineTo(x+6,y); tcx.stroke();
  tcx.beginPath(); tcx.moveTo(x,y-6); tcx.lineTo(x,y+6); tcx.stroke();
  if(hov){
    tcx.globalAlpha=.3; tcx.lineWidth=1;
    tcx.beginPath(); tcx.arc(x,y,20,0,Math.PI*2); tcx.stroke();
  }
  tcx.restore();
}

function tLoop(ts){
  if(!T.on) return;
  requestAnimationFrame(tLoop);
  const raw=Math.min(ts-(T.lf||ts),50); T.lf=ts;
  const dt=raw/1000;
  tSpawnTimer+=raw;
  const cfg=tLvlCfg(T.level);
  if(tSpawnTimer>=cfg.spawnDelay){ tSpawnTimer=0; tSpawn(); }
  const now=Date.now();
  // Each target uses its OWN stored life — never overwrite it
  for(const t of T.targets){
    if(!t.hit && now-t.spawnT>=t.life) tMissTarget(t);
  }
  T.targets=T.targets.filter(t=>!t.hit);
  tDrawBg(dt);
  for(const t of T.targets) tDrawTarget(t,now);
  tDrawSparks(dt);
  tDrawCursor();
  tHudUpdate();
}

document.getElementById('tBtnStart').addEventListener('click',()=>{ sfx.click(); tStart(); });
document.getElementById('tBtnRetry').addEventListener('click',()=>{ sfx.click(); tStart(); });
document.getElementById('tBtnMenu').addEventListener('click', ()=>{ sfx.click(); T.on=false; tHudShow(false); document.getElementById('tOvStart').style.display='none'; document.getElementById('tOvEnd').style.display='none'; showPage('pgHome'); });
document.getElementById('tBack').addEventListener('click',    ()=>{ sfx.click(); T.on=false; tHudShow(false); document.getElementById('tOvStart').style.display='none'; showPage('pgHome'); });
document.getElementById('tBackGame').addEventListener('click',()=>{ sfx.click(); T.on=false; tHudShow(false); document.getElementById('tOvEnd').style.display='none'; showPage('pgHome'); });

// ═══════════════════════════════════════════════════════════════
//  MODE 3 — CLICK SPEED TEST
// ═══════════════════════════════════════════════════════════════
// ── CSS Ripple system — no canvas, no glitch ──────────────────
function addRipple(e){
  const layer = document.getElementById('cRippleLayer');
  if(!layer) return;
  const zone  = document.getElementById('cClickZone');
  const rect  = zone.getBoundingClientRect();
  const x     = (e.clientX ?? e.pageX) - rect.left;
  const y     = (e.clientY ?? e.pageY) - rect.top;

  const el = document.createElement('div');
  el.className = 'cps-ripple-circle';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  layer.appendChild(el);
  // Remove after animation completes
  el.addEventListener('animationend', ()=> el.remove(), { once: true });
}

const cZone = document.getElementById('cClickZone');
if(cZone) cZone.addEventListener('pointerdown', e => addRipple(e));

const C={ on:false, clicks:0, dur:5, timeLeft:0, startTime:0, lf:0, peakCPS:0, lastSec:0, lastSecT:0 };
const CPS_CIRC=326.7;

function cHide(){ ['cOvStart','cOvEnd'].forEach(id=>document.getElementById(id).style.display='none'); }
function cGame(v){
  document.getElementById('cGame').style.display=v?'flex':'none';
}

function cStart(){
  AC(); cHide(); cGame(true);
  C.on=false;
  // Reset display
  document.getElementById('cCPS').textContent='0.0';
  document.getElementById('cClicks').textContent='0';
  document.getElementById('cTimeVal').textContent=C.dur;
  document.getElementById('cRingFill').style.strokeDashoffset='0';
  document.getElementById('cRingFill').style.stroke='#24f07a';
  // Countdown
  const badge=document.getElementById('cCountBadge');
  const numEl=document.getElementById('cCountNum');
  badge.style.display='flex';
  let count=3;
  const tick=()=>{
    numEl.textContent=count;
    numEl.style.animation='none'; void numEl.offsetWidth;
    numEl.style.animation='cntPop .38s cubic-bezier(.34,1.56,.64,1) both';
    sfx.beep3(); count--;
    if(count>0){ setTimeout(tick,900); }
    else{ setTimeout(()=>{ badge.style.display='none'; sfx.beepGo(); cBegin(); },900); }
  };
  tick();
}

function cBegin(){
  Object.assign(C,{on:true,clicks:0,timeLeft:C.dur*1000,startTime:performance.now(),peakCPS:0,lastSec:0,lastSecT:performance.now()});
  cGame(true); cTick(); C.lf=performance.now();
  requestAnimationFrame(cLoop);
}

function cTick(){
  const secs=Math.max(0,C.timeLeft/1000);
  document.getElementById('cTimeVal').textContent=secs.toFixed(1);
  const el=C.dur*1000-C.timeLeft;
  document.getElementById('cCPS').textContent=el>0?(C.clicks/(el/1000)).toFixed(1):'0.0';
  document.getElementById('cClicks').textContent=C.clicks;
  const pct=Math.max(0,C.timeLeft/(C.dur*1000));
  document.getElementById('cRingFill').style.strokeDashoffset=(CPS_CIRC*(1-pct)).toFixed(2);
  document.getElementById('cRingFill').style.stroke=C.timeLeft<1500?'#ff4060':C.timeLeft<3000?'#ffb830':'#24f07a';
}

function cOver(){
  C.on=false; cGame(false);
  const cps=(C.clicks/C.dur).toFixed(2);
  if(parseFloat(cps)>(DB.d.cb||0)){ DB.d.cb=parseFloat(cps); DB.save(); syncHome(); }
  document.getElementById('cRCPS').textContent=cps;
  document.getElementById('cRClicks').textContent=C.clicks;
  document.getElementById('cRPeak').textContent=C.peakCPS.toFixed(1)+' /sec';
  document.getElementById('cRBest').textContent=(DB.d.cb||0)+' /sec';
  const g=cGrade(parseFloat(cps));
  const ge=document.getElementById('cGrade'); ge.textContent=g.txt; ge.style.color=g.col;
  document.getElementById('cOvEnd').style.display='flex';
}

function cLoop(ts){
  if(!C.on) return;
  requestAnimationFrame(cLoop);
  C.timeLeft=Math.max(0,C.dur*1000-(performance.now()-C.startTime));
  const now=performance.now();
  if(now-C.lastSecT>=1000){
    const s=C.clicks-C.lastSec; if(s>C.peakCPS)C.peakCPS=s;
    C.lastSec=C.clicks; C.lastSecT=now;
  }
  cTick();
  if(C.timeLeft<=0){ cOver(); }
}

document.getElementById('cClickZone').addEventListener('pointerdown',e=>{
  e.preventDefault(); if(!C.on) return;
  C.clicks++; sfx.click();
  const b=e.currentTarget; b.style.transform='scale(.97)'; setTimeout(()=>b.style.transform='',70);
});

const CGRADES=[
  {cps:12,txt:'⚡ INHUMAN',       col:'#c47fff'},
  {cps:9, txt:'🏆 ELITE CLICKER', col:'#ffd65c'},
  {cps:7, txt:'🔥 VERY FAST',     col:'#24f07a'},
  {cps:5, txt:'💪 ABOVE AVERAGE', col:'#49d9ff'},
  {cps:3, txt:'📈 AVERAGE',       col:'#ffb347'},
  {cps:0, txt:'🐢 SLOW FINGERS',  col:'#4a5a72'},
];
function cGrade(c){ return CGRADES.find(g=>c>=g.cps)||CGRADES[CGRADES.length-1]; }

document.getElementById('cBtnStart').addEventListener('click',()=>{ sfx.click(); cStart(); });
document.getElementById('cBtnRetry').addEventListener('click',()=>{ sfx.click(); cStart(); });
document.getElementById('cBtnMenu').addEventListener('click', ()=>{ sfx.click(); C.on=false; cGame(false); cHide(); showPage('pgHome'); });
document.getElementById('cBack').addEventListener('click',    ()=>{ sfx.click(); C.on=false; cGame(false); cHide(); showPage('pgHome'); });

// ─── HOME ROUTING ─────────────────────────────────────────────
document.getElementById('btnReact').addEventListener('click',()=>{ AC(); sfx.click(); rUpdateRecords(); rScreen('rIdle'); showPage('pgReact'); });
document.getElementById('btnTrack').addEventListener('click',()=>{ AC(); sfx.click(); showPage('pgTrack'); document.getElementById('tOvStart').style.display='flex'; document.getElementById('tOvEnd').style.display='none'; tHudShow(false); });
document.getElementById('btnCPS').addEventListener('click',  ()=>{ AC(); sfx.click(); showPage('pgCPS'); document.getElementById('cOvStart').style.display='flex'; document.getElementById('cOvEnd').style.display='none'; cGame(false); });

// ─── BOOT ─────────────────────────────────────────────────────
syncHome();
