/**
 * Escalatie + terugspoelen. De foute zin loopt uit de hand, de piek bevriest, het beeld spoelt echt terug (de scène
 * is een functie van de scènetijd, dus alles beweegt achteruit), en bij "Take two" werken de zinnen uit het script.
 * Het laatste frame is gelijk aan het eerste, zodat de video naadloos herhaalt.
 *
 * Alle tijden staan in de scènedata (src/scenes/<situatie>.json); scripts/geluid.py leest dezelfde data voor het
 * geluid, zodat stem, mond, woorden en effecten op hetzelfde frame vallen.
 */
import React from 'react';
import {AbsoluteFill, Easing, Html5Audio, staticFile, useCurrentFrame} from 'remotion';
import {Ehm, Expression} from '../ehm/Ehm';
import {Cast, CastExpression, Outfit, Role} from '../ehm/Cast';
import {C} from '../ehm/colors';
import {FONT_BODY, FONT_HEAD} from '../fonts';
import {flinch, hop, keys, lin, mouth, noise, shake, speech, speechEnd, spr, Word} from '../anim/anim';

export type Who = 'ehm' | Role;
export type Setting = 'kantoor' | 'feestje' | 'keuken' | 'vergadering' | 'buiten' | 'restaurant';
export type Line = {who: Who; text: string; at: number; until: number; tone?: 'plain' | 'not' | 'yes'};
export type EscalatieData = {
  slug: string; caption: string; total: number; freeze: number; rewindStart: number; rewindEnd: number; goodStart: number;
  lines: Line[]; papers: number[]; frontStack: number; sticker: {text: string; at: number; until: number};
  bossExit: number; bossReturn: number; celebrate: number; badge: string;
  /** decor, tegenspeler en grap; zonder: kantoor, baas, papier (zoals "heb-je-even") */
  setting?: Setting; cast?: Role; gag?: 'stapel' | 'krimp' | 'zweet' | 'wolk' | 'zakken';
  gagObject?: 'paper' | 'folder' | 'bill' | 'sandwich'; clockSpin?: boolean;
  /** uiterlijk van de tegenspeler (anders dan de standaard van de rol) */
  outfit?: Outfit;
  /** shots: snedes naar close-ups van Ehm en de ander (zonder: één doorlopend shot) */
  shots?: boolean;
  /** koude opening: zoveel frames de bevroren piek vooraf, met "How did we get here?"; total telt ze mee */
  coldOpen?: number;
};

/** Ankers in de tijd, afgeleid van de regels: zo werken alle scènes met dezelfde animatie. */
function marks(d: EscalatieData) {
  const bad = d.lines.filter((l) => l.at < d.freeze);
  const good = d.lines.filter((l) => l.at >= d.freeze);
  const badOther = bad.filter((l) => l.who !== 'ehm');
  const wrong = bad.find((l) => l.who === 'ehm')!;
  const esc = badOther.slice(1, -1);
  const goodEhm = good.filter((l) => l.who === 'ehm');
  const goodOther = good.filter((l) => l.who !== 'ehm');
  return {
    wrongAt: wrong.at, wrongEnd: speechEnd(speech(wrong.text, wrong.at)),
    escStart: esc.length ? esc[0].at : wrong.at + 40, lastEsc: esc.length ? esc[esc.length - 1].at : wrong.at + 80,
    peakAt: badOther[badOther.length - 1].at, goodB: goodEhm[goodEhm.length - 1].at, twistAt: goodOther[goodOther.length - 1].at,
  };
}
export type EscalatieProps = {data: EscalatieData; audio?: string};

// ------------------------------------------------------------------ tijd: uitvoerframe -> tak en scènetijd
type When = {branch: 'bad' | 'good'; t: number; out: number};

function when(d: EscalatieData, out: number): When {
  if (out < d.freeze) return {branch: 'bad', t: out, out};
  if (out < d.rewindStart) return {branch: 'bad', t: d.freeze, out};
  if (out < d.rewindEnd) {
    const p = (out - d.rewindStart) / (d.rewindEnd - d.rewindStart);
    return {branch: 'bad', t: d.freeze * (1 - Easing.inOut(Easing.cubic)(p)), out};
  }
  return {branch: 'good', t: Math.max(0, out - d.goodStart), out};
}

/** Scènetijd van een regel binnen zijn eigen tak (goede regels staan in uitvoerframes). */
const lineT = (d: EscalatieData, l: Line) => (l.at < d.freeze ? l.at : l.at - d.goodStart);
const lineUntil = (d: EscalatieData, l: Line) => (l.at < d.freeze ? l.until : l.until - d.goodStart);
const branchOf = (d: EscalatieData, l: Line) => (l.at < d.freeze ? 'bad' : 'good');

type Spoken = {line: Line; words: Word[]; at: number; until: number};
function spoken(d: EscalatieData, w: When): Spoken[] {
  return d.lines
    .filter((l) => branchOf(d, l) === w.branch)
    .map((l) => {
      const at = lineT(d, l);
      return {line: l, words: speech(l.text, at), at, until: lineUntil(d, l)};
    });
}

const talkOf = (sp: Spoken[], who: Who, t: number) => {
  for (const s of sp) if (s.line.who === who && t >= s.at && t <= speechEnd(s.words) + 2) return mouth(s.words, t);
  return null;
};

// ------------------------------------------------------------------ shots
type Shot = 'wide' | 'ehm' | 'other';
/** Welk shot op dit moment: Ehm in close-up als hij de foute (of goede) zin zegt, de ander in close-up bij om en om
 * een escalatiezin en bij de twist; verder breed, zodat de grap (stapel, wolk, zakken) te zien is. */
function shotAt(d: EscalatieData, K: ReturnType<typeof marks>, w: When): Shot {
  if (!d.shots) return 'wide';
  const {t} = w;
  const end = (l: Line, at: number) => speechEnd(speech(l.text, at));
  if (w.branch === 'bad') {
    if (t >= d.freeze - 6) return 'wide';
    if (t >= K.wrongAt - 30 && t < K.wrongEnd + 8) return 'ehm';
    const other = d.lines.filter((l) => l.at < d.freeze && l.who !== 'ehm');
    const esc = other.slice(1, -1);
    for (let i = 0; i < esc.length; i += 2) if (t >= esc[i].at - 2 && t < end(esc[i], esc[i].at) + 4) return 'other';
    return 'wide';
  }
  const g = w.out;
  const good = d.lines.filter((l) => l.at >= d.freeze);
  const ehm = good.filter((l) => l.who === 'ehm');
  const other = good.filter((l) => l.who !== 'ehm');
  if (ehm[0] && g >= ehm[0].at - 4 && g < end(ehm[0], ehm[0].at) + 6) return 'ehm';
  const twist = other[other.length - 1];
  if (twist && g >= twist.at - 2 && g < end(twist, twist.at) + 10) return 'other';
  if (other.length > 2 && g >= other[1].at - 2 && g < end(other[1], other[1].at) + 4) return 'other';
  return 'wide';
}

