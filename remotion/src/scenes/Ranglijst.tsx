/**
 * De ranglijst (vorm video_ranglijst): "Ranking ways to …". Ehm houdt vijf kaartjes één voor één omhoog en legt ze in
 * een rij van S tot F; het laatste is S en is een zin uit het script. Aan het eind: "Wrong order? Fight me in the
 * comments." Tijden uit scripts/ranglijst.py; scripts/geluid.py (ranglijst_soundtrack) leest dezelfde data.
 */
import React from 'react';
import {Easing, Html5Audio, staticFile, useCurrentFrame} from 'remotion';
import {Ehm, Expression} from '../ehm/Ehm';
import {C, Pillar} from '../ehm/colors';
import {FONT_HEAD} from '../fonts';
import {hop, lin, noise, spr} from '../anim/anim';
import {Header, onTwos, outline, Paper, Shout, Sticker} from './Kort';

export type Tier = 'S' | 'A' | 'B' | 'C' | 'F';
export type RangItem = {text: string; tier: Tier; at: number; land: number; script?: boolean};
export type RanglijstData = {
  kind: 'ranglijst'; slug: string; pillar: Pillar; title: string; tiers: Tier[]; items: RangItem[];
  outro: number; total: number; ask: string; sticker: string;
};
export type RanglijstProps = {data: RanglijstData; audio?: string};

const COLOR: Record<Tier, string> = {S: '#FF7B7B', A: '#FFB27A', B: '#FFD23F', C: '#9FD8B8', F: '#B49CFF'};
const SHOUT: Record<Tier, [string, string]> = {
  S: ['S-TIER!', '#2FB37A'], A: ['Solid.', '#FFB27A'], B: ['Okay...', '#FFD23F'], C: ['Meh.', '#9FD8B8'], F: ['YIKES', '#E5484D'],
};
const FACE: Record<Tier, Expression> = {S: 'trots', A: 'opgelucht', B: 'neutraal', C: 'denken', F: 'bevroren'};

const BOARD = {x: 40, y: 330, w: 1000, row: 158, gap: 10, label: 150};
const HOLD = {x: 330, y: 1230, w: 710};          // waar Ehm het kaartje omhoog houdt
const rowY = (tiers: Tier[], tier: Tier) => BOARD.y + tiers.indexOf(tier) * (BOARD.row + BOARD.gap);

const Card: React.FC<{item: RangItem; x: number; y: number; w: number; size: number; rot?: number; scale?: number}> = ({item, x, y, w, size, rot = 0, scale = 1}) => {
  const good = item.script;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, transform: `rotate(${rot}deg) scale(${scale})`, transformOrigin: '50% 50%'}}>
      <div style={{background: good ? C.yesSoft : C.white, border: `7px solid ${C.ink}`, borderRadius: 20, padding: '14px 24px', boxShadow: `7px 7px 0 ${C.ink}`,
                   fontFamily: FONT_HEAD, fontWeight: 600, fontSize: size, lineHeight: 1.1, color: good ? C.yesInk : C.ink}}>{item.text}</div>
    </div>
  );
};

