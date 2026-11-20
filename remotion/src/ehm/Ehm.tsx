/**
 * Ehm als vector-rig. Eén lichaam, losse lagen voor ogen, wenkbrauwen, mond, armen en props,
 * gelijk aan assets/ehm/ehm_rig.py (de bron van de goedgekeurde vormen).
 *
 * De vorm verandert nooit: alleen de lagen wisselen en bewegen. Dat houdt Ehm herkenbaar
 * (Ehrenberg-Bass: verandering verzwakt een merkpersonage).
 *
 * Animatie komt uit twee getallen:
 *  - frame: het absolute frame, voor rust-beweging (ademen, knipperen) zonder sprongen
 *  - since: frames sinds de laatste wissel van expressie, voor het "ploppen" van props en de squash
 */
import React from 'react';
import {interpolate, spring, useVideoConfig} from 'remotion';
import {C} from './colors';

export type Expression =
  | 'neutraal'
  | 'bevroren'
  | 'zenuwachtig'
  | 'opgelucht'
  | 'trots'
  | 'praten'
  | 'denken'
  | 'zwaaien';

type Eyes = 'punt' | 'wijd' | 'opzij' | 'omhoog' | 'dicht' | 'blij';
type Brows = 'geen' | 'bezorgd' | 'zelfvoldaan' | 'omhoog';
type Mouth = 'glimlach' | 'golf' | 'grimas' | 'zucht' | 'zelfvoldaan' | 'praat' | 'lach' | 'scheef';
type Arms = 'rust' | 'zwaai' | 'uitleg' | 'stijf' | 'kin';
type Prop = 'zweet' | 'ijs' | 'ster' | 'zucht';

const EXPRESSIONS: Record<Expression, {eyes: Eyes; brows: Brows; mouth: Mouth; arms: Arms; props: Prop[]; squash?: boolean}> = {
  neutraal: {eyes: 'punt', brows: 'geen', mouth: 'glimlach', arms: 'rust', props: []},
  bevroren: {eyes: 'wijd', brows: 'geen', mouth: 'grimas', arms: 'stijf', props: ['ijs']},
  zenuwachtig: {eyes: 'opzij', brows: 'bezorgd', mouth: 'golf', arms: 'rust', props: ['zweet']},
  opgelucht: {eyes: 'dicht', brows: 'geen', mouth: 'zucht', arms: 'rust', props: ['zucht'], squash: true},
  trots: {eyes: 'blij', brows: 'geen', mouth: 'zelfvoldaan', arms: 'rust', props: ['ster']},
  praten: {eyes: 'punt', brows: 'geen', mouth: 'praat', arms: 'uitleg', props: []},
  denken: {eyes: 'omhoog', brows: 'omhoog', mouth: 'scheef', arms: 'kin', props: []},
  zwaaien: {eyes: 'punt', brows: 'geen', mouth: 'lach', arms: 'zwaai', props: []},
};

export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS) as Expression[];

const LINE = 3;
const ARM_R = 7;
const round = {strokeLinecap: 'round', strokeLinejoin: 'round'} as const;

// ------------------------------------------------------------------ onderdelen
const Arm: React.FC<{d: string; rotate?: number; origin?: string}> = ({d, rotate = 0, origin = '0 0'}) => (
  <g transform={`rotate(${rotate} ${origin})`}>
    <path d={d} fill="none" stroke={C.navy} strokeWidth={2 * ARM_R + LINE} {...round} />
    <path d={d} fill="none" stroke={C.peach} strokeWidth={2 * ARM_R} {...round} />
  </g>
);

const REST_L = 'M-46 14 Q-56 24 -60 34';
const REST_R = 'M46 14 Q56 24 60 34';

const ArmsBack: React.FC<{arms: Arms; wave: number}> = ({arms, wave}) => {
  switch (arms) {
    case 'zwaai':
      return (
        <>
          <Arm d={REST_L} />
          <Arm d="M42 -6 Q60 -22 68 -48" rotate={wave} origin="42 -6" />
        </>
      );
    case 'uitleg':
      return (
        <>
          <Arm d={REST_L} />
          <Arm d="M42 8 Q60 2 70 -14" rotate={wave * 0.4} origin="42 8" />
        </>
      );
    case 'stijf':
      return (
        <>
          <Arm d="M-46 8 L-60 34" />
          <Arm d="M46 8 L60 34" />
        </>
      );
    case 'kin':
      return <Arm d={REST_L} />;
    default:
      return (
        <>
          <Arm d={REST_L} />
          <Arm d={REST_R} />
        </>
      );
  }
};

