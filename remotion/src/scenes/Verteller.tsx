/**
 * De verteller (vorm video_verteller): een stem vraagt "Do you ever freeze up when …?", je ziet het moment zelf, Ehm
 * bevriest en zijn hoofd loopt vol, dan "Here's what to say instead." en Ehm zegt de zinnen die werken. Eén gesprek,
 * één verloop, zelfde stripstijl als Ehm tegen Ehm (decor en klanknabootsingen komen uit Duel.tsx).
 *
 * Tijden uit scripts/verteller.py (afgeleid van hoe lang de stem echt praat); scripts/geluid.py (verteller_soundtrack)
 * leest dezelfde data.
 */
import React from 'react';
import {AbsoluteFill, Easing, Html5Audio, staticFile, useCurrentFrame} from 'remotion';
import {Ehm, Expression} from '../ehm/Ehm';
import type {Setting} from './Escalatie';
import {Cast, CastExpression, Outfit, Role} from '../ehm/Cast';
import {C, FIELD, Pillar} from '../ehm/colors';
import {FONT_BODY, FONT_HEAD} from '../fonts';
import {hop, lin, noise, spr} from '../anim/anim';
import {Burst, SceneSet, SET, SpeedLines} from './Duel';

type Spoken = {text: string; at: number; end: number; until: number};
export type VertellerLine = Spoken & {who: 'ehm' | Role; tone?: 'yes'};
export type VertellerData = {
  kind: 'verteller'; slug: string; pillar: Pillar; caption: string; hook: string; setting: Setting; cast: Role; outfit?: Outfit;
  narration: (Spoken & {part: 'hook' | 'scene' | 'panic' | 'turn' | 'cta'})[]; lines: VertellerLine[];
  scene: number; panic: number; turn: number; good: number; celebrate: number; cta: number; total: number;
  badge: string; sticker: string; voice?: string;
};
export type VertellerProps = {data: VertellerData; audio?: string};

const RECT = {x: 24, y: 390, w: 1032, h: 1110};
const ZOOM = 1.3;
const IN_W = 1000;
const IN_H = Math.round(RECT.h / ZOOM);
const outline = (px: number) => ({WebkitTextStroke: `${px}px ${C.ink}`, paintOrder: 'stroke fill' as const});
const onTwos = (f: number) => Math.floor(f / 2) * 2;

/** Hoeveel van de tekst al gezegd is: woorden verschijnen naar hun lengte, over de tijd dat de stem praat. */
function revealed(s: Spoken, t: number): number {
  const words = s.text.split(' ');
  const total = words.reduce((a, w) => a + w.length + 1, 0);
  const k = lin(t, s.at, s.end) * total;
  let acc = 0;
  let n = 0;
  for (const w of words) {
    if (acc >= k) break;
    acc += w.length + 1;
    n++;
  }
  return n;
}
const Words: React.FC<{s: Spoken; t: number}> = ({s, t}) => {
  const n = revealed(s, t);
  return (
    <>
      {s.text.split(' ').map((w, i) => (
        <span key={i} style={{opacity: i < n ? 1 : 0.18, marginRight: '0.25em', display: 'inline-block'}}>{w}</span>
      ))}
    </>
  );
};

/** Mond open of dicht terwijl de stem praat. */
const talk = (l: Spoken | undefined, t: number) =>
  l && t >= l.at && t <= l.end ? 0.35 + 0.65 * Math.abs(Math.sin((t - l.at) * 0.85 + noise(t / 6, 3))) : null;

// ------------------------------------------------------------------ ballon in het decor
const Balloon: React.FC<{l: VertellerLine; t: number; side: 'left' | 'right'}> = ({l, t, side}) => {
  if (t < l.at - 1 || t > l.until + 4) return null;
  const pop = Math.min(spr(t, l.at - 1, {damping: 10, stiffness: 300, mass: 0.5}), 1.04);
  const leave = t > l.until ? lin(t, l.until, l.until + 4, 1, 0) : 1;
  const bg = l.tone === 'yes' ? C.yesSoft : C.white;
  const ink = l.tone === 'yes' ? C.yesInk : C.ink;
  return (
    <div style={{position: 'absolute', top: Math.max(24, IN_H - 610), [side]: 135, maxWidth: 480, transform: `scale(${pop * leave})`,
                 transformOrigin: side === 'left' ? '20% 120%' : '80% 120%'}}>
      <div style={{background: bg, border: `6px solid ${C.ink}`, borderRadius: 22, padding: '18px 26px', fontFamily: FONT_HEAD, fontWeight: 600,
                   fontSize: 46, lineHeight: 1.1, color: ink, boxShadow: `6px 6px 0 ${C.ink}`}}>
        <Words s={l} t={t} />
      </div>
      <svg width={70} height={56} style={{position: 'absolute', top: '100%', marginTop: -7, [side]: 70}}>
        <path d={side === 'left' ? 'M6 0 L40 0 L14 50 Z' : 'M64 0 L30 0 L56 50 Z'} fill={bg} stroke={C.ink} strokeWidth={6} strokeLinejoin="round" />
        <rect x={side === 'left' ? 9 : 27} y={0} width={34} height={9} fill={bg} />
      </svg>
    </div>
  );
};

