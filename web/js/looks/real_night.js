// The Real look at night: moonlight, a sky that stays blue, the sea lit from within. Dark, but the game stays readable.
import real from './real.js';

export default {
  ...real,
  name: 'real_night',
  warm: [.82, .90, 1.08], cool: [.62, .72, 1.0],
  haze: [.030, .052, .105],
  sky: { sunLow: -.42, zenith: [.0035, .0085, .028], horizon: [.018, .036, .086], glow: [.26, .36, .58], cloudLit: [.17, .21, .34], cloudMid: [.070, .090, .17], cloudShade: [.018, .026, .056] },
  sea: { shallow: [.0060, .052, .090], deep: [.0020, .015, .042] },
  water: { scat: [.14, .15, .22], deep: [.5, .5, .62], sun: .11, caus: .14, amb: .46, ex: 1.28, shaft: .26 },
  light: { sun: [.046, .060, .105], hemi: [.17, .23, .40] },
};