const Body: React.FC = () => (
  <>
    <ellipse cx={-22} cy={46} rx={13} ry={6} fill={C.peach} stroke={C.navy} strokeWidth={LINE} />
    <ellipse cx={22} cy={46} rx={13} ry={6} fill={C.peach} stroke={C.navy} strokeWidth={LINE} />
    <path
      d="M-55 40C-62 -10 -40 -55 0 -55C42 -55 60 -15 55 40Q0 52 -55 40Z"
      fill={C.peach}
      stroke={C.navy}
      strokeWidth={LINE}
      strokeLinejoin="round"
    />
    <circle cx={-32} cy={6} r={7} fill={C.cheek} fillOpacity={0.45} />
    <circle cx={32} cy={6} r={7} fill={C.cheek} fillOpacity={0.45} />
  </>
);

const EyesLayer: React.FC<{eyes: Eyes; blink: boolean}> = ({eyes, blink}) => {
  const closedLine = (
    <>
      <path d="M-24 -11 h12" stroke={C.navy} strokeWidth={3} {...round} />
      <path d="M12 -11 h12" stroke={C.navy} strokeWidth={3} {...round} />
    </>
  );
  if (blink && (eyes === 'punt' || eyes === 'opzij' || eyes === 'omhoog')) return closedLine;
  switch (eyes) {
    case 'wijd':
      return (
        <>
          <circle cx={-18} cy={-12} r={9} fill={C.white} stroke={C.navy} strokeWidth={2.5} />
          <circle cx={-18} cy={-12} r={3.6} fill={C.navy} />
          <circle cx={18} cy={-12} r={9} fill={C.white} stroke={C.navy} strokeWidth={2.5} />
          <circle cx={18} cy={-12} r={3.6} fill={C.navy} />
        </>
      );
    case 'opzij':
      return (
        <>
          <ellipse cx={-14} cy={-12} rx={5} ry={7} fill={C.navy} />
          <ellipse cx={22} cy={-12} rx={5} ry={7} fill={C.navy} />
        </>
      );
    case 'omhoog':
      return (
        <>
          <ellipse cx={-16} cy={-17} rx={4.5} ry={6} fill={C.navy} />
          <ellipse cx={20} cy={-17} rx={4.5} ry={6} fill={C.navy} />
        </>
      );
    case 'dicht':
      return (
        <>
          <path d="M-25 -13 q7 7 14 0" fill="none" stroke={C.navy} strokeWidth={3} {...round} />
          <path d="M11 -13 q7 7 14 0" fill="none" stroke={C.navy} strokeWidth={3} {...round} />
        </>
      );
    case 'blij':
      return (
        <>
          <path d="M-25 -10 q7 -8 14 0" fill="none" stroke={C.navy} strokeWidth={3} {...round} />
          <path d="M11 -10 q7 -8 14 0" fill="none" stroke={C.navy} strokeWidth={3} {...round} />
        </>
      );
    default:
      return (
        <>
          <ellipse cx={-18} cy={-12} rx={5} ry={7} fill={C.navy} />
          <ellipse cx={18} cy={-12} rx={5} ry={7} fill={C.navy} />
        </>
      );
  }
};

const BrowsLayer: React.FC<{brows: Brows}> = ({brows}) => {
  switch (brows) {
    case 'bezorgd':
      return (
        <>
          <path d="M-27 -23 L-12 -28" stroke={C.navy} strokeWidth={3} {...round} />
          <path d="M27 -23 L12 -28" stroke={C.navy} strokeWidth={3} {...round} />
        </>
      );
    case 'zelfvoldaan':
      return (
        <>
          <path d="M-27 -22 L-11 -20" stroke={C.navy} strokeWidth={3} {...round} />
          <path d="M27 -22 L11 -20" stroke={C.navy} strokeWidth={3} {...round} />
        </>
      );
    case 'omhoog':
      return (
        <>
          <path d="M-25 -31 q6 -4 12 -1" fill="none" stroke={C.navy} strokeWidth={2.6} {...round} />
          <path d="M13 -32 q6 -3 12 1" fill="none" stroke={C.navy} strokeWidth={2.6} {...round} />
        </>
      );
    default:
      return null;
  }
};

