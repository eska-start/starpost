"use client";
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  ISLAND_R, MAIL, PADS, SPOTS, Stage, makeSim, type Sim,
} from "./world";
import {
  hasGold, isMuted, loadBest, saveBest, setGold, setMuted,
  sClick, sDeliver, sFall, sFanfare, sHurt, sJump, sPad, sPickup, sTick, unlock,
} from "./audio";

type Phase = "title" | "play" | "result";

interface FloatText { id: number; text: string }

interface Ui {
  setScore(v: number): void;
  setCarry(v: number): void;
  setCombo(v: number): void;
  setDelivered(v: number): void;
  float(t: string): void;
}

function Logic({ sim, ui, input }: {
  sim: React.RefObject<Sim>;
  ui: React.RefObject<Ui>;
  input: React.RefObject<{ x: number; y: number; jump: boolean }>;
}) {
  useFrame((_, rawDt) => {
    const S = sim.current;
    if (!S.started || S.over || S.paused) return;
    const dt = Math.min(rawDt, 0.05);
    const U = ui.current;

    // 이동
    const len = Math.hypot(input.current.x, input.current.y);
    const nx = len > 1 ? input.current.x / len : input.current.x;
    const nz = len > 1 ? input.current.y / len : input.current.y;
    const SPEED = 7;
    S.vx += (nx * SPEED - S.vx) * Math.min(1, dt * 10);
    S.vz += (nz * SPEED - S.vz) * Math.min(1, dt * 10);
    if (Math.hypot(S.vx, S.vz) > 0.5) S.face = Math.atan2(S.vx, S.vz);

    // 점프·발판
    if (input.current.jump) {
      input.current.jump = false;
      if (S.grounded) {
        S.vy = 8;
        S.grounded = false;
        sJump();
      }
    }
    for (const p of PADS) {
      if (S.grounded && Math.hypot(S.px - p.x, S.pz - p.z) < 1.4) {
        S.vy = 14;
        S.grounded = false;
        sPad();
        U.float("슝!");
      }
    }
    S.vy -= 22 * dt;
    S.px += S.vx * dt;
    S.py += S.vy * dt;
    S.pz += S.vz * dt;
    if (S.py <= 0) {
      S.py = 0;
      S.vy = 0;
      S.grounded = true;
    }
    // 추락
    if (Math.hypot(S.px, S.pz) > ISLAND_R - 0.3 || S.py < -6) {
      S.px = MAIL.x;
      S.pz = MAIL.z + 3;
      S.py = 0;
      S.vx = S.vy = S.vz = 0;
      S.invuln = Math.max(S.invuln, 1);
      sFall();
      U.float("풍덩!");
    }
    if (S.invuln > 0) S.invuln -= dt;

    // 별 자석·수집
    for (const st of S.stars) {
      if (st.taken) {
        if (st.respawnT > 0) {
          st.respawnT -= dt;
          if (st.respawnT <= 0) {
            const [sx, sz] = SPOTS[Math.floor(Math.random() * SPOTS.length)];
            st.x = sx + (Math.random() - 0.5) * 2;
            st.z = sz + (Math.random() - 0.5) * 2;
            st.taken = false;
          }
        }
        continue;
      }
      const d = Math.hypot(st.x - S.px, st.z - S.pz);
      if (d < 4.5 && S.py < 3) {
        st.x += ((S.px - st.x) / (d || 1)) * 10 * dt;
        st.z += ((S.pz - st.z) / (d || 1)) * 10 * dt;
      }
      if (d < 1.5 && S.py < 2.2) {
        st.taken = true;
        st.respawnT = 2;
        S.carry += 1;
        U.setCarry(S.carry);
        sPickup(S.carry);
      }
    }

    // 배달
    if (S.comboT > 0) {
      S.comboT -= dt;
      if (S.comboT <= 0) {
        S.combo = 0;
        U.setCombo(0);
      }
    }
    const md = Math.hypot(S.px - MAIL.x, S.pz - MAIL.z);
    if (md < 2.4 && S.carry > 0) {
      const now = performance.now() / 1000;
      void now;
      S.combo = S.comboT > 0 ? Math.min(S.combo + 1, 5) : 1;
      S.comboT = 8;
      const pts = S.carry * 100 * S.combo;
      S.score += pts;
      S.delivered += S.carry;
      S.carry = 0;
      const rid = Date.now() + Math.random();
      S.rings = [...S.rings.slice(-2), { id: rid, x: MAIL.x, z: MAIL.z, t: 0 }];
      S.shake = Math.max(S.shake, 0.4);
      sDeliver(S.combo);
      U.setScore(S.score);
      U.setCarry(0);
      U.setCombo(S.combo);
      U.setDelivered(S.delivered);
      U.float(S.combo > 1 ? `배달! +${pts} (${S.combo}콤보!)` : `배달! +${pts}`);
    }

    // 몽실이 AI
    for (const b of S.blobs) {
      const [tx, tz] = b.wp[(b.i + 1) % b.wp.length];
      const pd = Math.hypot(S.px - b.x, S.pz - b.z);
      if (b.mode === "walk") {
        if (pd < 4 && S.invuln <= 0) {
          b.mode = "chase";
          b.t = 1.5;
        } else {
          const d = Math.hypot(tx - b.x, tz - b.z);
          if (d < 0.4) b.i = (b.i + 1) % b.wp.length;
          else {
            b.x += ((tx - b.x) / d) * b.speed * dt;
            b.z += ((tz - b.z) / d) * b.speed * dt;
          }
        }
      } else if (b.mode === "chase") {
        b.t -= dt;
        const d = pd || 1;
        b.x += ((S.px - b.x) / d) * b.speed * 2 * dt;
        b.z += ((S.pz - b.z) / d) * b.speed * 2 * dt;
        if (b.t <= 0) {
          b.mode = "rest";
          b.t = 2;
        }
      } else {
        b.t -= dt;
        if (b.t <= 0) b.mode = "walk";
      }
      // 접촉
      if (pd < 1.3 && S.invuln <= 0) {
        if (S.carry > 0) {
          const drop = Math.min(3, S.carry);
          S.carry -= drop;
          U.setCarry(S.carry);
          for (let k = 0; k < drop; k++) {
            S.stars.push({
              id: 1000 + Math.floor(Math.random() * 100000),
              x: S.px + (Math.random() - 0.5) * 5,
              z: S.pz + (Math.random() - 0.5) * 5,
              taken: false, respawnT: 0,
            });
          }
          U.float(`앗! 별 ${drop}개 흩어짐!`);
        } else {
          U.float("아슬아슬!");
        }
        S.combo = 0;
        S.comboT = 0;
        U.setCombo(0);
        S.invuln = 1.5;
        S.shake = Math.max(S.shake, 1);
        sHurt();
      }
    }
  });
  return null;
}

