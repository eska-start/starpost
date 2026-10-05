"use client";
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface Star { id: number; x: number; z: number; taken: boolean; respawnT: number }
export interface Blob { wp: [number, number][]; i: number; x: number; z: number; mode: "walk" | "chase" | "rest"; t: number; speed: number }
export interface Ring { id: number; x: number; z: number; t: number }

export interface Sim {
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  grounded: boolean;
  face: number;
  carry: number;
  invuln: number;
  score: number;
  combo: number;
  comboT: number;
  time: number;
  over: boolean;
  started: boolean;
  stars: Star[];
  blobs: Blob[];
  rings: Ring[];
  shake: number;
  delivered: number;
  paused: boolean;
}

export const ISLAND_R = 17;
export const MAIL = { x: 0, z: -2 };
export const PADS = [{ x: -9, z: 6 }, { x: 9, z: 6 }, { x: 0, z: 11 }];
export const SPOTS: [number, number][] = [
  [-12, -8], [-5, -11], [5, -11], [12, -8],
  [-14, 2], [14, 2], [-8, 10], [8, 10],
];

export function makeSim(): Sim {
  return {
    px: 0, py: 0, pz: 3, vx: 0, vy: 0, vz: 0,
    grounded: true, face: Math.PI, carry: 0, invuln: 0,
    score: 0, combo: 0, comboT: 0, time: 90, over: false, started: false,
    stars: SPOTS.map(([x, z], i) => ({ id: i + 1, x, z, taken: false, respawnT: 0 })),
    blobs: [
      { wp: [[-10, -4], [-4, -8], [-8, 2]], i: 0, x: -10, z: -4, mode: "walk", t: 0, speed: 2.4 },
      { wp: [[10, -4], [4, -8], [8, 2]], i: 0, x: 10, z: -4, mode: "walk", t: 0, speed: 2.6 },
      { wp: [[-6, 9], [6, 9], [0, 13]], i: 0, x: -6, z: 9, mode: "walk", t: 0, speed: 2.2 },
    ],
    rings: [],
    shake: 0, delivered: 0, paused: false,
  };
}

