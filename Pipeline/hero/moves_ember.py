# The Emberkin's moves. Plain Python, like moves.py, which it uses and never changes. No capture holds a body on a jet, so the flight is keyed: four poses the game blends by how it's
# really moving (web/js/ember.js). Every blow is capture: CMU subject 14's boxing and subject 135's front kick (mocap_cmu.py). `python3 moves_ember.py <skeleton.json>` runs alone and prints what it cut.
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import moves, mocap_cmu
from moves import QI, KEYED, FPS, qdot, qmul, qconj, qrot, qaxis, qslerp, unit, sub, length

def arm(d1, d2, palm=(0, 0, 0)): return {'fr': 'root', 'd1': d1, 'd2': d2, 'palm': palm}
def side(a, s):
    """The same arm on his left."""
    return {'fr': a['fr'], 'd1': (-a['d1'][0], a['d1'][1], a['d1'][2]), 'd2': (-a['d2'][0], a['d2'][1], a['d2'][2]), 'palm': (a['palm'][0], -a['palm'][1], -a['palm'][2])} if s == 'L' else a

# Standing on the jets: the soles and palms push down, the weight hangs from the chest, one knee rides high so he reads as held up and not as stood on nothing.
def fly_hover(sk, ph):
    a = 2 * math.pi * ph; s, c = math.sin(a), math.cos(a); s2 = math.sin(2 * a)
    R = arm((0.36, 0.05 + 0.01 * s, -0.93), (0.30, 0.16 + 0.02 * s, -0.94), (-34, 0, 0))
    return {'hips': (5 + 1.4 * s2, 2 * s, 1.2 * c), 'off': (0.0, 0.0, 0.016 * s2), 'spine': (3 + 1.5 * s2, 3 * c, 1.2 * s), 'head': (-3, -2 * c, 0), 'R': R, 'L': side(arm((0.36, 0.05 - 0.01 * s, -0.93), (0.30, 0.16 - 0.02 * s, -0.94), (-34, 0, 0)), 'L'),
            'legR': (-8 + 2.2 * s2, 2, 4, -15 - 3 * s2, -46, 0), 'legL': (30 - 3 * s, -5, -6, -56 + 4 * s, -40, 0), 'grip': (0.0, 0.3)}

# Flat out: the body lies along the way he's going (the game tilts him), so the clip has the rest: back arched, head up to see, arms swept behind him with the palms driving back, legs trailing, loose.
def fly_forward(sk, ph):
    a = 2 * math.pi * ph; s, c = math.sin(a), math.cos(a)
    return {'hips': (-5, 2 * s, 2 * c), 'off': (0.0, 0.0, 0.0), 'spine': (-15 - 1.5 * c, -3 * s, 2 * s), 'head': (-46, 2 * s, 0),
            'R': arm((0.40, -0.56, -0.72), (0.26, -0.80, -0.54), (-44, 0, 0)), 'L': side(arm((0.40, -0.56, -0.72), (0.26, -0.80, -0.54), (-44, 0, 0)), 'L'),
            'legR': (-10 + 5 * s, 2, 3, -12 - 8 * s, -54, 0), 'legL': (-3 - 5 * s, -2, -3, -30 + 9 * s, -54, 0), 'grip': (0.0, 0.3)}

# Everything on: arms locked straight back, legs together, chin up, the whole body shaking with it.
def fly_boost(sk, ph):
    a = 2 * math.pi * ph; s = math.sin(a); j = math.sin(2 * a) * 0.8
    return {'hips': (-7, 0, 1.2 * s), 'off': (0.0, 0.0, 0.0), 'spine': (-20 + j, 0, 1.2 * s), 'head': (-52 + j, 0, 0),
            'R': arm((0.20, -0.90, -0.38), (0.13, -0.96, -0.24), (-30, 0, 0)), 'L': side(arm((0.20, -0.90, -0.38), (0.13, -0.96, -0.24), (-30, 0, 0)), 'L'),
            'legR': (-8 + 1.6 * s, 1, 1, -5, -62, 0), 'legL': (-11 - 1.6 * s, -1, -1, -10, -62, 0), 'grip': (0.0, 0.3)}

# Stopping: the legs swing out in front and the palms push ahead of him, so the jets are aimed the way he's going.
def fly_brake(sk, ph):
    a = 2 * math.pi * ph; s = math.sin(a); c = math.cos(a)
    return {'hips': (15, 1.5 * s, 0), 'off': (0.0, 0.0, 0.0), 'spine': (15 + 1.2 * c, 0, 1.2 * s), 'head': (-16, 0, 0),
            'R': arm((0.40, 0.56, -0.72), (0.20, 0.90, -0.40), (-72, 0, 0)), 'L': side(arm((0.40, 0.56, -0.72), (0.20, 0.90, -0.40), (-72, 0, 0)), 'L'),
            'legR': (54 + 2 * s, 3, 5, -62 + 2 * c, -18, 0), 'legL': (38 - 2 * s, -3, -5, -42 - 2 * c, -24, 0), 'grip': (0.0, 0.3)}

LOOPS = {'fly_hover': (fly_hover, 72), 'fly_forward': (fly_forward, 36), 'fly_boost': (fly_boost, 18), 'fly_brake': (fly_brake, 48)}

