// The city material's drawing (city.js builds the massing; this draws everything on it). Randy, 1 Nov: "The cities must come with the nice detail and textures of
// the art style too and look out of a comic book". So every surface is drawn here from aFac = (u, v, kind, w), in ink of a constant weight on the screen, and
// each kind's detail fades to its flat tone before it could shimmer (ocLod, from how many metres one pixel covers). After the light, faces turned from the sun
// are hatched like a comic's shadows, cross-hatched where they turn furthest away; then the ink goes on top of everything, and the water's haze over all of it.
// Kinds: city.js K. Colours are linear, from ART.md: pale marble #d9d4c4, algae #3d6e5a, gold mosaic #c9a24a.

export const CITY_VERTEX_DECL = 'attribute vec4 aFac;\nvarying vec4 vFac;\nvarying float vFacSeed;\n';
export const CITY_VERTEX_BEND = `vFac = aFac;
#ifdef USE_INSTANCING
  vFacSeed = fract(instanceMatrix[3].x*.1371 + instanceMatrix[3].z*.0713 + instanceMatrix[3].y*.031);
#else
  vFacSeed = 0.0;
#endif
`;

export const CITY_PARS = /* glsl */`
varying vec4 vFac; varying float vFacSeed;
float ocWinM = 0.0, ocInkM = 0.0, ocEmber = 0.0; vec3 ocWinC = vec3(0.0);
float ocH1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
// an ink line about a pixel and a half wide wherever d (in any unit) crosses zero: d over its own screen rate is its distance in pixels
float ocLn(float d) { return 1.0 - smoothstep(.55, 1.55, abs(d)/max(fwidth(d), 1e-5)); }
// to the nearest whole number of x, as an ink line (courses, joints, tile rows)
float ocLnGrid(float x) { float f = fract(x); return 1.0 - smoothstep(.55, 1.55, min(f, 1.0 - f)/max(fwidth(x), 1e-5)); }
// a window: a box from y0 to y1, half width hw, and an arch of radius hw on top when arch > .5; negative inside
float ocSdWin(vec2 q, float hw, float y0, float y1, float arch) {
  vec2 c = vec2(0.0, (y0 + y1)*.5), h = vec2(hw, (y1 - y0)*.5), d = abs(q - c) - h;
  float box = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  if (arch < .5) return box;
  return min(box, max(length(q - vec2(0.0, y1)) - hw, y1 - q.y));
}
`;

