# Every clip's joints, read as the game plays them, with no Blender and no browser. python3 rates.py [clip ...]
#   a plain clip at rate 1; a move of web/data/combat.json as its frames rule its clip: wind-up and recovery at their own rates, the active frames apart.
#   M3b's bound outside the active frames is 1,500°/s, M3c's inside is 2,700°/s.
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import moves
BLOWS = ('atk1', 'atk2', 'atk3', 'atk_dash', 'atk_spin', 'cast_wave')

def per_key(c, b):
    q = c['q'][b]; return [2 * math.acos(min(1.0, abs(moves.qdot(q[i], q[i - 1])))) * 57.2958 * moves.FPS for i in range(1, len(q))]

def scan(sk, clips, only=None):
    rows = []
    for name, c in clips.items():
        if only and name not in only: continue
        top = (0.0, '', 0)
        for b in moves.KEYED:
            for i, r in enumerate(per_key(c, b)):
                if r > top[0]: top = (r, b, i + 1)
        rows.append((round(top[0]), name, top[1], round(top[2] / moves.FPS, 2)))
    rows.sort(reverse=True); return rows

def combat(sk, clips, path):
    rows = []
    D = json.load(open(path)); FPS = D['fps']
    for mid, d in D['moves'].items():
        clip, ct = d.get('clip'), d.get('clip_t')
        if not clip or clip not in clips or not ct: continue
        c = clips[clip]; S, A, T = d.get('startup', 0), d.get('active', 0), d.get('total', 0)
        if T <= 0: continue
        r1 = (ct[1] - ct[0]) / (S / FPS) if S > 0 else 1.0; r2 = (ct[2] - ct[1]) / max(1e-3, (T - S) / FPS)
        out = (0.0, ''); act = (0.0, '')
        for f in range(T):
            t = ct[0] + r1 * (f / FPS) if f < S else ct[1] + r2 * ((f - S) / FPS)
            i = min(c['n'] - 1, int(t * moves.FPS)); rate = r1 if f < S else r2
            for b in moves.KEYED:
                r = per_key(c, b)[i] * rate
                if S <= f < S + A:
                    if r > act[0]: act = (r, b)
                elif r > out[0]: out = (r, b)
        rows.append((mid, clip, round(r1, 2), round(r2, 2), round(out[0]), out[1], round(act[0]), act[1]))
    return rows

if __name__ == '__main__':
    data = json.load(open(os.path.join(HERE, 'out', 'skeleton_hero.json')))
    sk, clips = moves.bake(data)
    only = set(sys.argv[1:]) or None
    print('clip at rate 1: peak °/s, joint, at s')
    for r in scan(sk, clips, only)[:40]: print('  ', r)
    p = os.path.join(HERE, '..', '..', 'web', 'data', 'combat.json')
    if os.path.exists(p) and not only:
        print('combat moves: id, clip, rate in wind-up, rate after, outside active °/s, joint, inside active °/s, joint')
        for r in combat(sk, clips, p): print('  ', r)
