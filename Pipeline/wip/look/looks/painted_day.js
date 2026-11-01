// The Painted look at midday: saturated grass, soft blue distance, white cumulus with cool shadows. Same family, other numbers.
import painted from './painted.js';

export default {
  ...painted,
  name: 'painted_day',
  grade: { sat: 1.22, contrast: 1.10, bands: 9 },
  warm: [1.03, 1.0, .93], cool: [.76, .86, 1.14],
  rim: [1.0, .98, .9, .30],
  haze: [.58, .80, .98],
  sky: { sunLow: .62, zenith: [.030, .22, .60], horizon: [.52, .80, 1.0], glow: [1.0, .94, .78], cloudLit: [1.16, 1.14, 1.08], cloudMid: [.84, .90, .98], cloudShade: [.42, .52, .72] },
  sea: { shallow: [.030, .50, .56], deep: [.010, .16, .44] },
  land: { ...painted.land, sand: [.94, .86, .68], grassLit: [.32, .60, .08], grassDark: [.05, .26, .07], rockLit: [.46, .44, .46], rockDark: [.10, .12, .30] },
};