// ------------------------------------------------------------------ decor
const WALL = '#D3C2FF';
const WALL_DEEP = '#BBA6F5';
const FLOOR = '#A58CEB';
const DESK_TOP = 1560;

const Clock: React.FC<{minutes: number}> = ({minutes}) => {
  const ha = (minutes / 720) * 360;
  const ma = (minutes % 60) * 6;
  return (
    <svg width={210} height={210} viewBox="-105 -105 210 210" style={{position: 'absolute', right: 150, top: 380}}>
      <circle r={96} fill={C.white} stroke={C.ink} strokeWidth={8} />
      {Array.from({length: 12}).map((_, i) => (
        <line key={i} x1={0} y1={-80} x2={0} y2={i % 3 === 0 ? -66 : -72} stroke={C.ink} strokeWidth={i % 3 === 0 ? 7 : 4}
              strokeLinecap="round" transform={`rotate(${i * 30})`} />
      ))}
      <line x1={0} y1={8} x2={0} y2={-46} stroke={C.ink} strokeWidth={10} strokeLinecap="round" transform={`rotate(${ha})`} />
      <line x1={0} y1={10} x2={0} y2={-70} stroke={C.noInk} strokeWidth={7} strokeLinecap="round" transform={`rotate(${ma})`} />
      <circle r={8} fill={C.ink} />
    </svg>
  );
};

const Room: React.FC<{minutes: number}> = ({minutes}) => (
  <AbsoluteFill style={{background: WALL}}>
    {/* deuropening links, met kozijn */}
    <div style={{position: 'absolute', left: -40, top: 520, width: 330, height: 1100, background: '#8C77D6', border: `7px solid ${C.ink}`, borderRadius: 10}} />
    <div style={{position: 'absolute', left: 250, top: 500, width: 46, height: 1120, background: WALL_DEEP, border: `7px solid ${C.ink}`, borderRadius: 8}} />
    {/* raam met lucht die mee verandert met de tijd */}
    <div style={{position: 'absolute', left: 520, top: 300, width: 260, height: 300, border: `7px solid ${C.ink}`, borderRadius: 14, overflow: 'hidden',
                 background: `linear-gradient(${keys(minutes, [[287, 0], [598, 1]]) > 0.5 ? '#2B2F6B, #4B3F8F' : '#9FD3FF, #CFE9FF'})`}}>
      <div style={{position: 'absolute', left: 123, top: 0, width: 7, height: '100%', background: C.ink}} />
      <div style={{position: 'absolute', top: 140, left: 0, width: '100%', height: 7, background: C.ink}} />
    </div>
    <Clock minutes={minutes} />
    <div style={{position: 'absolute', left: -600, right: -600, top: 1610, bottom: 0, background: FLOOR, borderTop: `7px solid ${C.ink}`}} />
  </AbsoluteFill>
);

/** Bureau, laptop en geeltje: vóór Ehm. */
const DeskFront: React.FC<{t: number; typing: boolean}> = ({t, typing}) => (
  <>
    <div style={{position: 'absolute', left: 360, right: -30, top: DESK_TOP, height: 70, background: '#F4E3C3', border: `7px solid ${C.ink}`, borderRadius: 16}} />
    <div style={{position: 'absolute', left: 420, right: 20, top: DESK_TOP + 63, height: 300, background: '#E6CFA6', borderLeft: `7px solid ${C.ink}`, borderRight: `7px solid ${C.ink}`}} />
    {/* laptop (achterkant van het scherm) */}
    <div style={{position: 'absolute', left: 700, top: DESK_TOP - 128 + (typing ? Math.abs(Math.sin(t * 0.8)) * 2 : 0), width: 250, height: 133,
                 background: '#C9D3E6', border: `7px solid ${C.ink}`, borderRadius: 14}}>
      <div style={{position: 'absolute', left: 100, top: 42, width: 34, height: 34, borderRadius: '50%', background: '#AEB9D0'}} />
    </div>
    <div style={{position: 'absolute', left: 925, top: DESK_TOP - 108, width: 130, height: 108, background: C.zon, border: `6px solid ${C.ink}`,
                 transform: `rotate(${-5 + noise(t / 20, 3) * 1.5}deg)`, transformOrigin: '50% 100%',
                 fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 34, lineHeight: 1, color: C.noInk, display: 'flex', alignItems: 'center',
                 justifyContent: 'center', textAlign: 'center'}}>
      DUE<br />5 PM
    </div>
  </>
);

// ------------------------------------------------------------------ papier
const PAPER_H = 26;
const PAPER_W = 330;

type PaperState = {x: number; y: number; r: number; visible: boolean};

function paper(d: EscalatieData, i: number, t: number, headTop: number, headX: number): PaperState {
  const at = d.papers[i];
  if (t < at) return {x: 0, y: -400, r: 0, visible: false};
  const fall = 9;
  const head = i >= d.frontStack;
  const k = head ? i - d.frontStack : i;
  const restR = noise(i * 3.1, 5) * 4;
  const restX = (head ? headX - PAPER_W / 2 : 370) + noise(i * 2.3, 9) * (head ? 10 : 16);
  const restY = head ? headTop - (k + 1) * PAPER_H : DESK_TOP - (k + 1) * PAPER_H;
  if (t < at + fall) {
    const p = (t - at) / fall;
    const y0 = -260;
    return {x: restX + (1 - p) * noise(i, 1) * 120, y: y0 + (restY - y0) * p * p, r: restR + (1 - p) * noise(i, 2) * 40, visible: true};
  }
  const b = spr(t, at + fall, {damping: 9, stiffness: 300, mass: 0.4});
  return {x: restX, y: restY - (1 - b) * 14, r: restR + (1 - b) * 3, visible: true};
}

const ITEM = {
  paper: {bg: C.white, deco: '#C9D3E6', label: ''},
  folder: {bg: '#FFC531', deco: '#E0A800', label: ''},
  bill: {bg: '#BFE8C9', deco: '#6DBB93', label: '$'},
  sandwich: {bg: '#F2C98A', deco: '#7FCB5B', label: ''},
} as const;

const Paper: React.FC<{s: PaperState; kind?: keyof typeof ITEM}> = ({s, kind = 'paper'}) => {
  if (!s.visible) return null;
  const it = ITEM[kind];
  return (
    <div style={{position: 'absolute', left: s.x, top: s.y, width: PAPER_W, height: PAPER_H, background: it.bg, border: `5px solid ${C.ink}`,
                 borderRadius: kind === 'sandwich' ? 14 : 4, transform: `rotate(${s.r}deg)`}}>
      {kind === 'sandwich' ? (
        <div style={{position: 'absolute', left: -6, right: -6, top: 5, height: 6, borderRadius: 3, background: it.deco}} />
      ) : (
        <div style={{position: 'absolute', left: 30, right: 120, top: 7, height: 4, borderRadius: 2, background: it.deco}} />
      )}
      {kind === 'folder' && <div style={{position: 'absolute', left: 16, top: -14, width: 70, height: 12, background: it.bg, border: `5px solid ${C.ink}`, borderBottom: 'none', borderRadius: '6px 6px 0 0'}} />}
      {it.label && <div style={{position: 'absolute', right: 30, top: -6, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 26, color: it.deco}}>{it.label}</div>}
    </div>
  );
};