// ── 루모 (주인공) ─────────────────────────────────
export function Lumo({ sim }: { sim: React.RefObject<Sim> }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  useFrame(() => {
    const r = root.current;
    if (!r) return;
    r.position.set(sim.current.px, sim.current.py, sim.current.pz);
    r.rotation.y = sim.current.face;
    const sp = Math.hypot(sim.current.vx, sim.current.vz);
    if (body.current) {
      body.current.position.y = sim.current.grounded ? Math.abs(Math.sin(performance.now() / 90)) * 0.08 * Math.min(1, sp / 4) : 0;
      body.current.rotation.x = sim.current.grounded ? Math.min(0.25, sp * 0.03) : -0.15;
    }
    const m = r.children[0] as THREE.Group | undefined;
    if (m && sim.current.invuln > 0) {
      m.visible = Math.floor(performance.now() / 120) % 2 === 0;
    } else if (m) {
      m.visible = true;
    }
  });
  return (
    <group ref={root}>
      <group ref={body}>
        {/* 다리 */}
        <mesh position={[-0.22, 0.3, 0]}><capsuleGeometry args={[0.14, 0.35, 6, 10]} /><meshStandardMaterial color="#475569" /></mesh>
        <mesh position={[0.22, 0.3, 0]}><capsuleGeometry args={[0.14, 0.35, 6, 10]} /><meshStandardMaterial color="#475569" /></mesh>
        {/* 몸통 */}
        <mesh position={[0, 0.95, 0]}><capsuleGeometry args={[0.45, 0.5, 8, 16]} /><meshStandardMaterial color="#fef3c7" roughness={0.6} /></mesh>
        {/* 파란 머플러 */}
        <mesh position={[0, 1.32, 0]}><torusGeometry args={[0.4, 0.12, 10, 20]} /><meshStandardMaterial color="#38bdf8" /></mesh>
        <mesh position={[0.3, 1.0, -0.25]}><boxGeometry args={[0.18, 0.5, 0.08]} /><meshStandardMaterial color="#38bdf8" /></mesh>
        {/* 우편가방 */}
        <mesh position={[0, 1.0, -0.55]}><boxGeometry args={[0.55, 0.45, 0.25]} /><meshStandardMaterial color="#b45309" /></mesh>
        {/* 머리 */}
        <mesh position={[0, 1.95, 0]}><sphereGeometry args={[0.45, 20, 20]} /><meshStandardMaterial color="#ffe4c4" roughness={0.5} /></mesh>
        <mesh position={[-0.16, 2, 0.4]}><sphereGeometry args={[0.1, 10, 10]} /><meshStandardMaterial color="#fff" /></mesh>
        <mesh position={[0.16, 2, 0.4]}><sphereGeometry args={[0.1, 10, 10]} /><meshStandardMaterial color="#fff" /></mesh>
        <mesh position={[-0.16, 2, 0.48]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color="#111" /></mesh>
        <mesh position={[0.16, 2, 0.48]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color="#111" /></mesh>
        <mesh position={[0, 1.82, 0.45]}><torusGeometry args={[0.1, 0.03, 8, 12, Math.PI]} /><meshStandardMaterial color="#92400e" /></mesh>
        {/* 모자 */}
        <mesh position={[0, 2.3, 0]}><cylinderGeometry args={[0.3, 0.42, 0.3, 14]} /><meshStandardMaterial color="#ef4444" /></mesh>
        <mesh position={[0, 2.16, 0.1]}><boxGeometry args={[0.8, 0.08, 0.5]} /><meshStandardMaterial color="#991b1b" /></mesh>
        {/* 팔 */}
        <mesh position={[-0.55, 1, 0]}><capsuleGeometry args={[0.12, 0.4, 6, 10]} /><meshStandardMaterial color="#fef3c7" /></mesh>
        <mesh position={[0.55, 1, 0]}><capsuleGeometry args={[0.12, 0.4, 6, 10]} /><meshStandardMaterial color="#fef3c7" /></mesh>
      </group>
      {/* 그림자 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.55, 18]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

// ── 별빛 ──────────────────────────────────────────
export function Starbits({ sim }: { sim: React.RefObject<Sim> }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    sim.current.stars.forEach((s, i) => {
      const m = refs.current[i];
      if (!m) return;
      m.visible = !s.taken;
      if (s.taken) return;
      m.position.set(s.x, 1 + Math.sin(t * 3 + s.id) * 0.2, s.z);
      m.rotation.y = t * 2 + s.id;
    });
  });
  return (
    <group>
      {sim.current.stars.map((s, i) => (
        <group key={s.id} ref={(el) => { refs.current[i] = el; }}>
          <mesh>
            <octahedronGeometry args={[0.45]} />
            <meshStandardMaterial color="#fde047" emissive="#f59e0b" emissiveIntensity={0.9} roughness={0.2} />
          </mesh>
          <pointLight intensity={2.5} distance={6} color="#fde047" />
        </group>
      ))}
    </group>
  );
}

// ── 몽실이 ────────────────────────────────────────
export function Blobs({ sim }: { sim: React.RefObject<Sim> }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    sim.current.blobs.forEach((b, i) => {
      const m = refs.current[i];
      if (!m) return;
      m.position.set(b.x, 0, b.z);
      const squash = 1 + Math.sin(t * 6 + i * 2) * 0.08;
      m.scale.set(2 - squash > 1 ? 1 : 1 / Math.sqrt(squash), squash, 1);
      m.rotation.y = Math.atan2(
        b.wp[(b.i + 1) % b.wp.length][0] - b.x,
        b.wp[(b.i + 1) % b.wp.length][1] - b.z,
      );
    });
  });
  return (
    <group>
      {sim.current.blobs.map((b, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <mesh position={[0, 0.7, 0]}>
            <sphereGeometry args={[0.8, 18, 18]} />
            <meshStandardMaterial color={b.mode === "chase" ? "#ef4444" : "#a855f7"} roughness={0.5} />
          </mesh>
          <mesh position={[-0.28, 0.9, 0.62]}><sphereGeometry args={[0.16, 10, 10]} /><meshStandardMaterial color="#fff" /></mesh>
          <mesh position={[0.28, 0.9, 0.62]}><sphereGeometry args={[0.16, 10, 10]} /><meshStandardMaterial color="#fff" /></mesh>
          <mesh position={[-0.28, 0.9, 0.74]}><sphereGeometry args={[0.07, 8, 8]} /><meshBasicMaterial color={b.mode === "chase" ? "#7f1d1d" : "#111"} /></mesh>
          <mesh position={[0.28, 0.9, 0.74]}><sphereGeometry args={[0.07, 8, 8]} /><meshBasicMaterial color={b.mode === "chase" ? "#7f1d1d" : "#111"} /></mesh>
          <mesh position={[0, 0.5, 0.72]}>
            <torusGeometry args={[0.18, 0.05, 8, 12, Math.PI]} />
            <meshStandardMaterial color={b.mode === "rest" ? "#4c1d95" : "#7f1d1d"} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <circleGeometry args={[0.8, 18]} />
            <meshBasicMaterial color="#000" transparent opacity={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── 우체통·발판·배달 파동 ─────────────────────────
export function Mailbox({ sim, gold }: { sim: React.RefObject<Sim>; gold: boolean }) {
  const flag = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!flag.current) return;
    flag.current.rotation.y = Math.sin(clock.getElapsedTime() * 2) * 0.3;
  });
  const red = gold ? "#facc15" : "#dc2626";
  const dark = gold ? "#a16207" : "#991b1b";
  return (
    <group position={[MAIL.x, 0, MAIL.z]}>
      <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[0.8, 0.8, 2.2, 18]} /><meshStandardMaterial color={red} roughness={0.4} /></mesh>
      <mesh position={[0, 2.3, 0]}><sphereGeometry args={[0.8, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={dark} /></mesh>
      <mesh position={[0, 1.4, 0.82]}><boxGeometry args={[0.9, 0.5, 0.06]} /><meshStandardMaterial color={dark} /></mesh>
      <mesh position={[0.9, 1.6, 0]}><cylinderGeometry args={[0.08, 0.08, 1, 8]} /><meshStandardMaterial color={dark} /></mesh>
      <mesh ref={flag} position={[1.15, 2, 0]}><boxGeometry args={[0.5, 0.3, 0.04]} /><meshStandardMaterial color="#fde047" emissive="#fde047" emissiveIntensity={0.5} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.4, 1.7, 28]} />
        <meshBasicMaterial color={gold ? "#facc15" : "#fff"} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function Rings({ sim }: { sim: React.RefObject<Sim> }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_, dt) => {
    sim.current.rings.forEach((r, i) => {
      const m = refs.current[i];
      if (!m) return;
      r.t += dt;
      const k = r.t / 0.7;
      m.visible = k < 1;
      m.position.set(r.x, 0.3 + k * 1.6, r.z);
      m.scale.setScalar(1 + k * 4);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    });
    if (sim.current.rings.length && sim.current.rings.every((r) => r.t >= 0.7)) {
      sim.current.rings = [];
    }
  });
  return (
    <group>
      {sim.current.rings.map((r, i) => (
        <mesh key={r.id} ref={(el) => { refs.current[i] = el; }} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 1, 28]} />
          <meshBasicMaterial color="#fde047" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export function Pads() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m) => {
      if (!m) return;
      m.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
    });
  });
  return (
    <group>
      {PADS.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[1.1, 1.3, 0.3, 20]} /><meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.4} /></mesh>
          <mesh ref={(el) => { refs.current[i] = el; }} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.32, 0]}>
            <ringGeometry args={[0.5, 0.75, 20]} />
            <meshBasicMaterial color="#fff" transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── 섬·하늘·카메라 ────────────────────────────────
export function Island() {
  const clouds = useMemo(() => [[-14, 12, -14], [10, 14, -18], [0, 11, 14], [16, 13, 8]], []);
  const cl = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!cl.current) return;
    const t = clock.getElapsedTime() * 0.3;
    cl.current.children.forEach((c, i) => {
      c.position.x = clouds[i][0] + Math.sin(t * (0.5 + i * 0.2) + i) * 3;
    });
  });
  return (
    <group>
      {/* 섬 본체 */}
      <mesh position={[0, -1.5, 0]}><cylinderGeometry args={[ISLAND_R, ISLAND_R - 0.5, 3, 40]} /><meshStandardMaterial color="#4ade80" roughness={0.9} /></mesh>
      <mesh position={[0, -3.4, 0]}><cylinderGeometry args={[ISLAND_R - 0.5, ISLAND_R - 3, 2.5, 40]} /><meshStandardMaterial color="#92400e" roughness={0.9} /></mesh>
      <mesh position={[0, -7.5, 0]}><coneGeometry args={[ISLAND_R - 5, 7, 24]} /><meshStandardMaterial color="#78716c" roughness={1} /></mesh>
      {/* 길 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 4]}>
        <planeGeometry args={[3.4, 20]} />
        <meshStandardMaterial color="#e7e5e4" />
      </mesh>
      {/* 꽃 */}
      {[[-6, -3], [7, -6], [-11, 5], [11, 9], [4, 12], [-4, 12]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.05, 0.05, 0.6, 6]} /><meshStandardMaterial color="#16a34a" /></mesh>
          <mesh position={[0, 0.7, 0]}><sphereGeometry args={[0.22, 10, 10]} /><meshStandardMaterial color={["#f472b6", "#facc15", "#fff"][i % 3]} /></mesh>
        </group>
      ))}
      {/* 나무 */}
      {[[-13, -9], [13, -9], [-14, 8]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.28, 0.38, 1.8, 10]} /><meshStandardMaterial color="#92400e" /></mesh>
          <mesh position={[0, 2.8, 0]}><coneGeometry args={[1.6, 3, 12]} /><meshStandardMaterial color="#22c55e" /></mesh>
        </group>
      ))}
      {/* 구름 */}
      <group ref={cl}>
        {clouds.map((c, i) => (
          <group key={i} position={[c[0], c[1], c[2]]}>
            <mesh><sphereGeometry args={[1.8, 12, 12]} /><meshStandardMaterial color="#fff" transparent opacity={0.9} /></mesh>
            <mesh position={[1.6, -0.3, 0]}><sphereGeometry args={[1.2, 10, 10]} /><meshStandardMaterial color="#fff" transparent opacity={0.9} /></mesh>
            <mesh position={[-1.6, -0.3, 0]}><sphereGeometry args={[1.2, 10, 10]} /><meshStandardMaterial color="#fff" transparent opacity={0.9} /></mesh>
          </group>
        ))}
      </group>
      {/* 달 */}
      <mesh position={[20, 16, -24]}><sphereGeometry args={[2.5, 18, 18]} /><meshStandardMaterial color="#fef9c3" emissive="#fde047" emissiveIntensity={0.5} /></mesh>
    </group>
  );
}