/** Tollende gedachten rond Ehm: krabbels, vraagtekens, een kluwen. */
const Spiral: React.FC<{t: number; k: number; cx: number; cy: number}> = ({t, k, cx, cy}) => {
  if (k <= 0) return null;
  const marks = ['?', '!', '…', '?!', '??', 'uh'];
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: IN_W, height: IN_H, opacity: k}}>
      <svg width={IN_W} height={IN_H} style={{position: 'absolute'}}>
        {[0, 1, 2].map((i) => {
          const r = 150 + i * 46 + Math.sin(t / 5 + i) * 10;
          const a0 = t / (9 - i * 2) + i;
          const pts = Array.from({length: 40}).map((_, j) => {
            const a = a0 + (j / 40) * Math.PI * 2.6;
            const rr = r * (0.55 + 0.45 * (j / 40));
            return `${cx + Math.cos(a) * rr},${cy - 140 + Math.sin(a) * rr * 0.55}`;
          }).join(' ');
          return <polyline key={i} points={pts} fill="none" stroke={C.ink} strokeWidth={6 - i} strokeLinecap="round" opacity={0.55} />;
        })}
      </svg>
      {marks.map((m, i) => {
        const a = t / 7 + (i / marks.length) * Math.PI * 2;
        const x = cx + Math.cos(a) * 230;
        const y = cy - 170 + Math.sin(a) * 120;
        return (
          <div key={i} style={{position: 'absolute', left: x - 40, top: y - 40, width: 80, textAlign: 'center', fontFamily: FONT_HEAD, fontWeight: 700,
                               fontSize: 64, color: '#E5484D', ...outline(10), transform: `rotate(${Math.sin(t / 4 + i) * 18}deg)`}}>{m}</div>
        );
      })}
    </div>
  );
};

