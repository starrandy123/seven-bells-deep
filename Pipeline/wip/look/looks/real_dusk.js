// The Real look at sunrise and sunset: a low warm sun, long pink light on the clouds, the water going amber near the top.
import real from './real.js';

export default {
  ...real,
  name: 'real_dusk',
  warm: [1.10, 1.0, .88], cool: [.84, .87, 1.06],
  haze: [.96, .68, .50],
  sky: { sunLow: .085, zenith: [.030, .085, .32], horizon: [1.05, .56, .28], glow: [1.0, .60, .24], cloudLit: [1.34, .80, .52], cloudMid: [.76, .47, .46], cloudShade: [.30, .25, .40] },
  sea: { shallow: [.07, .40, .44], deep: [.018, .11, .26] },
  water: { scat: [1.30, .74, .60], deep: [1, .85, .72], sun: .66, caus: .55, amb: .82, ex: 1.03, shaft: 1.25 },
  light: { sun: [1.0, .62, .34], hemi: [.92, .68, .62] },
};
