// What burns: a body in its all-fire form, and the rock of the Emberkin's isle. A pattern in metres, no texture: slag cells, the seams between them molten, hottest where the mask's red says. Alpha 1 in the mask drops the glow a far figure takes on.
// what burns on a body: cells of slag, the seams between them molten, hottest where the mask says, each seam's light moving. In object space, so no texture memory and no seam at a UV edge
export const BURN = {
  vertexDecl: 'attribute vec4 _mask; uniform vec4 uEmS; varying vec4 vEM; varying vec3 vEO;\n',
  vertexBend: 'vEO = position*uEmS.w + uEmS.xyz; vEM = _mask;',
  fragmentPars: /* glsl */`
    uniform float uHeat, uEmT, uSide; varying vec4 vEM; varying vec3 vEO; vec3 emGlow;
    vec3 emH(vec3 p) { p = fract(p*vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx)*p.zyx); }
    vec3 emCell(vec3 x) {
      vec3 n = floor(x), f = x - n, b = step(.5, f) - 1.0; float F1 = 9.0, F2 = 9.0, id = 0.0;
      for (int k = 0; k < 2; k++) for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
        vec3 g = b + vec3(float(i), float(j), float(k)), h = emH(n + g), r = g + h - f; float d = dot(r, r);
        if (d < F1) { F2 = F1; F1 = d; id = h.x; } else if (d < F2) F2 = d;
      }
      return vec3(sqrt(F1), sqrt(F2), id);
    }`,
  albedo: /* glsl */`
    if (uSide > .5) {      // water: the same cells, running up the body, deep at the middle and bright where the surface turns from the eye
      vec3 p = vEO*vec3(7.0, 5.0, 7.0); p.y -= uEmT*1.5; p += .4*sin(p.yzx*1.6 + uEmT*.7); vec3 c = emCell(p);
      float seam = c.y - c.x, line = 1.0 - smoothstep(.02, .22, seam), rim = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), ice = 1.0 - smoothstep(.2, .4, vEM.r);
      diffuseColor.rgb = mix(vec3(.012, .13, .24), vec3(.05, .42, .62), rim*rim) + vec3(.22, .36, .42)*ice;
      emGlow = vec3(.20, .70, 1.0)*(line*(.22 + .5*rim) + pow(rim, 2.4)*.55 + .08) + vec3(.8, .95, 1.0)*(pow(rim, 6.0)*.5 + vEM.g*2.4) + vec3(.1, .5, .9)*smoothstep(7.0, 34.0, length(vViewPosition))*.8;
    } else
    { vec3 p = vEO*vec3(10.0, 8.0, 10.0); p += .32*sin(p.yzx*1.4); vec3 c = emCell(p);
      float seam = c.y - c.x, line = 1.0 - smoothstep(.02, .15, seam), halo = 1.0 - smoothstep(.04, .62, seam);
      float run = .62 + .38*sin(vEO.y*5.0 - uEmT*2.4 + c.z*6.283), hot = clamp(vEM.r, 0.0, 1.0)*uHeat;
      float T = line*(.34 + .66*hot)*run*smoothstep(0.0, .22, uHeat);
      diffuseColor.rgb *= mix(vec3(.030, .024, .024), vec3(.095, .074, .066), c.z*c.z)*(1.0 - .55*line);
      vec3 ramp = mix(vec3(.86, .10, .012), vec3(1.0, .40, .05), clamp(T*1.7, 0.0, 1.0)); ramp = mix(ramp, vec3(1.0, .86, .46), clamp(T*3.0 - 1.5, 0.0, 1.0));
      float faraway = smoothstep(7.0, 34.0, length(vViewPosition));      // the seams go under a pixel with distance, and their light doesn't: the whole figure takes it on, so he reads as fire from far off
      emGlow = ramp*(T*T*7.0 + halo*hot*.42) + vec3(1.0, .62, .22)*vEM.g*3.4*(.3 + .7*uHeat) + vec3(1.0, .34, .05)*pow(hot, 3.0)*1.1 + vec3(1.0, .30, .05)*faraway*uHeat*.9*(1.0 - vEM.a); }`,
  glow: 'ocGlow = emGlow;',
};
