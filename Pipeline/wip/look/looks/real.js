// The Real look: physically minded water, a photographer's light. All of it is numbers; the shaders are one family.
export default {
  name: 'real',
  paint: 0,
  moods: {
    reef:      { Kd: [.058, .0300, .0200], Kv: [.046, .0180, .0125], scat: [.085, 1.000, 1.200], deep: [.0009, .0060, .0200], sun: 1.00, caus: 1.00, amb: 1.00, phase: [2.4, 3.2], ex: 1.00, shaft: 1.0 },
    kelp:      { Kd: [.066, .0320, .0300], Kv: [.058, .0230, .0210], scat: [.100, .720, .640], deep: [.0020, .0120, .0150], sun: 1.05, caus: 1.00, amb: .90, phase: [2.8, 3.6], ex: 1.00, shaft: 2.1 },
    city:      { Kd: [.075, .0270, .0180], Kv: [.062, .0170, .0092], scat: [.045, .620, .980], deep: [.0009, .0060, .0220], sun: .96, caus: .95, amb: .95, phase: [2.2, 3.0], ex: 1.02, shaft: 1.35 },
    trench:    { Kd: [.140, .0420, .0240], Kv: [.140, .0420, .0240], scat: [.014, .260, .620], deep: [.0005, .0020, .0110], sun: .80, caus: .50, amb: .85, phase: [1.5, 2.0], ex: 1.10, shaft: .5 },
    cinder:    { Kd: [.070, .0400, .0400], Kv: [.034, .0400, .0400], scat: [.280, .170, .120], deep: [.0640, .0200, .0120], sun: .70, caus: .30, amb: 1.00, phase: [1.6, 2.2], ex: 1.22, shaft: .5 },
    ice:       { Kd: [.050, .0220, .0160], Kv: [.040, .0160, .0110], scat: [.300, .720, .980], deep: [.0040, .0100, .0200], sun: .85, caus: .60, amb: 1.05, phase: [2.4, 3.0], ex: 1.02, shaft: 1.6 },
    wrack:     { Kd: [.080, .0400, .0360], Kv: [.052, .0240, .0220], scat: [.200, .340, .320], deep: [.0130, .0330, .0320], sun: .60, caus: .35, amb: .95, phase: [1.6, 2.2], ex: 1.20, shaft: .8 },
    bossfight: { Kd: [.075, .0300, .0220], Kv: [.060, .0220, .0150], scat: [.085, .380, .720], deep: [.0320, .0030, .0360], sun: 1.05, caus: .90, amb: 1.05, phase: [3.0, 4.2], ex: 1.12, shaft: 2.4 },
    victory:   { Kd: [.034, .0200, .0160], Kv: [.018, .0088, .0072], scat: [.170, .800, .960], deep: [.0060, .0120, .0150], sun: 1.75, caus: 1.40, amb: 1.25, phase: [3.5, 5.0], ex: 1.05, warm: 1, shaft: 2.0 },
  },
  grade: { sat: 1, contrast: 1, bands: 0 },
  warm: [1, 1, 1], cool: [1, 1, 1],
  rim: [1, 1, 1, 0],
  brush: 0,
  haze: [.66, .84, .98],
  sky: { sunLow: .8, zenith: [.022, .20, .66], horizon: [.46, .78, 1.05], glow: [1, .92, .76], cloudLit: [1.40, 1.36, 1.30], cloudMid: [.90, .92, .98], cloudShade: [.60, .68, .82] },
  sea: { shallow: [.05, .62, .68], deep: [.012, .20, .52] },
  land: { sand: [.92, .84, .66], wet: [.36, .29, .19], grassLit: [.17, .25, .055], grassDark: [.040, .105, .020], jungle: [.032, .105, .028], rockLit: [.20, .19, .18], rockDark: [.040, .038, .040], pale: [.62, .60, .54] },
};