export function FollowCam({ sim }: { sim: React.RefObject<Sim> }) {
  const pos = useRef(new THREE.Vector3(0, 12, 14));
  useFrame(({ camera }) => {
    const S = sim.current;
    const tx = S.px * 0.75;
    const tz = S.pz * 0.75 + 11;
    pos.current.x += (tx - pos.current.x) * 0.06;
    pos.current.z += (tz - pos.current.z) * 0.06;
    let sx = 0;
    let sy = 0;
    if (S.shake > 0.01) {
      sx = (Math.random() - 0.5) * S.shake;
      sy = (Math.random() - 0.5) * S.shake;
      S.shake *= 0.88;
    }
    camera.position.set(pos.current.x + sx, 12 + sy, pos.current.z);
    camera.lookAt(S.px * 0.85, 1, S.pz * 0.85 - 1.5);
  });
  return null;
}

export function Stage({ sim, gold, children }: { sim: React.RefObject<Sim>; gold: boolean; children?: React.ReactNode }) {
  return (
    <Canvas camera={{ position: [0, 12, 14], fov: 55 }} style={{ position: "absolute", inset: 0 }}>
      <color attach="background" args={["#1e1b4b"]} />
      <fog attach="fog" args={["#1e1b4b", 40, 75]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 16, 8]} intensity={1.3} />
      <pointLight position={[0, 6, 0]} intensity={12} distance={30} color="#fde68a" />
      <FollowCam sim={sim} />
      <Island />
      <Mailbox sim={sim} gold={gold} />
      <Pads />
      <Starbits sim={sim} />
      <Blobs sim={sim} />
      <Rings sim={sim} />
      <Lumo sim={sim} />
      {children}
    </Canvas>
  );
}