// ------------------------------------------------------------------ andere decors
const PartyRoom: React.FC = () => (
  <AbsoluteFill style={{background: '#CBEB8C'}}>
    <svg width={1080} height={520} style={{position: 'absolute', top: 360}}>
      <path d="M-20 40 Q540 220 1100 40" fill="none" stroke={C.ink} strokeWidth={6} />
      {Array.from({length: 9}).map((_, i) => {
        const x = 60 + i * 120;
        const y = 40 + Math.sin((i / 8) * Math.PI) * 120;
        const kleur = ['#FFD23F', '#F7A8C4', '#8FB3E8', '#FFFFFF'][i % 4];
        return <path key={i} d={`M${x - 32} ${y} L${x + 32} ${y} L${x} ${y + 64} Z`} fill={kleur} stroke={C.ink} strokeWidth={5} strokeLinejoin="round" />;
      })}
    </svg>
    <div style={{position: 'absolute', left: -600, right: -600, top: 1610, bottom: 0, background: '#A8DB63', borderTop: `7px solid ${C.ink}`}} />
  </AbsoluteFill>
);

const PartyTable: React.FC = () => (
  <>
    <div style={{position: 'absolute', left: 360, right: -30, top: DESK_TOP, height: 70, background: '#FFFFFF', border: `7px solid ${C.ink}`, borderRadius: 16}} />
    <div style={{position: 'absolute', left: 420, right: 20, top: DESK_TOP + 63, height: 300, background: '#F7A8C4', borderLeft: `7px solid ${C.ink}`, borderRight: `7px solid ${C.ink}`}} />
    {[0, 1].map((i) => (
      <div key={i} style={{position: 'absolute', left: 700 + i * 200, top: DESK_TOP - 110, width: 90, height: 110, background: i ? '#8FB3E8' : C.noSoft,
                           border: `7px solid ${C.ink}`, borderRadius: '6px 6px 18px 18px'}} />
    ))}
  </>
);

const KitchenRoom: React.FC = () => (
  <AbsoluteFill style={{background: '#FFE6B8'}}>
    <div style={{position: 'absolute', left: -600, right: -600, top: 1100, height: 500, background:
                 'repeating-linear-gradient(90deg, transparent 0 118px, rgba(31,42,68,0.15) 118px 124px), repeating-linear-gradient(0deg, #FFF3DA 0 118px, rgba(31,42,68,0.15) 118px 124px)'}} />
    {[0, 1, 2].map((i) => (
      <div key={i} style={{position: 'absolute', left: 300 + i * 260, top: 300, width: 240, height: 320, background: '#9FD8B8', border: `7px solid ${C.ink}`, borderRadius: 14}}>
        <div style={{position: 'absolute', left: 100, top: 240, width: 34, height: 14, borderRadius: 7, background: C.ink}} />
      </div>
    ))}
    <div style={{position: 'absolute', left: -600, right: -600, top: 1610, bottom: 0, background: '#E8B87A', borderTop: `7px solid ${C.ink}`}} />
  </AbsoluteFill>
);

const KitchenCounter: React.FC = () => (
  <>
    <div style={{position: 'absolute', left: 360, right: -30, top: DESK_TOP, height: 70, background: '#D9DEE8', border: `7px solid ${C.ink}`, borderRadius: 16}} />
    <div style={{position: 'absolute', left: 420, right: 20, top: DESK_TOP + 63, height: 300, background: '#9FD8B8', borderLeft: `7px solid ${C.ink}`, borderRight: `7px solid ${C.ink}`}} />
    <div style={{position: 'absolute', left: 900, top: DESK_TOP - 96, width: 110, height: 96, background: C.white, border: `7px solid ${C.ink}`, borderRadius: '8px 8px 26px 26px'}} />
  </>
);

/** Wolk: een regenwolkje boven Ehm dat bij elke klap groeit; daarna regen en aan het eind een bliksem. */
const Cloud: React.FC<{beats: number; cx: number; top: number; out: number; total: number}> = ({beats, cx, top, out, total}) => {
  if (beats <= 0) return null;
  const s = Math.min(1.15, 0.6 + 0.1 * beats);
  const w = 300 * s;
  const y = top - 95 * s + 30; // zakt over de kruin, zodat de ballon van Ehm hem niet afdekt
  const storm = beats >= total - 1;
  const bob = Math.sin(out / 9) * 6;
  return (
    <>
      {beats >= 2 && Array.from({length: 4 + beats * 2}).map((_, i) => {
        const ph = ((out * 2.2 + i * 37) % 100) / 100;
        const x = cx - w / 2 + 30 + ((i * 53) % Math.max(1, w - 60));
        return <div key={i} style={{position: 'absolute', left: x, top: y + 110 * s + ph * 260, width: 9, height: 34, borderRadius: 5, background: C.drop,
                                    border: `3px solid ${C.ink}`, opacity: 1 - ph * 0.6}} />;
      })}
      <svg width={w} height={160 * s} viewBox="0 0 300 160" style={{position: 'absolute', left: cx - w / 2, top: y + bob, overflow: 'visible'}}>
        <path d="M40 130 Q0 130 10 95 Q15 65 55 70 Q60 25 110 30 Q140 0 180 25 Q230 10 240 60 Q290 60 288 100 Q290 132 250 132 Z"
              fill={storm ? '#6B7488' : '#9AA3B8'} stroke={C.ink} strokeWidth={7} strokeLinejoin="round" />
        <circle cx={115} cy={92} r={7} fill={C.ink} />
        <circle cx={175} cy={92} r={7} fill={C.ink} />
        <path d="M128 112 Q145 102 162 112" fill="none" stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
        {storm && out % 10 < 6 && <path d="M150 132 L132 178 L152 176 L138 222" fill="none" stroke={C.zon} strokeWidth={12} strokeLinejoin="round" strokeLinecap="round" />}
      </svg>
    </>
  );
};

