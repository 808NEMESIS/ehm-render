import React from 'react';
import {Composition, continueRender, delayRender} from 'remotion';
import {Carrousel, CARROUSEL_SLIDES} from './templates/Carrousel';
import {EhmVideo, VIDEO_FRAMES} from './templates/EhmVideo';
import {EhmChat, chatTiming} from './templates/EhmChat';
import {ExpressionSheet} from './templates/ExpressionSheet';
import {SbEscalatieFrames, SbQuizFrames, SB_ESCALATIE_PANELS, SB_QUIZ_PANELS} from './storyboard/Storyboard';
import {voorbeeld} from './data/situatie';
import {Escalatie, EscalatieData} from './scenes/Escalatie';
import hebJeEven from './scenes/heb-je-even.json';
import {Quiz, QuizData} from './scenes/Quiz';
import quizVoorbeeld from './scenes/gen/quiz-salariswensen.json';
import {Duel, DuelData} from './scenes/Duel';
import duelVoorbeeld from './scenes/gen/duel-geld-lenen.json';
import {Verteller, VertellerData} from './scenes/Verteller';
import vertellerVoorbeeld from './scenes/gen/verteller-collega-schuift-werk.json';
import {fontsLoaded} from './fonts';

const handle = delayRender('fonts');
fontsLoaded.then(() => continueRender(handle));

export const Root: React.FC = () => (
  <>
    <Composition id="EhmVideo" component={EhmVideo} durationInFrames={VIDEO_FRAMES} fps={30} width={1080} height={1920} defaultProps={voorbeeld} />
    <Composition
      id="EhmChat"
      component={EhmChat}
      durationInFrames={600}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={voorbeeld}
      calculateMetadata={({props}) => ({durationInFrames: chatTiming(props).total})}
    />
    <Composition id="Escalatie" component={Escalatie} durationInFrames={hebJeEven.total} fps={30} width={1080} height={1920}
      defaultProps={{data: hebJeEven as EscalatieData}} calculateMetadata={({props}) => ({durationInFrames: props.data.total})} />
    <Composition id="Quiz" component={Quiz} durationInFrames={quizVoorbeeld.total} fps={30} width={1080} height={1920}
      defaultProps={{data: quizVoorbeeld as QuizData}} calculateMetadata={({props}) => ({durationInFrames: props.data.total})} />
    <Composition id="Duel" component={Duel} durationInFrames={duelVoorbeeld.total} fps={30} width={1080} height={1920}
      defaultProps={{data: duelVoorbeeld as DuelData}} calculateMetadata={({props}) => ({durationInFrames: props.data.total})} />
    <Composition id="Verteller" component={Verteller} durationInFrames={vertellerVoorbeeld.total} fps={30} width={1080} height={1920}
      defaultProps={{data: vertellerVoorbeeld as VertellerData}} calculateMetadata={({props}) => ({durationInFrames: props.data.total})} />
    <Composition id="Carrousel" component={Carrousel} durationInFrames={CARROUSEL_SLIDES} fps={1} width={1080} height={1350} defaultProps={voorbeeld} />
    <Composition id="SbEscalatie" component={SbEscalatieFrames} durationInFrames={SB_ESCALATIE_PANELS} fps={1} width={1080} height={1920} />
    <Composition id="SbQuiz" component={SbQuizFrames} durationInFrames={SB_QUIZ_PANELS} fps={1} width={1080} height={1920} />
    <Composition id="ExpressionSheet" component={ExpressionSheet} durationInFrames={1} fps={30} width={1600} height={900} />
  </>
);
