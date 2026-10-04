"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

type Gender = "male" | "female";
type Phase = "setup" | "match";
type Vec3 = { x: number; y: number; z: number };
type Scale3 = readonly [number, number, number];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function identityForGender(gender: Gender) {
  return gender === "female"
    ? { skin: [0.54, 0.32, 0.2], kit: [0.96, 0.96, 0.96], shorts: [0.12, 0.16, 0.2], scale: [0.92, 1.02, 0.92] as Scale3 }
    : { skin: [0.38, 0.22, 0.13], kit: [0.97, 0.97, 0.97], shorts: [0.1, 0.14, 0.2], scale: [1, 1.06, 1] as Scale3 };
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL shader creation failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "WebGL shader compilation failed");
  }
  return shader;
}

function makeProgram(gl: WebGLRenderingContext) {
  const vs = compile(gl, gl.VERTEX_SHADER, `
    attribute vec3 a_position;
    attribute vec3 a_normal;
    uniform mat4 u_mvp;
    uniform mat4 u_model;
    varying vec3 v_normal;
    varying vec3 v_world;
    void main() {
      vec4 world = u_model * vec4(a_position, 1.0);
      v_world = world.xyz;
      v_normal = mat3(u_model) * a_normal;
      gl_Position = u_mvp * vec4(a_position, 1.0);
    }
  `);
  const fs = compile(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform vec3 u_color;
    uniform vec3 u_light;
    varying vec3 v_normal;
    varying vec3 v_world;
    void main() {
      vec3 n = normalize(v_normal);
      float diffuse = max(dot(n, normalize(u_light - v_world)), 0.0);
      float ambient = 0.32;
      float rim = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.0) * 0.08;
      vec3 c = u_color * (ambient + diffuse * 0.68 + rim);
      gl_FragColor = vec4(c, 1.0);
    }
  `);
  const program = gl.createProgram();
  if (!program) throw new Error("WebGL program creation failed");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "WebGL program linking failed");
  }
  return program;
}

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, (2 * far * near) * nf, 0,
  ]);
}

function lookAt(eye: Vec3, center: Vec3, up: Vec3) {
  let zx = eye.x - center.x, zy = eye.y - center.y, zz = eye.z - center.z;
  const zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
  let xx = up.y * zz - up.z * zy, xy = up.z * zx - up.x * zz, xz = up.x * zy - up.y * zx;
  const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye.x + xy * eye.y + xz * eye.z),
    -(yx * eye.x + yy * eye.y + yz * eye.z),
    -(zx * eye.x + zy * eye.y + zz * eye.z),
    1,
  ]);
}

function multiply(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}

function model(position: Vec3, scale: Vec3 = { x: 1, y: 1, z: 1 }, rotationY = 0) {
  const c = Math.cos(rotationY), s = Math.sin(rotationY);
  return new Float32Array([
    c * scale.x, 0, -s * scale.x, 0,
    0, scale.y, 0, 0,
    s * scale.z, 0, c * scale.z, 0,
    position.x, position.y, position.z, 1,
  ]);
}

function geometryCube() {
  const p = [
    -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1,
    -1,-1,1, 1,-1,1, 1,1,1, -1,1,1,
  ];
  const faces = [
    [0,1,2,3, 0,0,-1], [4,7,6,5, 0,0,1], [0,4,5,1, 0,-1,0],
    [3,2,6,7, 0,1,0], [1,5,6,2, 1,0,0], [0,3,7,4, -1,0,0],
  ];
  const data:number[] = [];
  for (const f of faces) {
    const ids = f.slice(0,4) as number[], nx=f[4],ny=f[5],nz=f[6];
    for (const id of [ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]]) data.push(p[id*3],p[id*3+1],p[id*3+2],nx,ny,nz);
  }
  return new Float32Array(data);
}

function geometrySphere(rows=10, cols=16) {
  const data:number[] = [];
  for(let r=0;r<rows;r++){
    const a0=r*Math.PI/rows, a1=(r+1)*Math.PI/rows;
    for(let c=0;c<cols;c++){
      const b0=c*2*Math.PI/cols, b1=(c+1)*2*Math.PI/cols;
      const pts=[[a0,b0],[a1,b0],[a1,b1],[a0,b1]];
      for(const [a,b] of [[...pts[0],...pts[1],...pts[2]],[...pts[0],...pts[2],...pts[3]]]){
        const [aa,bb,cc,dd,ee,ff]=[a,b,a,b,a,b];
        void aa; void bb; void cc; void dd; void ee; void ff;
      }
      const tris=[[pts[0],pts[1],pts[2]],[pts[0],pts[2],pts[3]]];
      for(const tri of tris) for(const [a,b] of tri){ const x=Math.sin(a)*Math.cos(b), y=Math.cos(a), z=Math.sin(a)*Math.sin(b); data.push(x,y,z,x,y,z); }
    }
  }
  return new Float32Array(data);
}

function drawObject(gl: WebGLRenderingContext, program: WebGLProgram, buffer: WebGLBuffer, count: number, vp: Float32Array, position: Vec3, scale: Vec3, color: number[], rotation=0) {
  const m=model(position,scale,rotation), mvp=multiply(vp,m);
  gl.uniformMatrix4fv(gl.getUniformLocation(program,"u_model"),false,m);
  gl.uniformMatrix4fv(gl.getUniformLocation(program,"u_mvp"),false,mvp);
  gl.uniform3fv(gl.getUniformLocation(program,"u_color"),new Float32Array(color));
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  const pos=gl.getAttribLocation(program,"a_position"), normal=gl.getAttribLocation(program,"a_normal");
  gl.enableVertexAttribArray(pos); gl.enableVertexAttribArray(normal);
  gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0);
  gl.vertexAttribPointer(normal,3,gl.FLOAT,false,24,12);
  gl.drawArrays(gl.TRIANGLES,0,count);
}

function drawPlayer(gl:WebGLRenderingContext, program:WebGLProgram, cube:WebGLBuffer, sphere:WebGLBuffer, vp:Float32Array, p:Vec3, color:number[], skin:number[], scale=1, running=0){
  const body={x:0.42*scale,y:0.82*scale,z:0.24*scale};
  drawObject(gl,program,cube,36,vp,{x:p.x,y:p.y+1.05*scale,z:p.z},body,color);
  drawObject(gl,program,sphere,10*16*6,vp,{x:p.x,y:p.y+2.05*scale,z:p.z},{x:0.3*scale,y:0.3*scale,z:0.3*scale},skin);
  const stride=Math.sin(running)*0.22*scale;
  drawObject(gl,program,cube,36,vp,{x:p.x-0.22*scale,y:p.y+0.3*scale,z:p.z+stride},{x:0.13*scale,y:0.48*scale,z:0.13*scale},color, stride);
  drawObject(gl,program,cube,36,vp,{x:p.x+0.22*scale,y:p.y+0.3*scale,z:p.z-stride},{x:0.13*scale,y:0.48*scale,z:0.13*scale},color, -stride);
  drawObject(gl,program,cube,36,vp,{x:p.x-0.58*scale,y:p.y+1.12*scale,z:p.z+stride*0.4},{x:0.12*scale,y:0.5*scale,z:0.12*scale},skin, stride);
  drawObject(gl,program,cube,36,vp,{x:p.x+0.58*scale,y:p.y+1.12*scale,z:p.z-stride*0.4},{x:0.12*scale,y:0.5*scale,z:0.12*scale},skin, -stride);
}

export function PlayGame() {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const [phase,setPhase]=useState<Phase>("setup");
  const [nameMode,setNameMode]=useState<"username"|"custom">("username");
  const [customName,setCustomName]=useState("");
  const [username,setUsername]=useState("@MatchUpPlayer");
  const [gender,setGender]=useState<Gender>("male");
  const [error,setError]=useState("");
  const [cameraDistance,setCameraDistance]=useState(7);
  const [touchMove,setTouchMove]=useState({x:0,y:0});
  const [action,setAction]=useState<"pass"|"shoot"|null>(null);

  useEffect(()=>{let alive=true; const load=async()=>{try{const supabase=createBrowserSupabaseClient();const {data}=await supabase.auth.getUser();if(!data.user)return;const {data:p}=await supabase.from("profiles").select("username").eq("id",data.user.id).maybeSingle();if(alive&&p?.username)setUsername("@"+p.username.replace(/^@/,""));}catch{}};void load();return()=>{alive=false}},[]);

  useEffect(()=>{
    if(phase!=="match") return;
    const canvas=canvasRef.current; if(!canvas) return;
    const gl=canvas.getContext("webgl",{antialias:true,alpha:false}); if(!gl) return;
    const program=makeProgram(gl); gl.useProgram(program);
    const cube=gl.createBuffer()!, sphere=gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER,cube); gl.bufferData(gl.ARRAY_BUFFER,geometryCube(),gl.STATIC_DRAW);
    const sg=geometrySphere(); gl.bindBuffer(gl.ARRAY_BUFFER,sphere); gl.bufferData(gl.ARRAY_BUFFER,sg,gl.STATIC_DRAW);
    gl.uniform3f(gl.getUniformLocation(program,"u_light"),-10,18,10);
    let raf=0,last=performance.now(),t=0,px=0,pz=4,bx=0,bz=0,ballVX=0,ballVZ=0,camYaw=0;
    const keys=new Set<string>();
    const down=(e:KeyboardEvent)=>keys.add(e.key.toLowerCase()), up=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    const resize=()=>{const d=Math.min(window.devicePixelRatio||1,2);canvas.width=canvas.clientWidth*d;canvas.height=canvas.clientHeight*d;gl.viewport(0,0,canvas.width,canvas.height)};
    window.addEventListener("resize",resize);resize();
    const loop=(now:number)=>{
      const dt=Math.min(0.033,(now-last)/1000);last=now;t+=dt;
      let mx=touchMove.x+(keys.has("a")?-1:0)+(keys.has("d")?1:0), mz=touchMove.y+(keys.has("w")?-1:0)+(keys.has("s")?1:0);
      const len=Math.hypot(mx,mz)||1;if(Math.hypot(mx,mz)>0){mx/=len;mz/=len;px=clamp(px+mx*dt*4.4,-48,48);pz=clamp(pz+mz*dt*4.4,-31,31);}
      if(action==="pass"){ballVX=mx*8;ballVZ=mz*8;setAction(null)}
      if(action==="shoot"){ballVX=mx*13;ballVZ=mz*13;setAction(null)}
      bx+=ballVX*dt;bz+=ballVZ*dt;ballVX*=Math.pow(.18,dt);ballVZ*=Math.pow(.18,dt);
      if(Math.hypot(px-bx,pz-bz)<1.6){bx=px; bz=pz+0.7; if(Math.hypot(ballVX,ballVZ)<1){ballVX=0;ballVZ=0}}
      const target={x:px,y:1.1,z:pz}; const eye={x:px+Math.sin(camYaw)*cameraDistance,y:4.2,z:pz+Math.cos(camYaw)*cameraDistance};
      const vp=multiply(perspective(Math.PI/3,canvas.width/canvas.height,.1,200),lookAt(eye,target,{x:0,y:1,z:0}));
      gl.enable(gl.DEPTH_TEST);gl.clearColor(.015,.055,.095,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      drawObject(gl,program,cube,36,vp,{x:0,y:-.12,z:0},{x:50,y:.12,z:32},[.055,.33,.16]);
      for(let x=-45;x<=45;x+=5) drawObject(gl,program,cube,36,vp,{x,y:-.005,z:0},{x:.015,y:.015,z:32},[.78,.9,.82]);
      for(let z=-28;z<=28;z+=7) drawObject(gl,program,cube,36,vp,{x:0,y:0,z},{x:50,y:.012,z:.015},[.78,.9,.82]);
      drawObject(gl,program,cube,36,vp,{x:0,y:.03,z:0},{x:.08,y:.03,z:32},[1,1,1]);
      drawObject(gl,program,cube,36,vp,{x:-50,y:3,z:0},{x:1.2,y:3,z:36},[.12,.15,.2]);
      drawObject(gl,program,cube,36,vp,{x:50,y:3,z:0},{x:1.2,y:3,z:36},[.12,.15,.2]);
      drawObject(gl,program,cube,36,vp,{x:0,y:3,z:-33},{x:51,y:3,z:1.2},[.13,.08,.08]);
      drawObject(gl,program,cube,36,vp,{x:0,y:3,z:33},{x:51,y:3,z:1.2},[.13,.08,.08]);
      for(let i=0;i<28;i++){const a=i/28*Math.PI*2;const r=45;drawObject(gl,program,sphere,sg.length/6,vp,{x:Math.cos(a)*r,y:4+Math.sin(i*3)*.5,z:Math.sin(a)*r},{x:.55,y:.55,z:.55},i%2?[.75,.75,.8]:[.18,.23,.28]);}
      const me=identityForGender(gender);drawPlayer(gl,program,cube,sphere,vp,{x:px,y:0,z:pz},me.kit,me.skin,1,t*7);
      const teammates=[[-12,-5],[-8,10],[8,-10],[17,7],[28,0]];teammates.forEach((q,i)=>drawPlayer(gl,program,cube,sphere,vp,{x:q[0]+Math.sin(t+i)*1.5,y:0,z:q[1] },[.12,.42,.82],[.45,.28,.18],.95,t*5+i));
      const opponents=[[-20,-2],[-8,-14],[4,12],[18,-6],[30,10]];opponents.forEach((q,i)=>drawPlayer(gl,program,cube,sphere,vp,{x:q[0]+Math.cos(t+i)*1.2,y:0,z:q[1]},[.72,.08,.09],[.32,.17,.1],.98,t*5+i));
      drawPlayer(gl,program,cube,sphere,vp,{x:0,y:0,z:-29},[.85,.72,.12],[.78,.5,.28],1,t*4);
      drawObject(gl,program,sphere,sg.length/6,vp,{x:bx,y:.34+Math.abs(Math.sin(t*10))*.08,z:bz},{x:.32,y:.32,z:.32},[.96,.96,.96]);
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("resize",resize)};
  },[phase,touchMove,action,gender,cameraDistance]);

  const selectedName=nameMode==="username"?username:(customName.trim()||"MatchUp Player");
  if(phase==="setup") return <main className="min-h-[100dvh] bg-[#020a14] text-white"><div className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col lg:flex-row"><section className="relative min-h-[45vh] flex-1 overflow-hidden bg-[radial-gradient(circle_at_50%_25%,rgba(36,151,255,.28),transparent_40%),linear-gradient(180deg,#06182c,#020a14)]"><div className="absolute inset-0 opacity-30" style={{backgroundImage:"linear-gradient(rgba(71,168,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(71,168,255,.08) 1px,transparent 1px)",backgroundSize:"44px 44px"}}/><div className="relative flex h-full min-h-[45vh] items-center justify-center"><div className="relative mt-8"><div className="absolute -inset-16 rounded-full bg-[#167bd1]/20 blur-3xl"/><div className="relative h-[330px] w-[220px]"><div className="absolute left-1/2 top-10 h-28 w-24 -translate-x-1/2 rounded-full bg-[#7a4d32] shadow-[0_12px_35px_rgba(0,0,0,.5)]"/><div className="absolute left-1/2 top-32 h-48 w-40 -translate-x-1/2 rounded-[44px_44px_24px_24px] bg-white shadow-[0_18px_55px_rgba(0,0,0,.45)]"/><div className="absolute left-[42px] top-[185px] h-32 w-12 rotate-[8deg] rounded-full bg-[#111827]"/><div className="absolute right-[42px] top-[185px] h-32 w-12 -rotate-[8deg] rounded-full bg-[#111827]"/><div className="absolute left-2 top-36 h-40 w-9 rotate-[18deg] rounded-full bg-[#7a4d32]"/><div className="absolute right-2 top-36 h-40 w-9 -rotate-[18deg] rounded-full bg-[#7a4d32]"/></div></div></div><div className="absolute bottom-7 left-7"><img src="/matchup-logo.svg" alt="MatchUp" className="h-8 w-auto"/></div></section><section className="flex w-full max-w-xl flex-col justify-center border-t border-[#163b61] bg-[#071426] p-6 sm:p-10 lg:w-[500px] lg:border-l lg:border-t-0"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#47a8ff]">MATCHUP PLAY GAME</p><h1 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-5xl">How do you want to play?</h1><p className="mt-3 text-sm leading-6 text-[#8da7bf]">Create your football-game identity before entering the match.</p><div className="mt-7 grid grid-cols-2 gap-2"><button onClick={()=>setNameMode("username")} className={`rounded-2xl border p-4 text-left ${nameMode==="username"?"border-[#47a8ff] bg-[#0b3154]":"border-[#214a78] bg-[#061426]"}`}><span className="text-[10px] font-black uppercase tracking-[.12em] text-[#70c1ff]">Use MatchUp Username</span><strong className="mt-2 block truncate text-lg">{username}</strong></button><button onClick={()=>setNameMode("custom")} className={`rounded-2xl border p-4 text-left ${nameMode==="custom"?"border-[#47a8ff] bg-[#0b3154]":"border-[#214a78] bg-[#061426]"}`}><span className="text-[10px] font-black uppercase tracking-[.12em] text-[#70c1ff]">Use Different Name</span><strong className="mt-2 block text-lg">Custom</strong></button></div>{nameMode==="custom"?<input value={customName} onChange={e=>setCustomName(e.target.value)} maxLength={20} placeholder="Enter player name..." className="mt-3 w-full rounded-2xl border border-[#214a78] bg-[#061426] px-4 py-4 text-sm text-white outline-none focus:border-[#47a8ff]"/>:null}<p className="mt-7 text-[10px] font-black uppercase tracking-[.18em] text-[#70c1ff]">Player Gender</p><div className="mt-3 grid grid-cols-2 gap-2">{(["male","female"] as Gender[]).map(g=><button key={g} onClick={()=>setGender(g)} className={`rounded-2xl border px-4 py-4 text-sm font-black capitalize ${gender===g?"border-[#47a8ff] bg-[#0b3154] text-white":"border-[#214a78] bg-[#061426] text-[#9fb6cc]"}`}>{g}</button>)}</div>{error?<p className="mt-3 text-xs font-bold text-[#ff9eab]">{error}</p>:null}<button onClick={()=>{if(nameMode==="custom"&&!customName.trim()){setError("Enter a player name or choose Use MatchUp Username.");return}setError("");setPhase("match")}} className="mt-8 rounded-2xl bg-[#167bd1] px-5 py-4 text-sm font-black text-white shadow-[0_14px_35px_rgba(22,123,209,.28)]">Enter Match as {selectedName}</button></section></div></main>;

  return <main className="relative min-h-[100dvh] overflow-hidden bg-[#020a14] text-white"><canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none"/><div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6"><div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#04111f]/80 px-4 py-3 backdrop-blur-md"><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#70c1ff]">MATCHUP · PLAY GAME</p><p className="mt-1 text-sm font-black">{selectedName}</p><p className="mt-1 text-[10px] text-[#91aac1]">LIVE PROTOTYPE · 1 PLAYER</p></div><div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#04111f]/80 px-4 py-3 text-right backdrop-blur-md"><p className="text-[10px] font-black text-[#70c1ff]">YOUR TEAM</p><p className="text-lg font-black">MATCHUP FC</p><p className="text-[10px] text-[#91aac1]">0 — 0</p></div></div><div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-8"><div className="pointer-events-auto"><div className="grid size-28 place-items-center rounded-full border border-white/20 bg-[#061426]/55 backdrop-blur-md"><div className="relative size-20"><div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-white/10"/><div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-white/10"/><div className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15"/><div className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#47a8ff]" style={{transform:`translate(calc(-50% + ${touchMove.x*28}px),calc(-50% + ${touchMove.y*28}px))`}}/></div></div></div><div className="pointer-events-auto flex gap-2"><button onClick={()=>setAction("pass")} className="grid size-16 place-items-center rounded-full border border-[#70c1ff]/50 bg-[#0b3154]/85 text-[10px] font-black backdrop-blur-md">PASS</button><button onClick={()=>setAction("shoot")} className="grid size-20 place-items-center rounded-full border border-white/30 bg-white/15 text-[10px] font-black backdrop-blur-md">SHOOT</button><button onClick={()=>setCameraDistance(d=>d>8?5:d+1)} className="grid size-12 place-items-center rounded-full border border-white/15 bg-[#061426]/75 text-[9px] font-black backdrop-blur-md">CAM</button></div></div><div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-center sm:block"><p className="text-[10px] font-black uppercase tracking-[.2em] text-white/60">MOVE · PASS · SHOOT</p><p className="mt-1 text-xs text-white/45">WASD / touch controls</p></div><div className="absolute inset-0" onPointerMove={e=>{if(e.buttons!==1)return;const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setTouchMove({x:clamp((e.clientX-r.left-r.width/2)/(r.width/2),-1,1),y:clamp((e.clientY-r.top-r.height/2)/(r.height/2),-1,1)})}} onPointerUp={()=>setTouchMove({x:0,y:0})} onPointerLeave={()=>setTouchMove({x:0,y:0})}/></main>;
}