const Stroke: React.FC<{d: string; w?: number}> = ({d, w = 2.6}) => (
  <path d={d} fill="none" stroke={C.navy} strokeWidth={w} {...round} />
);

const MouthLayer: React.FC<{mouth: Mouth; open: number}> = ({mouth, open}) => {
  switch (mouth) {
    case 'golf':
      return <Stroke d="M-12 14 l4 -4 l4 4 l4 -4 l4 4 l4 -4" w={2.4} />;
    case 'grimas':
      return (
        <>
          <rect x={-10} y={10} width={20} height={8} rx={3.5} fill={C.white} stroke={C.navy} strokeWidth={2.4} />
          <Stroke d="M-10 14 h20" w={1.6} />
        </>
      );
    case 'zucht':
      return <Stroke d="M-6 15 q6 2.5 12 0" />;
    case 'zelfvoldaan':
      return <Stroke d="M-9 12 q9 7 17 -3" />;
    case 'praat': {
      // open is 0..1: van dicht (glimlach) naar volledig open
      if (open < 0.25) return <Stroke d="M-7 13 q7 5 14 0" />;
      const ry = 2.5 + 4 * open;
      return (
        <>
          <ellipse cx={0} cy={15} rx={5.5} ry={ry} fill={C.navy} />
          <ellipse cx={0} cy={15 + ry * 0.55} rx={3.2} ry={Math.min(2.2, ry * 0.35)} fill={C.cheek} />
        </>
      );
    }
    case 'lach':
      return (
        <>
          <path d="M-10 11 h20 a10 9 0 0 1 -20 0z" fill={C.navy} stroke={C.navy} strokeWidth={1.5} strokeLinejoin="round" />
          <ellipse cx={0} cy={17} rx={5} ry={2.6} fill={C.cheek} />
        </>
      );
    case 'scheef':
      return <Stroke d="M-11 14 q6 2 11 -1.5" />;
    default:
      return <Stroke d="M-7 12 q7 6 14 0" />;
  }
};

const Shard: React.FC<{x: number; y: number; rot: number; s?: number}> = ({x, y, rot, s = 1}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    <path d="M0 -6 L4 -1 L2 6 L-3 5 L-4 -2Z" fill={C.ice} stroke={C.navy} strokeWidth={1.4} strokeLinejoin="round" />
  </g>
);

const Puff: React.FC<{cx: number; cy: number}> = ({cx, cy}) => {
  const circles: [number, number, number][] = [
    [cx, cy, 6],
    [cx + 8, cy - 3, 7],
    [cx + 15, cy + 2, 5.5],
    [cx + 7, cy + 4, 5.5],
  ];
  return (
    <>
      {circles.map(([x, y, r], i) => (
        <circle key={`o${i}`} cx={x} cy={y} r={r} fill={C.white} stroke={C.navy} strokeWidth={2.6} />
      ))}
      {circles.map(([x, y, r], i) => (
        <circle key={`f${i}`} cx={x} cy={y} r={r} fill={C.white} />
      ))}
    </>
  );
};