export function Game() {
  const [phase, setPhase] = useState<Phase>("title");
  const [score, setScore] = useState(0);
  const [carry, setCarry] = useState(0);
  const [combo, setCombo] = useState(0);
  const [delivered, setDelivered] = useState(0);
  const [time, setTime] = useState(90);
  const [best, setBest] = useState(loadBest);
  const [gold, setGoldState] = useState(hasGold);
  const [muted, setMutedState] = useState(isMuted());
  const [paused, setPaused] = useState(false);
  const [medal, setMedal] = useState(0);
  const [floats, setFloats] = useState<FloatText[]>([]);

  const sim = useRef<Sim>(makeSim());  const input = useRef({ x: 0, y: 0, jump: false });
  const keys = useRef({ up: false, down: false, left: false, right: false });
  const pausedRef = useRef(false);
  const floatId = useRef(1);
  pausedRef.current = paused;

  useEffect(() => {
    sim.current.paused = paused;
  }, [paused]);

  const ui = useRef<Ui>({
    setScore, setCarry, setCombo, setDelivered,
    float: (text: string) => {
      const id = floatId.current++;
      setFloats((f) => [...f.slice(-2), { id, text }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1300);
    },
  });

  const syncInput = () => {
    const k = keys.current;
    const j = joy.current;
    input.current.x = (k.right ? 1 : 0) - (k.left ? 1 : 0) + j.x;
    input.current.y = (k.down ? 1 : 0) - (k.up ? 1 : 0) + j.y;
  };
  const joy = useRef({ x: 0, y: 0 });

  // 타이머
  useEffect(() => {
    if (phase !== "play") return;
    let ticked = false;
    const timer = setInterval(() => {
      const S = sim.current;
      if (pausedRef.current || S.over) return;
      S.time -= 1;
      setTime(S.time);
      if (S.time <= 10 && S.time > 0) sTick();
      if (S.time <= 0 && !ticked) {
        ticked = true;
        S.over = true;
        const m = S.score >= 3500 ? 3 : S.score >= 2500 ? 2 : S.score >= 1500 ? 1 : 0;
        setMedal(m);
        if (m >= 3) {
          setGold();
          setGoldState(true);
        }
        setBest(saveBest(S.score));
        sFanfare();
        setPhase("result");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // 키보드
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      const k = keys.current;
      switch (e.code) {
        case "ArrowUp": case "KeyW": k.up = true; break;
        case "ArrowDown": case "KeyS": k.down = true; break;
        case "ArrowLeft": case "KeyA": k.left = true; break;
        case "ArrowRight": case "KeyD": k.right = true; break;
        case "Space":
          e.preventDefault();
          if (!e.repeat) input.current.jump = true;
          if (phase === "title") start();
          break;
        case "Enter":
          if (phase === "title" || phase === "result") start();
          break;
        case "KeyP": case "Escape":
          if (phase === "play") setPaused((p) => !p);
          break;
        case "KeyR":
          if (phase !== "title") start();
          break;
      }
      syncInput();
    };
    const up = (e: KeyboardEvent) => {
      const k = keys.current;
      switch (e.code) {
        case "ArrowUp": case "KeyW": k.up = false; break;
        case "ArrowDown": case "KeyS": k.down = false; break;
        case "ArrowLeft": case "KeyA": k.left = false; break;
        case "ArrowRight": case "KeyD": k.right = false; break;
      }
      syncInput();
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = () => {
    unlock();
    sClick();
    sim.current = makeSim();
    sim.current.started = true;
    input.current = { x: 0, y: 0, jump: false };
    keys.current = { up: false, down: false, left: false, right: false };
    joy.current = { x: 0, y: 0 };
    setScore(0);
    setCarry(0);
    setCombo(0);
    setDelivered(0);
    setTime(90);
    setPaused(false);
    setFloats([]);
    setPhase("play");
  };

  return (
    <div className="sp-shell">
      {phase === "title" && (
        <>
          <h1 className="sp-logo">별빛 우체부 루모</h1>
          <p className="sp-sub">떠다니는 섬 마을 배달 어드벤처</p>
          <div className="sp-card">
            둥실섬에 별빛이 흩어졌어요! <b>별을 주워 우체통에 배달</b>하세요.
            몽실이를 조심! 맞으면 별이 흩어져요. <b>90초</b> 안에 최대한 많이!
          </div>
          <div className="sp-card">
            <b>조작:</b> 방향키·WASD 이동, 스페이스 점프, 노란 발판은 높이 점프.
            1500점 동메달 · 2500점 은메달 · <b>3500점 금메달</b>
            {best > 0 && <div>최고 기록: <b>{best}점</b></div>}
          </div>
          <button className="sp-btn" onClick={start}>배달 시작!</button>
        </>
      )}
      {phase !== "title" && (
        <>
          <div className="sp-hud">
            <span className="sp-pill" style={time <= 10 && phase === "play" ? { background: "#fecaca", color: "#991b1b" } : undefined}>
              ⏱ {time}초
            </span>
            <span className="sp-pill">점수 {phase === "play" ? score : sim.current.score}</span>
            <span className="sp-pill">별 {carry}개</span>
            {combo >= 2 && phase === "play" && <span className="sp-pill hot">{combo}콤보!</span>}
            <button className="sp-icon" onClick={() => { const m = !muted; setMutedState(m); setMuted(m); }}>
              {muted ? "🔇" : "🔊"}
            </button>
            {phase === "play" && (
              <button className="sp-icon" onClick={() => setPaused((p) => !p)}>{paused ? "▶" : "⏸"}</button>
            )}
          </div>
          <div className="sp-stage" style={{ height: "58vh", minHeight: 380 }}>
            <StageInner sim={sim} ui={ui} input={input} gold={gold} />
            {floats.map((f) => (
              <div key={f.id} className="sp-float">{f.text}</div>
            ))}
            {phase === "play" && paused && (
              <div className="sp-veil">
                <h2>정지됨</h2>
                <button className="sp-btn small" style={{ maxWidth: 240 }} onClick={() => setPaused(false)}>계속하기</button>
                <button className="sp-btn small ghost" style={{ maxWidth: 240 }} onClick={start}>처음부터</button>
              </div>
            )}
            {phase === "result" && (
              <div className="sp-veil">
                <h2>배달 종료!</h2>
                <div className="sp-medal">
                  {medal >= 3 ? "🥇" : medal === 2 ? "🥈" : medal === 1 ? "🥉" : "⭐"}
                </div>
                <div style={{ fontSize: 28 }}>{sim.current.score}점 · 배달 {sim.current.delivered}개</div>
                <div style={{ fontSize: 20 }}>최고 {best}점</div>
                <div className="sp-row" style={{ width: "100%", maxWidth: 420 }}>
                  <button className="sp-btn small" onClick={start}>다시 배달</button>
                  <button className="sp-btn small ghost" onClick={() => setPhase("title")}>타이틀로</button>
                </div>
              </div>
            )}
          </div>
          {phase === "play" && !paused && (
            <div className="sp-touch">
              <div
                className="sp-stick"
                onPointerDown={(e) => {
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  stickMove(e, true);
                }}
                onPointerMove={(e) => {
                  if (e.buttons) stickMove(e, false);
                }}
                onPointerUp={() => stickEnd()}
                onPointerCancel={() => stickEnd()}
              >
                <div className="sp-knob" id="sp-knob" />
              </div>
              <button
                className="sp-jump"
                onPointerDown={(e) => {
                  e.preventDefault();
                  input.current.jump = true;
                }}
              >
                점프
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  function stickMove(e: React.PointerEvent, _first: boolean) {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2);
    let dy = (e.clientY - cy) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) {
      dx /= l;
      dy /= l;
    }
    joy.current = { x: dx, y: dy };
    syncInput();
    const knob = document.getElementById("sp-knob");
    if (knob) knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    void _first;
  }
  function stickEnd() {
    joy.current = { x: 0, y: 0 };
    syncInput();
    const knob = document.getElementById("sp-knob");
    if (knob) knob.style.transform = "";
  }
}

function StageInner({ sim, ui, input, gold }: {
  sim: React.RefObject<Sim>;
  ui: React.RefObject<Ui>;
  input: React.RefObject<{ x: number; y: number; jump: boolean }>;
  gold: boolean;
}) {
  return (
    <Stage sim={sim} gold={gold}>
      <Logic sim={sim} ui={ui} input={input} />
    </Stage>
  );
}