// ---- vergaderzaal: mint, whiteboard met een grafiek die omlaag gaat, plant
const MeetingRoom: React.FC<{out: number}> = ({out}) => (
  <AbsoluteFill style={{background: '#BFE6E0'}}>
    <div style={{position: 'absolute', left: 420, top: 330, width: 560, height: 360, background: C.white, border: `8px solid ${C.ink}`, borderRadius: 14}}>
      <svg width={544} height={344} viewBox="0 0 544 344">
        {[0, 1, 2, 3].map((i) => <rect key={i} x={70 + i * 110} y={80 + i * 50} width={60} height={220 - i * 50} fill={['#8DB6FF', '#B49CFF', '#FF97B0', '#E5484D'][i]} stroke={C.ink} strokeWidth={5} />)}
        <path d="M60 70 L180 110 L290 170 L460 250" fill="none" stroke={C.ink} strokeWidth={6} strokeDasharray="14 10" />
      </svg>
    </div>
    <div style={{position: 'absolute', left: 560, top: 720, width: 280, height: 18, background: '#8C9AA8', border: `6px solid ${C.ink}`, borderRadius: 8}} />
    {/* plant die meeschommelt */}
    <svg width={220} height={420} style={{position: 'absolute', left: 860, top: 1080, transform: `rotate(${Math.sin(out / 30) * 2}deg)`, transformOrigin: '50% 100%'}}>
      {[-50, -20, 10, 40].map((a, i) => <ellipse key={i} cx={110 + a} cy={150 + (i % 2) * 40} rx={30} ry={80} fill="#6DBB93" stroke={C.ink} strokeWidth={6} transform={`rotate(${a / 2} ${110 + a} 250)`} />)}
      <path d="M60 250 L160 250 L148 410 L72 410 Z" fill="#E8B87A" stroke={C.ink} strokeWidth={7} strokeLinejoin="round" />
    </svg>
    <div style={{position: 'absolute', left: -600, right: -600, top: 1610, bottom: 0, background: '#7FC4B8', borderTop: `7px solid ${C.ink}`}} />
  </AbsoluteFill>
);
const MeetingTable: React.FC = () => (
  <>
    <div style={{position: 'absolute', left: 340, right: -30, top: DESK_TOP, height: 70, background: '#FFFFFF', border: `7px solid ${C.ink}`, borderRadius: 16}} />
    <div style={{position: 'absolute', left: 380, right: 30, top: DESK_TOP + 63, height: 300, background: '#9FB4C7', borderLeft: `7px solid ${C.ink}`, borderRight: `7px solid ${C.ink}`}} />
    <div style={{position: 'absolute', left: 930, top: DESK_TOP - 120, width: 70, height: 120, background: 'rgba(156,201,245,0.6)', border: `7px solid ${C.ink}`, borderRadius: '10px 10px 16px 16px'}} />
  </>
);

// ---- buiten: lucht, zon, drijvende wolkjes, bomen, een heg vooraan
const Outside: React.FC<{out: number}> = ({out}) => (
  <AbsoluteFill style={{background: 'linear-gradient(#8EC9FF, #DDF1FF 70%)'}}>
    <div style={{position: 'absolute', left: 760, top: 260, width: 170, height: 170, borderRadius: '50%', background: C.zon, border: `8px solid ${C.ink}`}} />
    {/* wolkjes met bobbels (een gladde pil leek op een lege tekstballon) */}
    {[0, 1].map((i) => (
      <svg key={i} width={240} height={130} viewBox="0 0 300 160"
           style={{position: 'absolute', left: ((i * 520 + out * (1.2 + i * 0.5)) % 1500) - 300, top: 700 + i * 140}}>
        <path d="M40 130 Q0 130 10 95 Q15 65 55 70 Q60 25 110 30 Q140 0 180 25 Q230 10 240 60 Q290 60 288 100 Q290 132 250 132 Z"
              fill={C.white} stroke={C.ink} strokeWidth={8} strokeLinejoin="round" />
      </svg>
    ))}
    {[[120, 1.0], [420, 0.8], [980, 0.9]].map(([x, s], i) => (
      <div key={i} style={{position: 'absolute', left: x, top: 1610 - 520 * s}}>
        <div style={{position: 'absolute', left: 60 * s, top: 260 * s, width: 50 * s, height: 280 * s, background: '#A5836A', border: `7px solid ${C.ink}`}} />
        <div style={{position: 'absolute', left: -60 * s, top: 0, width: 300 * s, height: 300 * s, borderRadius: '50%', background: '#7FCB5B', border: `8px solid ${C.ink}`,
                     transform: `rotate(${Math.sin(out / 25 + i) * 2}deg)`}} />
      </div>
    ))}
    <div style={{position: 'absolute', left: -600, right: -600, top: 1610, bottom: 0, background: '#C9CED8', borderTop: `7px solid ${C.ink}`}} />
  </AbsoluteFill>
);
const Hedge: React.FC = () => (
  <>
    <div style={{position: 'absolute', left: 330, right: -40, top: DESK_TOP - 20, height: 420, background: '#6DBB93', border: `7px solid ${C.ink}`, borderRadius: '70px 70px 0 0'}} />
    {Array.from({length: 7}).map((_, i) => (
      <div key={i} style={{position: 'absolute', left: 330 + i * 110, top: DESK_TOP - 60, width: 130, height: 110, borderRadius: '50%', background: '#7FCB5B', border: `7px solid ${C.ink}`}} />
    ))}
  </>
);

// ---- restaurant: warme muur met lambrisering, hanglamp, schilderij; tafel met geruit kleed en een kaarsje
const Restaurant: React.FC<{out: number}> = ({out}) => (
  <AbsoluteFill style={{background: '#F2B8A0'}}>
    <div style={{position: 'absolute', left: -600, right: -600, top: 1150, height: 460, background: '#D98C73', borderTop: `7px solid ${C.ink}`}} />
    <div style={{position: 'absolute', left: 640, top: 0, width: 8, height: 300, background: C.ink, transform: `rotate(${Math.sin(out / 40) * 1.5}deg)`, transformOrigin: '50% 0'}} />
    <div style={{position: 'absolute', left: 554, top: 290, width: 180, height: 90, background: C.zon, border: `7px solid ${C.ink}`, borderRadius: '90px 90px 10px 10px',
                 transform: `rotate(${Math.sin(out / 40) * 1.5}deg)`, transformOrigin: '50% -290px', boxShadow: '0 60px 120px rgba(255,210,63,0.55)'}} />
    <div style={{position: 'absolute', left: 140, top: 520, width: 260, height: 200, background: '#9FD8B8', border: `10px solid #A5836A`, outline: `6px solid ${C.ink}`}}>
      <div style={{position: 'absolute', left: 60, top: 60, width: 120, height: 120, borderRadius: '50%', background: C.zon}} />
    </div>
    <div style={{position: 'absolute', left: -600, right: -600, top: 1610, bottom: 0, background: '#A85B47', borderTop: `7px solid ${C.ink}`}} />
  </AbsoluteFill>
);
const DinnerTable: React.FC<{out: number}> = ({out}) => (
  <>
    <div style={{position: 'absolute', left: 340, right: -30, top: DESK_TOP, height: 360, border: `7px solid ${C.ink}`, borderRadius: 16,
                 background: 'repeating-conic-gradient(#E5484D 0 25%, #FFFFFF 0 50%) 0 0 / 80px 80px'}} />
    <div style={{position: 'absolute', left: 960, top: DESK_TOP - 110, width: 34, height: 110, background: C.white, border: `6px solid ${C.ink}`, borderRadius: 6}} />
    <div style={{position: 'absolute', left: 962, top: DESK_TOP - 160 + Math.sin(out / 3) * 3, width: 30, height: 46, background: C.zon, border: `5px solid ${C.ink}`,
                 borderRadius: '50% 50% 50% 50% / 70% 70% 30% 30%', transform: `rotate(${Math.sin(out / 4) * 8}deg)`}} />
  </>
);

