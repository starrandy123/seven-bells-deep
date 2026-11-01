// The Real look under a storm: the sky a low grey ceiling, the sea pewter, no sun to speak of.
import real from './real.js';

export default {
  ...real,
  name: 'real_storm',
  warm: [.94, .97, 1.0], cool: [.82, .88, .96],
  haze: [.25, .29, .33],
  sky: { sunLow: .5, zenith: [.070, .090, .120], horizon: [.24, .28, .32], glow: [.22, .24, .27], cloudLit: [.46, .49, .54], cloudMid: [.22, .25, .29], cloudShade: [.075, .085, .11] },
  sea: { shallow: [.040, .19, .22], deep: [.016, .070, .10] },
  water: { scat: [.46, .50, .56], deep: [.8, .8, .8], sun: .36, caus: .28, amb: .72, ex: 1.05, shaft: .22 },
  light: { sun: [.20, .22, .26], hemi: [.66, .72, .82] },
};
