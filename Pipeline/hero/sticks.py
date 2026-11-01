# A quick look at clips with no Blender and no browser: stick figures from the same bones, front and side, as a PNG sheet. A first check for gross faults; the eye's judgement is still the game's camera.
#   python3 sticks.py <out.png> <clip> [clip ...]        uses skeleton_hero.json; add reaver: as the first clip to use the Reaver's
import json, math, os, struct, sys, zlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import moves
W, H = 150, 190
def png(path, w, h, px):
    raw = b''.join(b'\0' + bytes(px[y * w * 3:(y + 1) * w * 3]) for y in range(h))
    def chunk(t, d): c = struct.pack('>I', len(d)) + t + d; return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))
def line(px, w, h, a, b, c):
    n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
    for i in range(n + 1):
        x = int(a[0] + (b[0] - a[0]) * i / n); y = int(a[1] + (b[1] - a[1]) * i / n)
        for dx in (0, 1):
            for dy in (0, 1):
                X, Y = x + dx, y + dy
                if 0 <= X < w and 0 <= Y < h: o = (Y * w + X) * 3; px[o:o + 3] = bytes(c)
def pose(sk, c, i):
    Q = {b: c['q'][b][i] for b in moves.KEYED}; P = {}; G = {}
    P['hips'] = moves.add(sk.pos['hips'], c['off'][i]); G['hips'] = Q['hips']
    for b in moves.ORDER:
        if b in ('root', 'hips'): continue
        pa = moves.PARENT[b]; P[b] = moves.add(P[pa], moves.qrot(G[pa], sk.off[b])); G[b] = moves.qmul(G[pa], Q[b])
    g = moves.add(P['hand_R'], moves.qrot(G['hand_R'], sk.off['weapon'])); s = moves.qrot(moves.qmul(G['hand_R'], Q['weapon']), sk.shaft['R'])
    P['tip'] = moves.add(g, moves.mul(s, moves.TIP_LEN)); P['butt'] = moves.add(g, moves.mul(s, -0.95)); return P
BONES = [('hips', 'spine_1', 0), ('spine_1', 'spine_2', 0), ('spine_2', 'spine_3', 0), ('spine_3', 'neck', 0), ('neck', 'head', 0), ('spine_3', 'clav_R', 1), ('clav_R', 'arm_R', 1), ('arm_R', 'fore_R', 1), ('fore_R', 'hand_R', 1),
         ('spine_3', 'clav_L', 2), ('clav_L', 'arm_L', 2), ('arm_L', 'fore_L', 2), ('fore_L', 'hand_L', 2), ('hips', 'leg_R', 1), ('leg_R', 'shin_R', 1), ('shin_R', 'foot_R', 1), ('foot_R', 'toe_R', 1), ('hips', 'leg_L', 2), ('leg_L', 'shin_L', 2), ('shin_L', 'foot_L', 2), ('foot_L', 'toe_L', 2), ('butt', 'tip', 3)]
COL = [(230, 230, 230), (255, 120, 90), (110, 190, 255), (255, 220, 90)]
def main():
    out = sys.argv[1]; names = sys.argv[2:]; who = 'hero'
    if names[0] == 'reaver:': who = 'reaver'; names = names[1:]
    data = json.load(open(os.path.join(HERE, 'out', 'skeleton_%s.json' % who)))
    sk, clips = moves.bake(data, moves.REAVER_CLIPS if who == 'reaver' else None)
    cols = 12; rows = len(names); w = W * cols; h = H * rows * 2; px = bytearray(b'\x18\x1c\x24' * (w * h))
    for r, name in enumerate(names):
        c = clips[name]; n = c['n']
        for k in range(cols):
            i = min(n, int(k * n / (cols - 1)))
            P = pose(sk, c, i); ox = W * k + W / 2
            for row, view in ((0, 0), (1, 1)):
                oy = (r * 2 + row) * H + H - 20; sc = 62.0
                pt = (lambda p: (ox - p[0] * sc, oy - p[2] * sc)) if view == 0 else (lambda p: (ox + (-p[1]) * sc, oy - p[2] * sc))      # front: his right on the left of the sheet; side: facing right
                line(px, w, h, (ox - 40, oy), (ox + 40, oy), (70, 80, 90))
                for a, b, co in BONES: line(px, w, h, pt(P[a]), pt(P[b]), COL[co])
    png(out, w, h, px); print(out, w, h)
main()