/** Zweet: een plas op het blad die bij elke klap groeit, met druppels die eraf springen. */
const Puddle: React.FC<{t: number; beats: number; cx: number; out: number}> = ({beats, cx, out}) => {
  const w = Math.min(760, 80 + beats * 95);
  return (
    <>
      <div style={{position: 'absolute', left: cx - w / 2, top: DESK_TOP - 30, width: w, height: 64, borderRadius: '50%', background: C.drop,
                   border: `6px solid ${C.ink}`, opacity: beats ? 1 : 0, transform: `scaleY(${1 + Math.sin(out / 4) * 0.05})`}} />
      {/* druppels die over de rand van het blad hangen */}
      {Array.from({length: Math.min(6, Math.max(0, beats - 2))}).map((_, i) => (
        <div key={`h${i}`} style={{position: 'absolute', left: cx - w / 2 + 40 + i * (w - 80) / 5, top: DESK_TOP + 20,
                                    width: 30, height: 40 + 30 * Math.abs(Math.sin(out / 9 + i)), borderRadius: '0 0 15px 15px', background: C.drop,
                                    border: `5px solid ${C.ink}`, borderTop: 'none'}} />
      ))}
      {beats > 0 && [0, 1, 2].map((i) => {
        const ph = ((out + i * 9) % 27) / 27;
        return <div key={i} style={{position: 'absolute', left: cx + (i - 1) * 140 * ph, top: 1150 + 380 * ph * ph - 90 * Math.sin(ph * Math.PI),
                                    width: 26, height: 36, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: C.drop, border: `4px solid ${C.ink}`, opacity: 1 - ph}} />;
      })}
    </>
  );
};

