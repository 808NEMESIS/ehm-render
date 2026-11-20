/**
 * Storyboards voor de nieuwe vormen (escalatie + terugspoelen, en de quiz). Elk paneel is één stilstaand beeld op
 * 1080 x 1920, gemaakt met dezelfde onderdelen die de echte video's straks gebruiken (Ehm, Cast, decor, ballonnen).
 * Alleen om te kiezen; nog geen animatie, geen geluid.
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Ehm, Expression} from '../ehm/Ehm';
import {Cast, CastExpression, Role} from '../ehm/Cast';
import {C} from '../ehm/colors';
import {FONT_BODY, FONT_HEAD} from '../fonts';

const F = 40; // vast frame: ogen open, rustige adem

// ------------------------------------------------------------------ bouwstenen
/** Tekst zoals TikTok-ondertitels: wit, dikke donkere rand. Bovenin, binnen de veilige zone. */
const Caption: React.FC<{text: string; top?: number; size?: number}> = ({text, top = 210, size = 74}) => (
  <div style={{position: 'absolute', top, left: 70, right: 160, textAlign: 'center'}}>
    <span
      style={{
        fontFamily: FONT_HEAD, fontWeight: 700, fontSize: size, lineHeight: 1.12, color: C.white,
        WebkitTextStroke: `${size * 0.12}px ${C.ink}`, paintOrder: 'stroke fill', textShadow: `0 ${size * 0.08}px 0 ${C.ink}`,
      }}
    >
      {text}
    </span>
  </div>
);

/** Spraakballon met staartje naar links of rechts onder. */
const Bubble: React.FC<{text: string; x: number; y: number; w?: number; tail: 'left' | 'right'; tone?: 'plain' | 'not' | 'yes'; size?: number}> = ({
  text, x, y, w = 560, tail, tone = 'plain', size = 50,
}) => {
  const bg = tone === 'not' ? C.noSoft : tone === 'yes' ? C.yesSoft : C.white;
  const ink = tone === 'not' ? C.noInk : tone === 'yes' ? C.yesInk : C.ink;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w}}>
      <div
        style={{
          background: bg, border: `5px solid ${C.ink}`, borderRadius: 40, padding: '26px 34px',
          fontFamily: FONT_HEAD, fontWeight: 600, fontSize: size, lineHeight: 1.18, color: ink,
          boxShadow: `0 8px 0 ${C.ink}`,
        }}
      >
        {text}
      </div>
      <svg width={80} height={60} style={{position: 'absolute', top: '100%', marginTop: -6, [tail === 'left' ? 'left' : 'right']: 70}}>
        <path d={tail === 'left' ? 'M6 0 L40 0 L4 54 Z' : 'M74 0 L40 0 L76 54 Z'} fill={bg} stroke={C.ink} strokeWidth={5} strokeLinejoin="round" />
        <rect x={tail === 'left' ? 8 : 38} y={0} width={30} height={8} fill={bg} />
      </svg>
    </div>
  );
};

