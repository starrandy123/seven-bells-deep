# What a body allows, read from every clip with no Blender and no browser. python3 joints.py [clip ...]
#   elbow: a hinge, one way, 0-150° of flexion. knee: one way, 0-150°. forearm: the hand's twist about the forearm within what a forearm can turn. shoulder: in a rest clip the upper arm stays low.
#   The worst of each, and the clip it's in. This reads the baked poses themselves, after the springs and limits, so it sees what the game draws.
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import moves
ELBOW_MAX, KNEE_MAX, TWIST_MAX, UPPER_REST, HUMERAL_MAX = 150.0, 150.0, 95.0, 50.0, 105.0
REST = ('idle_tread', 'stand', 'walk')                # clips where the shoulder must not be held high: arm off the body by at most UPPER_REST
FIGHT_OK = ('super', 'boost', 'swim_fast', 'ride_grip')       # arms overhead in these on purpose

def world(sk, c, i):
    Q = {b: c['q'][b][i] for b in moves.KEYED}; P = {}; G = {}
    P['hips'] = moves.add(sk.pos['hips'], c['off'][i]); G['hips'] = Q['hips']
    for b in moves.ORDER:
        if b in ('root', 'hips'): continue
        pa = moves.PARENT[b]; P[b] = moves.add(P[pa], moves.qrot(G[pa], sk.off[b])); G[b] = moves.qmul(G[pa], Q[b])
    return P, G, Q

def bend(a, b, c, hinge0):
    """Signed flexion at b, degrees: + the way the joint folds, - past straight the wrong way. hinge0: the rest hinge carried with the upper bone."""
    d1 = moves.unit(moves.sub(b, a)); d2 = moves.unit(moves.sub(c, b)); ang = math.degrees(math.acos(moves.clamp(moves.dot(d1, d2), -1, 1)))
    return ang if moves.dot(moves.cross(d1, d2), hinge0) >= 0 else -ang

def twist_about(q, axis):
    """How far q turns about axis, degrees: its twist part."""
    v = (q[1], q[2], q[3]); p = moves.mul(axis, moves.dot(v, axis)); w = q[0]; l = math.sqrt(w * w + moves.dot(p, p)) or 1
    a = 2 * math.degrees(math.atan2(moves.length(p) * (1 if moves.dot(p, axis) >= 0 else -1), w)); return (a + 180) % 360 - 180

def main():
    data = json.load(open(os.path.join(HERE, 'out', 'skeleton_hero.json'))); sk, clips = moves.bake(data)
    only = set(sys.argv[1:]); rows = {}
    def note(kind, v, name, who, i):
        if kind not in rows or v > rows[kind][0]: rows[kind] = (v, name, who, round(i / moves.FPS, 2))
    bad = []
    for name, c in clips.items():
        if only and name not in only: continue
        n = len(c['q']['hips']); worst = {}
        for i in range(n):
            P, G, Q = world(sk, c, i)
            for s in 'RL':
                A = sk.arm[s]; h0 = moves.qrot(G['arm_' + s], A['hinge'])
                e = bend(P['arm_' + s], P['fore_' + s], P['hand_' + s], h0); note('elbow past 150', e, name, s, i); note('elbow backward', -e, name, s, i)
                L = sk.leg[s]; h1 = moves.qrot(G['leg_' + s], L['hinge']); k = bend(P['leg_' + s], P['shin_' + s], P['foot_' + s], h1); note('knee past 150', k, name, s, i); note('knee backward', -k, name, s, i)
                axis = moves.unit(sk.off['hand_' + s]); t = abs(twist_about(Q['hand_' + s], axis)); note('forearm twist', t, name, s, i); worst['twist'] = max(worst.get('twist', 0), t)
                # how far the upper arm has rolled about itself from where its way there would leave it: where the elbow points
                d = moves.unit(sk.off['fore_' + s]); d_now = moves.qrot(G['arm_' + s], d); Gc = moves.qmul(G['spine_3'], Q['clav_' + s])
                sw = moves.qfrommat if False else None
                up_off = math.degrees(math.acos(moves.clamp(-moves.dot(moves.qrot(moves.qconj(G['spine_3']), d_now), (0, 0, 1)), -1, 1)))
                if name in REST: note('arm off the body at rest', up_off, name, s, i)
                worst['elbow'] = max(worst.get('elbow', 0), e); worst['back'] = max(worst.get('back', 0), -e)
    print('worst, by what a body allows:')
    for k, lim in (('elbow past 150', ELBOW_MAX), ('elbow backward', 0.5), ('knee past 150', KNEE_MAX), ('knee backward', 0.5), ('forearm twist', TWIST_MAX), ('arm off the body at rest', UPPER_REST)):
        v = rows.get(k, (0, '-', '-', 0)); flag = 'FAIL' if v[0] > lim else 'PASS'
        print(f'  {flag} {k}: {v[0]:.1f}° (≤ {lim:.1f}) in {v[1]} {v[2]} at {v[3]} s')

if __name__ == '__main__': main()
