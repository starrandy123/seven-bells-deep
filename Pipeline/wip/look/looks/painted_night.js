// The Painted look at night: deep ultramarine, a large pale moon, clouds edged in silver, the sea in two dark teals.
import painted from './painted.js';

export default {
  ...painted,
  name: 'painted_night',
  grade: { sat: 1.18, contrast: 1.05, bands: 7 },
  warm: [.78, .90, 1.16], cool: [.42, .54, .96],
  rim: [.62, .80, 1.0, .22],
  haze: [.050, .100, .20],
  sky: { sunLow: -.42, zenith: [.0060, .020, .085], horizon: [.030, .095, .22], glow: [.52, .68, .98], cloudLit: [.40, .50, .76], cloudMid: [.11, .17, .36], cloudShade: [.024, .040, .12] },
  sea: { shallow: [.0080, .10, .16], deep: [.0030, .028, .085] },
  land: { ...painted.land, sand: [.16, .20, .30], wet: [.05, .07, .12], grassLit: [.030, .10, .13], grassDark: [.008, .030, .060], jungle: [.008, .035, .060], rockLit: [.10, .13, .22], rockDark: [.015, .02, .06], pale: [.20, .26, .38] },
  water: { scat: [.17, .18, .26], deep: [.5, .5, .62], sun: .13, caus: .18, amb: .52, ex: 1.26, shaft: .30 },
  light: { sun: [.070, .090, .15], hemi: [.22, .28, .46] },
};
