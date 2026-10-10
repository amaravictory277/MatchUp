"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Team = "blue" | "red";
type Disc = { id:number;team:Team;x:number;y:number;vx:number;vy:number;fx:number;fy:number;keeper?:boolean };
type Ball = { x:number;y:number;vx:number;vy:number;z:number;vz:number;owner:number|null;target:number|null;kind:"loose"|"pass"|"cross"|"shot" };
type GameState = { discs: Disc[]; ball: Ball; score: [number, number]; seconds: number; ended: boolean; lastGoal: string; selected: number | null; aim: { x: number; y: number } | null };
const W = 1000, H = 600, GOAL_TOP = 235, GOAL_BOTTOM = 365;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
function createDiscs(size: number): Disc[] {
  const discs: Disc[] = [];
  const formation = Array.from({ length: size }, (_, i) => {
    const row = Math.floor(i / 3), col = i % 3;
    return { x: 105 + row * (size > 6 ? 55 : 75), y: 160 + col * (size > 6 ? 140 : 140) };
  });
  formation.forEach((p, i) => {
    const keeper = i === 0;
    discs.push({id:i+1,team:"blue",x:keeper?70:p.x,y:keeper?H/2:p.y,vx:0,vy:0,fx:1,fy:0,keeper});
  });
  formation.forEach((p, i) => {
    const keeper = i === 0;
    discs.push({id:size+i+1,team:"red",x:keeper?W-70:W-p.x,y:keeper?H/2:H-p.y,vx:0,vy:0,fx:-1,fy:0,keeper});
  });
  return discs;
}
function freshGame(size: number, duration = 2): GameState {
  const discs=createDiscs(size),p=discs.filter(d=>d.team==="blue"&&!d.keeper);return {discs,ball:{x:W/2,y:H/2,vx:0,vy:0,z:0,vz:0,owner:null,target:null,kind:"loose"},score:[0,0],seconds:duration*60,ended:false,lastGoal:"",selected:p[Math.floor(Math.random()*p.length)]?.id??null,aim:null};
}
function drawPitch(ctx: CanvasRenderingContext2D, game: GameState) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0b442d"; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.035)"; ctx.fillRect(i * W / 10, 0, W / 10, H); }
  ctx.strokeStyle = "rgba(229,248,239,.78)"; ctx.lineWidth = 3;
  ctx.strokeRect(25, 25, W - 50, H - 50);
  ctx.beginPath(); ctx.moveTo(W / 2, 25); ctx.lineTo(W / 2, H - 25); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 82, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2); ctx.fillStyle = "#e5f8ef"; ctx.fill();
  ctx.strokeRect(25, 175, 125, 250); ctx.strokeRect(W - 150, 175, 125, 250);
  ctx.strokeRect(25, 225, 48, 150); ctx.strokeRect(W - 73, 225, 48, 150);
  ctx.beginPath(); ctx.arc(118, H / 2, 3, 0, Math.PI * 2); ctx.arc(W - 118, H / 2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#d8e8ff"; ctx.fillRect(0, GOAL_TOP, 27, GOAL_BOTTOM - GOAL_TOP); ctx.fillRect(W - 27, GOAL_TOP, 27, GOAL_BOTTOM - GOAL_TOP);
  ctx.strokeStyle = "rgba(255,255,255,.24)"; ctx.lineWidth = 1;
  for (let y = GOAL_TOP + 8; y < GOAL_BOTTOM; y += 12) { ctx.beginPath(); ctx.moveTo(2, y); ctx.lineTo(25, y); ctx.moveTo(W - 25, y); ctx.lineTo(W - 2, y); ctx.stroke(); }
  game.discs.forEach(d => {
    const r = d.keeper ? 20 : 17;
    ctx.beginPath(); ctx.ellipse(d.x + 2, d.y + 5, r + 1, r - 1, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fill();
    ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2); ctx.fillStyle = d.team === "blue" ? "#1788f5" : "#f04452"; ctx.fill();
    ctx.lineWidth=game.selected===d.id?4:2;ctx.strokeStyle=game.selected===d.id?"#fff4a3":d.team==="blue"?"#a9d9ff":"#ffc0c5";ctx.stroke();if(game.ball.owner===d.id){ctx.beginPath();ctx.arc(d.x,d.y,r+7,0,Math.PI*2);ctx.strokeStyle="#fff";ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);}
    ctx.beginPath(); ctx.arc(d.x - 4, d.y - 5, 5, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.32)"; ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(d.id > game.discs.length / 2 ? d.id - game.discs.length / 2 : d.id), d.x, d.y + 1);
  });
  if (game.aim && game.selected !== null) {
    const d = game.discs.find(item => item.id === game.selected);
    if (d) {
      ctx.save(); ctx.setLineDash([8, 7]); ctx.strokeStyle = "#fff4a3"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + game.aim.x * 3.2, d.y + game.aim.y * 3.2); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(d.x + game.aim.x * 3.2, d.y + game.aim.y * 3.2, 7, 0, Math.PI * 2); ctx.fillStyle = "#fff4a3"; ctx.fill(); ctx.restore();
    }
  }
  const b = game.ball;
  ctx.beginPath(); ctx.ellipse(b.x+2,b.y+4,11+b.z*.025,8+b.z*.015,0,0,Math.PI*2); ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fill();
  ctx.beginPath(); ctx.arc(b.x,b.y-b.z,10,0,Math.PI*2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#142235"; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(b.x+Math.cos(a)*4,b.y-b.z+Math.sin(a)*4,1.8, 0, Math.PI * 2); ctx.fillStyle = "#142235"; ctx.fill(); }
}
function resolveCollision(a: { x: number; y: number; vx: number; vy: number }, b: { x: number; y: number; vx: number; vy: number }, min: number, restitution = 0.84) {
  let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  if (!d || d >= min) return;
  const nx = dx / d, ny = dy / d, overlap = min - d;
  a.x -= nx * overlap * .5; a.y -= ny * overlap * .5; b.x += nx * overlap * .5; b.y += ny * overlap * .5;
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel < 0) { const impulse = -(1 + restitution) * rel * .5; a.vx -= impulse * nx; a.vy -= impulse * ny; b.vx += impulse * nx; b.vy += impulse * ny; }
}

