/**
 * De decoder (vorm video_decoder): "What they say vs. what they mean". De ander zegt drie bekende zinnen; na elke zin
 * klapt de vertaling eronder en reageert Ehm. Aan het eind: "Send this to someone who says …".
 * Tijden uit scripts/decoder.py; scripts/geluid.py (decoder_soundtrack) leest dezelfde data.
 */
import React from 'react';
import {Html5Audio, staticFile, useCurrentFrame} from 'remotion';
import type {Setting} from './Escalatie';
import type {Outfit, Role, CastExpression} from '../ehm/Cast';
import type {Expression} from '../ehm/Ehm';
import {C, Pillar} from '../ehm/colors';
import {FONT_BODY, FONT_HEAD} from '../fonts';
import {hop, lin, spr} from '../anim/anim';
import {Balloon, Header, onTwos, Paper, Stage, Sticker, talking} from './Kort';

export type DecoderPair = {say: string; mean: string; at: number; end: number; stamp: number; until: number};
export type DecoderData = {
  kind: 'decoder'; slug: string; pillar: Pillar; title: string; setting: Setting; cast: Role; outfit?: Outfit;
  pairs: DecoderPair[]; outro: number; total: number; send: string; sticker: string;
};
export type DecoderProps = {data: DecoderData; audio?: string};

const STAGE = {x: 24, y: 380, w: 1032, h: 950, zoom: 1.1};
const REACT: Expression[] = ['bevroren', 'zenuwachtig', 'denken'];

const Meaning: React.FC<{p: DecoderPair; t: number}> = ({p, t}) => {
  if (t < p.stamp || t > p.until + 5) return null;
  const s = Math.max(spr(t, p.stamp, {damping: 9, stiffness: 260, mass: 0.6}), 0.01);
  const slam = 1.35 - 0.35 * Math.min(1, s);
  const o = t > p.until ? lin(t, p.until, p.until + 5, 1, 0) : 1;
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: 1370, textAlign: 'center', opacity: o,
                 transform: `scale(${slam}) rotate(${-2.5 + (p.stamp % 2) * 4}deg)`}}>
      <div style={{display: 'inline-block', background: C.white, border: `9px solid ${C.ink}`, borderRadius: 26, padding: '18px 36px 24px',
                   boxShadow: `10px 10px 0 ${C.ink}`}}>
        <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 34, letterSpacing: 3, color: '#E5484D', marginBottom: 6}}>WHAT THEY MEAN</div>
        <div style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: p.mean.length <= 32 ? 74 : 62, lineHeight: 1.06, color: C.ink}}>{p.mean}</div>
      </div>
    </div>
  );
};

export const Decoder: React.FC<DecoderProps> = ({data: d, audio}) => {
  const out = useCurrentFrame();
  const t = onTwos(out);
  const i = Math.max(0, d.pairs.findIndex((p, j) => t < (d.pairs[j + 1]?.at ?? d.outro)));
  const cur = d.pairs[Math.min(i, d.pairs.length - 1)];
  const lines = d.pairs.map((p) => ({text: p.say, at: p.at, until: p.until}));
  const mouth = talking(lines.find((l) => t >= l.at && t <= l.until), t);

  let castExpr: CastExpression = 'neutraal';
  let castMood: CastExpression | undefined;
  if (mouth !== null) { castExpr = 'praten'; castMood = 'blij'; }
  else if (t >= d.outro) castExpr = 'verbaasd';
  else if (t >= cur.end) castExpr = 'blij';

  let ehmExpr: Expression = 'neutraal';
  let since = t;
  if (t >= d.outro) { ehmExpr = 'trots'; since = t - d.outro; }
  else if (t >= cur.stamp) { ehmExpr = REACT[i % REACT.length]; since = t - cur.stamp; }
  else if (t >= cur.at) { ehmExpr = 'denken'; since = t - cur.at; }
  const j = hop(t, cur.stamp, 40, 10);

  const outroK = t >= d.outro ? Math.min(1.04, spr(t, d.outro, {damping: 10, stiffness: 220})) : 0;
  return (
    <Paper pillar={d.pillar} frame={out}>
      <div style={{position: 'absolute', inset: 0, filter: 'url(#boil)'}}>
        <Header text={d.title} top={120} frame={out} />
        <Stage setting={d.setting} cast={d.cast} outfit={d.outfit} {...STAGE} t={t}
               castExpr={castExpr} castMood={castMood} castMouth={mouth}
               ehmExpr={ehmExpr} ehmSince={since} ehmY={j.y}>
          {lines.map((l, k) => <Balloon key={k} l={l} t={t} side="left" top={50} size={56} maxWidth={640} edge={80} />)}
        </Stage>
        {t < d.outro && (
          <div style={{position: 'absolute', right: 60, top: STAGE.y + 24, background: C.ink, color: C.white, borderRadius: 999, padding: '6px 22px',
                       fontFamily: FONT_BODY, fontWeight: 800, fontSize: 38}}>{Math.min(i, d.pairs.length - 1) + 1}/{d.pairs.length}</div>
        )}
        {d.pairs.map((p, k) => <Meaning key={k} p={p} t={t} />)}
        {t >= d.outro && (
          <div style={{position: 'absolute', left: 50, right: 50, top: 1370, textAlign: 'center', transform: `scale(${outroK}) rotate(-2deg)`}}>
            <div style={{display: 'inline-block', background: C.zon, border: `9px solid ${C.ink}`, borderRadius: 26, padding: '20px 34px',
                         boxShadow: `10px 10px 0 ${C.ink}`, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 58, lineHeight: 1.08, color: C.ink}}>{d.send}</div>
          </div>
        )}
      </div>
      <Sticker text={d.sticker} top={1590} at={d.outro + 12} t={out} />
      {audio && <Html5Audio src={staticFile(audio)} />}
    </Paper>
  );
};
