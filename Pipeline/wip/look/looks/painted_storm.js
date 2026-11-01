// The Painted look under a storm: slate and grey-violet, heavy forms overhead, a sea gone dark green.
import painted from './painted.js';

export default {
  ...painted,
  name: 'painted_storm',
  grade: { sat: .92, contrast: 1.04, bands: 7 },
  warm: [.92, .96, 1.02], cool: [.62, .70, .90],
  rim: [.80, .88, 1.0, .30],
  haze: [.30, .36, .42],
  sky: { sunLow: .5, zenith: [.080, .10, .15], horizon: [.30, .36, .40], glow: [.34, .36, .40], cloudLit: [.52, .56, .62], cloudMid: [.24, .27, .34], cloudShade: [.075, .085, .13] },
  sea: { shallow: [.040, .22, .22], deep: [.014, .085, .11] },
  water: { scat: [.50, .54, .60], deep: [.8, .8, .8], sun: .38, caus: .30, amb: .74, ex: 1.04, shaft: .26 },
  light: { sun: [.22, .24, .28], hemi: [.68, .74, .84] },
};
