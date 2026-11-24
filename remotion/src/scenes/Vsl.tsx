/**
 * De VSL (Sami 24 nov): ±25 s die uitlegt wat Ehm Club is, om vast te zetten op het Instagram-profiel.
 * Drie herkenbare momenten → "je hebt de volgende zin nodig" → één voorbeeld (fout, goed, reactie) → de gratis PDF en
 * het boek → de oproep. Tijden uit scripts/vsl.py; scripts/geluid.py (vsl_soundtrack) leest dezelfde data.
 */
import React from 'react';
import {Html5Audio, Img, staticFile, useCurrentFrame} from 'remotion';
import type {Setting} from './Escalatie';
import type {CastExpression, Role} from '../ehm/Cast';
import {Ehm, Expression} from '../ehm/Ehm';
import {C, Pillar} from '../ehm/colors';
import {FONT_BODY, FONT_HEAD} from '../fonts';
import {lin, noise, spr} from '../anim/anim';
import {Balloon, Header, onTwos, outline, Paper, Spoken, Stage, talking} from './Kort';
import {Burst} from './Duel';

type Said = Spoken & {end: number};
export type VslMoment = {head: string; slug: string; setting: Setting; cast: Role; start: number; ask: Said; ehm: Said};
export type VslData = {
  kind: 'vsl'; slug: string; pillar: Pillar; moments: VslMoment[];
  turn: number; turn2: number; turnText: string[];
  demo: {start: number; setting: Setting; cast: Role; ask: Said; wrong: string; nope: number; good: Said; twist: Said};
  offer: {title: string; chips: string[]; pdf: string; book: string; at: number; chipsAt: number[]};
  cta: number; total: number; sticker: string; link: string;
};
export type VslProps = {data: VslData; audio?: string};

const STAGE = {x: 24, y: 420, w: 1032, h: 1150};

/** Een moment: de ander vraagt iets, Ehm hapert. Komt binnen met een korte klap (inzoomen), geen stil beeld. */
const Moment: React.FC<{m: VslMoment; t: number; out: number}> = ({m, t, out}) => {
  const pop = Math.min(1, 0.92 + 0.08 * spr(out, m.start, {damping: 10, stiffness: 300}));
  const castMouth = talking(m.ask, t);
  const ehmMouth = talking(m.ehm, t);
  const castExpr: CastExpression = castMouth !== null ? 'praten' : t >= m.ehm.end ? 'frons' : 'neutraal';
  const ehmExpr: Expression = ehmMouth !== null ? 'zenuwachtig' : t >= m.ehm.end ? 'bevroren' : 'zenuwachtig';
  return (
    <div style={{position: 'absolute', inset: 0, transform: `scale(${pop})`}}>
      <Header text={m.head} top={150} frame={out} />
      <Stage setting={m.setting} cast={m.cast} {...STAGE} t={t} castExpr={castExpr} castMouth={castMouth}
             ehmExpr={ehmExpr} ehmSince={t - m.ask.at} ehmX={t >= m.ehm.end ? noise(t, 3) * 4 : 0} mood={0.25}>
        <Balloon l={m.ask} t={t} side="left" top={110} />
        <Balloon l={m.ehm} t={t} side="right" top={300} edge={140} maxWidth={460} />
      </Stage>
    </div>
  );
};

/** Het boek of de PDF als kaart met een label. */
const Cover: React.FC<{src: string; label: string; x: number; y: number; w: number; h: number; rot: number; at: number; out: number; tag: string}> = (
  {src, label, x, y, w, h, rot, at, out, tag}) => {
  if (out < at) return null;
  const s = Math.min(1.04, spr(out, at, {damping: 11, stiffness: 200}));
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, transform: `scale(${s}) rotate(${rot + Math.sin(out / 18) * 0.8}deg)`}}>
      <div style={{width: w, height: h, border: `8px solid ${C.ink}`, borderRadius: 18, overflow: 'hidden', boxShadow: `12px 12px 0 ${C.ink}`, background: C.white}}>
        <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top'}} />
      </div>
      <div style={{position: 'absolute', right: -24, top: -34, background: tag === 'FREE' ? '#2FB37A' : C.zon, color: tag === 'FREE' ? C.white : C.ink,
                   border: `6px solid ${C.ink}`, borderRadius: 14, padding: '4px 18px', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 46,
                   transform: 'rotate(8deg)'}}>{tag}</div>
      <div style={{marginTop: 26, textAlign: 'center', fontFamily: FONT_BODY, fontWeight: 900, fontSize: 40, color: C.ink}}>{label}</div>
    </div>
  );
};

