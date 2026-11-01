# Drowned City: the map, from code (numpy, seeded: the same seed gives the same world). No Blender.
#   python build_world.py            writes web/assets/world.json, height.bin, biome.bin, Pipeline/world/preview/map.png
# Blender coordinates throughout: x east, y north, z up, sea level 0. The contract is GAME.md.
# Every kit piece's size and collision come from out/pieces.json, which build_props.py measures from the real meshes (never hand-sized).
# Until that file exists the PLAN below stands in, so the look builder has a world to work with.
import json, math, os, sys
from collections import defaultdict
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from mapkit import Perlin, fbm, ridged, sstep, lerp

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ASSETS = os.environ.get('WORLD_ASSETS') or os.path.join(ROOT, 'web', 'assets')        # a private stage while a map is being judged
OUT = os.path.join(HERE, 'out')
PREVIEW = os.path.join(HERE, 'preview')
for d in (ASSETS, OUT, PREVIEW):
    os.makedirs(d, exist_ok=True)

SEED = 1931
SIZE, GRID, DEPTH_SCALE = 2048.0, 1025, 260.0
TOP_M = 90.0                       # height.bin spans z = +TOP_M .. -DEPTH_SCALE: z = top_m - value / 65535 * (top_m + depth_scale_m)
ORIGIN = -1024.0
STEP = SIZE / (GRID - 1)
TAU = 2.0 * math.pi
rng = np.random.RandomState(SEED)
N = Perlin(SEED)

xs = ORIGIN + np.arange(GRID) * STEP
X, Y = np.meshgrid(xs, xs)        # X[j, i], row j = y

# ---------------------------------------------------------------- the plan: where the big things stand
# The middle of the sea is the first map's: Thalor, the reef, the kelp, the trench, Crown, Meridon. The new biomes take the ring round it: Rimehold and Frost Isle to the north, Wrackreach to the west, Cindermere to the south-east.
AX, AY = 20.0, 62.0               # the arena's centre, the heart of Thalor
RX, RY = 52.0, 44.0               # the oval, along the middle of its 9 m wall: about 95 m across inside
PLAZA = (20.0, -96.0)             # the colossus's plaza, on the road in from the reef
PLAZA_R = 42.0
ACRO = (152.0, 208.0)             # the high temple's hill
TOP_ACRO = 43.0
ARCH_P = (-34.0, -322.0)          # the sea arch on the reef's north lip
ISLET_P = (262.0, -556.0)         # Gull Rock, a small bare stack
SUNWARD = (-490.0, -628.0)        # Sunward Isle, 560 x 410 m: grasslands, west of the spawn
S_ROT, S_A, S_B = 0.2, 280.0, 205.0
CROWN = (405.0, -212.0)           # Crown Isle, 380 m across, volcanic, +85 m
MERIDON = (440.0, 246.0)          # Meridon, the Gilded City, on its shelf
RIME = (-40.0, 838.0)             # Rimehold, the Frozen Sea
RIME_R = (600.0, 148.0)
CAVES = (262.0, 842.0)            # the Rime Caves' great chamber
FORGE = (820.0, -716.0)           # the Drowned Forge
CONE = (640.0, -724.0)            # the Cinder Cone
FROST = (706.0, 812.0)            # Frost Isle
FROST_R = (232.0, 170.0)
FORT = (452.0, 792.0)             # its fortress, out on the ice shelf
CINDER = (752.0, -640.0)          # Cindermere, the Vent Fields
CINDER_R = (232.0, 296.0)
WRACK = (-826.0, 130.0)           # Wrackreach, the Ship Graveyard
WRACK_R = (156.0, 326.0)
KRAKEN = (-866.0, 40.0)           # the Kraken's lair: a pit in the graveyard's floor
SHRINE_REEF = (136.0, -446.0)
SHRINE_KELP = (-436.0, 26.0)
SHRINE_DEEP = (-118.0, 0.0)       # y comes from the trench's south wall, below
SHRINE_GILD = (492.0, 308.0)      # Meridon's bell, in the north-east quarter
MERIDON_SPIRE = (496.0, 158.0)    # the Gilded Spire: the one tower that reaches the air
NAVE_SPIRE = (-440.0, 92.0)       # the Nave Spire, on the kelp's great rib
SHRINE_RIME = (-140.0, 860.0)
SHRINE_CINDER = (704.0, -590.0)
SPAWN = (-26.0, -548.0)
WRECK = (430.0, 66.0)
NAVES_Y = (-118.0, 30.0, 178.0)   # the three long naves of the kelp cathedral
sc, ss = math.cos(S_ROT), math.sin(S_ROT)


def iso(lx, ly):
    """Sunward's own frame: lx along its long axis, ly across it, turned with the island."""
    return SUNWARD[0] + lx * sc - ly * ss, SUNWARD[1] + lx * ss + ly * sc


SUNWARD_HILL = iso(10.0, -12.0)   # its hill, about +58 m, the ruined temple on top: near the middle of the island, so it stands over the first shore he comes to
BAY_L = (252.0, 18.0)             # the harbour, in Sunward's frame
QX = 216.0                        # the quay's line, along Sunward's own axis
HOLLOW_L = (126.0, -8.0)          # Sunward Hollow, the village
HEAD_L = (214.0, 152.0)           # the headland for the light


def nave_y(k, x):
    """y of nave k's centreline at x: long, gently bowed, never ruler-straight."""
    b = NAVES_Y[k]
    return b + 14.0 * math.sin(x * 0.0072 + k * 1.9) + 6.0 * math.sin(x * 0.019 + k)


def trench_y(x):
    """y of the trench's centreline at x (works on arrays too)."""
    return 478.0 + 24.0 * np.sin(x * 0.0046 + 1.1) + 12.0 * np.sin(x * 0.0125 + 0.4)


def trench_half(x):
    """half widths of the canyon: at the rim, at the floor (150-200 m across)."""
    wr = 95.0 + 5.0 * np.sin(x * 0.009 + 2.0)
    wf = wr - (22.0 + 5.0 * np.sin(x * 0.021))
    return wr, wf


def trench_floor(x):
    return 182.0 - 46.0 * np.sin(x * 0.0056 - 0.4)      # 136 .. 228


def angdiff(a, b):
    return np.abs((a - b + np.pi) % TAU - np.pi)


def blur(a, passes=1):
    for _ in range(passes):
        a = (np.roll(a, 1, 0) + np.roll(a, -1, 0) + np.roll(a, 1, 1) + np.roll(a, -1, 1) + 4.0 * a) / 8.0
    return a


def strata(h, step, seed, sharp=(0.05, 0.4)):
    """Terrace a height into beds: steep risers, narrow ledges, the bed lines wandering. Used where rock shows."""
    q = h / step + 0.5 * fbm(N, X, Y, 1 / 64.0, 2, shift=seed)
    k = np.floor(q)
    return (k + sstep(sharp[0], sharp[1], q - k)) * step


# ---------------------------------------------------------------- the natural seabed (depths, metres, positive down; land is negative)
WX = X + 44.0 * fbm(N, X, Y, 1 / 240.0, 3, shift=11.0)
WY = Y + 44.0 * fbm(N, X, Y, 1 / 240.0, 3, shift=23.0)
LX = WX + 170.0 * fbm(N, X, Y, 1 / 780.0, 2, shift=13.0)    # the borders' long wander: on a map this size nothing natural runs straight
LY = WY + 170.0 * fbm(N, X, Y, 1 / 780.0, 2, shift=17.0)

# the plain floor round everything, then the slow drop to the east: the open blue
far = 72.0 + 9.0 * fbm(N, X, Y, 1 / 170.0, 4, shift=3.0)
east = sstep(210.0, 630.0, WX)
far = lerp(far, 150.0, east ** 1.15)
far += east * (5.0 * np.sin((X * 0.42 + Y * 0.91 + 90.0 * fbm(N, X, Y, 1 / 300.0, 2, shift=41.0)) * 0.021)
               + 3.0 * fbm(N, X, Y, 1 / 90.0, 3, shift=47.0))

# the reef shelf: 6-30 m, sand flats and coral heads, the north lip falls away toward the city
lip = -258.0 + 30.0 * fbm(N, X, Y * 0.0, 1 / 180.0, 3, shift=5.0) + (34.0 + 120.0 * sstep(130.0, 420.0, np.abs(X - 20.0))) * fbm(N, X, Y * 0.0, 1 / 560.0, 2, shift=6.0)
s = np.clip((Y + 640.0) / (lip + 640.0), 0.0, 1.0)
reef = 9.0 + 16.0 * s ** 1.15
reef += 3.5 * fbm(N, X, Y, 1 / 130.0, 4, shift=7.0)
patch = sstep(-0.02, 0.26, fbm(N, X, Y, 1 / 105.0, 3, shift=31.0))      # 1 in a coral garden, 0 on the sand
heads = 0.5 + 0.5 * fbm(N, X, Y, 1 / 36.0, 2, gain=0.42, shift=37.0)
reef -= patch * 7.0 * sstep(0.5, 0.82, heads)                           # coral heads, rounded, standing off the floor
flats = (1.0 - patch) * sstep(1.0, 0.8, s)
sway = 16.0 * fbm(N, X, Y, 1 / 75.0, 2, shift=61.0)
reef += flats * (0.34 * np.sin((Y * 0.96 + X * 0.28 + sway) * TAU / 10.0)
                 + 0.14 * np.sin((Y * 0.8 - X * 0.5 + sway * 1.4) * TAU / 6.3))   # the sand's long ripples
# nothing out here is a plane: long dunes of sand, 3 m crest to trough, and ridges of rock breaking through them
reef += flats * 1.5 * np.sin((X * 0.35 + Y * 0.94 + 60.0 * fbm(N, X, Y, 1 / 140.0, 2, shift=63.0)) * TAU / 52.0)
reef -= sstep(0.56, 0.84, ridged(N, X, Y, 1 / 64.0, 3, shift=65.0)) * (3.5 + 2.5 * (0.5 + 0.5 * fbm(N, X, Y, 1 / 24.0, 2, shift=67.0)))
reef += 0.5 * fbm(N, X, Y, 1 / 11.0, 2, shift=69.0)
reef = np.maximum(reef, 9.5 * sstep(30.0, 14.0, np.hypot(X - SPAWN[0], Y - SPAWN[1])))     # clear water where he starts
reef = np.clip(reef, 5.5, 31.0)
w_reef = sstep(lip + 15.0, lip - 7.0, Y) * sstep(600.0, 340.0, LX)

# the kelp cathedral: 25-70 m, three valleys (the naves) between ribs of rock
kv = Y + 12.0 * fbm(N, X, Y, 1 / 200.0, 2, shift=71.0)
ribs = np.zeros_like(X)
for ry in (-192.0, -44.0, 104.0, 252.0):
    ribs = np.maximum(ribs, np.exp(-((kv - ry) / 34.0) ** 2))
gaps = sstep(-0.25, 0.25, fbm(N, X, Y, 1 / 66.0, 3, shift=77.0))        # the ribs are broken into stacks and gaps
transept = sstep(36.0, 76.0, np.abs(WX - SHRINE_KELP[0]))               # a crossing, north-south, at the shrine
kelp = 65.0 + 3.5 * fbm(N, X, Y, 1 / 80.0, 4, shift=83.0)
kelp -= 37.0 * ribs * gaps * transept * (0.72 + 0.4 * ridged(N, X, Y, 1 / 44.0, 3, shift=89.0))
kelp = np.clip(kelp, 26.0, 69.0)
ke = np.sqrt(((LX + 424.0) / 262.0) ** 2 + ((LY - 58.0) / 322.0) ** 2) + 0.05 * fbm(N, X, Y, 1 / 90.0, 3, shift=78.0)
w_kelp = sstep(1.08, 0.94, ke)
del kv, ribs, gaps, transept

# Thalor's plateau: 40-65 m, the rim a low cliff over the moat that runs round it
city_e = np.sqrt(((WX - 22.0) / 268.0) ** 2 + ((WY - 54.0) / 244.0) ** 2)
city = 56.0 + 1.6 * fbm(N, X, Y, 1 / 130.0, 2, shift=91.0) + 7.0 * sstep(0.74, 0.98, city_e)
city -= (56.0 - TOP_ACRO) * np.exp(-(((X - ACRO[0]) / 74.0) ** 2 + ((Y - ACRO[1]) / 66.0) ** 2))
w_city = sstep(1.03, 0.975, city_e)

D = far.copy()
D = lerp(D, kelp, w_kelp)
D = lerp(D, reef, w_reef)
D = lerp(D, city, w_city)
del far, kelp, city
# cliffs round the moat: rock showing where the slope is steep
D += 5.0 * sstep(0.2, 1.0, 1.0 - np.abs(city_e - 1.06) / 0.09) * (ridged(N, X, Y, 1 / 34.0, 3, shift=101.0) - 0.55)

# the sill north of the trench: a broken ridge that wanders, with saddles a swimmer can use
sill = sstep(566.0, 628.0, LY) * sstep(712.0, 650.0, LY) * sstep(640.0, 420.0, LX)
D = lerp(D, 42.0 + 26.0 * fbm(N, X, Y, 1 / 150.0, 3, shift=113.0) + 8.0 * fbm(N, X, Y, 1 / 50.0, 3, shift=114.0), sill)

# Wrackreach: the ship graveyard: a long grey valley of drowned sand, 70-95 m, and the Kraken's pit in its floor
wr_e = np.sqrt(((WX - WRACK[0]) / WRACK_R[0]) ** 2 + ((WY - WRACK[1]) / WRACK_R[1]) ** 2)
wr_d = 84.0 + 7.0 * fbm(N, X, Y, 1 / 120.0, 3, shift=201.0) + 3.0 * np.sin((Y * 0.7 + X * 0.3 + 40.0 * fbm(N, X, Y, 1 / 200.0, 2, shift=203.0)) * 0.05)
D = lerp(D, wr_d, sstep(1.1, 0.9, wr_e))
kr = np.hypot(X - KRAKEN[0], (Y - KRAKEN[1]) * 0.8) + 8.0 * fbm(N, X, Y, 1 / 34.0, 3, shift=205.0)
kr_rim = 20.0 * np.exp(-((kr - 92.0) / 18.0) ** 2) * (0.6 + 0.5 * ridged(N, X, Y, 1 / 30.0, 3, shift=207.0))
D = D - kr_rim * sstep(1.15, 0.8, wr_e)                                 # its ragged rim of rock
# the pit: buttresses of rock run down its wall, the ledges wrapping round them, and its floor is broken rock, never a level plane
kth = np.arctan2(Y - KRAKEN[1], X - KRAKEN[0])
kr_s = kr + 28.0 * (1.0 - np.abs(np.sin(kth * 4.5 + 2.4 * fbm(N, X, Y, 1 / 110.0, 2, shift=213.0)))) ** 3
k_wall = strata(184.0 + 6.0 * fbm(N, X, Y, 1 / 30.0, 2, shift=209.0) - 110.0 * sstep(26.0, 82.0, kr_s), 13.0, 211)
k_floor = 190.0 - 16.0 * ridged(N, X, Y, 1 / 22.0, 3, shift=215.0) - 6.0 * fbm(N, X, Y, 1 / 9.0, 2, shift=217.0)
k_rough = 2.0 * fbm(N, X, Y, 1 / 7.0, 2, shift=219.0)                    # broken up close: no face of it a smooth plane
D = lerp(D, lerp(k_wall, k_floor, sstep(46.0, 28.0, kr_s)) + k_rough, sstep(92.0, 70.0, kr))

# Rimehold: the Frozen Sea: a shallow basin under an ice ceiling, 45-75 m, ribs of ice-scoured rock; the caves in its east
ri_e = np.sqrt(((LX - RIME[0]) / RIME_R[0]) ** 2 + ((WY - RIME[1]) / RIME_R[1]) ** 2) + 0.07 * fbm(N, X, Y, 1 / 110.0, 3, shift=220.0)
ri_d = 64.0 + 7.0 * fbm(N, X, Y, 1 / 100.0, 3, shift=221.0) - 12.0 * sstep(0.55, 0.95, ridged(N, X, Y, 1 / 90.0, 3, shift=223.0))
# the Rime Caves: where rock and ice meet: ridges rising to the underside of the ice, the tunnels between them running along the lines where a slow noise crosses zero
c_ang = fbm(N, X, Y, 1 / 150.0, 2, shift=225.0)
tun = sstep(0.11, 0.05, np.abs(c_ang))
cave_m = sstep(96.0, 150.0, WX) * sstep(420.0, 366.0, WX) * sstep(1.0, 0.82, ri_e)
ri_d = lerp(ri_d, lerp(4.4 + 0.6 * fbm(N, X, Y, 1 / 26.0, 2, shift=227.0), 30.0 + 7.0 * fbm(N, X, Y, 1 / 44.0, 3, shift=229.0), tun), cave_m)
D = lerp(D, ri_d, sstep(1.12, 0.94, ri_e))

# Frost Isle: an ice cap on a rock core, cold cliffs to the north and west, and a flat ice shelf reaching west to the fort
fx_, fy_ = X - FROST[0], Y - FROST[1]
fth = np.arctan2(fy_, fx_)
fr_e = np.sqrt((fx_ / FROST_R[0]) ** 2 + (fy_ / FROST_R[1]) ** 2) + 0.13 * fbm(N, X, Y, 1 / 90.0, 3, shift=231.0) + 0.04 * fbm(N, X, Y, 1 / 30.0, 2, shift=233.0)
# no plateau: the snow rolls up from the shore at several scales to a cap of hills, and the edge of the island is never the same height twice
fr_h = (2.0 + 7.0 * (0.5 + 0.5 * fbm(N, X, Y, 1 / 64.0, 2, shift=234.0))) * sstep(1.0, 0.9, fr_e) + (9.0 + 8.0 * fbm(N, X, Y, 1 / 120.0, 3, shift=235.0) + 3.0 * fbm(N, X, Y, 1 / 46.0, 2, shift=236.0) + 0.9 * fbm(N, X, Y, 1 / 16.0, 2, shift=238.0)) * sstep(0.96, 0.62, fr_e) + 34.0 * np.exp(-(np.hypot(fx_ * 0.9, fy_) / 118.0) ** 2) * (0.8 + 0.3 * ridged(N, X, Y, 1 / 70.0, 2, shift=237.0))
fr_h = lerp(fr_h, strata(fr_h, 5.0, 239), sstep(1.0, 0.86, fr_e) * 0.8 * sstep(-0.3, 0.6, np.cos(fth - 2.2)))           # ice cliffs in steps, on the north-west
fr_o = np.maximum(fr_e - 1.0, 0.0) * lerp(220.0, 90.0, sstep(-0.4, 0.4, -np.cos(fth - 2.2)))      # a stony shelf on the south and east, cliffs falling straight in to the north-west
fr_rk = sstep(0.6, 0.84, ridged(N, X, Y, 1 / 38.0, 3, shift=232.0)) * sstep(1.0, 1.03, fr_e) * sstep(1.24, 1.08, fr_e)
fr_o = fr_o - fr_rk * (fr_o + 2.0)                                       # rock and old ice whose crests break the waterline
D = np.where(fr_e < 1.0, -fr_h, np.minimum(D, fr_o))
del fx_, fy_, fth, fr_h, fr_o, fr_rk

# Cindermere: the Vent Fields: a basin of black rock 110-170 m deep, mounds round each vent, fissures across it
cm_e = np.sqrt(((WX - CINDER[0]) / CINDER_R[0]) ** 2 + ((WY - CINDER[1]) / CINDER_R[1]) ** 2)
cm_d = 152.0 + 10.0 * fbm(N, X, Y, 1 / 90.0, 4, shift=241.0) - 34.0 * sstep(0.62, 0.92, ridged(N, X, Y, 1 / 110.0, 3, shift=243.0))
D = lerp(D, np.maximum(D, cm_d), sstep(1.12, 0.92, cm_e))
# the Cinder Cone: one vent has built itself an island: black lava terraces out of the deep, a smoking crater. The one thing in the Vent Fields you see from the surface of the sea
cr_ = np.maximum(np.hypot(X - CONE[0], Y - CONE[1]) + 9.0 * fbm(N, X, Y, 1 / 44.0, 3, shift=245.0), 0.0)
cone = 160.0 - 196.0 * np.exp(-(cr_ / 130.0) ** 2.4) + 13.0 * np.exp(-(cr_ / 16.0) ** 2)   # an island near 120 m across, its rim 30 m out of the sea, the crater floor 20 m
# its flanks aren't a dome: lava ribs run down them with gullies between, a breach in the crater's rim lets the last flow out to sea, the flows end in tongues and rock at the waterline
cth_ = np.arctan2(Y - CONE[1], X - CONE[0])
c_w = sstep(16.0, 34.0, cr_) * sstep(150.0, 96.0, cr_)
cone = cone - 9.0 * c_w * (sstep(0.42, 0.86, ridged(N, np.cos(cth_) * 3.4, np.sin(cth_) * 3.4 + cr_ / 170.0, 1.0, 3, shift=248.0)) - 0.45)
cone = cone + 15.0 * np.exp(-(angdiff(cth_, 1.15) / 0.34) ** 2) * sstep(70.0, 14.0, cr_)        # the breach
cone = cone + 2.6 * fbm(N, X, Y, 1 / 24.0, 2, shift=246.0) + 0.8 * fbm(N, X, Y, 1 / 9.0, 2, shift=250.0)
c_rk = sstep(0.58, 0.84, ridged(N, X, Y, 1 / 34.0, 3, shift=251.0)) * sstep(108.0, 122.0, cr_) * sstep(168.0, 136.0, cr_)
cone = cone - c_rk * np.maximum(cone + 2.4, 0.0)                         # black reefs off the shore
D = np.minimum(D, lerp(cone, strata(cone, 5.0, 247), 0.65))
del c_w, c_rk

# the world's far edges rise, so it ends in a shelf of rock and not a cut (the east stays open blue)
rim = np.maximum.reduce([sstep(-944.0, -1014.0, LY), sstep(-956.0, -1016.0, LX), sstep(962.0, 1020.0, LY), sstep(-1000.0, -1022.0, Y), sstep(-1000.0, -1022.0, X), sstep(1000.0, 1022.0, Y)])
D = np.minimum(D, lerp(D, 8.5 + 7.0 * fbm(N, X, Y, 1 / 44.0, 3, shift=115.0), rim))

# Gull Rock: a low stack of bare tilted beds. Terrain, not a mesh: the sea floor itself, so the swimmer's hand and the eye agree to the centimetre and it costs no collider
ir = np.hypot((X - ISLET_P[0]) * 0.94, Y - ISLET_P[1]) + 10.0 * fbm(N, X, Y, 1 / 30.0, 2, shift=127.0)
gr = 15.0 * sstep(40.0, 8.0, ir) + 0.16 * (X - ISLET_P[0]) * sstep(44.0, 20.0, ir) * 0.25 - 1.0
gr = strata(gr, 2.3, 129)
D = lerp(D, 0.0, sstep(70.0, 40.0, ir))
D = np.where(ir < 40.0, np.minimum(D, -gr), D)
del gr


# Ice grounds on the shelf: a berg that has run aground is the sea floor's own mountain, standing from the bed through the sea. Terrain too: exact to touch, walkable, and no collider, where a thousand little solids could not hug it
def berg_stamp(cx, cy, rx, ry, top, seed, peaks=2):
    """Calved faces: the height falls away from a few flat planes, a tilted table on top, shoulders of older ice over it."""
    r = np.random.RandomState(seed)
    u, v = (X - cx) / rx, (Y - cy) / ry
    q = np.zeros_like(X)
    for i in range(9):
        a_ = r.uniform(0, TAU)
        q = np.maximum(q, (u * math.cos(a_) + v * math.sin(a_)) / r.uniform(0.74, 1.0))
    q = q + 0.05 * fbm(N, X, Y, 1 / 38.0, 3, shift=170.0 + seed)
    tilt = u * r.uniform(-0.1, 0.1) + v * r.uniform(-0.1, 0.1)
    h = top * 0.62 * (1.0 + tilt) * sstep(1.0, 0.82, q)
    for i in range(peaks):
        px, py = r.uniform(-0.42, 0.42), r.uniform(-0.42, 0.42)
        w = r.uniform(0.26, 0.4)
        h = np.maximum(h, top * (1.0 - np.hypot(u - px, v - py) / w) * sstep(1.0, 0.82, q))
    z_ = np.where(q < 1.0, h, -(q - 1.0) * (rx + ry) * 2.2)
    return np.where(q < 1.5, z_, -1e3), q


BERG_MASK = np.zeros_like(X, dtype=bool)
BERGS = [(-330.0, 842.0, 66.0, 48.0, 60.0, 401, 3)]
_br = np.random.RandomState(407)
for k in range(9):
    a_, r_ = _br.uniform(0, TAU), _br.uniform(1.12, 1.42)
    BERGS.append((FROST[0] + math.cos(a_) * FROST_R[0] * r_ * 1.1, FROST[1] + math.sin(a_) * FROST_R[1] * r_, _br.uniform(16.0, 30.0), _br.uniform(13.0, 24.0), _br.uniform(10.0, 24.0), 410 + k, 2))
for (bx, by, brx, bry, btop, bs, bp) in BERGS:
    if abs(bx) > 990.0 or abs(by) > 990.0:
        continue
    z_, q_ = berg_stamp(bx, by, brx, bry, btop, bs, bp)
    D = np.minimum(D, -z_)
    BERG_MASK |= q_ < 1.25

