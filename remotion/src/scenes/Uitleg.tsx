/**
 * Waarom het vastloopt (vorm "uitleg", Sami 24 nov): een echte stem vertelt, Ehm speelt het moment, en de ondertitels
 * lopen woord voor woord mee met de stem. Tijden uit scripts/uitleg.py (uit de opname zelf); het geluid
 * (scripts/geluid.py, uitleg_soundtrack) is de stem met een zacht bed eronder.
 */
import React from 'react';
import {Html5Audio, staticFile, useCurrentFrame} from 'remotion';
import type {Setting} from './Escalatie';
import type {CastExpression, Role} from '../ehm/Cast';
import type {Expression} from '../ehm/Ehm';
import {C, Pillar} from '../ehm/colors';
import {FONT_HEAD} from '../fonts';
import {lin, spr} from '../anim/anim';
import {Balloon, Header, onTwos, Paper, Stage, Sticker} from './Kort';

type Seg = {kind: 'hook' | 'not' | 'why' | 'good' | 'cta'; text: string; at: number; end: number};
type Word = {t: string; s: number; e: number; seg: number};
export type UitlegData = {
  kind: 'uitleg'; slug: string; pillar: Pillar; title: string; setting: Setting; cast: Role; trigger: string;
  wrong: string; badge: string; segments: Seg[]; words: Word[]; vo: string; total: number; sticker: string;
};
export type UitlegProps = {data: UitlegData; audio?: string};

const STAGE = {x: 24, y: 400, w: 1032, h: 1000};

/** Ondertitels: groepjes van hooguit 5 woorden binnen één segment, het woord dat klinkt in geel. */
function chunks(words: Word[]): Word[][] {
  const out: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (!next || next.seg !== w.seg || cur.length >= 5 || /[.,:?!]["”]?$/.test(w.t) && cur.length >= 2) { out.push(cur); cur = []; }
  });
  return out;
}

const Subs: React.FC<{d: UitlegData; out: number}> = ({d, out}) => {
  const groups = React.useMemo(() => chunks(d.words), [d.words]);
  const gi = groups.findIndex((g, i) => out >= g[0].s - 2 && out < (groups[i + 1]?.[0].s ?? g[g.length - 1].e + 12) - 2);
  if (gi < 0) return null;
  const g = groups[gi];
  // het woord dat nu klinkt: het laatste dat al begonnen is (zolang het nog niet lang voorbij is)
  const now = g.reduce((k, w, i) => (out >= w.s ? i : k), -1);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: 1470, textAlign: 'center'}}>
      <span style={{display: 'inline-block', background: C.ink, borderRadius: 20, padding: '16px 28px', fontFamily: FONT_HEAD, fontWeight: 700,
                    fontSize: 58, lineHeight: 1.15, color: C.white}}>
        {g.map((w, i) => (
          <span key={i} style={{color: i === now ? C.zon : C.white, marginRight: i < g.length - 1 ? '0.28em' : 0}}>{w.t}</span>
        ))}
      </span>
    </div>
  );
};

