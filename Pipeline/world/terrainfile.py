# Drowned City: the terrain files read back, from the raw .bin if it is there, else from the small _z.bin the game loads. Numpy only.
import os
import zlib

import numpy as np


def undelta(u, mask):
    """Second-order wrapped deltas back to values: against the row below, then along the row."""
    d = np.cumsum(u.astype(np.int64), axis=0) & mask
    return np.cumsum(d, axis=1) & mask


def planes(path, n, k):
    return np.frombuffer(zlib.decompress(open(path, 'rb').read()), dtype=np.uint8).reshape(k, n, n)


def height(A, G):
    raw = os.path.join(A, 'height.bin')
    if os.path.exists(raw):
        return np.fromfile(raw, dtype='<u2').reshape(G, G)
    p = planes(os.path.join(A, 'height_z.bin'), G, 2)
    return (undelta(p[0].astype(np.int64) | (p[1].astype(np.int64) << 8), 0xffff) * 2).astype('<u2')


def biome(A, name, n):
    raw = os.path.join(A, name + '.bin')
    if os.path.exists(raw):
        return np.fromfile(raw, dtype=np.uint8).reshape(n, n, 4)
    p = planes(os.path.join(A, name + '_z.bin'), n, 3)
    rgb = [undelta(p[c], 255) for c in range(3)]
    return np.stack(rgb + [255 - rgb[0] - rgb[1] - rgb[2]], axis=2).astype(np.uint8)