# Sunward Isle: an island that rises from the sea. A long sand beach, dunes behind it with grass in their hollows, rolling green that climbs at every scale up a ridge to a real hill with rock on its shoulders;
# a rocky headland to seaward, bluffs in the far west. Nothing is level but the ground under a building. Under water the shelf falls away in sand ripples, with reefs of rock that break the waterline
sx, sy = X - SUNWARD[0], Y - SUNWARD[1]
su, sv = (sx * sc + sy * ss) / S_A, (-sx * ss + sy * sc) / S_B
s_lx, s_ly = sx * sc + sy * ss, -sx * ss + sy * sc                       # Sunward's own frame
srr = np.sqrt(su * su + sv * sv) + 0.13 * fbm(N, X, Y, 1 / 160.0, 3, shift=301.0) + 0.06 * fbm(N, X, Y, 1 / 70.0, 2, shift=318.0) + 0.03 * fbm(N, X, Y, 1 / 30.0, 2, shift=303.0)
sth = np.arctan2(sy, sx)
s_gentle = sstep(2.9, 2.2, angdiff(sth, -0.35))                          # the east and south shelve; the far west is a bluff
s_in = (1.0 - srr) * 230.0                                               # metres in from the shore, near enough
s_beach = 2.8 * np.clip(s_in / 36.0, 0.0, 1.0) + 0.25 * fbm(N, X, Y, 1 / 18.0, 2, shift=319.0) * sstep(4.0, 16.0, s_in)
belt = sstep(20.0, 36.0, s_in) * sstep(94.0, 62.0, s_in)
d_r = 0.5 + 0.5 * np.sin(s_in * TAU / 38.0 + 3.2 * fbm(N, X, Y, 1 / 90.0, 2, shift=311.0))
dunes = belt * (1.8 + 4.6 * d_r ** 1.4 * (0.55 + 0.45 * (0.5 + 0.5 * fbm(N, X, Y, 1 / 44.0, 2, shift=312.0))))     # never steeper than he can run up
roll = 11.0 + 11.0 * fbm(N, X, Y, 1 / 210.0, 3, shift=305.0) + 5.5 * fbm(N, X, Y, 1 / 84.0, 3, shift=306.0) + 1.7 * fbm(N, X, Y, 1 / 28.0, 2, shift=304.0) + 0.5 * fbm(N, X, Y, 1 / 10.0, 2, shift=308.0)
roll = np.maximum(roll, 3.5)
spine = 15.0 * np.exp(-((s_ly + 10.0 - 26.0 * np.sin(s_lx / 86.0)) / 74.0) ** 2) * sstep(150.0, -60.0, s_lx)     # the long back of the island, climbing west to the hill
hd = np.hypot(X - SUNWARD_HILL[0], (Y - SUNWARD_HILL[1]) * 1.1)
hill = 36.0 * np.exp(-(hd / 92.0) ** 1.6)
crag = sstep(0.54, 0.82, ridged(N, X, Y, 1 / 58.0, 3, shift=314.0)) * sstep(22.0, 50.0, hd) * sstep(170.0, 104.0, hd)
s_h = s_beach + dunes * s_gentle + sstep(52.0, 140.0, s_in) * (roll + spine) + hill + 7.0 * crag
s_h = np.where(s_h > 46.0, 46.0 + (s_h - 46.0) * 0.5, s_h)               # the top of it rounds over at about 60 m
s_h += (1.0 - s_gentle) * 14.0 * sstep(1.0, 0.94, srr)                   # the bluff
s_h = lerp(s_h, strata(s_h, 2.6, 302), (1.0 - s_gentle) * sstep(1.0, 0.9, srr))
s_o = np.maximum(srr - 1.0, 0.0)
s_out = lerp(s_o * 110.0, s_o * 42.0, s_gentle)                          # under water: 10 degrees where it shelves, steeper off the bluff
s_out += 0.22 * np.sin((s_lx * 0.6 + s_ly * 0.8 + 14.0 * fbm(N, X, Y, 1 / 60.0, 2, shift=316.0)) * TAU / 7.5) * sstep(0.6, 2.5, s_out)     # sand ripples
s_rk = sstep(0.6, 0.84, ridged(N, X, Y, 1 / 44.0, 3, shift=317.0)) * sstep(1.0, 1.03, srr) * sstep(1.3, 1.1, srr)
s_out -= s_rk * (s_out + 2.2)                                            # reefs of rock: their crests break the waterline
SUN_SAND = np.where(srr < 1.0, s_gentle * sstep(112.0, 78.0, s_in) * sstep(0.34, 0.02, fbm(N, X, Y, 1 / 30.0, 2, shift=320.0) + 0.4 * sstep(50.0, 96.0, s_in)), 0.0)    # sand, with green in the dune slacks
D = np.where(srr < 1.0, -s_h, lerp(s_out, D, sstep(1.14, 1.5, srr)))
del s_h, s_out, roll, dunes, spine, hill, crag, belt, d_r, s_beach, s_o, s_rk

BAY = iso(*BAY_L)
bd = np.hypot(X - BAY[0], Y - BAY[1])
D = lerp(D, 4.2, sstep(47.0, 34.0, bd))                                  # the harbour: a sheltered bay, deep enough for boats
HEAD = iso(*HEAD_L)
# the headland the light stands on: a rocky point 27 m high, on a neck of rough ground from the island, its sea face in broken cliffs with the rock standing out of the water at its foot
hr = np.hypot(X - HEAD[0], Y - HEAD[1]) + 7.0 * fbm(N, X, Y, 1 / 22.0, 2, shift=309.0) + 2.0 * fbm(N, X, Y, 1 / 9.0, 2, shift=322.0)
_n0 = np.array(iso(HEAD_L[0] - 96.0, HEAD_L[1] - 86.0))
_nd = np.array(HEAD) - _n0
_nt = np.clip(((X - _n0[0]) * _nd[0] + (Y - _n0[1]) * _nd[1]) / float(np.dot(_nd, _nd)), 0.0, 1.0)
_ne = np.hypot(X - (_n0[0] + _nt * _nd[0]), Y - (_n0[1] + _nt * _nd[1])) + 8.0 * fbm(N, X, Y, 1 / 34.0, 2, shift=323.0)
D = np.minimum(D, lerp(D, -(10.0 + 9.0 * _nt + 3.0 * fbm(N, X, Y, 1 / 26.0, 2, shift=324.0)), sstep(46.0, 18.0, _ne)))
_nu = _nd / float(np.linalg.norm(_nd))
_sea = sstep(-0.35, 0.3, ((X - HEAD[0]) * _nu[0] + (Y - HEAD[1]) * _nu[1]) / np.maximum(hr, 1.0))      # cliffs to seaward; on the land side a long climb up the neck to the light
_hh = -27.0 - 3.0 * fbm(N, X, Y, 1 / 30.0, 2, shift=325.0) + 0.9 * np.maximum(hr - 24.0, 0.0)
D = lerp(D, lerp(np.minimum(_hh * 0.0 - 28.0 + 0.55 * np.maximum(hr - 14.0, 0.0), -8.0), strata(_hh, 4.2, 313), _sea), sstep(62.0, 40.0, hr))
SUN_SAND = SUN_SAND * sstep(48.0, 72.0, hr)                              # the point is rock

# Crown Isle: a young volcano: black cliffs to the north and east in lava flows, a jungle band, a crater at the top; the south and west shelve, and a cove bites in on the south-west
cx_, cy_ = X - CROWN[0], Y - CROWN[1]
cth = np.arctan2(cy_, cx_)
crr = np.hypot(cx_, cy_) + 13.0 * fbm(N, X, Y, 1 / 74.0, 3, shift=311.0) + 5.0 * fbm(N, X, Y, 1 / 26.0, 2, shift=313.0)
COVE_A = math.radians(-132.0)
cove = np.exp(-(angdiff(cth, COVE_A) / 0.40) ** 2)
coast = 190.0 - 86.0 * cove + 9.0 * np.sin(3.0 * cth + 1.0)
cf = crr / coast
c_gentle = sstep(2.05, 1.7, angdiff(cth, math.radians(-125.0)))          # over half the coast shelves
gully = ridged(N, np.cos(cth) * 3.4, np.sin(cth) * 3.4 + cf * 0.5, 1.0, 3, shift=317.0)
c_h = 82.0 * np.maximum(1.0 - np.minimum(cf, 1.0) ** 0.82, 0.0) ** 1.25
c_h += (gully - 0.55) * 15.0 * np.clip(cf, 0, 1) * np.clip(1.0 - cf, 0, 1) * 4.0 * 0.5
c_h += (3.2 * fbm(N, X, Y, 1 / 62.0, 3, shift=326.0) + 1.1 * fbm(N, X, Y, 1 / 20.0, 2, shift=327.0) + 0.35 * fbm(N, X, Y, 1 / 8.0, 2, shift=328.0)) * sstep(0.0, 0.12, 1.0 - cf) * sstep(0.04, 0.2, cf)     # ground that varies at every scale
c_h -= 16.0 * np.exp(-(crr / 17.0) ** 2)                                 # the crater
c_h += (1.0 - c_gentle) * 21.0 * sstep(1.0, 0.94, cf)                    # the black cliffs
c_h = lerp(c_h, strata(c_h, 3.6, 315), (1.0 - c_gentle) * sstep(0.7, 0.9, cf))      # lava flows in the cliff face, bed on bed
c_h = lerp(c_h, np.minimum(c_h, 1.7 + 30.0 * np.maximum(0.82 - cf, 0.0)), sstep(0.66, 0.3, angdiff(cth, COVE_A)) * sstep(0.62, 0.84, cf))   # the cove's beach
dd = np.maximum(crr - coast, 0.0)
c_out = lerp(dd * 1.0, np.minimum(dd * 0.16, 7.0) + np.maximum(dd - 46.0, 0.0) * 0.8, c_gentle)
c_out += 0.2 * np.sin((X * 0.7 - Y * 0.7 + 12.0 * fbm(N, X, Y, 1 / 60.0, 2, shift=329.0)) * TAU / 7.0) * sstep(0.6, 2.5, c_out)     # sand ripples on the shelf
c_rk = sstep(0.6, 0.84, ridged(N, X, Y, 1 / 40.0, 3, shift=330.0)) * sstep(1.0, 1.03, cf) * sstep(1.26, 1.1, cf)
c_out -= c_rk * (c_out + 2.2)                                            # black reefs whose crests break the waterline
D = np.where(cf < 1.0, -c_h, np.minimum(D, c_out))
del gully, c_h, dd, c_out, cove, c_rk

# the shelf Meridon stands on: 60-90 m, its rim a low cliff over the deep
me = np.sqrt(((WX - MERIDON[0]) / 166.0) ** 2 + ((WY - MERIDON[1]) / 124.0) ** 2)
mer_d = 64.0 + 2.0 * fbm(N, X, Y, 1 / 90.0, 2, shift=321.0) + 24.0 * sstep(0.56, 0.98, me)
D = lerp(D, mer_d, sstep(1.04, 0.95, me))
del mer_d

# ---------------------------------------------------------------- stamps: the level ground the buildings stand on
PADS = []


def window(x, y, r):
    """The grid rows and columns within r of a point: a stamp touches only these."""
    i0, i1 = max(int((x - r - ORIGIN) / STEP), 0), min(int((x + r - ORIGIN) / STEP) + 2, GRID)
    j0, j1 = max(int((y - r - ORIGIN) / STEP), 0), min(int((y + r - ORIGIN) / STEP) + 2, GRID)
    return j0, j1, i0, i1


def pad_round(x, y, rx, ry, depth, blend):
    j0, j1, i0, i1 = window(x, y, max(rx, ry) + blend + 4.0)
    Xs, Ys = X[j0:j1, i0:i1], Y[j0:j1, i0:i1]
    d = (np.sqrt(((Xs - x) / rx) ** 2 + ((Ys - y) / ry) ** 2) - 1.0) * min(rx, ry)
    w = sstep(blend, 0.0, d)
    D[j0:j1, i0:i1] = lerp(D[j0:j1, i0:i1], depth, w)
    PADS.append(('round', x, y, rx, ry, depth))


def pad_box(x, y, hx, hy, depth, blend, yaw=0.0):
    j0, j1, i0, i1 = window(x, y, math.hypot(hx, hy) + blend + 4.0)
    Xs, Ys = X[j0:j1, i0:i1], Y[j0:j1, i0:i1]
    cs, sn = math.cos(yaw), math.sin(yaw)
    lx = (Xs - x) * cs + (Ys - y) * sn
    ly = -(Xs - x) * sn + (Ys - y) * cs
    ax = np.maximum(np.abs(lx) - hx, 0.0)
    ay = np.maximum(np.abs(ly) - hy, 0.0)
    w = sstep(blend, 0.0, np.hypot(ax, ay))
    D[j0:j1, i0:i1] = lerp(D[j0:j1, i0:i1], depth, w)


def pad_road(x0, y0, d0, x1, y1, d1, hw, blend):
    ux, uy = x1 - x0, y1 - y0
    L2 = ux * ux + uy * uy
    j0, j1, i0, i1 = window((x0 + x1) / 2.0, (y0 + y1) / 2.0, math.sqrt(L2) / 2.0 + hw + blend + 4.0)
    Xs, Ys = X[j0:j1, i0:i1], Y[j0:j1, i0:i1]
    t = np.clip(((Xs - x0) * ux + (Ys - y0) * uy) / L2, 0.0, 1.0)
    dist = np.hypot(Xs - (x0 + t * ux), Ys - (y0 + t * uy))
    w = sstep(hw + blend, hw, dist)
    D[j0:j1, i0:i1] = lerp(D[j0:j1, i0:i1], d0 + (d1 - d0) * t, w)


def depth_now(x, y):
    return float(D[int((y - ORIGIN) / STEP), int((x - ORIGIN) / STEP)])


RIVERS, FALLS = [], []


