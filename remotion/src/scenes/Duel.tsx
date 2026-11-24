/**
 * Ehm tegen Ehm: hetzelfde moment twee keer. Twee opbouwen (data.layout):
 * - sequence (sinds 13 nov): eerst het foute gesprek schermvullend, NOPE, verfrommelen, terugspoelen ("Take 2"), dan het
 *   goede gesprek schermvullend. Eén gesprek tegelijk, zodat je op het verschil let.
 * - split: twee stripvakken boven elkaar, om de beurt (hieronder).
 *
 * Ehm tegen Ehm in twee stripvakken. Een derde beeldtaal naast de escalatie en de spelvorm:
 * - getekend als een strip: papier met rasterpunten, dikke vakranden, klanknabootsingen (GULP!, NICE!);
 * - geanimeerd "op tweeën" (een nieuwe tekening per 2 frames) met trillende lijnen, zoals handgetekende animatie;
 * - het vak dat niet aan de beurt is staat stil en verbleekt, zodat je oog heen en weer springt.
 * Aan het eind krijgt het bovenste vak een NOPE-stempel, wordt het verfrommeld en weggegooid, en groeit het onderste
 * vak tot bijna het hele beeld.
 *
 * Tijden uit scripts/duel.py; scripts/geluid.py (duel_soundtrack) leest dezelfde data.
 */
import React from 'react';
import {AbsoluteFill, Easing, Html5Audio, staticFile, useCurrentFrame} from 'remotion';
import {Ehm, Expression} from '../ehm/Ehm';
import type {Setting} from './Escalatie';
import {Cast, CastExpression, Outfit, Role} from '../ehm/Cast';
import {C, FIELD, Pillar} from '../ehm/colors';
import {FONT_BODY, FONT_HEAD} from '../fonts';
import {flinch, hop, keys, lin, mouth, noise, speech, spr} from '../anim/anim';

type Panel = 'top' | 'bottom' | 'both';
export type DuelLine = {panel: Panel; who: 'ehm' | Role; text: string; at: number; until: number; tone?: 'not' | 'yes'};
export type DuelData = {
  kind: 'duel'; layout?: 'split' | 'sequence'; rewind?: number; slug: string; pillar: Pillar; caption: string; hook: string; verdict?: boolean;
  setting: Setting; cast: Role; outfit?: Outfit; variant?: string; voice?: string;
  lines: DuelLine[]; sfx: {panel: 'top' | 'bottom'; text: string; at: number}[];
  nope: number; crumble: number; expand: number; celebrate: number; cta: number; total: number; badge: string; sticker: string;
};
export type DuelProps = {data: DuelData; audio?: string};

const INNER = {w: 1000, h: 640};
const RECT = {
  top: {x: 40, y: 330, w: 1000, h: 640, r: -1.2},
  bottom: {x: 40, y: 1000, w: 1000, h: 640, r: 0.9},
  big: {x: 24, y: 420, w: 1032, h: 800, r: 0},
  seq: {x: 24, y: 390, w: 1032, h: 1110, r: 0},    // één vak tegelijk: bijna het hele beeld, personages groter
};
const SEQ_ZOOM = 1.3;
const SEQ_INNER_H = Math.round(1110 / SEQ_ZOOM);
const outline = (px: number) => ({WebkitTextStroke: `${px}px ${C.ink}`, paintOrder: 'stroke fill' as const});

/** Tekentijd: een nieuwe tekening per 2 frames. */
const onTwos = (f: number) => Math.floor(f / 2) * 2;

const ofPanel = (l: DuelLine, p: 'top' | 'bottom') => l.panel === p || l.panel === 'both';
function talking(d: DuelData, p: 'top' | 'bottom', who: string, t: number): number | null {
  for (const l of d.lines) {
    if (!ofPanel(l, p) || l.who !== who) continue;
    const w = speech(l.text, l.at);
    if (t >= l.at && t <= w[w.length - 1].e + 2) return mouth(w, t);
  }
  return null;
}
/** Wie is er nu aan de beurt? Het andere vak staat stil. */
function turn(d: DuelData, out: number): Panel {
  let cur: Panel = 'both';
  for (const l of d.lines) if (out >= l.at - 4) cur = l.panel;
  if (out >= d.nope) return 'bottom';
  return cur;
}

