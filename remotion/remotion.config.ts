import {Config} from '@remotion/cli/config';

Config.setEntryPoint('src/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// Op de Mac downloadt Remotion zelf een browser. In een omgeving zonder die download:
// zet REMOTION_BROWSER op het pad van een Chromium headless shell.
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
