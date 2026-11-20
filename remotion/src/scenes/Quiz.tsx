/**
 * Spelvorm "What do you say?". Een andere beeldtaal dan de escalatie: de ander praat recht in de camera (jij bent de
 * speler), de video is een spelshow met een draaiend zonnescherm, kaarten, een timer en een score, en de reacties
 * komen in harde snedes naar een close-up in plaats van één doorlopend shot.
 *
 * Volgorde: vraag → drie antwoorden schuiven in beeld → timer 3-2-1 → elk antwoord speelt zich af (Ehm zegt het,
 * snede naar de reactie, terug: kruis of vinkje) → het goede antwoord als laatste → Ehm vliegt uit zijn hoekje naar
 * het midden en viert het → oproep om je letter te reageren.
 *
 * Alle tijden komen uit scripts/quiz.py; scripts/geluid.py (quiz_soundtrack) leest dezelfde data.
 */
import React from 'react';
import {AbsoluteFill, Easing, Html5Audio, staticFile, useCurrentFrame} from 'remotion';
import {Ehm, Expression} from '../ehm/Ehm';
import {Cast, CastExpression, Outfit, Role} from '../ehm/Cast';
import {C, FIELD, FIELD_DEEP, Pillar} from '../ehm/colors';
import {FONT_BODY, FONT_HEAD} from '../fonts';
import {keys, lin, mouth, noise, speech, speechEnd, spr, hop, flinch} from '../anim/anim';

export type QuizOption = {letter: string; text: string; correct: boolean; reaction: string; mood: CastExpression; exit: boolean};
export type Reveal = {option: number; pick: number; sayAt: number; sayEnd: number; cutIn: number; reactAt: number; reactEnd: number;
  cutOut: number; stamp: number};
export type QuizData = {
  kind: 'quiz'; slug: string; pillar: Pillar; cast: Role; caption: string; outfit?: Outfit;
  prompt: {text: string; at: number; end: number};
  options: QuizOption[]; titleAt: number; cardsAt: number[]; timerAt: number; timerEnd: number; reveals: Reveal[];
  correct: number; celebrate: number; cta: number; total: number; badge: string; sticker: string;
};
export type QuizProps = {data: QuizData; audio?: string};

const LETTER_BG = ['#FF97B0', '#8DB6FF', '#FFD23F'];
const FACE = {x: 540, y: 900}; // midden van het gezicht in het brede shot
const PERSON = {size: 1150, top: 433};
const CLOSE = 2.25;

const outline = (px: number) => ({WebkitTextStroke: `${px}px ${C.ink}`, paintOrder: 'stroke fill' as const});

// ------------------------------------------------------------------ waar zijn we?
function active(d: QuizData, out: number): Reveal | null {
  let r: Reveal | null = null;
  for (const x of d.reveals) if (out >= x.pick) r = x;
  return r;
}
const stamped = (d: QuizData, i: number, out: number) => {
  const r = d.reveals.find((x) => x.option === i)!;
  return out >= r.stamp;
};

// ------------------------------------------------------------------ decor: spelshow
const Sunburst: React.FC<{out: number; pillar: Pillar}> = ({out, pillar}) => {
  const rays = 18;
  return (
    <svg width={2600} height={2600} viewBox="-1300 -1300 2600 2600"
         style={{position: 'absolute', left: FACE.x - 1300, top: FACE.y - 1300, transform: `rotate(${out * 0.25}deg)`}}>
      {Array.from({length: rays}).map((_, i) => {
        const a0 = (i / rays) * Math.PI * 2;
        const a1 = ((i + 0.5) / rays) * Math.PI * 2;
        return <path key={i} d={`M0 0 L${Math.cos(a0) * 1400} ${Math.sin(a0) * 1400} L${Math.cos(a1) * 1400} ${Math.sin(a1) * 1400} Z`}
                     fill={FIELD_DEEP[pillar]} opacity={0.55} />;
      })}
    </svg>
  );
};

