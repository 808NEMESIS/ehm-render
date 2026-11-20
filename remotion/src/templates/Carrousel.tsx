/**
 * Carrousel 4:5 (1080 x 1350). Eén frame = één slide, dus renderen met --sequence geeft de slides als PNG.
 * Opbouw: cover, niet dit, drie keer wel dit, slotslide op ink. Maximaal 25 woorden per slide.
 *
 * Sterker zonder te schreeuwen:
 *  - één vlak per post, met vormen in de diepere toon van datzelfde vlak (geen extra kleur);
 *  - die vormen lopen door over de rand naar de volgende slide, zodat je verder wilt swipen;
 *  - Ehm groot, staand op een vorm, in de expressie van het moment;
 *  - één markering per slide achter het kernwoord;
 *  - de zin-kaart ligt licht scheef, als een sticker.
 *
 * Sprankelend, niet schreeuwend:
 *  - helderdere vlakken met een diepere tweede toon;
 *  - één accent, zon: de swipe-pil, de oproep-pil en één glinstergroep;
 *  - glinsters alleen waar het goed gaat (cover, de drie goede zinnen, slotslide), nooit bij "niet dit".
 */
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {Ehm, Expression} from '../ehm/Ehm';
import {C, FIELD, FIELD_DEEP, INK_DEEP, STICKER, glinsterFill} from '../ehm/colors';
import {COPY, PostInput, ctaFor, ctaTitleFor} from '../data/situatie';
import {FONT_BODY, FONT_HEAD} from '../fonts';
import {ButThisLine, Glinster, Handle, Label, Marked, NotThisLine} from './parts';

export const CARROUSEL_SLIDES = 6;
const W = 1080;

/** Vormen op één doorlopende strook van 5 slides breed (de slotslide heeft een eigen vorm). */
type Shape = {x: number; y: number; w: number; h: number};
const TRACK: Shape[] = [
  {x: 560, y: 760, w: 840, h: 840}, // schijf onder Ehm op de cover, loopt door in slide 2
  {x: 1660, y: 1010, w: 900, h: 300}, // pil over de rand van slide 2 naar 3
  {x: 2960, y: 900, w: 620, h: 620}, // schijf op de rand van slide 3 naar 4
  {x: 3880, y: 1040, w: 820, h: 280}, // pil over de rand van slide 4 naar 5
  {x: 4980, y: 860, w: 700, h: 700}, // schijf rechtsonder op slide 5
];

const Shapes: React.FC<{slide: number; color: string}> = ({slide, color}) => (
  <>
    {TRACK.map((s, i) => {
      const left = s.x - slide * W;
      if (left > W || left + s.w < 0) return null;
      return (
        <div
          key={i}
          style={{position: 'absolute', left, top: s.y, width: s.w, height: s.h, borderRadius: Math.min(s.w, s.h) / 2, background: color}}
        />
      );
    })}
  </>
);

const Dots: React.FC<{index: number; dark?: boolean}> = ({index, dark}) => (
  <div style={{position: 'absolute', bottom: 48, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 14}}>
    {Array.from({length: CARROUSEL_SLIDES}).map((_, i) => (
      <div
        key={i}
        style={{
          width: i === index ? 34 : 12,
          height: 12,
          borderRadius: 6,
          background: dark ? C.paper : C.ink,
          opacity: i === index ? 0.9 : 0.25,
        }}
      />
    ))}
  </div>
);

const EhmAt: React.FC<{expression: Expression; size: number; x: number; bottom: number; flip?: boolean}> = ({
  expression,
  size,
  x,
  bottom,
  flip,
}) => (
  <div style={{position: 'absolute', left: x - size / 2, bottom}}>
    <Ehm expression={expression} size={size} frame={0} flip={flip} />
  </div>
);

const Content: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{position: 'absolute', left: 88, right: 88, top: 96}}>{children}</div>
);