// ------------------------------------------------------------------ decor per plek (in vak-coördinaten)
export const SET = {
  kantoor: {wall: '#D3C2FF', floor: '#A58CEB'},
  feestje: {wall: '#CBEB8C', floor: '#A8DB63'},
  keuken: {wall: '#FFE6B8', floor: '#E8B87A'},
  vergadering: {wall: '#BFE6E0', floor: '#7FC4B8'},
  buiten: {wall: '#BDE3FF', floor: '#C9CED8'},
  restaurant: {wall: '#F2B8A0', floor: '#A85B47'},
} as const;

export const SceneSet: React.FC<{setting: DuelData['setting']; h: number; mood: number}> = ({setting, h, mood}) => {
  const s = SET[setting];
  return (
    <AbsoluteFill style={{background: s.wall}}>
      {/* rasterpunten als schaduw */}
      <AbsoluteFill style={{backgroundImage: `radial-gradient(${C.ink}22 3px, transparent 3.5px)`, backgroundSize: '18px 18px', opacity: 0.8}} />
      {setting === 'kantoor' && (
        <div style={{position: 'absolute', left: 560, top: h - 560, width: 220, height: 240, border: `8px solid ${C.ink}`, borderRadius: 12, background: '#9FD3FF'}}>
          <div style={{position: 'absolute', left: 102, top: 0, width: 8, height: '100%', background: C.ink}} />
        </div>
      )}
      {setting === 'keuken' && [0, 1].map((i) => (
        <div key={i} style={{position: 'absolute', left: 520 + i * 230, top: h - 600, width: 210, height: 250, background: '#9FD8B8', border: `8px solid ${C.ink}`, borderRadius: 12}}>
          <div style={{position: 'absolute', left: 86, top: 190, width: 30, height: 12, borderRadius: 6, background: C.ink}} />
        </div>
      ))}
      {setting === 'vergadering' && (
        <div style={{position: 'absolute', left: 520, top: h - 600, width: 400, height: 250, background: C.white, border: `8px solid ${C.ink}`, borderRadius: 12}}>
          {[0, 1, 2].map((i) => <div key={i} style={{position: 'absolute', left: 50 + i * 110, bottom: 30, width: 60, height: 160 - i * 50, background: ['#8DB6FF', '#FF97B0', '#E5484D'][i], border: `5px solid ${C.ink}`}} />)}
        </div>
      )}
      {setting === 'buiten' && [[560, 1], [820, 0.8]].map(([x, s], i) => (
        <div key={i} style={{position: 'absolute', left: x, top: h - 120 - 400 * s}}>
          <div style={{position: 'absolute', left: 70 * s, top: 220 * s, width: 44 * s, height: 190 * s, background: '#A5836A', border: `7px solid ${C.ink}`}} />
          <div style={{position: 'absolute', left: -20 * s, top: 0, width: 230 * s, height: 230 * s, borderRadius: '50%', background: '#7FCB5B', border: `8px solid ${C.ink}`}} />
        </div>
      ))}
      {setting === 'restaurant' && (
        <div style={{position: 'absolute', left: 600, top: h - 560, width: 240, height: 180, background: '#9FD8B8', border: `10px solid #A5836A`, outline: `6px solid ${C.ink}`}}>
          <div style={{position: 'absolute', left: 60, top: 40, width: 100, height: 100, borderRadius: '50%', background: C.zon}} />
        </div>
      )}
      {setting === 'feestje' && (
        <svg width={1000} height={200} style={{position: 'absolute', top: h - 620}}>
          <path d="M-20 20 Q500 150 1020 20" fill="none" stroke={C.ink} strokeWidth={6} />
          {Array.from({length: 8}).map((_, i) => {
            const x = 60 + i * 125;
            const y = 20 + Math.sin((i / 7) * Math.PI) * 90;
            return <path key={i} d={`M${x - 28} ${y} L${x + 28} ${y} L${x} ${y + 56} Z`} fill={['#FFD23F', '#F7A8C4', '#8DB6FF'][i % 3]} stroke={C.ink} strokeWidth={5} />;
          })}
        </svg>
      )}
      <div style={{position: 'absolute', left: -50, right: -50, top: h - 120, bottom: -10, background: s.floor, borderTop: `8px solid ${C.ink}`}} />
      {/* het gaat mis: rood-grijze waas */}
      <AbsoluteFill style={{background: `rgba(120,30,40,${0.28 * mood})`}} />
    </AbsoluteFill>
  );
};