export function PlayGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(freshGame(5));
  const stickRef=useRef<{id:number;x:number;y:number}|null>(null);const stickCenter=useRef<{x:number;y:number}|null>(null);const marking=useRef(false);const tackleWait=useRef(0);
  const router = useRouter();
  const [teamSize, setTeamSize] = useState(5);
  const [teamName, setTeamName] = useState("MatchUp FC");
  const [opponentName] = useState("Red United");
  const [duration, setDuration] = useState(2);

  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [stick, setStick] = useState({x:0,y:0});
  const [goalNotice, setGoalNotice] = useState<{team:string; score:string; id:number} | null>(null);
  const celebrationRef = useRef(0);
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState(0);
  const [, setVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState("Ready for kickoff");
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const formatTime = (seconds: number) => Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  const start = useCallback(() => {
    gameRef.current = freshGame(teamSize, duration);
    stickRef.current=null;stickCenter.current=null;marking.current=false;setStick({x:0,y:0});
    setGoalNotice(null);
    setStarted(true);
    setSessionId(id => id + 1);
    setNotice("");
    setStatus("Kickoff! Left stick to move · A pass · B shoot · C cross · hold MARK to defend.");
    setVersion(v => v + 1);
  }, [teamSize, duration]);
  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) { setNotice("This browser could not start the 2D game canvas."); return; }
    let raf = 0, previous = performance.now(), aiClock = 0, uiClock = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    const tick=(now:number)=>{const dt=Math.min(.035,Math.max(0,(now-previous)/1000));previous=now;const g=gameRef.current,b=g.ball;tackleWait.current=Math.max(0,tackleWait.current-dt);
if(!g.ended){g.seconds=Math.max(0,g.seconds-dt);if(g.seconds<=0){g.seconds=0;g.ended=true;setStatus(g.score[0]===g.score[1]?"Full time — it's a draw":g.score[0]>g.score[1]?`Full time — ${teamName.trim()||"MatchUp FC"} wins!`:`Full time — ${opponentName} wins`);}
if(!g.ended){const user=g.discs.find(d=>d.id===g.selected&&d.team==="blue"&&!d.keeper),red=g.discs.find(d=>d.id===b.owner&&d.team==="red");
if(user&&stickRef.current){let x=stickRef.current.x,y=stickRef.current.y;if(orientation==="vertical"){const t=x;x=y;y=-t;}const m=Math.hypot(x,y);if(m>.08){user.fx=x/m;user.fy=y/m;user.vx=user.vx*.2+user.fx*210*Math.min(1,m);user.vy=user.vy*.2+user.fy*210*Math.min(1,m);}}
if(marking.current&&user&&red){const x=red.x-user.x,y=red.y-user.y,m=Math.hypot(x,y)||1;user.fx=x/m;user.fy=y/m;user.vx+=x/m*250*dt;user.vy+=y/m*250*dt;if(m<38&&tackleWait.current===0){tackleWait.current=1.1;if(Math.random()<.42){b.owner=user.id;b.target=null;b.vx=0;b.vy=0;b.z=0;b.vz=0;setStatus("Tackle won — possession recovered!");}else{red.vx-=red.fx*80;red.vy-=red.fy*80;setStatus("Tackle missed — keep pressing.");}}}
for(const d of g.discs){if(d.keeper){const gx=d.team==="blue"?70:W-70;d.vy+=clamp((clamp(b.y,GOAL_TOP+20,GOAL_BOTTOM-20)-d.y)*1.6,-120,120)*dt;d.vx+=clamp((gx-d.x)*1.6,-75,75)*dt;}else if(d.id!==g.selected){const own=g.discs.find(p=>p.id===b.owner);let tx=b.x,ty=b.y;if(own?.team==="blue"){tx=d.team==="blue"?clamp(own.x+70,60,W-60):own.x;ty=own.y+(d.id%2?60:-60);}else if(own?.team==="red"){tx=d.team==="red"?clamp(own.x-65,55,W-55):own.x;ty=own.y+(d.id%2?55:-55);}const x=tx-d.x,y=ty-d.y,m=Math.hypot(x,y)||1,acc=d.team==="red"?(difficulty==="hard"?170:115):55;d.vx+=x/m*acc*dt;d.vy+=y/m*acc*dt;if(m>2){d.fx=x/m;d.fy=y/m;}const v=Math.hypot(d.vx,d.vy),max=d.team==="red"?150:120;if(v>max){d.vx=d.vx/v*max;d.vy=d.vy/v*max;}}}
for(const d of g.discs){d.x+=d.vx*dt;d.y+=d.vy*dt;const drag=d.id===g.selected&&stickRef.current ? 0.84 : 0.16;d.vx*=Math.pow(drag,dt);d.vy*=Math.pow(drag,dt);d.x=clamp(d.x,d.keeper?(d.team==="blue"?45:W-150):45,d.keeper?(d.team==="blue"?150:W-45):W-45);d.y=clamp(d.y,d.keeper?GOAL_TOP-55:45,d.keeper?GOAL_BOTTOM+55:H-45);}
for(let i=0;i<g.discs.length;i++)for(let j=i+1;j<g.discs.length;j++)resolveCollision(g.discs[i],g.discs[j],(g.discs[i].keeper?20:17)+(g.discs[j].keeper?20:17),.22);
const owner=g.discs.find(d=>d.id===b.owner);if(owner){const m=Math.hypot(owner.fx,owner.fy)||1;b.x=owner.x+owner.fx/m*(23+(Math.hypot(owner.vx,owner.vy)>80?Math.sin(now/90)*4:0));b.y=owner.y+owner.fy/m*23;b.z=0;b.vz=0;b.vx=0;b.vy=0;for(const d of g.discs){if(d.team!==owner.team&&!d.keeper&&dist(d.x,d.y,b.x,b.y)<24&&Math.hypot(d.vx-owner.vx,d.vy-owner.vy)>45){b.owner=d.id;b.target=null;if(d.team==="blue")g.selected=d.id;setStatus(d.team==="red"?"Opponent intercepts!":"Possession recovered!");break;}}
const carrier=g.discs.find(d=>d.id===b.owner);if(carrier?.team==="red"){carrier.fx=-1;if(carrier.x<300||(carrier.x<650&&Math.random()<.004)){const x=28-carrier.x,y=H/2-carrier.y,m=Math.hypot(x,y)||1;b.owner=null;b.kind="shot";b.vx=x/m*350;b.vy=y/m*350;b.x=carrier.x-22;b.y=carrier.y;setStatus("Red United shoots!");}}}
else{b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.z>0||b.vz>0){b.z=Math.max(0,b.z+b.vz*dt);b.vz-=470*dt;if(b.z===0){b.vz=0;if(b.kind==="cross"){b.vx*=.65;b.vy*=.65;b.kind="loose";}}}b.vx*=Math.pow(.3,dt);b.vy*=Math.pow(.3,dt);if(b.y<37||b.y>H-37){b.y=clamp(b.y,37,H-37);b.vy*=-.65;}
if(b.z<20){const target=b.target?g.discs.find(d=>d.id===b.target):null,near=g.discs.filter(d=>!d.keeper).sort((p,q)=>dist(p.x,p.y,b.x,b.y)-dist(q.x,q.y,b.x,b.y))[0],recv=target&&dist(target.x,target.y,b.x,b.y)<32?target:near;if(recv&&dist(recv.x,recv.y,b.x,b.y)<22&&Math.hypot(b.vx,b.vy)<430){b.owner=recv.id;b.target=null;b.vx=0;b.vy=0;b.z=0;b.vz=0;if(recv.team==="blue"){g.selected=recv.id;setStatus("Pass received — now controlling the receiver.");}else setStatus("Red United intercepts.");}}
if(b.x<27||b.x>W-27){if(b.y>GOAL_TOP&&b.y<GOAL_BOTTOM&&b.z<18){const scorer=b.x<W/2?1:0;g.score[scorer]++;const name=scorer===0?(teamName.trim()||"MatchUp FC"):opponentName;g.lastGoal="GOAL! "+name+" scores";setStatus(g.lastGoal);setGoalNotice({team:name,score:`${g.score[0]} — ${g.score[1]}`,id:++celebrationRef.current});stickRef.current=null;marking.current=false;setStick({x:0,y:0});b.x=W/2;b.y=H/2;b.vx=0;b.vy=0;b.z=0;b.vz=0;b.owner=null;b.target=null;g.discs=createDiscs(teamSize);const ps=g.discs.filter(d=>d.team==="blue"&&!d.keeper);g.selected=ps[Math.floor(Math.random()*ps.length)]?.id??null;}else{b.x=clamp(b.x,38,W-38);b.vx*=-.7;b.target=null;}}
if(b.z===0&&!b.owner){const near=g.discs.filter(d=>!d.keeper).sort((p,q)=>dist(p.x,p.y,b.x,b.y)-dist(q.x,q.y,b.x,b.y))[0];if(near&&dist(near.x,near.y,b.x,b.y)<19&&Math.hypot(b.vx,b.vy)<330){b.owner=near.id;b.vx=0;b.vy=0;if(near.team==="blue"){g.selected=near.id;setStatus("Ball under control.");}}}}
uiClock+=dt;if(uiClock>.16){uiClock=0;setVersion(v=>v+1);}}}
if(orientation==="vertical")ctx.setTransform(0,canvas.height/W,-canvas.width/H,0,canvas.width,0);else ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);drawPitch(ctx,g);raf=requestAnimationFrame(tick);};
    resize(); window.addEventListener("resize", resize); raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [started, sessionId, teamSize, difficulty, duration, teamName, opponentName, orientation]);
  const stickUpdate=(e:React.PointerEvent<HTMLDivElement>)=>{const o=stickCenter.current;if(!o)return;const dx=e.clientX-o.x,dy=e.clientY-o.y,r=48,m=Math.hypot(dx,dy)||1,k=Math.min(1,r/m),v={x:dx*k/r,y:dy*k/r};stickRef.current={id:e.pointerId,...v};setStick(v);};
  const joystickDown=(e:React.PointerEvent<HTMLDivElement>)=>{if(gameRef.current.ended)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const r=e.currentTarget.getBoundingClientRect();stickCenter.current={x:r.left+r.width/2,y:r.top+r.height/2};stickRef.current={id:e.pointerId,x:0,y:0};stickUpdate(e);};
  const joystickMove=(e:React.PointerEvent<HTMLDivElement>)=>{if(stickRef.current?.id!==e.pointerId)return;e.preventDefault();stickUpdate(e);};
  const joystickUp=(e:React.PointerEvent<HTMLDivElement>)=>{if(stickRef.current?.id!==e.pointerId)return;stickRef.current=null;stickCenter.current=null;setStick({x:0,y:0});};
  const actBall=(kind:"pass"|"shoot"|"cross")=>{const g=gameRef.current,b=g.ball;if(g.ended)return;const d=g.discs.find(p=>p.id===g.selected&&p.team==="blue"&&!p.keeper);if(!d)return;const owner=g.discs.find(p=>p.id===b.owner);if(owner?.id!==d.id&&dist(d.x,d.y,b.x,b.y)>36){setStatus("Move closer to the ball to play it.");return;}if(owner?.id!==d.id){b.owner=d.id;b.vx=0;b.vy=0;b.z=0;}
if(kind!=="shoot"){const sx=stickRef.current?.x??d.fx,sy=stickRef.current?.y??d.fy,sl=Math.hypot(sx,sy)||1,ax=sx/sl,ay=sy/sl,ts=g.discs.filter(p=>p.team==="blue"&&!p.keeper&&p.id!==d.id),rec=ts.map(p=>{const x=p.x-d.x,y=p.y-d.y,l=Math.hypot(x,y)||1,dir=x/l*ax+y/l*ay,press=g.discs.filter(o=>o.team==="red"&&!o.keeper&&dist(o.x,o.y,p.x,p.y)<38).length;return{p,score:dist(p.x,p.y,d.x,d.y)+Math.max(0,.25-dir)*220+press*55};}).sort((a,c)=>a.score-c.score)[0]?.p,tx=kind==="cross"?(rec?.x??clamp(d.x+250,80,W-45)):(rec?.x??clamp(d.x+160,80,W-45)),ty=kind==="cross"?(rec?.y??clamp(d.y+(d.y<H/2?125:-125),55,H-55)):(rec?.y??d.y),x=tx-b.x,y=ty-b.y,l=Math.hypot(x,y)||1;b.owner=null;b.target=rec?.id??null;b.kind=kind;b.x=d.x+d.fx*23;b.y=d.y+d.fy*23;b.vx=x/l*(kind==="cross"?315:270);b.vy=y/l*(kind==="cross"?315:270);b.z=kind==="cross"?4:0;b.vz=kind==="cross"?255:0;setStatus(kind==="cross"?"Lofted cross in flight.":"Pass played — control switches on receipt.");}
else{const x=W-22-b.x,y=clamp(H/2+(d.y-H/2)*.16,GOAL_TOP+10,GOAL_BOTTOM-10)-b.y,l=Math.hypot(x,y)||1,press=g.discs.filter(o=>o.team==="red"&&!o.keeper).reduce((n,o)=>Math.min(n,dist(o.x,o.y,d.x,d.y)),Infinity),accuracy=press<45?.84:press<85?.94:1;b.owner=null;b.target=null;b.kind="shot";b.x=d.x+d.fx*23;b.y=d.y+d.fy*23;b.vx=x/l*455*accuracy;b.vy=y/l*455*accuracy;b.z=0;b.vz=0;setStatus("Shot toward goal!");}setVersion(v=>v+1);};
  const markDown=(e:React.PointerEvent<HTMLButtonElement>)=>{e.preventDefault();if(gameRef.current.ended)return;marking.current=true;e.currentTarget.setPointerCapture(e.pointerId);};const markUp=()=>{marking.current=false;};
  useEffect(() => {
    if (!goalNotice) return;
    const timer = window.setTimeout(() => setGoalNotice(null), 2200);
    return () => window.clearTimeout(timer);
  }, [goalNotice]);
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  };
  const g = gameRef.current;
  return (
    <main className="min-h-[100dvh] bg-[#020a14] px-3 pb-24 pt-4 text-white sm:px-6 sm:pt-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#70c1ff]">MATCHUP · PLAY GAME</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Football</h1><p className="mt-1 text-xs text-[#8da7bf]">Move, pass, shoot, cross, and defend.</p></div>
          <button type="button" onClick={goBack} className="rounded-xl border border-[#214a78] px-3 py-2 text-xs font-bold text-[#bfe3ff]">← Back</button>
        </header>
        {notice && <p role="alert" className="mb-4 rounded-xl border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">{notice}</p>}
        {!started ? (
          <section className="mx-auto max-w-3xl rounded-[28px] border border-[#174978] bg-[radial-gradient(circle_at_85%_0%,rgba(36,151,255,.18),transparent_42%),#071426] p-5 sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#70c1ff]">Choose your match</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">Take control of the match.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#9fb6cc]">Move one footballer with the left analog stick. Pass, shoot, cross, and press MARK to challenge the opponent.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setMode("single")} className={"rounded-2xl border p-4 text-left " + (mode === "single" ? "border-[#47a8ff] bg-[#0b3154]" : "border-[#214a78] bg-[#061426]")}><span className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">Single Player</span><strong className="mt-2 block text-lg">Play vs AI</strong><span className="mt-1 block text-xs text-[#9fb6cc]">A complete local match against computer-controlled opponents.</span></button>
              <button type="button" onClick={() => setMode("multi")} className={"rounded-2xl border p-4 text-left " + (mode === "multi" ? "border-[#47a8ff] bg-[#0b3154]" : "border-[#214a78] bg-[#061426]")}><span className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">Multiplayer</span><strong className="mt-2 block text-lg">Online Match</strong><span className="mt-1 block text-xs text-[#9fb6cc]">Play against another MatchUp user.</span></button>
            </div>
            {mode === "multi" ? <div role="status" className="mt-4 rounded-2xl border border-[#7a6030] bg-[#241e12] p-4 text-sm leading-6 text-[#f4d99c]"><strong className="block">Online multiplayer needs match-room infrastructure.</strong>The current project has real-time Match Room infrastructure for football discussions, but it does not yet have an authoritative disc-game session schema. Online play is not enabled here; this screen will not pretend an AI match is a real opponent match.</div> : <>
              <div className="mt-5"><label htmlFor="team-name" className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">Your team name</label><input id="team-name" maxLength={24} value={teamName} onChange={e=>setTeamName(e.target.value.slice(0,24))} placeholder="MatchUp FC" className="mt-2 w-full rounded-xl border border-[#214a78] bg-[#061426] p-3 text-sm text-white sm:max-w-xs" /><p className="mt-1 text-[10px] text-[#7892ac]">Up to 24 characters. Leave blank to use MatchUp FC.</p></div>
              <div className="mt-5"><label htmlFor="duration" className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">Match duration</label><select id="duration" value={duration} onChange={e=>setDuration(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-[#214a78] bg-[#061426] p-3 text-sm text-white sm:max-w-xs">{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n} minute{n>1?"s":""}</option>)}</select></div>
              <div className="mt-5"><label className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">Field orientation</label><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setOrientation("horizontal")} className={"rounded-xl border p-3 text-sm font-bold "+(orientation==="horizontal"?"border-[#47a8ff] bg-[#0b3154]":"border-[#214a78]")}>Horizontal</button><button type="button" onClick={()=>setOrientation("vertical")} className={"rounded-xl border p-3 text-sm font-bold "+(orientation==="vertical"?"border-[#47a8ff] bg-[#0b3154]":"border-[#214a78]")}>Vertical</button></div><p className="mt-1 text-[10px] text-[#7892ac]">The pitch rotates to match your selected orientation.</p></div>
              <div className="mt-6"><label htmlFor="team-size" className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">Players per team</label><select id="team-size" value={teamSize} onChange={e => setTeamSize(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-[#214a78] bg-[#061426] p-3 text-sm text-white sm:max-w-xs">{[3,5,6,8,11].map(n => <option key={n} value={n}>{n} vs {n}</option>)}</select></div>
              <div className="mt-5"><label htmlFor="difficulty" className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">AI difficulty</label><select id="difficulty" value={difficulty} onChange={e => setDifficulty(e.target.value as "easy" | "normal" | "hard")} className="mt-2 w-full rounded-xl border border-[#214a78] bg-[#061426] p-3 text-sm text-white sm:max-w-xs"><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></div>
              <button type="button" onClick={start} className="mt-6 w-full rounded-2xl bg-[#167bd1] px-5 py-4 text-sm font-black shadow-[0_12px_30px_rgba(22,123,209,.25)] sm:w-auto">Start Single-Player Match</button>
            </>}
          </section>
        ) : (
          <>
            <section className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#214a78] bg-[#071426] px-4 py-3">
              <div><p className="text-[9px] font-black uppercase tracking-widest text-[#70c1ff]">{teamName.trim() || "MatchUp FC"} <span className="text-[#7892ac]">vs</span> {opponentName}</p><p className="mt-1 text-xs text-[#9fb6cc]">{teamSize} vs {teamSize} · {duration} MIN · ANALOG GAMEPAD · {difficulty.toUpperCase()} AI</p></div>
              <div className="flex items-center gap-4"><div className="text-center"><p className="text-[9px] font-bold uppercase text-[#7892ac]">Score</p><p className="text-2xl font-black tabular-nums">{g.score[0]} — {g.score[1]}</p></div><div className="text-center"><p className="text-[9px] font-bold uppercase text-[#7892ac]">Time</p><p className="text-2xl font-black tabular-nums">{formatTime(Math.ceil(g.seconds))}</p></div></div>
            </section>
            <p className="mb-2 text-xs font-semibold text-[#bfe3ff]">{status}</p>
            <div className={"relative overflow-hidden rounded-2xl border border-[#286448] bg-[#0b442d] "+(orientation==="vertical"?"mx-auto max-w-xl":"")}>
              <canvas ref={canvasRef} className={"block "+(orientation==="vertical"?"aspect-[3/5]":"aspect-[5/3]")+" w-full touch-none"} aria-label="Football pitch controlled with the analog joystick."/>
              {!g.ended&&<div className="pointer-events-none absolute inset-0 flex items-end justify-between p-3 sm:p-5">
                <div className="pointer-events-auto"><div onPointerDown={joystickDown} onPointerMove={joystickMove} onPointerUp={joystickUp} onPointerCancel={joystickUp} className="relative flex h-[116px] w-[116px] touch-none select-none items-center justify-center rounded-full border-2 border-white/35 bg-slate-950/35 sm:h-[136px] sm:w-[136px]" style={{touchAction:"none"}}><span className="absolute h-[72%] w-[72%] rounded-full border border-white/20"/><span className="absolute text-[9px] font-black text-white/45">MOVE</span><span className="absolute h-12 w-12 rounded-full border-2 border-white/80 bg-[#167bd1]/90 shadow-lg sm:h-14 sm:w-14" style={{transform:`translate(${stick.x*42}px,${stick.y*42}px)`}}/></div></div>
                <div className="pointer-events-auto grid grid-cols-2 items-end gap-2 sm:gap-3"><button type="button" onClick={()=>actBall("pass")} className="h-12 w-12 rounded-full border-2 border-white/70 bg-[#167bd1] font-black active:scale-95 sm:h-14 sm:w-14" aria-label="A pass">A</button><button type="button" onClick={()=>actBall("shoot")} className="mb-5 h-14 w-14 rounded-full border-2 border-white/80 bg-[#e64c55] font-black active:scale-95 sm:mb-7 sm:h-16 sm:w-16" aria-label="B shoot">B</button><button type="button" onClick={()=>actBall("cross")} className="h-12 w-12 rounded-full border-2 border-white/70 bg-[#167bd1] font-black active:scale-95 sm:h-14 sm:w-14" aria-label="C cross">C</button><button type="button" onPointerDown={markDown} onPointerUp={markUp} onPointerCancel={markUp} onLostPointerCapture={markUp} className="mb-1 h-12 w-12 rounded-full border-2 border-white/70 bg-[#34465c] text-[10px] font-black active:scale-95 sm:h-14 sm:w-14" aria-label="Hold to mark and pressure">MARK</button></div>
              </div>}
            </div>
            <p className="mt-3 text-[10px] text-[#7892ac]">A · Pass   B · Shoot   C · Lofted cross   Hold MARK · Pressure/tackle.</p>
            {goalNotice && <div key={goalNotice.id} className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden"><div className="confetti-cannon cannon-left" aria-hidden="true">{Array.from({length:18},(_,i)=><span key={`left-${i}`} className="confetti-particle" style={{"--dx":`${100+(i%6)*27}px`,"--dy":`${((i*37)%220)-110}px`,"--rotation":`${i*83}deg`,"animationDelay":`${(i%6)*25}ms`} as React.CSSProperties} />)}</div><div className="confetti-cannon cannon-right" aria-hidden="true">{Array.from({length:18},(_,i)=><span key={`right-${i}`} className="confetti-particle" style={{"--dx":`${-100-(i%6)*27}px`,"--dy":`${((i*43)%220)-110}px`,"--rotation":`${i*97}deg`,"animationDelay":`${(i%6)*25}ms`} as React.CSSProperties} />)}</div><div className="rounded-3xl border border-[#70c1ff] bg-[#061426]/95 px-8 py-6 text-center shadow-[0_0_70px_rgba(71,168,255,.45)] animate-in zoom-in duration-300"><p className="text-4xl font-black tracking-widest text-white">GOAL!</p><p className="mt-2 text-lg font-black text-[#70c1ff]">{goalNotice.team}</p><p className="mt-1 text-2xl font-black tabular-nums">{goalNotice.score}</p><div className="mt-3 flex justify-center gap-5 text-2xl" aria-hidden="true">🎉 ✨ 🎉</div></div></div>}
            {g.ended ? <section className="mt-4 rounded-2xl border border-[#214a78] bg-[#071426] p-5 text-center"><h2 className="text-2xl font-black">Full Time</h2><p className="mt-2 text-sm text-[#9fb6cc]">{g.score[0] === g.score[1] ? "The match ended in a draw." : g.score[0] > g.score[1] ? (teamName.trim() || "MatchUp FC") + " won the match. Nice play!" : "The AI won this one. Run it back?"}</p><button type="button" onClick={start} className="mt-4 rounded-xl bg-[#167bd1] px-5 py-3 text-sm font-black">Rematch</button><button type="button" onClick={() => setStarted(false)} className="ml-2 mt-4 rounded-xl border border-[#214a78] px-5 py-3 text-sm font-bold">Exit Match</button></section> : <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#7892ac]"><span>Move the selected footballer with the left analog stick.</span><span>Team: {teamSize} vs {teamSize}</span></div>}
          </>
        )}
      </div>
      <style jsx global>{`
        .confetti-cannon { position: fixed; top: 50%; z-index: 45; width: 0; height: 0; pointer-events: none; }
        .cannon-left { left: 0; }
        .cannon-right { right: 0; }
        .confetti-particle { position: absolute; left: 0; top: 0; width: 8px; height: 13px; border-radius: 2px; opacity: 0; background: #47a8ff; animation: matchup-confetti-burst 1.65s cubic-bezier(.12,.65,.25,1) forwards; }
        .confetti-particle:nth-child(3n) { background: #fff; }
        .confetti-particle:nth-child(3n + 1) { background: #70c1ff; }
        .confetti-particle:nth-child(3n + 2) { background: #d5eaff; }
        @keyframes matchup-confetti-burst { 0% { opacity: 0; transform: translate(0,0) rotate(0deg) scale(.65); } 12% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx),var(--dy)) rotate(var(--rotation,720deg)) scale(.8); } }
        @media (prefers-reduced-motion: reduce) { .confetti-particle { animation-duration: .01ms; } }
      `}</style>
    </main>
  );
}
