// The named people: where they stand, what they want to say, who has a mission to offer. Their words are data (people.json, dialogue.json).
// Until the villager bodies arrive a person is a robed figure, one instanced draw; the drowned citizens are the same figure in ghost light.
import * as THREE from 'three';
import { DATA } from './data.js';
import { paintPortrait } from './portraits.js';

export function createPeople(G, Q) {
  const list = (DATA.people.people || []).map((d) => ({ ...d, at: d.at, pl: null, want: [], heard: {}, barkAt: 0, offer: null, moved: null }));
  const byId = new Map(list.map((p) => [p.id, p]));
  const portraits = new Map();
  const h = G.hero;
  const mat = G.look.patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }), {});
  const solid = new THREE.InstancedMesh(G.things.bodyGeo, mat, Math.max(1, list.length)); solid.frustumCulled = false; solid.count = 0; G.scene.add(solid);
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x9ff4ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const ghost = new THREE.InstancedMesh(G.things.bodyGeo, ghostMat, Math.max(1, list.length)); ghost.frustumCulled = false; ghost.count = 0; ghost.renderOrder = 18; G.scene.add(ghost);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), s1 = new THREE.Vector3(1, 1, 1), qI = new THREE.Quaternion(), v = new THREE.Vector3();

  function where(p) {
    if (!p.pl) p.pl = Q.place(p.moved || p.at, 0.5);
    return p.pl.p;
  }
  const visible = (p) => p.want.length > 0 || (!p.gone && (!p.after || Q.m().isDone(p.after) || Q.m().flags[p.after]));

  function lay() {
    let a = 0, b = 0;
    for (const p of list) {
      if (!visible(p)) continue;
      v.copy(where(p)); m4.compose(v, qI, s1.setScalar(p.scale || 1));
      if (p.ghost) ghost.setMatrixAt(b++, m4);
      else { solid.setMatrixAt(a, m4); solid.setColorAt(a, col.set(p.body || '#2d6a78')); a++; }
    }
    solid.count = a; ghost.count = b; solid.instanceMatrix.needsUpdate = true; ghost.instanceMatrix.needsUpdate = true;
    if (solid.instanceColor) solid.instanceColor.needsUpdate = true;
  }

  // who has something for the Warden: a gold mark over them
  const marks = new Map();
  function refresh() {
    const m = Q.m();
    for (const p of list) {
      p.offer = null;
      if (!visible(p)) continue;
      for (const def of m.defs.values()) if (def.giver === p.id && m.offerable(def)) { p.offer = def; break; }
      const wantMark = !!(p.offer || p.want.length);
      if (wantMark && !marks.has(p.id)) marks.set(p.id, G.things.add('glint', v.copy(where(p)).add(new THREE.Vector3(0, 2.5, 0)), { scale: 0.38 }));
      if (!wantMark && marks.has(p.id)) { G.things.remove(marks.get(p.id)); marks.delete(p.id); }
    }
    lay();
  }

  function pickChat(p) {
    let best = null;
    for (const c of p.chat || []) { if (!c.after || Q.m().isDone(c.after)) best = c; }
    return best;
  }

  function talk(id) {
    const p = byId.get(id); if (!p || Q.talking()) return false;
    Q.face(where(p));
    if (p.want.length) {
      const { m, o } = p.want[0];
      Q.dialogue(o.dialogue, () => { Q.m().fire('talked', m); }, { npc: p });
      return true;
    }
    if (p.offer) {
      const def = p.offer;
      Q.dialogue(def.offer, () => { Q.m().start(def.id); Q.m().track(def.id); Q.milestone(); }, { npc: p });
      return true;
    }
    const c = pickChat(p);
    if (c) { const key = c.d; if (!p.heard[key]) { p.heard[key] = 1; Q.dialogue(c.d, null, { npc: p }); return true; } }
    const b = p.barks || []; if (b.length) { Q.bark(p.id, b[Math.floor(G.time * 7) % b.length], 4.5); return true; }
    return false;
  }

  let t = 0;
  function step(dt) {
    if ((t -= dt) > 0) return; t = 0.3;
    for (const p of list) {
      if (!visible(p) || !p.barks || !p.barks.length) continue;
      if (p.want.length || p.offer) continue;
      const d = where(p).distanceTo(h.pos);
      if (d < 11 && G.time > p.barkAt && !Q.talking()) { p.barkAt = G.time + 45; Q.bark(p.id, p.barks[Math.floor(G.time * 3) % p.barks.length], 4.5); }
    }
  }

  function nearest(r = 6.5) {
    // whoever is waiting for him comes first, then whoever has something to ask, then whoever is closest
    let best = null, bd = 1e9;
    for (const p of list) {
      if (!visible(p)) continue;
      const d = where(p).distanceTo(h.pos); if (d >= r) continue;
      const score = d - (p.want.length ? 100 : p.offer ? 50 : 0);
      if (score < bd) { bd = score; best = p; }
    }
    return best;
  }

  return {
    list, byId, step, refresh, talk, nearest,
    pos(id) { const p = byId.get(id); return p ? where(p) : null; },
    dist(id) { const p = byId.get(id); return p && visible(p) ? where(p).distanceTo(h.pos) : 1e9; },
    want(id, m, o) { const p = byId.get(id); if (!p) { console.warn('no person', id); Q.m().fire('talked', m); return; } p.gone = false; if (o.at) { p.moved = o.at; p.pl = null; } if (!p.want.some((w) => w.m === m)) p.want.push({ m, o }); refresh(); },
    unwant(id, m) { const p = byId.get(id); if (p) p.want = p.want.filter((w) => w.m !== m); },
    move(id, at) { const p = byId.get(id); if (p) { p.gone = false; if (at === null) p.gone = true; else { p.moved = at; p.pl = null; } refresh(); } },
    reset() { for (const p of list) { p.moved = null; p.pl = null; p.gone = false; p.want = []; p.heard = {}; p.offer = null; } for (const it of marks.values()) G.things.remove(it); marks.clear(); },
    packMoves() { const o = {}; for (const p of list) if (p.moved || p.gone) o[p.id] = p.gone ? null : p.moved; return o; },
    unpackMoves(o) { for (const id in o || {}) { const p = byId.get(id); if (p) { if (o[id] === null) p.gone = true; else { p.moved = o[id]; p.pl = null; } } } },
    packHeard() { const o = {}; for (const p of list) { const k = Object.keys(p.heard); if (k.length) o[p.id] = k; } return o; },
    unpackHeard(o) { for (const id in o || {}) { const p = byId.get(id); if (p) for (const k of o[id]) p.heard[k] = 1; } },
    portrait(id) {
      if (portraits.has(id)) return portraits.get(id);
      const p = byId.get(id) || (DATA.people.extra || {})[id]; const url = p ? paintPortrait(id, { ...(p.portrait || {}), ghost: p.ghost }) : '';
      portraits.set(id, url); return url;
    },
    nameOf(id) { const p = byId.get(id) || (DATA.people.extra || {})[id]; return p ? p.name : id; },
  };
}