// ------------------------------------------------------------------ ballonnen
const Bubble: React.FC<{sp: Spoken; t: number; side: 'left' | 'right'; high?: boolean}> = ({sp, t, side, high}) => {
  const {line, words, at, until} = sp;
  if (t < at - 1 || t > until + 6) return null;
  const pop = spr(t, at - 1, {damping: 10, stiffness: 240, mass: 0.5});
  const out = t > until ? lin(t, until, until + 6, 1, 0) : 1;
  const s = (0.3 + 0.7 * pop) * out;
  const tone = line.tone ?? 'plain';
  const bg = tone === 'not' ? C.noSoft : tone === 'yes' ? C.yesSoft : C.white;
  const ink = tone === 'not' ? C.noInk : tone === 'yes' ? C.yesInk : C.ink;
  const pos = high ? (side === 'left' ? {left: 40, top: 420} : {right: 40, top: 420}) : side === 'left' ? {left: 40, top: 470} : {right: 40, top: 760};
  return (
    <div style={{position: 'absolute', ...pos, maxWidth: 640, transform: `scale(${s}) rotate(${(1 - pop) * (side === 'left' ? -6 : 6)}deg)`,
                 transformOrigin: side === 'left' ? '20% 120%' : '80% 120%', opacity: Math.min(1, out * 1.5)}}>
      <div style={{background: bg, border: `7px solid ${C.ink}`, borderRadius: 46, padding: '30px 38px', boxShadow: `0 10px 0 ${C.ink}`,
                   fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 60, lineHeight: 1.15, color: ink}}>
        {words.map((w, i) => (
          <span key={i} style={{opacity: t >= w.s ? 1 : 0, display: 'inline-block',
                                transform: `translateY(${t >= w.s ? (1 - spr(t, w.s, {stiffness: 400, damping: 14})) * 10 : 0}px)`}}>
            {w.text}{i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
      <svg width={90} height={70} style={{position: 'absolute', top: '100%', marginTop: -8, [side === 'left' ? 'left' : 'right']: 90}}>
        <path d={side === 'left' ? 'M8 0 L46 0 L6 62 Z' : 'M82 0 L44 0 L84 62 Z'} fill={bg} stroke={C.ink} strokeWidth={7} strokeLinejoin="round" />
        <rect x={side === 'left' ? 10 : 42} y={0} width={34} height={10} fill={bg} />
      </svg>
    </div>
  );
};

const EHM_SIZE = 630;

// ------------------------------------------------------------------ de scène
const Scene: React.FC<{d: EscalatieData; out: number}> = ({d, out}) => {
  const w = when(d, out);
  const {t, branch} = w;
  const sp = spoken(d, w);
  const bad = branch === 'bad';
  const K = marks(d);
  const setting = d.setting ?? 'kantoor';
  const cast: Role = d.cast ?? 'baas';
  const gag = d.gag ?? 'stapel';

  // ---- klok
  const minutes = !d.clockSpin ? 287 : bad ? keys(t, [[0, 287], [K.escStart + 4, 287], [d.freeze, 598]], Easing.in(Easing.quad)) : keys(t, [[0, 287], [150, 287], [160, 288]]);

  // ---- papier dat al geland is (voor Ehm's houding en de camera)
  const landed = bad ? d.papers.filter((p) => t >= p + 9) : [];
  const front = Math.min(landed.length, d.frontStack);
  const onHead = Math.max(0, landed.length - d.frontStack);

  // ---- Ehm
  const office = setting === 'kantoor';
  const typingBad = office && bad && t < K.wrongAt - 28;
  const C0 = d.celebrate; // Ehm's eigen moment: zucht, vreugdesprongen, dan tevreden verder typen
  const typingGood = office && !bad && (t < 14 || out >= C0 + 66);
  const typing = typingBad || typingGood;
  const ehmTalk = talkOf(sp, 'ehm', t);
  let ehmExpr: Expression = 'neutraal';
  if (bad) {
    if (t >= d.freeze) ehmExpr = 'bevroren';
    else if (ehmTalk !== null) ehmExpr = 'praten';
    else if (t >= K.wrongAt - 24) ehmExpr = 'zenuwachtig';
  } else {
    const g = out;
    if (ehmTalk !== null) ehmExpr = 'praten';
    else if (g >= C0 && g < C0 + 20) ehmExpr = 'opgelucht';
    else if (g >= C0 + 20 && g < C0 + 66) ehmExpr = 'trots';
  }
  // kijkrichting: naar de laptop bij het typen, anders naar de baas (links)
  const ehmLook = typing ? 0.2 : !bad && out >= C0 + 20 ? 0 : -1;
  // houding: typen (wippen), schrikken (sprong), papier (indeuken), gluren (uitrekken), gewicht op het hoofd (platdrukken)
  const bob = typing ? -Math.abs(Math.sin(out * 0.9)) * 7 : 0;
  const startle = bad ? hop(t, K.wrongAt - 28, 46) : {y: 0, sx: 1, sy: 1};
  const settleTurn = !bad ? hop(t, 14, 14, 10) : {y: 0, sx: 1, sy: 1};
  const joy1 = !bad ? hop(out, C0 + 26, 70, 14) : {y: 0, sx: 1, sy: 1};
  const joy2 = !bad ? hop(out, C0 + 44, 50, 12) : {y: 0, sx: 1, sy: 1};
  // de zucht: eerst uitademen en inzakken, dan weer rechtop
  const sighK = !bad ? keys(out, [[C0, 0], [C0 + 8, 1], [C0 + 20, 1], [C0 + 26, 0]]) : 0;
  let fsx = 1, fsy = 1;
  for (const p of landed) {
    const f = flinch(t, p + 9, 0.07);
    fsx *= f.sx;
    fsy *= f.sy;
  }
  const peek = bad && gag === 'stapel' ? lin(front, 7, d.frontStack, 0, 1) : 0;
  // krimp: Ehm wordt bij elke klap kleiner
  const shrink = bad && gag === 'krimp' ? Math.max(0.42, 1 - 0.075 * landed.length) : 1;
  const weight = bad ? onHead * 0.035 : 0;
  // zakken: bij elke klap zakt Ehm verder weg achter het blad, tot alleen zijn ogen nog boven komen
  const lastLand = landed.length ? landed[landed.length - 1] + 9 : 0;
  const sinkTo = (n: number) => Math.min(EHM_SIZE * 0.42, n * 30);
  const sink = bad && gag === 'zakken' && landed.length
    ? sinkTo(landed.length - 1) + (sinkTo(landed.length) - sinkTo(landed.length - 1)) * spr(t, lastLand, {damping: 9, stiffness: 260, mass: 0.5}) : 0;
  // naarmate de stapel groeit duikt Ehm in elkaar; papier op zijn hoofd drukt hem plat
  const sy = startle.sy * settleTurn.sy * joy1.sy * joy2.sy * fsy * (1 - 0.06 * peek) * (1 - weight) * (1 - 0.1 * sighK) * shrink;
  const sx = startle.sx * settleTurn.sx * joy1.sx * joy2.sx * fsx * (1 + 0.03 * peek) * (1 + weight * 0.6) * (1 + 0.06 * sighK) * shrink;
  const ehmShiver = bad && t > K.escStart + 58 && t < d.freeze ? noise(out * 1.3, 4) * lin(t, K.escStart + 58, K.peakAt + 12, 0, 3) : 0;
  const ehmFreezeShake = bad && t >= d.freeze ? noise(out * 2.5, 8) * Math.max(0, 4 - (out - d.freeze) * 0.3) : 0;
  const EHM = {left: 530, top: 980, size: EHM_SIZE};
  const ehmCX = EHM.left + EHM.size / 2;
  const ehmBottom = EHM.top + EHM.size * 0.76; // voeten (viewBox y = 52)
  const headTop = ehmBottom - (ehmBottom - (EHM.top + EHM.size * 0.225)) * sy + 6; // kruin (y = -55)

  // ---- baas
  const bossTalk = talkOf(sp, cast, t);
  let bossExpr: CastExpression = 'neutraal';
  let armR = 0, armL = 0;
  let bossLook = 1;
  let bossX = 0, bossSX = 1, bossSY = 1, bossLean = 10, bossBlur = 0;
  if (bad) {
    if (bossTalk !== null) bossExpr = 'praten';
    else if (t >= K.wrongEnd && t < K.escStart) bossExpr = 'blij';
    else if (t >= K.peakAt - 2) bossExpr = 'lach';
    else if (t >= K.escStart) bossExpr = 'blij';
    // wijst naar de stapel bij "And Tom's report", duim omhoog bij "lifesaver"
    const L = K.lastEsc, P = K.peakAt;
    armR = keys(t, [[L + 14, 0], [L + 22, -105], [P - 10, -105], [P - 2, 0], [P + 2, 0], [P + 8, -150], [d.freeze, -150]]);
    bossLean = 10 + keys(t, [[K.escStart - 4, 0], [K.escStart + 4, 6], [K.peakAt - 2, 6], [K.peakAt + 6, -2]]);
    // stapt iets de kamer in
    bossX = keys(t, [[K.escStart - 4, 0], [K.escStart + 12, 60]]);
  } else {
    const g = out;
    if (bossTalk !== null) bossExpr = 'praten';
    else if (g >= K.goodB && g < K.twistAt) bossExpr = 'verbaasd';
    else if (g >= K.twistAt) bossExpr = 'opgelucht';
    // de opluchting: diep uitademen
    const sigh = spr(g, K.twistAt - 2, {damping: 8, stiffness: 120});
    bossSY = 1 - 0.07 * sigh * Math.exp(-Math.max(0, g - K.twistAt + 2) / 40);
    bossSX = 1 + 0.05 * sigh * Math.exp(-Math.max(0, g - K.twistAt + 2) / 40);
    // veegt het zweet van zijn voorhoofd
    const T = K.twistAt;
    armR = keys(g, [[T + 34, 0], [T + 42, -158], [T + 50, -140], [T + 58, -158], [T + 66, -140], [T + 74, 0]]);
    bossLook = 1;
    // weg: aanloop naar rechts, dan zoef naar links; terug: inzwaaien met overshoot
    if (g >= d.bossExit - 6 && g < d.bossReturn) {
      const a = lin(g, d.bossExit - 6, d.bossExit, 0, 1);
      const z = lin(g, d.bossExit, d.bossExit + 8, 0, 1);
      bossX = 30 * a - 1100 * Easing.in(Easing.cubic)(z);
      bossLean = 10 - 16 * a + 20 * z;
      bossSX = 1 + 0.35 * z * (1 - z) * 4;
      bossBlur = z > 0 && z < 1 ? 6 : 0;
    } else if (g >= d.bossReturn) {
      const r = spr(g, d.bossReturn, {damping: 11, stiffness: 140, mass: 0.8});
      bossX = -900 * (1 - r);
      bossLean = 10 + (1 - r) * 18;
      bossExpr = 'neutraal';
      armR = 0;
    }
  }
  const bossIdle = Math.sin(out / 18) * 1.2;
  // de baas knikt terwijl Ehm in het goede deel praat
  const nod = !bad && ehmTalk !== null ? Math.sin(out / 5) * 3 : 0;
  // Ehm praat met zijn hele lijf: kantelen en wippen op de lettergrepen
  const ehmTilt = ehmTalk !== null ? Math.sin(out / 7) * 3.5 : !bad && out >= C0 + 20 && out < C0 + 66 ? Math.sin(out / 3) * 6 : 0;
  const ehmTalkBob = ehmTalk !== null ? -ehmTalk * 8 : 0;

  // ---- camera: duwt langzaam in tijdens de escalatie, klapt in op de piek
  const c1 = K.escStart + 58, c2 = d.freeze - 4, c3 = d.freeze + 1;
  const camScale = bad ? keys(t, [[0, 1], [K.wrongAt - 10, 1], [c1, 1.07], [d.freeze - 22, 1.16], [c2, 1.18], [c3, 1.5]]) : 1;
  const camFX = bad ? keys(t, [[0, 540], [c1, 620], [c2, 760], [c3, ehmCX]]) : 540;
  const camFY = bad ? keys(t, [[0, 1100], [c1, 1150], [c2, 1180], [c3, 1200]]) : 1100;
  // het brandpunt schuift naar het midden van het beeld naarmate de camera inzoomt
  const pull = bad ? keys(t, [[0, 0], [c1, 0.25], [c2, 0.45], [c3, 1]]) : 0;
  const panX = (540 - camFX) * pull;
  const panY = (1000 - camFY) * pull * 0.6;
  const shk = bad ? shake(t, d.papers.map((p) => p + 9), 9) : {x: 0, y: 0, r: 0};
  const freezeZoom = bad && t >= d.freeze ? 1 + 0.02 * Math.sin((out - d.freeze) * 0.3) * Math.exp(-(out - d.freeze) / 10) : 1;

  // ---- shots: harde snedes naar een close-up (het brandpunt komt in het midden, iets boven het midden van het beeld)
  const shot = shotAt(d, K, w);
  const drift = {x: noise(out / 24, 21) * 6, y: noise(out / 27, 22) * 6};
  let camTransform = `translate(${shk.x + panX}px, ${shk.y + panY}px) rotate(${shk.r}deg) scale(${camScale * freezeZoom})`;
  let camOrigin = `${camFX}px ${camFY}px`;
  if (shot !== 'wide') {
    const s = shot === 'ehm' ? 1.85 : 1.7;
    const fx = shot === 'ehm' ? ehmCX : -90 + bossX + 450;
    const fy = shot === 'ehm' ? EHM.top + EHM.size * 0.42 + sink : 990;
    camOrigin = '0px 0px';
    camTransform = `translate(${540 - fx * s + drift.x + shk.x}px, ${930 - fy * s + drift.y + shk.y}px) scale(${s})`;
  }
  const shown = shot === 'wide' ? sp : sp.filter((s) => t >= s.at - 1 && t <= s.until + 6).slice(-1);

  // ---- overlays
  const rewinding = out >= d.rewindStart && out < d.rewindEnd + 2;
  const sceneTotal = d.total - (d.coldOpen ?? 0);
  const capIn = out < 70 ? lin(out, 56, 70, 1, 0) : lin(out, sceneTotal - 22, sceneTotal - 12, 0, 1);

  return (
    <AbsoluteFill style={{background: {kantoor: WALL, feestje: '#CBEB8C', keuken: '#FFE6B8', vergadering: '#BFE6E0', buiten: '#DDF1FF', restaurant: '#F2B8A0'}[setting], overflow: 'hidden'}}>
      <AbsoluteFill style={{transformOrigin: camOrigin, transform: camTransform}}>
        {{kantoor: <Room minutes={minutes} />, feestje: <PartyRoom />, keuken: <KitchenRoom />, vergadering: <MeetingRoom out={out} />,
          buiten: <Outside out={out} />, restaurant: <Restaurant out={out} />}[setting]}

        {/* baas */}
        <div style={{position: 'absolute', left: -90 + bossX, top: 720, filter: bossBlur ? `blur(${bossBlur}px)` : undefined,
                     transform: `scale(${bossSX}, ${bossSY})`, transformOrigin: '50% 90%'}}>
          <Cast role={cast} outfit={d.outfit} expression={bossExpr} size={820} frame={out} lean={bossLean + bossIdle + nod} armR={armR} armL={armL}
                look={bossLook} mouthOpen={bossTalk ?? undefined} />
        </div>
        {bossBlur > 0 && (
          <div style={{position: 'absolute', left: 300 + bossX * 0.4, top: 1000, width: 500, height: 300}}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{position: 'absolute', left: i * 40, top: 40 + i * 60, width: 380 - i * 50, height: 10, borderRadius: 5, background: C.ink, opacity: 0.6}} />
            ))}
          </div>
        )}

        {/* Ehm */}
        <div style={{position: 'absolute', left: EHM.left + ehmShiver + ehmFreezeShake, top: EHM.top + bob + startle.y + settleTurn.y + joy1.y + joy2.y + ehmTalkBob + sink,
                     transform: `rotate(${ehmTilt}deg) scale(${sx}, ${sy})`, transformOrigin: '50% 76%'}}>
          <Ehm expression={ehmExpr} size={EHM.size} frame={out} since={ehmExpr === 'bevroren' ? out - d.freeze : ehmExpr === 'opgelucht' ? out - C0 : ehmExpr === 'trots' ? out - C0 - 20 : 999} flip
               look={ehmLook} mouthOpen={ehmTalk ?? undefined} />
        </div>

        {/* papier op het hoofd (achter het bureau-front, vóór Ehm) */}
        {bad && gag === 'stapel' && d.papers.map((_, i) => (i >= d.frontStack ? <Paper key={i} kind={d.gagObject ?? 'paper'} s={paper(d, i, t, headTop, ehmCX)} /> : null))}

        {gag === 'wolk' && bad && <Cloud beats={landed.length} cx={ehmCX} top={headTop} out={out} total={d.papers.length} />}
        {{kantoor: <DeskFront t={out} typing={typing} />, feestje: <PartyTable />, keuken: <KitchenCounter />, vergadering: <MeetingTable />,
          buiten: <Hedge />, restaurant: <DinnerTable out={out} />}[setting]}
        {gag === 'zweet' && bad && <Puddle t={t} beats={landed.length} cx={ehmCX} out={out} />}
        {bad && gag === 'stapel' && d.papers.map((_, i) => (i < d.frontStack ? <Paper key={i} kind={d.gagObject ?? 'paper'} s={paper(d, i, t, headTop, ehmCX)} /> : null))}
      </AbsoluteFill>

      {/* ballonnen: vast in beeld, zoals in een strip */}
      {shown.map((s) => <Bubble key={`${branch}${sp.indexOf(s)}`} sp={s} t={t} side={s.line.who === 'ehm' ? 'right' : 'left'} high={shot !== 'wide'} />)}

      {/* bijschrift (alleen aan het begin en het eind, zodat de lus sluit) */}
      {capIn > 0 && (
        <div style={{position: 'absolute', top: 200, left: 60, right: 150, textAlign: 'center', opacity: capIn,
                     transform: `translateY(${(1 - capIn) * -20}px)`}}>
          <span style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 84, lineHeight: 1.1, color: C.white,
                        WebkitTextStroke: `11px ${C.ink}`, paintOrder: 'stroke fill', textShadow: `0 7px 0 ${C.ink}`}}>{d.caption}</span>
        </div>
      )}

      {/* PDF-sticker */}
      {out >= d.sticker.at && out < d.sticker.until + 8 && (() => {
        const p = spr(out, d.sticker.at, {damping: 8, stiffness: 220});
        const o = out > d.sticker.until ? lin(out, d.sticker.until, d.sticker.until + 8, 1, 0) : 1;
        return (
          <div style={{position: 'absolute', left: 70, top: 300, transform: `scale(${p * o}) rotate(${-4 + Math.sin(out / 9) * 2}deg)`,
                       background: C.zon, border: `7px solid ${C.ink}`, borderRadius: 999, padding: '20px 40px', boxShadow: `0 8px 0 ${C.ink}`,
                       fontFamily: FONT_BODY, fontWeight: 800, fontSize: 46, color: C.ink}}>
            {d.sticker.text}
          </div>
        );
      })()}

      {branch === 'good' && <Joy out={out} at={C0 + 26} cx={ehmCX} cy={EHM.top + EHM.size * 0.35} badge={d.badge} />}

      {/* bevriezen: de wereld wordt even blauwig stil */}
      {bad && t >= d.freeze && !rewinding && (
        <AbsoluteFill style={{background: 'rgba(205,235,250,0.18)', boxShadow: 'inset 0 0 160px rgba(120,180,230,0.6)'}} />
      )}

      {rewinding && <RewindFX out={out} d={d} />}
      <TakeTwo out={out} at={d.rewindEnd} />

    </AbsoluteFill>
  );
};

