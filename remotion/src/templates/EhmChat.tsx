/**
 * Chatvideo 9:16 (1080 x 1920): hetzelfde gesprek twee keer, als chatbubbels.
 * Eerst zoals het vaak loopt ("niet dit", het gesprek valt stil), dan met de zinnen die werken.
 * Wat jij zegt, komt uit het script; alleen de ander heeft eigen tekst (zie PostInput.chat).
 *
 * Veilige zone zoals EhmVideo: tekst tussen y=230 en y=1450 en niet in de rechter 140 px (knoppen van TikTok,
 * Reels en Shorts). Ehm staat eronder en reageert: zenuwachtig, bevroren, praten, opgelucht, trots.
 *
 * Tijdlijn (30 fps, lengte hangt af van de berichten, zie chatTiming):
 *   0-66          de situatie als hook
 *   bad           "Zo loopt het vast": jouw "niet dit", het korte antwoord, dan stilte
 *   good          "Zo kan het ook": de zinnen uit het script en de antwoorden van de ander
 *   after         de afloop
 *   cta (90)      oproep, per platform anders (gelijk aan EhmVideo)
 */
import React from 'react';
import {AbsoluteFill, Html5Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ehm, Expression} from '../ehm/Ehm';
import {C, FIELD, FIELD_DEEP, STICKER} from '../ehm/colors';
import {COPY, ChatMsg, PostInput, chatText, ctaFor, ctaTitleFor} from '../data/situatie';
import {FONT_BODY, FONT_HEAD} from '../fonts';
import {Label, Sparkle} from './parts';

const FPS = 30;
const HOOK = 66;
const TYPING = 14; // "…" voor een bericht van de ander
const GAP = 12;
const SILENCE = 42; // na het laatste bericht van "niet dit": de stilte
const SWITCH = 14;
const AFTER = 54;
const CTA = 90;

/** Hoe lang een bericht in beeld moet staan om het te lezen: ±14 tekens per seconde, tussen 1,2 en 2,6 seconde. */
const leesduur = (tekst: string) => Math.min(78, Math.max(36, Math.round((tekst.length / 14) * FPS)));

export type ChatTiming = {
  bad: {from: number; typing: number}[];
  badEnd: number;
  good: {from: number; typing: number}[];
  goodStart: number;
  afterFrom: number;
  ctaFrom: number;
  total: number;
};

/** De tijdlijn van de berichten. Ook gebruikt door calculateMetadata in Root.tsx voor de lengte. */
export function chatTiming(p: PostInput): ChatTiming {
  const chat = p.chat ?? {bad: [], good: []};
  let t = HOOK;
  const plan = (msgs: ChatMsg[]) =>
    msgs.map((m) => {
      const typing = m.who === 'them' ? TYPING : 0;
      const from = t + typing;
      t = from + leesduur(chatText(p, m)) + GAP;
      return {from, typing};
    });
  const bad = plan(chat.bad);
  const badEnd = t + SILENCE;
  t = badEnd + SWITCH;
  const goodStart = t;
  const good = plan(chat.good);
  const afterFrom = t;
  const ctaFrom = afterFrom + AFTER;
  return {bad, badEnd, good, goodStart, afterFrom, ctaFrom, total: ctaFrom + CTA};
}

const pop = (frame: number, from: number, fps: number) =>
  frame < from ? 0 : spring({frame: frame - from, fps, config: {damping: 13, stiffness: 170}});

const Typing: React.FC<{frame: number; from: number; to: number}> = ({frame, from, to}) => {
  if (frame < from || frame >= to) return null;
  const n = 1 + (Math.floor((frame - from) / 4) % 3);
  return (
    <div style={{alignSelf: 'flex-start', marginTop: 18}}>
      <div
        style={{
          background: C.card,
          border: `3px solid ${C.ink}`,
          borderRadius: 40,
          padding: '10px 30px',
          fontFamily: FONT_HEAD,
          fontWeight: 700,
          fontSize: 48,
          color: C.muted,
          letterSpacing: 6,
        }}
      >
        {'•'.repeat(n)}
      </div>
    </div>
  );
};

type Soort = 'them' | 'not' | 'yes';