export const Uitleg: React.FC<UitlegProps> = ({data: d, audio}) => {
  const out = useCurrentFrame();
  const t = onTwos(out);
  const seg = [...d.segments].reverse().find((s) => out >= s.at - 3) ?? d.segments[0];
  const hook = d.segments[0];
  const goods = d.segments.filter((s) => s.kind === 'good');
  const lastGood = goods[goods.length - 1];
  const cta = d.segments[d.segments.length - 1];

  let ehmExpr: Expression = 'zenuwachtig';
  let castExpr: CastExpression = 'neutraal';
  if (seg.kind === 'not') { ehmExpr = 'bevroren'; castExpr = 'ongeduldig'; }
  else if (seg.kind === 'why') { ehmExpr = 'denken'; castExpr = out > lastGood.end ? 'blij' : 'neutraal'; }
  else if (seg.kind === 'good') { ehmExpr = out <= seg.end ? 'praten' : 'trots'; castExpr = 'neutraal'; }
  else if (seg.kind === 'cta') { ehmExpr = 'zwaaien'; castExpr = 'blij'; }
  // mond van Ehm gaat mee met de stem zolang hij een goede zin "zegt"
  const ehmMouth = seg.kind === 'good' && out <= seg.end ? 0.3 + 0.7 * Math.abs(Math.sin(out * 0.9)) : null;
  const triggerLine = {text: d.trigger, at: hook.at + 2, until: hook.end + 4};
  const castMouth = out >= triggerLine.at && out < triggerLine.at + 24 ? 0.3 + 0.7 * Math.abs(Math.sin(out * 0.8)) : null;
  if (castMouth !== null) castExpr = 'praten';

  const nots = d.segments.filter((s) => s.kind === 'not');
  const notSeg = nots.find((s) => out >= s.at - 3 && out < s.end + 20);
  const goodSeg = goods.find((s, i) => out >= s.at - 3 && out < (goods[i + 1]?.at ?? cta.at) - 3);

  return (
    <Paper pillar={d.pillar} frame={out}>
      <div style={{position: 'absolute', inset: 0, filter: 'url(#boil)'}}>
        <Header text={d.title} top={130} frame={out} />
        <Stage setting={d.setting} cast={d.cast} {...STAGE} t={t} castExpr={castExpr} castMouth={castMouth}
               ehmExpr={ehmExpr} ehmSince={t - seg.at} mood={seg.kind === 'not' ? 0.35 : 0}>
          <Balloon l={triggerLine} t={t} side="left" top={110} />
          {goodSeg && (
            <div style={{position: 'absolute', right: 140, top: 110, maxWidth: 500,
                         transform: `scale(${Math.min(1.04, spr(out, goodSeg.at - 3, {damping: 10, stiffness: 280}))})`, transformOrigin: '80% 120%'}}>
              <div style={{background: '#E8F8EF', border: `6px solid #2FB37A`, borderRadius: 24, padding: '18px 28px', fontFamily: FONT_HEAD,
                           fontWeight: 600, fontSize: 48, lineHeight: 1.12, color: C.ink, boxShadow: `6px 6px 0 ${C.ink}`}}>{goodSeg.text}</div>
            </div>
          )}
        </Stage>
        {/* niet dit: rood kaartje, doorgestreept */}
        {notSeg && (() => {
          const k = Math.min(1.05, spr(out, notSeg.at - 3, {damping: 10, stiffness: 260}));
          const cross = lin(out, notSeg.at + 8, notSeg.at + 16);
          return (
            <div style={{position: 'absolute', left: 70, right: 70, top: 1300, textAlign: 'center', transform: `scale(${k}) rotate(-3deg)`}}>
              <span style={{position: 'relative', display: 'inline-block', background: '#FFE3E3', border: '7px solid #E5484D', borderRadius: 22,
                            padding: '14px 30px', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 52, color: C.ink}}>
                ✕ “{d.wrong}”
                <span style={{position: 'absolute', left: 20, top: '50%', height: 9, width: `calc(${cross * 100}% - 40px)`, background: '#E5484D', borderRadius: 5}} />
              </span>
            </div>
          );
        })()}
        {goodSeg && (
          <div style={{position: 'absolute', left: 0, right: 0, top: 1300, textAlign: 'center',
                       transform: `scale(${Math.min(1.05, spr(out, goodSeg.at - 3, {damping: 10, stiffness: 260}))}) rotate(-3deg)`}}>
            <span style={{display: 'inline-block', background: '#2FB37A', color: C.white, border: `7px solid ${C.ink}`, borderRadius: 18,
                          padding: '6px 28px', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 56}}>✓ Say this</span>
          </div>
        )}
        {out >= lastGood.end + 4 && (
          <div style={{position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center',
                       transform: `scale(${spr(out, lastGood.end + 4, {damping: 9, stiffness: 200})}) rotate(-3deg)`}}>
            <span style={{display: 'inline-block', background: C.yesSoft, color: C.yesInk, border: `8px solid ${C.ink}`, borderRadius: 999,
                          padding: '10px 40px', boxShadow: `8px 8px 0 ${C.ink}`, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 60}}>{d.badge}</span>
          </div>
        )}
      </div>
      <Subs d={d} out={out} />
      <Sticker text={d.sticker} top={1680} at={cta.at} t={out} />
      {audio && <Html5Audio src={staticFile(audio)} />}
    </Paper>
  );
};
