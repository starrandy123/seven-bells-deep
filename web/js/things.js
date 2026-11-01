// What a mission puts in the world: nets to cut, lamps, embers, harpoons, relic tablets, rings to swim through, the beacon over the objective,
// and whoever follows the Warden on an escort. All of it is built by code, one instanced draw a kind, created only when a mission needs it.
import * as THREE from 'three';

const CAP = 32;
const AZ = new THREE.Vector3(0, 0, 1), AY = new THREE.Vector3(0, 1, 0);

// a small hand-tied net: diamonds with a knot at each crossing, cut out by alpha
function netTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.clearRect(0, 0, 128, 128); x.strokeStyle = '#d9cfae'; x.lineWidth = 3.4;
  for (let i = -128; i < 256; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.moveTo(i + 128, 0); x.lineTo(i, 128); x.stroke(); }
  x.fillStyle = '#efe6c8'; for (let i = 0; i < 128; i += 32) for (let j = 0; j < 128; j += 32) { x.beginPath(); x.arc(i, j, 3.4, 0, 6.3); x.arc(i + 16, j + 16, 3.4, 0, 6.3); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.5, 3); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
  return t;
}

// a stone slab with a raised rim and a lit groove: 0.86 x 1.3 m
function tabletGeometry() {
  const g = new THREE.BoxGeometry(0.86, 1.3, 0.16, 1, 1, 1), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = 0.72; col[i * 3 + 1] = 0.7; col[i * 3 + 2] = 0.62; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function robedBody() {
  // a simple robed figure, 1.72 m: until the villager bodies arrive this is how a person stands in the world
  const pts = [[0, 0], [0.29, 0], [0.26, 0.5], [0.22, 0.95], [0.26, 1.28], [0.2, 1.42], [0.08, 1.46], [0.08, 1.5], [0.12, 1.56], [0.13, 1.63], [0.1, 1.7], [0.03, 1.73], [0, 1.73]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 10);
}

export function createThings(G) {
  const kinds = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), eu = new THREE.Euler();

  const glow = (color, emi, i = 1.6, opts = {}) => G.look.patch(new THREE.MeshStandardMaterial({ color, emissive: emi, emissiveIntensity: i, roughness: 0.3, metalness: 0.1, ...opts }), {});
  const BUILD = {
    glint: () => ({ geo: new THREE.OctahedronGeometry(0.42, 0), mat: glow(0xffe9b8, 0xffc35a, 2.2), spin: 1.6, bob: 0.14 }),
    ember: () => ({ geo: new THREE.IcosahedronGeometry(0.46, 1), mat: glow(0xffa04a, 0xff5a1e, 3.4), spin: 0.7, bob: 0.1 }),
    shard: () => ({ geo: new THREE.TetrahedronGeometry(0.5, 0), mat: glow(0xdffaff, 0x7fe6ff, 2.4), spin: 1.2, bob: 0.1 }),
    raft: () => { const g = new THREE.BoxGeometry(4.6, 0.24, 3.2, 6, 1, 1); return { geo: g, mat: G.look.patch(new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.9 }), {}), spin: 0, bob: 0 }; },
    coral: () => { const src = G.props && (G.props.coral_brain || G.props.coral_table || G.props.rock_b); return src ? { geo: src.geometry, mat: src.material, spin: 0, bob: 0 } : { geo: new THREE.IcosahedronGeometry(1.3, 1), mat: glow(0xbfb6a2, 0x3a2a1a, 0.2), spin: 0, bob: 0 }; },
    wick: () => ({ geo: new THREE.CylinderGeometry(0.14, 0.2, 0.9, 8).translate(0, 0.45, 0), mat: glow(0xd9c9a0, 0xffb648, 1.6), spin: 0, bob: 0 }),
    net: () => {
      const g = new THREE.PlaneGeometry(5.4, 6.4, 8, 8), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 0.9 + p.getX(i) * 0.6) * 0.34);
      g.computeVertexNormals();
      return { geo: g, mat: G.look.patch(new THREE.MeshStandardMaterial({ map: netTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }), {}), spin: 0, bob: 0, sway: 0.08 };
    },
    harpoon: () => ({ geo: new THREE.CylinderGeometry(0.06, 0.1, 3.2, 6).rotateX(0.5), mat: G.look.patch(new THREE.MeshStandardMaterial({ color: 0x7a4a2c, roughness: 0.7, metalness: 0.5, emissive: 0x552211, emissiveIntensity: 0.6 }), {}), spin: 0, bob: 0 }),
    pup: () => ({ geo: new THREE.CapsuleGeometry(0.26, 0.5, 3, 8).rotateZ(1.5), mat: glow(0x7a5a3c, 0x3a2612, 0.5), spin: 0.4, bob: 0.1 }),
    ring: () => ({ geo: new THREE.TorusGeometry(5.4, 0.16, 8, 44), mat: new THREE.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), spin: 0, bob: 0, ring: true }),
    tablet: () => ({ geo: tabletGeometry(), mat: G.look.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, emissive: 0x68e8ff, emissiveIntensity: 0.55 }), {}), spin: 0.5, bob: 0.1 }),
    chest: () => { const src = G.props && G.props.chest; return src ? { geo: src.geometry, mat: src.material, spin: 0, bob: 0 } : { geo: new THREE.BoxGeometry(1.1, 0.7, 0.7), mat: glow(0x6a4426, 0x241204, 0.4), spin: 0, bob: 0 }; },
    bell_small: () => { const src = G.props && G.props.bell; return src ? { geo: src.geometry, mat: src.material, spin: 0, bob: 0, scale: 0.4 } : { geo: new THREE.SphereGeometry(0.5, 10, 8), mat: glow(0xc99a3f, 0x2a1a04, 0.4), spin: 0, bob: 0 }; },
    lamp: () => { const src = G.props && G.props.lamp; return src ? { geo: src.geometry, mat: src.material, spin: 0, bob: 0 } : { geo: new THREE.CylinderGeometry(0.14, 0.2, 1.6, 8), mat: glow(0xd9c9a0, 0xffb648, 1.6), spin: 0, bob: 0 }; },
  };

  function kind(name) {
    let k = kinds.get(name); if (k) return k;
    const b = (BUILD[name] || BUILD.glint)();
    const mesh = new THREE.InstancedMesh(b.geo, b.mat, CAP); mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.name = 'thing_' + name; mesh.renderOrder = b.ring ? 20 : 0;
    G.scene.add(mesh);
    k = { b, mesh, items: [], dirty: true, moving: !!(b.spin || b.bob || b.sway) };
    kinds.set(name, k); return k;
  }

  function add(name, p, o = {}) {
    const k = kind(name), it = { k, p: p.clone(), yaw: o.yaw !== undefined ? o.yaw : (p.x * 0.7 + p.z * 0.3) % 6.28, face: o.face || null, scale: (o.scale || 1) * (k.b.scale || 1) };
    if (k.items.length >= CAP) { console.warn('things full', name); return it; }
    k.items.push(it); k.dirty = true; return it;
  }
  function remove(it) {
    if (!it || !it.k) return; const i = it.k.items.indexOf(it);
    if (i >= 0) { it.k.items.splice(i, 1); it.k.dirty = true; }
  }

  let tick = 0;
  function update(t) {
    tick++;
    for (const k of kinds.values()) {
      if (!k.dirty && !(k.moving && tick % 2 === 0)) continue;
      k.dirty = false; const b = k.b;
      k.items.forEach((it, i) => {
        v.copy(it.p);
        if (b.bob) v.y += Math.sin(t * 1.4 + i * 1.7) * b.bob;
        if (it.face) q.setFromUnitVectors(AZ, it.face);
        else { eu.set(b.sway ? Math.sin(t * 0.9 + i) * b.sway : 0, it.yaw + (b.spin ? t * b.spin : 0), 0); q.setFromEuler(eu); }
        s.setScalar(it.scale); m4.compose(v, q, s); k.mesh.setMatrixAt(i, m4);
      });
      k.mesh.count = k.items.length; k.mesh.visible = k.items.length > 0; k.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  for (const name in BUILD) kind(name);        // every bank now, none during play: a program linked at first spawn stalls a phone for half a second

  // ------------------------------------------------------------------ the beacon: a thin column of light on what the compass points at
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 1.6, 90, 12, 1, true).translate(0, 45, 0),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uA: { value: 0 }, uC: { value: new THREE.Color(0xffd98a) } },
      vertexShader: 'varying vec2 vU; varying float vE; void main(){ vU = uv; vec4 mv = modelViewMatrix*vec4(position, 1.0); vE = abs(dot(normalize(normalMatrix*normal), normalize(-mv.xyz))); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform float uA; uniform vec3 uC; varying vec2 vU; varying float vE; void main(){ float e = sin(vU.x*3.14159*2.0)*.5 + .5; gl_FragColor = vec4(uC*uA*(1.0 - vU.y)*(1.0 - vU.y)*(.5 + .5*e)*smoothstep(0.0, 0.75, vE), 1.0); }',
    }),
  );
  beam.frustumCulled = false; beam.visible = false; beam.renderOrder = 22; G.scene.add(beam);
  function beacon(p, dt) {
    if (!p) { beam.visible = false; return; }
    beam.position.copy(p); beam.position.y -= 2; beam.visible = true;
    const d = p.distanceTo(G.camera.position), a = Math.min(1, Math.max(0, (d - 12) / 40)) * 0.42;
    beam.material.uniforms.uA.value += (a - beam.material.uniforms.uA.value) * Math.min(1, dt * 4);
    const w = 1 + Math.min(4, d / 90); beam.scale.set(w, 1, w);
  }

  // ------------------------------------------------------------------ an omen: what a world event looks like from 300 m off (G10): a storm column, a
  // glowing wake, a falling star, or a gyre of birds over the place. One column and one ring of specks, so it costs two draws, and only while one shows
  const OMEN = { storm: { c: 0x46566a, add: false, a: 0.62, h: 1 }, wake: { c: 0x6ff6ff, add: true, a: 0.5, h: 0.45 }, star: { c: 0xffefc4, add: true, a: 0.7, h: 1 }, gyre: { c: 0xffffff, add: true, a: 0.06, h: 0.4 } };
  const omenU = { uA: { value: 0 }, uC: { value: new THREE.Color() }, uHead: { value: -1 } };
  // from 80 m under the surface to 240 m over it: it isn't fogged, so a swimmer sees a shaft of it through the water, and the land still hides it
  const omenCol = new THREE.Mesh(new THREE.CylinderGeometry(5, 15, 320, 14, 1, true).translate(0, 80, 0), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: omenU,
    vertexShader: 'varying vec2 vU; varying float vE; void main(){ vU = uv; vec4 mv = modelViewMatrix*vec4(position, 1.0); vE = abs(dot(normalize(normalMatrix*normal), normalize(-mv.xyz))); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform float uA, uHead; uniform vec3 uC; varying vec2 vU; varying float vE; void main(){ float e = .55 + .45*sin(vU.x*25.0 + vU.y*9.0), k = (.55*smoothstep(0.0, .25, vU.y) + .45*step(.25, vU.y))*(1.0 - smoothstep(.25, 1.0, vU.y)), edge = smoothstep(0.0, 0.8, vE), b = uHead < 0.0 ? 0.0 : exp(-abs(vU.y - uHead)*70.0)*edge; gl_FragColor = vec4(uC + b, uA*k*e*edge + b); }',
  }));
  omenCol.frustumCulled = false; omenCol.visible = false; omenCol.renderOrder = 21; G.scene.add(omenCol);
  const birds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.9, 2.8, 3).rotateX(1.57), new THREE.MeshBasicMaterial({ color: 0x1a2430 }), 22); birds.frustumCulled = false; birds.visible = false; G.scene.add(birds);
  let omenOn = null, omenP = new THREE.Vector3(), omenT = 0, omenW = 1, omenSeen = null;
  function omen(kind, p, follow) {
    omenOn = kind ? OMEN[kind] || OMEN.storm : null; omenT = 0; omenCol.visible = !!omenOn; birds.visible = kind === 'gyre'; omenSeen = follow ? p : null; omenU.uHead.value = kind === 'star' ? 1 : -1;
    if (!omenOn) return;
    omenP.copy(p); omenP.y = Math.max(0, p.y); omenCol.position.copy(omenP); omenCol.scale.set(1, omenOn.h, 1); omenU.uC.value.set(omenOn.c);
    omenCol.material.blending = omenOn.add ? THREE.AdditiveBlending : THREE.NormalBlending;
  }
  function omenStep(t, dt) {
    if (!omenOn) return;
    omenT += dt; omenU.uA.value = Math.min(1, omenT / 2) * omenOn.a;
    if (omenSeen) { omenP.x = omenSeen.x; omenP.z = omenSeen.z; omenCol.position.copy(omenP); }                                  // a wake goes where the whale goes
    if (omenU.uHead.value >= 0) omenU.uHead.value = Math.max(0.25, 1 - omenT / 3);                                               // the star comes down, and stays where it fell
    omenW = Math.max(1, Math.min(6, omenP.distanceTo(G.camera.position) / 90));                                                   // birds have to read on a phone from 300 m; the column is broad enough
    if (!birds.visible) return;
    for (let i = 0; i < 22; i++) {
      const a = t * 0.5 + i * 0.285, r = 26 + 12 * Math.sin(i * 1.7); v.set(omenP.x + Math.cos(a) * r, 54 + 16 * Math.sin(a * 0.7 + i), omenP.z + Math.sin(a) * r);
      eu.set(0, -a, 0); q.setFromEuler(eu); s.setScalar(omenW); m4.compose(v, q, s); birds.setMatrixAt(i, m4);
    }
    birds.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ who follows the Warden on an escort
  const followers = [], trail = [];
  const bodyGeo = robedBody();
  const bodyMat = { diver: G.look.patch(new THREE.MeshStandardMaterial({ color: 0x2d6a78, roughness: 0.8 }), {}), goat: G.look.patch(new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.8 }), {}),
    ghost: new THREE.MeshBasicMaterial({ color: 0x9ff4ff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }),
    whale: G.creatures && G.creatures.whale ? G.look.patch(G.creatures.whale.material.clone(), {}) : null };
  for (const k in bodyMat) if (bodyMat[k]) { const stub = new THREE.Mesh(k === 'whale' ? G.creatures.whale.geometry : bodyGeo, bodyMat[k]); stub.visible = false; stub.frustumCulled = false; G.scene.add(stub); }    // so the precompile sees each
  function followerMesh(who, ghost) {
    if (who === 'whale' && bodyMat.whale) { const mesh = new THREE.Mesh(G.creatures.whale.geometry, bodyMat.whale); mesh.scale.setScalar(0.9); mesh.frustumCulled = false; return mesh; }
    const mesh = new THREE.Mesh(bodyGeo, ghost ? bodyMat.ghost : who === 'goat' ? bodyMat.goat : bodyMat.diver); if (who === 'goat') mesh.scale.set(0.8, 0.5, 1.4); mesh.frustumCulled = false; return mesh;
  }
  const followersApi = {
    add(who, p, o = {}) {
      const mesh = followerMesh(who, o.ghost); G.scene.add(mesh);
      const f = { who, mesh, pos: p.clone(), vel: new THREE.Vector3(), speed: o.speed || 11, gap: o.gap || 4, yaw: 0, land: !!o.land, t: Math.max(0, trail.length - 1) };
      followers.push(f); return f;
    },
    remove(f) { const i = followers.indexOf(f); if (i >= 0) followers.splice(i, 1); G.scene.remove(f.mesh); },
    step(dt) {
      const h = G.hero;
      // they come the way he came, so whoever follows gets round what he went round
      if (!followers.length) trail.length = 0;
      else if (!trail.length || trail[trail.length - 1].distanceTo(h.pos) > 5) { trail.push(h.pos.clone()); if (trail.length > 400) { trail.shift(); for (const f of followers) f.t = Math.max(0, f.t - 1); } }
      for (const f of followers) {
        const far = f.pos.distanceTo(h.pos) > 40;
        if (far) while (f.t < trail.length - 1 && trail[f.t].distanceTo(f.pos) < 7) f.t++;
        v.subVectors(far ? trail[f.t] : h.pos, f.pos); const d = far ? 1e3 : v.length(), l = v.length();
        const want = d > f.gap ? Math.min(f.speed, (d - f.gap) * 2.2) : 0; if (far) v.multiplyScalar(d / Math.max(l, 0.001));
        v.multiplyScalar(want / Math.max(d, 0.001)); f.vel.lerp(v, 1 - Math.exp(-3 * dt));
        f.pos.addScaledVector(f.vel, dt);
        // too big for the gap he took: out of his sight she goes on along his way, so nobody he's leading is ever left behind
        if (far && (f.holdT = (f.holdT || 0) + dt) > 3) { f.holdT = 0; if (f.pos.distanceTo(f.was || f.pos) < 4 && f.t < trail.length - 1) { f.t = Math.min(f.t + 3, trail.length - 1); f.pos.copy(trail[f.t]); } (f.was = f.was || f.pos.clone()).copy(f.pos); }
        const b = { x: f.pos.x, y: -f.pos.z, z: f.pos.y }, g = G.world.heightAt(b.x, b.y), landNow = g > -0.7;
        G.world.collide(b, f.who === 'whale' ? 2.5 : 0.6); f.pos.set(b.x, b.z, -b.y);
        if (landNow) f.pos.y = Math.max(f.pos.y, g + 0.05); else if (f.pos.y > -0.9) f.pos.y = -0.9;
        if (f.vel.lengthSq() > 0.2) f.yaw = Math.atan2(f.vel.x, f.vel.z);
        f.mesh.position.copy(f.pos); f.mesh.rotation.y = f.yaw; if (f.who !== 'whale') f.mesh.position.y -= 0.9;
      }
    },
    list: followers,
  };

  return { add, remove, update, beacon, omen, omenStep, kind, followers: followersApi, bodyGeo };
}

export { AY };
