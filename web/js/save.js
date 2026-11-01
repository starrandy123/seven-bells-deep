// One key holds the player's whole record. Every access is guarded: a private window or a blocked store must never stop the game (F3).
// On NotesMosaic the port kit keeps this key in the player's own row of the game's database, so it survives a reopen and follows them to
// another device; the host also keeps getGameState() when the player leaves and hands it back through loadGameState() on reopen (quest.js).
export const KEY = 'thalor.save.v2';
export const OLD_KEY = 'thalor.save.v1';

function store() {
  try { const ls = window.localStorage; if (ls) return ls; } catch (_) { /* blocked */ }
  return null;
}

let blocked = null;
// Can this browser keep a save? Asked once by writing a probe key; the answer is shown in Settings (Poki: tell players when progress won't be kept).
export function canSave() {
  if (blocked !== null) return !blocked;
  const ls = store();
  try { ls.setItem('thalor.probe', '1'); ls.removeItem('thalor.probe'); blocked = false; } catch (_) { blocked = true; }
  return !blocked;
}

export function readRaw(key = KEY) {
  try { const ls = store(); return ls ? ls.getItem(key) : null; } catch (_) { return null; }
}

// A broken or blocked store reads as a new player.
export function readSave() {
  const s = readRaw();
  if (s) { try { const o = JSON.parse(s); if (o && o.v === 2) return o; } catch (_) { /* a broken save is a new player */ } }
  const old = readRaw(OLD_KEY);
  if (old) { try { const o = JSON.parse(old); if (o) return { v: 1, ...o }; } catch (_) { /* same */ } }
  return null;
}

export function writeSave(obj) {
  try { const ls = store(); if (!ls) return false; ls.setItem(KEY, JSON.stringify(obj)); return true; } catch (_) { return false; }
}

export function clearSave() {
  try { const ls = store(); if (ls) { ls.removeItem(KEY); ls.removeItem(OLD_KEY); } } catch (_) { /* nothing to clear */ }
}

// The fog of war, one bit a cell, as text small enough to keep in the save.
export function packBits(bytes) {
  let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function unpackBits(text, into) {
  try { const s = atob(text); for (let i = 0; i < into.length && i < s.length; i++) into[i] = s.charCodeAt(i); return true; } catch (_) { return false; }
}