const Office: React.FC<{clock: string; papers?: number; zoom?: number}> = ({clock, papers = 0, zoom = 1}) => (
  <AbsoluteFill style={{background: '#D3C2FF', transform: `scale(${zoom})`, transformOrigin: '60% 70%'}}>
    {/* muur met plint en deurpost links */}
    <div style={{position: 'absolute', left: 0, top: 0, width: 300, height: 1600, background: '#BBA6F5', borderRight: `6px solid ${C.ink}`}} />
    <div style={{position: 'absolute', left: 0, right: 0, top: 1600, height: 320, background: '#A58CEB', borderTop: `6px solid ${C.ink}`}} />
    {/* klok */}
    <div style={{position: 'absolute', right: 170, top: 400, width: 190, height: 190, borderRadius: '50%', background: C.white, border: `7px solid ${C.ink}`,
                 display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 50, color: C.ink}}>
      {clock}
    </div>
    {/* bureau */}
    <div style={{position: 'absolute', left: 330, right: -20, top: 1560, height: 60, background: '#F4E3C3', border: `6px solid ${C.ink}`, borderRadius: 14}} />
    {/* laptop */}
    <div style={{position: 'absolute', left: 420, top: 1420, width: 250, height: 145, background: '#C9D3E6', border: `6px solid ${C.ink}`, borderRadius: 12}} />
    {/* geeltje */}
    <div style={{position: 'absolute', left: 700, top: 1455, width: 140, height: 100, background: C.zon, border: `5px solid ${C.ink}`, transform: 'rotate(-6deg)',
                 fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 30, color: C.noInk, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
      DUE<br />5 PM
    </div>
    {/* stapel papier */}
    {Array.from({length: papers}).map((_, i) => (
      <div key={i} style={{position: 'absolute', left: 600 + ((i * 37) % 3) * 8 - 8, top: 1540 - (i + 1) * 34, width: 300, height: 34, background: C.white,
                           border: `4px solid ${C.ink}`, borderRadius: 4, transform: `rotate(${((i * 53) % 7) - 3}deg)`}} />
    ))}
  </AbsoluteFill>
);

const Party: React.FC<{bunting?: boolean}> = ({bunting = true}) => (
  <AbsoluteFill style={{background: '#CBEB8C'}}>
    {/* slingers */}
    {bunting && <svg width={1080} height={420} style={{position: 'absolute', top: 470}}>
      <path d="M-20 40 Q540 220 1100 40" fill="none" stroke={C.ink} strokeWidth={5} />
      {Array.from({length: 9}).map((_, i) => {
        const x = 60 + i * 120;
        const y = 40 + Math.sin((i / 8) * Math.PI) * 120;
        const kleur = ['#FFD23F', '#F7A8C4', '#8FB3E8', '#FFFFFF'][i % 4];
        return <path key={i} d={`M${x - 30} ${y} L${x + 30} ${y} L${x} ${y + 60} Z`} fill={kleur} stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />;
      })}
    </svg>}
    <div style={{position: 'absolute', left: 0, right: 0, top: 1700, height: 220, background: '#A8DB63', borderTop: `6px solid ${C.ink}`}} />
  </AbsoluteFill>
);

/** Terugspoelen: scanlijnen, kleurverschuiving en het teken. */
const Rewind: React.FC = () => (
  <AbsoluteFill>
    <AbsoluteFill style={{background: 'repeating-linear-gradient(0deg, rgba(31,42,68,0.18) 0 6px, transparent 6px 14px)'}} />
    <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(255,0,80,0.14), rgba(0,200,255,0.14))', mixBlendMode: 'multiply'}} />
    <div style={{position: 'absolute', top: 760, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 240, color: C.white,
                 WebkitTextStroke: `34px ${C.ink}`, paintOrder: 'stroke fill'}}>◀◀</div>
  </AbsoluteFill>
);

/** Kleine sticker voor de PDF, tijdens de afloop. */
const Sticker: React.FC<{text: string}> = ({text}) => (
  <div style={{position: 'absolute', left: 90, top: 1560, background: C.zon, border: `5px solid ${C.ink}`, borderRadius: 999, padding: '18px 34px',
               fontFamily: FONT_BODY, fontWeight: 800, fontSize: 40, color: C.ink, transform: 'rotate(-3deg)', boxShadow: `0 6px 0 ${C.ink}`}}>
    {text}
  </div>
);

const Ice: React.FC = () => (
  <div style={{position: 'absolute', left: 520, top: 1090, width: 540, height: 480, borderRadius: 60, background: 'rgba(205,235,250,0.55)', border: `5px solid ${C.ink}`}} />
);

type Actor = {who: 'ehm'; expr: Expression; x: number; y: number; size: number; flip?: boolean}
  | {who: Role; expr: CastExpression; x: number; y: number; size: number; flip?: boolean; lean?: number};

const Actors: React.FC<{list: Actor[]}> = ({list}) => (
  <>
    {list.map((a, i) => (
      <div key={i} style={{position: 'absolute', left: a.x, top: a.y}}>
        {a.who === 'ehm'
          ? <Ehm expression={a.expr} size={a.size} frame={F} since={999} flip={a.flip} />
          : <Cast role={a.who} expression={a.expr} size={a.size} frame={F} flip={a.flip} lean={a.lean} />}
      </div>
    ))}
  </>
);

// ------------------------------------------------------------------ escalatie: "Got a sec?"
const BAAS = (expr: CastExpression, lean = 8): Actor => ({who: 'baas', expr, x: -40, y: 820, size: 760, lean});
const EHM = (expr: Expression, size = 620): Actor => ({who: 'ehm', expr, x: 470, y: 1060, size, flip: true});

export const SbEscalatie: React.FC<{panel: number}> = ({panel}) => {
  switch (panel) {
    case 0: // 0,0 s koude opening
      return (
        <AbsoluteFill>
          <Office clock="4:47" />
          <Actors list={[BAAS('neutraal', 12), EHM('neutraal')]} />
          <Bubble text="Hey, got a sec?" x={50} y={600} w={520} tail="left" size={58} />
          <Caption text="Your boss at 4:47 PM:" />
        </AbsoluteFill>
      );
    case 1: // 1,5 s de foute zin
      return (
        <AbsoluteFill>
          <Office clock="4:47" zoom={1.08} />
          <Actors list={[BAAS('blij', 12), EHM('zenuwachtig')]} />
          <Bubble text="Uh… sure!" x={470} y={720} w={440} tail="right" tone="not" size={60} />
        </AbsoluteFill>
      );
    case 2: // 4 s het wordt erger
      return (
        <AbsoluteFill>
          <Office clock="5:05" papers={3} zoom={1.08} />
          <Actors list={[BAAS('praten', 6), EHM('zenuwachtig')]} />
          <Bubble text="It's a quick one. Just the slides." x={60} y={560} w={560} tail="left" />
        </AbsoluteFill>
      );
    case 3: // 6,5 s nog erger
      return (
        <AbsoluteFill>
          <Office clock="6:20" papers={9} zoom={1.15} />
          <Actors list={[BAAS('praten', 4), EHM('bevroren', 560)]} />
          <Bubble text="…oh, and the budget. And Tom's report." x={60} y={520} w={600} tail="left" />
        </AbsoluteFill>
      );
    case 4: // 9 s piek: begraven, stilte
      return (
        <AbsoluteFill>
          <Office clock="9:58" papers={22} zoom={1.15} />
          <Actors list={[BAAS('blij', 4), EHM('bevroren', 560)]} />
          <Ice />
          <Bubble text="Thanks! You're a lifesaver." x={60} y={560} w={540} tail="left" />
        </AbsoluteFill>
      );
    case 5: // 10 s terugspoelen
      return (
        <AbsoluteFill>
          <Office clock="4:47" papers={4} />
          <Actors list={[BAAS('neutraal', 12), EHM('zenuwachtig')]} />
          <Rewind />
          <Caption text="Take two." top={1200} size={110} />
        </AbsoluteFill>
      );
    case 6: // 12 s de goede zin
      return (
        <AbsoluteFill>
          <Office clock="4:47" />
          <Actors list={[BAAS('neutraal', 12), EHM('praten')]} />
          <Bubble text="Got a sec?" x={60} y={600} w={330} tail="left" size={44} />
          <Bubble text="Right now I can't, I'm up against a deadline." x={430} y={590} w={600} tail="right" tone="yes" />
        </AbsoluteFill>
      );
    case 7: // 15 s de tweede zin
      return (
        <AbsoluteFill>
          <Office clock="4:48" />
          <Actors list={[BAAS('verbaasd', 6), EHM('praten')]} />
          <Bubble text="Can we do 3 PM tomorrow? Then you'll have my full attention." x={420} y={540} w={610} tail="right" tone="yes" />
        </AbsoluteFill>
      );
    case 8: // 18,5 s de draai
      return (
        <AbsoluteFill>
          <Office clock="4:48" />
          <Actors list={[BAAS('opgelucht', 0), EHM('trots')]} />
          <Bubble text="Oh thank god. I haven't even started the slides." x={60} y={520} w={580} tail="left" />
          <Sticker text="2 more lines that work → free PDF" />
        </AbsoluteFill>
      );
    default: // 22 s eindbeeld = beginbeeld (loop)
      return (
        <AbsoluteFill>
          <Office clock="4:47" />
          <Actors list={[BAAS('neutraal', 12), EHM('neutraal')]} />
          <Caption text="Your boss at 4:47 PM:" />
        </AbsoluteFill>
      );
  }
};

// ------------------------------------------------------------------ quiz: "You forgot their name"
type CardState = 'hidden' | 'shown' | 'wrong' | 'right' | 'dim';
const OPTIONS = ['Um… hey, you!', 'Heyyy… buddy!', 'Your name just slipped my mind, sorry!', '*nods and prays*'];

const Cards: React.FC<{states: CardState[]}> = ({states}) => (
  <div style={{position: 'absolute', left: 70, right: 150, top: 420, display: 'flex', flexDirection: 'column', gap: 26}}>
    {OPTIONS.map((t, i) => {
      const s = states[i];
      if (s === 'hidden') return <div key={i} style={{height: 120}} />;
      const bg = s === 'wrong' ? C.noSoft : s === 'right' ? C.yesSoft : s === 'dim' ? '#E9EEDD' : C.white;
      const ink = s === 'wrong' ? C.noInk : s === 'right' ? C.yesInk : s === 'dim' ? '#8A93A6' : C.ink;
      return (
        <div key={i} style={{display: 'flex', alignItems: 'center', gap: 24, background: bg, border: `5px solid ${C.ink}`, borderRadius: 30, padding: '20px 26px',
                             boxShadow: `0 7px 0 ${C.ink}`, color: s === 'dim' ? C.muted : undefined, transform: s === 'right' ? 'scale(1.06)' : undefined}}>
          <div style={{flex: 'none', width: 74, height: 74, borderRadius: '50%', background: s === 'right' ? C.yesInk : s === 'wrong' ? C.noInk : C.ink, color: C.white,
                       display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 46}}>
            {s === 'wrong' ? '✕' : s === 'right' ? '✓' : 'ABCD'[i]}
          </div>
          <div style={{fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 46, lineHeight: 1.15, color: ink,
                       textDecoration: s === 'wrong' ? 'line-through' : undefined, textDecorationThickness: 5}}>{t}</div>
        </div>
      );
    })}
  </div>
);

const KIM = (expr: CastExpression): Actor => ({who: 'kennis', expr, x: -30, y: 1150, size: 640});
const EHMQ = (expr: Expression): Actor => ({who: 'ehm', expr, x: 500, y: 1290, size: 520, flip: true});

export const SbQuiz: React.FC<{panel: number}> = ({panel}) => {
  switch (panel) {
    case 0: // 0 s de trigger
      return (
        <AbsoluteFill>
          <Party />
          <Actors list={[KIM('lach'), EHMQ('zenuwachtig')]} />
          <Bubble text="Heyyy! So good to see you again!" x={40} y={860} w={600} tail="left" size={56} />
          <Caption text="You forgot their name." />
        </AbsoluteFill>
      );
    case 1: // 1,5 s de opties
      return (
        <AbsoluteFill>
          <Party bunting={false} />
          <Actors list={[KIM('blij'), EHMQ('zenuwachtig')]} />
          <Caption text="What do you say?" size={64} top={240} />
          <Cards states={['shown', 'shown', 'shown', 'shown']} />
        </AbsoluteFill>
      );
    case 2: // 3 s aftellen
      return (
        <AbsoluteFill>
          <Party bunting={false} />
          <Actors list={[KIM('blij'), EHMQ('denken')]} />
          <Cards states={['shown', 'shown', 'shown', 'shown']} />
          <div style={{position: 'absolute', right: 90, top: 1090, width: 200, height: 200, borderRadius: '50%', background: C.zon, border: `7px solid ${C.ink}`,
                       display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 130, color: C.ink}}>2</div>
          <Caption text="Pick one." size={64} top={240} />
        </AbsoluteFill>
      );
    case 3: // 4,5 s de foute vallen af
      return (
        <AbsoluteFill>
          <Party bunting={false} />
          <Actors list={[KIM('frons'), EHMQ('bevroren')]} />
          <Cards states={['wrong', 'wrong', 'shown', 'wrong']} />
        </AbsoluteFill>
      );
    case 4: // 6 s de goede
      return (
        <AbsoluteFill>
          <Party bunting={false} />
          <Actors list={[KIM('lach'), EHMQ('opgelucht')]} />
          <Cards states={['dim', 'dim', 'right', 'dim']} />
          <Bubble text="Ha! It's Kim. Happens to everyone." x={40} y={1010} w={560} tail="left" size={46} />
        </AbsoluteFill>
      );
    default: // 8,5 s eind = loop
      return (
        <AbsoluteFill>
          <Party />
          <Actors list={[KIM('lach'), EHMQ('zenuwachtig')]} />
          <Caption text="Be honest: which one would YOU say?" size={66} />
          <div style={{position: 'absolute', left: 0, right: 140, top: 400, textAlign: 'center', fontFamily: FONT_BODY, fontWeight: 800, fontSize: 48, color: C.ink}}>
            Comment A, B, C or D
          </div>
        </AbsoluteFill>
      );
  }
};

// Eén frame per paneel, zodat `remotion still --frame=N` paneel N geeft.
import {useCurrentFrame} from 'remotion';
export const SB_ESCALATIE_PANELS = 10;
export const SB_QUIZ_PANELS = 6;
export const SbEscalatieFrames: React.FC = () => <SbEscalatie panel={useCurrentFrame()} />;
export const SbQuizFrames: React.FC = () => <SbQuiz panel={useCurrentFrame()} />;