const Sparkles: React.FC<{out: number}> = ({out}) => (
  <>
    {Array.from({length: 14}).map((_, i) => {
      const x = 80 + ((i * 397) % 920);
      const y = 140 + ((i * 263) % 900);
      const tw = Math.max(0, Math.sin(out / 9 + i * 1.7));
      const s = 18 + (i % 3) * 10;
      return (
        <svg key={i} width={s} height={s} viewBox="-12 -12 24 24"
             style={{position: 'absolute', left: x, top: y, opacity: tw, transform: `scale(${0.5 + tw * 0.6}) rotate(${out * 2 + i * 20}deg)`}}>
          <path d="M0 -11 Q2 -2 11 0 Q2 2 0 11 Q-2 2 -11 0 Q-2 -2 0 -11Z" fill={C.white} />
        </svg>
      );
    })}
  </>
);

/** De achterkant van de spelshow: vlak in de kleur van de pijler, zonnestralen, een lichtvlek achter het hoofd. */
const Stage: React.FC<{out: number; pillar: Pillar}> = ({out, pillar}) => (
  <AbsoluteFill style={{background: FIELD[pillar]}}>
    <Sunburst out={out} pillar={pillar} />
    <div style={{position: 'absolute', left: FACE.x - 520, top: FACE.y - 560, width: 1040, height: 1040, borderRadius: '50%',
                 background: `radial-gradient(circle, rgba(255,255,255,0.75), rgba(255,255,255,0) 68%)`}} />
    <Sparkles out={out} />
  </AbsoluteFill>
);

// ------------------------------------------------------------------ ballon van de ander
const Bubble: React.FC<{text: string; at: number; until: number; out: number; top: number; big?: boolean}> = ({text, at, until, out, top, big}) => {
  if (out < at - 1 || out > until + 5) return null;
  const words = speech(text, at);
  const pop = spr(out, at - 1, {damping: 10, stiffness: 260, mass: 0.5});
  const leave = out > until ? lin(out, until, until + 5, 1, 0) : 1;
  return (
    <div style={{position: 'absolute', left: 50, top, maxWidth: big ? 760 : 640, transform: `scale(${(0.3 + 0.7 * pop) * leave}) rotate(${(1 - pop) * -6}deg)`,
                 transformOrigin: '30% 120%'}}>
      <div style={{background: C.white, border: `7px solid ${C.ink}`, borderRadius: 46, padding: '28px 38px', boxShadow: `0 10px 0 ${C.ink}`,
                   fontFamily: FONT_HEAD, fontWeight: 600, fontSize: big ? 66 : 58, lineHeight: 1.12, color: C.ink}}>
        {words.map((w, i) => (
          <span key={i} style={{opacity: out >= w.s ? 1 : 0, display: 'inline-block', marginRight: i < words.length - 1 ? '0.26em' : 0,
                                transform: `translateY(${out >= w.s ? (1 - spr(out, w.s, {stiffness: 400, damping: 14})) * 10 : 0}px)`}}>
            {w.text}
          </span>
        ))}
      </div>
      <svg width={90} height={70} style={{position: 'absolute', top: '100%', marginTop: -8, left: 300}}>
        <path d="M8 0 L46 0 L60 62 Z" fill={C.white} stroke={C.ink} strokeWidth={7} strokeLinejoin="round" />
        <rect x={10} y={0} width={34} height={10} fill={C.white} />
      </svg>
    </div>
  );
};