# The blows, as (take, what strikes, seconds of its peak). The file's peak is where the hand or foot moves fastest; the clip runs from before his weight starts to after he's back. Read off a stick sheet, 1 Nov.
BLOWS = {'e_cross': ('14_03', 'hand_R', 11.87, 0.60, 0.65), 'e_blast': ('14_03', 'hand_R', 20.63, 0.62, 0.55), 'e_hook': ('14_02', 'hand_R', 14.93, 0.55, 0.60), 'e_jab': ('14_02', 'hand_L', 16.50, 0.45, 0.50), 'e_kick': ('135_03', 'foot_R', 1.43, 0.62, 0.78)}
GUARD = ('14_01', 1.4)        # the stillest stretch of a guard in that take is found, then closed on itself

def end_of(sk, Q, bone):
    """Where a hand or a foot is, against his hips, in the fighter's space."""
    chain = {'hand': ['spine_1', 'spine_2', 'spine_3', 'clav_', 'arm_', 'fore_', 'hand_'], 'foot': ['leg_', 'shin_', 'foot_']}[bone[:4]]; s = bone[-1]
    P, G = moves.fk_chain(sk, Q, [c + s if c.endswith('_') else c for c in chain], sk.pos['hips'], QI if False else Q['hips']); return P

def facing(sk, S, a, b, end, peak):
    """The turn that sets a take's blow going straight ahead: what strikes, at its peak, ahead of him. A hand in a take stands wherever the actor faced."""
    p = end_of(sk, S[peak], end); yaw = math.degrees(math.atan2(p[0], -p[1])); return qaxis((0.0, 0.0, 1.0), -yaw)

def cut(sk, S, name):
    take, end, peak_s, before, after = BLOWS[name]; peak = int(peak_s * FPS); a, b = peak - int(before * FPS), peak + int(after * FPS); fix = facing(sk, S, a, b, end, peak)
    tracks = {x: [] for x in KEYED}
    for i in range(a, b + 1):
        for x in KEYED:
            q = S[i].get(x, QI)
            if x == 'hips': q = qmul(fix, q)
            if tracks[x] and qdot(tracks[x][-1], q) < 0: q = tuple(-v for v in q)
            tracks[x].append(q)
    n = b - a; return {'n': n, 'q': tracks, 'off': [(0.0, 0.0, 0.0)] * (n + 1), 'loop': False, 'miss': 0.0, 'contact': round(before, 3), 'strikes': end}

def still(sk, S, seconds):
    """The stillest stretch of guard: the frames where neither hand moves much, and the hands stay up."""
    n = int(seconds * FPS); P = [(end_of(sk, q, 'hand_R'), end_of(sk, q, 'hand_L')) for q in S]; best, at = 1e9, 0
    for a in range(0, len(S) - n - 1, 3):
        v = sum(length(sub(P[i + 1][0], P[i][0])) + length(sub(P[i + 1][1], P[i][1])) for i in range(a, a + n))
        low = sum(max(0.0, 0.42 - P[i][0][2]) + max(0.0, 0.42 - P[i][1][2]) for i in range(a, a + n, 4))          # hands dropped below the chest isn't a guard
        if v + low * 4 < best: best, at = v + low * 4, a
    return at, n

def guard(sk, S):
    a, n = still(sk, S, GUARD[1]); fade = 12; mid = S[a + n // 2]; p = end_of(sk, mid, 'hand_L'); fix = qaxis((0.0, 0.0, 1.0), -math.degrees(math.atan2(p[0], -p[1])))
    tracks = {x: [] for x in KEYED}
    for k in range(n):
        Q = S[a + k]
        if k < fade:
            t = k / float(fade); t = t * t * (3 - 2 * t); Q1 = S[a + k + n]; Q = {x: qslerp(tuple(-v for v in Q1[x]) if qdot(Q1[x], Q[x]) < 0 else Q1[x], Q[x], t) for x in KEYED}
        for x in KEYED: tracks[x].append(qmul(fix, Q[x]) if x == 'hips' else Q[x])
    for x in KEYED:
        tracks[x].append(tracks[x][0])
        for i in range(1, n + 1):
            if qdot(tracks[x][i - 1], tracks[x][i]) < 0: tracks[x][i] = tuple(-v for v in tracks[x][i])
    return {'n': n, 'q': tracks, 'off': [(0.0, 0.0, 0.0)] * (n + 1), 'loop': True, 'miss': 0.0}

# Clips the Reavers' build already solves on any body: the keyed reactions. The rest of what they need comes from their own list
KEPT = ('hit_front', 'death', 'stagger', 'fall', 'land')

def bake(data):
    sk, out = moves.bake(data, KEPT); moves.ARMED[0] = False
    for name, (fn, n) in LOOPS.items():
        c = moves.bake_proc(sk, (lambda ph, f=fn: f(sk, ph)), n); c['loop'] = True; c['miss'] = 0.0; out[name] = c
    takes = {}
    def take(t):
        if t not in takes: takes[t] = mocap_cmu.trial(sk, t)
        return takes[t]
    for name, b in BLOWS.items(): out[name] = cut(sk, take(b[0]), name)
    out['e_guard'] = guard(sk, take(GUARD[0]))
    return sk, out

def meta(clips):
    """What the game reads: each clip's length and, for a blow, when it lands."""
    return {k: {'dur': round(c['n'] / FPS, 4), 'loop': bool(c['loop']), **({'contact': c['contact']} if c.get('contact') is not None else {})} for k, c in clips.items()}

if __name__ == '__main__':
    data = json.load(open(sys.argv[1])); sk, clips = bake(data); print(json.dumps(meta(clips)))
