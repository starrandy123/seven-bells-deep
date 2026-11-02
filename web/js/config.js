// Shared by every module. The title lives here and nowhere else until a name passes the check.
import * as THREE from 'three';

export const TITLE = 'Seven Bells Deep';

// Blender metres (x, y, z up, sea level 0) to three.js and back. All json is in Blender coordinates.
export const W = (x, y, z) => new THREE.Vector3(x, z, -y);
export const toB = (v) => ({ x: v.x, y: -v.z, z: v.y });

const q = new URLSearchParams(location.search);
export const FLAG = {
  demo: q.has('demo'), film: q.has('film'), qa: q.has('qa'), fly: q.has('fly'), fresh: q.has('fresh'), tier: q.get('tier'),
};

// A phone on a bad line, or a file the CDN hasn't got yet, can fail once and be there a second later. A core file is asked for three times before the game gives up
export const retry = async (go, n = 3) => { for (let i = 1; ; i++) { try { return await go(); } catch (e) { if (i >= n) throw e; await new Promise((r) => setTimeout(r, 500 * i)); } } };

export const TOUCH = !!(window.__MOSA_DEVICE && window.__MOSA_DEVICE.touch) || matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

// phone: no composer, about one megapixel. desktop: the fuller look.
export function detectTier() {
  if (FLAG.tier === 'phone' || FLAG.tier === 'desktop') return FLAG.tier;
  return TOUCH || Math.min(innerWidth, innerHeight) < 500 ? 'phone' : 'desktop';
}

// Pixels are capped, never the ratio alone: a 3x phone draws about 1.3 megapixels.
export function pixelRatioFor(tier, w, h) {
  const real = window.devicePixelRatio || 1;
  const cap = tier === 'phone' ? 1.3e6 : 2.4e6;
  return Math.max(1, Math.min(real, Math.sqrt(cap / Math.max(1, w * h))));
}

// the build, said on the title and the pause screen. One number on every door: the platform bakes its own into the page, but the owner's page and a play link count differently (31 and 2 on one upload). The next upload's number on NotesMosaic, set before it goes up
export const BUILD = 68;