const Bubble: React.FC<{soort: Soort; text: string; s: number; struck: number; glinster?: boolean}> = ({soort, text, s, struck, glinster}) => {
  const jij = soort !== 'them';
  const bg = soort === 'them' ? C.card : soort === 'not' ? C.noSoft : C.yesSoft;
  const ink = soort === 'not' ? C.noInk : C.ink;
  return (
    <div
      style={{
        alignSelf: jij ? 'flex-end' : 'flex-start',
        marginTop: 18,
        maxWidth: 700,
        opacity: s,
        transform: `translateY(${(1 - s) * 30}px) scale(${0.9 + 0.1 * s})`,
        transformOrigin: jij ? '100% 100%' : '0% 100%',
        position: 'relative',
      }}
    >
      <div
        style={{
          background: bg,
          border: soort === 'them' ? `3px solid ${C.ink}` : STICKER.border,
          boxShadow: soort === 'yes' ? STICKER.shadow : 'none',
          borderRadius: 40,
          borderBottomLeftRadius: jij ? 40 : 10,
          borderBottomRightRadius: jij ? 10 : 40,
          padding: '20px 32px',
          fontFamily: soort === 'them' ? FONT_BODY : FONT_HEAD,
          fontWeight: soort === 'them' ? 700 : 600,
          fontSize: soort === 'them' ? 44 : 50,
          lineHeight: 1.22,
          color: ink,
          position: 'relative',
        }}
      >
        {text}
        {/* "niet dit" wordt doorgestreept zodra duidelijk is dat het gesprek stilvalt */}
        {soort === 'not' && struck > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 24,
              top: '50%',
              height: 6,
              width: `calc(${struck * 100}% - 48px)`,
              background: C.noInk,
              borderRadius: 3,
            }}
          />
        )}
      </div>
      {glinster && s > 0.9 && (
        <div style={{position: 'absolute', left: -20, top: -24}}>
          <Sparkle x={0} y={0} size={60} fill={C.zon} rotate={-8} />
        </div>
      )}
    </div>
  );
};

/**
 * Een rij berichten, van boven naar beneden zoals een nieuw gesprek. De database houdt het aantal en de lengte binnen
 * wat in beeld past (chat_invalid): hooguit 4 berichten bij "niet dit", 6 bij "zo kan het ook".
 */
