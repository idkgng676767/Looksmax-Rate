'use strict';
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// timestamp
setInterval(()=>$('ts').textContent=new Date().toISOString().replace('T',' ').slice(0,19),1000);
$('ts').textContent=new Date().toISOString().replace('T',' ').slice(0,19);

let ready=false,faceMesh=null;
let lastLandmarks=null,originalLandmarks=null,uploadedDataURL=null;

async function initMediaPipe(){
  const st=$('st');
  try{
    faceMesh=new FaceMesh({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`});
    faceMesh.setOptions({maxNumFaces:1,refineLandmarks:false,minDetectionConfidence:0.3,minTrackingConfidence:0.3});
    faceMesh.onResults(onResults);
    await faceMesh.initialize();
    ready=true; st.textContent='ONLINE'; st.className='on';
    $('dt').textContent='DRAG PHOTO / CLICK';
    $('dl').innerHTML='<strong style="color:var(--red);font-size:.95rem;letter-spacing:2px">DRAG PHOTO / CLICK</strong><br>front-facing photo, good lighting<br>no filters or glasses<br><br><span style="color:#1e1e1e">JPG / PNG / WEBP</span>';
  }catch(e){ st.textContent='ERR: '+e.message.slice(0,30); st.className='er'; }
}

let resolveDetection=null;
function onResults(results){ if(resolveDetection){resolveDetection(results);resolveDetection=null;} }

async function detectFace(imgEl){
  return new Promise((resolve,reject)=>{
    resolveDetection=resolve;
    const t=setTimeout(()=>{resolveDetection=null;reject(new Error('timeout'));},20000);
    faceMesh.send({image:imgEl}).catch(e=>{clearTimeout(t);resolveDetection=null;reject(e);}).then(()=>clearTimeout(t));
  });
}

const LM={
  jawLeft:234,jawRight:454,chin:152,jawMidLeft:172,jawMidRight:397,
  leftEyeOuter:33,leftEyeInner:133,leftEyeTop:159,leftEyeBot:145,
  rightEyeOuter:362,rightEyeInner:263,rightEyeTop:386,rightEyeBot:374,
  noseTip:1,noseLeft:129,noseRight:358,noseBridge:6,
  leftBrowOuter:70,leftBrowInner:107,rightBrowOuter:300,rightBrowInner:336,
  lipTop:13,lipBot:14,lipLeft:61,lipRight:291,lipUpperMid:12,lipLowerMid:15,
  cheekLeft:116,cheekRight:345,foreheadTop:10,
};

const KEY_LANDMARKS=[
  {idx:LM.jawLeft,label:'JAW LEFT'},{idx:LM.jawRight,label:'JAW RIGHT'},
  {idx:LM.chin,label:'CHIN'},{idx:LM.jawMidLeft,label:'JAW MID L'},{idx:LM.jawMidRight,label:'JAW MID R'},
  {idx:LM.leftEyeOuter,label:'EYE OUT L'},{idx:LM.leftEyeInner,label:'EYE IN L'},
  {idx:LM.leftEyeTop,label:'EYE TOP L'},{idx:LM.leftEyeBot,label:'EYE BOT L'},
  {idx:LM.rightEyeOuter,label:'EYE OUT R'},{idx:LM.rightEyeInner,label:'EYE IN R'},
  {idx:LM.rightEyeTop,label:'EYE TOP R'},{idx:LM.rightEyeBot,label:'EYE BOT R'},
  {idx:LM.leftBrowOuter,label:'BROW OUT L'},{idx:LM.leftBrowInner,label:'BROW IN L'},
  {idx:LM.rightBrowOuter,label:'BROW OUT R'},{idx:LM.rightBrowInner,label:'BROW IN R'},
  {idx:LM.noseTip,label:'NOSE TIP'},{idx:LM.noseLeft,label:'NOSE L'},{idx:LM.noseRight,label:'NOSE R'},
  {idx:LM.noseBridge,label:'NOSE BRIDGE'},{idx:LM.lipTop,label:'LIP TOP'},{idx:LM.lipBot,label:'LIP BOT'},
  {idx:LM.lipLeft,label:'LIP LEFT'},{idx:LM.lipRight,label:'LIP RIGHT'},
  {idx:LM.cheekLeft,label:'CHEEK L'},{idx:LM.cheekRight,label:'CHEEK R'},
  {idx:LM.foreheadTop,label:'FOREHEAD'},
];

function computeMetrics(lm){
  const p=i=>({x:lm[i].x,y:lm[i].y});
  const D=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

  // ── HEAD TILT COMPENSATION ──
  const le=p(LM.leftEyeOuter),re=p(LM.rightEyeOuter);
  const eyeAngle=Math.atan2(re.y-le.y,re.x-le.x);
  const cosA=Math.cos(-eyeAngle),sinA=Math.sin(-eyeAngle);
  const eyeMid={x:(le.x+re.x)/2,y:(le.y+re.y)/2};
  const rp=i=>{const pt=p(i);const dx=pt.x-eyeMid.x,dy=pt.y-eyeMid.y;return {x:dx*cosA-dy*sinA+eyeMid.x,y:dx*sinA+dy*cosA+eyeMid.y};};

  const faceW=D(rp(LM.jawLeft),rp(LM.jawRight));
  const faceH=D(rp(LM.foreheadTop),rp(LM.chin));

  // ── JAWLINE: faceH/faceW ratio. Ideal 1.25-1.45 (square jaw) ──
  const fRatio=faceH/faceW;
  const jaw=clamp(Math.round(100-Math.abs(fRatio-1.35)*80),20,96);

  // ── SYMMETRY: mirror left points across nose-bridge center line ──
  const nb=rp(LM.noseBridge);
  const pairs=[[LM.leftEyeOuter,LM.rightEyeOuter],[LM.leftEyeInner,LM.rightEyeInner],[LM.leftBrowOuter,LM.rightBrowOuter],[LM.leftBrowInner,LM.rightBrowInner],[LM.noseLeft,LM.noseRight],[LM.lipLeft,LM.lipRight],[LM.jawLeft,LM.jawRight],[LM.cheekLeft,LM.cheekRight]];
  let symTotal=0;
  for(const[l,r]of pairs){
    const a=rp(l),b=rp(r);
    const idealRx=2*nb.x-a.x;
    symTotal+=Math.abs(b.x-idealRx);
  }
  const symAvg=symTotal/pairs.length; // absolute deviation in coord space
  // Normalize: divide by faceW to get ratio, then scale
  // Normal faces: symAvg/faceW ≈ 0.005-0.025
  const symNorm=symAvg/faceW;
  // Score: 0→100, 0.01→92, 0.02→84, 0.04→68, 0.06→52, 0.1→20
  const sym=clamp(Math.round(100-symNorm*800),25,98);

  // ── CANTHAL TILT ──
  const lO=rp(LM.leftEyeOuter),lI=rp(LM.leftEyeInner);
  const rO=rp(LM.rightEyeOuter),rI=rp(LM.rightEyeInner);
  const lEW=D(lO,lI),rEW=D(rO,rI);
  const tR=(((lO.y-lI.y)/lEW)+((rO.y-rI.y)/rEW))/2;
  let cLabel,cScore;
  if(tR<-0.05){cLabel='POSITIVE';cScore=85;}
  else if(tR<0.03){cLabel='NEUTRAL';cScore=72;}
  else{cLabel='NEGATIVE';cScore=48;}

  // ── CHEEKBONES: cheekW/jawW. Ideal 1.0-1.15 ──
  const cheekW=D(rp(LM.cheekLeft),rp(LM.cheekRight));
  const jawW=D(rp(LM.jawMidLeft),rp(LM.jawMidRight));
  const cRatio=cheekW/jawW;
  const chk=clamp(Math.round(50+(cRatio-0.9)*55),15,94);

  // ── EYE REGION: aspect ratio (height/width). Ideal ~0.25-0.35 ──
  const lEH=D(rp(LM.leftEyeTop),rp(LM.leftEyeBot));
  const rEH=D(rp(LM.rightEyeTop),rp(LM.rightEyeBot));
  const eR=(lEH/lEW+rEH/rEW)/2;
  // Peak at 0.3: 0.15→55, 0.2→78, 0.3→92, 0.35→88, 0.45→62, 0.55→22
  const eye=clamp(Math.round(-250*Math.pow(eR-0.3,2)+92),15,94);

  // ── FACIAL THIRDS: t1=brow-forehead, t2=nose-brow, t3=chin-nose. All should be equal ──
  const browY=(rp(LM.leftBrowInner).y+rp(LM.rightBrowInner).y)/2;
  const noseY=rp(LM.noseTip).y,chinY=rp(LM.chin).y,foreheadY=rp(LM.foreheadTop).y;
  const t1=browY-foreheadY,t2=noseY-browY,t3=chinY-noseY;
  const tot=t1+t2+t3,ideal=tot/3;
  const thirdsDev=(Math.abs(t1-ideal)+Math.abs(t2-ideal)+Math.abs(t3-ideal))/tot;
  // Normal: 0.05-0.20. Score: 0→100, 0.1→90, 0.15→85, 0.2→80, 0.3→70
  const thirds=clamp(Math.round(100-thirdsDev*100),35,96);

  // ── NOSE: noseW/ieW. Ideal 0.9-1.3 ──
  const noseW=D(rp(LM.noseLeft),rp(LM.noseRight));
  const ieW=D(rp(LM.leftEyeInner),rp(LM.rightEyeInner));
  const nRatio=noseW/ieW;
  // 0.7→80, 0.9→95, 1.1→100, 1.3→95, 1.5→75, 1.8→50
  const nose=clamp(Math.round(100-Math.pow(nRatio-1.1,2)*180),25,96);

  // ── LIPS: upperH/lowerH. Ideal 0.5-0.7 (lower lip fuller) ──
  const upH=D(rp(LM.lipTop),rp(LM.lipUpperMid));
  const loH=D(rp(LM.lipBot),rp(LM.lipLowerMid));
  const lipRatio=upH/(loH+1e-6);
  // 0.3→64, 0.5→92, 0.6→100, 0.7→92, 1.0→52, 1.2→20
  const lips=clamp(Math.round(100-Math.pow(lipRatio-0.6,2)*380),15,94);

  // ── FINAL SCORE ──
  const w=jaw*0.21+sym*0.18+cScore*0.17+chk*0.14+eye*0.12+thirds*0.10+nose*0.05+lips*0.03;
  // w range ~20-95. Map to 2-9.7
  // w=30→4.0, w=40→4.8, w=50→5.6, w=60→6.4, w=70→7.2, w=80→8.0, w=90→8.8
  const score=parseFloat(clamp(w*0.08+1.6,2.0,9.7).toFixed(1));

  return{score,
    metrics:{jawline:Math.round(jaw),symmetry:Math.round(sym),canthal_tilt:cLabel,
      cheekbones:Math.round(chk),eye_region:Math.round(eye),facial_thirds:Math.round(thirds),
      nose:Math.round(nose),lips:Math.round(lips)},
    raw:{jaw,sym,cScore,chk,eye,thirds,nose,lips},lm
  };
}