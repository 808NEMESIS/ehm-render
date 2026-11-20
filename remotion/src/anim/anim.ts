/**
 * Animatie-gereedschap voor de scènes. Alles is een pure functie van het frame, zodat een scène ook achteruit kan
 * (terugspoelen) en elk frame los te renderen is.
 */
import {Easing, interpolate, spring} from 'remotion';

export const FPS = 30;

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Waarde tussen sleutelframes, met per stuk een vloeiende overgang. keys: [[frame, waarde], ...] oplopend. */
export function keys(t: number, k0: [number, number][], ease: (x: number) => number = Easing.inOut(Easing.cubic)): number {
  // korte scènes kunnen sleutels laten overlappen; dan schuift elke sleutel net na de vorige (anders weigert interpolate)
  const k: [number, number][] = [];
  for (const [f, v] of k0) k.push([k.length ? Math.max(f, k[k.length - 1][0] + 0.01) : f, v]);
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const [a, va] = k[i - 1];
      const [b, vb] = k[i];
      return interpolate(t, [a, b], [va, vb], {...CLAMP, easing: ease});
    }
  }
  return k[k.length - 1][1];
}

export const lin = (t: number, a: number, b: number, va = 0, vb = 1) => (b > a ? interpolate(t, [a, b], [va, vb], CLAMP) : t < a ? va : vb);

/** Veer van 0 naar 1 vanaf frame `at` (0 ervoor). */
export function spr(t: number, at: number, cfg: {damping?: number; stiffness?: number; mass?: number} = {}): number {
  if (t < at) return 0;
  return spring({frame: t - at, fps: FPS, config: {damping: 12, stiffness: 170, mass: 0.7, ...cfg}});
}

/** Gladde ruis (-1..1), deterministisch. */
export function noise(x: number, seed = 0): number {
  const s = (n: number) => {
    const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return (v - Math.floor(v)) * 2 - 1;
  };
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return s(i) * (1 - u) + s(i + 1) * u;
}

/** Een sprong met anticipatie: inzakken, uitrekken in de lucht, landen met squash, natrillen. */
export function hop(t: number, at: number, height = 60, dur = 16): {y: number; sx: number; sy: number} {
  const d = t - at;
  if (d < -5 || d > dur + 18) return {y: 0, sx: 1, sy: 1};
  if (d < 0) {
    const a = lin(d, -5, 0); // inzakken
    return {y: 0, sx: 1 + 0.1 * a, sy: 1 - 0.14 * a};
  }
  if (d <= dur) {
    const p = d / dur;
    const y = -4 * height * p * (1 - p);
    const stretch = 1 - Math.abs(p - 0.5) * 2; // het meest uitgerekt op de top... juist bij af- en aanzet
    return {y, sx: 1 - 0.08 * (1 - stretch), sy: 1 + 0.14 * (1 - stretch)};
  }
  const s = spr(t, at + dur, {damping: 7, stiffness: 260, mass: 0.5});
  const squash = (1 - s) * 0.22 * Math.cos((t - at - dur) * 0.9);
  return {y: 0, sx: 1 + squash * 0.8, sy: 1 - squash};
}

/** Een schrik of klap: kort indeuken en terugveren. */
export function flinch(t: number, at: number, amount = 0.12): {sx: number; sy: number} {
  if (t < at || t > at + 30) return {sx: 1, sy: 1};
  const d = t - at;
  const v = amount * Math.exp(-d / 5) * Math.cos(d * 0.75);
  return {sx: 1 + v * 0.7, sy: 1 - v};
}

/** Cameraschok na elk moment in `times`. */
export function shake(t: number, times: number[], amp = 10): {x: number; y: number; r: number} {
  let x = 0, y = 0, r = 0;
  for (const at of times) {
    const d = t - at;
    if (d < 0 || d > 14) continue;
    const k = amp * Math.exp(-d / 3.5);
    x += k * noise(d * 1.7, at);
    y += k * noise(d * 1.9, at + 7);
    r += k * 0.06 * noise(d * 1.3, at + 13);
  }
  return {x, y, r};
}

// ------------------------------------------------------------------ spraak
// Een regel wordt in lettergrepen opgeknipt; per lettergreep een vast aantal frames. Dezelfde regels staan in
// scripts/geluid.py, zodat de brabbelstem, de mond en de woorden precies samenvallen.
export const SYL = 4; // frames per lettergreep
export const WORD_GAP = 2;
export const PAUSE = 7; // na . , ? ! …

export type Syllable = {s: number; e: number};
export type Word = {text: string; s: number; e: number; syl: Syllable[]};

export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  const groups = w.replace(/e$/, '').match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function speech(text: string, at: number): Word[] {
  const out: Word[] = [];
  let t = at;
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const n = Math.max(1, syllables(raw));
    const syl: Syllable[] = [];
    for (let i = 0; i < n; i++) syl.push({s: t + i * SYL, e: t + (i + 1) * SYL - 1});
    out.push({text: raw, s: t, e: t + n * SYL, syl});
    t += n * SYL + WORD_GAP + (/[.,?!…]$/.test(raw) ? PAUSE : 0);
  }
  return out;
}

export const speechEnd = (words: Word[]) => (words.length ? words[words.length - 1].e : 0);

/** Mondopening 0..1 op frame t voor deze regel (0 als er niet gesproken wordt). */
export function mouth(words: Word[], t: number): number {
  for (const w of words) {
    if (t < w.s || t > w.e) continue;
    for (const s of w.syl) {
      if (t >= s.s && t <= s.e) {
        const p = (t - s.s) / Math.max(1, s.e - s.s);
        return Math.sin(Math.PI * Math.min(1, p * 1.2));
      }
    }
  }
  return 0;
}
