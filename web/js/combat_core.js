// The rules of a move, frame by frame: the press buffer, what cancels into what, what a press means right now. No three.js and no page in here:
// the walls in web_check/combat import this file in Node and step these same lines.

export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Which class of input a press belongs to, for a move's `cancel` table.
export const CLASS = { strike: 'strike', dodge: 'dodge', parry: 'parry', slot1: 'power', slot2: 'power', slot3: 'power', slot4: 'power', call: 'power', song: 'power', pack: 'power', breach: 'power', cast: 'power', spout: 'power' };

/** A press lives this many frames, so a press a moment early still counts. Oldest first, and each press is used once. */
export function createBuffer(life) {
  const list = [];
  return {
    list,
    push(kind, now) { list.push({ kind, at: now }); if (list.length > 6) list.shift(); },
    expire(now) { for (let i = list.length - 1; i >= 0; i--) if (now - list[i].at > life) list.splice(i, 1); },
    take(accept) { for (let i = 0; i < list.length; i++) { const r = accept(list[i].kind); if (r) { list.splice(i, 1); return r; } } return null; },
    clear() { list.length = 0; },
  };
}

/** May this class of input start now, frame f of this move? `landed`: the move has connected. */
export function accepts(def, f, cls, landed) {
  const t = landed && def.cancel_hit && def.cancel_hit[cls] !== undefined ? def.cancel_hit[cls] : def.cancel && def.cancel[cls];
  return t !== undefined && f >= t;
}

export const phase = (def, f) => (f < def.startup ? 'startup' : f < def.startup + def.active ? 'active' : 'recover');
export const inFrames = (span, f) => !!span && f >= span[0] && f <= span[1];

/** The first frame any input at all is taken in this move, and the first an offensive one is: what a player waits for at worst. */
export function deadFrames(def) {
  const c = def.cancel || {}, all = ['dodge', 'parry', 'strike', 'power', 'free'].map((k) => c[k]).filter((v) => v !== undefined);
  const off = ['strike', 'power'].map((k) => c[k]).filter((v) => v !== undefined);
  return { any: all.length ? Math.min(...all) : def.total, offensive: off.length ? Math.min(...off) : def.total };
}

/**
 * What a press means right now. s is what the fight looks like:
 *  stance, air, cur (the running move's id), chainNext (the blow that follows if the last one is still warm),
 *  win: { dodge, parry, perfect } frames left in each after-window,
 *  finish: a staggered or frozen foe in reach, far: a foe past melee and inside whip range, near: a foe in reach,
 *  open(id), afford(id), cool(id): the power's state.
 */
export function resolve(data, press, s) {
  if (press === 'dodge') return 'dodge';
  if (press === 'parry') return s.stance === 'ice' && s.open('guard') ? 'guard' : 'parry';
  if (press === 'call' || press === 'pack') return 'call';
  if (press === 'spout') return 'spout';
  if (press === 'song') return 'shoalsong';
  if (press === 'breach') return 'breach';
  if (press === 'cast') return 'cast';
  if (press.startsWith('slot')) return data.stances[s.stance].slots[+press[4] - 1];
  if (press !== 'strike') return null;
  if (s.chainNext && (s.cur === 'air1' || s.cur === 'air2')) return s.chainNext;   // an aerial chain ends in its plunge, whatever else is ready
  if (s.finish && !(s.cur === 'finisher')) return 'finisher';
  if (s.win.perfect > 0) return 'counter';
  if (s.win.parry > 0) return 'riposte';
  if (s.chainNext) return s.chainNext === 'plunge' && !s.air ? 'strike1' : s.chainNext;
  if (s.win.dodge > 0 && s.near) return 'launcher';
  if (s.air) return s.near ? 'air1' : 'plunge';
  if (s.stance === 'water' && s.far && s.open('whip') && s.afford('whip') && s.cool('whip') <= 0) return 'whip';
  return 'strike1';
}

/** Every move's frame table is sound: the walls and the page both read this list, so a bad row is named before anyone plays it. */
export function audit(data) {
  const bad = [], ids = Object.keys(data.moves);
  for (const id of ids) {
    const d = data.moves[id];
    if (!(d.total >= 1)) bad.push(`${id}: no total`);
    if (d.startup + d.active > d.total) bad.push(`${id}: startup ${d.startup} + active ${d.active} over total ${d.total}`);
    if (d.chain && !data.moves[d.chain]) bad.push(`${id}: chain to unknown ${d.chain}`);
    for (const k of ['strike', 'power', 'dodge', 'parry', 'free']) { const v = d.cancel && d.cancel[k]; if (v !== undefined && v > d.total) bad.push(`${id}: cancel.${k} ${v} past total ${d.total}`); }
    if (d.clip && (!d.clip_t || d.clip_t.length !== 3)) bad.push(`${id}: clip with no clip_t`);
    if (d.clip_t && !(d.clip_t[0] <= d.clip_t[1] && d.clip_t[1] <= d.clip_t[2])) bad.push(`${id}: clip_t out of order`);
    if (d.kind === 'strike' && d.damage > 0 && !data.impacts[d.impact]) bad.push(`${id}: unknown impact ${d.impact}`);
    if (d.kind === 'power' && d.damage > 0 && !data.impacts[d.impact]) bad.push(`${id}: unknown impact ${d.impact}`);
  }
  for (const st of Object.keys(data.stances)) for (const p of data.stances[st].slots) if (!data.moves[p]) bad.push(`stance ${st}: unknown power ${p}`);
  return bad;
}