// ------------------------------------------------------------------ antwoordkaarten
const Stamp: React.FC<{ok: boolean; at: number; out: number}> = ({ok, at, out}) => {
  if (out < at) return null;
  const s = Math.min(spr(out, at, {damping: 12, stiffness: 320, mass: 0.6}), 1.05);
  return (
    <div style={{position: 'absolute', right: -26, top: '50%', width: 118, height: 118, marginTop: -59, borderRadius: '50%',
                 background: ok ? '#2FB37A' : '#E5484D', border: `7px solid ${C.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                 transform: `scale(${3 - 2 * s}) rotate(${(1 - s) * -40 + (ok ? -6 : 8)}deg)`, opacity: Math.min(1, s * 1.4), boxShadow: `0 8px 0 ${C.ink}`}}>
      <svg width={64} height={64} viewBox="-32 -32 64 64">
        {ok ? <path d="M-20 2 L-6 16 L22 -16" fill="none" stroke={C.white} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
            : <path d="M-17 -17 L17 17 M17 -17 L-17 17" fill="none" stroke={C.white} strokeWidth={13} strokeLinecap="round" />}
      </svg>
    </div>
  );
};

const Card: React.FC<{d: QuizData; i: number; out: number}> = ({d, i, out}) => {
  const o = d.options[i];
  const r = d.reveals.find((x) => x.option === i)!;
  const cur = active(d, out);
  const enter = spr(out, d.cardsAt[i], {damping: 13, stiffness: 190, mass: 0.7});
  const picked = out >= r.pick && out < r.stamp;
  const done = out >= r.stamp;
  const someoneElse = cur && cur.option !== i && out < cur.stamp && out < d.celebrate;
  // wachten: zweven; gekozen: optillen; fout: schudden; goed: wiebelen; na afloop: de foute zakken weg
  const hover = out >= d.timerAt && out < d.timerEnd ? Math.sin(out / 8 + i * 2) * 4 : 0;
  const lift = picked ? spr(out, r.pick, {damping: 12, stiffness: 220}) : 0;
  const shakeX = done && !o.correct ? Math.exp(-(out - r.stamp) / 4) * Math.sin((out - r.stamp) * 2.2) * 18 : 0;
  const wiggle = done && o.correct ? Math.sin((out - r.stamp) / 3) * 3 * Math.exp(-(out - r.stamp) / 30) : 0;
  const sink = !o.correct && out >= d.celebrate ? lin(out, d.celebrate, d.celebrate + 12) : 0;
  const gone = !o.correct ? lin(out, d.cta - 10, d.cta, 1, 0) : 1;
  const toTop = o.correct ? spr(out, d.cta - 6, {damping: 13, stiffness: 160}) * -i * 168 : 0;
  const winner = o.correct && out >= d.celebrate ? spr(out, d.celebrate, {damping: 10, stiffness: 160}) : 0;
  const dim = someoneElse ? 0.45 : 1;
  const bg = done ? (o.correct ? C.yesSoft : C.noSoft) : C.white;
  const ink = done ? (o.correct ? C.yesInk : C.noInk) : C.ink;
  // karaoke: de woorden kleuren mee terwijl Ehm ze zegt
  const words = speech(o.text, r.sayAt);
  const strike = done && !o.correct ? lin(out, r.stamp + 2, r.stamp + 10) : 0;
  return (
    <div style={{position: 'relative', marginLeft: 60, width: 860, opacity: Math.min(1, enter * 1.5) * dim * (1 - sink * 0.6) * gone,
                 transform: `translate(${(1 - enter) * (i % 2 ? 300 : -300) + shakeX + lift * 14}px, ${(1 - enter) * 260 + hover - lift * 10 + sink * 30 + toTop}px)
                             rotate(${(1 - enter) * (i % 2 ? 8 : -8) + wiggle}deg) scale(${1 + lift * 0.05 + winner * 0.06 - sink * 0.08})`}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 26, background: bg, border: `7px solid ${C.ink}`, borderRadius: 34,
                   padding: '20px 112px 20px 20px', boxShadow: `0 ${10 + lift * 8}px 0 ${C.ink}`}}>
        <div style={{flex: '0 0 auto', width: 86, height: 86, borderRadius: '50%', background: LETTER_BG[i], border: `6px solid ${C.ink}`,
                     display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 52, color: C.ink}}>
          {o.letter}
        </div>
        <div style={{position: 'relative', fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 43, lineHeight: 1.14, color: ink}}>
          {words.map((w, k) => {
            const lit = picked && out >= w.s;
            return (
              <span key={k} style={{background: lit ? FIELD_DEEP[d.pillar] : 'transparent', borderRadius: 8, boxShadow: lit ? `0 0 0 4px ${FIELD_DEEP[d.pillar]}` : 'none'}}>
                {w.text}{k < words.length - 1 ? ' ' : ''}
              </span>
            );
          })}
          {strike > 0 && <div style={{position: 'absolute', left: -6, top: '52%', width: `${strike * 104}%`, height: 7, borderRadius: 4, background: C.noInk}} />}
        </div>
      </div>
      <Stamp ok={o.correct} at={r.stamp} out={out} />
    </div>
  );
};

// ------------------------------------------------------------------ titel en timer
const Title: React.FC<{d: QuizData; out: number}> = ({d, out}) => {
  if (out < d.titleAt || out >= d.cta) return null;
  const s = Math.min(spr(out, d.titleAt, {damping: 11, stiffness: 300, mass: 0.6}), 1.06);
  const left = Math.max(0, d.timerEnd - out) / 30;
  const n = Math.ceil(left);
  const ticking = out >= d.timerAt && out < d.timerEnd;
  const beatPop = ticking ? 1 + 0.25 * Math.exp(-((out - d.timerAt) % 30) / 5) : 1;
  const ring = ticking ? (d.timerEnd - out) / 90 : out < d.timerAt ? 1 : 0;
  const hot = ticking && n <= 1;
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: 1000, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
      <div style={{transform: `scale(${3 - 2 * s}) rotate(${(1 - s) * 10 - 3}deg)`, transformOrigin: '30% 50%', opacity: Math.min(1, s * 2),
                   fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 92, color: C.zon, ...outline(16), textShadow: `0 9px 0 ${C.ink}`, whiteSpace: 'nowrap'}}>
        What do you say?
      </div>
      {out >= d.cardsAt[2] && out < d.timerEnd + 16 && (
        <div style={{position: 'relative', width: 128, height: 128, transform: `scale(${spr(out, d.cardsAt[2], {damping: 10}) * beatPop * lin(out, d.timerEnd + 8, d.timerEnd + 16, 1, 0)}) rotate(${hot ? noise(out, 3) * 8 : 0}deg)`}}>
          <svg width={128} height={128} viewBox="-64 -64 128 128" style={{position: 'absolute'}}>
            <circle r={56} fill={hot ? '#FFE1DA' : C.white} stroke={C.ink} strokeWidth={7} />
            <circle r={44} fill="none" stroke={hot ? '#E5484D' : C.zon} strokeWidth={16} strokeDasharray={`${ring * 276.5} 276.5`}
                    transform="rotate(-90)" strokeLinecap="round" />
          </svg>
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 60, color: hot ? '#E5484D' : C.ink}}>
            {out < d.timerAt ? 3 : ticking ? n : '!'}
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ score en speler (Ehm)
const Score: React.FC<{d: QuizData; out: number}> = ({d, out}) => {
  const r = d.reveals[d.reveals.length - 1];
  const got = out >= r.stamp;
  const flip = got ? spr(out, r.stamp + 4, {damping: 9, stiffness: 260}) : 0;
  return (
    <div style={{position: 'absolute', left: 60, top: 150, display: 'flex', alignItems: 'center', gap: 12, background: C.ink, borderRadius: 999,
                 padding: '12px 30px 12px 18px', transform: `scale(${1 + 0.25 * Math.sin(Math.min(1, flip) * Math.PI)})`}}>
      <svg width={46} height={46} viewBox="-12 -12 24 24"><path d="M0 -11 Q2 -2 11 0 Q2 2 0 11 Q-2 2 -11 0 Q-2 -2 0 -11Z" fill={C.zon} /></svg>
      <span style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 46, color: C.white}}>{got ? 1 : 0} / 1</span>
    </div>
  );
};

const Heart: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="-12 -12 24 24">
    <path d="M0 9 C-14 -1 -7 -12 0 -5 C7 -12 14 -1 0 9Z" fill={color} stroke={C.ink} strokeWidth={2} strokeLinejoin="round" />
  </svg>
);

/** Ehm als speler: in een rond venster rechtsboven, aan het eind vliegt hij naar het midden. */
const Player: React.FC<{d: QuizData; out: number}> = ({d, out}) => {
  const cur = active(d, out);
  let expr: Expression = 'neutraal';
  let since = 999;
  let talk: number | undefined;
  if (out < d.timerAt) expr = out >= d.prompt.end ? 'denken' : 'neutraal';
  else if (out < d.timerEnd) { expr = 'zenuwachtig'; since = out - d.timerAt; }
  if (cur) {
    const o = d.options[cur.option];
    const m = mouth(speech(o.text, cur.sayAt), out);
    if (out >= cur.sayAt && out <= cur.sayEnd + 2) { expr = 'praten'; talk = m; since = out - cur.sayAt; }
    else if (out < cur.sayAt) { expr = 'zenuwachtig'; since = out - cur.pick; }
    else if (out < cur.stamp) { expr = o.correct ? 'denken' : 'zenuwachtig'; since = out - cur.sayEnd; }
    else if (!o.correct) { expr = 'bevroren'; since = out - cur.stamp; }
    else { expr = 'trots'; since = out - cur.stamp; }
  }
  if (out >= d.celebrate + 30) { expr = 'trots'; since = out - d.celebrate - 30; }
  // naar het midden vliegen bij het vieren
  const fly = spr(out, d.celebrate + 8, {damping: 13, stiffness: 120, mass: 0.9});
  const cx = 880 + (540 - 880) * fly;
  const cy = 300 + (690 - 300) * fly - Math.sin(Math.min(1, fly) * Math.PI) * 140;
  const scale = 1 + 1.25 * fly;
  const ring = 1 - Math.min(1, fly * 1.6);
  const j1 = hop(out, d.celebrate + 34, 60, 12);
  const j2 = hop(out, d.celebrate + 52, 44, 11);
  const nervous = expr === 'zenuwachtig' ? noise(out * 1.4, 2) * 3 : 0;
  const frozenShake = expr === 'bevroren' && since < 14 ? Math.sin(since * 2.6) * 8 * (1 - since / 14) : 0;
  const fl = cur && out >= cur.stamp && !d.options[cur.option].correct ? flinch(out, cur.stamp, 0.12) : {sx: 1, sy: 1};
  const pop = spr(out, 4, {damping: 10});
  return (
    <div style={{position: 'absolute', left: cx - 135, top: cy - 135, width: 270, height: 270, transform: `scale(${scale * pop})`}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: FIELD[d.pillar], border: `8px solid ${C.ink}`, opacity: ring,
                   boxShadow: `0 9px 0 ${C.ink}`}} />
      <div style={{position: 'absolute', inset: 8, borderRadius: '50%', overflow: fly > 0.05 ? 'visible' : 'hidden'}}>
        <div style={{position: 'absolute', left: -20 + nervous + frozenShake, top: 6 + j1.y + j2.y,
                     transform: `scale(${fl.sx * j1.sx * j2.sx}, ${fl.sy * j1.sy * j2.sy})`, transformOrigin: '50% 80%'}}>
          <Ehm expression={expr} size={300} frame={out} since={since} look={fly > 0.5 ? 0 : -0.6} mouthOpen={talk} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 70, right: 70, bottom: -26, textAlign: 'center', opacity: ring}}>
        <span style={{background: C.ink, color: C.white, borderRadius: 999, padding: '4px 18px', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 30}}>YOU</span>
      </div>
    </div>
  );
};

/** Hartjes, sterren en confetti uit de goede kaart, en de badge boven Ehm. */
const Celebration: React.FC<{d: QuizData; out: number}> = ({d, out}) => {
  const at = d.celebrate + 34;
  const confetti = Array.from({length: 26}).map((_, i) => {
    const t0 = d.reveals[d.reveals.length - 1].stamp;
    const dt = out - t0 - (i % 4);
    if (dt < 0 || dt > 60) return null;
    const ang = -Math.PI / 2 + noise(i, 4) * 1.3;
    const v = 34 + (i % 5) * 6;
    const x = 540 + Math.cos(ang) * v * dt * 0.9;
    const y = 1250 + Math.sin(ang) * v * dt + 0.9 * dt * dt;
    const col = [C.zon, '#FF97B0', '#8DB6FF', '#2FB37A', C.white][i % 5];
    return <div key={i} style={{position: 'absolute', left: x, top: y, width: 22, height: 34, background: col, border: `4px solid ${C.ink}`, borderRadius: 5,
                                transform: `rotate(${dt * (10 + i)}deg)`, opacity: lin(dt, 44, 60, 1, 0)}} />;
  });
  const hearts = out >= at && out < at + 70 ? Array.from({length: 8}).map((_, i) => {
    const ang = -Math.PI / 2 + (i - 3.5) * 0.42;
    const p = spr(out, at + (i % 3) * 2, {damping: 14, stiffness: 90});
    const r = 200 + 220 * p;
    const dd = out - at;
    return <div key={i} style={{position: 'absolute', left: 540 + Math.cos(ang) * r - 32, top: 690 + Math.sin(ang) * r * 0.8 - 32 - dd,
                                opacity: lin(dd, 34, 56, 1, 0)}}><Heart size={64} color={i % 2 ? '#FF8FAB' : C.cheek} /></div>;
  }) : null;
  const b = spr(out, at + 4, {damping: 9, stiffness: 200});
  return (
    <AbsoluteFill>
      {confetti}
      {hearts}
      {out >= at + 4 && (
        <div style={{position: 'absolute', left: 140, right: 140, top: 250 - lin(out, at + 4, at + 60, 0, 30), textAlign: 'center', transform: `scale(${b})`}}>
          <span style={{display: 'inline-block', background: C.yesSoft, color: C.yesInk, border: `7px solid ${C.ink}`, borderRadius: 999,
                        padding: '14px 40px', boxShadow: `0 8px 0 ${C.ink}`, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 66}}>
            {d.badge}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};

const Cta: React.FC<{d: QuizData; out: number}> = ({d, out}) => {
  if (out < d.cta) return null;
  const a = spr(out, d.cta, {damping: 11, stiffness: 220});
  const b = spr(out, d.cta + 12, {damping: 9, stiffness: 220});
  const letter = d.options[d.correct].letter;
  return (
    <>
      <div style={{position: 'absolute', left: 60, right: 60, top: 1010, textAlign: 'center', transform: `scale(${a}) rotate(${-2 + Math.sin(out / 10)}deg)`}}>
        <span style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 80, color: C.white, ...outline(14), textShadow: `0 8px 0 ${C.ink}`}}>
          Did you pick {letter}? Comment your letter!
        </span>
      </div>
      <div style={{position: 'absolute', left: 90, right: 90, top: 1380, textAlign: 'center', transform: `scale(${b})`}}>
        <span style={{display: 'inline-block', background: C.zon, border: `7px solid ${C.ink}`, borderRadius: 999, padding: '16px 34px',
                      boxShadow: `0 8px 0 ${C.ink}`, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 38, color: C.ink}}>
          {d.sticker}
        </span>
      </div>
    </>
  );
};

// ------------------------------------------------------------------ de scène
export const Quiz: React.FC<QuizProps> = ({data: d, audio}) => {
  const out = useCurrentFrame();
  const cur = active(d, out);
  const close = cur !== null && out >= cur.cutIn && out < cur.cutOut;
  const o = cur ? d.options[cur.option] : null;

  // ---- de ander
  let expr: CastExpression = 'neutraal';
  let mood: CastExpression | undefined;
  let talk: number | undefined;
  let armR = 0, armL = 0, look = 0, lean = 0, px = 0;
  const promptTalk = out >= d.prompt.at && out <= d.prompt.end + 2;
  if (promptTalk) { expr = 'praten'; talk = mouth(speech(d.prompt.text, d.prompt.at), out); mood = 'blij'; }
  else if (out < d.timerAt) expr = 'blij';
  else if (out < d.timerEnd) {
    const w = out - d.timerAt;
    expr = w < 60 ? 'neutraal' : 'ongeduldig';
    look = w < 60 ? noise(out / 10, 6) * 0.9 : 0.5;
    armR = w >= 50 ? -40 - Math.abs(Math.sin(out / 3)) * 18 : 0; // tikt met de vingers
  }
  if (cur && o) {
    if (out < cur.sayAt) expr = 'neutraal';
    else if (out < cur.cutIn) { expr = o.correct ? 'verbaasd' : 'neutraal'; lean = Math.sin(out / 6) * 2; }
    else if (out >= cur.reactAt && out <= cur.reactEnd + 2) { expr = 'praten'; mood = o.mood; talk = mouth(speech(o.reaction, cur.reactAt), out); }
    else if (out > cur.reactEnd) expr = o.mood;
    // weglopen: "I'll call security" en hij is weg tot het volgende antwoord
    const next = d.reveals[d.reveals.indexOf(cur) + 1];
    if (o.exit && out > cur.reactEnd) {
      const z = lin(out, cur.reactEnd + 4, cur.reactEnd + 16);
      px = 1300 * Easing.in(Easing.cubic)(z);
      lean = -14 * Math.min(1, z * 3);
      if (next && out >= next.pick - 12) px = 1300 * (1 - spr(out, next.pick - 12, {damping: 12, stiffness: 130}));
    }
  }
  if (out >= d.celebrate) {
    expr = out < d.celebrate + 30 ? 'lach' : 'blij';
    armR = armL = -120 - Math.sin(out / 3) * 20; // klapt met de armen omhoog
  }
  const sway = noise(out / 40, 1) * 2;
  const breathe = Math.sin(out / 20) * 4;

  // ---- camera: in het brede shot iets in- en uitduwen; in de close-up harde snede naar het gezicht
  const hand = {x: noise(out / 30, 11) * 5, y: noise(out / 34, 12) * 5};
  const push = keys(out, [[0, 1.0], [d.timerAt, 1.0], [d.timerEnd, 1.07], [d.timerEnd + 1, 1.0]]);
  const closeK = close && cur ? CLOSE + lin(out, cur.cutIn, cur.cutOut, 0, 0.08) : 1;
  const dutch = close && o && !o.correct ? 3 : 0;
  const scale = close ? closeK : push;
  const zoomOut = out >= d.celebrate ? 1 - 0.04 * spr(out, d.celebrate) : 1;

  // flits bij de snede naar de reactie
  const flash = close && cur ? lin(out, cur.cutIn, cur.cutIn + 8, 1, 0) : 0;

  return (
    <AbsoluteFill style={{background: FIELD[d.pillar], overflow: 'hidden'}}>
      <AbsoluteFill style={{transformOrigin: `${FACE.x}px ${close ? FACE.y - 30 : FACE.y - 60}px`,
                            transform: `translate(${hand.x}px, ${hand.y}px) rotate(${dutch}deg) scale(${scale * zoomOut})`}}>
        <Stage out={out} pillar={d.pillar} />
        <div style={{position: 'absolute', left: FACE.x - PERSON.size / 2 + px, top: PERSON.top + breathe}}>
          <Cast role={d.cast} outfit={d.outfit} expression={expr} mood={mood} size={PERSON.size} frame={out} lean={lean + sway} armR={armR} armL={armL}
                look={look} mouthOpen={talk} />
        </div>
      </AbsoluteFill>

      {/* close-up: rode of gouden rand */}
      {close && o && (
        <AbsoluteFill style={{boxShadow: `inset 0 0 ${180 + flash * 120}px ${o.correct ? 'rgba(255,210,63,0.75)' : 'rgba(229,72,77,0.55)'}`}} />
      )}
      {flash > 0 && <AbsoluteFill style={{background: `rgba(255,255,255,${flash * 0.7})`}} />}

      {/* in het brede shot: kaarten, titel, timer */}
      {!close && (
        <>
          <Title d={d} out={out} />
          <div style={{position: 'absolute', left: 0, right: 0, top: 1160, display: 'flex', flexDirection: 'column', gap: 20}}>
            {d.options.map((_, i) => (out >= d.cardsAt[i] - 1 ? <Card key={i} d={d} i={i} out={out} /> : <div key={i} style={{height: 0}} />))}
          </div>
        </>
      )}

      {/* ballonnen van de ander */}
      <Bubble text={d.prompt.text} at={d.prompt.at} until={d.timerAt - 4} out={out} top={300} />
      {cur && o && close && <Bubble text={o.reaction} at={cur.reactAt} until={cur.cutOut} out={out} top={200} big />}

      {/* bijschrift aan het begin */}
      {out < d.titleAt + 4 && (
        <div style={{position: 'absolute', left: 50, right: 330, top: 150, opacity: lin(out, d.titleAt - 6, d.titleAt + 4, 1, 0)}}>
          <span style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 62, lineHeight: 1.1, color: C.white, ...outline(12), textShadow: `0 6px 0 ${C.ink}`}}>{d.caption}</span>
        </div>
      )}
      {out >= d.titleAt + 4 && <Score d={d} out={out} />}
      <Player d={d} out={out} />
      {out >= d.reveals[d.reveals.length - 1].stamp && <Celebration d={d} out={out} />}
      <Cta d={d} out={out} />

      {audio && <Html5Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};

export const quizEnd = (d: QuizData) => speechEnd(speech(d.prompt.text, d.prompt.at));
