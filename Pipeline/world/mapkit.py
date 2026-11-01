# Drowned City: the small maths the map and the props share (numpy only, no Blender): seeded Perlin noise, fbm, smooth steps.
import numpy as np


def sstep(e0, e1, x):
    """smoothstep; e0 may be above e1 (a falling edge)."""
    t = np.clip((np.asarray(x, dtype=np.float64) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def lerp(a, b, t):
    return a + (b - a) * t


class Perlin:
    """2D gradient noise, vectorised; the same seed gives the same field."""

    def __init__(self, seed):
        r = np.random.RandomState(seed)
        p = r.permutation(256)
        self.p = np.concatenate([p, p, p])
        a = r.rand(256) * 2.0 * np.pi
        self.g = np.stack([np.cos(a), np.sin(a)], axis=1)

    def __call__(self, x, y):
        x = np.asarray(x, dtype=np.float64)
        y = np.asarray(y, dtype=np.float64)
        xi = np.floor(x).astype(np.int64)
        yi = np.floor(y).astype(np.int64)
        xf = x - xi
        yf = y - yi
        xi &= 255
        yi &= 255
        p, g = self.p, self.g

        def dot(ix, iy, dx, dy):
            v = g[p[p[ix & 255] + (iy & 255)]]
            return v[..., 0] * dx + v[..., 1] * dy

        u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
        v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
        n00 = dot(xi, yi, xf, yf)
        n10 = dot(xi + 1, yi, xf - 1, yf)
        n01 = dot(xi, yi + 1, xf, yf - 1)
        n11 = dot(xi + 1, yi + 1, xf - 1, yf - 1)
        return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 1.42


def fbm(noise, x, y, freq, octaves=4, gain=0.5, lac=2.03, shift=0.0):
    """Fractal noise, about -1..1."""
    out = 0.0
    amp = 1.0
    tot = 0.0
    f = freq
    for i in range(octaves):
        out = out + amp * noise(x * f + shift + i * 17.3, y * f - shift + i * 9.1)
        tot += amp
        amp *= gain
        f *= lac
    return out / tot


def ridged(noise, x, y, freq, octaves=4, gain=0.5, lac=2.03, shift=0.0):
    """Ridged fractal noise, about 0..1, sharp crests at 1."""
    out = 0.0
    amp = 1.0
    tot = 0.0
    f = freq
    for i in range(octaves):
        n = 1.0 - np.abs(noise(x * f + shift + i * 7.7, y * f - shift + i * 3.3))
        out = out + amp * n * n
        tot += amp
        amp *= gain
        f *= lac
    return out / tot