export const CITY_ALBEDO = /* glsl */`{
  int ocK = int(vFac.z + .5);
  vec2 ocUV = vFac.xy; float ocBw = max(vFac.w, .3);
  vec3 ocT = vColor.rgb;                                                    // the building's own tone (instance colour; the vertex colour is white)
  float ocMpp = max(length(fwidth(vOcP)), 1e-4);                           // metres one pixel covers here
  float ocLod = 1.0 - smoothstep(.045, .13, ocMpp);                         // fine detail (courses, joints, mullions, shingle edges, tile rows) fades first
  float ocLodW = 1.0 - smoothstep(.16, .42, ocMpp);                         // window-scale detail (windows, arches, pilasters, ledges, ribs, friezes) holds far longer
  float ocDeep = step(vOcP.y, -100.0);
  vec3 ocLitC = mix(vec3(1.0, .66, .32), vec3(.22, .95, .92), ocDeep);     // window light: warm, and the deep city's cold
  ocEmber = 1.0 - step(230.0, length(vOcP.xz - vec2(300.0, 800.0))); ocLitC = mix(ocLitC, vec3(1.0, .40, .08), ocEmber);      // the Burnt Isle (fireisle.js): its windows burn day and night
  vec3 MARBLE = vec3(.66, .63, .55), PALE = vec3(.78, .75, .66), GOLD = vec3(.64, .44, .12), VERD = vec3(.16, .40, .33), ALG = vec3(.05, .16, .10);
  vec3 ocC = MARBLE*ocT; float ink = 0.0, inkW = 0.0; bool ocStoneish = true;

  if (ocK == 1 || ocK == 15 || ocK == 2) {
    // ---------------- a wall of windows: the sea's marble with arched windows, pilasters and ledges; the land's plaster with shutters and sills
    bool sea = ocK != 2;
    float S = sea ? 4.2 : 3.0, st = floor(ocUV.y/S), vy = ocUV.y - st*S;
    float bi = floor(ocUV.x/ocBw), ux = ocUV.x - (bi + .5)*ocBw;
    vec3 wall;
    if (sea) {
      float cy = ocUV.y/.7, row = floor(cy), jx = ocUV.x/1.4 + row*.5;
      wall = MARBLE*ocT*(.9 + .16*ocH1(vec2(row, floor(jx)) + vFacSeed*9.0));
      ink = max(ink, max(ocLnGrid(cy), ocLnGrid(jx))*.42);
    } else { wall = vec3(.84, .76, .60)*ocT*(.95 + .07*ocH1(floor(ocUV*vec2(.6, 1.5)) + vFacSeed*7.0)); ocStoneish = false; }
    vec3 c = wall;
    // pilasters every other bay (sea): paler, drawn at both edges
    float pp = mod(ocUV.x, 2.0*ocBw), pd = min(pp, 2.0*ocBw - pp); bool pil = sea && pd < .3;
    if (pil) c = PALE*ocT;
    if (sea) inkW = max(inkW, ocLn(pd - .3));
    // a ledge along the foot of every storey above the ground, its top edge inked
    if (st > .5 && vy < .26 && !pil) c = PALE*ocT*.95;
    if (st > .5) inkW = max(inkW, ocLn(vy - .26)*.9);
    // the window (or the sea's ground arcade, or a land house's door)
    float hw = clamp(ocBw*.22, .42, 1.0), y0 = sea ? 1.15 : .95, y1 = sea ? 2.95 : 2.25, arch = sea ? 1.0 : 0.0, open = 0.0;
    // each building draws its windows its own way: arched, square, tall and narrow, or low and wide
    float ocWs = fract(vFacSeed*7.31);
    if (sea && ocK == 1) { if (ocWs < .3) arch = 0.0; else if (ocWs < .55) { hw *= .62; y0 = .8; y1 = 3.2; } else if (ocWs < .75) { hw *= 1.25; y1 = 2.5; arch = 0.0; } }
    if (!sea) { if (ocWs < .3) arch = 1.0; else if (ocWs < .55) hw *= .8; }
    if (ocK == 15 && st < .5) { hw = ocBw*.33; y0 = 0.0; y1 = 2.6; open = 1.0; }
    if (ocK == 2 && st < .5 && ocH1(vec2(bi, 7.0) + vFacSeed*5.0) < .34) { hw = .56; y0 = 0.0; y1 = 2.25; open = 2.0; }
    float sd = ocSdWin(vec2(ux, vy), hw, y0, y1, arch), fb = sea ? .17 : .1;
    float lit = step(.14 + .5*fract(vFacSeed*3.17), ocH1(vec2(bi, st) + vFacSeed*17.0));      // some buildings mostly dark, some blazing
    if (!pil && sd < fb) {
      if (sd < 0.0) {
        if (open > 1.5) { c = vec3(.22, .12, .06)*(.82 + .3*step(.5, fract(ux*2.2 + .25))); ink = max(ink, ocLnGrid(ux*2.2 + .25)*.6); }
        else if (open > .5) c = vec3(.025, .04, .045);                                                     // the arcade's shadowed depth
        else {
          c = mix(vec3(.035, .06, .08), vec3(.10, .15, .18), smoothstep(y0, y1 + hw, vy)); ocWinM = lit; ocWinC = ocLitC;
          ink = max(ink, max(ocLn(ux), ocLn(vy - (y0 + (y1 - y0)*.62))));                                // the mullion's cross
        }
      } else c = PALE*ocT;                                                                                   // the frame
      inkW = max(inkW, ocLn(sd - fb*.5)*.5); ink = max(ink, max(ocLn(sd), ocLn(sd - fb)));
    }
    if (!sea && open < .5) {
      if (abs(ux) < hw + .17 && vy > y0 - .14 && vy < y0) { c = PALE*ocT; ink = max(ink, ocLn(vy - (y0 - .14))); }     // the sill
      float sx = abs(ux) - hw - .06;
      if (sx > 0.0 && sx < hw*.62 && vy > y0 && vy < y1) {                                                  // a slatted shutter, the house's own colour
        vec3 sc = mix(mix(vec3(.08, .28, .22), vec3(.10, .20, .42), step(.5, ocH1(vec2(vFacSeed*31.0, 3.0)))), vec3(.16, .022, .016), ocEmber);
        c = sc*(.82 + .2*step(.5, fract(vy/.13))); ink = max(ink, max(ocLn(sx), ocLn(sx - hw*.62)));
      }
    }
    // the frames and fine lines go first (c2: the window as a clean pane on the wall), then the windows themselves melt into the wall's tone
    vec3 c2 = sd < 0.0 && !pil ? (open > 1.5 ? vec3(.22, .12, .06) : open > .5 ? vec3(.025, .04, .045) : vec3(.05, .08, .10)) : (pil || (st > .5 && vy < .26) ? PALE*ocT : wall);
    float cover = sea ? .24 : .2;
    ocC = mix(mix(wall, vec3(.06, .08, .10), cover), mix(c2, c, ocLod), ocLodW);
    ocWinM = mix(.62*cover, ocWinM, ocLodW); ocWinC = ocLitC;
  }
  else if (ocK == 4) {
    // ---------------- a dome or a cone: verdigris shingled like fish scales, gold ribs
    float r = ocBw, ang = ocUV.x/r, cphi = sqrt(max(1.0 - (ocUV.y/r)*(ocUV.y/r), .04));
    float su = ocUV.x*cphi/.9, sv = ocUV.y/.55, row = floor(sv), q = fract(su + row*.5) - .5, p = fract(sv);
    float sc = length(vec2(q, (p - 1.0)*1.25));
    float ocDs = fract(vFacSeed*5.73); vec3 ocVD = ocDs < .4 ? VERD : ocDs < .62 ? vec3(.62, .40, .10) : ocDs < .82 ? vec3(.46, .16, .12) : vec3(.10, .17, .42);      // verdigris, gold, rose copper, lapis
    VERD = ocVD; vec3 v = VERD*ocT*(.82 + .32*ocH1(vec2(floor(su + row*.5), row)));
    vec3 c = mix(v*.62, v, smoothstep(.0, .5, 1.0 - sc));
    ink = max(ink, ocLn(sc - .5)*.7);
    float rb = fract(ang/6.2831853*12.0), rd = min(rb, 1.0 - rb)*6.2831853*r*cphi/12.0;      // metres from the nearest of twelve ribs
    vec3 cR = rd < .14 ? GOLD : VERD*ocT*.85;
    if (rd < .14) c = GOLD;
    inkW = max(inkW, ocLn(rd - .14));
    ocC = mix(VERD*ocT*.85, mix(cR, c, ocLod), ocLodW); ocStoneish = false;
  }
  else if (ocK == 5) {
    // ---------------- a hall's drum: tall arched windows between marble, a gold mosaic band under the cornice
    float bi = floor(ocUV.x/ocBw), ux = ocUV.x - (bi + .5)*ocBw, vy = ocUV.y;
    vec3 wall = MARBLE*ocT, c = wall; float hw = ocBw*.24;
    float sd = ocSdWin(vec2(ux, vy), hw, 1.2, 5.6, 1.0);
    if (sd < 0.0) { c = vec3(.035, .06, .08); ocWinM = step(.2, ocH1(vec2(bi, 1.0) + vFacSeed*13.0)); ocWinC = ocLitC; ink = max(ink, ocLn(ux)); }
    else if (sd < .18) c = PALE*ocT;
    inkW = max(inkW, ocLn(sd - .09)*.5); ink = max(ink, max(ocLn(sd), ocLn(sd - .18)));
    vec3 c2 = sd < 0.0 ? vec3(.05, .08, .10) : wall;
    if (vy > 7.3) { c = GOLD*(.84 + .26*step(.5, fract(ocUV.x/.32))); c2 = GOLD*.95; inkW = max(inkW, ocLn(vy - 7.3)); }
    ocC = mix(mix(wall, vec3(.06, .08, .10), .3), mix(c2, c, ocLod), ocLodW); ocWinM = mix(.25, ocWinM, ocLodW); ocWinC = ocLitC;
  }
  else if (ocK == 6) {
    // ---------------- a fluted column
    float fl = fract(ocUV.x/ocBw/6.2831853*20.0), g = min(fl, 1.0 - fl);
    ocC = MARBLE*ocT*mix(.74, 1.02, smoothstep(.04, .3, g));
    ink = max(ink, ocLnGrid(ocUV.x/ocBw/6.2831853*20.0)*.35);
  }
  else if (ocK == 7) {
    // ---------------- a spire's shaft: courses, and a slit window in each face every six metres, lit cold
    float st = floor(ocUV.y/6.0), vy = ocUV.y - st*6.0, bi = floor(ocUV.x/ocBw), ux = ocUV.x - (bi + .5)*ocBw;
    vec3 wall = MARBLE*ocT*(.92 + .1*ocH1(vec2(floor(ocUV.y/.7), bi))), c = wall;
    ink = max(ink, ocLnGrid(ocUV.y/.7)*.4);
    float sd = ocSdWin(vec2(ux, vy), .32, 1.4, 4.1, 1.0);
    if (sd < 0.0) { c = vec3(.03, .06, .07); ocWinM = step(.3, ocH1(vec2(bi, st) + vFacSeed*11.0)); ocWinC = vec3(.30, .95, .95); }
    else if (sd < .14) c = PALE*ocT;
    inkW = max(inkW, ocLn(sd - .07)*.5); ink = max(ink, max(ocLn(sd), ocLn(sd - .14)));
    ocC = mix(wall*.92, mix(sd < 0.0 ? vec3(.04, .07, .08) : wall, c, ocLod), ocLodW); ocWinM = mix(.12, ocWinM, ocLodW); ocWinC = vec3(.30, .95, .95);
  }
  else if (ocK == 8) {
    // ---------------- gold: banded like hammered metal
    ocC = GOLD*(.86 + .22*step(.5, fract(ocUV.y/.45))); ink = max(ink, ocLnGrid(ocUV.y/.45)*.3); ocStoneish = false;
  }
  else if (ocK == 9) {
    // ---------------- paving, drawn in world space: under the sea marble slabs with a gold and weed-green mosaic band every nine metres; on land cobbles
    vec2 w = vOcP.xz;
    if (vOcP.y < -1.0) {
      vec2 g = w/1.8; g.x += mod(floor(g.y), 2.0)*.5;
      vec3 s = MARBLE*ocT*(.86 + .2*ocH1(floor(g)));
      ink = max(ink, max(ocLnGrid(g.x), ocLnGrid(g.y))*.5);
      vec2 band = abs(fract(w/9.0) - .5)*9.0; float mb = min(band.x, band.y);
      vec3 s2 = mb < .45 ? mix(GOLD, ALG*2.4, .5) : MARBLE*ocT*.86;
      if (mb < .45) s = mix(GOLD, ALG*2.4, step(.5, fract((w.x + w.y)/.45)));
      inkW = max(inkW, ocLn(mb - .45)*.8);
      ocC = mix(MARBLE*ocT*.86, mix(s2, s, ocLod), ocLodW);
    } else {
      vec2 g = w/.45, f = fract(g) - .5; float d = length(f);
      vec3 s = vec3(.46, .42, .36)*ocT*(.8 + .35*ocH1(floor(g)));
      ocC = mix(vec3(.40, .37, .32)*ocT, mix(s*.55, s, (1.0 - smoothstep(.28, .5, d))), ocLod);
      ink = max(ink, ocLn(d - .47)*.35); ocStoneish = false;
    }
  }
  else if (ocK == 3) {
    // ---------------- terracotta roof tiles: rounded courses up the slope, staggered
    float rv = ocUV.y/.32, row = floor(rv), tu = ocUV.x/.26 + row*.5;
    float ocRs = fract(vFacSeed*9.13); vec3 ocRc = ocRs < .46 ? vec3(.50, .17, .08) : ocRs < .7 ? vec3(.56, .30, .11) : ocRs < .86 ? vec3(.34, .10, .07) : vec3(.20, .22, .26);      // terracotta, ochre, oxblood, slate
    vec3 t = ocRc*(.82 + .3*ocH1(vec2(floor(tu), row) + vFacSeed*3.0));
    t *= mix(.68, 1.0, smoothstep(.0, .4, fract(rv)));
    ink = max(ink, ocLnGrid(rv)*.6); ink = max(ink, ocLnGrid(tu)*.25);
    ocC = mix(ocRc*.9, t, ocLod); ocStoneish = false;
  }
  else if (ocK == 10) { ocC = vec3(1.0, .88, .62); ocWinM = 1.0; ocWinC = mix(vec3(1.0, .72, .40), vec3(.35, .95, .95), ocDeep); ocStoneish = false; }
  else if (ocK == 11) { ocC = mix(vec3(.62, .10, .07), vec3(.88, .82, .68), step(.5, fract(ocUV.x/.5))); ink = max(ink, ocLnGrid(ocUV.x/.5)*.4); ocStoneish = false; }
  else if (ocK == 12) {
    // ---------------- the frieze: a running wave in gold on sea green, gold borders
    float x = ocUV.x/1.1, y = ocUV.y/.9, wave = .5 + .26*sin(x*6.2831853) + .1*sin(x*12.566 + 1.3), d = abs(y - wave);
    float ocFs = fract(vFacSeed*4.37); vec3 bg = ocFs < .4 ? vec3(.07, .26, .29) : ocFs < .7 ? vec3(.30, .09, .10) : vec3(.07, .10, .30), c = d < .12 ? GOLD : bg;
    if (y < .12 || y > .88) c = GOLD*.9;
    inkW = max(inkW, max(ocLn(d - .12), max(ocLn(y - .12), ocLn(y - .88))));
    ocC = mix(mix(bg, GOLD, .35), c, ocLodW); ocStoneish = false;
  }
  else if (ocK == 13) { ocC = vec3(.05, .045, .04); ocStoneish = false; }
  else if (ocK == 14) { ocC = vec3(.28, .18, .10)*(.86 + .22*step(.5, fract(ocUV.y*2.7 + ocH1(vec2(floor(ocUV.x*3.0), 1.0))))); ocStoneish = false; }
  else {
    // ---------------- plain stone (plinths, cornices, bases): courses and joints in world space
    float cy = vOcP.y/.7, row = floor(cy), jx = (vOcP.x + vOcP.z)/1.4 + row*.5;
    ocC = MARBLE*ocT*(.84 + .16*ocH1(vec2(row, floor(jx))));
    ink = max(ink, max(ocLnGrid(cy), ocLnGrid(jx))*.45);
    ocC = mix(MARBLE*ocT*.9, ocC, ocLod);
  }
  // weed on the stone under the water, in patches, never on a lit window
  if (ocStoneish) {
    float ocN1 = texture(tOcNoise, vOcP.xz*.037 + vOcP.y*vec2(.021, -.013)).a, ocN2 = texture(tOcNoise, vOcP.zx*.17 + vOcP.y*vec2(.09, .07)).b;
    float ocAl = smoothstep(.42, .70, ocN1*.72 + ocN2*.28)*(1.0 - smoothstep(-.6, 1.2, vOcP.y))*(1.0 - ocWinM);
    ocC = mix(ocC, ocC*vec3(.34, .62, .40) + vec3(.004, .018, .012), ocAl*.6);
  }
  ocInkM = max(ink*ocLod, inkW*ocLodW);
  diffuseColor.rgb = ocC;
}`;

