// The game's words and rules as data: web/data/*.json. They are small, so they load before the game's modules run (a top-level await).
// A file that fails to load leaves an empty table and a line in the console; G.data.broken names it and the title screen says so.
const NAMES = ['missions', 'dialogue', 'people', 'relics', 'codex', 'gear', 'upgrades', 'events', 'challenges', 'cinematics'];

async function one(name) {
  for (let i = 0; i < 3; i++) {      // a phone on a bad line can miss a file once
    try {
      const r = await fetch(`data/${name}.json`);
      if (r.ok) return await r.json();
      console.warn('data', name, r.status);
    } catch (e) { console.warn('data', name, e); }
    await new Promise((d) => setTimeout(d, 500 * (i + 1)));
  }
  return null;
}

const got = await Promise.all(NAMES.map(one));
export const DATA = { broken: [] };
NAMES.forEach((n, i) => { DATA[n] = got[i] || {}; if (!got[i]) DATA.broken.push(n); });