/** Snelheidslijnen vanaf een punt: spanning in een stripvak. */
export const SpeedLines: React.FC<{cx: number; cy: number; k: number; seed: number}> = ({cx, cy, k, seed}) => {
  if (k <= 0) return null;
  const n = 26;
  return (
    <svg width={1000} height={1100} style={{position: 'absolute', left: 0, top: 0}}>
      {Array.from({length: n}).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + noise(i, seed) * 0.08;
        const r0 = 240 + 60 * noise(i * 3, seed + 1);
        return <line key={i} x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0} x2={cx + Math.cos(a) * 1100} y2={cy + Math.sin(a) * 1100}
                     stroke={C.ink} strokeWidth={3 + (i % 3) * 2} opacity={0.5 * k} />;
      })}
    </svg>
  );
};

// ------------------------------------------------------------------ ballon en klanknabootsing
const Balloon: React.FC<{l: DuelLine; t: number; side: 'left' | 'right'; h: number}> = ({l, t, side, h}) => {
  if (t < l.at - 1 || t > l.until + 4) return null;
  const words = speech(l.text, l.at);
  const pop = Math.min(spr(t, l.at - 1, {damping: 10, stiffness: 300, mass: 0.5}), 1.04);
  const leave = t > l.until ? lin(t, l.until, l.until + 4, 1, 0) : 1;
  const bg = l.tone === 'not' ? C.noSoft : l.tone === 'yes' ? C.yesSoft : C.white;
  const ink = l.tone === 'not' ? C.noInk : l.tone === 'yes' ? C.yesInk : C.ink;
  const top = Math.max(24, h - 610);
  const seqv = h === SEQ_INNER_H;   // ingezoomd vak: ballonnen binnen het zichtbare deel houden
  return (
    <div style={{position: 'absolute', top, [side]: seqv ? 135 : 70, maxWidth: seqv ? 480 : 540, transform: `scale(${pop * leave})`, transformOrigin: side === 'left' ? '20% 120%' : '80% 120%'}}>
      <div style={{background: bg, border: `6px solid ${C.ink}`, borderRadius: 22, padding: '18px 26px', fontFamily: FONT_HEAD, fontWeight: 600,
                   fontSize: 46, lineHeight: 1.1, color: ink, boxShadow: `6px 6px 0 ${C.ink}`}}>
        {words.map((w, i) => (
          <span key={i} style={{opacity: t >= w.s ? 1 : 0, marginRight: i < words.length - 1 ? '0.25em' : 0, display: 'inline-block'}}>{w.text}</span>
        ))}
      </div>
      <svg width={70} height={56} style={{position: 'absolute', top: '100%', marginTop: -7, [side]: 70}}>
        <path d={side === 'left' ? 'M6 0 L40 0 L14 50 Z' : 'M64 0 L30 0 L56 50 Z'} fill={bg} stroke={C.ink} strokeWidth={6} strokeLinejoin="round" />
        <rect x={side === 'left' ? 9 : 27} y={0} width={34} height={9} fill={bg} />
      </svg>
    </div>
  );
};

export const Burst: React.FC<{text: string; at: number; t: number; x: number; y: number; color: string; rot: number}> = ({text, at, t, x, y, color, rot}) => {
  if (t < at || t > at + 40) return null;
  const s = Math.min(spr(t, at, {damping: 8, stiffness: 320, mass: 0.5}), 1.1);
  const o = lin(t, at + 30, at + 40, 1, 0);
  const pts = Array.from({length: 24}).map((_, i) => {
    const r = i % 2 ? 120 : 175 + noise(i, at) * 18;
    const a = (i / 24) * Math.PI * 2;
    return `${Math.cos(a) * r},${Math.sin(a) * r * 0.62}`;
  }).join(' ');
  return (
    <div style={{position: 'absolute', left: x - 180, top: y - 110, width: 360, height: 220, transform: `scale(${s}) rotate(${rot}deg)`, opacity: o}}>
      <svg width={360} height={220} viewBox="-180 -110 360 220" style={{position: 'absolute'}}>
        <polygon points={pts} fill={color} stroke={C.ink} strokeWidth={6} strokeLinejoin="round" />
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontWeight: 700,
                   fontSize: 74, color: C.white, ...outline(12), letterSpacing: 2}}>{text}</div>
    </div>
  );
};