export const Ranglijst: React.FC<RanglijstProps> = ({data: d, audio}) => {
  const out = useCurrentFrame();
  const t = onTwos(out);
  const holding = d.items.find((it) => t >= it.at && t < it.land);
  const last = [...d.items].reverse().find((it) => t >= it.land);

  let ehmExpr: Expression = 'zwaaien';
  let since = t;
  if (t >= d.outro) { ehmExpr = 'zwaaien'; since = t - d.outro; }
  else if (holding) { ehmExpr = 'denken'; since = t - holding.at; }
  else if (last) { ehmExpr = FACE[last.tier]; since = t - last.land; }
  const j = last ? hop(t, last.land, last.tier === 'S' ? 70 : 34, 12) : {y: 0, sx: 1, sy: 1};

  return (
    <Paper pillar={d.pillar} frame={out}>
      <div style={{position: 'absolute', inset: 0, filter: 'url(#boil)'}}>
        <Header text={d.title} top={110} size={d.title.length <= 24 ? 84 : 72} frame={out} />

        {/* het bord */}
        {d.tiers.map((tier, k) => {
          const y = BOARD.y + k * (BOARD.row + BOARD.gap);
          const lit = last && last.tier === tier && t < last.land + 14;
          return (
            <React.Fragment key={tier}>
              <div style={{position: 'absolute', left: BOARD.x, top: y, width: BOARD.w, height: BOARD.row, borderRadius: 18,
                           background: lit ? '#FFF6D6' : 'rgba(255,255,255,0.75)', border: `6px solid ${C.ink}`}} />
              <div style={{position: 'absolute', left: BOARD.x, top: y, width: BOARD.label, height: BOARD.row, borderRadius: 18, background: COLOR[tier],
                           border: `6px solid ${C.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontWeight: 700,
                           fontSize: 96, color: C.white, ...outline(12)}}>{tier}</div>
            </React.Fragment>
          );
        })}

        {/* gelegde kaartjes */}
        {d.items.filter((it) => t >= it.land).map((it, k) => {
          const s = Math.min(1.06, spr(t, it.land, {damping: 9, stiffness: 300, mass: 0.5}));
          return (
            <Card key={k} item={it} x={BOARD.x + BOARD.label + 18} y={rowY(d.tiers, it.tier) + 14} w={BOARD.w - BOARD.label - 36}
                  size={it.text.length <= 34 ? 44 : 38} scale={1.25 - 0.25 * s} rot={noise(k, 7) * 1.5} />
          );
        })}

        {/* het kaartje in de hand, en de vlucht naar zijn rij */}
        {holding && (() => {
          const up = Math.min(1.05, spr(t, holding.at, {damping: 11, stiffness: 220}));
          const fly = Easing.inOut(Easing.cubic)(lin(t, holding.land - 10, holding.land));
          const ty = rowY(d.tiers, holding.tier) + 14;
          const x = HOLD.x + (BOARD.x + BOARD.label + 18 - HOLD.x) * fly;
          const y = HOLD.y + 40 * (1 - up) + (ty - HOLD.y) * fly;
          const w = HOLD.w + (BOARD.w - BOARD.label - 36 - HOLD.w) * fly;
          const size = 56 + ((holding.text.length <= 34 ? 44 : 38) - 56) * fly;
          return <Card item={holding} x={x} y={y} w={w} size={size} rot={-3 * (1 - fly) + noise(t / 8, 2) * (1 - fly)} scale={up} />;
        })()}

        {/* Ehm, linksonder */}
        <div style={{position: 'absolute', left: 20, top: 1250 + j.y, transform: `scale(${j.sx}, ${j.sy})`, transformOrigin: '50% 100%'}}>
          <Ehm expression={ehmExpr} size={300} frame={t} since={since} look={holding ? 1 : 0} />
        </div>
        {last && t < d.outro && (
          <Shout text={SHOUT[last.tier][0]} at={last.land + 2} t={t} x={last.tier === 'S' ? 700 : 760} y={1390} color={SHOUT[last.tier][1]}
                 rot={last.tier === 'F' ? 6 : -6} hold={last.tier === 'S' ? 44 : 16} size={last.tier === 'S' ? 72 : 58} />
        )}

        {/* oproep om te reageren */}
        {t >= d.outro && (() => {
          const a = Math.min(1.04, spr(t, d.outro, {damping: 10, stiffness: 220}));
          return (
            <div style={{position: 'absolute', left: HOLD.x - 10, width: HOLD.w + 20, top: 1240, textAlign: 'center', transform: `scale(${a}) rotate(-2deg)`}}>
              <div style={{display: 'inline-block', background: C.white, border: `8px solid ${C.ink}`, borderRadius: 24, padding: '18px 28px',
                           boxShadow: `9px 9px 0 ${C.ink}`, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 54, lineHeight: 1.08, color: C.ink}}>{d.ask}</div>
            </div>
          );
        })()}
      </div>
      <Sticker text={d.sticker} top={1440} left={HOLD.x - 20} at={d.outro + 4} t={out} />
      {audio && <Html5Audio src={staticFile(audio)} />}
    </Paper>
  );
};
