import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Fredoka voor koppen (rond en vriendelijk, past bij Ehm), Nunito voor lopende tekst. Beide OFL.
export const FONT_HEAD = 'Fredoka';
export const FONT_BODY = 'Nunito';

export const fontsLoaded = Promise.all([
  loadFont({family: FONT_HEAD, url: staticFile('fonts/fredoka-600.woff2'), weight: '600'}),
  loadFont({family: FONT_HEAD, url: staticFile('fonts/fredoka-700.woff2'), weight: '700'}),
  loadFont({family: FONT_BODY, url: staticFile('fonts/nunito-700.woff2'), weight: '700'}),
  loadFont({family: FONT_BODY, url: staticFile('fonts/nunito-800.woff2'), weight: '800'}),
]);
