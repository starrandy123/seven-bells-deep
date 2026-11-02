// The Painted look: a teal sea, huge peach cumulus, a limited ramp, warm lights and cool shadows, soft blue distance.
// The same shaders as the Real look; only these numbers differ, so it switches live and nothing is lost going back.
export default {
  name: 'painted',
  paint: 1,
  moods: {
    reef:      { Kd: [.040, .0240, .0220], Kv: [.030, .0130, .0125], scat: [.120, .980, .980], deep: [.0020, .0120, .0240], sun: 1.00, caus: .85, amb: 1.00, phase: [2.2, 2.6], ex: 1.00, shaft: 1.25 },
    kelp:      { Kd: [.050, .0280, .0300], Kv: [.040, .0200, .0210], scat: [.150, .780, .620], deep: [.0040, .0160, .0160], sun: 1.05, caus: .85, amb: .95, phase: [2.6, 3.0], ex: 1.00, shaft: 2.4 },
    city:      { Kd: [.080, .0520, .0420], Kv: [.042, .0200, .0150], scat: [.050, .340, .540], deep: [.0006, .0028, .0090], sun: .96, caus: .85, amb: .95, phase: [2.2, 2.6], ex: 1.02, shaft: 1.7 },
    trench:    { Kd: [.110, .0400, .0280], Kv: [.100, .0360, .0250], scat: [.060, .300, .640], deep: [.0060, .0040, .0200], sun: .80, caus: .45, amb: .90, phase: [1.5, 2.0], ex: 1.10, shaft: .5 },
    cinder:    { Kd: [.060, .0400, .0420], Kv: [.030, .0360, .0360], scat: [.420, .200, .160], deep: [.0700, .0300, .0240], sun: .70, caus: .30, amb: 1.05, phase: [1.6, 2.2], ex: 1.22, shaft: .6 },
    ice:       { Kd: [.040, .0200, .0160], Kv: [.030, .0140, .0110], scat: [.340, .780, .980], deep: [.0060, .0120, .0220], sun: .85, caus: .60, amb: 1.05, phase: [2.4, 3.0], ex: 1.02, shaft: 1.7 },
    wrack:     { Kd: [.070, .0400, .0360], Kv: [.046, .0220, .0200], scat: [.260, .380, .340], deep: [.0160, .0380, .0380], sun: .60, caus: .35, amb: 1.00, phase: [1.6, 2.2], ex: 1.20, shaft: .9 },
    bossfight: { Kd: [.070, .0300, .0240], Kv: [.050, .0200, .0150], scat: [.180, .360, .700], deep: [.0360, .0040, .0420], sun: 1.05, caus: .85, amb: 1.05, phase: [3.0, 4.2], ex: 1.12, shaft: 2.4 },
    victory:   { Kd: [.026, .0170, .0150], Kv: [.014, .0078, .0068], scat: [.300, .860, .900], deep: [.0080, .0140, .0160], sun: 1.75, caus: 1.20, amb: 1.25, phase: [3.5, 5.0], ex: 1.05, warm: 1, shaft: 2.0 },
  },
  grade: { sat: 1.24, contrast: 1.14, bands: 9 },
  warm: [1.05, .985, .90], cool: [.80, .90, 1.10],
  rim: [1.0, .93, .78, .34],
  brush: 1,
  haze: [.62, .86, .90],
  sky: { sunLow: .10, zenith: [.040, .30, .28], horizon: [.34, .68, .54], glow: [1.0, .70, .34], cloudLit: [1.10, .86, .58], cloudMid: [.90, .52, .40], cloudShade: [.36, .33, .46] },
  sea: { shallow: [.035, .44, .42], deep: [.012, .21, .28] },
  land: { sand: [.96, .86, .62], wet: [.50, .42, .28], grassLit: [.30, .54, .09], grassDark: [.055, .23, .075], jungle: [.028, .16, .09], rockLit: [.44, .40, .40], rockDark: [.12, .13, .24], pale: [.74, .70, .62] },
};