const Chat: React.FC<{p: PostInput; msgs: ChatMsg[]; times: {from: number; typing: number}[]; frame: number; struckFrom?: number; laatsteGlinster?: boolean}> = ({
  p,
  msgs,
  times,
  frame,
  struckFrom,
  laatsteGlinster,
}) => {
  const {fps} = useVideoConfig();
  const struck = struckFrom === undefined ? 0 : interpolate(frame, [struckFrom, struckFrom + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const laatsteJij = msgs.map((m, i) => (m.who === 'you' ? i : -1)).filter((i) => i >= 0).pop();
  return (
    <div
      style={{
        position: 'absolute',
        top: 350,
        left: 80,
        width: 860,
        height: 1090,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        overflow: 'hidden',
      }}
    >
      {msgs.map((m, i) => {
        const {from, typing} = times[i];
        if (frame < from - typing) return null;
        if (frame < from) return <Typing key={i} frame={frame} from={from - typing} to={from} />;
        const soort: Soort = m.who === 'them' ? 'them' : 'not' in m ? 'not' : 'yes';
        return (
          <Bubble
            key={i}
            soort={soort}
            text={chatText(p, m)}
            s={pop(frame, from, fps)}
            struck={soort === 'not' ? struck : 0}
            glinster={laatsteGlinster && i === laatsteJij}
          />
        );
      })}
    </div>
  );
};

const Kop: React.FC<{kind: 'not' | 'yes'; text: string; s: number}> = ({kind, text, s}) => (
  <div style={{position: 'absolute', top: 250, left: 80, opacity: s, transform: `translateY(${(1 - s) * -20}px)`}}>
    <Label kind={kind} text={text} scale={1.25} />
  </div>
);

const SOUND = (from: number, file: string, volume = 1) => ({from, file, volume});

export const EhmChat: React.FC<PostInput> = (p) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = COPY[p.locale];
  const tl = chatTiming(p);
  const chat = p.chat ?? {bad: [], good: []};
  const field = FIELD[p.pillar] ?? FIELD.small_talk;
  const deep = FIELD_DEEP[p.pillar] ?? FIELD_DEEP.small_talk;
  const inCta = frame >= tl.ctaFrom;
  const boekEind = p.cta === 'book' && inCta;
  const badLast = tl.bad.length ? tl.bad[tl.bad.length - 1].from : HOOK;

  // Ehm reageert op wat er gebeurt
  const moments: {from: number; expression: Expression}[] = [
    {from: 0, expression: 'neutraal'},
    {from: HOOK, expression: 'zenuwachtig'},
    {from: badLast + 20, expression: 'bevroren'},
    {from: tl.goodStart, expression: 'praten'},
    {from: tl.afterFrom, expression: 'opgelucht'},
    {from: tl.ctaFrom, expression: 'trots'},
  ];
  const current = [...moments].reverse().find((m) => frame >= m.from)!;
  const since = frame - current.from;
  const enter = spring({frame, fps, config: {damping: 12, stiffness: 120}});

  const sounds = [
    ...tl.bad.map((b) => SOUND(b.from, 'praat-bubbels', 0.35)),
    SOUND(badLast + 20, 'stem/oei-2'),
    SOUND(badLast + 28, 'bevriezen', 0.45),
    ...tl.good.map((g) => SOUND(g.from, 'praat-bubbels', 0.35)),
    SOUND(tl.goodStart, 'stem/hmm-1'),
    SOUND(tl.afterFrom + 1, 'opgelucht', 0.6),
    SOUND(tl.ctaFrom + 1, 'stem/lach-eureka'),
    SOUND(tl.ctaFrom + 24, 'trots', 0.35),
  ];

  const fadeBad = interpolate(frame, [tl.badEnd, tl.badEnd + SWITCH], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: inCta ? C.ink : field, overflow: 'hidden'}}>
      {!inCta && (
        <div style={{position: 'absolute', left: 540, top: 1390, width: 900, height: 900, borderRadius: 450, background: deep}} />
      )}

      {/* hook */}
      {frame < HOOK + 10 && (
        <div style={{position: 'absolute', top: 260, left: 80, width: 860, opacity: interpolate(frame, [HOOK, HOOK + 10], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
          <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 40, color: C.muted}}>{t.whatToSay}</div>
          <div style={{marginTop: 18, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 92, lineHeight: 1.08, color: C.ink}}>{p.title}</div>
        </div>
      )}

      {/* zo loopt het vast */}
      {frame >= HOOK && frame < tl.badEnd + SWITCH && (
        <div style={{opacity: fadeBad}}>
          <Kop kind="not" text={t.howItGoes} s={pop(frame, HOOK, fps)} />
          <Chat p={p} msgs={chat.bad} times={tl.bad} frame={frame} struckFrom={badLast + 24} />
        </div>
      )}

      {/* zo kan het ook */}
      {frame >= tl.goodStart && !inCta && (
        <>
          <Kop kind="yes" text={t.howItCanGo} s={pop(frame, tl.goodStart, fps)} />
          <Chat p={p} msgs={chat.good} times={tl.good} frame={frame} laatsteGlinster={frame >= tl.afterFrom} />
        </>
      )}

      {/* de afloop, onder het gesprek */}
      {frame >= tl.afterFrom && !inCta && (
        <div
          style={{
            position: 'absolute',
            top: 1380,
            left: 80,
            width: 820,
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 46,
            color: C.yesInk,
            opacity: pop(frame, tl.afterFrom, fps),
          }}
        >
          {p.after}
        </div>
      )}

      {/* oproep */}
      {inCta && (
        <div style={{position: 'absolute', top: 260, left: 80, width: 840, opacity: pop(frame, tl.ctaFrom + 2, fps)}}>
          <div style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 96, color: C.paper}}>{ctaTitleFor(p)}</div>
          <div style={{marginTop: 26, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 54, lineHeight: 1.3, color: C.paper}}>{ctaFor(p).text}</div>
          <div style={{marginTop: 30, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 40, color: C.peach}}>{p.handle}</div>
        </div>
      )}
      {boekEind && (
        <div
          style={{
            position: 'absolute',
            left: 700,
            top: 760,
            width: 300,
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
      )}

      {/* Ehm: in de hook groot in beeld, tijdens het gesprek eronder, bij de oproep weer groot */}
      {(() => {
        const krimp = interpolate(frame, [HOOK - 6, HOOK + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const size = inCta ? 620 : 620 - 200 * krimp;
        const left = inCta ? (boekEind ? 40 : 230) : 540 - size / 2;
        const top = inCta ? 930 : 930 + 550 * krimp;
        return (
          <div style={{position: 'absolute', left, top, transform: `translateY(${(1 - enter) * 400}px)`}}>
            <Ehm expression={current.expression} size={size} frame={frame} since={since} />
          </div>
        );
      })()}

      {sounds.map((s, i) => (
        <Sequence key={`${s.file}-${i}`} from={s.from} layout="none">
          <Html5Audio src={staticFile(`sounds/${s.file}.wav`)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
