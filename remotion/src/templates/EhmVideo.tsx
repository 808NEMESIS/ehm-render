/**
 * Video 9:16 (1080 x 1920), 15 seconden, zonder voice-over: tekst in beeld, Ehm en zijn geluidjes.
 * Ehm staat in de eerste seconde in beeld (onderzoek: personage vroeg en vaak tonen).
 * Alle tekst blijft binnen de veilige zone: niets onder y=1500 en niets in de rechter 140 px,
 * waar de knoppen van TikTok, Reels en Shorts zitten.
 *
 * Tijdlijn (30 fps):
 *   0-75     neutraal      de situatie als hook
 *   75-150   zenuwachtig   zweetdruppel, tekstballon "ehm..."
 *   150-225  bevroren      niet dit (koraal, doorgestreept)
 *   225-330  praten        wel dit (mint)
 *   330-380  opgelucht     de afloop
 *   380-450  trots         oproep, per platform anders
 */
import React from 'react';
import {AbsoluteFill, Html5Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ehm, Expression} from '../ehm/Ehm';
import {C, FIELD, STICKER} from '../ehm/colors';
import {COPY, PostInput, ctaFor, ctaTitleFor} from '../data/situatie';
import {FONT_BODY, FONT_HEAD} from '../fonts';
import {ButThisLine, Label, NotThisLine} from './parts';

export const VIDEO_FRAMES = 450;

const TIMELINE: {from: number; expression: Expression}[] = [
  {from: 0, expression: 'neutraal'},
  {from: 75, expression: 'zenuwachtig'},
  {from: 150, expression: 'bevroren'},
  {from: 225, expression: 'praten'},
  {from: 330, expression: 'opgelucht'},
  {from: 380, expression: 'trots'},
];

// Stemgeluiden: de takes die Sami op 14 oktober koos (sounds/stem, zie assets/ehm/stem/README.md).
// Effecten zonder stem: synthetisch (sounds/*.wav).
const SOUNDS: {from: number; file: string; volume?: number}[] = [
  {from: 78, file: 'zweetdruppel', volume: 0.6},
  {from: 92, file: 'stem/ehm-2'},
  {from: 150, file: 'stem/oei-2'},
  {from: 160, file: 'bevriezen', volume: 0.45},
  {from: 226, file: 'stem/hmm-1'},
  {from: 331, file: 'opgelucht', volume: 0.6},
  {from: 381, file: 'stem/lach-eureka'},
  {from: 404, file: 'trots', volume: 0.35},
];

/** Tekstblok dat binnen schuift en weer verdwijnt. */
const Appear: React.FC<{from: number; to?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  from,
  to = Infinity,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < from || frame >= to) return null;
  const s = spring({frame: frame - from, fps, config: {damping: 14, stiffness: 140}});
  const out = to === Infinity ? 1 : interpolate(frame, [to - 8, to], [1, 0], {extrapolateLeft: 'clamp'});
  return <div style={{...style, opacity: s * out, transform: `translateY(${(1 - s) * 40}px)`}}>{children}</div>;
};

/** Tekstballon "ehm..." met drie puntjes, gelijk met de tikjes in ehm-ballon.wav. */
const Bubble: React.FC<{from: number; to: number}> = ({from, to}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < from || frame >= to) return null;
  const local = frame - from;
  const pop = spring({frame: local, fps, config: {damping: 9, stiffness: 220}});
  const dots = [12, 24, 39].filter((d) => local >= d).length;
  return (
    <div
      style={{
        position: 'absolute',
        left: 610,
        top: 770,
        transform: `scale(${pop})`,
        transformOrigin: '10% 100%',
        background: C.card,
        border: STICKER.border,
        borderRadius: STICKER.radiusBubble,
        padding: '18px 36px',
        fontFamily: FONT_HEAD,
        fontWeight: 600,
        fontSize: 64,
        color: C.navy,
        minWidth: 200,
      }}
    >
      ehm{'.'.repeat(dots)}
      <div
        style={{
          position: 'absolute',
          left: 30,
          bottom: -26,
          width: 0,
          height: 0,
          borderLeft: '22px solid transparent',
          borderRight: '22px solid transparent',
          borderTop: `28px solid ${C.navy}`,
        }}
      />
    </div>
  );
};

export const EhmVideo: React.FC<PostInput> = (p) => {
  const frame = useCurrentFrame();
  const t = COPY[p.locale];
  const current = [...TIMELINE].reverse().find((s) => frame >= s.from)!;
  const since = frame - current.from;
  const ctaFrom = 380;
  const boekEind = p.cta === 'book' && frame >= ctaFrom;

  // Ehm komt in de eerste frames binnen en staat daarna stil op zijn plek
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 12, stiffness: 120}});

  return (
    <AbsoluteFill style={{background: frame >= ctaFrom ? C.ink : FIELD[p.pillar] ?? FIELD.small_talk}}>
      {/* tekst: de veilige zone begint op 230 px en blijft links van de knoppen */}
      <div style={{position: 'absolute', top: 230, left: 80, width: 840}}>
        <Appear from={3} to={150}>
          <div style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 80, lineHeight: 1.1, color: C.navy}}>{p.title}</div>
        </Appear>

        <Appear from={150} to={ctaFrom}>
          <Label kind="not" text={t.notThis} scale={1.1} />
          <div style={{marginTop: 22}}>
            <NotThisLine text={p.notThis} size={frame >= 225 ? 52 : 74} />
          </div>
        </Appear>

        <Appear from={226} to={ctaFrom} style={{marginTop: 46}}>
          <Label kind="yes" text={t.butThis} scale={1.1} />
          <div style={{marginTop: 22}}>
            <ButThisLine text={(p.scripts[p.hero ?? 0] ?? p.scripts[0]).text} size={72} />
          </div>
        </Appear>

        <Appear from={334} to={ctaFrom} style={{marginTop: 40}}>
          <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 46, color: C.yesInk}}>{p.after}</div>
        </Appear>

        <Appear from={ctaFrom + 2}>
          <div style={{fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 96, color: C.paper}}>{ctaTitleFor(p)}</div>
          <div
            style={{
              marginTop: 26,
              fontFamily: FONT_BODY,
              fontWeight: 800,
              fontSize: 54,
              lineHeight: 1.3,
              color: C.paper,
            }}
          >
            {ctaFor(p).text}
          </div>
          <div style={{marginTop: 30, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 40, color: C.peach}}>{p.handle}</div>
        </Appear>
      </div>

      {/* Bij het boek: de omslag rechts als sticker, Ehm schuift naar links */}
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

      {/* Ehm */}
      <div
        style={{
          position: 'absolute',
          left: boekEind ? 40 : 540 - 310,
          top: 930,
          transform: `translateY(${(1 - enter) * 500}px)`,
        }}
      >
        <Ehm expression={current.expression} size={620} frame={frame} since={since} />
      </div>

      <Bubble from={92} to={150} />

      {SOUNDS.map((s) => (
        <Sequence key={s.file} from={s.from} layout="none">
          <Html5Audio src={staticFile(`sounds/${s.file}.wav`)} volume={s.volume ?? 1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