def river(name, pts, w, surface=0.8, sea=True):
    """A river to the sea: pts run from source to mouth, in plan; the bed follows the ground under them, only ever falling, and is cut in with soft banks. Writes one entry of world.json's rivers: the water's surface line, with its width."""
    P = [np.array(p, dtype=np.float64) for p in pts]
    dense = []
    for a, b in zip(P[:-1], P[1:]):
        n = max(int(np.linalg.norm(b - a) / 8.0), 1)
        for t in range(n):
            dense.append(a + (b - a) * t / float(n))
    dense.append(P[-1])
    z = []
    for p in dense:
        g = -depth_now(p[0], p[1]) - 1.2
        z.append(min(g, z[-1] - 0.12) if z else g)
    if sea:                                                              # it ends where it meets the sea, not on down the sea floor
        mouth = next((i for i, q in enumerate(z) if q < -0.6), len(z) - 1)
        dense, z = dense[:mouth + 1], z[:mouth + 1]
        z[-1] = min(z[-1], -0.6)
    dense = np.array(dense)
    z = np.array(z)
    dist = np.full(D.shape, 1e9)
    bed = np.zeros(D.shape)
    for i in range(len(dense) - 1):
        a, b = dense[i], dense[i + 1]
        j0, j1, i0, i1 = window((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0, np.linalg.norm(b - a) / 2.0 + w * 5.0 + 6.0)
        Xs, Ys = X[j0:j1, i0:i1], Y[j0:j1, i0:i1]
        u = b - a
        L2 = float(np.dot(u, u))
        t = np.clip(((Xs - a[0]) * u[0] + (Ys - a[1]) * u[1]) / L2, 0.0, 1.0)
        d = np.hypot(Xs - (a[0] + t * u[0]), Ys - (a[1] + t * u[1]))
        sd, sb = dist[j0:j1, i0:i1], bed[j0:j1, i0:i1]
        m = d < sd
        sd[m] = d[m]
        sb[m] = (z[i] + (z[i + 1] - z[i]) * t)[m]
    k = sstep(w * 3.4, w * 0.62, dist)
    D[:] = np.where(dist < 1e8, lerp(D, -bed, k), D)
    keep = list(range(0, len(dense), 3)) + ([len(dense) - 1] if (len(dense) - 1) % 3 else [])
    pts_ = [[round(float(dense[i][0]), 1), round(float(dense[i][1]), 1), round(float(z[i] + surface), 2)] for i in keep]
    if sea:
        pts_[-1][2] = 0.0                                                # at the mouth the river is the sea
        pts_ = [q for q in pts_[:-1] if q[2] > 0.0] + pts_[-1:]
    RIVERS.append({'id': name, 'w': w, 'pts': pts_})


TEMPLES = [(-128.0, 128.0, -math.pi / 2), (156.0, -44.0, math.pi / 2), (-112.0, -38.0, math.pi), (-60.0, 214.0, math.pi)]
ROAD_S = -224.0                   # the south gate of the city
GATE_D, PLAZA_D, RING_D, ARENA_D = 62.0, 56.0, 55.5, 61.0
LIP_Y = float(lip[0, GRID // 2])
pad_road(AX, LIP_Y - 8.0, 32.0, AX, ROAD_S, GATE_D, 18.0, 16.0)        # the causeway from the reef's lip down over the moat
pad_road(AX, ROAD_S, GATE_D, AX, PLAZA[1], PLAZA_D, 20.0, 12.0)        # the processional way
pad_round(PLAZA[0], PLAZA[1], PLAZA_R + 6.0, PLAZA_R + 6.0, PLAZA_D, 14.0)
pad_road(AX, PLAZA[1], PLAZA_D, AX, AY - RY - 18.0, RING_D, 18.0, 10.0)
pad_round(AX, AY, RX + 34.0, RY + 34.0, RING_D, 14.0)                  # the ring road round the arena
pad_road(AX - RX - 30.0, AY, RING_D, -244.0, AY, 60.0, 16.0, 12.0)     # the west road
pad_road(AX + RX + 30.0, AY, RING_D, 280.0, AY, 60.0, 16.0, 12.0)      # the east road
pad_road(AX, AY + RY + 30.0, RING_D, AX, 286.0, 60.0, 16.0, 12.0)      # the north road
pad_road(ACRO[0], AY + 6.0, 58.0, ACRO[0], ACRO[1] - 52.0, TOP_ACRO + 5.5, 13.0, 12.0)  # the ramp up the acropolis
pad_round(ACRO[0], ACRO[1] + 16.0, 52.0, 62.0, TOP_ACRO, 16.0)          # its top: long enough for the high temple's whole cella
pad_round(AX, AY, RX - 4.0, RY - 4.0, ARENA_D, 3.0)                    # the floor inside the ring (sunken)
for tx, ty, tyaw in TEMPLES:                                           # each temple on its own level ground
    pad_round(tx, ty, 36.0, 36.0, depth_now(tx, ty), 12.0)
pad_round(SUNWARD_HILL[0], SUNWARD_HILL[1], 42.0, 36.0, -55.0, 20.0)   # Sunward's hilltop: the ruined temple's level ground
_q = iso(QX - 15.0, 18.0)
pad_box(_q[0], _q[1], 16.0, 46.0, -2.5, 12.0, S_ROT)                   # the quayside, level
_v = iso(*HOLLOW_L)
# the Hollow has no level green of its own: each house on a small level of ground, the land rolling between them
for lx_, ly_, y_a in [(lx__ + 58.0 + 48.0, ly__, 0.0) for lx__ in (0.0, 20.0, 40.0, 60.0, 80.0) for ly__ in (12.0, -24.0)] + [(86.0, -18.0, math.pi / 2.0), (86.0, 8.0, math.pi / 2.0), (200.0, -14.0, 0.0)]:
    _h = iso(lx_, ly_)
    pad_box(_h[0], _h[1], 6.9, 5.6, depth_now(_h[0], _h[1]), 5.0, S_ROT + y_a)
for lx_, ly_ in ((104.0, 42.0), (120.0, 42.0), (136.0, 42.0), (152.0, 44.0)):      # the north row
    _h = iso(HOLLOW_L[0] - 78.0 + lx_, ly_)
    pad_box(_h[0], _h[1], 6.9, 5.6, depth_now(_h[0], _h[1]), 3.0, S_ROT)
pad_round(HEAD[0], HEAD[1], 12.0, 12.0, -28.0, 8.0)                     # the light's footing
pad_round(MERIDON[0], MERIDON[1], 136.0, 104.0, 64.0, 10.0)            # Meridon's level heart

# Sunward Beck: down from the hill's shoulder, along the north meadows, past the Hollow, into the harbour
river('sunward_beck', [iso(-28.0, 74.0), iso(40.0, 92.0), iso(96.0, 72.0), iso(150.0, 66.0), iso(198.0, 62.0), iso(BAY_L[0] - 22.0, 52.0)], 3.4)

# Crown's river: from under the crater, down the south side, over the falls into its gorge, out to the cove's edge
_ca = lambda a, r: (CROWN[0] + math.cos(math.radians(a)) * r, CROWN[1] + math.sin(math.radians(a)) * r)
FALL_P = _ca(-104.0, 96.0)
FALL_B = _ca(-106.0, 110.0)
_pre = len(RIVERS)
river('crown_upper', [_ca(-88.0, 44.0), _ca(-96.0, 66.0), FALL_P], 3.0, sea=False)
top_z = RIVERS[-1]['pts'][-1][2]
pad_road(FALL_B[0], FALL_B[1], -6.0, _ca(-112.0, 150.0)[0], _ca(-112.0, 150.0)[1], -3.0, 5.0, 10.0)   # the plunge pool's level, and the gorge below the falls
river('crown_lower', [FALL_B, _ca(-112.0, 150.0), _ca(-120.0, 176.0), _ca(-126.0, 196.0)], 5.0)
bot_z = RIVERS[-1]['pts'][0][2]
FALLS.append({'id': 'crown_falls', 'x': round(FALL_P[0], 1), 'y': round(FALL_P[1], 1), 'z0': round(top_z, 1), 'z1': round(bot_z, 1), 'w': 9.0, 'yaw': round(math.radians(-104.0) + math.pi / 2.0, 3)})

# Crown's temple on its bench, the stairs up from the cove
CROWN_TEMPLE = _ca(-156.0, 96.0)
COVE_FOOT = _ca(-140.0, 128.0)
_f = (np.array(COVE_FOOT) - np.array(CROWN_TEMPLE)) / math.hypot(COVE_FOOT[0] - CROWN_TEMPLE[0], COVE_FOOT[1] - CROWN_TEMPLE[1])
pad_round(CROWN_TEMPLE[0], CROWN_TEMPLE[1], 24.0, 22.0, -25.0, 12.0)
pad_round(CROWN_TEMPLE[0] - _f[0] * 16.0, CROWN_TEMPLE[1] - _f[1] * 16.0, 24.0, 24.0, -25.0, 12.0)   # the temple's walls run back into the hill from its porch
pad_road(COVE_FOOT[0], COVE_FOOT[1], -2.0, CROWN_TEMPLE[0], CROWN_TEMPLE[1], -25.0, 7.0, 6.0)

# the fort's ice shelf: flat ice from Frost Isle's west shore out to the fort
pad_road(FROST[0] - 200.0, FROST[1] - 8.0, -2.6, FORT[0], FORT[1], -2.6, 60.0, 16.0)
pad_round(FORT[0], FORT[1], 74.0, 62.0, -2.6, 14.0)

# the Rime Caves' way in from the open water, and the great chamber at its end
pad_road(92.0, 806.0, 52.0, 176.0, 824.0, 34.0, 13.0, 9.0)
pad_road(176.0, 824.0, 34.0, CAVES[0], CAVES[1], 36.0, 11.0, 8.0)
pad_round(CAVES[0], CAVES[1], 46.0, 38.0, 40.0, 10.0)

# the shrines and landmarks get their own level ground
ARCH_D = 25.5
pad_box(ARCH_P[0], ARCH_P[1], 52.0, 18.0, ARCH_D, 20.0)
pad_round(SHRINE_REEF[0], SHRINE_REEF[1], 20.0, 20.0, 19.0, 16.0)
pad_round(NAVE_SPIRE[0], NAVE_SPIRE[1], 20.0, 18.0, 30.0, 22.0)         # the kelp's great rib rises under the spire
pad_round(SHRINE_KELP[0], SHRINE_KELP[1], 24.0, 24.0, 60.0, 18.0)
pad_round(SHRINE_RIME[0], SHRINE_RIME[1], 26.0, 26.0, 62.0, 16.0)
pad_round(SHRINE_CINDER[0], SHRINE_CINDER[1], 26.0, 26.0, 122.0, 22.0)
pad_round(FORGE[0], FORGE[1], 40.0, 34.0, 136.0, 18.0)
pad_box(WRECK[0], WRECK[1], 34.0, 12.0, depth_now(WRECK[0], WRECK[1]), 22.0, 0.42)

# ---------------------------------------------------------------- the trench, carved last
dy = Y - trench_y(X) + 8.0 * fbm(N, X, Y, 1 / 56.0, 3, shift=131.0) + 3.5 * fbm(N, X, Y, 1 / 17.0, 2, shift=133.0)
wr, wf = trench_half(X)
pinch = sstep(-612.0, -470.0, X)                                       # the west end closes in a blind wall
wr = wr * (0.2 + 0.8 * pinch)
wf = wf * (0.05 + 0.95 * pinch)
F = trench_floor(X) + 6.0 * fbm(N, X, Y, 1 / 44.0, 4, shift=137.0)
F = lerp(D, F, sstep(-622.0, -540.0, X))
u = np.clip((np.abs(dy) - wf) / np.maximum(wr - wf, 1.0), 0.0, 1.0)
STRATA = 8
sv = u * STRATA + 0.42 * fbm(N, X, Y, 1 / 70.0, 3, shift=139.0)
k = np.floor(sv)
frac = sv - k
stepped = np.clip((k + sstep(0.05, 0.42, frac)) / STRATA, 0.0, 1.0)     # strata: steep risers, narrow ledges
stepped = lerp(stepped, 1.0, sstep(0.9, 1.0, u))
stepped = np.where(u <= 0.0, 0.0, stepped)
Dt = F + (D - F) * stepped
Dt = Dt + 2.2 * sstep(0.02, 0.0, u) * ridged(N, X, Y, 1 / 26.0, 3, shift=141.0) * sstep(-600.0, -540.0, X)   # boulders on the floor
D = np.maximum(D, Dt)
del dy, F, u, sv, k, frac, stepped, Dt

# Vesper: a bowl of terraces cut into the north wall, stepped like a theatre, facing the Deep Shrine across the canyon
VC = (-205.0, 408.0)                                                    # the bowl's centre, out over the canyon
V_R0, V_STEP = 126.0, 15.0
V_LEVELS = [196.0, 182.0, 168.0, 154.0, 140.0, 128.0]
vr = np.hypot(X - VC[0], Y - VC[1])
va = np.arctan2(X - VC[0], Y - VC[1])                                   # 0 = due north
V_OUT = V_R0 + V_STEP * len(V_LEVELS)
vw = sstep(1.3, 1.08, np.abs(va)) * sstep(V_R0 - 7.0, V_R0 - 1.0, vr) * sstep(V_OUT + 6.0, V_OUT - 1.0, vr)
vk = np.clip(np.floor((vr - V_R0) / V_STEP).astype(int), 0, len(V_LEVELS) - 1)
D = lerp(D, np.array(V_LEVELS)[vk], vw)

# the Deep Bell's ledge: a shelf of rock out from the south wall, far above the floor
SHRINE_DEEP = (SHRINE_DEEP[0], float(trench_y(SHRINE_DEEP[0])) - 66.0)
DEEP_LEDGE = 146.0
cs_ledge = np.hypot((X - SHRINE_DEEP[0]) / 38.0, (Y - SHRINE_DEEP[1]) / 26.0)
ledge_w = sstep(1.1, 0.9, cs_ledge) * sstep(SHRINE_DEEP[1] + 26.0, SHRINE_DEEP[1] + 21.0, Y)
D = np.where(ledge_w > 0.0, np.minimum(D, lerp(D, DEEP_LEDGE, ledge_w)), D)
# a stair of broken ledges up the wall to it
for i, (ox, oy, dd) in enumerate([(46.0, -14.0, 128.0), (74.0, -22.0, 110.0), (98.0, -32.0, 94.0)]):
    r2 = np.hypot((X - SHRINE_DEEP[0] - ox) / 18.0, (Y - SHRINE_DEEP[1] - oy) / 10.0)
    w2 = sstep(1.15, 0.85, r2)
    D = np.where(w2 > 0.0, np.minimum(D, lerp(D, dd, w2)), D)
del vr, va, vw, vk, cs_ledge, ledge_w, r2, w2

D = np.clip(D, -TOP_M + 0.5, 250.0)
# a last soft pass: a heightfield's creases are what read as flat polygons, so nothing natural keeps one sample's sharpness; the strata and the cliffs keep theirs
nat_ = sstep(0.7, 0.25, np.hypot(*np.gradient(D, STEP))) * (D < 118.0)
D = lerp(D, blur(D, 2), nat_)
del nat_

# ---------------------------------------------------------------- reading the ground back


def depth_at(x, y):
    fx = (x - ORIGIN) / STEP
    fy = (y - ORIGIN) / STEP
    i = int(min(max(math.floor(fx), 0), GRID - 2))
    j = int(min(max(math.floor(fy), 0), GRID - 2))
    a, b = fx - i, fy - j
    return float((D[j, i] * (1 - a) + D[j, i + 1] * a) * (1 - b) + (D[j + 1, i] * (1 - a) + D[j + 1, i + 1] * a) * b)


def ground(x, y):
    return -depth_at(x, y)


def ground_range(x, y, r):
    zs = [ground(x + r * math.cos(a), y + r * math.sin(a)) for a in (0, 1.05, 2.1, 3.14, 4.2, 5.24)] + [ground(x, y)]
    return min(zs), max(zs)


def at(a, x, y):
    """A map's value at a point."""
    return float(a[int(np.clip((y - ORIGIN) / STEP, 0, GRID - 1)), int(np.clip((x - ORIGIN) / STEP, 0, GRID - 1))])


# ---- Rimehold's ice, tile by tile. It's decided here, before anything is placed, because it shapes the sea floor: a swimmer is lifted by rising ground, never stopped by it, so ground that comes
# near the underside of a slab wedges him up into the ice. Under every slab there's room for his whole body (1.24 m across) and a margin; where land or a shallow reaches under a tile, the ice stops there
TILE = 48.0
ROOF = 8.0                                                               # the sea floor's least depth under a slab: the slab's underside is at -6.3, so 1.7 m clear
I_X0, I_Y0 = RIME[0] - RIME_R[0] * 1.1, RIME[1] - RIME_R[1] * 1.3
I_NX, I_NY = int(RIME_R[0] * 2.2 / TILE) + 1, int(RIME_R[1] * 2.6 / TILE) + 1
ICE_ROWS, ICE_GAPS = [], []
for j_ in range(I_NY):
    row = ''
    for i_ in range(I_NX):
        gx_, gy_ = I_X0 + (i_ + 0.5) * TILE, I_Y0 + (j_ + 0.5) * TILE
        caves = 96.0 < gx_ < 430.0
        ice_ = (at(ri_e, gx_, gy_) < 1.0 or at(cave_m, gx_, gy_) > 0.02) and ground(gx_, gy_) < -1.0
        if ice_ and float(fbm(N, np.array(gx_), np.array(gy_), 1 / 130.0, 2, shift=361.0)) > 0.2 and not caves:
            ICE_GAPS.append((gx_, gy_))
            ice_ = False
        if ice_:
            j0, j1, i0, i1 = window(gx_, gy_, TILE / 2.0 + 1.0)
            ice_ = D[j0:j1, i0:i1].min() > 1.0                           # all of it over water
        row += '1' if ice_ else '0'
    ICE_ROWS.append(row)
for j_ in range(I_NY):
    for i_ in range(I_NX):
        if ICE_ROWS[j_][i_] == '1':
            gx_, gy_ = I_X0 + (i_ + 0.5) * TILE, I_Y0 + (j_ + 0.5) * TILE
            j0, j1, i0, i1 = window(gx_, gy_, TILE / 2.0 + 9.0)
            out_ = np.hypot(np.maximum(np.abs(X[j0:j1, i0:i1] - gx_) - TILE / 2.0, 0.0), np.maximum(np.abs(Y[j0:j1, i0:i1] - gy_) - TILE / 2.0, 0.0))
            w_ = sstep(7.0, 1.0, out_) * np.where(out_ > 1.0, sstep(0.0, 3.0, D[j0:j1, i0:i1]), 1.0)     # out past the slab's edge it eases back, and leaves the shore alone
            D[j0:j1, i0:i1] = np.maximum(D[j0:j1, i0:i1], lerp(D[j0:j1, i0:i1], ROOF, w_))

gy, gx = np.gradient(D, STEP)
SLOPE = np.hypot(gx, gy)


def slope_at(x, y):
    i = int(np.clip(round((x - ORIGIN) / STEP), 0, GRID - 1))
    j = int(np.clip(round((y - ORIGIN) / STEP), 0, GRID - 1))
    return float(SLOPE[j, i])


# ---------------------------------------------------------------- biomes: half the height grid, RGBA, each pixel's four weights summing to 255
b_city = sstep(1.08, 0.94, city_e)
b_kelp = w_kelp * (1.0 - b_city)
b_trench = sstep(1.45, 0.98, np.abs(Y - trench_y(X)) / np.maximum(trench_half(X)[0], 40.0)) * sstep(-640.0, -540.0, LX)
b_trench = np.maximum(b_trench, 0.55 * sstep(95.0, 150.0, D) * (1.0 - b_city))
b_trench = np.maximum(b_trench, sstep(70.0, 170.0, D))
b_reef = np.maximum(1.0 - b_city - b_kelp - b_trench, 0.0)
# on land the four channels mean: reef = beach sand, kelp = green interior, city = pale bare rock, trench = black volcanic rock
land = D < 0.0
slope_ = np.hypot(*np.gradient(D, STEP))
in_crown = (np.hypot(X - CROWN[0], Y - CROWN[1]) < 240.0) | (np.hypot(X - CONE[0], Y - CONE[1]) < 240.0)   # the two volcanoes: black rock and black sand
wet = sstep(2.6, 1.2, -D)                                                # beach: within a couple of metres of the sea
wet = np.maximum(wet, SUN_SAND)                                          # Sunward's dunes are sand, with green in their slacks
green = 1.0 - wet
rocky = sstep(0.82, 1.2, slope_ + 0.25 * fbm(N, X, Y, 1 / 30.0, 2, shift=331.0))
top_black = sstep(58.0, 72.0, -D)
_st = np.array(COVE_FOOT) - np.array(CROWN_TEMPLE)
_sl = float(np.hypot(*_st))
_u = np.clip(((X - CROWN_TEMPLE[0]) * _st[0] + (Y - CROWN_TEMPLE[1]) * _st[1]) / (_sl * _sl), 0.0, 1.0)
_stair = np.hypot(X - (CROWN_TEMPLE[0] + _u * _st[0]), Y - (CROWN_TEMPLE[1] + _u * _st[1])) < 6.0   # the flight and its margin: bare rock, or the grass grows through the steps
rocky = np.where(_stair, 1.0, rocky)
for arr, val in ((b_reef, wet * (1.0 - rocky) * (~in_crown)), (b_kelp, green * (1.0 - rocky) * (1.0 - top_black * in_crown)), (b_city, rocky * (~in_crown)), (b_trench, np.maximum(np.maximum(rocky, top_black), wet) * in_crown)):
    arr[land] = val[land]                                                # Crown's beaches are black


def weights(chans):
    """Half the grid, each pixel summing to exactly 255."""
    st = np.stack(chans, axis=2)[::2, ::2]
    st = st / np.maximum(st.sum(axis=2, keepdims=True), 1e-6)
    w = np.floor(st * 255.0).astype(np.int32)
    n = st.shape[0]
    w[np.arange(n)[:, None], np.arange(n)[None, :], st.argmax(axis=2)] += 255 - w.sum(axis=2)
    return w.astype(np.uint8)


# the second map: cinder, ice, wrack, and whatever is left (0 = none of them)
b2_c = sstep(1.12, 0.92, cm_e)
b2_i = np.maximum(sstep(1.12, 0.94, ri_e), sstep(1.12, 0.98, fr_e))
b2_i = np.maximum(b2_i, sstep(100.0, 76.0, np.hypot((X - FORT[0]) * 0.8, Y - FORT[1])))
b2_i = np.maximum(b2_i, (land & (np.hypot((X - (FORT[0] + FROST[0]) / 2.0) / 200.0, (Y - (FORT[1] + FROST[1]) / 2.0) / 90.0) < 1.0)).astype(np.float64))
b2_i = np.maximum(b2_i, BERG_MASK.astype(np.float64))
b2_w = sstep(1.1, 0.9, wr_e)
cone_land = land & (np.hypot(X - CONE[0], Y - CONE[1]) < 240.0)          # nothing grows on the Cone: bare black lava
b_reef[cone_land], b_kelp[cone_land], b_city[cone_land], b_trench[cone_land] = 0.0, 0.0, 0.0, 1.0
frost = land & (b2_i > 0.5)                                              # snow: never the green of the channel underneath
b_reef[frost], b_kelp[frost], b_city[frost], b_trench[frost] = 0.0, 0.0, 1.0, 0.0
biome = weights([b_reef, b_kelp, b_city, b_trench])
biome2 = weights([b2_c, b2_i, b2_w, np.maximum(1.0 - b2_c - b2_i - b2_w, 0.0)])

# ---------------------------------------------------------------- the kit's real sizes
#  (width x, depth y, height z) at scale 1, ROUGH, only until build_props.py has measured the real meshes
PLAN = {
    'column': (2.8, 2.8, 14.0), 'column_broken': (2.8, 2.8, 8.0), 'column_fallen': (3.0, 13.0, 2.6),
    'arch': (20.0, 6.0, 20.0), 'wall_bay': (12.0, 1.8, 14.0), 'wall_broken': (12.0, 1.8, 10.0), 'stair': (20.0, 14.0, 6.0),
    'temple_front': (34.0, 12.0, 25.0), 'roof_slab': (26.0, 26.0, 1.4), 'lamp': (1.6, 1.6, 7.5),
    'statue_colossus': (24.0, 22.0, 48.0), 'statue_head': (10.0, 10.0, 8.0), 'arena_bay': (11.6, 6.0, 30.0),
    'arena_portal': (11.6, 8.0, 30.0), 'arena_gate': (10.0, 1.6, 15.0),
    'bell_shrine': (12.0, 12.0, 14.0), 'wreck_hull': (44.0, 12.0, 15.0), 'wreck_mast': (7.0, 7.0, 22.0), 'anchor': (4.0, 2.0, 6.0),
    'rock_a': (8.0, 7.0, 5.0), 'rock_b': (10.0, 8.0, 7.0), 'rock_c': (6.0, 6.0, 8.0), 'rock_pillar': (9.0, 9.0, 30.0),
    'sea_arch': (92.0, 28.0, 36.0), 'islet': (44.0, 38.0, 12.0), 'coral_brain': (4.0, 4.0, 2.5), 'coral_table': (5.0, 5.0, 2.5),
    'glow_coral': (2.0, 2.0, 3.0),
}
SOLID_ROUND = {'column', 'column_broken', 'lamp', 'rock_a', 'rock_b', 'rock_c', 'rock_pillar', 'wreck_mast', 'coral_brain', 'coral_table'}
PIECES = None
pp = os.path.join(OUT, 'pieces.json')
if os.path.exists(pp):
    PIECES = json.load(open(pp))


def size_of(name):
    if PIECES and name in PIECES:
        return tuple(PIECES[name]['size'])
    return PLAN.get(name, (1.0, 1.0, 1.0))


COLFIT = {}
_cf = os.path.join(OUT, 'col_fit.json')
if os.path.exists(_cf):
    COLFIT = json.load(open(_cf))


# a tree is hard at its trunk and soft in its crown: a short stack that follows the trunk as it rises and leans, measured off the mesh
def _c(x, y, z0, z1, r):
    return {'t': 'cyl', 'x': x, 'y': y, 'z0': z0, 'z1': z1, 'r': r}


# Both pieces of a palm stand on the ground, following the trunk's line as measured ring by ring: a piece that starts in the air overhangs a walker on a hillside and the rising ground lifts him
# into it, and a top at the height of his centre (0.92 m) lets him clip its rim instead of being stopped. The second stands under the lean, where he couldn't walk upright anyway
TRUNKS = {'palm_a': [_c(0.3, 0.37, -0.7, 2.6, 0.52), _c(0.72, 0.86, -0.7, 5.4, 0.34)],
          'palm_b': [_c(-0.95, 0.18, -0.7, 1.8, 0.55), _c(-1.85, 0.35, -0.7, 3.7, 0.36)],
          'tree_oak_a': [_c(0.0, 0.0, -0.6, 2.2, 0.8), _c(0.0, 0.0, 2.2, 4.7, 0.5)], 'tree_oak_b': [_c(0.0, 0.0, -0.6, 1.8, 0.8), _c(0.0, 0.0, 1.8, 3.8, 0.5)],
          'snow_pine': [_c(0.0, 0.0, -0.6, 4.6, 0.52)],
          # the fitted stack, with the flare under the ice as one tall piece: thin discs one on another send a body up and down between them and the slab above
          'ice_pillar': [_c(-0.02, 0.13, -1.19, 3.32, 6.86), _c(-0.21, -0.06, 3.32, 8.01, 5.81), _c(-0.21, -0.06, 8.01, 13.83, 4.86), _c(-0.02, -0.06, 13.83, 23.03, 3.94),
                         _c(-0.02, -0.06, 23.03, 40.12, 3.26), _c(-0.02, 0.13, 40.12, 46.0, 4.0), _c(-0.02, 0.13, 44.0, 60.02, 5.6)]}


# Boxes that touch face to face hold a body between them: each sends him toward the shared face. A little overlap ends that: past the other's face he's deep enough in it that its nearest way out
# is to the side. Kinds whose own pieces touch, and walls that stand end to end with their neighbours
SEAM_KINDS = {'smoker', 'wall_bay', 'wall_broken'}
END_TO_END = {'wall_bay', 'wall_broken'}


def unseamed(name, pieces):
    out = [dict(c) for c in pieces]
    grow = lambda c, ax, sg, g: (c.__setitem__('hx' if ax == 0 else 'hy', c['hx' if ax == 0 else 'hy'] + g / 2.0), c.__setitem__('x' if ax == 0 else 'y', c['x' if ax == 0 else 'y'] + sg * g / 2.0))
    boxes = [c for c in out if c['t'] == 'box' and not c.get('yaw')]
    touching = []
    for i, a in enumerate(boxes):
        for b in boxes[i + 1:]:
            if min(a['z1'], b['z1']) - max(a['z0'], b['z0']) < 1.0:
                continue
            for ax, (p_, h_, q_, m_) in enumerate((('x', 'hx', 'y', 'hy'), ('y', 'hy', 'x', 'hx'))):
                d_ = b[p_] - a[p_]
                if abs(abs(d_) - (a[h_] + b[h_])) < 0.03 and min(a[q_] + a[m_], b[q_] + b[m_]) - max(a[q_] - a[m_], b[q_] - b[m_]) >= 1.0:
                    touching.append((a, b, ax, math.copysign(1.0, d_)))
    for a, b, ax, sg in touching:
        grow(a, ax, sg, 0.35)
        grow(b, ax, -sg, 0.35)
    if name in END_TO_END and boxes:
        lo, hi = min(c['x'] - c['hx'] for c in boxes), max(c['x'] + c['hx'] for c in boxes)
        for c in boxes:
            if c['x'] - c['hx'] < lo + 0.2:
                grow(c, 0, -1.0, 0.4)
            if c['x'] + c['hx'] > hi - 0.2:
                grow(c, 0, 1.0, 0.4)
    return out


LOCAL = {}
THICK = {'wreck_bow', 'wreck_stern', 'wreck_hull', 'wreck_stand'}        # a thin disc among other solids sends a body up or down out of it into the next: none thinner than a body


def closed_in(name, pieces):
    """Slits the fit left that a body fits into and a camera doesn't: closed here, by the piece's own measure."""
    out = [dict(c) for c in pieces]
    if name == 'forge_hall':                                             # the blind hall: its core and its thin side walls are one block, with no 1.8 m slit down each side under the roof
        walls = [c for c in out if c['t'] == 'box' and c['hx'] < 0.5 and c['hy'] > 10.0]
        out = [c for c in out if not (c['t'] == 'box' and c['hx'] < 0.5 and c['hy'] > 10.0)]
        out[0]['hx'] = max(abs(c['x']) + c['hx'] for c in walls) - abs(out[0]['x'])
    if name == 'smoker':                                                 # the stacks stand close: the space between them, under their caps, is rock
        out.append({'t': 'box', 'x': 0.2, 'y': -0.8, 'z0': -0.62, 'z1': 9.0, 'hx': 2.2, 'hy': 2.4})
    if name in THICK:
        for c in out:
            t_ = c['z1'] - c['z0']
            if t_ < 1.4:
                c['z0'], c['z1'] = c['z0'] - (1.4 - t_) / 2.0, c['z1'] + (1.4 - t_) / 2.0
    return out


def local_colliders(name):
    """The piece's collision shapes in its own space, ready for the map."""
    if name not in LOCAL:
        c_ = closed_in(name, fitted_colliders(name))
        LOCAL[name] = unseamed(name, c_) if name in SEAM_KINDS else c_
    return LOCAL[name]


def fitted_colliders(name):
    """The piece's collision shapes in its own space: fitted to the drawn shape by fit_colliders.py, and measured there the way the game's wall measures them."""
    if name in TRUNKS:
        return TRUNKS[name]
    if name in COLFIT:
        return COLFIT[name]['col']
    if PIECES and name in PIECES:
        return PIECES[name].get('col', [])
    if name not in PLAN or name.startswith('coral') or name == 'glow_coral':
        return []
    w, d, h = PLAN[name]
    if name in SOLID_ROUND:
        return [{'t': 'cyl', 'x': 0, 'y': 0, 'z0': 0, 'z1': h, 'r': max(w, d) / 2 * 0.8}]
    return [{'t': 'box', 'x': 0, 'y': 0, 'z0': 0, 'z1': h, 'hx': w / 2, 'hy': d / 2}]


# ---------------------------------------------------------------- placing things
INST = defaultdict(list)
PLACED = []                       # (name, x, y, z, yaw, scale)
LIGHT = {'grass_patch', 'wildflowers', 'seagrass', 'grass_tuft', 'fern', 'kelp_stalk', 'bush', 'coral_branch', 'coral_fan', 'coral_brain', 'coral_table', 'coral_tube', 'anemone', 'glow_coral'}


def put(name, x, y, z=None, yaw=0.0, s=1.0, tint=None, sink=0.35):
    if z is None:
        z = ground(x, y) - sink * s
    if tint is None:
        tint = float(rng.uniform(0.0, 1.0))
    dp = (1, 2) if name in LIGHT else (2, 3)
    INST[name].append([round(float(v), dp[0] if i < 3 else dp[1]) for i, v in enumerate((x, y, z, yaw % TAU, s, tint))])
    PLACED.append((name, x, y, z, yaw % TAU, s))


def nat(name, x, y, yaw=None, s=1.0, sink=0.3, tint=None):
    """A natural piece on uneven ground: its base at the lowest ground under its footprint, so no part of it hangs in the water."""
    size = size_of(name)
    r = 0.34 * max(size[0], size[1]) * s
    z = ground_range(x, y, r)[0] - sink * s
    put(name, x, y, z=z, yaw=rng.uniform(0, TAU) if yaw is None else yaw, s=s, tint=tint)


def seat(x, y, r, bottom):
    """Where a low round piece sits on a slope: let into the uphill side just enough that its downhill edge still meets the ground. None if that would bury it past half a metre."""
    g = ground(x, y)
    z = min(g, ground_range(x, y, r)[0] + 0.25 - bottom)
    return z if z >= g - 0.42 else None


def free_of(x, y, r, spots):
    return all(math.hypot(x - a, y - b) > r + c for a, b, c in spots)


def in_city(x, y, m=0.0):
    e = math.hypot((x - 22.0) / 268.0, (y - 54.0) / 244.0)
    return e < 0.93 - m


# ---- the city: avenues first, then the blocks behind them
CITY_TAKEN = []                   # (x, y, r): nothing else goes here


def colonnade(x0, y0, x1, y1, offset=12.5, spacing=14.0, ruin=0.34, lamps=True):
    L = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    nx, ny = -uy, ux
    n = max(1, int(round(L / spacing)))
    for i in range(n + 1):
        d = L * i / n
        for side in (-1, 1):
            x = x0 + ux * d + nx * side * offset
            y = y0 + uy * d + ny * side * offset
            r = rng.rand()
            if r > ruin:
                put('column', x, y, yaw=rng.uniform(0, TAU), s=rng.uniform(0.96, 1.05))
            elif r > ruin * 0.42:
                put('column_broken', x, y, yaw=rng.uniform(0, TAU), s=rng.uniform(0.9, 1.1))
            elif r > ruin * 0.1:
                # the fallen drums lie out from the base, across the walk, and a broken stump stands where it stood
                put('column_broken', x, y, yaw=rng.uniform(0, TAU), s=rng.uniform(0.5, 0.7))
                a = math.atan2(ny * side, nx * side) - math.pi / 2 + rng.uniform(-0.5, 0.5)
                ln = size_of('column_fallen')[1] * 0.5 + 2.5
                nat('column_fallen', x + math.sin(a) * -ln, y + math.cos(a) * ln, yaw=a, sink=0.0)
            if lamps and i % 2 == 1 and i < n:
                ox = x + ux * spacing * 0.5 - nx * side * 2.6
                oy = y + uy * spacing * 0.5 - ny * side * 2.6
                put('lamp', ox, oy, yaw=rng.uniform(0, TAU))


def triumphal(x, y, yaw, s=1.0):
    put('arch', x, y, yaw=yaw, s=s, sink=0.5)
    CITY_TAKEN.append((x, y, 16.0))


def wall_line(x, y, yaw, cond):
    """One wall slot; cond 0..1, how well this block has lasted."""
    r = rng.rand()
    if r < 0.2 + 0.55 * cond:
        put('wall_bay', x, y, yaw=yaw, sink=0.4)
        return 2
    if r < 0.85 + 0.1 * cond:
        put('wall_broken', x, y, yaw=yaw if rng.rand() < 0.5 else yaw + math.pi, sink=0.4)
        return 1
    return 0


def house(cx, cy, cond, bays=2):
    W = size_of('wall_bay')[0]
    half = W * bays / 2.0
    got = 0
    for b in range(bays):
        o = -half + W * (b + 0.5)
        got += wall_line(cx + o, cy - half, 0.0, cond)
        got += wall_line(cx + o, cy + half, math.pi, cond)
        got += wall_line(cx - half, cy + o, -math.pi / 2, cond)
        got += wall_line(cx + half, cy + o, math.pi / 2, cond)
    if got >= 5 * bays and rng.rand() < 0.55:
        z = max(ground(cx + sx * half, cy + sy * half) for sx in (-1, 1) for sy in (-1, 1)) - 0.5 + size_of('wall_bay')[2]
        put('roof_slab', cx, cy, z=z - 0.2, yaw=rng.randint(4) * math.pi / 2, s=(W * bays + 1.6) / size_of('roof_slab')[0])
    CITY_TAKEN.append((cx, cy, half + 4.0))


def temple(cx, cy, yaw, s=1.0, bays=3):
    """A temple on its own level ground: the porch to the front (yaw 0 faces south), three walls and a broken roof behind."""
    tw, td, th = size_of('temple_front')
    tw *= s
    W = size_of('wall_bay')[0]
    ww = W * s                                                           # the whole temple at one scale: a small porch before full-size walls reads as two buildings
    cs, sn = math.cos(yaw), math.sin(yaw)

    def P(lx, ly):
        return cx + lx * cs - ly * sn, cy + lx * sn + ly * cs

    z0 = ground(cx, cy)
    x, y = P(0, 0)
    put('temple_front', x, y, z=z0 - 0.5, yaw=yaw, s=s)
    half = tw / 2.0 - 2.0
    n_side = bays
    back = n_side * ww + td * s * 0.42
    for i in range(n_side):
        ly = td * s * 0.42 + ww * (i + 0.5)
        for side in (-1, 1):
            x, y = P(side * half, ly)
            r = rng.rand()
            put('wall_bay' if r < 0.72 else 'wall_broken', x, y, z=z0 - 0.5, yaw=yaw + side * math.pi / 2, s=s)
    nb = int(round(2 * half / ww))
    for i in range(nb):
        lx = -half + (i + 0.5) * (2 * half / nb)
        x, y = P(lx, back)
        put('wall_bay' if rng.rand() < 0.7 else 'wall_broken', x, y, z=z0 - 0.5, yaw=yaw + math.pi, s=s)
    roof_s = (2 * half + 2.0) / size_of('roof_slab')[0]
    x, y = P(0, td * s * 0.42 + n_side * ww * 0.34)
    put('roof_slab', x, y, z=z0 - 0.7 + size_of('wall_bay')[2] * s, yaw=yaw, s=roof_s)
    r = max(tw, back) * 0.72 + 8.0
    mx, my = P(0, back * 0.45)
    CITY_TAKEN.append((mx, my, r))


# the processional way: the reef's lip, the causeway, the south gate, the colossus
colonnade(AX, LIP_Y - 26.0, AX, ROAD_S + 8.0, offset=16.0, spacing=24.0, ruin=0.55, lamps=False)
triumphal(AX, ROAD_S, 0.0, 1.25)
colonnade(AX, ROAD_S + 14.0, AX, PLAZA[1] - PLAZA_R - 2.0, offset=15.0, spacing=13.5, ruin=0.3)
# the colossus and its plaza, ringed by columns, broken on the side the sea came from
put('statue_colossus', PLAZA[0], PLAZA[1], yaw=0.0, s=1.18, sink=0.6, tint=0.5)      # just tall enough that the trident's tips stand out of the sea: Thalor's mark from far off
CITY_TAKEN.append((PLAZA[0], PLAZA[1], PLAZA_R + 8.0))
for i in range(28):
    a = (i + 0.5) / 28 * TAU
    if abs(math.sin(a)) > 0.965:      # the road goes in and out here
        continue
    x, y = PLAZA[0] + math.cos(a) * PLAZA_R, PLAZA[1] + math.sin(a) * PLAZA_R
    if rng.rand() < 0.68:
        put('column', x, y, yaw=rng.uniform(0, TAU), s=rng.uniform(1.0, 1.08))
    else:
        put('column_broken', x, y, yaw=rng.uniform(0, TAU), s=rng.uniform(0.9, 1.15))
for i in range(8):
    a = (i + 0.5) / 8 * TAU
    put('lamp', PLAZA[0] + math.cos(a) * (PLAZA_R - 9.0), PLAZA[1] + math.sin(a) * (PLAZA_R - 9.0), yaw=a)
put('statue_head', PLAZA[0] + 27.0, PLAZA[1] - 17.0, yaw=2.4, sink=1.0, s=1.0, tint=0.5)   # the head of a lost companion statue
colonnade(AX, PLAZA[1] + PLAZA_R + 2.0, AX, AY - RY - 20.0, offset=15.0, spacing=13.5, ruin=0.34)
triumphal(AX, AY - RY - 16.0 - 4.0, 0.0, 1.0)

# the four roads out of the ring
colonnade(AX - RX - 40.0, AY, -236.0, AY, offset=14.0, spacing=14.0, ruin=0.5)
colonnade(AX + RX + 40.0, AY, 272.0, AY, offset=14.0, spacing=14.0, ruin=0.5)
colonnade(AX, AY + RY + 40.0, AX, 280.0, offset=14.0, spacing=14.0, ruin=0.5)
triumphal(AX - RX - 34.0, AY, math.pi / 2)
triumphal(AX + RX + 34.0, AY, math.pi / 2)
triumphal(AX, AY + RY + 34.0, 0.0)
triumphal(-240.0, AY, math.pi / 2, 1.1)
triumphal(276.0, AY, math.pi / 2, 1.1)
colonnade(ACRO[0], AY + 16.0, ACRO[0], ACRO[1] - 56.0, offset=11.0, spacing=13.0, ruin=0.3)

# the ring road's lamps and its colonnade round the arena
ring_n = 60
for i in range(ring_n):
    a = (i + 0.5) / ring_n * TAU
    x, y = AX + math.cos(a) * (RX + 30.0), AY + math.sin(a) * (RY + 30.0)
    if min(abs(x - AX), abs(y - AY)) < 18.0:
        continue
    r = rng.rand()
    if r < 0.5:
        put('column', x, y, yaw=rng.uniform(0, TAU))
    elif r < 0.72:
        put('column_broken', x, y, yaw=rng.uniform(0, TAU))
    if i % 4 == 2:
        put('lamp', AX + math.cos(a) * (RX + 24.0), AY + math.sin(a) * (RY + 24.0), yaw=a)

# the arena: an oval of stacked arcades; the portal faces south, up the processional way
A_Z = -RING_D
pts = []
M = 720
for i in range(M + 1):
    a = -math.pi / 2 + i / M * TAU
    pts.append((AX + RX * math.cos(a), AY + RY * math.sin(a), a))
per = sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(M))
bay_w = size_of('arena_bay')[0]
n_bays = int(round(per / bay_w * 0.985))
seg = per / n_bays
acc, idx, BAYS = 0.0, 0, []
for k in range(n_bays):
    want = seg * (k + 0.0)            # bay 0 centred at the south point
    while acc < want and idx < M:
        acc += math.hypot(pts[idx + 1][0] - pts[idx][0], pts[idx + 1][1] - pts[idx][1])
        idx += 1
    x, y, a = pts[idx]
    nx, ny = math.cos(a) / RX, math.sin(a) / RY
    L = math.hypot(nx, ny)
    nx, ny = nx / L, ny / L
    yaw = math.atan2(nx, -ny)
    BAYS.append((x, y, yaw, nx, ny))
    broke = k in (n_bays // 3, n_bays // 3 + 1, 2 * n_bays // 3 + 2)
    put('arena_portal' if k == 0 else 'arena_bay_broken' if broke else 'arena_bay', x, y, z=A_Z - 0.5, yaw=yaw, s=1.0, tint=0.45 + 0.1 * rng.rand())
GATE_POS = (AX, AY - RY)
CITY_TAKEN.append((AX, AY, RX + 34.0))
# the seating bowl, wedge by wedge round the oval; the portal's stays open
A_FLOOR = -ARENA_D
SEAT_D = size_of('arena_seats')[1]
TH = 4.5
for k, (x, y, yaw, nx, ny) in enumerate(BAYS):
    if k == 0:
        continue
    r_in = TH + SEAT_D
    put('arena_seats', x - nx * r_in, y - ny * r_in, z=A_FLOOR - 0.15, yaw=yaw + math.pi, s=seg / 12.9, tint=0.4 + 0.2 * rng.rand())
    if k % 3 == 1:                                                      # the great braziers, on the top tier
        put('lamp_brazier', x - nx * (TH + 2.0), y - ny * (TH + 2.0), z=A_FLOOR + size_of('arena_seats')[2] - 0.3, yaw=rng.uniform(0, TAU), s=1.05)
# the mosaic, and what fell on it: a broken Warden, his plinth still standing to the north; drums rolled down from the ring
FL_RX, FL_RY = RX - 4.5 - SEAT_D, RY - 4.5 - SEAT_D
put('arena_floor', AX, AY, z=A_FLOOR + 0.05, yaw=0.0, s=FL_RX / 33.0, tint=0.5)
put('statue_feet', AX - 24.0, AY + FL_RY * 0.46, z=A_FLOOR + 0.6, yaw=math.pi + 0.3, s=0.72, tint=0.5)
put('statue_torso', AX + 21.0, AY + FL_RY * 0.1, z=A_FLOOR, yaw=2.1, s=0.72, tint=0.5)
put('statue_head', AX - 15.0, AY + FL_RY * 0.34, z=A_FLOOR - 0.5, yaw=4.4, s=1.0, tint=0.5)
for (fx, fy, fyaw) in [(-22.0, -7.0, 0.5), (13.0, -13.0, 2.2), (-5.0, 15.0, 1.1), (24.0, -2.0, 3.6), (-27.0, 8.0, 2.7)]:
    put('column_fallen', AX + fx, AY + fy, z=A_FLOOR - 0.1, yaw=fyaw, s=0.9)
for a in np.linspace(0, TAU, 8, endpoint=False) + 0.3:                  # braziers round the mosaic, clear of the gate's way in
    if abs(a - 4.71) < 0.45:
        continue
    put('lamp_brazier', AX + math.cos(a) * FL_RX * 0.96, AY + math.sin(a) * FL_RY * 0.96, z=A_FLOOR, yaw=a, s=0.8)

# the high temple on the acropolis, three more on the roads
temple(ACRO[0], ACRO[1] - 6.0, 0.0, 1.25, 4)
for tx, ty, tyaw in TEMPLES:
    temple(tx, ty, tyaw, 0.92, 2)

# stairs up the acropolis
sw, sd, sh = size_of('stair')
put('stair', ACRO[0], ACRO[1] - 44.0, z=ground(ACRO[0], ACRO[1] - 56.0) - 0.4, yaw=0.0, s=1.0)

# the blocks: a grid of insulae behind the avenues; the farther from the arena, the worse they have lasted
BLOCK = 49.0
for i in range(-7, 8):
    for j in range(-7, 8):
        cx = AX + BLOCK * (i + 0.5) + rng.uniform(-1.5, 1.5)
        cy = AY + BLOCK * (j + 0.5) + rng.uniform(-1.5, 1.5)
        if not in_city(cx, cy):
            continue
        if abs(cx - AX) < 37.0 or abs(cy - AY) < 37.0 or (abs(cx - ACRO[0]) < 22.0 and AY < cy < ACRO[1]):
            continue
        if not free_of(cx, cy, 22.0, CITY_TAKEN):
            continue
        if math.hypot((cx - ACRO[0]) / 74.0, (cy - ACRO[1]) / 66.0) < 1.05:
            continue
        e = math.hypot((cx - 22.0) / 268.0, (cy - 54.0) / 244.0)
        cond = float(np.clip(0.78 - e * 0.6 + rng.uniform(-0.2, 0.2), 0.05, 0.85))
        r = rng.rand()
        if r < 0.1:
            # an open square, a few drums and a fallen slab
            for k in range(4):
                put('column_broken', cx + rng.uniform(-12, 12), cy + rng.uniform(-12, 12), yaw=rng.uniform(0, TAU), s=rng.uniform(0.5, 1.0))
            CITY_TAKEN.append((cx, cy, 14.0))
        elif r < 0.24:
            for k in range(rng.randint(2, 5)):
                a = rng.randint(4) * math.pi / 2
                put('wall_broken', cx + rng.uniform(-11, 11), cy + rng.uniform(-11, 11), yaw=a, sink=0.4)
            CITY_TAKEN.append((cx, cy, 14.0))
        else:
            house(cx, cy, cond, 3 if rng.rand() < 0.7 else 2)

# ---- the reef shelf
put('sea_arch', ARCH_P[0], ARCH_P[1], z=-ARCH_D - 1.2, yaw=0.0, tint=0.5)


def scatter_reef():
    placed = []
    groups = [('coral_brain', 0.9, 0.7, 1.7), ('coral_table', 1.2, 0.6, 1.6), ('coral_branch', 0.8, 0.7, 2.0), ('coral_fan', 0.8, 0.7, 1.9),
              ('coral_tube', 0.7, 0.7, 1.7), ('anemone', 0.5, 0.7, 1.5)]
    # clusters round the coral heads: a garden, then its neighbours
    tries = 0
    centres = []
    while len(centres) < 300 and tries < 24000:
        tries += 1
        x, y = rng.uniform(-960, 500), rng.uniform(-950, -262)
        i, j = int((x - ORIGIN) / STEP), int((y - ORIGIN) / STEP)
        if patch[j, i] < 0.4 or w_reef[j, i] < 0.9 or slope_at(x, y) > 1.1 or depth_at(x, y) < 5.0:
            continue
        if math.hypot(x - ISLET_P[0], y - ISLET_P[1]) < 62.0 or abs(x - ARCH_P[0]) < 62.0 and abs(y - ARCH_P[1]) < 22.0:
            continue
        if math.hypot(x - SPAWN[0], y - SPAWN[1]) < 16.0 or math.hypot(x - SHRINE_REEF[0], y - SHRINE_REEF[1]) < 26.0:
            continue
        if not free_of(x, y, 13.0, centres):
            continue
        centres.append((x, y, 13.0))
    for (x, y, _) in centres:
        n = rng.randint(4, 10)
        for k in range(n):
            nm, rad, s0, s1 = groups[rng.randint(len(groups))]
            a, r = rng.uniform(0, TAU), rng.uniform(0, 10.0) ** 1.0
            px, py = x + math.cos(a) * r, y + math.sin(a) * r
            nat(nm, px, py, s=rng.uniform(s0, s1) * (1.25 if k == 0 else 1.0), sink=0.12)
    return centres


REEF_GARDENS = scatter_reef()
# coral lines the swim from the spawn to the arch, a garden to follow
for t in np.linspace(0.08, 0.92, 9):
    x = lerp(SPAWN[0], ARCH_P[0], t) + rng.uniform(-26, 26)
    y = lerp(SPAWN[1], ARCH_P[1], t)
    for k in range(6):
        nm = ['coral_table', 'coral_brain', 'coral_fan', 'coral_branch', 'coral_tube', 'anemone'][k]
        a, r = rng.uniform(0, TAU), rng.uniform(1.0, 9.0)
        put(nm, x + math.cos(a) * r, y + math.sin(a) * r, yaw=rng.uniform(0, TAU), s=rng.uniform(0.9, 1.7), sink=0.15)

# seagrass meadows on the sand
meadows = 0
for tries in range(52000):
    if meadows >= 1500:
        break
    x, y = rng.uniform(-960, 500), rng.uniform(-950, -270)
    i, j = int((x - ORIGIN) / STEP), int((y - ORIGIN) / STEP)
    if patch[j, i] > 0.1 or w_reef[j, i] < 0.9 or slope_at(x, y) > 0.5 or depth_at(x, y) < 3.0:
        continue
    if fbm(N, np.array(x), np.array(y), 1 / 64.0, 2, shift=151.0) < 0.05:
        continue
    put('seagrass', x, y, yaw=rng.uniform(0, TAU), s=rng.uniform(0.8, 1.5), sink=0.1)
    meadows += 1

# rocks on the reef's lip and round the islet
for tries in range(2000):
    if len(INST['rock_a']) + len(INST['rock_b']) + len(INST['rock_c']) >= 60:
        break
    x = rng.uniform(-600, 420)
    y = lip[0, int((x - ORIGIN) / STEP)] + rng.uniform(-30, 4)
    if abs(x - AX) < 34.0 or abs(x - ARCH_P[0]) < 58.0 or depth_at(x, y) < 6.0:
        continue
    nat(['rock_a', 'rock_b', 'rock_c'][rng.randint(3)], x, y, s=rng.uniform(0.8, 1.7), sink=0.2)
for i in range(10):
    a = rng.uniform(0, TAU)
    r = rng.uniform(26, 50)
    x, y = ISLET_P[0] + math.cos(a) * r, ISLET_P[1] + math.sin(a) * r
    nat(['rock_a', 'rock_b', 'rock_c'][rng.randint(3)], x, y, s=rng.uniform(1.0, 1.7), sink=0.2)

# the reef's bell shrine, and coral grown over its feet
put('bell_shrine', SHRINE_REEF[0], SHRINE_REEF[1], yaw=rng.uniform(0, TAU), sink=0.5, tint=0.6)
for k in range(16):
    a = k / 16 * TAU
    r = rng.uniform(13.0, 21.0)
    put(['coral_fan', 'coral_branch', 'coral_brain', 'anemone'][k % 4], SHRINE_REEF[0] + math.cos(a) * r, SHRINE_REEF[1] + math.sin(a) * r,
        yaw=rng.uniform(0, TAU), s=rng.uniform(0.9, 1.8), sink=0.15)

# ---- the kelp cathedral
kelp_spots = []


def in_kelp(x, y):
    return at(w_kelp, x, y) > 0.5


def kelp_at(x, y, tall=1.0):
    z = ground(x, y)
    top = rng.uniform(9.0, 26.0)                                       # how far under the surface the tip stops
    h = float(np.clip((-z - top) * tall, 15.0, 40.0))
    put('kelp_stalk', x, y, z=ground_range(x, y, 1.6)[0] - 0.2, yaw=rng.uniform(0, TAU), s=h / size_of('kelp_stalk')[2] if 'kelp_stalk' in (PIECES or {}) else h / 24.0)


for k in range(3):
    x = -612.0
    while x < -236.0:
        cy = nave_y(k, x)
        near_shrine = math.hypot(x - SHRINE_KELP[0], cy - SHRINE_KELP[1]) < 34.0
        for side in (-1, 1):
            for row, off in enumerate((19.0, 28.0, 39.0)):
                if near_shrine and row == 0:
                    continue
                if rng.rand() < (0.08 + row * 0.08):
                    continue
                px = x + rng.uniform(-3.0, 3.0) + (row * 3.2)
                py = cy + side * (off + rng.uniform(-2.2, 2.2))
                if depth_at(px, py) > 24.0 and in_kelp(px, py):
                    kelp_at(px, py)
        x += 9.5

# the forest between the naves
for tries in range(6000):
    if len(INST['kelp_stalk']) >= 1100:
        break
    x, y = rng.uniform(-625, -240), rng.uniform(-235, 300)
    if min(abs(y - nave_y(k, x)) for k in range(3)) < 44.0:
        continue
    if depth_at(x, y) < 24.0 or slope_at(x, y) > 1.3 or not in_kelp(x, y):
        continue
    kelp_at(x, y, 0.9)

# rock pillars standing along the naves like the piers of a nave
pillars = []
for k in range(3):
    x = -600.0
    while x < -250.0:
        for side in (-1, 1):
            px = x + rng.uniform(-8.0, 8.0)
            py = nave_y(k, px) + side * rng.uniform(47.0, 54.0)
            if math.hypot(px - SHRINE_KELP[0], py - SHRINE_KELP[1]) < 40.0 or not in_kelp(px, py):
                continue
            put('rock_pillar', px, py, yaw=rng.uniform(0, TAU), s=rng.uniform(0.7, 1.3), sink=2.5)
            pillars.append((px, py))
        x += rng.uniform(44.0, 62.0)
for tries in range(400):
    if len(INST['rock_a']) + len(INST['rock_b']) + len(INST['rock_c']) >= 150:
        break
    x, y = rng.uniform(-620, -240), rng.uniform(-235, 300)
    if min(abs(y - nave_y(k, x)) for k in range(3)) < 22.0 or not in_kelp(x, y) or min(math.hypot(x - a_[0], y - a_[1]) for a_ in INST['arch']) < 30.0:
        continue                                                         # the forest's stones keep clear of the road gates
    nat(['rock_a', 'rock_b', 'rock_c'][rng.randint(3)], x, y, s=rng.uniform(1.0, 1.7), sink=0.2)

put('bell_shrine', SHRINE_KELP[0], SHRINE_KELP[1], yaw=rng.uniform(0, TAU), sink=0.5, tint=0.45)

# ---- the trench: glow coral on the ledges, rock on the floor
glow = 0
for tries in range(30000):
    if glow >= 340:
        break
    x, y = rng.uniform(-560, 620), rng.uniform(370, 580)
    d = depth_at(x, y)
    if d < 92.0 or slope_at(x, y) > 1.4:
        continue
    if abs(y - float(trench_y(x))) > float(trench_half(x)[0]) + 2.0:
        continue
    if math.hypot(x - VC[0], y - VC[1]) > V_R0 - 6.0 and abs(math.atan2(x - VC[0], y - VC[1])) < 1.2:
        continue
    nat('glow_coral', x, y, s=rng.uniform(0.8, 2.6), sink=0.12, tint=float(rng.rand() < 0.28))
    glow += 1
for tries in range(800):
    if len(INST['rock_a']) + len(INST['rock_b']) + len(INST['rock_c']) >= 215:
        break
    x, y = rng.uniform(-540, 630), rng.uniform(380, 570)
    if depth_at(x, y) < 120.0 or slope_at(x, y) > 0.9 or math.hypot(x - SHRINE_DEEP[0], y - SHRINE_DEEP[1]) < 42.0:
        continue
    if math.hypot(x - VC[0], y - VC[1]) > V_R0 - 16.0 and abs(math.atan2(x - VC[0], y - VC[1])) < 1.25:
        continue
    nat(['rock_a', 'rock_b', 'rock_c'][rng.randint(3)], x, y, s=rng.uniform(1.0, 1.7), sink=0.2)
put('bell_shrine', SHRINE_DEEP[0], SHRINE_DEEP[1], yaw=rng.uniform(0, TAU), sink=0.5, tint=0.2)
for k in range(14):
    a = k / 14 * TAU
    r = rng.uniform(13.0, 24.0)
    x, y = SHRINE_DEEP[0] + math.cos(a) * r, SHRINE_DEEP[1] + math.sin(a) * r
    if depth_at(x, y) < 160.0:
        put('glow_coral', x, y, yaw=rng.uniform(0, TAU), s=rng.uniform(1.0, 2.2), sink=0.15, tint=float(k % 3 == 0))

# ---- Vesper: the terraces. Each riser is a street of lit facades with their backs to the rock; steep stairs climb three aisles; cold towers stand at the wings and on the canyon floor
V_ANG = 0.98
AISLES = (-0.56, 0.0, 0.56)
for k in range(len(V_LEVELS) - 1):
    r = V_R0 + V_STEP * (k + 1) - 1.6
    z0 = -V_LEVELS[k]
    da = 16.5 / r
    n = int(2 * V_ANG / da)
    for i in range(n):
        a = -V_ANG + (i + 0.5) * (2 * V_ANG) / n
        if min(abs(a - q) for q in AISLES) < 6.0 / r + da * 0.5:
            continue
        roll = rng.rand()
        if roll < 0.16:                                                 # bare rock, or a broken house front
            if roll < 0.08:
                put('wall_broken', VC[0] + math.sin(a) * r, VC[1] + math.cos(a) * r, z=z0 - 0.3, yaw=-a, tint=0.2)
            continue
        hs = 0.86 if roll < 0.4 else 1.0 if roll < 0.8 else 1.16
        put('wall_windows_cold', VC[0] + math.sin(a) * r, VC[1] + math.cos(a) * r, z=z0 - 0.3, yaw=-a, s=hs, tint=0.5)
    for q in AISLES:
        rs_ = V_R0 + V_STEP * (k + 1) - 13.2
        put('stair_steep', VC[0] + math.sin(q) * rs_, VC[1] + math.cos(q) * rs_, z=z0, yaw=-q, s=1.0, tint=0.5)
        for sg in (-1, 1):                                              # a pair of columns at each stair's foot
            ca = q + sg * 7.5 / r
            put('column', VC[0] + math.sin(ca) * (r - 12.0), VC[1] + math.cos(ca) * (r - 12.0), z=z0 - 0.2, yaw=rng.uniform(0, TAU), s=0.8, tint=0.3)
for sgn in (-1, 1):
    for k in (0, 2, 4):
        r = V_R0 + V_STEP * (k + 0.5)
        a = sgn * (V_ANG + 0.05)
        put('tower_cold', VC[0] + math.sin(a) * r, VC[1] + math.cos(a) * r, z=-V_LEVELS[k] - 0.5, yaw=rng.uniform(0, TAU), s=0.86 + 0.08 * k, tint=0.5)
    for a in (0.32, 0.78):
        r = V_R0 - 9.0
        px, py = VC[0] + math.sin(a * sgn) * r, VC[1] + math.cos(a * sgn) * r
        put('tower_cold', px, py, yaw=rng.uniform(0, TAU), s=1.0, sink=0.6, tint=0.5)
for k in range(40):                                                     # cold coral on the terrace lips, so the steps themselves catch the light
    a = rng.uniform(-V_ANG, V_ANG)
    ring = rng.randint(len(V_LEVELS) - 1)
    r = V_R0 + V_STEP * ring + 3.0
    put('glow_coral', VC[0] + math.sin(a) * r, VC[1] + math.cos(a) * r, z=-V_LEVELS[ring] - 0.1, yaw=rng.uniform(0, TAU), s=rng.uniform(0.9, 1.8), tint=0.0)

# ---- Meridon: a city of domes and towers on its shelf: a central rotunda, two crossed avenues of paired towers bridged overhead, lit facades down both sides, a dome in each quarter
MX, MY = MERIDON
put('dome_hall', MX, MY, yaw=0.0, s=1.5, sink=0.6, tint=0.5)
for sx in (-1, 1):
    for sy in (-1, 1):
        put('dome_hall', MX + sx * 86.0, MY + sy * 58.0, yaw=rng.uniform(0, TAU), s=rng.uniform(0.8, 1.05), sink=0.6, tint=0.5)


def avenue(x0, y0, x1, y1, half=20.0, every=56.0):
    L = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    nx, ny = -uy, ux
    bridge_yaw = math.atan2(ny, nx)
    n = int(L / every)
    for i in range(n + 1):
        d = i * every
        cx, cy = x0 + ux * d, y0 + uy * d
        z = max(ground(cx + nx * half, cy + ny * half), ground(cx - nx * half, cy - ny * half))
        for sgn in (-1, 1):
            put('tower', cx + nx * sgn * half, cy + ny * sgn * half, z=z - 0.6, yaw=rng.uniform(0, TAU), s=0.82 + 0.12 * (i % 3), tint=0.5)
        put('bridge_span', cx, cy, z=z + 24.0 + 6.0 * (i % 2), yaw=bridge_yaw, s=(2.0 * half - 5.0) / 36.0 + 0.04, tint=0.5)
        # lit facades, facing the avenue, between this tower pair and the next
        if i < n:
            for j in range(3):
                dd = d + 11.0 + j * 16.6
                for sgn in (-1, 1):
                    px, py = x0 + ux * dd + nx * sgn * 24.5, y0 + uy * dd + ny * sgn * 24.5
                    yaw = math.atan2(nx * sgn * 1.0, -ny * sgn * 1.0)              # its front looks across the avenue
                    put('wall_windows', px, py, yaw=yaw + math.pi if False else yaw, sink=0.4, tint=0.5)
            for j in (1, 2):
                dd = d + j * every / 3.0
                for sgn in (-1, 1):
                    put('lamp', x0 + ux * dd + nx * sgn * 12.0, y0 + uy * dd + ny * sgn * 12.0, yaw=rng.uniform(0, TAU))


avenue(MX - 156.0, MY, MX - 58.0, MY, every=46.0)
avenue(MX + 58.0, MY, MX + 150.0, MY, every=46.0)
avenue(MX, MY - 112.0, MX, MY - 50.0, every=46.0)
avenue(MX, MY + 50.0, MX, MY + 96.0, every=46.0)
for a in np.linspace(0, TAU, 12, endpoint=False):                       # a ring of columns and lamps round the rotunda
    put('column', MX + math.cos(a) * 42.0, MY + math.sin(a) * 42.0, yaw=rng.uniform(0, TAU), s=1.2)
    put('lamp', MX + math.cos(a + 0.26) * 38.0, MY + math.sin(a + 0.26) * 38.0, yaw=a)

# ---- the land: Sunward Isle and Crown Isle
LAND_KEEP = [(SUNWARD_HILL[0], SUNWARD_HILL[1], 44.0)]
temple(SUNWARD_HILL[0], SUNWARD_HILL[1], math.pi / 2, 0.95, 2)            # large enough to read from the sea
for a, r in ((0.5, 31.0), (2.3, 37.0), (3.8, 39.0), (5.4, 34.0)):
    x, y = SUNWARD_HILL[0] + math.cos(a) * r, SUNWARD_HILL[1] + math.sin(a) * r
    put('column_broken', x, y, yaw=rng.uniform(0, TAU), s=rng.uniform(0.6, 0.95))
nat('column_fallen', SUNWARD_HILL[0] + 26.0, SUNWARD_HILL[1] - 12.0, yaw=1.1, s=0.8, sink=0.0)
put('wall_broken', SUNWARD_HILL[0] - 40.0, SUNWARD_HILL[1] + 24.0, yaw=0.3, sink=0.4)

# the harbour: a stone quay with its lamps, a timber pier out into the bay, a house at its end, boats at their moorings; the light on the headland
EAST = S_ROT + math.pi / 2.0                                            # a quay's -y looks along the island's east
for k in range(8):
    x, y = iso(QX, -24.0 + 12.0 * k)
    put('quay', x, y, z=0.0, yaw=EAST, tint=0.5)
    if k % 2 == 0:
        lx, ly = iso(QX - 3.0, -24.0 + 12.0 * k)
        put('lamp', lx, ly, z=2.5, yaw=rng.uniform(0, TAU))
DECKS = []
for k in range(5):
    x, y = iso(QX + 8.0 + 12.0 * k, 18.0)
    put('pier', x, y, z=0.0, yaw=S_ROT - math.pi / 2.0, tint=rng.uniform(0.2, 0.8))
    DECKS.append({'id': 'pier_%d' % k, 'x': round(x, 2), 'y': round(y, 2), 'hx': 6.0, 'hy': 2.2, 'yaw': S_ROT, 'z': 1.9})
x, y = iso(QX + 69.0, 18.0)
put('pier_house', x, y, z=0.0, yaw=S_ROT + math.pi / 2.0, tint=0.5)
DECKS.append({'id': 'pier_head', 'x': round(x, 2), 'y': round(y, 2), 'hx': 5.0, 'hy': 4.0, 'yaw': S_ROT, 'z': 1.9})
for (lx, ly, a) in [(232.0, 2.0, 0.05), (250.0, 1.0, -0.08), (268.0, 3.0, 0.1), (238.0, 35.0, 0.04), (260.0, 36.0, -0.06)]:
    x, y = iso(lx, ly)
    put('boat_fishing', x, y, z=0.0, yaw=S_ROT + a, tint=rng.uniform(0.2, 0.9))
put('lighthouse', HEAD[0], HEAD[1], yaw=0.0, sink=0.3, tint=0.5)
LAND_KEEP.append((HEAD[0], HEAD[1], 52.0))                               # the point is rock


# Sunward Hollow: cottages round a green and along the lane down to the quay, doors to the lane
def cottage_at(lx, ly, face, kind=None):
    x, y = iso(lx, ly)
    nm = kind or ('cottage_b' if rng.rand() < 0.35 else 'cottage_a')
    put(nm, x, y, yaw=S_ROT + face, sink=0.44, tint=rng.uniform(0.2, 0.8))
    LAND_KEEP.append((x, y, 8.5))


H0 = HOLLOW_L[0] - 78.0                                                  # the village's own offset along the island
for lx in (58.0, 78.0, 98.0, 118.0, 138.0):
    cottage_at(H0 + lx, 12.0, 0.0)                                      # north of the lane, doors south
    cottage_at(H0 + lx, -24.0, math.pi)                                 # south of it, doors north
for ly in (-18.0, 8.0):
    cottage_at(H0 + 38.0, ly, math.pi / 2.0)                            # the green's west side
cottage_at(H0 + 152.0, -14.0, math.pi, 'cottage_b')
cottage_at(H0 + 152.0, 44.0, 0.0, 'cottage_b')                          # the harbour master, the net loft
for lx in (136.0, 120.0, 104.0):
    cottage_at(H0 + lx, 42.0, 0.0)
for lx in (46.0, 66.0, 86.0, 106.0, 126.0, 146.0):
    x, y = iso(H0 + lx, -6.0)
    put('lamp', x, y, yaw=rng.uniform(0, TAU))
for (lx, ly) in [(60.0, -6.0), (96.0, -6.0), (132.0, -6.0), (150.0, 24.0)]:
    x, y = iso(H0 + lx, ly)
    LAND_KEEP.append((x, y, 9.0))                                       # the lane stays clear
for r_ in RIVERS:                                                       # nothing grows in a river
    if r_['id'].startswith('sunward') or r_['id'].startswith('crown'):
        for q in r_['pts']:
            LAND_KEEP.append((q[0], q[1], r_['w'] * 2.0))


# dry-stone walls round the meadows, following the ground
def field_wall(l0, l1, n):
    for k in range(n):
        t = (k + 0.5) / n
        lx, ly = l0[0] + (l1[0] - l0[0]) * t + rng.uniform(-0.3, 0.3), l0[1] + (l1[1] - l0[1]) * t + rng.uniform(-0.3, 0.3)
        x, y = iso(lx, ly)
        if ground(x, y) < 1.8 or slope_at(x, y) > 0.45 or not free_of(x, y, 2.0, LAND_KEEP):
            continue
        a = math.atan2(l1[1] - l0[1], l1[0] - l0[0]) + S_ROT
        g0_, g1_ = ground(x - 4.03 * math.cos(a), y - 4.03 * math.sin(a)), ground(x + 4.03 * math.cos(a), y + 4.03 * math.sin(a))
        if abs(g0_ - g1_) > 1.7 or max(g0_, g1_) - 0.71 - ground(x, y) > 0.42:     # steeper than a piece's footing reaches: a gap in the wall
            continue
        # on a slope it stands proud of its high end by more than a step, so he can't walk onto it, and its footing stones reach the ground at its low end
        put('stone_wall', x, y, z=max(ground(x, y) - 0.25, max(g0_, g1_) - 0.71), yaw=a + rng.uniform(-0.05, 0.05), tint=rng.uniform(0.2, 0.8))


WALLS = [((-210.0, -130.0), (-60.0, -120.0)), ((-60.0, -120.0), (70.0, -134.0)), ((70.0, -134.0), (190.0, -116.0)), ((-90.0, -120.0), (-96.0, -74.0)), ((70.0, -134.0), (64.0, -70.0)),
         ((150.0, -126.0), (156.0, -66.0)), ((-200.0, 112.0), (-70.0, 104.0)), ((-70.0, 104.0), (60.0, 118.0)), ((60.0, 118.0), (150.0, 112.0)), ((-30.0, 106.0), (-22.0, 160.0)), ((96.0, 114.0), (102.0, 158.0)),
         ((-230.0, -40.0), (-180.0, -36.0)), ((-210.0, 40.0), (-168.0, 44.0))]
for w_ in WALLS:
    field_wall(w_[0], w_[1], int(math.hypot(w_[1][0] - w_[0][0], w_[1][1] - w_[0][1]) / 8.05))

# Crown's temple on its bench, the steep stairs up from the cove
temple(CROWN_TEMPLE[0], CROWN_TEMPLE[1], math.atan2(COVE_FOOT[0] - CROWN_TEMPLE[0], CROWN_TEMPLE[1] - COVE_FOOT[1]), 0.72, 2)   # looking down its stair to the cove
LAND_KEEP.append((CROWN_TEMPLE[0], CROWN_TEMPLE[1], 26.0))
yaw_ = math.atan2(COVE_FOOT[0] - CROWN_TEMPLE[0], CROWN_TEMPLE[1] - COVE_FOOT[1])      # its front looks down the flight, to the cove
put('stair_crown', COVE_FOOT[0], COVE_FOOT[1], z=1.9, yaw=yaw_, tint=0.3)
for k in range(5):
    t = k / 4.0
    LAND_KEEP.append((lerp(COVE_FOOT[0], CROWN_TEMPLE[0], t), lerp(COVE_FOOT[1], CROWN_TEMPLE[1], t), 9.0))

ISLE_BOX = [(SUNWARD[0], SUNWARD[1], 300.0), (CROWN[0], CROWN[1], 215.0)]


def on_isle(tries):
    for t in range(tries):
        cx, cy, R = ISLE_BOX[rng.randint(2)]
        a, r = rng.uniform(0, TAU), R * math.sqrt(rng.rand())
        yield cx + math.cos(a) * r, cy + math.sin(a) * r, (cx == CROWN[0])


def clear_land(x, y, r):
    return free_of(x, y, r, LAND_KEEP)


counts = defaultdict(int)
LIM = {(False, 'palm'): 70, (True, 'palm'): 230, (False, 'bush'): 170, (True, 'bush'): 440, (False, 'fern'): 90, (True, 'fern'): 300, (False, 'grass_tuft'): 300, (True, 'grass_tuft'): 220}
for x, y, crown in on_isle(90000):
    z, sl = ground(x, y), slope_at(x, y)
    if z < 0.9 or sl > 0.75:
        continue
    grove = float(fbm(N, np.array(x), np.array(y), 1 / 48.0, 2, shift=341.0))
    if crown and z > 58.0:
        continue                                                         # the top of the volcano is bare black rock
    if not clear_land(x, y, 3.0):
        continue
    roll = rng.rand()
    if not crown and at(srr, x, y) > 0.99:
        continue
    sandy = not crown and at(SUN_SAND, x, y) > 0.35
    if z < (7.0 if crown else 9.0) and roll < 0.34 and grove > (-0.05 if crown else 0.16) and sl < 0.45:           # palms in the hollows behind the beach, in clumps
        nm = 'palm_a' if rng.rand() < 0.5 else 'palm_b'
    elif z >= 7.0 and roll < (0.42 if crown else 0.0) and sl < 0.7 and grove > -0.14:
        nm = 'palm_a' if rng.rand() < 0.5 else 'palm_b'                  # the jungle band
    elif z >= 2.2 and roll < (0.8 if crown else 0.34) and not sandy:
        nm = 'bush'
    elif z >= 2.2 and roll < (0.92 if crown else 0.48) and not sandy:
        nm = 'fern'
    elif z >= 1.8:
        nm = 'grass_tuft'
    else:
        continue
    kind = 'palm' if nm.startswith('palm') else nm
    if counts[(crown, kind)] >= LIM[(crown, kind)]:
        continue
    if nm.startswith('palm') and not free_of(x, y, 5.0, LAND_KEEP):
        continue
    s_ = {'palm_a': rng.uniform(0.82, 1.2), 'palm_b': rng.uniform(0.82, 1.2), 'bush': rng.uniform(0.75, 1.5), 'fern': rng.uniform(0.8, 1.5), 'grass_tuft': rng.uniform(0.9, 1.7)}[nm]
    z_seat = None
    if not nm.startswith('palm'):                                        # a bush on a slope: let into the bank, its low side on the ground
        z_seat = seat(x, y, {'bush': 1.5, 'fern': 0.2, 'grass_tuft': 0.45}[nm] * s_, -0.16 * s_ if nm == 'bush' else -0.05 * s_)
        if z_seat is None:
            continue
    counts[(crown, kind)] += 1
    put(nm, x, y, z=z_seat, yaw=rng.uniform(0, TAU), s=s_, sink=0.25)

# Sunward's meadows: oaks in the open, standing apart, a tile of grass on every bit of green near the walks, drifts of flowers
OAKS, CLUMPS = [], []
for t in range(6000):
    if len(CLUMPS) >= 30:
        break
    a, r = rng.uniform(0, TAU), 300.0 * math.sqrt(rng.rand())
    x, y = SUNWARD[0] + math.cos(a) * r, SUNWARD[1] + math.sin(a) * r
    if 3.0 < ground(x, y) < 46.0 and slope_at(x, y) < 0.5 and at(SUN_SAND, x, y) < 0.2 and free_of(x, y, 12.0, LAND_KEEP) and free_of(x, y, 40.0, CLUMPS) and not (at(s_lx, x, y) > 24.0 and abs(at(s_ly, x, y) + 12.0) < 84.0):
        CLUMPS.append((x, y, 0.0))                                       # never on the seaward side of the hill: from the water the ridge and the temple stand clear
for cx, cy, c_ in CLUMPS:                                                # stands of a few trees, long and uneven, with open grass between them: never a row
    a0, n_ = rng.uniform(0, TAU), rng.randint(2, 10)
    for k in range(n_ * 3):
        u, v = rng.normal(0.0, 15.0), rng.normal(0.0, 7.0)
        x, y = cx + u * math.cos(a0) - v * math.sin(a0), cy + u * math.sin(a0) + v * math.cos(a0)
        if len(OAKS) < 118 and 3.0 < ground(x, y) < 46.0 and slope_at(x, y) < 0.55 and at(SUN_SAND, x, y) < 0.2 and free_of(x, y, 9.0, LAND_KEEP) and free_of(x, y, 7.0, OAKS):
            OAKS.append((x, y, 0.0))
            put('tree_oak_a' if rng.rand() < 0.55 else 'tree_oak_b', x, y, yaw=rng.uniform(0, TAU), s=rng.uniform(0.75, 1.3), sink=0.3)
            n_ -= 1
            if n_ <= 0:
                break
x0, x1, y0, y1 = SUNWARD[0] - 300.0, SUNWARD[0] + 300.0, SUNWARD[1] - 240.0, SUNWARD[1] + 240.0
n_g = n_f = 0
for gx_ in np.arange(x0, x1, 3.6):
    for gy_ in np.arange(y0, y1, 3.6):
        x, y = gx_ + rng.uniform(-1.3, 1.3), gy_ + rng.uniform(-1.3, 1.3)
        z = ground(x, y)
        if z < 1.9 or slope_at(x, y) > 0.8 or at(SUN_SAND, x, y) > 0.3 or at(srr, x, y) > 0.99:     # nothing grows on the reefs off the shore
            continue
        lush = float(fbm(N, np.array(x), np.array(y), 1 / 60.0, 2, shift=353.0))
        if lush < -0.08:                                                # drifts of grazed turf between the long grass
            continue
        put('grass_patch', x, y, z=z, yaw=rng.uniform(0, TAU), s=rng.uniform(0.9, 1.2), tint=rng.uniform(0.0, 1.0))
        n_g += 1
        if float(fbm(N, np.array(x), np.array(y), 1 / 34.0, 2, shift=351.0)) > 0.14 and rng.rand() < 0.5:
            fx_, fy_, sf_ = x + rng.uniform(-2, 2), y + rng.uniform(-2, 2), rng.uniform(0.9, 1.3)
            zf_ = seat(fx_, fy_, 2.7 * sf_, -0.05 * sf_) if clear_land(fx_, fy_, 0.0) else None                 # a flat drift of flowers: only where the ground under all of it is near level
            if zf_ is not None:
                put('wildflowers', fx_, fy_, z=zf_, yaw=rng.uniform(0, TAU), s=sf_)
                n_f += 1

# rock and wood on the shores
for t in range(9000):
    if len(INST['beach_rock']) >= 96:
        break
    cx, cy, R = ISLE_BOX[rng.randint(2)]
    a, r = rng.uniform(0, TAU), R * math.sqrt(rng.rand())
    x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
    if -1.4 < ground(x, y) < 1.3 and slope_at(x, y) < 0.5:               # on the shore itself, not the steep side of a reef
        for q in range(rng.randint(1, 5)):
            nat('beach_rock', x + rng.uniform(-3.0, 3.0), y + rng.uniform(-3.0, 3.0), s=rng.uniform(0.45, 1.2), sink=0.1)
# rock that breaks the waterline, round every island but the ice; and rock on Sunward's hill
for (cx, cy, R_, n_) in ((SUNWARD[0], SUNWARD[1], 340.0, 34), (CROWN[0], CROWN[1], 210.0, 16), (FROST[0], FROST[1], 280.0, 22), (CONE[0], CONE[1], 180.0, 12)):
    got = 0
    for t in range(6000):
        a, r = rng.uniform(0, TAU), R_ * math.sqrt(rng.rand())
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        if got < n_ and -3.6 < ground(x, y) < -0.8 and free_of(x, y, 16.0, LAND_KEEP):
            k = rng.randint(1, 4)
            for q in range(k):
                nat(['rock_a', 'rock_b', 'rock_c'][rng.randint(3)], x + rng.uniform(-7.0, 7.0), y + rng.uniform(-7.0, 7.0), s=rng.uniform(1.0, 1.6), sink=0.1)
            got += 1
HEAD_ROCKS = [iso(HEAD_L[0] + 34.0, HEAD_L[1] + 30.0), iso(HEAD_L[0] + 54.0, HEAD_L[1] + 6.0), iso(HEAD_L[0] - 6.0, HEAD_L[1] + 52.0)]
for (x, y) in HEAD_ROCKS:
    for q in range(3):
        nat(['rock_a', 'rock_b', 'rock_c'][rng.randint(3)], x + rng.uniform(-8.0, 8.0), y + rng.uniform(-8.0, 8.0), s=rng.uniform(1.3, 1.7), sink=0.1)
got = 0
for t in range(4000):
    a, r = rng.uniform(0, TAU), rng.uniform(30.0, 130.0)
    x, y = SUNWARD_HILL[0] + math.cos(a) * r, SUNWARD_HILL[1] + math.sin(a) * r
    if got < 22 and ground(x, y) > 10.0 and float(ridged(N, np.array(x), np.array(y), 1 / 58.0, 3, shift=314.0)) > 0.5 and free_of(x, y, 10.0, LAND_KEEP):
        for q in range(rng.randint(1, 4)):
            nat(['rock_a', 'rock_b', 'rock_c'][rng.randint(3)], x + rng.uniform(-6.0, 6.0), y + rng.uniform(-6.0, 6.0), s=rng.uniform(1.0, 1.6), sink=0.3)
        got += 1
for t in range(5000):
    if len(INST['driftwood']) >= 16:
        break
    cx, cy, R = ISLE_BOX[rng.randint(2)]
    a, r = rng.uniform(0, TAU), R * math.sqrt(rng.rand())
    x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
    if 0.5 < ground(x, y) < 1.6 and slope_at(x, y) < 0.25 and ground_range(x, y, 4.0)[1] - ground_range(x, y, 4.0)[0] < 0.9:
        nat('driftwood', x, y, s=rng.uniform(0.7, 1.2), sink=0.05)
# black cliffs on Crown's steep north and east, standing in the surf, a few: the terrain carries the strata now
for i in range(26):
    a = i / 26.0 * TAU + rng.uniform(-0.05, 0.05)
    if abs((a - math.radians(-125.0) + math.pi) % TAU - math.pi) < 1.75:
        continue
    r0 = 205.0
    x, y = CROWN[0] + math.cos(a) * r0, CROWN[1] + math.sin(a) * r0
    for r in np.arange(226.0, 120.0, -3.0):
        x, y = CROWN[0] + math.cos(a) * r, CROWN[1] + math.sin(a) * r
        if ground(x, y) > -6.0:
            break
    put('cliff_rock', x, y, z=ground(x, y) - 10.0, yaw=-a + math.pi / 2 + rng.uniform(-0.5, 0.5), s=rng.uniform(0.75, 1.3), tint=0.3)

# ---- Wrackreach: the ship graveyard: wrecks in hundreds down a grey valley, lanterns that nothing tends, the bones round the Kraken's pit
def in_ell(x, y, c, r, k=1.0):
    return math.hypot((x - c[0]) / (r[0] * k), (y - c[1]) / (r[1] * k)) < 1.0


WR_TAKEN = [(KRAKEN[0], KRAKEN[1], 100.0)]
n_w = 0
for t in range(14000):
    if n_w >= 220:
        break
    x, y = WRACK[0] + rng.uniform(-1.0, 1.0) * WRACK_R[0], WRACK[1] + rng.uniform(-1.0, 1.0) * WRACK_R[1]
    if not in_ell(x, y, WRACK, WRACK_R, 0.96) or not free_of(x, y, 11.0, WR_TAKEN):
        continue
    roll = rng.rand()
    nm = 'wreck_hull' if roll < 0.1 else 'wreck_bow' if roll < 0.55 else 'wreck_stern'
    s_ = rng.uniform(0.5, 0.95)
    WR_TAKEN.append((x, y, 11.0 * s_ + 3.0))
    nat(nm, x, y, s=s_, sink=0.2, tint=rng.uniform(0.0, 0.7))
    n_w += 1
    if rng.rand() < 0.2:
        a = rng.uniform(0, TAU)
        put('wreck_mast', x + math.cos(a) * 18.0 * s_, y + math.sin(a) * 18.0 * s_, yaw=rng.uniform(0, TAU), s=s_ * 1.1, sink=0.5)
    if rng.rand() < 0.6:
        a = rng.uniform(0, TAU)
        put('lamp_ghost', x + math.cos(a) * 24.0 * s_, y + math.sin(a) * 24.0 * s_, yaw=rng.uniform(0, TAU), s=rng.uniform(0.9, 1.3), sink=0.2, tint=rng.uniform(0.0, 1.0))
# the Kraken's lair: a ribcage round the pit, curving in over it, a broken crown of sea stacks on the rim, and the graveyard's lanterns going down into the dark, ledge by ledge
for k in range(14):
    a = k / 14.0 * TAU + rng.uniform(-0.1, 0.1)
    r_ = rng.uniform(58.0, 78.0)                                         # each on a ledge of the wall, at its own depth, so they stand one behind another
    x, y = KRAKEN[0] + math.cos(a) * r_, KRAKEN[1] + math.sin(a) * r_ * 1.25
    nat('rib_bone', x, y, yaw=a + math.pi, s=rng.uniform(0.9, 1.4), sink=0.4, tint=0.5)          # a rib curves toward its own +x: turned to face the pit, its tip leans in over it
for k, nm in enumerate(('wreck_bow', 'wreck_stern', 'wreck_hull', 'wreck_stern', 'wreck_bow', 'wreck_hull')):     # ships it dragged down, caught on the ledges
    a = (k + 0.5) / 6.0 * TAU + 0.35
    nat(nm, KRAKEN[0] + math.cos(a) * 76.0, KRAKEN[1] + math.sin(a) * 76.0 * 1.25, yaw=a + math.pi / 2.0 + rng.uniform(-0.5, 0.5), s=rng.uniform(1.0, 1.25), sink=0.5, tint=rng.uniform(0.2, 0.8))
for k in range(12):                                                      # and fallen rock on the floor
    a, r_ = rng.uniform(0, TAU), rng.uniform(14.0, 52.0)
    nat(('rock_a', 'rock_b', 'rock_c')[k % 3], KRAKEN[0] + math.cos(a) * r_, KRAKEN[1] + math.sin(a) * r_ * 1.25, s=rng.uniform(1.0, 1.4), sink=0.3, tint=0.2)
for k in range(9):
    a = k / 9.0 * TAU + 0.2 + rng.uniform(-0.15, 0.15)
    put('rock_pillar', KRAKEN[0] + math.cos(a) * 112.0, KRAKEN[1] + math.sin(a) * 132.0, yaw=rng.uniform(0, TAU), s=rng.uniform(0.8, 1.25), sink=2.0, tint=0.2)
for k, (r_, d_) in enumerate(((84.0, 0.0), (66.0, 0.6), (48.0, 1.2), (34.0, 1.8))):
    for j in range(5 - k):
        a = (j + d_) / (5.0 - k) * TAU
        x, y = KRAKEN[0] + math.cos(a) * r_, KRAKEN[1] + math.sin(a) * r_ * 1.2
        put('lamp_ghost', x, y, yaw=rng.uniform(0, TAU), s=1.3, sink=0.2, tint=0.5)
# the floor round the spawn: heads of coral in groups on the sand, near enough to swim to at once
got = 0
for t in range(800):
    a, r = rng.uniform(0, TAU), rng.uniform(22.0, 150.0)
    x, y = SPAWN[0] + math.cos(a) * r, SPAWN[1] + math.sin(a) * r
    if got < 16 and -28.0 < ground(x, y) < -5.0 and free_of(x, y, 14.0, [(p_[0], p_[1], 0.0) for p_ in INST['coral_table'][:0]]):
        for q in range(rng.randint(3, 7)):
            nm = ('coral_brain', 'coral_table', 'coral_fan', 'coral_branch', 'coral_tube', 'anemone')[rng.randint(6)]
            put(nm, x + rng.normal(0.0, 4.0), y + rng.normal(0.0, 4.0), yaw=rng.uniform(0, TAU), s=rng.uniform(0.8, 1.7), sink=0.15, tint=rng.uniform(0.0, 1.0))
        got += 1
for t in range(600):
    if len(INST['anchor']) >= 14:
        break
    x, y = WRACK[0] + rng.uniform(-1.0, 1.0) * WRACK_R[0], WRACK[1] + rng.uniform(-1.0, 1.0) * WRACK_R[1]
    if in_ell(x, y, WRACK, WRACK_R, 0.9) and free_of(x, y, 8.0, WR_TAKEN[:1]):
        put('anchor', x, y, yaw=rng.uniform(0, TAU), s=rng.uniform(1.0, 1.8), sink=0.2)

# ---- Rimehold: the Frozen Sea: an ice ceiling tile by tile, leads of open water in it where the light falls, pillars of ice holding the roof up, the caves thick with them to the east
for j_ in range(I_NY):
    for i_ in range(I_NX):
        if ICE_ROWS[j_][i_] == '1':
            put('ice_ceiling', I_X0 + (i_ + 0.5) * TILE, I_Y0 + (j_ + 0.5) * TILE, z=0.0, yaw=rng.randint(4) * math.pi / 2.0, tint=rng.uniform(0.0, 1.0))


def ice_cell(x, y):
    i_, j_ = int((x - I_X0) // TILE), int((y - I_Y0) // TILE)
    return 0 <= j_ < I_NY and 0 <= i_ < I_NX and ICE_ROWS[j_][i_] == '1'


def ice_rects(rows):
    """The sheet as solids: a few large overlapping rectangles, never tiles side by side. A body inside two boxes that share a face is pushed by each toward that face and stays there; here every
    two neighbouring tiles, and every four round a corner, lie inside one rectangle, so what's a face of one box is deep inside another, and that one sends him out by the top or the bottom."""
    ny, nx = len(rows), len(rows[0])
    on = lambda i, j: 0 <= j < ny and 0 <= i < nx and rows[j][i] == '1'
    full = lambda i0, i1, j0, j1: all(on(i, j) for j in range(j0, j1 + 1) for i in range(i0, i1 + 1))
    rects = []
    for j0 in range(ny):
        for j1 in range(j0, ny):
            for i0 in range(nx):
                for i1 in range(i0, nx):
                    if not full(i0, i1, j0, j1):
                        break
                    if not (full(i0 - 1, i1, j0, j1) or full(i0, i1 + 1, j0, j1) or full(i0, i1, j0 - 1, j1) or full(i0, i1, j0, j1 + 1)):
                        rects.append((i0, i1, j0, j1))
    want = set()
    for j in range(ny):
        for i in range(nx):
            if on(i, j):
                want.add((i, j, i, j))
                if on(i + 1, j):
                    want.add((i, j, i + 1, j))
                if on(i, j + 1):
                    want.add((i, j, i, j + 1))
                if on(i + 1, j) and on(i, j + 1) and on(i + 1, j + 1):
                    want.add((i, j, i + 1, j + 1))
    keep = []
    while want:
        gain = lambda r: sum(1 for w in want if r[0] <= w[0] and w[2] <= r[1] and r[2] <= w[1] and w[3] <= r[3])
        best = max(rects, key=lambda r: (gain(r), (r[1] - r[0] + 1) * (r[3] - r[2] + 1)))
        keep.append(best)
        want = {w for w in want if not (best[0] <= w[0] and w[2] <= best[1] and best[2] <= w[1] and w[3] <= best[3])}
    return keep


# the ice's edge: floes jammed along every lead, to hide the sheet's straight sides
ICE_SLABS = [{'t': 'box', 'x': round(I_X0 + (r_[0] + r_[1] + 1) * TILE / 2.0, 1), 'y': round(I_Y0 + (r_[2] + r_[3] + 1) * TILE / 2.0, 1), 'z0': -6.3, 'z1': 0.8,
              'hx': (r_[1] - r_[0] + 1) * TILE / 2.0, 'hy': (r_[3] - r_[2] + 1) * TILE / 2.0, 'yaw': 0.0} for r_ in ice_rects(ICE_ROWS)]
for j_ in range(I_NY):
    for i_ in range(I_NX):
        if ICE_ROWS[j_][i_] != '1':
            continue
        cx_, cy_ = I_X0 + (i_ + 0.5) * TILE, I_Y0 + (j_ + 0.5) * TILE
        for (dx_, dy_) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if ice_cell(cx_ + dx_ * TILE, cy_ + dy_ * TILE):
                continue
            ex_, ey_ = cx_ + dx_ * TILE / 2.0, cy_ + dy_ * TILE / 2.0
            for k in range(1):
                off = rng.uniform(-14.0, 14.0)
                fx_, fy_ = ex_ + (off if dy_ else rng.uniform(-3.0, 2.0) * dx_), ey_ + (off if dx_ else rng.uniform(-3.0, 2.0) * dy_)
                if ground(fx_, fy_) < -3.0:
                    if ground(fx_, fy_) < -9.0:                          # it floats: nothing grounded, and room under its keel
                        put('ice_floe', fx_, fy_, z=0.0, yaw=rng.uniform(0, TAU), s=rng.uniform(0.7, 1.3), tint=rng.uniform(0.0, 1.0))
for t in range(9000):
    if len(INST['ice_pillar']) >= 80:
        break
    x, y = RIME[0] + rng.uniform(-1.0, 1.0) * RIME_R[0], RIME[1] + rng.uniform(-1.0, 1.0) * RIME_R[1]
    if at(ri_e, x, y) > 0.96 or math.hypot(x - SHRINE_RIME[0], y - SHRINE_RIME[1]) < 30.0:
        continue
    caves = 96.0 < x < 430.0
    if not caves and rng.rand() > 0.34:
        continue
    g_ = ground(x, y)
    if g_ > -22.0 or (caves and (math.hypot(x - CAVES[0], y - CAVES[1]) < 34.0 or abs(y - 824.0) < 18.0 and x < CAVES[0])):
        continue                                                         # never in the way in, never on a wall
    h_ = size_of('ice_pillar')[2] or 60.0
    put('ice_pillar', x, y, yaw=rng.uniform(0, TAU), s=(-g_ - 1.0) / h_, sink=0.3, tint=rng.uniform(0.0, 1.0))
put('bell_shrine', SHRINE_RIME[0], SHRINE_RIME[1], yaw=rng.uniform(0, TAU), sink=0.5, tint=0.7)

# ---- Frost Isle: pines on its lower slopes, bergs off its shore; the fort on the ice shelf: a ring of cut ice with towers and one gate
PINES, STANDS = [], []
for t in range(3000):
    if len(STANDS) >= 24:
        break
    a, r = rng.uniform(0, TAU), 240.0 * math.sqrt(rng.rand())
    x, y = FROST[0] + math.cos(a) * r, FROST[1] + math.sin(a) * r
    if 3.0 < ground(x, y) < 30.0 and slope_at(x, y) < 0.6 and free_of(x, y, 34.0, STANDS):
        STANDS.append((x, y, 0.0))
for cx, cy, c_ in STANDS:                                                # stands of pine with open snow between them: dense in the middle, straggling at the edge
    a0, n_ = rng.uniform(0, TAU), rng.randint(3, 11)
    for k in range(n_ * 3):
        u, v = rng.normal(0.0, 12.0), rng.normal(0.0, 7.0)
        x, y = cx + u * math.cos(a0) - v * math.sin(a0), cy + u * math.sin(a0) + v * math.cos(a0)
        if len(PINES) < 140 and n_ > 0 and 3.0 < ground(x, y) < 34.0 and slope_at(x, y) < 0.6 and free_of(x, y, 3.2, PINES):
            PINES.append((x, y, 0.0))
            put('snow_pine', x, y, yaw=rng.uniform(0, TAU), s=rng.uniform(0.7, 1.55), sink=0.2)
            n_ -= 1
FW = size_of('ice_wall')[0] or 14.0
nw = int(TAU * 50.0 / FW)
for k in range(nw):
    a = k / nw * TAU
    x, y = FORT[0] + math.cos(a) * 56.0, FORT[1] + math.sin(a) * 46.0
    if abs((a - 0.0 + math.pi) % TAU - math.pi) < 0.16:                 # the east gate, toward the island
        put('ice_gate', x, y, yaw=a + math.pi / 2.0, sink=0.3, tint=0.5) if abs(a) < 0.07 or abs(a - TAU) < 0.07 else None
        continue
    put('ice_wall', x, y, yaw=a + math.pi / 2.0, sink=0.3, tint=rng.uniform(0.2, 0.8))
for k in range(6):
    a = (k + 0.5) / 6.0 * TAU
    put('ice_tower', FORT[0] + math.cos(a) * 60.0, FORT[1] + math.sin(a) * 50.0, yaw=rng.uniform(0, TAU), sink=0.3, tint=0.5)
put('ice_tower', FORT[0], FORT[1], yaw=0.0, s=1.5, sink=0.3, tint=0.5)   # the keep

# ---- Cindermere: black smokers in clusters over their mounds, lava in the fissures, the old forge
CL = []
for t in range(4000):
    if len(CL) >= 26:
        break
    x, y = CINDER[0] + rng.uniform(-1.0, 1.0) * CINDER_R[0], CINDER[1] + rng.uniform(-1.0, 1.0) * CINDER_R[1]
    if not in_ell(x, y, CINDER, CINDER_R, 0.9) or not free_of(x, y, 26.0, CL) or math.hypot(x - SHRINE_CINDER[0], y - SHRINE_CINDER[1]) < 34.0:
        continue
    CL.append((x, y, 10.0))
    for k in range(rng.randint(1, 4)):
        nat('smoker', x + rng.uniform(-9.0, 9.0), y + rng.uniform(-9.0, 9.0), s=rng.uniform(0.7, 1.5), sink=0.3, tint=rng.uniform(0.0, 1.0))
for t in range(9000):
    if len(INST['lava_crack']) >= 70:
        break
    x, y = CINDER[0] + rng.uniform(-1.0, 1.0) * CINDER_R[0], CINDER[1] + rng.uniform(-1.0, 1.0) * CINDER_R[1]
    if in_ell(x, y, CINDER, CINDER_R, 0.94) and slope_at(x, y) < 0.3 and ground_range(x, y, 9.0)[1] - ground_range(x, y, 9.0)[0] < 0.7:
        put('lava_crack', x, y, z=ground(x, y) - 0.04, yaw=rng.uniform(0, TAU), s=rng.uniform(0.45, 0.62), tint=rng.uniform(0.0, 1.0))     # short enough to lie on the floor it crosses: it's rigid and the floor isn't
put('forge_hall', FORGE[0], FORGE[1], z=-136.0 - 0.4, yaw=0.5, tint=0.5)
put('bell_shrine', SHRINE_CINDER[0], SHRINE_CINDER[1], yaw=rng.uniform(0, TAU), sink=0.5, tint=0.15)

# the bells of Meridon and of the arena
put('bell_shrine', SHRINE_GILD[0], SHRINE_GILD[1], yaw=rng.uniform(0, TAU), sink=0.5, tint=0.85)
SHRINE_GREAT = (AX, AY + (RY - 4.5 - size_of('arena_seats')[1]) * 0.58)
put('bell_shrine', SHRINE_GREAT[0], SHRINE_GREAT[1], z=-ARENA_D - 0.3, yaw=0.0, tint=0.5)

# ---- one thing seen from far off, for each biome that has none yet (W19b): the fog hides everything under water at 300 m, so each breaks the surface
STOOD = (-800.0, 258.0)
put('wreck_stand', STOOD[0], STOOD[1], z=ground(*STOOD) - 2.0, yaw=2.2, tint=0.3)
for k in range(3):
    a = k / 3.0 * TAU + 0.5
    put('lamp_ghost', STOOD[0] + math.cos(a) * 26.0, STOOD[1] + math.sin(a) * 26.0, yaw=a, s=1.3, sink=0.2, tint=0.5)
put('tower', MERIDON_SPIRE[0], MERIDON_SPIRE[1], z=-64.4, yaw=0.4, s=(64.0 + 20.0) / size_of('tower')[2], tint=0.5)
put('kelp_spire', NAVE_SPIRE[0], NAVE_SPIRE[1], z=ground(*NAVE_SPIRE) - 3.0, yaw=1.1, tint=0.5)
PLUMES = [{'id': 'cinder_cone', 'x': CONE[0], 'y': CONE[1], 'z': round(ground(*CONE), 1), 'r': 11.0, 'h': 90.0}, {'id': 'crown_crater', 'x': CROWN[0], 'y': CROWN[1], 'z': round(ground(*CROWN), 1), 'r': 12.0, 'h': 70.0}]

# ---- the open blue: the wreck, its masts and anchor, a few lonely rocks
WRECK_YAW = 0.42
put('wreck_hull', WRECK[0], WRECK[1], yaw=WRECK_YAW, sink=1.4, tint=0.5)
cw, sw2 = math.cos(WRECK_YAW), math.sin(WRECK_YAW)
put('wreck_mast', WRECK[0] + 26.0 * cw - 15.0 * sw2, WRECK[1] + 26.0 * sw2 + 15.0 * cw, yaw=WRECK_YAW + 1.2, sink=0.4, s=1.0)
put('wreck_mast', WRECK[0] - 31.0 * cw + 14.0 * sw2, WRECK[1] - 31.0 * sw2 - 14.0 * cw, yaw=WRECK_YAW - 0.7, sink=0.4, s=0.8)
put('anchor', WRECK[0] - 58.0, WRECK[1] - 24.0, yaw=1.1, s=1.6, sink=0.2)
for tries in range(300):
    if len(INST['rock_a']) + len(INST['rock_b']) + len(INST['rock_c']) >= 245:
        break
    x, y = rng.uniform(290, 630), rng.uniform(-430, 350)
    if math.hypot(x - WRECK[0], y - WRECK[1]) < 70.0 or depth_at(x, y) < 20.0 or math.hypot((x - MERIDON[0]) / 180.0, (y - MERIDON[1]) / 140.0) < 1.0 or -20.0 < y < 190.0 or x > 610.0:
        continue
    nat(['rock_a', 'rock_b', 'rock_c'][rng.randint(3)], x, y, s=rng.uniform(1.0, 1.7), sink=0.2)

# what lives in the sea stays in it: nothing of coral or weed stands in the air, wherever the shore came to be
_wet = ('coral_', 'anemone', 'seagrass', 'glow_coral', 'kelp_stalk')
_tall = {n_: (PIECES[n_]['hi'][2] if PIECES and n_ in PIECES else 2.0) for n_ in INST if n_.startswith(_wet)}
_dry = {(p_[0], round(p_[1], 1), round(p_[2], 1)) for p_ in PLACED if p_[0].startswith(_wet) and p_[3] + _tall[p_[0]] * p_[5] > -0.4}
PLACED = [p_ for p_ in PLACED if (p_[0], round(p_[1], 1), round(p_[2], 1)) not in _dry]
for n_ in _tall:
    INST[n_] = [r_ for r_ in INST[n_] if (n_, round(r_[0], 1), round(r_[1], 1)) not in _dry]
print('coral and weed out of the water, gone:', len(_dry))

# a roof only stands on walls: where every wall left under one is a broken one, lower than it, the roof fell long ago
_walls = [(x, y, z + 14.0 * s) for name, x, y, z, yaw, s in PLACED if name == 'wall_bay']
_gone = [(x, y) for name, x, y, z, yaw, s in PLACED if name == 'roof_slab' and not any(math.hypot(a - x, b - y) < 20.0 * s and t_ > z - 1.0 for a, b, t_ in _walls)]
PLACED = [p_ for p_ in PLACED if not (p_[0] == 'roof_slab' and (p_[1], p_[2]) in _gone)]
INST['roof_slab'] = [r_ for r_ in INST['roof_slab'] if not any(abs(r_[0] - a) < 0.06 and abs(r_[1] - b) < 0.06 for a, b in _gone)]
print('roofs with nothing to stand on, gone:', len(_gone))

# ---------------------------------------------------------------- colliders, from each piece's real size and place
COLL = []


def rnd(v):
    return round(float(v), 2)


FOOT = 1.0


def low_ground(x, y, q):
    """The lowest of five samples: the middle and a radius off along x and y. The same five world.js takes."""
    return min(ground(x, y), ground(x + q, y), ground(x - q, y), ground(x, y + q), ground(x, y - q))


UP_HIGH = {name for name, x, y, z, yaw, s in PLACED if z - ground(x, y) > 2.5}   # a kind that ever stands clear of the ground (a roof on its walls, a span) has no foot to bring down: that would fill the house under it
COLL_KEY = []
_seen = defaultdict(int)
for name, x, y, z, yaw, s in PLACED:
    cs, sn = math.cos(yaw), math.sin(yaw)
    inst = _seen[name]
    _seen[name] += 1
    for pi_, c in enumerate(local_colliders(name)):
        COLL_KEY.append((name, inst, pi_))
        wx = x + (c['x'] * cs - c['y'] * sn) * s
        wy = y + (c['x'] * sn + c['y'] * cs) * s
        z0 = z + c['z0'] * s
        z1 = z + c['z1'] * s
        if c['z0'] <= FOOT and name not in UP_HIGH:                     # a solid at the piece's foot goes down to the ground on its low side: nothing passes under a wall on a slope
            z0 = min(z0, low_ground(wx, wy, (c['r'] if c['t'] == 'cyl' else math.hypot(c['hx'], c['hy'])) * s) - 0.4)
        if c['t'] == 'cyl':
            COLL.append({'t': 'cyl', 'x': rnd(wx), 'y': rnd(wy), 'z0': rnd(z0), 'z1': rnd(z1), 'r': rnd(c['r'] * s)})
        else:
            COLL.append({'t': 'box', 'x': rnd(wx), 'y': rnd(wy), 'z0': rnd(z0), 'z1': rnd(z1), 'hx': rnd(c['hx'] * s), 'hy': rnd(c['hy'] * s),
                         'yaw': round((yaw + c.get('yaw', 0.0)) % TAU, 3)})


N_KIND = len(COLL)                                                      # everything before this came from a kind and an instance, and ships as col_kinds
COLL += ICE_SLABS
import check_traps
GAP_PLUGS = check_traps.plugs(COLL, ground)                              # a wide underside close over the ground, closed at the side: rising ground would lift him up into it
COLL += GAP_PLUGS


COL_HASH = defaultdict(list)
for c in COLL:
    q = c['r'] if c['t'] == 'cyl' else math.hypot(c['hx'], c['hy'])
    for i_ in range(int((c['x'] - q) // 32), int((c['x'] + q) // 32) + 1):
        for j_ in range(int((c['y'] - q) // 32), int((c['y'] + q) // 32) + 1):
            COL_HASH[(i_, j_)].append(c)


def inside_any(x, y, z, m=0.0):
    seen = COL_HASH.get((int(x // 32), int(y // 32)), []) if m < 16.0 else COLL
    if m > 0.0:
        seen = [c for a_ in (-m, m) for b_ in (-m, m) for c in COL_HASH.get((int((x + a_) // 32), int((y + b_) // 32)), [])]
    for c in seen:
        if z < c['z0'] - m or z > c['z1'] + m:
            continue
        if c['t'] == 'cyl':
            if math.hypot(x - c['x'], y - c['y']) < c['r'] + m:
                return True
        else:
            cs, sn = math.cos(c['yaw']), math.sin(c['yaw'])
            dx, dy = x - c['x'], y - c['y']
            lx, ly = dx * cs + dy * sn, -dx * sn + dy * cs
            if abs(lx) < c['hx'] + m and abs(ly) < c['hy'] + m:
                return True
    return False


# every way through every piece as it stands in the world, for the wall that swims each one: the middle, half the way, and a side step onto solid for its control
OPENINGS, OPEN_SHUT = [], defaultdict(int)
for name, x, y, z, yaw, s_ in PLACED:
    e = COLFIT.get(name)
    if not e or not e.get('openings') or name == 'arena_portal':        # the portal has the arena's gate in it, shut until the fight
        continue
    cs, sn = math.cos(yaw), math.sin(yaw)
    for o in e['openings']:
        wx, wy = x + (o['x'] * cs - o['y'] * sn) * s_, y + (o['x'] * sn + o['y'] * cs) * s_
        wz = z + o['z'] * s_
        dx, dy = (o['dx'] * cs - o['dy'] * sn) * s_, (o['dx'] * sn + o['dy'] * cs) * s_
        clear = all(ground(wx + dx * t_, wy + dy * t_) < wz - 0.8 and not inside_any(wx + dx * t_, wy + dy * t_, wz, 0.5) for t_ in np.linspace(-1.6, 1.6, 13))
        if not clear:
            OPEN_SHUT[name] += 1                                        # a neighbour, a rock or the ground stands in it: it doesn't look open
            continue
        q = {'kind': name, 'x': rnd(wx), 'y': rnd(wy), 'z': rnd(wz), 'dx': rnd(dx), 'dy': rnd(dy)}
        if o.get('sx') is not None and o.get('sy') is not None:
            q['sx'], q['sy'] = rnd((o['sx'] * cs - o['sy'] * sn) * s_), rnd((o['sx'] * sn + o['sy'] * cs) * s_)
        OPENINGS.append(q)
print('OPENINGS', len(OPENINGS), 'shut', dict(OPEN_SHUT))


# ---------------------------------------------------------------- the game's data
TOP_COLOSSUS = -PLAZA_D - 0.6 * 1.18 + size_of('statue_colossus')[2] * 1.18
ARENA_TOP = A_Z + size_of('arena_bay')[2]

POI = [
    ('reef', 'The Reef Shelf', SPAWN[0] + 60.0, SPAWN[1] + 60.0, -10.0, 130.0),
    ('sea_arch', 'The Sea Arch', ARCH_P[0], ARCH_P[1], -14.0, 54.0),
    ('islet', 'Gull Rock', ISLET_P[0], ISLET_P[1], -1.0, 50.0),
    ('sunward', 'Sunward Isle', SUNWARD[0], SUNWARD[1], 4.0, 190.0),
    ('sunward_temple', 'The Sunward Temple', SUNWARD_HILL[0], SUNWARD_HILL[1], 56.0, 34.0),
    ('sunward_hollow', 'Sunward Hollow', iso(*HOLLOW_L)[0], iso(*HOLLOW_L)[1], 7.0, 70.0),
    ('sunward_harbour', 'Sunward Harbour', iso(QX, 18.0)[0], iso(QX, 18.0)[1], 3.0, 56.0),
    ('sunward_lighthouse', 'Sunward Light', HEAD[0], HEAD[1], 30.0, 26.0),
    ('crown', 'Crown Isle', CROWN[0], CROWN[1], 30.0, 210.0),
    ('crown_cove', 'Crown Cove', CROWN[0] + math.cos(math.radians(-132.0)) * 112.0, CROWN[1] + math.sin(math.radians(-132.0)) * 112.0, 2.0, 50.0),
    ('reef_shrine', 'The Reef Shrine', SHRINE_REEF[0], SHRINE_REEF[1], -14.0, 34.0),
    ('kelp', 'The Kelp Cathedral', -430.0, 30.0, -40.0, 200.0),
    ('long_nave', 'The Long Nave', -320.0, nave_y(1, -320.0), -46.0, 60.0),
    ('kelp_shrine', 'The Kelp Shrine', SHRINE_KELP[0], SHRINE_KELP[1], -52.0, 40.0),
    ('thalor', 'Thalor', AX, AY - 150.0, -42.0, 230.0),
    ('processional', 'The Processional Way', AX, ROAD_S + 30.0, -48.0, 40.0),
    ('colossus', 'The Warden Colossus', PLAZA[0], PLAZA[1], -30.0, PLAZA_R + 10.0),
    ('arena', 'The Sunken Arena', AX, AY, A_Z + 8.0, RX + 16.0),
    ('high_temple', 'The High Temple', ACRO[0], ACRO[1], -34.0, 52.0),
    ('trench', 'The Vesper Deep', 120.0, float(trench_y(120.0)), -120.0, 170.0),
    ('deep_shrine', 'The Deep Shrine', SHRINE_DEEP[0], SHRINE_DEEP[1], -DEEP_LEDGE + 6.0, 40.0),
    ('open_blue', 'The Open Blue', 420.0, -80.0, -40.0, 200.0),
    ('wreck', 'The Old Wreck', WRECK[0], WRECK[1], ground(*WRECK) + 12.0, 60.0),
    ('otter_raft', 'The Otter Raft', NAVE_SPIRE[0] + 34.0, NAVE_SPIRE[1] + 10.0, -1.0, 40.0),
    ('meridon', 'Meridon', MERIDON[0], MERIDON[1], -40.0, 170.0),
    ('meridon_bakery', 'The Ember Bakery', MERIDON[0] - 112.0, MERIDON[1] - 34.0, -54.0, 20.0),
    ('meridon_bridge', 'The High Bridge', MERIDON[0] - 96.0, MERIDON[1], -36.0, 26.0),
    ('rimehold', 'Rimehold', RIME[0], RIME[1], -30.0, 300.0),
    ('rime_shrine', 'The Rime Shrine', SHRINE_RIME[0], SHRINE_RIME[1], -52.0, 40.0),
    ('rime_caves', 'The Rime Caves', CAVES[0], CAVES[1], -24.0, 110.0),
    ('frost_isle', 'Frost Isle', FROST[0], FROST[1], 14.0, 240.0),
    ('frost_fort', 'The Frost Fort', FORT[0], FORT[1], 6.0, 70.0),
    ('cindermere', 'Cindermere', CINDER[0], CINDER[1], -120.0, 260.0),
    ('cinder_shrine', 'The Cinder Shrine', SHRINE_CINDER[0], SHRINE_CINDER[1], -112.0, 40.0),
    ('cinder_forge', 'The Drowned Forge', FORGE[0], FORGE[1], -130.0, 46.0),
    ('wrackreach', 'Wrackreach', WRACK[0], WRACK[1], -50.0, 260.0),
    ('kraken_lair', 'The Kraken\'s Lair', KRAKEN[0], KRAKEN[1], -120.0, 90.0),
    ('crown_falls', 'Crown Falls', FALL_P[0], FALL_P[1], 28.0, 40.0),
    ('crown_temple', 'The Crown Temple', CROWN_TEMPLE[0], CROWN_TEMPLE[1], 30.0, 34.0),
    ('rotunda', 'The Golden Rotunda', MERIDON[0], MERIDON[1], -30.0, 48.0),
    ('vesper', 'Vesper', VC[0], VC[1] + V_R0 + 30.0, -150.0, 170.0),
    ('terraces', 'The Hanging Terraces', VC[0], VC[1] + V_R0 + 45.0, -150.0, 80.0),
]
BELL_H = 4.1                                                            # the mouth of the bell over the shrine's floor, free water all round it
BELLS = [
    {'id': 'gilded', 'name': 'The Gilded Bell', 'x': SHRINE_GILD[0], 'y': SHRINE_GILD[1], 'z': ground(*SHRINE_GILD) + BELL_H, 'yaw': 0.0},
    {'id': 'rime', 'name': 'The Rime Bell', 'x': SHRINE_RIME[0], 'y': SHRINE_RIME[1], 'z': ground(*SHRINE_RIME) + BELL_H, 'yaw': 0.0},
    {'id': 'cinder', 'name': 'The Cinder Bell', 'x': SHRINE_CINDER[0], 'y': SHRINE_CINDER[1], 'z': ground(*SHRINE_CINDER) + BELL_H, 'yaw': 0.0},
    {'id': 'great', 'name': 'The Great Bell', 'x': SHRINE_GREAT[0], 'y': SHRINE_GREAT[1], 'z': -ARENA_D + BELL_H, 'yaw': 0.0},
    {'id': 'reef', 'name': 'The Reef Bell', 'x': SHRINE_REEF[0], 'y': SHRINE_REEF[1], 'z': ground(*SHRINE_REEF) + BELL_H, 'yaw': 0.0},
    {'id': 'kelp', 'name': 'The Kelp Bell', 'x': SHRINE_KELP[0], 'y': SHRINE_KELP[1], 'z': ground(*SHRINE_KELP) + BELL_H, 'yaw': 0.0},
    {'id': 'deep', 'name': 'The Deep Bell', 'x': SHRINE_DEEP[0], 'y': SHRINE_DEEP[1], 'z': ground(*SHRINE_DEEP) + BELL_H, 'yaw': 0.0},
]

PEARLS = []
# what the walled cities closed in after the pearls were laid (g_collect G1o, 1 Nov): the nearest open water, read in the game
MOVED = {(440.0, 322.0, -54.0): [435.0, 319.5, -54.0], (-95.56, 549.01, -151.0): [-101.0, 549.0, -151.0]}


def pearl(x, y, z):
    PEARLS.append([round(float(x), 2), round(float(y), 2), round(float(z), 2)])


# through the sea arch: a line that shows you the way
for t in np.linspace(-1.0, 1.0, 7):
    pearl(ARCH_P[0], ARCH_P[1] + t * 26.0, -ARCH_D + 9.0 + 1.6 * math.cos(t * 1.5))
pearl(ARCH_P[0], ARCH_P[1] - 3.0, -ARCH_D - 1.2 + size_of('sea_arch')[2] + 2.0)   # over the top, for those who breach
# the islet: round its foot, one on its crown
for a in (0.4, 2.6, 4.4):
    pearl(ISLET_P[0] + math.cos(a) * 42.0, ISLET_P[1] + math.sin(a) * 42.0, ground(ISLET_P[0] + math.cos(a) * 42.0, ISLET_P[1] + math.sin(a) * 42.0) + 2.5)
# the reef: coral gardens off the path
for (x, y, _) in REEF_GARDENS[::22]:
    pearl(x, y, ground(x, y) + 3.5)
pearl(SPAWN[0] + 40.0, SPAWN[1] + 18.0, ground(SPAWN[0] + 40.0, SPAWN[1] + 18.0) + 3.0)     # the first one, on the coral by the spawn
# the colossus: at its feet, at its shoulders, on its crown, on the trident
COL_Z = -PLAZA_D - 0.6                                                  # the statue's base
pearl(PLAZA[0], PLAZA[1] - 15.0, -PLAZA_D + 3.5)
pearl(PLAZA[0] + 7.0, PLAZA[1], COL_Z + 41.5)                           # on the shoulders
pearl(PLAZA[0] - 7.0, PLAZA[1], COL_Z + 41.5)
pearl(PLAZA[0], PLAZA[1], COL_Z + 47.6)                                 # on the crown of the helm
pearl(PLAZA[0] - 6.5, PLAZA[1] - 2.4, COL_Z + 49.0)                     # beside the trident's head
# along the kelp naves
for k in range(3):
    for x in np.linspace(-590.0, -270.0, 6 if k == 1 else 4):
        y = nave_y(k, float(x))
        pearl(x, y, ground(float(x), y) + 7.0 + 3.0 * math.sin(float(x) * 0.05))
# high in the kelp, among the tips
for k in range(4):
    x, y = rng.uniform(-560, -300), nave_y(k % 3, -430.0 + 60.0 * k) + 30.0
    pearl(x, y, -16.0)
# the city: under the triumphal arches, on the temple porches, on the arena's rim, in the houses
pearl(AX, ROAD_S, -GATE_D + 12.0)
pearl(AX, AY - RY - 20.0, -RING_D + 11.0)
pearl(AX - RX - 34.0, AY, -RING_D + 11.0)
pearl(AX + RX + 34.0, AY, -RING_D + 11.0)
pearl(AX, AY + RY + 34.0, -RING_D + 11.0)
for a in (0.5, 2.0, 3.6, 5.0):
    pearl(AX + math.cos(a) * RX, AY + math.sin(a) * RY, ARENA_TOP + 3.0)
pearl(AX, AY, ARENA_D * -1.0 + 6.0)
pearl(ACRO[0], ACRO[1] - 6.0, -TOP_ACRO + 6.0)
pearl(ACRO[0], ACRO[1] + 14.0, -TOP_ACRO + 5.0)
for tx, ty, tyaw in TEMPLES:
    pearl(tx, ty, ground(tx, ty) + 6.0)
# down into the trench: a line that dares you over the rim, then the ledges, then the floor
for i in range(6):
    t = i / 5.0
    px = lerp(SHRINE_DEEP[0] + 100.0, SHRINE_DEEP[0] + 8.0, t)
    py = lerp(SHRINE_DEEP[1] - 26.0, SHRINE_DEEP[1], t)
    pearl(px, py, max(lerp(-88.0, -DEEP_LEDGE + 6.0, t), ground(px, py) + 5.0))
for x in (-420.0, -300.0, -200.0, -40.0, 110.0, 260.0, 400.0, 540.0):
    y = float(trench_y(x))
    pearl(x, y, ground(x, y) + 5.0)
# Meridon: at the rotunda's lantern, under the bridges, on the tower balconies; Vesper: up the stairs, along the terraces, on a tower's crown
pearl(MERIDON[0], MERIDON[1], ground(*MERIDON) + 1.5 * size_of('dome_hall')[2] + 2.5)
for (mx, my) in [(-100.0, 0.0), (100.0, 0.0), (0.0, -80.0), (0.0, 76.0)]:
    pearl(MERIDON[0] + mx, MERIDON[1] + my, ground(MERIDON[0] + mx, MERIDON[1] + my) + 10.0)
for (mx, my) in [(-86.0, 58.0), (86.0, -58.0)]:
    pearl(MERIDON[0] + mx, MERIDON[1] + my, ground(MERIDON[0] + mx, MERIDON[1] + my) + 40.0)
pearl(MERIDON[0] - 58.0, MERIDON[1] + 26.0, ground(MERIDON[0] - 58.0, MERIDON[1] + 26.0) + 4.0)
for k, q in enumerate(AISLES):
    r = V_R0 + V_STEP * (k + 1.5)
    pearl(VC[0] + math.sin(q + 0.1) * r, VC[1] + math.cos(q + 0.1) * r, -V_LEVELS[min(k + 1, 5)] + 3.0)
for k in (0, 1, 2, 3, 4):
    a = (-0.8 + 0.4 * k)
    r = V_R0 + V_STEP * (k + 0.45)
    pearl(VC[0] + math.sin(a) * r, VC[1] + math.cos(a) * r, -V_LEVELS[k] + 5.0)
# the new seas: down the graveyard, under the ice, round the vents, on the snow, up the falls
for k in range(6):
    a = k / 6.0 * TAU
    pearl(KRAKEN[0] + math.cos(a) * 60.0, KRAKEN[1] + math.sin(a) * 70.0, ground(KRAKEN[0] + math.cos(a) * 60.0, KRAKEN[1] + math.sin(a) * 70.0) + 6.0)
for y_ in (-120.0, 0.0, 220.0, 320.0):
    pearl(WRACK[0] + 20.0, WRACK[1] + y_, ground(WRACK[0] + 20.0, WRACK[1] + y_) + 7.0)
for g_ in ICE_GAPS[::9][:8]:
    pearl(g_[0], g_[1], -4.0)
for (px, py) in [(150.0, 816.0), (200.0, 830.0), (CAVES[0], CAVES[1] - 14.0), (-300.0, 860.0), (-420.0, 800.0)]:
    pearl(px, py, ground(px, py) + 8.0)
for c_ in CL[:7]:
    pearl(c_[0], c_[1], ground(c_[0], c_[1]) + 18.0)
for (px, py) in [(FROST[0], FROST[1]), (FROST[0] + 80.0, FROST[1] - 60.0), (FORT[0], FORT[1] + 18.0), (FORT[0] - 22.0, FORT[1] - 16.0)]:
    pearl(px, py, ground(px, py) + 1.4)
pearl(FALL_P[0], FALL_P[1], ground(FALL_P[0], FALL_P[1]) + 3.0)
pearl(FALL_B[0], FALL_B[1], ground(FALL_B[0], FALL_B[1]) + 3.0)
pearl(CROWN_TEMPLE[0], CROWN_TEMPLE[1], ground(CROWN_TEMPLE[0], CROWN_TEMPLE[1]) + 3.0)
# the wreck, the whales' road
pearl(WRECK[0], WRECK[1], ground(*WRECK) + 17.0)
pearl(WRECK[0] - 20.0 * cw, WRECK[1] - 20.0 * sw2, ground(*WRECK) + 13.0)
pearl(WRECK[0] + 22.0 * cw, WRECK[1] + 22.0 * sw2, ground(*WRECK) + 13.0)
for a in np.linspace(0, TAU, 7)[:-1]:
    pearl(430.0 + math.cos(a) * 170.0, 66.0 + math.sin(a) * 50.0, -30.0)

CHESTS = []


def chest(x, y, yaw=0.0):
    CHESTS.append([round(float(x), 2), round(float(y), 2), round(ground(x, y), 2), round(float(yaw) % TAU, 3)])


chest(ARCH_P[0] + 8.0, ARCH_P[1] + 2.0, 0.6)                           # under the arch
chest(SHRINE_REEF[0] - 40.0, SHRINE_REEF[1] - 38.0, 2.2)               # in the reef, past the shrine
chest(ISLET_P[0] + 44.0, ISLET_P[1] + 22.0, 1.0)                       # at the islet's foot
chest(SHRINE_KELP[0] + 34.0, SHRINE_KELP[1] + 8.0, 4.0)                # a side chapel of the kelp
chest(-540.0, nave_y(2, -540.0) + 8.0, 5.0)                            # the far end of the north nave
chest(-300.0, nave_y(0, -300.0) - 6.0, 2.0)                            # the south nave
chest(PLAZA[0] - 26.0, PLAZA[1] + 22.0, 1.4)                           # behind the colossus
chest(ACRO[0], ACRO[1] + 20.0, math.pi)                                # in the high temple
chest(-128.0 + 18.0, 128.0, 3.0)                                       # in a west temple
chest(SHRINE_DEEP[0] + 20.0, SHRINE_DEEP[1] + 9.0, 3.8)                # on the deep ledge
chest(300.0, float(trench_y(300.0)) + 8.0, 0.3)                        # on the trench floor
chest(WRECK[0] - 12.0 * cw + 14.0 * sw2, WRECK[1] - 12.0 * sw2 - 14.0 * cw, 0.9)      # beside the wreck

chest(MERIDON[0] + 62.0, MERIDON[1] + 38.0, 2.4)                         # behind a hall in Meridon
chest(KRAKEN[0] + 22.0, KRAKEN[1] + 16.0, 1.2)                           # at the bottom of the Kraken's pit
chest(WRACK[0] - 40.0, WRACK[1] + 240.0, 3.4)                            # in the graveyard's far end
chest(CAVES[0] + 16.0, CAVES[1] + 12.0, 0.6)                             # deep in the Rime Caves
chest(FORT[0] + 6.0, FORT[1] + 14.0, 2.6)                                # in the Frost Fort
chest(FORGE[0] - 16.0, FORGE[1] - 10.0, 5.2)                             # at the Drowned Forge
chest(FALL_B[0] + 8.0, FALL_B[1] - 6.0, 1.9)                             # behind Crown Falls
chest(VC[0] + math.sin(0.3) * (V_R0 + 36.0), VC[1] + math.cos(0.3) * (V_R0 + 36.0), -0.3)    # on a terrace of Vesper
chest(SUNWARD_HILL[0] + 3.0, SUNWARD_HILL[1] + 15.0, 3.1)                # Sunward's ruined temple
chest(CROWN[0] + math.cos(COVE_A) * 96.0 + 5.0, CROWN[1] + math.sin(COVE_A) * 96.0 + 2.0, 0.8)     # Crown Cove, at the head of the beach


def settle():
    """A pearl inside something rises until it is in open water; a chest inside something moves aside. Keeps a placement honest when the collision changes."""
    for p_ in PEARLS:
        for t in range(60):
            if not inside_any(p_[0], p_[1], p_[2], 0.7) and p_[2] > ground(p_[0], p_[1]) + 0.9:
                break
            p_[2] = round(p_[2] + 1.0, 2)
    for c_ in CHESTS:
        x0, y0 = c_[0], c_[1]
        for r in (0.0, 3.0, 6.0, 9.0, 12.0, 16.0, 20.0, 26.0):
            good = False
            for a in np.linspace(0, TAU, 12, endpoint=False):
                x, y = x0 + math.cos(a) * r, y0 + math.sin(a) * r
                if not inside_any(x, y, ground(x, y) + 0.7, 1.4):
                    c_[0], c_[1], c_[2] = round(x, 2), round(y, 2), round(ground(x, y), 2)
                    good = True
                    break
            if good:
                break


def shore(cx, cy, a, lo=0.25, hi=60.0):
    """Where a ray from the sea toward an island's middle first comes ashore, at about 0.3 m of height."""
    for r in np.arange(340.0, 20.0, -2.5):
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        if ground(x, y) > lo and ground(cx + math.cos(a) * (r - 14.0), cy + math.sin(a) * (r - 14.0)) > lo and ground(cx + math.cos(a) * (r - 40.0), cy + math.sin(a) * (r - 40.0)) > lo:     # the island's own shore, never a reef off it
            return x, y, ground(x, y)
    return cx, cy, ground(cx, cy)


LAND_PTS = []
for lid, lname, cx, cy, a in [('sunward_east', 'Sunward East Beach', SUNWARD[0], SUNWARD[1], 0.25), ('sunward_south', 'Sunward South Beach', SUNWARD[0], SUNWARD[1], -1.45),
                              ('crown_cove', 'Crown Cove', CROWN[0], CROWN[1], math.radians(-132.0)), ('crown_west', 'Crown West Shelf', CROWN[0], CROWN[1], math.radians(170.0))]:
    x, y, z = shore(cx, cy, a)
    LAND_PTS.append({'id': lid, 'name': lname, 'x': rnd(x), 'y': rnd(y), 'z': rnd(z)})
for a in (0.1, 0.8, 1.6, 2.4, 3.3, 4.2, 5.0, 5.7):                       # pearls on Sunward, up the path to the temple
    r = 150.0
    pass
for t in (0.2, 0.4, 0.6, 0.8):
    x = lerp(LAND_PTS[0]['x'], SUNWARD_HILL[0], t)
    y = lerp(LAND_PTS[0]['y'], SUNWARD_HILL[1], t)
    pearl(x, y, ground(x, y) + 1.4)
pearl(SUNWARD_HILL[0], SUNWARD_HILL[1], ground(*SUNWARD_HILL) + 2.0)
x, y = CROWN[0] + 8.0, CROWN[1] + 6.0
pearl(CROWN[0] + 24.0, CROWN[1] + 2.0, ground(CROWN[0] + 24.0, CROWN[1] + 2.0) + 1.5)    # on the crater's rim
for t in (0.25, 0.5, 0.75):
    x = lerp(LAND_PTS[2]['x'], CROWN[0] + 24.0, t)
    y = lerp(LAND_PTS[2]['y'], CROWN[1] + 2.0, t)
    pearl(x, y, ground(x, y) + 1.4)

settle()

# the fights
ENC = [
    {'id': 'reef_first', 'kind': 'shark', 'x': SHRINE_REEF[0], 'y': SHRINE_REEF[1] - 4.0, 'z': -13.0, 'n': 2, 'r': 26.0, 'tied_to': 'reef'},
    {'id': 'kelp_court', 'kind': 'reaver', 'x': SHRINE_KELP[0], 'y': SHRINE_KELP[1], 'z': -50.0, 'n': 4, 'r': 38.0, 'tied_to': 'kelp'},
    {'id': 'kelp_sharks', 'kind': 'mixed', 'x': SHRINE_KELP[0] + 16.0, 'y': SHRINE_KELP[1] + 10.0, 'z': -44.0, 'n': 3, 'r': 42.0, 'tied_to': 'kelp'},
    {'id': 'deep_court', 'kind': 'mixed', 'x': SHRINE_DEEP[0], 'y': SHRINE_DEEP[1], 'z': -DEEP_LEDGE + 8.0, 'n': 4, 'r': 40.0, 'tied_to': 'deep'},
    {'id': 'deep_hunters', 'kind': 'shark', 'x': SHRINE_DEEP[0] + 34.0, 'y': SHRINE_DEEP[1] + 28.0, 'z': -DEEP_LEDGE - 6.0, 'n': 2, 'r': 44.0, 'tied_to': 'deep'},
    {'id': 'gilded_court', 'kind': 'reaver', 'x': SHRINE_GILD[0], 'y': SHRINE_GILD[1], 'z': -56.0, 'n': 4, 'r': 34.0, 'tied_to': 'gilded'},
    {'id': 'rime_court', 'kind': 'mixed', 'x': SHRINE_RIME[0], 'y': SHRINE_RIME[1], 'z': -50.0, 'n': 5, 'r': 38.0, 'tied_to': 'rime'},
    {'id': 'cinder_court', 'kind': 'mixed', 'x': SHRINE_CINDER[0], 'y': SHRINE_CINDER[1], 'z': -110.0, 'n': 5, 'r': 38.0, 'tied_to': 'cinder'},
    {'id': 'patrol_wrack', 'kind': 'reaver', 'x': WRACK[0], 'y': WRACK[1] + 120.0, 'z': -66.0, 'n': 4, 'r': 44.0, 'tied_to': None},
    {'id': 'patrol_wrack_south', 'kind': 'mixed', 'x': WRACK[0] + 30.0, 'y': WRACK[1] - 200.0, 'z': -66.0, 'n': 4, 'r': 44.0, 'tied_to': None},
    {'id': 'patrol_rime_caves', 'kind': 'mixed', 'x': CAVES[0], 'y': CAVES[1], 'z': -28.0, 'n': 4, 'r': 36.0, 'tied_to': None},
    {'id': 'patrol_fort', 'kind': 'reaver', 'x': FORT[0], 'y': FORT[1] - 152.0, 'z': -30.0, 'n': 3, 'r': 34.0, 'tied_to': None},
    {'id': 'patrol_forge', 'kind': 'mixed', 'x': FORGE[0], 'y': FORGE[1] + 40.0, 'z': -120.0, 'n': 4, 'r': 40.0, 'tied_to': None},
    {'id': 'patrol_gate', 'kind': 'reaver', 'x': AX, 'y': ROAD_S + 44.0, 'z': -50.0, 'n': 2, 'r': 30.0, 'tied_to': None},
    {'id': 'patrol_plaza', 'kind': 'reaver', 'x': PLAZA[0] + 8.0, 'y': PLAZA[1] + 40.0, 'z': -46.0, 'n': 3, 'r': 36.0, 'tied_to': None},
    {'id': 'patrol_west', 'kind': 'reaver', 'x': -136.0, 'y': AY, 'z': -48.0, 'n': 3, 'r': 34.0, 'tied_to': None},
    {'id': 'patrol_east', 'kind': 'reaver', 'x': 186.0, 'y': AY, 'z': -48.0, 'n': 3, 'r': 34.0, 'tied_to': None},
    {'id': 'patrol_north', 'kind': 'mixed', 'x': AX, 'y': 214.0, 'z': -48.0, 'n': 4, 'r': 36.0, 'tied_to': None},
    {'id': 'patrol_temple', 'kind': 'mixed', 'x': ACRO[0], 'y': ACRO[1] - 46.0, 'z': -36.0, 'n': 4, 'r': 34.0, 'tied_to': None},
    {'id': 'patrol_meridon_west', 'kind': 'reaver', 'x': MERIDON[0] - 96.0, 'y': MERIDON[1], 'z': -56.0, 'n': 3, 'r': 34.0, 'tied_to': None},
    {'id': 'patrol_meridon_north', 'kind': 'mixed', 'x': MERIDON[0], 'y': MERIDON[1] + 78.0, 'z': -54.0, 'n': 3, 'r': 34.0, 'tied_to': None},
    {'id': 'patrol_rotunda', 'kind': 'reaver', 'x': MERIDON[0] + 46.0, 'y': MERIDON[1] - 30.0, 'z': -56.0, 'n': 3, 'r': 30.0, 'tied_to': None},
    {'id': 'patrol_vesper_low', 'kind': 'reaver', 'x': VC[0] - 40.0, 'y': VC[1] + V_R0 + 8.0, 'z': -188.0, 'n': 3, 'r': 34.0, 'tied_to': None},
    {'id': 'patrol_vesper_high', 'kind': 'mixed', 'x': VC[0] + 56.0, 'y': VC[1] + V_R0 + 46.0, 'z': -150.0, 'n': 3, 'r': 34.0, 'tied_to': None},
    {'id': 'roam_blue', 'kind': 'shark', 'x': 330.0, 'y': 40.0, 'z': -40.0, 'n': 2, 'r': 60.0, 'tied_to': None},
    {'id': 'roam_moat', 'kind': 'shark', 'x': -180.0, 'y': -238.0, 'z': -44.0, 'n': 2, 'r': 54.0, 'tied_to': None},
]


def loop(cx, cy, rx, ry, z, n=12, wob=0.12, rot=0.0):
    out = []
    for i in range(n):
        a = i / n * TAU
        r = 1.0 + wob * math.sin(3.0 * a + rot)
        ex, ey = math.cos(a) * rx * r, math.sin(a) * ry * r
        cs, sn = math.cos(rot), math.sin(rot)
        px, py = cx + ex * cs - ey * sn, cy + ex * sn + ey * cs
        pz = z + 6.0 * math.sin(2.0 * a + rot)
        out.append([round(px, 1), round(py, 1), round(pz, 1)])
    return out


WHALES = [
    {'path': loop(430.0, 62.0, 184.0, 44.0, -30.0, 14, 0.06, 0.0)},       # the whales' road, between Crown Isle and Meridon
    {'path': loop(322.0, 100.0, 26.0, 62.0, -44.0, 10, 0.06, 0.1)},       # up the moat's east side
    {'path': loop(840.0, 280.0, 130.0, 300.0, -36.0, 14, 0.08, 0.1)},     # the long road up the east
]

SCHOOLS = []
for k, (x, y) in enumerate([(g[0], g[1]) for g in REEF_GARDENS[::9]][:14]):
    SCHOOLS.append({'kind': ['fish_a', 'fish_b'][k % 2], 'n': int(rng.randint(26, 52)), 'x': rnd(x), 'y': rnd(y), 'z': rnd(min(ground(x, y) + 5.0, ground(x, y) * 0.45)), 'r': 13.0})
for (x, y, n) in [(ARCH_P[0], ARCH_P[1], 60), (SPAWN[0] + 24.0, SPAWN[1] + 46.0, 44), (SHRINE_REEF[0], SHRINE_REEF[1] + 30.0, 40)]:
    SCHOOLS.append({'kind': 'fish_a', 'n': n, 'x': rnd(x), 'y': rnd(y), 'z': rnd(max(ground(x, y) + 7.0, -14.0)), 'r': 15.0})
for k in range(3):
    for x in (-540.0, -340.0):
        y = nave_y(k, x)
        SCHOOLS.append({'kind': 'fish_c', 'n': int(rng.randint(30, 60)), 'x': rnd(x), 'y': rnd(y), 'z': rnd(ground(x, y) + 16.0), 'r': 16.0})
for (x, y) in [(PLAZA[0], PLAZA[1] - 6.0), (AX - 70.0, AY - 80.0), (AX + 80.0, AY + 70.0), (ACRO[0], ACRO[1] - 20.0)]:
    SCHOOLS.append({'kind': 'fish_c', 'n': int(rng.randint(30, 50)), 'x': rnd(x), 'y': rnd(y), 'z': rnd(ground(x, y) + 20.0), 'r': 18.0})
for (x, y) in [(WRECK[0], WRECK[1]), (MERIDON[0] - 70.0, MERIDON[1] + 44.0), (MERIDON[0] + 80.0, MERIDON[1] - 30.0), (170.0, -330.0)]:
    SCHOOLS.append({'kind': 'fish_b', 'n': 46, 'x': rnd(x), 'y': rnd(y), 'z': rnd(min(ground(x, y) + 16.0, -4.0)), 'r': 18.0})

# drifters: creatures with no school (an addition to the contract; nothing else reads it unless it wants them)
DRIFT = []
for x in np.linspace(-420.0, 560.0, 12):
    y = float(trench_y(float(x))) + rng.uniform(-50.0, 50.0)
    DRIFT.append({'kind': 'jelly', 'n': int(rng.randint(6, 13)), 'x': rnd(x), 'y': rnd(y), 'z': rnd(-rng.uniform(95.0, 165.0)), 'r': 34.0})
DRIFT.append({'kind': 'jelly', 'n': 10, 'x': rnd(SHRINE_DEEP[0]), 'y': rnd(SHRINE_DEEP[1]), 'z': -132.0, 'r': 30.0})
for (x, y, z) in [(SPAWN[0] + 74.0, SPAWN[1] + 40.0, -8.0), (ARCH_P[0] - 90.0, ARCH_P[1] - 30.0, -14.0), (SHRINE_REEF[0] + 110.0, SHRINE_REEF[1] + 40.0, -12.0), (-110.0, -420.0, -11.0)]:
    DRIFT.append({'kind': 'turtle', 'n': 1, 'x': rnd(x), 'y': rnd(y), 'z': rnd(z), 'r': 44.0})
for (x, y, z) in [(170.0, -340.0, -14.0), (-120.0, -372.0, -12.0), (250.0, 0.0, -26.0)]:
    DRIFT.append({'kind': 'manta', 'n': 2, 'x': rnd(x), 'y': rnd(y), 'z': rnd(z), 'r': 70.0})

# bottlenose pods run the blue and the shelf's edge; blacktip reef sharks patrol the reef's gardens and its lip (life.js reads both)
PODS = [
    {'id': 'open_blue', 'x': 430.0, 'y': 70.0, 'z': -3.0, 'n': 7, 'r': 120.0},
    {'id': 'shelf_edge', 'x': 372.0, 'y': -476.0, 'z': -3.0, 'n': 5, 'r': 70.0},
    {'id': 'over_the_reef', 'x': 40.0, 'y': -480.0, 'z': -3.0, 'n': 4, 'r': 70.0},
]
SHARKS = [
    {'x': 60.0, 'y': -360.0, 'z': -18.0, 'n': 3, 'r': 90.0},
    {'x': -150.0, 'y': -330.0, 'z': -20.0, 'n': 2, 'r': 80.0},
    {'x': 196.0, 'y': -300.0, 'z': -24.0, 'n': 2, 'r': 90.0},
    {'x': -420.0, 'y': -260.0, 'z': -24.0, 'n': 2, 'r': 80.0},
]
# keep the living in the water they were placed for
for lst in (DRIFT, SHARKS):
    for e in lst:
        g_ = ground(e['x'], e['y'])
        if e['z'] < g_ + 3.0 or e['z'] > -2.0:
            e['z'] = rnd(min(g_ * 0.5, -3.0))
gate_size = size_of('arena_gate')
GZ = A_Z - 0.5
for c in local_colliders('arena_gate'):
    COLL.append({'t': 'box', 'x': rnd(GATE_POS[0] + c['x']), 'y': rnd(GATE_POS[1] + c['y']), 'z0': rnd(GZ + c['z0']), 'z1': rnd(GZ + c['z1']), 'hx': rnd(c['hx']), 'hy': rnd(c['hy']), 'yaw': 0.0, 'gate': True})

# every pearl within reach: on land by a walker, over the sea by a breach, which tops out about 7 m (G6r)
for q_ in PEARLS:
    for t_ in range(64):                                                 # clear of whatever stands there: the nearest free place, on a spiral going outward from where it was asked for
        x_, y_ = q_[0] + 0.9 * t_ * math.cos(t_ * 2.4), q_[1] + 0.9 * t_ * math.sin(t_ * 2.4)
        g_ = ground(x_, y_)
        z_ = g_ + 1.8 if g_ > -0.5 else max(min(q_[2], 6.5), g_ + 1.8)
        if not inside_any(x_, y_, z_, 0.8):
            q_[0], q_[1], q_[2] = round(x_, 2), round(y_, 2), round(z_, 2)
            break

# ---- W15: the second cast, each where its kind lives. A key of its own: life.js ignores it until each species has its entry there
def pts_on(n, cx, cy, r, test, tries=4000):
    out = []
    for t_ in range(tries):
        if len(out) >= n:
            break
        a, q = rng.uniform(0, TAU), r * math.sqrt(rng.rand())
        x, y = cx + math.cos(a) * q, cy + math.sin(a) * q
        if test(x, y):
            out.append([round(x, 1), round(y, 1), round(ground(x, y), 1), round(rng.uniform(0, TAU), 2)])
    return out


def beach(x, y):
    return -0.2 < ground(x, y) < 1.4 and slope_at(x, y) < 0.3


def meadow(x, y):
    return 3.0 < ground(x, y) < 30.0 and slope_at(x, y) < 0.35 and free_of(x, y, 12.0, LAND_KEEP)


def floor_clear(x, y):
    return slope_at(x, y) < 0.5


_wr = [[round(r_[0], 1), round(r_[1], 1), round(r_[2] + 2.4 * r_[4], 1), round(r_[3], 2)] for r_ in np.array(INST['wreck_bow']).reshape(-1, 6)[::5][:12]]
_co = [[round(r_[0], 1), round(r_[1], 1), round(r_[2] + 1.0, 1), round(r_[3], 2)] for r_ in np.array(INST['coral_brain']).reshape(-1, 6)[::40][:8]]
LIFE = [
    {'kind': 'hammerhead', 'mode': 'cruise', 'n': 3, 'x': -120.0, 'y': -330.0, 'z': -26.0, 'r': 140.0},
    {'kind': 'hammerhead', 'mode': 'cruise', 'n': 2, 'x': 520.0, 'y': -60.0, 'z': -40.0, 'r': 160.0},
    {'kind': 'moray', 'mode': 'lurk', 'pts': _wr + _co},                  # head out of a wreck or a coral head, jaws working
    {'kind': 'anglerfish', 'mode': 'drift', 'n': 8, 'x': 120.0, 'y': 478.0, 'z': -165.0, 'r': 260.0},
    {'kind': 'anglerfish', 'mode': 'drift', 'n': 4, 'x': VC[0], 'y': VC[1] + 22.0, 'z': -170.0, 'r': 90.0},
    {'kind': 'giant_crab', 'mode': 'crawl', 'pts': pts_on(6, 40.0, 478.0, 300.0, floor_clear) + pts_on(5, WRACK[0], WRACK[1], 240.0, floor_clear)},
    {'kind': 'narwhal', 'mode': 'cruise', 'n': 5, 'x': -100.0, 'y': RIME[1], 'z': -24.0, 'r': 300.0},
    {'kind': 'seal', 'mode': 'cruise', 'n': 7, 'x': -240.0, 'y': RIME[1], 'z': -12.0, 'r': 260.0},
    {'kind': 'sea_otter', 'mode': 'raft', 'n': 7, 'x': NAVE_SPIRE[0] + 34.0, 'y': NAVE_SPIRE[1] + 10.0, 'z': 0.0, 'r': 16.0},
    {'kind': 'gull', 'mode': 'soar', 'n': 12, 'x': HEAD[0], 'y': HEAD[1], 'z': 26.0, 'r': 90.0},
    {'kind': 'gull', 'mode': 'soar', 'n': 8, 'x': _ca(-132.0, 150.0)[0], 'y': _ca(-132.0, 150.0)[1], 'z': 40.0, 'r': 130.0},
    {'kind': 'gull', 'mode': 'soar', 'n': 5, 'x': ISLET_P[0], 'y': ISLET_P[1], 'z': 18.0, 'r': 50.0},
    {'kind': 'crab', 'mode': 'crawl', 'pts': pts_on(26, SUNWARD[0], SUNWARD[1], 310.0, beach, 20000) + pts_on(14, CROWN[0], CROWN[1], 215.0, beach, 12000)},
    {'kind': 'parrotfish', 'mode': 'drift', 'n': 9, 'x': 60.0, 'y': -470.0, 'z': -14.0, 'r': 180.0},
    {'kind': 'parrotfish', 'mode': 'drift', 'n': 6, 'x': -300.0, 'y': -760.0, 'z': -14.0, 'r': 160.0},
    {'kind': 'barracuda', 'mode': 'cruise', 'n': 8, 'x': 330.0, 'y': -420.0, 'z': -18.0, 'r': 110.0},
    {'kind': 'barracuda', 'mode': 'cruise', 'n': 6, 'x': 300.0, 'y': 20.0, 'z': -34.0, 'r': 90.0},
    {'kind': 'nautilus', 'mode': 'drift', 'n': 10, 'x': MERIDON[0], 'y': MERIDON[1], 'z': -44.0, 'r': 140.0},
    {'kind': 'ember_eel', 'mode': 'lurk', 'pts': pts_on(12, CINDER[0], CINDER[1], 220.0, floor_clear)},
    {'kind': 'gull', 'mode': 'soar', 'n': 6, 'x': FROST[0], 'y': FROST[1], 'z': 34.0, 'r': 130.0},
    {'kind': 'seal', 'mode': 'cruise', 'n': 5, 'x': FROST[0] - 40.0, 'y': FROST[1] - 200.0, 'z': -10.0, 'r': 90.0},
    {'kind': 'barracuda', 'mode': 'cruise', 'n': 6, 'x': WRACK[0], 'y': WRACK[1] + 60.0, 'z': -50.0, 'r': 120.0},
    {'kind': 'goat', 'mode': 'graze', 'pts': pts_on(10, SUNWARD_HILL[0] + 90.0, SUNWARD_HILL[1] + 10.0, 150.0, meadow)},
]

# a kind's solids once; world.js sets them out for each instance. So the file carries each shape once, and data.colliders in the game is the same whole list as ever
COL_KINDS = {}
for name in INST:
    q_ = []
    for c in local_colliders(name):
        e = {k: c[k] for k in ('t', 'x', 'y', 'z0', 'z1', 'r', 'hx', 'hy', 'yaw') if k in c}
        if c['z0'] <= FOOT and name not in UP_HIGH:
            e['foot'] = 1
        q_.append(e)
    if q_:
        COL_KINDS[name] = q_


def expand_kinds():
    """The same sum world.js does, written from its reader, not from the loop above: a check that the file means what the full list meant."""
    out = []
    for name, c_ in COL_KINDS.items():
        rows = np.array(INST[name], dtype=np.float64).reshape(-1, 6)
        for x, y, z, yaw, s_, t_ in rows:
            cs, sn = math.cos(yaw), math.sin(yaw)
            for c in c_:
                wx, wy = x + (c['x'] * cs - c['y'] * sn) * s_, y + (c['x'] * sn + c['y'] * cs) * s_
                z0, z1 = z + c['z0'] * s_, z + c['z1'] * s_
                if c.get('foot'):
                    z0 = min(z0, low_ground(wx, wy, (c['r'] if c['t'] == 'cyl' else math.hypot(c['hx'], c['hy'])) * s_) - 0.4)
                if c['t'] == 'cyl':
                    out.append(('cyl', wx, wy, z0, z1, c['r'] * s_, 0.0, 0.0))
                else:
                    out.append(('box', wx, wy, z0, z1, c['hx'] * s_, c['hy'] * s_, (yaw + c.get('yaw', 0.0)) % TAU))
    return out


_b = expand_kinds()
assert len(_b) == N_KIND, (len(_b), N_KIND)
_w, _at = 0.0, None
_i = 0
_full = {}
for k_, c_ in enumerate(COLL[:N_KIND]):
    _full[(COLL_KEY[k_])] = c_
_n = 0
for name, list_ in COL_KINDS.items():
    for inst in range(len(INST[name])):
        for pi_ in range(len(list_)):
            c = _full[(name, inst, pi_)]
            e = _b[_n]
            _n += 1
            d_ = max(abs(c['x'] - e[1]), abs(c['y'] - e[2]), abs(c['z0'] - e[3]), abs(c['z1'] - e[4]), abs(c.get('r', c.get('hx')) - e[5]), abs(c.get('hy', 0.0) - e[6]))
            if d_ > _w:
                _w, _at = d_, (name, inst, pi_)
print('COL_KINDS %d kinds, %d shapes for %d colliders; worst difference from the full list %.3f m at %s (instances are stored rounded, kinds of little things to 0.1 m)' % (len(COL_KINDS), sum(len(v) for v in COL_KINDS.values()), len(_b), _w, _at))
assert _w < 0.25, 'col_kinds does not say what the full list says'
# a roofed slit a body fits into and a camera doesn't, closed, unless it's a designed opening. Read on the solids as the game sets them out, again after each round, because each is read from one side at a time
_all = [{'t': e[0], 'x': e[1], 'y': e[2], 'z0': e[3], 'z1': e[4], **({'r': e[5]} if e[0] == 'cyl' else {'hx': e[5], 'hy': e[6], 'yaw': e[7]})} for e in _b] + COLL[N_KIND:]
SLIT_PLUGS = []
for pass_ in range(5):
    p_ = check_traps.slit_plugs(_all, ground, OPENINGS)
    if not p_:
        break
    _all += p_
    COLL += p_
    SLIT_PLUGS += p_
print('plugs: gaps', len(GAP_PLUGS), 'slits', len(SLIT_PLUGS))

# W21: the Six Holds: each of the cities' seas one people, one animal, one depth, one temperament, read against the places
HOLDS = [
    {'id': 'thalor', 'poi': 'thalor', 'depth': 'mid', 'people': 'Empty; the Warden\'s lost order', 'emblem': 'turtle', 'travel': 'Dead current lanes that wake with each bell', 'far_tell': 'The Colossus'},
    {'id': 'meridon', 'poi': 'meridon', 'depth': 'upper', 'people': 'Proud tide-scholars', 'emblem': 'nautilus', 'travel': 'Lamp barges on current lines', 'far_tell': 'Gold domes and the Gilded Spire'},
    {'id': 'vesper', 'poi': 'vesper', 'depth': 'deep', 'people': 'Secretive lantern-keepers', 'emblem': 'anglerfish', 'travel': 'Cable cars down the cliff', 'far_tell': 'Cold cyan glow'},
    {'id': 'cindermere', 'poi': 'cindermere', 'depth': 'vents', 'people': 'Smiths who trade in oaths', 'emblem': 'ember_eel', 'travel': 'Heat chimneys', 'far_tell': 'The Cinder Cone, red glow, ash snow'},
    {'id': 'rimehold', 'poi': 'rimehold', 'depth': 'under ice', 'people': 'Hermits who keep the ice', 'emblem': 'narwhal', 'travel': 'Seal-drawn sledges', 'far_tell': 'The Rime Berg, light through the ice'},
    {'id': 'wrackreach', 'poi': 'wrackreach', 'depth': 'surface wrecks', 'people': 'Scavengers and lost sailors', 'emblem': 'moray', 'travel': 'Patched hulks', 'far_tell': 'The Stood Ship, ghost lanterns in fog'},
]

PACKS_T = {}
_pk = os.path.join(OUT, 'packs.json')
if os.path.exists(_pk):
    _plan = json.load(open(_pk))
    for k_, v_ in _plan['packs'].items():
        f_ = 'props_%s.glb' % k_
        if v_ and os.path.exists(os.path.join(ASSETS, f_)):
            PACKS_T[k_] = {'file': f_, 'bytes': os.path.getsize(os.path.join(ASSETS, f_)), 'kinds': v_}

WORLD = {
    'seed': SEED, 'size_m': SIZE, 'grid': GRID, 'depth_scale_m': DEPTH_SCALE, 'top_m': TOP_M, 'origin': [ORIGIN, ORIGIN],
    'biomes': ['reef', 'kelp', 'city', 'trench'],
    'spawn': {'x': SPAWN[0], 'y': SPAWN[1], 'z': -5.5, 'yaw': math.pi},
    'poi': [{'id': a, 'name': b, 'x': rnd(c), 'y': rnd(d), 'z': rnd(e), 'r': rnd(f)} for a, b, c, d, e, f in POI],
    'bells': [{k: (rnd(v) if isinstance(v, float) else v) for k, v in b.items()} for b in BELLS],
    'arena': {'x': AX, 'y': AY, 'z': -ARENA_D, 'r': 46.0, 'rx': RX, 'ry': RY, 'top': rnd(ARENA_TOP), 'floor_rx': rnd(FL_RX), 'floor_ry': rnd(FL_RY),
              'gate': {'x': GATE_POS[0], 'y': GATE_POS[1], 'z': rnd(GZ), 'yaw': 0.0, 'size': [round(v, 2) for v in gate_size]}},
    'pearls': [MOVED.get(tuple(p), p) for p in PEARLS], 'chests': CHESTS, 'encounters': ENC, 'whales': WHALES, 'schools': SCHOOLS, 'drifters': DRIFT, 'pods': PODS, 'sharks': SHARKS, 'land': LAND_PTS, 'decks': DECKS, 'rivers': RIVERS, 'waterfalls': FALLS, 'openings': OPENINGS, 'plumes': PLUMES, 'life': LIFE, 'holds': HOLDS,
    'files': {'height': 'height_z.bin', 'biome': 'biome_z.bin', 'biome2': 'biome2_z.bin', 'sand_n': 'tex/sand_n.webp', 'rock_n': 'tex/rock_n.webp'},
    'packs': PACKS_T,
    'lod': {'coral_fan': 24, 'coral_brain': 24, 'coral_branch': 24, 'coral_table': 24, 'coral_tube': 24, 'anemone': 24, 'glow_coral': 30, 'kelp_stalk': 40, 'seagrass': 18, 'rock_a': 60, 'rock_b': 60, 'rock_c': 60, 'beach_rock': 50, 'ice_floe': 60, 'smoker': 70, 'ice_ceiling': 110, 'ice_pillar': 110, 'wreck_hull': 110, 'wreck_bow': 110, 'wreck_stern': 110, 'column': 90, 'column_broken': 90, 'wall_bay': 90, 'wall_broken': 90, 'arch': 110, 'temple_front': 110, 'arena_bay': 110, 'bell_shrine': 90, 'dome_hall': 120, 'tower': 120, 'tower_cold': 120,
            'wall_windows': 90, 'wall_windows_cold': 90, 'palm_a': 70, 'palm_b': 70, 'tree_oak_a': 70, 'tree_oak_b': 70, 'cottage_a': 80, 'cottage_b': 80, 'rock_pillar': 90, 'cliff_rock': 120},
    'instances': {k: [v for row in rows for v in row] for k, rows in INST.items()},
    'colliders': COLL[N_KIND:], 'col_kinds': COL_KINDS,
    'notes': {
        'instances': 'x,y,z,yaw,scale,tint. z is the piece origin (its base). yaw: rotation about up, counter-clockwise from above: Blender rotation_z = three.js rotation.y. tint is 0..1, a free variation for the look builder; on glow_coral 0 = cyan, 1 = magenta.',
        'game_drawn': 'pearl, chest, bell and arena_gate are in the glb but not in instances: the game draws them from pearls, chests, bells and arena.gate, because they change.',
        'height': 'z = top_m - value / 65535 * (top_m + depth_scale_m). Sea level is z = 0, land is z > 0. On land the biome channels mean: reef = beach sand, kelp = green interior, city = pale bare rock, trench = black volcanic rock.',
        'col_kinds': 'each kind\'s solids in its own space, set out per instance by world.js; foot: reaches down to the ground on its low side. colliders holds only what no instance owns.',
        'openings': 'each way through a piece, as placed: x, y, z the middle, dx, dy half the way, sx, sy a side step onto solid.',
        'life': 'the second cast. kind, mode (cruise, drift, lurk, crawl, raft, soar, graze); either n, x, y, z, r for a roaming group, or pts [[x, y, z, yaw], ...] for each one where it stands.',
        'plumes': 'a column of smoke or steam that rises for ever: x, y, z at its foot, r wide at the foot, h tall.',
        'rivers': 'each: id, w (metres across), pts = the water surface [x, y, z] from source to mouth.',
        'waterfalls': 'each: id, x, y at the lip, z0 top, z1 bottom, w wide, yaw the way it faces.',
        'biome2': 'biome2.bin: same size as biome.bin, weights cinder, ice, wrack, none.',
        'decks': 'walkable timber over water: a box of half sizes hx, hy, turned by yaw, with its top at z. A walker stands on it; the sea is under it.',
        'bells': 'bell x,y,z is the mouth of the hanging bell (the bell mesh origin); bell_shrine stands in instances under it.',
        'gate': 'the shut gate is one collider in colliders with gate:true; world.setGateOpen(true) switches it off. arena_portal has its opening open underneath it.',
    },
}


# ---------------------------------------------------------------- write
def delta2(a, mask):
    """Second-order deltas, wrapped: along the row, then against the row below. Smooth ground comes out as small numbers that deflate well."""
    return np.diff(np.diff(a.astype(np.int64), axis=1, prepend=0), axis=0, prepend=0) & mask


def write_z(name, planes):
    import zlib
    with open(os.path.join(ASSETS, name), 'wb') as f:
        f.write(zlib.compress(b''.join(p.astype(np.uint8).tobytes() for p in planes), 9))


def write_all():
    h = np.round((D + TOP_M) / (TOP_M + DEPTH_SCALE) * 65535.0).clip(0, 65535).astype('<u2')
    h.tofile(os.path.join(ASSETS, 'height.bin'))
    biome.tofile(os.path.join(ASSETS, 'biome.bin'))
    biome2.tofile(os.path.join(ASSETS, 'biome2.bin'))
    # Q24: the host sends .bin as it is, so these are small by themselves: heights to 1.07 cm in two byte planes, each biome map in its first three channels (the fourth is what's left of 255)
    u = delta2(h >> 1, 0xffff)
    write_z('height_z.bin', [u & 255, u >> 8])
    write_z('biome_z.bin', [delta2(biome[:, :, c], 255) for c in range(3)])
    write_z('biome2_z.bin', [delta2(biome2[:, :, c], 255) for c in range(3)])
    with open(os.path.join(ASSETS, 'world.json'), 'w') as f:
        json.dump({k: v for k, v in WORLD.items() if k != 'notes'}, f, separators=(',', ':'))     # what is parsed stays in the heap: the notes are for the source, GAME.md has them


def preview_map():
    import cv2
    # hillshade
    img_h = np.clip(D / 240.0, 0, 1)
    light = np.array([-0.6, -0.5, 0.62])
    nx, ny, nz = -gx * 3.0, -gy * 3.0, np.ones_like(D)
    L = np.sqrt(nx * nx + ny * ny + nz * nz)
    shade = np.clip((nx * light[0] + ny * light[1] + nz * light[2]) / L, 0, 1)
    b = np.stack([b_reef, b_kelp, b_city, b_trench], axis=2)
    pal = np.array([[0.72, 0.68, 0.42], [0.32, 0.46, 0.22], [0.72, 0.72, 0.68], [0.12, 0.16, 0.3]])
    col = b @ pal
    col = lerp(col, np.array([0.84, 0.92, 0.96]), b2_i[..., None])
    col = lerp(col, np.array([0.36, 0.12, 0.08]), b2_c[..., None])
    col = lerp(col, np.array([0.3, 0.33, 0.36]), b2_w[..., None])
    fade = (1.0 - 0.72 * np.clip(D / 200.0, 0, 1))[..., None]
    rgb = col * fade * (0.45 + 0.75 * shade[..., None])
    im = (np.clip(rgb[::-1], 0, 1) * 255).astype(np.uint8)[..., ::-1].copy()       # y up, BGR
    S = 1
    im = cv2.resize(im, (GRID * S, GRID * S), interpolation=cv2.INTER_AREA)

    def px(x, y):
        return int((x - ORIGIN) / STEP * S), int((GRID - 1 - (y - ORIGIN) / STEP) * S)

    colours = {'kelp_stalk': (40, 170, 120), 'column': (235, 235, 235), 'column_broken': (190, 190, 200), 'column_fallen': (150, 150, 170), 'wall_bay': (210, 190, 170),
               'wall_broken': (160, 140, 130), 'lamp': (60, 200, 255), 'glow_coral': (240, 240, 60), 'seagrass': (70, 150, 90), 'rock_pillar': (120, 120, 120)}
    for name, rows in INST.items():
        c = colours.get(name)
        if name.startswith('coral') or name == 'anemone':
            c = (120, 120, 255)
        if c is None:
            c = (0, 255, 255)
        for r in rows:
            cv2.circle(im, px(r[0], r[1]), 1, c, -1, cv2.LINE_AA)
    for p in PEARLS:
        cv2.circle(im, px(p[0], p[1]), 3, (255, 255, 255), 1, cv2.LINE_AA)
    for c in CHESTS:
        cv2.rectangle(im, (px(c[0], c[1])[0] - 3, px(c[0], c[1])[1] - 3), (px(c[0], c[1])[0] + 3, px(c[0], c[1])[1] + 3), (0, 200, 255), -1)
    for e in ENC:
        cv2.circle(im, px(e['x'], e['y']), int(e['r'] / STEP * S), (60, 60, 255), 1, cv2.LINE_AA)
    for w in WHALES:
        pts = np.array([px(p[0], p[1]) for p in w['path']], np.int32)
        cv2.polylines(im, [pts], True, (255, 200, 120), 1, cv2.LINE_AA)
    for b0 in BELLS:
        cv2.circle(im, px(b0['x'], b0['y']), 6, (0, 255, 0), 2, cv2.LINE_AA)
    for p in POI:
        x, y = px(p[2], p[3])
        cv2.putText(im, p[1], (x + 5, y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 0, 0), 3, cv2.LINE_AA)
        cv2.putText(im, p[1], (x + 5, y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)
    sx, sy = px(*SPAWN)
    cv2.drawMarker(im, (sx, sy), (0, 255, 0), cv2.MARKER_TRIANGLE_UP, 14, 2)
    cv2.imwrite(os.path.join(PREVIEW, 'map.png'), im)


if __name__ == '__main__':
    write_all()
    preview_map()
    sizes = {f: os.path.getsize(os.path.join(ASSETS, f)) for f in ('world.json', 'height.bin', 'biome.bin', 'biome2.bin', 'height_z.bin', 'biome_z.bin', 'biome2_z.bin')}
    print('SIZES', sizes)
    print('Z top %.1f deepest %.1f' % (-D.min(), -D.max()))
    print('COUNTS', {k: len(v) for k, v in sorted(INST.items())})
    print('TOTAL instances', sum(len(v) for v in INST.values()), 'colliders', len(COLL), 'pearls', len(PEARLS), 'chests', len(CHESTS),
          'encounters', len(ENC), 'schools', len(SCHOOLS), 'drifters', len(DRIFT), 'whales', len(WHALES))
    print('SPAWN depth %.1f' % depth_at(*SPAWN), 'arch ground %.1f' % ground(*ARCH_P), 'plaza %.1f' % ground(*PLAZA), 'arena floor %.1f' % ground(AX, AY),
          'deep shrine %.1f' % ground(*SHRINE_DEEP), 'y', round(SHRINE_DEEP[1], 1), 'wreck %.1f' % ground(*WRECK), 'islet %.1f' % ground(*ISLET_P),
          'sunward top %.1f' % ground(*SUNWARD_HILL), 'rivers', [(r_['id'], len(r_['pts']), r_['pts'][0][2], r_['pts'][-1][2]) for r_ in RIVERS], 'falls', FALLS, 'crown top %.1f' % float((-D[np.hypot(X - CROWN[0], Y - CROWN[1]) < 200.0]).max()), 'meridon %.1f' % ground(*MERIDON), 'land', LAND_PTS)
