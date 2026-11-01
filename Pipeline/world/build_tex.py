# Drowned City: the tiling textures, painted by code, seeded. caustics.png is real: sunlight refracted through a periodic wave surface onto the floor and
# counted, so its web has true folds. sand_n.png and rock_n.png are tangent-space normals from periodic height fields. numpy + OpenCV.
import os
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.abspath(os.path.join(HERE, '..', '..', 'web', 'assets', 'tex'))
os.makedirs(TEX, exist_ok=True)
rs = np.random.RandomState(1931)


def spectrum(n, fn):
    """A periodic random field shaped in frequency space by fn(fx, fy) -> amplitude."""
    f = np.fft.fftfreq(n) * n
    fx, fy = np.meshgrid(f, f, indexing='ij')
    a = fn(fx, fy)
    ph = rs.uniform(0, 2 * np.pi, (n, n))
    F = a * np.exp(1j * ph)
    F[0, 0] = 0
    h = np.fft.ifft2(F).real
    return h / h.std(), np.fft.fft2(h / h.std()), fx, fy


def caustics(out=512, rays=2048):
    def amp(fx, fy):
        r = np.hypot(fx, fy)
        return (r > 1.5) * (r < 26.0) * np.exp(-(r / 11.0) ** 2) * np.maximum(r, 1.0) ** -0.15

    h, F, fx, fy = spectrum(rays, amp)
    gx = np.fft.ifft2(1j * 2 * np.pi * fx * F).real / rays
    gy = np.fft.ifft2(1j * 2 * np.pi * fy * F).real / rays
    gxx = np.fft.ifft2(-(2 * np.pi * fx) ** 2 * F).real / rays ** 2
    # the depth at which the sharpest crests first focus, then a little past it, where the web closes
    D = 1.55 / np.percentile(np.abs(gxx), 99.0)
    idx = np.arange(rays)
    px = (idx[:, None] + D * gx) * (out / rays) % out
    py = (idx[None, :] + D * gy) * (out / rays) % out
    a = np.zeros((out, out), np.float64)
    xi, yi = px.astype(int) % out, py.astype(int) % out
    fxr, fyr = px - np.floor(px), py - np.floor(py)
    np.add.at(a, (xi, yi), (1 - fxr) * (1 - fyr))
    np.add.at(a, ((xi + 1) % out, yi), fxr * (1 - fyr))
    np.add.at(a, (xi, (yi + 1) % out), (1 - fxr) * fyr)
    np.add.at(a, ((xi + 1) % out, (yi + 1) % out), fxr * fyr)
    a = a / a.mean()
    # soft blur, wrapping, as the sun's disc does
    w = np.pad(a, 16, mode='wrap')
    w = cv2.GaussianBlur(w, (0, 0), 0.8)[16:-16, 16:-16]
    v = np.clip(w / np.percentile(w, 99.7), 0, 1) ** 0.72
    return (v * 255).astype(np.uint8)


def normals(h, strength):
    dx = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    dy = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    nz = np.ones_like(h)
    L = np.sqrt(dx * dx + dy * dy + nz * nz)
    n = np.stack([-dx / L, -dy / L, nz / L], 2)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def sand(n=384):
    def ripple(fx, fy):
        return np.exp(-((fy - 15.0) / 3.6) ** 2 - (fx / 4.6) ** 2) + np.exp(-((fy + 15.0) / 3.6) ** 2 - (fx / 4.6) ** 2)

    r, _, _, _ = spectrum(n, ripple)
    big, _, _, _ = spectrum(n, lambda fx, fy: (np.hypot(fx, fy) < 7.0) * 1.0)
    grain, _, _, _ = spectrum(n, lambda fx, fy: (np.hypot(fx, fy) > 40.0) * 1.0)
    mid, _, _, _ = spectrum(n, lambda fx, fy: np.exp(-((np.hypot(fx, fy) - 22.0) / 10.0) ** 2))
    h = 1.0 * r * (0.7 + 0.3 * big) + 0.28 * mid + 0.1 * grain
    return normals(h, 0.9)


def rock(n=384):
    out = np.zeros((n, n))
    amp, f0 = 1.0, 4.0
    for o in range(5):
        fl = f0
        a, _, _, _ = spectrum(n, lambda fx, fy: np.exp(-((np.hypot(fx, fy) - fl) / (fl * 0.5)) ** 2))
        out += amp * (1.0 - np.abs(a)) ** 2
        amp *= 0.55
        f0 *= 2.1
    strata, _, _, _ = spectrum(n, lambda fx, fy: np.exp(-(fx / 2.0) ** 2) * np.exp(-((np.abs(fy) - 18.0) / 7.0) ** 2))
    return normals(out + 0.35 * strata, 2.4)


cv2.imwrite(os.path.join(TEX, 'caustics.png'), caustics())
cv2.imwrite(os.path.join(TEX, 'sand_n.png'), sand()[..., ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 9])
cv2.imwrite(os.path.join(TEX, 'rock_n.png'), rock()[..., ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 9])
for f in ('caustics.png', 'sand_n.png', 'rock_n.png'):
    print(f, os.path.getsize(os.path.join(TEX, f)))