// ------------------------------------------------------------------ één vak
const PanelScene: React.FC<{d: DuelData; p: 'top' | 'bottom'; out: number; h: number; frozen: boolean}> = ({d, p, out, h, frozen}) => {
  const t = onTwos(out);
  const top = p === 'top';
  const lines = d.lines.filter((l) => ofPanel(l, p));
  // stemming van het vak: boven loopt het op, onder wordt het licht
  const wrongAt = d.lines.find((l) => l.panel === 'top' && l.who === 'ehm')?.at ?? 0;
  const topLines = d.lines.filter((l) => l.panel === 'top' && l.who !== 'ehm' && l.at > wrongAt);
  const esc = top ? keys(t, [[topLines[0]?.at ?? 999, 0], [topLines[0] ? topLines[0].at + 20 : 999, 0.45], [d.nope - 10, 0.75], [d.nope, 1]]) : 0;

  // ---- de ander
  const otherTalk = talking(d, p, d.cast, t);
  let oExpr: CastExpression = 'neutraal';
  let oMood: CastExpression | undefined;
  if (otherTalk !== null) { oExpr = 'praten'; oMood = top ? (esc > 0.3 ? 'lach' : 'blij') : 'neutraal'; }
  else if (top && esc > 0) oExpr = 'lach';
  else if (!top && t >= d.celebrate) oExpr = 'blij';
  else if (!top) {
    const goodEhm = d.lines.find((l) => l.panel === 'bottom' && l.who === 'ehm');
    oExpr = goodEhm && t > goodEhm.at ? 'verbaasd' : 'neutraal';
  }
  const lastBottom = d.lines.filter((l) => l.panel === 'bottom' && l.who !== 'ehm').slice(-1)[0];
  if (!top && lastBottom && otherTalk !== null && t >= lastBottom.at) oMood = 'opgelucht';
  const lean = (otherTalk !== null ? 6 : 2) + noise(t / 25, p === 'top' ? 1 : 2) * 3 + (top ? esc * 8 : 0);
  const armR = top && esc > 0.3 ? -60 - Math.abs(Math.sin(t / 3)) * 30 : !top && t >= d.celebrate ? -130 : 0;

  // ---- Ehm
  const ehmTalk = talking(d, p, 'ehm', t);
  let eExpr: Expression = 'neutraal';
  let since = 999;
  const wrong = d.lines.find((l) => l.panel === 'top' && l.who === 'ehm')!;
  const goods = d.lines.filter((l) => l.panel === 'bottom' && l.who === 'ehm');
  if (ehmTalk !== null) { eExpr = 'praten'; since = t; }
  else if (top) {
    if (t >= d.nope - 20) { eExpr = 'bevroren'; since = t - (d.nope - 20); }
    else if (t > wrong.at) { eExpr = 'zenuwachtig'; since = t - wrong.at; }
    else if (t > lines[0].at + 20) eExpr = 'denken';
  } else {
    if (t >= d.celebrate) { eExpr = 'trots'; since = t - d.celebrate; }
    else if (t > goods[0].at) { eExpr = 'trots'; since = t - goods[0].at; }
    else if (t > lines[0].at + 20) eExpr = 'denken';
  }
  const shrink = top ? 1 - 0.28 * esc : 1 + (t > goods[0].at ? 0.05 : 0);
  const j1 = !top ? hop(t, d.celebrate + 24, 70, 12) : {y: 0, sx: 1, sy: 1};
  const j2 = !top ? hop(t, d.celebrate + 42, 46, 11) : {y: 0, sx: 1, sy: 1};
  const shiver = top && esc > 0.4 ? noise(t * 1.3, 4) * 5 * esc : 0;
  const fl = top ? flinch(t, wrong.at + 30, 0.1) : {sx: 1, sy: 1};
  const EH = 380;

  const bubbles = lines.filter((l) => t >= l.at - 1 && t <= l.until + 4);
  return (
    <AbsoluteFill style={{filter: frozen ? 'saturate(0.3) brightness(0.93)' : undefined}}>
      <SceneSet setting={d.setting} h={h} mood={esc} />
      <SpeedLines cx={760} cy={h - 230} k={top ? Math.max(0, esc - 0.3) : !top && t >= d.celebrate ? 0.7 : 0} seed={Math.floor(t / 4)} />
      {/* de ander, links, tot het middel in beeld */}
      <div style={{position: 'absolute', left: -60, top: h - 470}}>
        <Cast role={d.cast} outfit={d.outfit} expression={oExpr} mood={oMood} size={560} frame={t} lean={lean} armR={armR} armL={!top && t >= d.celebrate ? -130 : 0}
              look={0.8} mouthOpen={otherTalk ?? undefined} />
      </div>
      {/* Ehm, rechts */}
      <div style={{position: 'absolute', left: 560 + shiver, top: h - 120 - EH * 0.76 + j1.y + j2.y,
                   transform: `scale(${shrink * fl.sx * j1.sx * j2.sx}, ${shrink * fl.sy * j1.sy * j2.sy})`, transformOrigin: '50% 76%'}}>
        <Ehm expression={eExpr} size={EH} frame={t} since={since} flip look={-1} mouthOpen={ehmTalk ?? undefined} />
      </div>
      {bubbles.map((l, i) => <Balloon key={i} l={l} t={t} side={l.who === 'ehm' ? 'right' : 'left'} h={h} />)}
      {d.sfx.filter((s) => s.panel === p).map((s, i) => (
        <Burst key={i} text={s.text} at={s.at} t={t} x={top ? 700 : 760} y={h - 470 + (i % 2) * 40} rot={(i % 2 ? 8 : -9)}
               color={top ? '#E5484D' : s.text === 'YAY!' ? C.zon : '#2FB37A'} />
      ))}
    </AbsoluteFill>
  );
};

