# hero_phone.glb, reaver_phone.glb: the same body with its textures at half size, for the phone tier. Geometry, skin and clips are the same bytes; only the images change.
#   python3 phone_glb.py <hero.glb> <hero_phone.glb> [scale=2]        macOS `sips` does the resampling (no installs)
import json, os, struct, subprocess, sys, tempfile

def read(path):
    f = open(path, 'rb').read(); l, _ = struct.unpack('<II', f[12:20]); J = json.loads(f[20:20 + l]); o = 20 + l
    n, _ = struct.unpack('<II', f[o:o + 8]); return J, bytearray(f[o + 8:o + 8 + n])

def shrink(data, name, scale, qual):
    d = tempfile.mkdtemp(); a = os.path.join(d, name + '.jpg'); b = os.path.join(d, name + '_s.jpg'); open(a, 'wb').write(data)
    q = subprocess.run(['sips', '-g', 'pixelHeight', '-g', 'pixelWidth', a], capture_output=True, text=True).stdout
    h = int(q.split('pixelHeight:')[1].split()[0]); w = int(q.split('pixelWidth:')[1].split()[0])
    subprocess.run(['sips', '-z', str(h // scale), str(w // scale), '-s', 'format', 'jpeg', '-s', 'formatOptions', str(qual), a, '--out', b], capture_output=True, check=True)
    out = open(b, 'rb').read(); print(name, (w, h), '→', (w // scale, h // scale), len(data), '→', len(out)); return out

def main(src, dst, scale=2):
    J, B = read(src); views = J['bufferViews']; repl = {}
    for im in J['images']: repl[im['bufferView']] = shrink(bytes(B[views[im['bufferView']].get('byteOffset', 0):views[im['bufferView']].get('byteOffset', 0) + views[im['bufferView']]['byteLength']]), im['name'], scale, 62)
    out = bytearray(); pad = lambda: out.extend(b'\0' * (-len(out) % 4))
    for i, v in enumerate(views):
        ext = (v.get('extensions') or {}).get('EXT_meshopt_compression')
        if ext:
            data = B[ext.get('byteOffset', 0):ext.get('byteOffset', 0) + ext['byteLength']]; pad(); ext['byteOffset'] = len(out); out.extend(data)
        elif i in repl:
            pad(); v['byteOffset'] = len(out); v['byteLength'] = len(repl[i]); out.extend(repl[i])
        elif v.get('buffer', 0) == 0:
            data = B[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]; pad(); v['byteOffset'] = len(out); out.extend(data)
    pad(); J['buffers'][0]['byteLength'] = len(out)
    js = json.dumps(J, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(dst + '.tmp', 'wb') as f: f.write(struct.pack('<III', 0x46546C67, 2, total)); f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js); f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)
    os.replace(dst + '.tmp', dst); print(os.path.basename(dst), total)

if __name__ == '__main__': main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 2)