/** De video: eventueel eerst de koude opening (de bevroren piek, "How did we get here?", terugspoelen), dan de scène. */
export const Escalatie: React.FC<EscalatieProps> = ({data: d, audio}) => {
  const out = useCurrentFrame();
  const co = d.coldOpen ?? 0;
  return (
    <AbsoluteFill>
      {out < co ? <ColdOpen d={d} out={out} co={co} /> : <Scene d={d} out={out - co} />}
      {audio && <Html5Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};

const ColdOpen: React.FC<{d: EscalatieData; out: number; co: number}> = ({d, out, co}) => {
  const rw = co - 16; // laatste 16 frames: snel terugspoelen naar het begin
  const sceneOut = out < rw ? d.freeze + 8 : Math.round((d.freeze + 8) * (1 - lin(out, rw, co)));
  const cap = spr(out, 4, {damping: 10, stiffness: 220});
  return (
    <AbsoluteFill>
      <Scene d={d} out={sceneOut} />
      {out >= rw && <RewindFX out={out - rw + d.rewindStart} d={{...d, rewindEnd: d.rewindStart + 16}} />}
      {out < rw + 4 && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div style={{transform: `scale(${cap}) rotate(-4deg)`, background: C.zon, border: `8px solid ${C.ink}`, borderRadius: 30, padding: '20px 44px',
                       boxShadow: `0 10px 0 ${C.ink}`, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 82, color: C.ink, textAlign: 'center', marginTop: -380}}>
            How did we<br />get here?
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ terugspoelen en "Take two"
const RewindFX: React.FC<{out: number; d: EscalatieData}> = ({out, d}) => {
  const p = lin(out, d.rewindStart, d.rewindEnd);
  const band = ((out * 53) % 1920);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: `repeating-linear-gradient(0deg, rgba(31,42,68,0.22) 0 4px, transparent 4px 10px)`,
                            transform: `translateY(${(out * 7) % 10}px)`}} />
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(255,40,120,0.16), rgba(0,200,255,0.16))', mixBlendMode: 'multiply'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: band, height: 70, background:
                   'repeating-linear-gradient(90deg, rgba(255,255,255,0.75) 0 7px, rgba(255,255,255,0.1) 7px 19px)', transform: `translateX(${noise(out, 2) * 40}px)`}} />
      <div style={{position: 'absolute', left: 70, top: 190, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 92, color: C.white,
                   WebkitTextStroke: `10px ${C.ink}`, paintOrder: 'stroke fill', opacity: out % 16 < 11 ? 1 : 0.35}}>◀◀ REW</div>
      <AbsoluteFill style={{background: `rgba(255,255,255,${Math.max(0, 1 - Math.abs(p - 1) * 12) * 0.9})`}} />
    </AbsoluteFill>
  );
};

