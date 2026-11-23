/**
 * Gedeelde onderdelen van de korte vormen (POV-loop, decoder, ranglijst; Sami 23 nov): het decor in een stripvak met
 * de ander links en Ehm rechts, een ballon die woord voor woord met het brabbelen meeloopt, een kop bovenin en de
 * oproep-sticker. Zelfde stripstijl als Ehm tegen Ehm en de verteller (decor uit Duel.tsx).
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Ehm, Expression} from '../ehm/Ehm';
import type {Setting} from './Escalatie';
import {Cast, CastExpression, Outfit, Role} from '../ehm/Cast';
import {C, FIELD, Pillar} from '../ehm/colors';
import {FONT_BODY, FONT_HEAD} from '../fonts';
import {lin, mouth, noise, speech, spr} from '../anim/anim';
import {SceneSet, SET} from './Duel';

export const outline = (px: number) => ({WebkitTextStroke: `${px}px ${C.ink}`, paintOrder: 'stroke fill' as const});
export const onTwos = (f: number) => Math.floor(f / 2) * 2;

/** Papier met het stippenvlak van de pijler, en de 'kookt'-lijn (alles trilt een beetje, zoals getekend). */
export const Paper: React.FC<{pillar: Pillar; frame: number; children: React.ReactNode}> = ({pillar, frame, children}) => (
  <AbsoluteFill style={{background: C.paper, overflow: 'hidden'}}>
    <svg width={0} height={0} style={{position: 'absolute'}}>
      <filter id="boil">
        <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={Math.floor(frame / 3) % 6} />
        <feDisplacementMap in="SourceGraphic" scale={5} />
      </filter>
    </svg>
    <AbsoluteFill style={{backgroundImage: `radial-gradient(${FIELD[pillar]} 5px, transparent 5.5px)`, backgroundSize: '26px 26px', opacity: 0.9}} />
    {children}
  </AbsoluteFill>
);

/** Kop bovenin: groot, geel met inkt-rand. Staat er vanaf het eerste frame (geen intro). */
export const Header: React.FC<{text: string; top?: number; size?: number; frame: number}> = ({text, top = 150, size, frame}) => {
  const fs = size ?? (text.length <= 34 ? 88 : text.length <= 50 ? 76 : 66);
  return (
    <div style={{position: 'absolute', left: 56, right: 56, top, textAlign: 'center',
                 transform: `rotate(${-1.2 + (onTwos(frame) % 4 === 0 ? 0.25 : 0)}deg)`}}>
      <div style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: fs, lineHeight: 1.06, color: C.zon, ...outline(14), textShadow: `0 8px 0 ${C.ink}`}}>{text}</div>
    </div>
  );
};

/** De oproep, als pil. */
export const Sticker: React.FC<{text: string; top: number; at: number; t: number; left?: number}> = ({text, top, at, t, left = 60}) => {
  if (t < at) return null;
  const a = Math.min(1.04, spr(t, at, {damping: 10, stiffness: 220}));
  return (
    <div style={{position: 'absolute', left, right: 60, top, textAlign: 'center', transform: `scale(${a})`}}>
      <span style={{display: 'inline-block', background: C.zon, border: `7px solid ${C.ink}`, borderRadius: 999, padding: '14px 34px',
                    boxShadow: `7px 7px 0 ${C.ink}`, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 40, color: C.ink}}>{text}</span>
    </div>
  );
};

/** Roep in een stripwolk, breed genoeg voor een paar woorden. */
export const Shout: React.FC<{text: string; at: number; t: number; x: number; y: number; color: string; rot: number; hold?: number; size?: number}> = (
  {text, at, t, x, y, color, rot, hold = 40, size = 60}) => {
  if (t < at || t > at + hold) return null;
  const s = Math.min(spr(t, at, {damping: 8, stiffness: 320, mass: 0.5}), 1.08);
  const o = lin(t, at + hold - 8, at + hold, 1, 0);
  const w = Math.max(360, text.length * size * 0.56 + 120);
  const h = size * 3;
  const pts = Array.from({length: 28}).map((_, i) => {
    const r = i % 2 ? 0.8 : 1 + noise(i, at) * 0.08;
    const a = (i / 28) * Math.PI * 2;
    return `${Math.cos(a) * r * w / 2},${Math.sin(a) * r * h / 2}`;
  }).join(' ');
  return (
    <div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, transform: `scale(${s}) rotate(${rot}deg)`, opacity: o}}>
      <svg width={w} height={h} viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} style={{position: 'absolute', overflow: 'visible'}}>
        <polygon points={pts} fill={color} stroke={C.ink} strokeWidth={6} strokeLinejoin="round" />
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                   fontFamily: FONT_HEAD, fontWeight: 700, fontSize: size, lineHeight: 1, color: C.white, ...outline(11), padding: '0 50px'}}>{text}</div>
    </div>
  );
};

export type Spoken = {text: string; at: number; until: number};