// ------------------------------------------------------------------ het decor met de twee personages
const Scene: React.FC<{d: VertellerData; out: number}> = ({d, out}) => {
  const t = onTwos(out);
  const h = IN_H;
  const panicK = t >= d.panic && t < d.good ? Math.min(1, lin(t, d.panic, d.panic + 18)) : 0;
  const frozen = t >= d.turn && t < d.good;
  const others = d.lines.filter((l) => l.who !== 'ehm');
  const ehmLines = d.lines.filter((l) => l.who === 'ehm');
  const oLine = others.find((l) => t >= l.at && t <= l.end);
  const eLine = ehmLines.find((l) => t >= l.at && t <= l.end);
  const oTalk = frozen ? null : talk(oLine, t);
  const eTalk = frozen ? null : talk(eLine, t);

  let oExpr: CastExpression = 'neutraal';
  let oMood: CastExpression | undefined;
  if (oTalk !== null) { oExpr = 'praten'; oMood = t >= d.good ? (t >= d.celebrate - 40 ? 'opgelucht' : 'neutraal') : 'blij'; }
  else if (t >= d.celebrate) oExpr = 'blij';
  else if (t >= d.good) oExpr = 'verbaasd';
  else if (t >= d.panic) oExpr = 'ongeduldig';

  let eExpr: Expression = 'neutraal';
  let since = 999;
  if (eTalk !== null) { eExpr = 'praten'; since = t; }
  else if (t >= d.celebrate) { eExpr = 'trots'; since = t - d.celebrate; }
  else if (t >= d.good) { eExpr = 'trots'; since = t - d.good; }
  else if (t >= d.panic) { eExpr = 'bevroren'; since = t - d.panic; }
  else if (oLine) { eExpr = 'zenuwachtig'; since = t - oLine.at; }
  else eExpr = 'denken';

  const j1 = hop(t, d.celebrate + 6, 70, 12);
  const j2 = hop(t, d.celebrate + 24, 46, 11);
  const shiver = panicK > 0 ? noise(t * 1.4, 4) * 6 * panicK : 0;
  const shrink = 1 - 0.18 * panicK;
  const EH = 380;
  const lean = (oTalk !== null ? 6 : 2) + noise(t / 25, 1) * 3 + panicK * 6;
  const armR = t >= d.celebrate ? -130 : panicK > 0.3 ? -60 - Math.abs(Math.sin(t / 3)) * 30 : 0;

  return (
    <AbsoluteFill>
      <SceneSet setting={d.setting} h={h} mood={panicK * 0.9} />
      <SpeedLines cx={760} cy={h - 230} k={panicK > 0 ? 0.4 + 0.4 * panicK : t >= d.celebrate ? 0.7 : 0} seed={Math.floor(t / 4)} />
      <div style={{position: 'absolute', left: -60, top: h - 470}}>
        <Cast role={d.cast} outfit={d.outfit} expression={oExpr} mood={oMood} size={560} frame={frozen ? d.turn : t} lean={lean} armR={armR}
              armL={t >= d.celebrate ? -130 : 0} look={0.8} mouthOpen={oTalk ?? undefined} />
      </div>
      <div style={{position: 'absolute', left: 560 + shiver, top: h - 120 - EH * 0.76 + j1.y + j2.y,
                   transform: `scale(${shrink * j1.sx * j2.sx}, ${shrink * j1.sy * j2.sy})`, transformOrigin: '50% 76%'}}>
        <Ehm expression={eExpr} size={EH} frame={frozen ? d.turn : t} since={since} flip look={-1} mouthOpen={eTalk ?? undefined} />
      </div>
      <Spiral t={t} k={panicK * (frozen ? 0.5 : 1)} cx={750} cy={h - 230} />
      {d.lines.map((l, i) => <Balloon key={i} l={l} t={t} side={l.who === 'ehm' ? 'right' : 'left'} />)}
      {d.lines.filter((l) => l.who === 'ehm').map((l, i) => (
        <Burst key={i} text="NICE!" at={l.end + 2} t={t} x={800} y={h - 300 + i * 30} rot={i % 2 ? 8 : -9} color="#2FB37A" />
      ))}
      <Burst text="YAY!" at={d.celebrate + 6} t={t} x={700} y={h - 520} rot={-6} color={C.zon} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ de video
export const Verteller: React.FC<VertellerProps> = ({data: d, audio}) => {
  const out = useCurrentFrame();
  const step = onTwos(out);
  const boilSeed = Math.floor(out / 3) % 6;
  const hookN = d.narration.find((n) => n.part === 'hook')!;
  const sub = d.narration.find((n) => n.part !== 'hook' && out >= n.at - 2 && out <= n.until);

  // het decor komt binnen: van klein en gedraaid naar schermvullend
  const enter = out >= d.scene ? Math.min(1, spr(out, d.scene, {damping: 13, stiffness: 140, mass: 0.8})) : 0;
  // paniek: inzoomen op Ehm en een kloppend randje
  const zoom = out >= d.panic && out < d.good ? 1 + 0.08 * Easing.out(Easing.cubic)(lin(out, d.panic, d.turn)) : 1;
  const beat = out >= d.panic && out < d.turn ? Math.max(0, Math.sin((out - d.panic) / 30 * Math.PI * 2 * 1.6)) : 0;
  const frozen = out >= d.turn && out < d.good;

  return (
    <AbsoluteFill style={{background: C.paper, overflow: 'hidden'}}>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id="boil">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={boilSeed} />
          <feDisplacementMap in="SourceGraphic" scale={5} />
        </filter>
      </svg>
      <AbsoluteFill style={{backgroundImage: `radial-gradient(${FIELD[d.pillar]} 5px, transparent 5.5px)`, backgroundSize: '26px 26px', opacity: 0.9}} />

      <AbsoluteFill style={{filter: 'url(#boil)'}}>
        {/* 1. de vraag, groot, woord voor woord met de stem mee */}
        {out < d.scene + 12 && (() => {
          const o = out >= d.scene ? lin(out, d.scene, d.scene + 12, 1, 0) : 1;
          const ehmIn = spr(out, 4, {damping: 12, stiffness: 160});
          return (
            <>
              <div style={{position: 'absolute', left: 70, right: 70, top: 300, textAlign: 'center', opacity: o,
                           transform: `rotate(${-1.5 + (step % 4 === 0 ? 0.3 : 0)}deg) scale(${0.9 + 0.1 * spr(out, 0, {damping: 12})})`}}>
                <div style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: d.hook.length <= 60 ? 92 : 80, lineHeight: 1.08, color: C.zon,
                             ...outline(15), textShadow: `0 8px 0 ${C.ink}`}}>
                  <Words s={hookN} t={out} />
                </div>
              </div>
              <div style={{position: 'absolute', left: 540 - 260, top: 1020, opacity: o, transform: `scale(${ehmIn}) translateX(${noise(out / 3, 9) * 4}px)`,
                           transformOrigin: '50% 100%'}}>
                <Ehm expression="zenuwachtig" size={520} frame={step} since={step} />
              </div>
            </>
          );
        })()}

        {/* 2. de situatie: kop klein, het decor groot */}
        {out >= d.scene && (
          <>
            <div style={{position: 'absolute', left: 50, right: 50, top: 150, textAlign: 'center', opacity: out >= d.turn - 4 ? lin(out, d.turn - 4, d.turn + 4, 1, 0) : lin(out, d.scene, d.scene + 10)}}>
              <div style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 72, lineHeight: 1.05, color: C.zon, ...outline(14), textShadow: `0 7px 0 ${C.ink}`}}>{d.caption}</div>
            </div>
            <div style={{position: 'absolute', left: RECT.x, top: RECT.y, width: RECT.w, height: RECT.h,
                         transform: `scale(${0.6 + 0.4 * enter}) rotate(${(1 - enter) * -6}deg)`, opacity: Math.min(1, enter * 2)}}>
              <div style={{position: 'absolute', inset: 0, border: `10px solid ${beat > 0.5 ? '#E5484D' : C.ink}`, borderRadius: 18, overflow: 'hidden',
                           background: SET[d.setting].wall, boxShadow: `12px 12px 0 ${C.ink}`,
                           filter: frozen ? 'saturate(0.25) brightness(0.92)' : undefined}}>
                <div style={{position: 'absolute', left: RECT.w / 2 - (IN_W / 2) * ZOOM * zoom - 250 * ZOOM * (zoom - 1), top: RECT.h - IN_H * ZOOM * zoom,
                             width: IN_W, height: IN_H, transform: `scale(${ZOOM * zoom})`, transformOrigin: '0 0'}}>
                  <Scene d={d} out={frozen ? d.turn : out} />
                </div>
                {/* kloppend randje bij paniek */}
                <AbsoluteFill style={{boxShadow: `inset 0 0 ${80 + 120 * beat}px rgba(229,72,77,${0.55 * beat})`}} />
              </div>
            </div>
          </>
        )}

        {/* 3. pauze: zeg dit */}
        {out >= d.turn && out < d.celebrate + 20 && (() => {
          const k = Math.min(1.05, spr(out, d.turn, {damping: 10, stiffness: 240}));
          const toTop = out >= d.good - 6 ? Easing.inOut(Easing.cubic)(lin(out, d.good - 6, d.good + 8)) : 0;
          const o = out >= d.celebrate + 6 ? lin(out, d.celebrate + 6, d.celebrate + 20, 1, 0) : 1;
          return (
            <div style={{position: 'absolute', left: 0, right: 0, top: 860 - 690 * toTop, textAlign: 'center', opacity: o,
                         transform: `scale(${k * (1 - 0.3 * toTop)}) rotate(-3deg)`}}>
              <span style={{display: 'inline-block', background: C.zon, border: `10px solid ${C.ink}`, borderRadius: 28, padding: '14px 46px',
                            boxShadow: `10px 10px 0 ${C.ink}`, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 96, color: C.ink}}>Say this instead</span>
            </div>
          );
        })()}
      </AbsoluteFill>

      {/* ondertitels van de verteller, rustig leesbaar */}
      {sub && (
        <div style={{position: 'absolute', left: 60, right: 60, top: 1530, textAlign: 'center',
                     opacity: out > sub.until - 4 ? lin(out, sub.until - 4, sub.until, 1, 0) : lin(out, sub.at - 2, sub.at + 4)}}>
          <span style={{display: 'inline-block', background: C.ink, color: C.white, borderRadius: 18, padding: '14px 26px',
                        fontFamily: FONT_BODY, fontWeight: 800, fontSize: 46, lineHeight: 1.2}}>
            <Words s={sub} t={out} />
          </span>
        </div>
      )}

      {/* badge en oproep */}
      {out >= d.celebrate + 10 && (() => {
        const b = spr(out, d.celebrate + 10, {damping: 9, stiffness: 200});
        return (
          <div style={{position: 'absolute', left: 0, right: 0, top: 220, textAlign: 'center', transform: `scale(${b}) rotate(-3deg)`}}>
            <span style={{display: 'inline-block', background: C.yesSoft, color: C.yesInk, border: `8px solid ${C.ink}`, borderRadius: 999, padding: '14px 44px',
                          boxShadow: `8px 8px 0 ${C.ink}`, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 72}}>{d.badge}</span>
          </div>
        );
      })()}
      {out >= d.cta && (() => {
        const a = spr(out, d.cta, {damping: 10, stiffness: 220});
        return (
          <div style={{position: 'absolute', left: 80, right: 80, top: 330, textAlign: 'center', transform: `scale(${a})`}}>
            <span style={{display: 'inline-block', background: C.zon, border: `7px solid ${C.ink}`, borderRadius: 999, padding: '14px 32px', boxShadow: `7px 7px 0 ${C.ink}`,
                          fontFamily: FONT_BODY, fontWeight: 800, fontSize: 33, color: C.ink}}>{d.sticker}</span>
          </div>
        );
      })()}
      {audio && <Html5Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};
