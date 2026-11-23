/**
 * De POV-loop (vorm video_pov): de POV-regel staat er meteen, de ander zegt de aanleiding, Ehm reageert met één grap
 * die steeds erger wordt, en het einde knipt terug naar het begin. 8 seconden, Ehm zegt niets.
 * Tijden uit scripts/pov.py; scripts/geluid.py (pov_soundtrack) leest dezelfde data.
 */
import React from 'react';
import {Html5Audio, staticFile, useCurrentFrame, Easing} from 'remotion';
import type {Setting} from './Escalatie';
import type {Outfit, Role, CastExpression} from '../ehm/Cast';
import type {Expression} from '../ehm/Ehm';
import {C, Pillar} from '../ehm/colors';
import {lin, noise} from '../anim/anim';
import {Balloon, Header, innerHeight, onTwos, Paper, Shout, Stage, Sticker, talking} from './Kort';

export type PovData = {
  kind: 'pov'; slug: string; pillar: Pillar; pov: string; setting: Setting; cast: Role; outfit?: Outfit;
  gag: 'bevriezen' | 'krimpen' | 'zweten';
  line: {who: Role; text: string; at: number; end: number; until: number};
  react: number; total: number; sticker: string;
};
export type PovProps = {data: PovData; audio?: string};

const STAGE = {x: 24, y: 470, w: 1032, h: 1120};
const SHOUT: Record<PovData['gag'], string> = {
  bevriezen: '404: WORDS NOT FOUND',
  krimpen: "I'm fine. Totally fine.",
  zweten: '*nervous sweating*',
};

/** Zweetdruppels die van Ehm vallen, en een plas die groeit (binnen het vak, 1000 breed). */
const Sweat: React.FC<{t: number; from: number; ih: number}> = ({t, from, ih}) => {
  if (t < from) return null;
  const drops = [];
  for (let s = from; s <= t; s += 5) {
    const age = t - s;
    if (age > 22) continue;
    const side = noise(s, 3) > 0 ? 1 : -1;
    const x = 680 + side * (60 + 50 * Math.abs(noise(s, 5)));
    const y = ih - 430 + age * age * 0.9;
    drops.push(
      <svg key={s} width={34} height={48} style={{position: 'absolute', left: x, top: Math.min(y, ih - 140)}}>
        <path d="M17 2 C 8 18, 4 26, 4 32 A 13 13 0 0 0 30 32 C 30 26, 26 18, 17 2 Z" fill={C.drop} stroke={C.ink} strokeWidth={4} />
      </svg>,
    );
  }
  const k = Easing.out(Easing.cubic)(lin(t, from, from + 150));
  return (
    <>
      <div style={{position: 'absolute', left: 680 - 40 - 260 * k, top: ih - 150, width: 80 + 520 * k, height: 34 + 30 * k, borderRadius: '50%',
                   background: C.drop, border: `5px solid ${C.ink}`, opacity: k > 0 ? 1 : 0}} />
      {drops}
    </>
  );
};

/** IJsblok rond Ehm. */
const Ice: React.FC<{k: number; ih: number; t: number}> = ({k, ih, t}) => {
  if (k <= 0) return null;
  return (
    <div style={{position: 'absolute', left: 510, top: ih - 480 - 30 * (1 - k), width: 360, height: 380, borderRadius: 30,
                 background: `rgba(205,235,250,${0.6 * k})`, border: `7px solid rgba(31,42,68,${k})`, boxShadow: `inset 0 0 40px rgba(255,255,255,${0.9 * k})`}}>
      <div style={{position: 'absolute', left: 40, top: 40, width: 18, height: 120, borderRadius: 9, background: `rgba(255,255,255,${0.9 * k})`, transform: 'rotate(18deg)'}} />
      <div style={{position: 'absolute', left: 80, top: 50, width: 10, height: 70, borderRadius: 5, background: `rgba(255,255,255,${0.8 * k})`, transform: 'rotate(18deg)'}} />
      <svg width={360} height={380} style={{position: 'absolute', left: -7, top: -7, opacity: k > 0.9 ? 1 : 0}}>
        <path d={`M300 0 L270 ${60 + (t % 4)} L300 110 L250 170`} fill="none" stroke={C.ink} strokeWidth={4} />
      </svg>
    </div>
  );
};

export const Pov: React.FC<PovProps> = ({data: d, audio}) => {
  const out = useCurrentFrame();
  const t = onTwos(out);
  const ih = innerHeight(STAGE.w, STAGE.h);
  const r = d.react;
  const k = lin(t, r, r + 30);
  const mouth = talking(d.line, t);

  let castExpr: CastExpression = 'neutraal';
  let castMood: CastExpression | undefined;
  if (mouth !== null) { castExpr = 'praten'; castMood = 'blij'; }
  else if (t >= d.line.end) castExpr = t >= r + 50 ? 'ongeduldig' : 'blij';

  let ehmExpr: Expression = 'neutraal';
  let since = t;
  if (t >= r) { ehmExpr = d.gag === 'bevriezen' ? 'bevroren' : 'zenuwachtig'; since = t - r; }
  else if (t >= d.line.at + 6) { ehmExpr = 'zenuwachtig'; since = t - d.line.at - 6; }

  const shrink = d.gag === 'krimpen' ? 1 - 0.6 * Easing.out(Easing.cubic)(lin(t, r, r + 100)) : 1;
  const shiver = t >= r ? noise(t * 1.5, 4) * (d.gag === 'bevriezen' ? 3 : 6) * k : 0;
  // de ander buigt steeds verder naar voren: wachten op een antwoord dat niet komt
  const lean = 2 + (t >= d.line.end ? 12 * lin(t, d.line.end, d.total) : 0);

  return (
    <Paper pillar={d.pillar} frame={out}>
      <div style={{position: 'absolute', inset: 0, filter: 'url(#boil)'}}>
        <Header text={d.pov} top={120} frame={out} />
        <Stage setting={d.setting} cast={d.cast} outfit={d.outfit} {...STAGE} t={t}
               castExpr={castExpr} castMood={castMood} castMouth={mouth} castLean={lean}
               ehmExpr={ehmExpr} ehmSince={since} ehmScale={shrink} ehmX={shiver} ehmY={d.gag === 'krimpen' ? 0 : 0}
               mood={d.gag === 'bevriezen' ? 0 : 0.35 * k}
               tint={d.gag === 'bevriezen' ? `rgba(160,205,240,${0.3 * k})` : undefined}>
          {d.gag === 'bevriezen' && <Ice k={Easing.out(Easing.back(1.6))(lin(t, r + 4, r + 22))} ih={ih} t={t} />}
          {d.gag === 'zweten' && <Sweat t={t} from={r + 6} ih={ih} />}
          <Balloon l={d.line} t={t} side="left" top={110} />
        </Stage>
        <Shout text={SHOUT[d.gag]} at={r + 28} t={t} x={680} y={STAGE.y + 430}
               color={d.gag === 'bevriezen' ? '#7FC4E8' : d.gag === 'zweten' ? '#8DB6FF' : '#FF97B0'} rot={-5} hold={d.total} size={56} />
      </div>
      <Sticker text={d.sticker} top={350} at={r + 40} t={out} />
      {audio && <Html5Audio src={staticFile(audio)} />}
    </Paper>
  );
};