/** Ballon van de ander (links) of van Ehm (rechts); woorden verschijnen met het brabbelen mee. */
export const Balloon: React.FC<{l: Spoken; t: number; side: 'left' | 'right'; top: number; size?: number; maxWidth?: number; edge?: number}> = (
  {l, t, side, top, size = 50, maxWidth = 560, edge = 150}) => {
  if (t < l.at - 1 || t > l.until + 4) return null;
  const words = speech(l.text, l.at);
  const pop = Math.min(spr(t, l.at - 1, {damping: 10, stiffness: 300, mass: 0.5}), 1.04);
  const leave = t > l.until ? lin(t, l.until, l.until + 4, 1, 0) : 1;
  return (
    <div style={{position: 'absolute', top, [side]: edge, maxWidth, transform: `scale(${pop * leave})`, transformOrigin: side === 'left' ? '20% 120%' : '80% 120%'}}>
      <div style={{background: C.white, border: `6px solid ${C.ink}`, borderRadius: 24, padding: '18px 28px', fontFamily: FONT_HEAD, fontWeight: 600,
                   fontSize: size, lineHeight: 1.1, color: C.ink, boxShadow: `6px 6px 0 ${C.ink}`}}>
        {words.map((w, i) => (
          <span key={i} style={{opacity: t >= w.s ? 1 : 0.15, marginRight: i < words.length - 1 ? '0.25em' : 0, display: 'inline-block'}}>{w.text}</span>
        ))}
      </div>
      <svg width={70} height={56} style={{position: 'absolute', top: '100%', marginTop: -7, [side]: 90}}>
        <path d={side === 'left' ? 'M6 0 L40 0 L14 50 Z' : 'M64 0 L30 0 L56 50 Z'} fill={C.white} stroke={C.ink} strokeWidth={6} strokeLinejoin="round" />
        <rect x={side === 'left' ? 9 : 27} y={0} width={34} height={9} fill={C.white} />
      </svg>
    </div>
  );
};

/** Mondopening terwijl een ballon 'gezegd' wordt, of null als de spreker stil is. */
export function talking(l: Spoken | undefined, t: number): number | null {
  if (!l) return null;
  const w = speech(l.text, l.at);
  if (t < w[0].s || t > w[w.length - 1].e) return null;
  return 0.25 + 0.75 * mouth(w, t);
}

/** Hoe ver het vak inzoomt; binnen het vak is de hoogte h / (w / 1000 * STAGE_ZOOM). */
export const STAGE_ZOOM = 1.3;
export const innerHeight = (w: number, h: number, zoom = STAGE_ZOOM) => h / ((w / 1000) * zoom);

/** Het decor in een stripvak, met de ander links en Ehm rechts. Coördinaten binnen het vak: 1000 breed, h hoog. */
export const Stage: React.FC<{
  setting: Setting; cast: Role; outfit?: Outfit; x: number; y: number; w: number; h: number; t: number;
  castExpr: CastExpression; castMood?: CastExpression; castMouth?: number | null; castLean?: number; castArms?: [number, number];
  ehmExpr: Expression; ehmSince: number; ehmScale?: number; ehmX?: number; ehmY?: number; ehmLook?: number;
  mood?: number; tint?: string; zoom?: number; children?: React.ReactNode;
}> = ({setting, cast, outfit, x, y, w, h, t, castExpr, castMood, castMouth, castLean = 2, castArms = [0, 0], ehmExpr, ehmSince,
       ehmScale = 1, ehmX = 0, ehmY = 0, ehmLook = -1, mood = 0, tint, zoom = STAGE_ZOOM, children}) => {
  // ingezoomd zoals de verteller: de personages vullen het vak, de randen van het decor vallen weg
  const scale = (w / 1000) * zoom;
  const ih = h / scale;
  const EH = 400;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, border: `10px solid ${C.ink}`, borderRadius: 18, overflow: 'hidden',
                 background: SET[setting].wall, boxShadow: `12px 12px 0 ${C.ink}`}}>
      <div style={{position: 'absolute', left: (w - 1000 * scale) / 2, top: 0, width: 1000, height: ih, transform: `scale(${scale})`, transformOrigin: '0 0'}}>
        <SceneSet setting={setting} h={ih} mood={mood} />
        <div style={{position: 'absolute', left: -40, top: ih - 500}}>
          <Cast role={cast} outfit={outfit} expression={castExpr} mood={castMood} size={580} frame={t} lean={castLean + noise(t / 25, 1) * 3}
                armL={castArms[0]} armR={castArms[1]} look={0.8} mouthOpen={castMouth ?? undefined} />
        </div>
        <div style={{position: 'absolute', left: 480 + ehmX, top: ih - 120 - EH * 0.76 + ehmY, transform: `scale(${ehmScale})`, transformOrigin: '50% 76%'}}>
          <Ehm expression={ehmExpr} size={EH} frame={t} since={ehmSince} flip look={ehmLook} />
        </div>
        {children}
      </div>
      {tint && <AbsoluteFill style={{background: tint}} />}
    </div>
  );
};