export const Vsl: React.FC<VslProps> = ({data: d, audio}) => {
  const out = useCurrentFrame();
  const t = onTwos(out);
  const m = [...d.moments].reverse().find((x) => out >= x.start);
  const inMoments = out < d.turn;
  const inTurn = out >= d.turn && out < d.demo.start;
  const inDemo = out >= d.demo.start && out < d.offer.at;
  const inOffer = out >= d.offer.at;
  const D = d.demo;

  // demo: de ander, dan de foute zin met een kruis, dan de goede zin en de reactie
  const castMouth = talking(D.ask, t) ?? talking(D.twist, t);
  const demoCast: CastExpression = castMouth !== null ? (t >= D.twist.at ? 'lach' : 'praten') : t >= D.twist.end ? 'opgelucht' : 'neutraal';
  const ehmMouth = talking(D.good, t);
  const demoEhm: Expression = ehmMouth !== null ? 'praten' : t >= D.twist.at ? 'trots' : t >= D.ask.end ? 'denken' : 'neutraal';
  const wrongK = out >= D.nope ? Math.min(1.04, spr(out, D.nope, {damping: 10, stiffness: 260})) : 0;
  const cross = lin(out, D.nope + 10, D.nope + 18);
  const wrongOut = out >= D.good.at - 4 ? lin(out, D.good.at - 4, D.good.at + 4, 1, 0) : 1;

  return (
    <Paper pillar={d.pillar} frame={out}>
      <div style={{position: 'absolute', inset: 0, filter: 'url(#boil)'}}>
        {inMoments && m && <Moment m={m} t={t} out={out} />}

        {inTurn && (() => {
          const a = Math.min(1.05, spr(out, d.turn, {damping: 10, stiffness: 240}));
          const b = out >= d.turn2 ? Math.min(1.05, spr(out, d.turn2, {damping: 9, stiffness: 240})) : 0;
          return (
            <>
              <div style={{position: 'absolute', left: 70, right: 70, top: 330, textAlign: 'center', transform: `scale(${a}) rotate(-2deg)`}}>
                <span style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 86, lineHeight: 1.08, color: C.white, ...outline(14), textShadow: `0 8px 0 ${C.ink}`}}>
                  {d.turnText[0]}
                </span>
              </div>
              <div style={{position: 'absolute', left: 70, right: 70, top: 640, textAlign: 'center', transform: `scale(${b}) rotate(-2deg)`}}>
                <span style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 104, lineHeight: 1.05, color: C.zon, ...outline(16), textShadow: `0 9px 0 ${C.ink}`}}>
                  {d.turnText[1]}
                </span>
              </div>
              <div style={{position: 'absolute', left: 540 - 300, top: 1050}}>
                <Ehm expression={out >= d.turn2 ? 'trots' : 'denken'} size={600} frame={t} since={out >= d.turn2 ? t - d.turn2 : t - d.turn} />
              </div>
            </>
          );
        })()}

        {inDemo && (
          <>
            <Header text="Try this instead:" top={150} frame={out} />
            <Stage setting={D.setting} cast={D.cast} {...STAGE} t={t} castExpr={demoCast} castMouth={castMouth}
                   ehmExpr={demoEhm} ehmSince={t - D.ask.at}>
              <Balloon l={t >= D.twist.at - 1 ? D.twist : D.ask} t={t} side="left" top={110} />
              <Balloon l={D.good} t={t} side="right" top={330} edge={140} maxWidth={480} />
            </Stage>
            {/* de foute zin: kaartje met kruis, weg zodra de goede zin begint */}
            {wrongK > 0 && wrongOut > 0 && (
              <div style={{position: 'absolute', left: 80, right: 80, top: 1330, textAlign: 'center', transform: `scale(${wrongK}) rotate(-3deg)`, opacity: wrongOut}}>
                <span style={{position: 'relative', display: 'inline-block', background: '#FFE3E3', border: `7px solid #E5484D`, borderRadius: 22,
                              padding: '16px 34px', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 60, color: C.ink}}>
                  ✕ “{D.wrong}”
                  <span style={{position: 'absolute', left: 20, top: '50%', height: 10, width: `calc(${cross * 100}% - 40px)`, background: '#E5484D', borderRadius: 5}} />
                </span>
              </div>
            )}
            {out >= D.good.at && out < D.twist.at && (
              <div style={{position: 'absolute', left: 440, right: 0, top: 740, textAlign: 'center',
                           transform: `scale(${Math.min(1.05, spr(out, D.good.at, {damping: 10, stiffness: 260}))}) rotate(-3deg)`}}>
                <span style={{display: 'inline-block', background: '#2FB37A', color: C.white, border: `7px solid ${C.ink}`, borderRadius: 18,
                              padding: '8px 30px', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 64}}>✓ Say this</span>
              </div>
            )}
            <Burst text="NICE!" at={D.twist.end + 2} t={out} x={800} y={1200} rot={-6} color="#2FB37A" />
          </>
        )}

        {inOffer && (
          <>
            <Header text={d.offer.title} top={130} frame={out} />
            <Cover src="vsl/pdf-en.png" label={d.offer.pdf} x={90} y={330} w={400} h={566} rot={-5} at={d.offer.at + 6} out={out} tag="FREE" />
            <Cover src="boek/en.png" label={d.offer.book} x={590} y={330} w={400} h={566} rot={4} at={d.offer.at + 14} out={out} tag="$7.99" />
            {d.offer.chips.map((c, i) => {
              const at = d.offer.chipsAt[i];
              if (out < at) return null;
              const s = Math.min(1.05, spr(out, at, {damping: 10, stiffness: 260}));
              return (
                <div key={i} style={{position: 'absolute', left: 0, right: 0, top: 1040 + i * 112, textAlign: 'center', transform: `scale(${s}) rotate(${i % 2 ? 1.5 : -1.5}deg)`}}>
                  <span style={{display: 'inline-block', background: C.white, border: `6px solid ${C.ink}`, borderRadius: 999, padding: '12px 36px',
                                boxShadow: `6px 6px 0 ${C.ink}`, fontFamily: FONT_BODY, fontWeight: 900, fontSize: 44, color: C.ink}}>✓ {c}</span>
                </div>
              );
            })}
            <div style={{position: 'absolute', left: 60, top: 1560}}>
              <Ehm expression="zwaaien" size={300} frame={t} since={t - d.offer.at} />
            </div>
          </>
        )}
      </div>

      {/* oproep: 45 frames tot het einde */}
      {out >= d.cta && (
        <>
          <div style={{position: 'absolute', left: 300, right: 40, top: 1540, transform: `scale(${Math.min(1.06, spr(out, d.cta, {damping: 9, stiffness: 240}))})`}}>
            <span style={{display: 'inline-block', background: C.zon, border: `8px solid ${C.ink}`, borderRadius: 999, padding: '18px 40px',
                          boxShadow: `8px 8px 0 ${C.ink}`, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 54, color: C.ink}}>{d.sticker}</span>
          </div>
          <div style={{position: 'absolute', left: 300, right: 40, top: 1690, textAlign: 'center', opacity: lin(out, d.cta + 6, d.cta + 12),
                       fontFamily: FONT_BODY, fontWeight: 800, fontSize: 38, color: C.ink}}>{d.link}</div>
        </>
      )}
      {audio && <Html5Audio src={staticFile(audio)} />}
    </Paper>
  );
};
