/**
 * De tegenspelers van Ehm: de baas, een kennis, een collega. Bewust een andere vorm dan Ehm (een afgeronde rechthoek,
 * langer en smaller), zodat Ehm altijd de enige ronde blob blijft en direct herkenbaar is.
 *
 * Eén rig, per rol een kleur en een accessoire. Expressies zijn eenvoudiger dan bij Ehm: de tegenspeler reageert,
 * Ehm speelt.
 */
import React from 'react';
import {C} from './colors';

export type Role = 'baas' | 'kennis' | 'collega';
export type CastExpression = 'neutraal' | 'praten' | 'frons' | 'blij' | 'lach' | 'verbaasd' | 'opgelucht' | 'ongeduldig';

export type Acc = 'das' | 'oorbellen' | 'koptelefoon' | 'bril' | 'pet' | 'strik' | 'knot';
/** Uiterlijk: kleur en accessoire. Per video anders, zodat de tegenspeler niet steeds dezelfde baas is. */
export type Outfit = {body: string; deep: string; acc: Acc};

const ROLE: Record<Role, Outfit> = {
  baas: {body: '#8FB3E8', deep: '#5E86C4', acc: 'das'},
  kennis: {body: '#F7A8C4', deep: '#E07CA2', acc: 'oorbellen'},
  collega: {body: '#9FD8B8', deep: '#6DBB93', acc: 'koptelefoon'},
};

const LINE = 3;
const round = {strokeLinecap: 'round', strokeLinejoin: 'round'} as const;

const Eyes: React.FC<{e: CastExpression; blink: boolean}> = ({e, blink}) => {
  if (blink || e === 'opgelucht' || e === 'lach') {
    return (
      <g fill="none" stroke={C.navy} strokeWidth={LINE} {...round}>
        <path d={e === 'lach' ? 'M-24 -30 q6 -7 12 0' : 'M-24 -28 q6 4 12 0'} />
        <path d={e === 'lach' ? 'M12 -30 q6 -7 12 0' : 'M12 -28 q6 4 12 0'} />
      </g>
    );
  }
  const r = e === 'verbaasd' ? 6.5 : 5;
  const dx = e === 'ongeduldig' ? 4 : 0;
  return (
    <g fill={C.navy}>
      <circle cx={-18 + dx} cy={-28} r={r} />
      <circle cx={18 + dx} cy={-28} r={r} />
      <circle cx={-16 + dx} cy={-30} r={e === 'verbaasd' ? 2 : 1.5} fill={C.white} />
      <circle cx={20 + dx} cy={-30} r={e === 'verbaasd' ? 2 : 1.5} fill={C.white} />
    </g>
  );
};

const Brows: React.FC<{e: CastExpression}> = ({e}) => {
  const d: Partial<Record<CastExpression, [string, string]>> = {
    frons: ['M-28 -44 L-10 -38', 'M28 -44 L10 -38'],
    ongeduldig: ['M-26 -42 L-8 -42', 'M26 -44 L10 -40'],
    verbaasd: ['M-28 -46 q9 -7 18 0', 'M10 -46 q9 -7 18 0'],
    opgelucht: ['M-28 -40 q9 -4 18 2', 'M28 -40 q-9 -4 -18 2'],
  };
  const p = d[e];
  if (!p) return null;
  return (
    <g fill="none" stroke={C.navy} strokeWidth={LINE} {...round}>
      <path d={p[0]} />
      <path d={p[1]} />
    </g>
  );
};

const Mouth: React.FC<{e: CastExpression; open: number}> = ({e, open}) => {
  const s = {fill: 'none', stroke: C.navy, strokeWidth: LINE, ...round};
  switch (e) {
    case 'praten':
      return <ellipse cx={0} cy={-6} rx={9} ry={3 + 6 * open} fill={C.navy} />;
    case 'frons':
      return <path d="M-12 -2 q12 -8 24 0" {...s} />;
    case 'blij':
      return <path d="M-14 -10 q14 12 28 0" {...s} />;
    case 'lach':
      return <path d="M-16 -12 q16 22 32 0 z" fill={C.navy} stroke={C.navy} strokeWidth={LINE} {...round} />;
    case 'verbaasd':
      return <ellipse cx={0} cy={-4} rx={6} ry={8} fill={C.navy} />;
    case 'opgelucht':
      return <path d="M-12 -6 q12 6 24 0" {...s} />;
    case 'ongeduldig':
      return <path d="M-12 -6 L12 -8" {...s} />;
    default:
      return <path d="M-10 -8 q10 6 20 0" {...s} />;
  }
};