/** Een stripvak: rand, schaduw, label; de inhoud tekent op een vaste breedte en schaalt mee. */
const Frame: React.FC<{rect: {x: number; y: number; w: number; h: number; r: number}; label: string; good: boolean; children: React.ReactNode;
  extra?: string; opacity?: number; bg: string; innerH?: number}> = ({rect, label, good, children, extra = '', opacity = 1, bg, innerH = INNER.h}) => (
  <div style={{position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, transform: `rotate(${rect.r}deg) ${extra}`, opacity}}>
    <div style={{position: 'absolute', inset: 0, border: `10px solid ${C.ink}`, borderRadius: 18, overflow: 'hidden', background: bg,
                 boxShadow: `12px 12px 0 ${C.ink}`}}>
      {/* vult het vak: bij een hoog vak zoomt de inhoud in op het midden tussen de twee personages */}
      <div style={{position: 'absolute', left: rect.w / 2 - 500 * fit(rect, innerH), top: rect.h - innerH * fit(rect, innerH), width: INNER.w, height: innerH,
                   transform: `scale(${fit(rect, innerH)})`, transformOrigin: '0 0'}}>
        {children}
      </div>
    </div>
    <div style={{position: 'absolute', left: -14, top: -26, background: good ? '#2FB37A' : '#E5484D', color: C.white, border: `6px solid ${C.ink}`,
                 borderRadius: 12, padding: '4px 20px', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 40, transform: 'rotate(-4deg)'}}>{label}</div>
  </div>
);

const fit = (r: {w: number; h: number}, innerH = INNER.h) =>
  innerH === SEQ_INNER_H ? SEQ_ZOOM : Math.max(r.w / INNER.w, Math.min(1.15, r.h / innerH));

const lerpRect = (a: typeof RECT.top, b: typeof RECT.big, k: number) => ({
  x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k, r: a.r + (b.r - a.r) * k,
});

