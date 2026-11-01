// The frame data table, written from combat.json so it can't drift from the game.   node frames.mjs <web dir>
import fs from 'fs'; import path from 'path';
const D = JSON.parse(fs.readFileSync(path.join(process.argv[2], 'data/combat.json'))); const s = (f) => (f / 60).toFixed(2);
const c = (m, k) => (m.cancel && m.cancel[k] !== undefined ? m.cancel[k] : '–');
console.log('| Move | Clip | Wind-up | Active | Total | Dodge from | Parry from | Strike from | Power from | Walk out | Damage | Cost | Cooldown | Notes |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const id in D.moves) { const m = D.moves[id], n = []; if (m.iframes) n.push(`invulnerable ${m.iframes[0]}-${m.iframes[1]}`); if (m.guard) n.push(`guards ${m.guard[0]}-${m.guard[1]}`); if (m.chain) n.push(`→ ${m.chain}`); if (m.launch) n.push(`throws up ${m.launch} m/s`); if (m.shatters) n.push('breaks ice'); if (m.status) n.push(Object.entries(m.status).map(([k, v]) => `${k} ${v}`).join(' ')); if (m.freezes) n.push('freezes the attacker');
  console.log(`| ${m.name} \`${id}\` | ${m.clip || '–'} | ${m.startup} | ${m.active} | ${m.total} (${s(m.total)} s) | ${c(m, 'dodge')} | ${c(m, 'parry')} | ${c(m, 'strike')} | ${c(m, 'power')} | ${c(m, 'free')} | ${m.damage || '–'} | ${m.cost || '–'} | ${m.cooldown ? m.cooldown + ' s' : '–'} | ${n.join('; ')} |`); }
console.log('\n| Foe | HP | Poise | Counter | Blow | Tell | Can land for | Open after | Damage |\n|---|---|---|---|---|---|---|---|---|');
for (const k in D.foes) { if (k === '_doc') continue; const F = D.foes[k]; for (const b of F.blows) console.log(`| ${F.name} | ${F.hp} | ${F.poise} | ${F.counter || ''} | ${b.id}${b.unblockable ? ' (dodge only)' : ''} | ${b.tell_s} s | ${b.strike_s} s | ${b.recover_s} s | ${b.damage} |`); }