const Accessory: React.FC<{acc: Acc; deep: string}> = ({acc, deep}) => {
  if (acc === 'bril') {
    return (
      <g fill="rgba(255,255,255,0.35)" stroke={C.navy} strokeWidth={3.2}>
        <circle cx={-18} cy={-28} r={13} />
        <circle cx={18} cy={-28} r={13} />
        <path d="M-5 -29 Q0 -33 5 -29" fill="none" />
      </g>
    );
  }
  if (acc === 'pet') {
    return (
      <g stroke={C.navy} strokeWidth={3} strokeLinejoin="round">
        <path d="M-46 -62 Q-44 -104 0 -106 Q44 -104 46 -62 Z" fill={deep} />
        <path d="M-6 -66 Q40 -72 74 -60 Q44 -52 -6 -58 Z" fill={deep} />
        <circle cx={0} cy={-106} r={5} fill={C.navy} />
      </g>
    );
  }
  if (acc === 'strik') {
    return (
      <g stroke={C.navy} strokeWidth={2.5} strokeLinejoin="round" fill={C.zon}>
        <path d="M0 18 L-22 6 L-22 30 Z" />
        <path d="M0 18 L22 6 L22 30 Z" />
        <circle cx={0} cy={18} r={6} />
      </g>
    );
  }
  if (acc === 'knot') {
    return (
      <g stroke={C.navy} strokeWidth={3} fill={deep}>
        <circle cx={0} cy={-90} r={18} />
        <path d="M-30 -74 Q0 -96 30 -74" fill="none" />
      </g>
    );
  }
  if (acc === 'das') {
    return (
      <g stroke={C.navy} strokeWidth={2.5} {...round}>
        <path d="M-7 14 L7 14 L4 22 L9 56 L0 66 L-9 56 L-4 22 Z" fill={C.noInk} />
      </g>
    );
  }
  if (acc === 'oorbellen') {
    return (
      <g fill={C.zon} stroke={C.navy} strokeWidth={2}>
        <circle cx={-52} cy={-14} r={6} />
        <circle cx={52} cy={-14} r={6} />
      </g>
    );
  }
  return (
    <g fill="none" stroke={C.navy} strokeWidth={LINE} {...round}>
      <path d="M-50 -30 Q0 -110 50 -30" />
      <rect x={-60} y={-38} width={14} height={26} rx={6} fill={deep} />
      <rect x={46} y={-38} width={14} height={26} rx={6} fill={deep} />
    </g>
  );
};

export type CastProps = {
  role: Role;
  expression: CastExpression;
  size: number;
  frame: number;
  flip?: boolean;
  /** buigt naar voren (bv. om de deur kijken), in graden */
  lean?: number;
  /** armen: draaiing om de schouder in graden (0 = hangend; negatief = omhoog naar buiten) */
  armL?: number;
  armR?: number;
  /** kijkrichting -1..1 */
  look?: number;
  /** mondopening 0..1 bij 'praten', gestuurd door de stem */
  mouthOpen?: number;
  /** bij 'praten': ogen en wenkbrauwen van deze stemming (praten terwijl je lacht, fronst, schrikt) */
  mood?: CastExpression;
  /** ander uiterlijk dan de standaard van de rol */
  outfit?: Outfit;
};

export const Cast: React.FC<CastProps> = ({role, expression, size, frame, flip = false, lean = 0, armL = 0, armR = 0, look = 0, mouthOpen, mood, outfit}) => {
  const r = outfit ?? ROLE[role];
  const breathe = Math.sin(frame / 16) * 0.012;
  const blink = (frame + 37) % 110 >= 106;
  const open = expression === 'praten' ? (mouthOpen ?? (Math.sin(frame / 2.4) + 1) / 2) : 0;
  const face = expression === 'praten' && mood ? mood : expression;
  return (
    <svg width={size} height={size} viewBox="-100 -100 200 200" style={{overflow: 'visible'}}>
      <g transform={`rotate(${lean} 0 80) scale(${flip ? -1 : 1} ${1 + breathe})`}>
        {/* armen achter het lijf, draaibaar om de schouder */}
        <g transform={`rotate(${-armL} -46 6)`}>
          <path d="M-46 6 Q-62 30 -60 54" fill="none" stroke={C.navy} strokeWidth={17} {...round} />
          <path d="M-46 6 Q-62 30 -60 54" fill="none" stroke={r.body} strokeWidth={12} {...round} />
        </g>
        <g transform={`rotate(${armR} 46 6)`}>
          <path d="M46 6 Q62 30 60 54" fill="none" stroke={C.navy} strokeWidth={17} {...round} />
          <path d="M46 6 Q62 30 60 54" fill="none" stroke={r.body} strokeWidth={12} {...round} />
        </g>
        {/* lijf: afgeronde rechthoek, langer dan Ehm */}
        <rect x={-50} y={-78} width={100} height={160} rx={44} fill={r.body} stroke={C.navy} strokeWidth={LINE} />
        <path d="M-50 40 Q0 58 50 40" fill="none" stroke={r.deep} strokeWidth={4} opacity={0.5} />
        <Accessory acc={r.acc} deep={r.deep} />
        <g transform={`translate(${(flip ? -1 : 1) * look * 6} 0)`}>
          <Eyes e={face} blink={blink} />
        </g>
        <Brows e={face} />
        {/* blosjes */}
        <ellipse cx={-30} cy={-12} rx={9} ry={5} fill={C.cheek} opacity={face === 'lach' || face === 'blij' ? 0.45 : 0.25} />
        <ellipse cx={30} cy={-12} rx={9} ry={5} fill={C.cheek} opacity={face === 'lach' || face === 'blij' ? 0.45 : 0.25} />
        <Mouth e={expression} open={open} />
      </g>
    </svg>
  );
};
