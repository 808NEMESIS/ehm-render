/** Overzicht van alle expressies: controle dat de rig gelijk is aan de goedgekeurde SVG's. */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Ehm, EXPRESSION_NAMES} from '../ehm/Ehm';
import {C} from '../ehm/colors';
import {FONT_BODY} from '../fonts';

export const ExpressionSheet: React.FC = () => (
  <AbsoluteFill style={{background: C.cream, display: 'flex', flexWrap: 'wrap', padding: 40, gap: 0}}>
    {EXPRESSION_NAMES.map((e) => (
      <div key={e} style={{width: 380, height: 410, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <Ehm expression={e} size={340} frame={0} />
        <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30, color: C.navy}}>{e}</div>
      </div>
    ))}
  </AbsoluteFill>
);