export const Carrousel: React.FC<PostInput> = (p) => {
  const slide = useCurrentFrame();
  const t = COPY[p.locale];
  const field = FIELD[p.pillar] ?? FIELD.small_talk;
  const deep = FIELD_DEEP[p.pillar] ?? FIELD_DEEP.small_talk;
  const roleExpr: Expression[] = ['praten', 'denken', 'zwaaien'];
  const tilt = [-1.6, 1.2, -1.0];
  const zon = glinsterFill(p.pillar);

  if (slide === CARROUSEL_SLIDES - 1 && p.cta === 'book') {
    const cta = ctaFor(p);
    // Het boek als sticker: de omslag licht scheef, Ehm ernaast. Eén accent (zon) achter de titel van het boek.
    return (
      <AbsoluteFill style={{background: C.ink, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 520, top: 640, width: 760, height: 760, borderRadius: 380, background: INK_DEEP}} />
        <Content>
          <Handle handle={p.handle} color={C.peach} />
          <div style={{marginTop: 70, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 96, lineHeight: 1.05, color: C.paper}}>
            {ctaTitleFor(p)}
          </div>
          <div style={{marginTop: 28, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 46, lineHeight: 1.3, color: C.paper, maxWidth: 860}}>
            <Marked text={cta.text} mark={cta.mark} color={C.zon} ink={C.ink} full />
          </div>
        </Content>
        <div
          style={{
            position: 'absolute',
            left: 610,
            top: 590,
            width: 330,
            transform: 'rotate(4deg)',
            border: STICKER.border,
            boxShadow: STICKER.shadow,
            borderRadius: 18,
            overflow: 'hidden',
            lineHeight: 0,
          }}
        >
          <Img src={staticFile(`boek/${p.locale}.png`)} style={{width: '100%'}} />
        </div>
        <EhmAt expression="trots" size={460} x={330} bottom={70} />
        <Glinster x={560} y={620} fill={C.zon} scale={1.2} />
        <Dots index={CARROUSEL_SLIDES - 1} dark />
      </AbsoluteFill>
    );
  }

  if (slide === CARROUSEL_SLIDES - 1) {
    const cta = ctaFor(p);
    return (
      <AbsoluteFill style={{background: C.ink, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 420, top: 700, width: 820, height: 820, borderRadius: 410, background: INK_DEEP}} />
        <Content>
          <Handle handle={p.handle} color={C.peach} />
          <div style={{marginTop: 80, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 104, lineHeight: 1.05, color: C.paper}}>
            {t.ctaTitle}
          </div>
          <div style={{marginTop: 32, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 52, lineHeight: 1.3, color: C.paper, maxWidth: 820}}>
            <Marked text={cta.text} mark={cta.mark} color={C.zon} ink={C.ink} full />
          </div>
        </Content>
        <EhmAt expression="trots" size={600} x={800} bottom={60} />
        <Glinster x={510} y={800} fill={C.zon} scale={1.3} />
        <Dots index={CARROUSEL_SLIDES - 1} dark />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{background: field, overflow: 'hidden'}}>
      <Shapes slide={slide} color={deep} />

      {slide === 0 && (
        <>
          <Content>
            <Handle handle={p.handle} />
            <div style={{marginTop: 56, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 100, lineHeight: 1.04, color: C.ink, letterSpacing: -0.5}}>
              <Marked text={p.title} mark={p.highlight} color={deep} />
            </div>
            <div style={{marginTop: 34, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 46, color: C.noInk}}>{t.whatToSay}</div>
          </Content>
          <EhmAt expression="zenuwachtig" size={660} x={720} bottom={40} />
          <Glinster x={460} y={800} fill={zon} scale={1.3} />
          <div
            style={{
              position: 'absolute',
              left: 88,
              bottom: 120,
              background: zon,
              border: STICKER.border,
              boxShadow: STICKER.shadow,
              borderRadius: 999,
              padding: '12px 28px',
              fontFamily: FONT_BODY,
              fontWeight: 800,
              fontSize: 32,
              color: C.ink,
            }}
          >
            {t.swipe} →
          </div>
        </>
      )}

      {slide === 1 && (
        <>
          <Content>
            <Handle handle={p.handle} />
            <div style={{marginTop: 80}}>
              <Label kind="not" text={t.notThis} />
            </div>
            <div style={{marginTop: 40, maxWidth: 900}}>
              <NotThisLine text={p.notThis} size={96} />
            </div>
          </Content>
          <EhmAt expression="bevroren" size={560} x={430} bottom={70} />
        </>
      )}

      {slide >= 2 && slide <= 4 && (() => {
        const i = slide - 2;
        const s = p.scripts[i];
        return (
          <>
            <Content>
              <Handle handle={p.handle} />
              <div style={{marginTop: 80}}>
                <Label kind="yes" text={`${t.butThis} · ${i + 1}. ${s.role}`} />
              </div>
              <div style={{marginTop: 44, transform: `rotate(${tilt[i]}deg)`, transformOrigin: 'left center', maxWidth: 900}}>
                <ButThisLine text={s.text} size={s.text.length > 50 ? 66 : 80} glinster={zon} />
              </div>
            </Content>
            <EhmAt expression={roleExpr[i]} size={500} x={i === 1 ? 300 : 760} bottom={70} flip={i === 1} />
          </>
        );
      })()}

      <Dots index={slide} />
    </AbsoluteFill>
  );
};