const PropsLayer: React.FC<{props: Prop[]; since: number; frame: number; pop: number}> = ({props, since, frame, pop}) => (
  <>
    {props.includes('zweet') && (
      // de druppel loopt langzaam omlaag en begint opnieuw
      <g transform={`translate(0 ${((since % 45) / 45) * 18})`} opacity={interpolate(since % 45, [0, 5, 38, 45], [0, 1, 1, 0])}>
        <path d="M50 -44q8 12 0 16q-8 -4 0 -16z" fill={C.drop} stroke={C.navy} strokeWidth={1.5} />
      </g>
    )}
    {props.includes('ijs') && (
      <g opacity={pop} transform={`scale(${0.6 + 0.4 * pop})`}>
        <Shard x={-68} y={-28} rot={20} />
        <Shard x={-58} y={-52} rot={-15} s={0.9} />
        <Shard x={68} y={-36} rot={-25} />
        <Shard x={64} y={-8} rot={30} s={0.9} />
        <Shard x={-70} y={2} rot={5} s={0.8} />
      </g>
    )}
    {props.includes('ster') && (
      <g transform={`translate(64 -50) scale(${pop * (1 + 0.08 * Math.sin(frame / 5))}) rotate(${since * 2})`}>
        <path
          d="M0 -11 Q2 -2 11 0 Q2 2 0 11 Q-2 2 -11 0 Q-2 -2 0 -11Z"
          fill={C.star}
          stroke={C.navy}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </g>
    )}
    {props.includes('zucht') && (
      <g opacity={interpolate(since, [0, 6, 30, 45], [0, 1, 1, 0], {extrapolateRight: 'clamp'})} transform={`translate(${since * 0.4} ${-since * 0.15})`}>
        <Puff cx={15} cy={27} />
      </g>
    )}
  </>
);

// ------------------------------------------------------------------ Ehm
export type EhmProps = {
  expression: Expression;
  /** breedte en hoogte in pixels */
  size: number;
  /** absoluut frame, voor ademen en knipperen */
  frame: number;
  /** frames sinds de laatste wissel van expressie */
  since?: number;
  /** spiegelen (kijkt naar links) */
  flip?: boolean;
  /** kijkrichting van de ogen, -1 (links) tot 1 (rechts), in beeld */
  look?: number;
  /** mondopening 0..1 bij 'praten', gestuurd door de stem; zonder: vanzelf open en dicht */
  mouthOpen?: number;
};

export const Ehm: React.FC<EhmProps> = ({expression, size, frame, since = 999, flip = false, look = 0, mouthOpen}) => {
  const {fps} = useVideoConfig();
  const e = EXPRESSIONS[expression];

  // ademen: klein en langzaam, nooit zo veel dat de vorm verandert
  const breathe = Math.sin(frame / 14) * 0.012;
  // plop bij een nieuwe expressie
  const pop = spring({frame: since, fps, config: {damping: 11, stiffness: 160, mass: 0.6}});
  const squashY = e.squash ? 1 - 0.05 * pop : 1;
  const squashX = e.squash ? 1 + 0.04 * pop : 1;
  const bounce = interpolate(pop, [0, 1], [0.94, 1]);
  // knipperen: elke ~3,3 s vier frames dicht
  const blink = frame % 100 >= 96;
  // praten: mond open en dicht
  const open = expression === 'praten' ? (mouthOpen ?? (Math.sin(since / 2.2) + 1) / 2) : 0;
  // zwaaien
  const wave = expression === 'zwaaien' ? Math.sin(since / 4) * 14 : expression === 'praten' ? Math.sin(since / 6) * 8 : 0;
  // bevroren trilt heel even
  const shiver = expression === 'bevroren' && since < 18 ? Math.sin(since * 2.4) * 1.2 : 0;

  return (
    <svg width={size} height={size} viewBox="-100 -100 200 200" style={{overflow: 'visible'}}>
      <g
        transform={`translate(${shiver} 0) scale(${(flip ? -1 : 1) * bounce * squashX} ${bounce * (1 + breathe) * squashY})`}
      >
        <g id="arms-back">
          <ArmsBack arms={e.arms} wave={wave} />
        </g>
        <g id="body">
          <Body />
        </g>
        <g id="eyes" transform={`translate(${(flip ? -1 : 1) * look * 5} 0)`}>
          <EyesLayer eyes={e.eyes} blink={blink} />
        </g>
        <g id="brows">
          <BrowsLayer brows={e.brows} />
        </g>
        <g id="mouth">
          <MouthLayer mouth={e.mouth} open={open} />
        </g>
        <g id="arms-front">{e.arms === 'kin' && <Arm d="M50 26 Q50 12 33 16" />}</g>
        <g id="props">
          <PropsLayer props={e.props} since={since} frame={frame} pop={pop} />
        </g>
      </g>
    </svg>
  );
};
