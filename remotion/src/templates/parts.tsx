/** Componenten uit de huisstijl: Label, NietDitZin, ZinKaart (stickerstijl), Handle. */
import React from 'react';
import {C, STICKER} from '../ehm/colors';
import {FONT_BODY, FONT_HEAD} from '../fonts';

/** Label boven een zin: ✕ Niet dit of ✓ Wel dit. Pil, geen rand. */
export const Label: React.FC<{kind: 'not' | 'yes'; text: string; scale?: number}> = ({kind, text, scale = 1}) => {
  const not = kind === 'not';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10 * scale,
        padding: `${8 * scale}px ${20 * scale}px`,
        borderRadius: 999,
        background: not ? C.noSoft : C.yesSoft,
        color: not ? C.noInk : C.yesInk,
        fontFamily: FONT_BODY,
        fontWeight: 800,
        fontSize: 26 * scale,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      <span style={{fontSize: 30 * scale, lineHeight: 1}}>{not ? '✕' : '✓'}</span>
      {text}
    </div>
  );
};

/** De zin die je niet moet zeggen: no-ink, doorgestreept, zonder kaart. */
export const NotThisLine: React.FC<{text: string; size: number}> = ({text, size}) => (
  <div
    style={{
      fontFamily: FONT_HEAD,
      fontWeight: 600,
      fontSize: size,
      lineHeight: 1.2,
      color: C.noInk,
      textDecoration: 'line-through',
      textDecorationThickness: Math.max(3, size * 0.07),
      textDecorationColor: C.noInk,
    }}
  >
    “{text}”
  </div>
);

/** De zin die wel werkt: ZinKaart in stickerstijl (card, rand en harde schaduw in ink). */
export const ButThisLine: React.FC<{text: string; size: number; glinster?: string}> = ({text, size, glinster}) => (
  <div
    style={{
      position: 'relative',
      display: 'inline-block',
      fontFamily: FONT_HEAD,
      fontWeight: 600,
      fontSize: size,
      lineHeight: 1.2,
      color: C.ink,
      background: C.card,
      border: STICKER.border,
      boxShadow: STICKER.shadow,
      borderRadius: STICKER.radiusCard,
      padding: `${Math.round(size * 0.38)}px ${Math.round(size * 0.5)}px`,
    }}
  >
    “{text}”
    {/* de goede zin glinstert: één groepje op de hoek rechtsboven, half over de rand */}
    {glinster && <Glinster x={-4} y={-6} fill={glinster} anchor="right" mirror />}
  </div>
);

/** Vierpuntige glinster met holle zijden, rand in ink: dezelfde lijn als Ehm en de kaarten. */
export const Sparkle: React.FC<{x: number; y: number; size: number; fill: string; rotate?: number; stroke?: string}> = ({
  x,
  y,
  size,
  fill,
  rotate = 0,
  stroke = C.ink,
}) => (
  <svg
    viewBox="0 0 100 100"
    style={{position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, overflow: 'visible', transform: `rotate(${rotate}deg)`}}
  >
    <path
      d="M50 0 C57 30 70 43 100 50 C70 57 57 70 50 100 C43 70 30 57 0 50 C30 43 43 30 50 0 Z"
      fill={fill}
      stroke={stroke}
      strokeWidth={(3.5 * 100) / size}
      strokeLinejoin="round"
    />
  </svg>
);

const Dot: React.FC<{x: number; y: number; size: number; fill: string}> = ({x, y, size, fill}) => (
  <div
    style={{
      position: 'absolute',
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      borderRadius: size,
      background: fill,
      border: `3.5px solid ${C.ink}`,
      boxSizing: 'border-box',
    }}
  />
);

/**
 * Eén glinstergroep: een grote en een kleine glinster en een stip. Nooit meer dan één groep per slide.
 * x/y is het midden van de grote glinster; met anchor="right" telt x vanaf de rechterkant van de ouder.
 * mirror spiegelt het groepje, zodat het altijd van de tekst of Ehm af wijst.
 */
export const Glinster: React.FC<{x: number; y: number; fill: string; scale?: number; mirror?: boolean; anchor?: 'left' | 'right'}> = ({
  x,
  y,
  fill,
  scale = 1,
  mirror = false,
  anchor = 'left',
}) => {
  const m = mirror ? -1 : 1;
  const box = 200 * scale;
  return (
    <div style={{position: 'absolute', [anchor]: x - box / 2, top: y - box / 2, width: box, height: box, pointerEvents: 'none'}}>
      <Sparkle x={box / 2} y={box / 2} size={88 * scale} fill={fill} rotate={8 * m} />
      <Sparkle x={box / 2 - 62 * scale * m} y={box / 2 + 64 * scale} size={42 * scale} fill={fill} rotate={-10 * m} />
      <Dot x={box / 2 + 56 * scale * m} y={box / 2 - 46 * scale} size={20 * scale} fill={fill} />
    </div>
  );
};

/**
 * Tekst met één gemarkeerd stuk: een markeerstreep in de diepere toon van het vlak achter het kernwoord.
 * Dat geeft één blikvanger per slide zonder een extra kleur.
 */
export const Marked: React.FC<{text: string; mark?: string; color: string; ink?: string; full?: boolean}> = ({text, mark, color, ink, full}) => {
  const i = mark ? text.indexOf(mark) : -1;
  if (!mark || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span
        style={{
          color: ink,
          // op een licht vlak een markeerstreep onder de helft; op ink een volle pil, anders valt de tekst weg
          background: full ? color : `linear-gradient(transparent 50%, ${color} 50%, ${color} 92%, transparent 92%)`,
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
          padding: full ? '0.02em 0.28em' : '0 0.12em',
          margin: full ? '0 0.04em' : '0 -0.06em',
          borderRadius: full ? '0.4em' : '0.12em',
        }}
      >
        {mark}
      </span>
      {text.slice(i + mark.length)}
    </>
  );
};

export const Handle: React.FC<{handle: string; color?: string}> = ({handle, color = C.ink}) => (
  <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30, color, opacity: 0.8}}>{handle}</div>
);