const TakeTwo: React.FC<{out: number; at: number}> = ({out, at}) => {
  if (out < at || out > at + 24) return null;
  const s = Math.min(spr(out, at, {damping: 15, stiffness: 260, mass: 0.6}), 1.04);
  const leave = lin(out, at + 16, at + 24);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{transform: `scale(${(3 - 2 * s) * (1 + leave * 0.6)}) rotate(${-8 + 4 * s}deg)`, opacity: 1 - leave,
                   fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 190, color: C.zon, WebkitTextStroke: `22px ${C.ink}`, paintOrder: 'stroke fill',
                   textShadow: `0 14px 0 ${C.ink}`}}>
        TAKE TWO
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ Ehm's beloning
const Heart: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="-12 -12 24 24">
    <path d="M0 9 C-14 -1 -7 -12 0 -5 C7 -12 14 -1 0 9Z" fill={color} stroke={C.ink} strokeWidth={2} strokeLinejoin="round" />
  </svg>
);
const Star: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="-12 -12 24 24">
    <path d="M0 -11 Q2 -2 11 0 Q2 2 0 11 Q-2 2 -11 0 Q-2 -2 0 -11Z" fill={C.zon} stroke={C.ink} strokeWidth={1.8} strokeLinejoin="round" />
  </svg>
);

/** Hartjes en sterretjes die uit Ehm springen, en een "+1 courage"-badge die omhoog zweeft. */
const Joy: React.FC<{out: number; at: number; cx: number; cy: number; badge: string}> = ({out, at, cx, cy, badge}) => {
  if (out < at || out > at + 70) return null;
  const parts = Array.from({length: 9}).map((_, i) => {
    const ang = -Math.PI / 2 + (i - 4) * 0.38 + noise(i, 3) * 0.15;
    const d = out - at - (i % 3) * 2;
    if (d < 0) return null;
    const p = spr(out, at + (i % 3) * 2, {damping: 14, stiffness: 90});
    const r = 120 + 260 * p + (i % 2) * 40;
    const fade = lin(d, 30, 50, 1, 0);
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r * 0.9 - d * 1.2;
    const size = (i % 3 === 0 ? 70 : 54) * (0.4 + 0.6 * p);
    return (
      <div key={i} style={{position: 'absolute', left: x - size / 2, top: y - size / 2, opacity: fade, transform: `rotate(${noise(i, 5) * 25 + Math.sin(d / 4) * 8}deg)`}}>
        {i % 3 === 1 ? <Star size={size} /> : <Heart size={size} color={i % 2 ? '#FF8FAB' : C.cheek} />}
      </div>
    );
  });
  const b = spr(out, at + 4, {damping: 9, stiffness: 200});
  const by = cy - 320 - lin(out, at + 4, at + 70, 0, 90);
  const bf = lin(out, at + 52, at + 70, 1, 0);
  return (
    <AbsoluteFill>
      {parts}
      <div style={{position: 'absolute', left: cx - 240, width: 480, top: by, textAlign: 'center', opacity: bf, transform: `scale(${b})`}}>
        <span style={{display: 'inline-block', background: C.yesSoft, color: C.yesInk, border: `7px solid ${C.ink}`, borderRadius: 999,
                      padding: '14px 36px', boxShadow: `0 8px 0 ${C.ink}`, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 64}}>
          {badge}
        </span>
      </div>
    </AbsoluteFill>
  );
};
