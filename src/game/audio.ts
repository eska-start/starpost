// 합성 효과음 (외부 파일 없음)
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem("sp-muted") === "1";
} catch {
  /* ignore */
}

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("sp-muted", m ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function unlock() {
  ac();
}

function tone(freq: number, dur = 0.12, type: OscillatorType = "sine", vol = 0.18, when = 0, slideTo?: number) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sJump = () => tone(300, 0.14, "square", 0.1, 0, 620);
export const sPad = () => tone(240, 0.25, "sine", 0.2, 0, 960);
export const sPickup = (n: number) => tone(520 + (n % 8) * 70, 0.12, "sine", 0.2);
export const sDeliver = (combo: number) => {
  [523, 659, 784].forEach((f, i) => tone(f, 0.16, "triangle", 0.22, i * 0.06));
  if (combo >= 2) [1047, 1319].forEach((f, i) => tone(f, 0.2, "triangle", 0.2, 0.2 + i * 0.08));
};
export const sHurt = () => tone(200, 0.3, "sawtooth", 0.2, 0, 90);
export const sFall = () => tone(500, 0.4, "sine", 0.18, 0, 120);
export const sClick = () => tone(660, 0.08, "triangle", 0.14);
export const sFanfare = () => {
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, "triangle", 0.22, i * 0.11));
};
export const sTick = () => tone(880, 0.07, "sine", 0.12);

const BEST_KEY = "starpost-best";
const GOLD_KEY = "starpost-gold";
export function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}
export function saveBest(v: number): number {
  try {
    const b = Math.max(loadBest(), v);
    localStorage.setItem(BEST_KEY, String(b));
    return b;
  } catch {
    return v;
  }
}
export function hasGold(): boolean {
  try {
    return localStorage.getItem(GOLD_KEY) === "1";
  } catch {
    return false;
  }
}
export function setGold() {
  try {
    localStorage.setItem(GOLD_KEY, "1");
  } catch {
    /* ignore */
  }
}