// ------------------------------------------------------------------ de scène
export const Duel: React.FC<DuelProps> = ({data: d, audio}) => {
  const out = useCurrentFrame();
  const who = turn(d, out);
  const step = onTwos(out);
  const boilSeed = Math.floor(out / 3) % 6;

  // NOPE-stempel, verfrommelen en weggooien
  const nopeS = out >= d.nope ? Math.min(spr(out, d.nope, {damping: 11, stiffness: 340, mass: 0.6}), 1.05) : 0;
  const c = lin(out, d.crumble, d.crumble + 10);
  const fly = lin(out, d.crumble + 8, d.crumble + 26);
  const crumple = `scale(${1 - 0.72 * Easing.out(Easing.cubic)(c)}) rotate(${-200 * fly + c * 25}deg) translate(${-900 * Easing.in(Easing.quad)(fly)}px, ${-500 * fly + 300 * fly * fly}px)`;
  const topGone = out >= d.crumble + 26;
  const grow = spr(out, d.expand, {damping: 14, stiffness: 120, mass: 0.9});
  const bottomRect = lerpRect(RECT.bottom, RECT.big, out >= d.expand ? grow : 0);
  const seq = d.layout === 'sequence';
  const capOut = seq ? (out >= d.crumble ? lin(out, d.crumble, d.crumble + 10, 1, 0) : 1)
                     : out >= d.expand ? lin(out, d.expand, d.expand + 10, 1, 0) : 1;
  const rewindOn = seq && out >= (d.rewind ?? 0) && out < d.expand + 4;

  return (
    <AbsoluteFill style={{background: C.paper, overflow: 'hidden'}}>
      {/* trillende lijnen: het hele blad wordt per 3 frames net iets anders "getekend" */}
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id="boil">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={boilSeed} />
          <feDisplacementMap in="SourceGraphic" scale={5} />
        </filter>
      </svg>
      <AbsoluteFill style={{backgroundImage: `radial-gradient(${FIELD[d.pillar]} 5px, transparent 5.5px)`, backgroundSize: '26px 26px', opacity: 0.9}} />

      <AbsoluteFill style={{filter: 'url(#boil)'}}>
        {/* kop */}
        <div style={{position: 'absolute', left: 50, right: 50, top: 120, textAlign: 'center', opacity: capOut,
                     transform: `rotate(${-1.5 + (step % 4 === 0 ? 0.3 : 0)}deg) scale(${0.85 + 0.15 * spr(out, 0, {damping: 12})})`}}>
          {d.verdict ? (
            <>
              {/* oordeel vooraan: de situatie klein, daaronder groot wat je niet zegt */}
              <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 40, color: C.ink}}>{d.caption}</div>
              <div style={{marginTop: 6, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: d.hook.length <= 30 ? 66 : d.hook.length <= 42 ? 56 : 48,
                           lineHeight: 1.05, color: C.zon, ...outline(13), textShadow: `0 7px 0 ${C.ink}`}}>{d.hook}</div>
            </>
          ) : (
            <>
              <div style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 80, lineHeight: 1.05, color: C.zon, ...outline(15), textShadow: `0 8px 0 ${C.ink}`}}>{d.caption}</div>
              {/* de vraag aan de kijker (sinds 24 nov): groot genoeg om in de eerste seconde te lezen */}
              <div style={{marginTop: 12, fontFamily: FONT_BODY, fontWeight: 900, fontSize: 52, color: C.ink}}>{d.hook}</div>
            </>
          )}
        </div>

        {seq && out >= d.expand - 8 && (() => {
          // tweede kop: nu de goede versie
          const k = spr(out, d.expand - 8, {damping: 12, stiffness: 200});
          const o = out >= d.celebrate + 14 ? lin(out, d.celebrate + 14, d.celebrate + 24, 1, 0) : 1;
          return (
            <div style={{position: 'absolute', left: 50, right: 50, top: 150, textAlign: 'center', opacity: o, transform: `scale(${k}) rotate(-1.5deg)`}}>
              <div style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 76, color: C.white, ...outline(14), textShadow: `0 7px 0 ${C.ink}`}}>Take 2:</div>
              <div style={{marginTop: 4, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 42, color: C.ink}}>say this instead</div>
            </div>
          );
        })()}
        {!topGone && (
          <Frame rect={seq ? RECT.seq : RECT.top} label={seq ? 'TAKE 1' : 'EHM A'} good={false} bg={SET[d.setting].wall} extra={out >= d.crumble ? crumple : ''}
                 innerH={seq ? SEQ_INNER_H : INNER.h}>
            <PanelScene d={d} p="top" out={out >= d.nope ? d.nope : out} h={seq ? SEQ_INNER_H : RECT.top.h} frozen={!seq && who === 'bottom' && out < d.nope} />
            {nopeS > 0 && (
              <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
                <div style={{transform: `scale(${3 - 2 * nopeS}) rotate(-14deg)`, opacity: Math.min(1, nopeS * 1.6), border: '14px solid #E5484D', borderRadius: 24,
                             padding: '6px 40px', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 170, color: '#E5484D', background: 'rgba(255,255,255,0.75)'}}>
                  NOPE
                </div>
              </AbsoluteFill>
            )}
          </Frame>
        )}
        {!seq && (
          <Frame rect={bottomRect} label="EHM B" good bg={SET[d.setting].wall}>
            <PanelScene d={d} p="bottom" out={out} h={INNER.h} frozen={who === 'top'} />
          </Frame>
        )}
        {seq && out >= d.expand && (
          <Frame rect={RECT.seq} label="TAKE 2" good bg={SET[d.setting].wall} innerH={SEQ_INNER_H}
                 extra={`scale(${Math.min(1, spr(out, d.expand, {damping: 13, stiffness: 160, mass: 0.8}))})`}>
            <PanelScene d={d} p="bottom" out={out} h={SEQ_INNER_H} frozen={false} />
          </Frame>
        )}
      </AbsoluteFill>
      {seq && rewindOn && (() => {
        // terugspoelen: strepen over het beeld en een groot "terug"-teken
        const r = out - (d.rewind ?? d.crumble + 20);
        return (
          <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'}}>
            <AbsoluteFill style={{opacity: 0.35, backgroundImage: `repeating-linear-gradient(0deg, ${C.ink} 0 6px, transparent 6px ${40 + (r % 4) * 6}px)`,
                                  transform: `translateY(${(r * 37) % 120}px)`}} />
            <div style={{transform: `scale(${Math.min(1.05, spr(out, d.rewind ?? 0, {damping: 9, stiffness: 260}))}) rotate(-4deg)`, background: C.zon,
                         border: `10px solid ${C.ink}`, borderRadius: 28, padding: '10px 50px', boxShadow: `10px 10px 0 ${C.ink}`,
                         fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 120, color: C.ink}}>◀◀ REWIND</div>
          </AbsoluteFill>
        );
      })()}

      {/* badge en oproep, niet trillend zodat ze rustig leesbaar zijn */}
      {out >= d.celebrate + 26 && (() => {
        const b = spr(out, d.celebrate + 26, {damping: 9, stiffness: 200});
        return (
          <div style={{position: 'absolute', left: 0, right: 0, top: 270, textAlign: 'center', transform: `scale(${b}) rotate(-3deg)`}}>
            <span style={{display: 'inline-block', background: C.yesSoft, color: C.yesInk, border: `8px solid ${C.ink}`, borderRadius: 999, padding: '14px 44px',
                          boxShadow: `8px 8px 0 ${C.ink}`, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 72}}>{d.badge}</span>
          </div>
        );
      })()}
      {out >= d.cta && (() => {
        const a = spr(out, d.cta, {damping: 10, stiffness: 220});
        const b = spr(out, d.cta + 6, {damping: 9, stiffness: 220});   // eindkaart is kort (1,5 s): sticker snel erbij
        return (
          <>
            <div style={{position: 'absolute', left: 40, right: 40, top: 1280, textAlign: 'center', transform: `scale(${a}) rotate(-2deg)`}}>
              <span style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 84, color: C.white, ...outline(15), textShadow: `0 8px 0 ${C.ink}`}}>{seq ? 'Be Take 2.' : 'Be Ehm B.'}</span>
            </div>
            <div style={{position: 'absolute', left: 80, right: 80, top: 1410, textAlign: 'center', transform: `scale(${b})`}}>
              <span style={{display: 'inline-block', background: C.zon, border: `7px solid ${C.ink}`, borderRadius: 999, padding: '14px 32px', boxShadow: `7px 7px 0 ${C.ink}`,
                            fontFamily: FONT_BODY, fontWeight: 800, fontSize: 38, color: C.ink}}>{d.sticker}</span>
            </div>
          </>
        );
      })()}
      {audio && <Html5Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};
