"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Team = "blue" | "red";
type Disc = { id: number; team: Team; x: number; y: number; vx: number; vy: number; keeper?: boolean };
type Ball = { x: number; y: number; vx: number; vy: number };
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
    discs.push({ id: i + 1, team: "blue", x: keeper ? 70 : p.x, y: keeper ? H / 2 : p.y, vx: 0, vy: 0, keeper });
  });
  formation.forEach((p, i) => {
    const keeper = i === 0;
    discs.push({ id: size + i + 1, team: "red", x: keeper ? W - 70 : W - p.x, y: keeper ? H / 2 : H - p.y, vx: 0, vy: 0, keeper });
  });
  return discs;
}
function freshGame(size: number, duration = 2): GameState {
  return { discs: createDiscs(size), ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 }, score: [0, 0], seconds: duration * 60, ended: false, lastGoal: "", selected: null, aim: null };
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
    ctx.lineWidth = game.selected === d.id ? 4 : 2; ctx.strokeStyle = game.selected === d.id ? "#fff4a3" : d.team === "blue" ? "#a9d9ff" : "#ffc0c5"; ctx.stroke();
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
  ctx.beginPath(); ctx.ellipse(b.x + 2, b.y + 4, 11, 8, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fill();
  ctx.beginPath(); ctx.arc(b.x, b.y, 10, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#142235"; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * 4, b.y + Math.sin(a) * 4, 1.8, 0, Math.PI * 2); ctx.fillStyle = "#142235"; ctx.fill(); }
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
  const pointerRef = useRef<{ id: number; x: number; y: number; px: number; py: number } | null>(null);
  const router = useRouter();
  const [teamSize, setTeamSize] = useState(5);
  const [teamName, setTeamName] = useState("MatchUp FC");
  const [opponentName] = useState("Red United");
  const [duration, setDuration] = useState(2);
  const [controlMode, setControlMode] = useState<"direct" | "analog">("direct");
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [fullSpeed, setFullSpeed] = useState(false);
  const [power, setPower] = useState(0);
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
    pointerRef.current = null;
    setPower(0);
    setGoalNotice(null);
    setStarted(true);
    setSessionId(id => id + 1);
    setNotice("");
    setStatus("Kickoff! Drag a blue disc to pass or shoot.");
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
    const tick = (now: number) => {
      const dt = Math.min(.035, (now - previous) / 1000); previous = now;
      const g = gameRef.current;
      if (!g.ended) {
        g.seconds = Math.max(0, g.seconds - dt);
        if (g.seconds <= 0) {
          g.seconds = 0;
          g.ended = true;
          setStatus(g.score[0] === g.score[1] ? "Full time — it's a draw" : g.score[0] > g.score[1] ? `Full time — ${teamName.trim() || "MatchUp FC"} wins!` : `Full time — ${opponentName} wins`);
        }
        if (!g.ended) {
        for (const d of g.discs) {
          d.x += d.vx * dt; d.y += d.vy * dt;
          d.vx *= Math.pow(.22, dt); d.vy *= Math.pow(.22, dt);
          if (Math.hypot(d.vx, d.vy) < 3) { d.vx = 0; d.vy = 0; }
          if (d.keeper) {
            d.x = d.team === "blue" ? clamp(d.x, 45, 150) : clamp(d.x, W - 150, W - 45);
            d.y = clamp(d.y, 175, 425);
          } else {
            d.x = clamp(d.x, 45, W - 45);
            d.y = clamp(d.y, 45, H - 45);
          }
        }
        const b = g.ball; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= Math.pow(.32, dt); b.vy *= Math.pow(.32, dt);
        if (Math.abs(b.vx) < 2) b.vx = 0; if (Math.abs(b.vy) < 2) b.vy = 0;
        if (b.y < 37 || b.y > H - 37) { b.y = clamp(b.y, 37, H - 37); b.vy *= -.72; }
        if (b.x < 27 || b.x > W - 27) {
          if (b.y > GOAL_TOP && b.y < GOAL_BOTTOM) {
            const scorer = b.x < W / 2 ? 1 : 0;
            g.score[scorer]++;
            const scoringTeam = scorer === 0 ? (teamName.trim() || "MatchUp FC") : opponentName;
            g.lastGoal = `GOAL! ${scoringTeam} scores`;
            setStatus(g.lastGoal);
            setGoalNotice({ team: scoringTeam, score: `${g.score[0]} — ${g.score[1]}`, id: ++celebrationRef.current });
            pointerRef.current = null;
            g.selected = null;
            g.aim = null;
            setPower(0);
            b.x = W / 2; b.y = H / 2; b.vx = 0; b.vy = 0;
            g.discs = createDiscs(teamSize);
          } else { b.x = clamp(b.x, 38, W - 38); b.vx *= -.78; }
        }
        for (let i = 0; i < g.discs.length; i++) {
          const d = g.discs[i]; resolveCollision(d, b, (d.keeper ? 20 : 17) + 10, .91);
          for (let j = i + 1; j < g.discs.length; j++) resolveCollision(d, g.discs[j], (d.keeper ? 20 : 17) + (g.discs[j].keeper ? 20 : 17), .8);
        }
        aiClock += dt;
        if (aiClock > (difficulty === "easy" ? 1.8 : difficulty === "hard" ? .65 : 1.15)) {
          aiClock = 0;
          const opponents = g.discs.filter(d => d.team === "red");
          const fieldPlayers = opponents.filter(d => !d.keeper);
          const target = fieldPlayers.reduce((best, d) => dist(d.x, d.y, b.x, b.y) < dist(best.x, best.y, b.x, b.y) ? d : best, fieldPlayers[0]);
          const keeper = opponents.find(d => d.keeper);
          if (keeper) {
            const keeperTargetY = clamp(b.y, GOAL_TOP + 22, GOAL_BOTTOM - 22);
            keeper.vy += clamp((keeperTargetY - keeper.y) * 2.4, -170, 170);
            keeper.vx += clamp((W - 70 - keeper.x) * 2.2, -100, 100);
          }
          if (target && Math.hypot(b.vx, b.vy) < 420) {
            const tx = b.x > W * .3 ? 70 : 35, ty = H / 2 + (H / 2 - b.y) * .2;
            const dx = (b.x - target.x) * .7 + (tx - target.x) * .3, dy = (b.y - target.y) * .7 + (ty - target.y) * .3, len = Math.hypot(dx, dy) || 1;
            const aiForce = difficulty === "hard" ? 420 : difficulty === "easy" ? 245 : 330;
            target.vx += dx / len * aiForce;
            target.vy += dy / len * aiForce;
            if (dist(target.x, target.y, b.x, b.y) < 68) {
              const shotX = -1, shotY = (H / 2 - b.y) / Math.max(180, Math.abs(H / 2 - b.y) + 180);
              const shotLength = Math.hypot(shotX, shotY) || 1;
              b.vx += shotX / shotLength * (difficulty === "hard" ? 390 : difficulty === "easy" ? 220 : 310);
              b.vy += shotY / shotLength * (difficulty === "hard" ? 390 : difficulty === "easy" ? 220 : 310);
            }
          }
        }
        }
        uiClock += dt;
        if (uiClock > .2) { uiClock = 0; setVersion(v => v + 1); }
      }
      if (orientation === "vertical") {
        ctx.setTransform(0, canvas.height / W, -canvas.width / H, 0, canvas.width, 0);
      } else {
        ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
      }
      drawPitch(ctx, g);
      raf = requestAnimationFrame(tick);
    };
    resize(); window.addEventListener("resize", resize); raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [started, sessionId, teamSize, difficulty, duration, teamName, opponentName, orientation]);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const horizontal = (event.clientX - rect.left) / rect.width;
    const vertical = (event.clientY - rect.top) / rect.height;
    return orientation === "vertical"
      ? { x: vertical * W, y: (1 - horizontal) * H }
      : { x: horizontal * W, y: vertical * H };
  };
  const onDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameRef.current.ended) return;
    const p = point(event), g = gameRef.current;
    const nearest = g.discs.filter(d => d.team === "blue").map(d => ({ d, distance: dist(d.x, d.y, p.x, p.y) })).sort((a, b) => a.distance - b.distance)[0];
    if (!nearest || nearest.distance > 35) return;
    g.selected = nearest.d.id;
    if (controlMode === "analog") {
      g.aim = null;
      pointerRef.current = null;
      setVersion(v => v + 1);
      return;
    }
    g.aim = { x: 0, y: 0 };
    pointerRef.current = { id: nearest.d.id, x: p.x, y: p.y, px: p.x, py: p.y };
    event.currentTarget.setPointerCapture(event.pointerId); setVersion(v => v + 1);
  };
  const onMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (controlMode !== "direct") return;
    const drag = pointerRef.current; if (!drag) return;
    const p = point(event), g = gameRef.current; drag.px = p.x; drag.py = p.y;
    g.aim = { x: p.x - drag.x, y: p.y - drag.y }; setPower(clamp(Math.hypot(g.aim.x, g.aim.y) / 165, 0, 1)); setVersion(v => v + 1);
  };
  const onUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (controlMode !== "direct") return;
    const drag = pointerRef.current; if (!drag) return;
    const p = point(event), g = gameRef.current, d = g.discs.find(item => item.id === drag.id);
    if (g.ended) {
      pointerRef.current = null;
      g.aim = null;
      setPower(0);
      setVersion(v => v + 1);
      return;
    }
    if (d) {
      const dx = p.x - drag.x, dy = p.y - drag.y, length = Math.hypot(dx, dy);
      if (length > 8) {
        const power = clamp(length * 3.4, 80, 560);
        d.vx += dx / length * power; d.vy += dy / length * power;
        setStatus(length > 100 ? "Power shot!" : "Pass in play");
      } else {
        const b = g.ball, bx = b.x - d.x, by = b.y - d.y, near = Math.hypot(bx, by);
        if (near < 65) { b.vx += (bx / (near || 1)) * 250; b.vy += (by / (near || 1)) * 250; setStatus("Ball played forward"); }
      }
    }
    pointerRef.current = null; g.aim = null; setPower(0); setVersion(v => v + 1);
  };
  const onCancel = () => {
    pointerRef.current = null;
    gameRef.current.aim = null;
    setPower(0);
    setVersion(v => v + 1);
  };
  useEffect(() => {
    if (!goalNotice) return;
    const timer = window.setTimeout(() => setGoalNotice(null), 2200);
    return () => window.clearTimeout(timer);
  }, [goalNotice]);
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  };
  const moveSelected = (dx: number, dy: number) => {
    const state = gameRef.current;
    const d = state.discs.find(item => item.id === state.selected) || state.discs.find(item => item.team === "blue" && !item.keeper);
    if (!d) return;
    state.selected = d.id;
    d.vx += dx * (fullSpeed ? 260 : 170);
    d.vy += dy * (fullSpeed ? 260 : 170);
    setVersion(v => v + 1);
  };
  const actBall = (kind: "pass" | "shoot" | "cross") => {
    const state = gameRef.current;
    if (state.ended) return;
    const d = state.discs.find(item => item.id === state.selected && item.team === "blue")
      || state.discs.find(item => item.team === "blue" && !item.keeper);
    if (!d) return;
    state.selected = d.id;
    const b = state.ball;
    if (dist(d.x, d.y, b.x, b.y) >= 85) {
      setStatus("Move the selected player closer to the ball before passing or shooting.");
      setVersion(v => v + 1);
      return;
    }
    let targetX = W - 35, targetY = H / 2;
    if (kind === "pass") {
      const teammates = state.discs.filter(item => item.team === "blue" && item.id !== d.id);
      const forward = teammates.filter(item => item.x > d.x + 20);
      const candidates = forward.length ? forward : teammates;
      const receiver = candidates.reduce((best, item) => dist(item.x, item.y, b.x, b.y) < dist(best.x, best.y, b.x, b.y) ? item : best, candidates[0]);
      if (receiver) { targetX = receiver.x; targetY = receiver.y; }
    } else if (kind === "cross") {
      const boxTeammates = state.discs.filter(item => item.team === "blue" && item.id !== d.id && item.x > W * .62);
      const farSideY = b.y < H / 2 ? H * .72 : H * .28;
      const receiver = boxTeammates.reduce((best, item) => dist(item.x, item.y, W - 80, farSideY) < dist(best.x, best.y, W - 80, farSideY) ? item : best, boxTeammates[0]);
      targetX = receiver?.x ?? W - 55;
      targetY = receiver?.y ?? farSideY;
    }
    const dx = targetX - b.x, dy = targetY - b.y, len = Math.hypot(dx, dy) || 1;
    const force = kind === "shoot" ? 430 : kind === "cross" ? 330 : 260;
    b.vx += dx / len * force;
    b.vy += dy / len * force;
    setStatus(kind === "shoot" ? "Shot taken toward goal" : kind === "cross" ? "Cross delivered into the attacking area" : "Pass played toward a teammate");
    setVersion(v => v + 1);
  };
  const g = gameRef.current;
  return (
    <main className="min-h-[100dvh] bg-[#020a14] px-3 pb-24 pt-4 text-white sm:px-6 sm:pt-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#70c1ff]">MATCHUP · PLAY GAME</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Disc Football</h1><p className="mt-1 text-xs text-[#8da7bf]">Swipe, pass, shoot. Win the match.</p></div>
          <button type="button" onClick={goBack} className="rounded-xl border border-[#214a78] px-3 py-2 text-xs font-bold text-[#bfe3ff]">← Back</button>
        </header>
        {notice && <p role="alert" className="mb-4 rounded-xl border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">{notice}</p>}
        {!started ? (
          <section className="mx-auto max-w-3xl rounded-[28px] border border-[#174978] bg-[radial-gradient(circle_at_85%_0%,rgba(36,151,255,.18),transparent_42%),#071426] p-5 sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#70c1ff]">Choose your match</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">Football, played with discs.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#9fb6cc]">Control the blue team. Flick a disc toward the ball or goal, use rebounds, and beat the red AI team. No keyboard required.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setMode("single")} className={"rounded-2xl border p-4 text-left " + (mode === "single" ? "border-[#47a8ff] bg-[#0b3154]" : "border-[#214a78] bg-[#061426]")}><span className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">Single Player</span><strong className="mt-2 block text-lg">Play vs AI</strong><span className="mt-1 block text-xs text-[#9fb6cc]">A complete local match against computer-controlled opponents.</span></button>
              <button type="button" onClick={() => setMode("multi")} className={"rounded-2xl border p-4 text-left " + (mode === "multi" ? "border-[#47a8ff] bg-[#0b3154]" : "border-[#214a78] bg-[#061426]")}><span className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">Multiplayer</span><strong className="mt-2 block text-lg">Online Match</strong><span className="mt-1 block text-xs text-[#9fb6cc]">Play against another MatchUp user.</span></button>
            </div>
            {mode === "multi" ? <div role="status" className="mt-4 rounded-2xl border border-[#7a6030] bg-[#241e12] p-4 text-sm leading-6 text-[#f4d99c]"><strong className="block">Online multiplayer needs match-room infrastructure.</strong>The current project has real-time Match Room infrastructure for football discussions, but it does not yet have an authoritative disc-game session schema. Online play is not enabled here; this screen will not pretend an AI match is a real opponent match.</div> : <>
              <div className="mt-5"><label htmlFor="team-name" className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">Your team name</label><input id="team-name" maxLength={24} value={teamName} onChange={e=>setTeamName(e.target.value.slice(0,24))} placeholder="MatchUp FC" className="mt-2 w-full rounded-xl border border-[#214a78] bg-[#061426] p-3 text-sm text-white sm:max-w-xs" /><p className="mt-1 text-[10px] text-[#7892ac]">Up to 24 characters. Leave blank to use MatchUp FC.</p></div>
              <div className="mt-5"><label htmlFor="duration" className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">Match duration</label><select id="duration" value={duration} onChange={e=>setDuration(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-[#214a78] bg-[#061426] p-3 text-sm text-white sm:max-w-xs">{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n} minute{n>1?"s":""}</option>)}</select></div>
              <div className="mt-5"><label className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">Controls</label><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setControlMode("direct")} className={"rounded-xl border p-3 text-sm font-bold "+(controlMode==="direct"?"border-[#47a8ff] bg-[#0b3154]":"border-[#214a78]")}>Direct Swipe</button><button type="button" onClick={()=>setControlMode("analog")} className={"rounded-xl border p-3 text-sm font-bold "+(controlMode==="analog"?"border-[#47a8ff] bg-[#0b3154]":"border-[#214a78]")}>Analog Controls</button></div></div>
              <div className="mt-5"><label className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">Field orientation</label><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setOrientation("horizontal")} className={"rounded-xl border p-3 text-sm font-bold "+(orientation==="horizontal"?"border-[#47a8ff] bg-[#0b3154]":"border-[#214a78]")}>Horizontal</button><button type="button" onClick={()=>setOrientation("vertical")} className={"rounded-xl border p-3 text-sm font-bold "+(orientation==="vertical"?"border-[#47a8ff] bg-[#0b3154]":"border-[#214a78]")}>Vertical</button></div><p className="mt-1 text-[10px] text-[#7892ac]">The pitch rotates to match your selected orientation.</p></div>
              <div className="mt-6"><label htmlFor="team-size" className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">Players per team</label><select id="team-size" value={teamSize} onChange={e => setTeamSize(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-[#214a78] bg-[#061426] p-3 text-sm text-white sm:max-w-xs">{[3,5,6,8,11].map(n => <option key={n} value={n}>{n} vs {n}</option>)}</select></div>
              <div className="mt-5"><label htmlFor="difficulty" className="text-[10px] font-black uppercase tracking-widest text-[#70c1ff]">AI difficulty</label><select id="difficulty" value={difficulty} onChange={e => setDifficulty(e.target.value as "easy" | "normal" | "hard")} className="mt-2 w-full rounded-xl border border-[#214a78] bg-[#061426] p-3 text-sm text-white sm:max-w-xs"><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></div>
              <button type="button" onClick={start} className="mt-6 w-full rounded-2xl bg-[#167bd1] px-5 py-4 text-sm font-black shadow-[0_12px_30px_rgba(22,123,209,.25)] sm:w-auto">Start Single-Player Match</button>
            </>}
          </section>
        ) : (
          <>
            <section className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#214a78] bg-[#071426] px-4 py-3">
              <div><p className="text-[9px] font-black uppercase tracking-widest text-[#70c1ff]">{teamName.trim() || "MatchUp FC"} <span className="text-[#7892ac]">vs</span> {opponentName}</p><p className="mt-1 text-xs text-[#9fb6cc]">{teamSize} vs {teamSize} · {duration} MIN · {controlMode === "direct" ? "DIRECT SWIPE" : "ANALOG"} · {difficulty.toUpperCase()} AI</p></div>
              <div className="flex items-center gap-4"><div className="text-center"><p className="text-[9px] font-bold uppercase text-[#7892ac]">Score</p><p className="text-2xl font-black tabular-nums">{g.score[0]} — {g.score[1]}</p></div><div className="text-center"><p className="text-[9px] font-bold uppercase text-[#7892ac]">Time</p><p className="text-2xl font-black tabular-nums">{formatTime(Math.ceil(g.seconds))}</p></div></div>
            </section>
            <p className="mb-2 text-xs font-semibold text-[#bfe3ff]">{status}</p>{controlMode === "direct" && pointerRef.current && <div className="mb-2 flex items-center gap-3 text-xs"><span className="font-bold text-[#bfe3ff]">{power<.33?"LOW POWER":power<.7?"MEDIUM POWER":"MAX POWER"}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#16324d]"><div className="h-full rounded-full bg-[#47a8ff] transition-all" style={{width:(power*100)+"%"}} /></div></div>}
            <div className={"overflow-hidden rounded-2xl border border-[#286448] bg-[#0b442d] shadow-[0_20px_70px_rgba(0,0,0,.25)] "+(orientation==="vertical"?"mx-auto max-w-xl":"")}><canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} className={"block "+(orientation==="vertical"?"aspect-[3/5]":"aspect-[5/3]")+" w-full touch-none cursor-crosshair"} aria-label="Interactive disc football pitch. Drag a blue player disc in the direction you want it to move." /></div>
            {controlMode === "analog" && !g.ended && <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md"><span /><button type="button" onClick={()=>moveSelected(0,-1)} className="min-h-12 rounded-xl border border-[#214a78] bg-[#071426] font-black">↑</button><span /><button type="button" onClick={()=>moveSelected(-1,0)} className="min-h-12 rounded-xl border border-[#214a78] bg-[#071426] font-black">←</button><button type="button" onClick={()=>moveSelected(0,1)} className="min-h-12 rounded-xl border border-[#214a78] bg-[#071426] font-black">↓</button><button type="button" onClick={()=>moveSelected(1,0)} className="min-h-12 rounded-xl border border-[#214a78] bg-[#071426] font-black">→</button><button type="button" onClick={()=>actBall("pass")} className="min-h-12 rounded-xl bg-[#167bd1] font-black">PASS</button><button type="button" onClick={()=>actBall("shoot")} className="min-h-12 rounded-xl bg-[#167bd1] font-black">SHOOT</button><button type="button" onClick={()=>actBall("cross")} className="min-h-12 rounded-xl bg-[#167bd1] font-black">CROSS</button><button type="button" aria-pressed={fullSpeed} onClick={()=>setFullSpeed(v=>!v)} className={"min-h-12 rounded-xl border font-black "+(fullSpeed?"border-[#47a8ff] bg-[#0b3154]":"border-[#214a78] bg-[#071426]")}>FULL SPEED {fullSpeed?"ON":"OFF"}</button></div>}
            {goalNotice && <div key={goalNotice.id} className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden"><div className="confetti-cannon cannon-left" aria-hidden="true">{Array.from({length:18},(_,i)=><span key={`left-${i}`} className="confetti-particle" style={{"--dx":`${100+(i%6)*27}px`,"--dy":`${((i*37)%220)-110}px`,"--rotation":`${i*83}deg`,"animationDelay":`${(i%6)*25}ms`} as React.CSSProperties} />)}</div><div className="confetti-cannon cannon-right" aria-hidden="true">{Array.from({length:18},(_,i)=><span key={`right-${i}`} className="confetti-particle" style={{"--dx":`${-100-(i%6)*27}px`,"--dy":`${((i*43)%220)-110}px`,"--rotation":`${i*97}deg`,"animationDelay":`${(i%6)*25}ms`} as React.CSSProperties} />)}</div><div className="rounded-3xl border border-[#70c1ff] bg-[#061426]/95 px-8 py-6 text-center shadow-[0_0_70px_rgba(71,168,255,.45)] animate-in zoom-in duration-300"><p className="text-4xl font-black tracking-widest text-white">GOAL!</p><p className="mt-2 text-lg font-black text-[#70c1ff]">{goalNotice.team}</p><p className="mt-1 text-2xl font-black tabular-nums">{goalNotice.score}</p><div className="mt-3 flex justify-center gap-5 text-2xl" aria-hidden="true">🎉 ✨ 🎉</div></div></div>}
            {g.ended ? <section className="mt-4 rounded-2xl border border-[#214a78] bg-[#071426] p-5 text-center"><h2 className="text-2xl font-black">Full Time</h2><p className="mt-2 text-sm text-[#9fb6cc]">{g.score[0] === g.score[1] ? "The match ended in a draw." : g.score[0] > g.score[1] ? (teamName.trim() || "MatchUp FC") + " won the match. Nice play!" : "The AI won this one. Run it back?"}</p><button type="button" onClick={start} className="mt-4 rounded-xl bg-[#167bd1] px-5 py-3 text-sm font-black">Rematch</button><button type="button" onClick={() => setStarted(false)} className="ml-2 mt-4 rounded-xl border border-[#214a78] px-5 py-3 text-sm font-bold">Exit Match</button></section> : <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#7892ac]"><span>Drag a blue disc toward the ball or goal to flick it.</span><span>Team: {teamSize} vs {teamSize}</span></div>}
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