// after the light: comic hatching on the faces turned from the sun, cross-hatched where they turn furthest; then the ink over everything
export const CITY_POST = /* glsl */`{
  vec3 ocWn = normalize((vec4(normal, 0.0)*viewMatrix).xyz);
  float ocNdl = dot(ocWn, normalize(ocSunW + vec3(0.0, 1e-4, 0.0)));
  float ocT1 = (vOcP.x*.70 + vOcP.y + vOcP.z*.70)/.15, ocT2 = (vOcP.x*.70 - vOcP.y + vOcP.z*.70)/.15;
  float ocHf = 1.0 - smoothstep(.2, .5, max(fwidth(ocT1), fwidth(ocT2)));      // only while its lines stay three pixels or more apart
  float ocS1 = (1.0 - smoothstep(-.06, .22, ocNdl)), ocS2 = (1.0 - smoothstep(-.52, -.18, ocNdl));
  outgoingLight *= 1.0 - .36*ocHf*clamp(ocLnGrid(ocT1)*ocS1 + ocLnGrid(ocT2)*ocS2, 0.0, 1.0)*(1.0 - ocWinM);
  // under the water the sun's colours are gone a few metres down, and a street of coral, sandstone and jade reads as one blue: a soft light of its own keeps each building its colour through the haze
  // the sea's own light and nothing else (Randy, 1 Nov: "The underwater buildings are too bright and we need actual natural light"): more of what comes down through the water to this depth, so a roof catches it, a wall has half and an underside none, blue-green as it is down there. A stone keeps its own colour only close to, as anything does in the sea
  { float ocUnder = 1.0 - smoothstep(-6.0, -1.0, vOcP.y), ocD = min(length(vOcP - cameraPosition), 40.0);
    outgoingLight += diffuseColor.rgb*ocAmbient(ocWn, max(-vOcP.y, 0.0))*ocUnder*.55*(1.0 - ocWinM);
    float ocL = dot(outgoingLight, vec3(.3, .55, .15)); outgoingLight = max(mix(vec3(ocL), outgoingLight, 1.0 + .3*ocUnder*(1.0 - ocWinM)), vec3(0.0));
    outgoingLight *= mix(vec3(1.0), exp(ocKv*ocD*.34), ocUnder); }
  outgoingLight = mix(outgoingLight, vec3(.010, .020, .028), clamp(ocInkM, 0.0, 1.0));
}`;

// windows lit when the lamps are lit and at night, and in the deep where no day reaches (Vesper at 150 m is seen by its own windows). Randy, 1 Nov: natural light under the water
export const CITY_GLOW = /* glsl */`ocGlow = ocWinC*ocWinM*max(max(max(ocLamps, ocNight), ocEmber*.62), step(vOcP.y, -18.0)*mix(.05, 1.3, 1.0 - smoothstep(-125.0, -75.0, vOcP.y)))*2.6*exp(-(ocKv - ocKv.g)*length(vOcP - cameraPosition));`;      // a window is a lamp only where the day's light has gone: by day in the shallows it's dark glass, and at any depth its red goes first with distance
