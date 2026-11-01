// Inflate, for the few phones without DecompressionStream (iOS before 16.4). world.js imports this only on those phones, so nobody else downloads it.
// inflate(zlibBytes, outLength): a zlib stream to its bytes (RFC 1950 and 1951). The trailing checksum isn't read: the file came over HTTPS.

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

// A canonical Huffman code: how many codes of each length, and the symbols in code order.
function huffman(lengths) {
  const count = new Uint16Array(16), offset = new Uint16Array(16), symbol = new Uint16Array(lengths.length);
  for (let i = 0; i < lengths.length; i++) count[lengths[i]]++;
  count[0] = 0;
  for (let i = 1; i < 15; i++) offset[i + 1] = offset[i] + count[i];
  for (let i = 0; i < lengths.length; i++) if (lengths[i]) symbol[offset[lengths[i]]++] = i;
  return { count, symbol };
}

let fixedLit = null, fixedDist = null;
function fixedCodes() {
  if (fixedLit) return;
  const l = new Uint8Array(288);
  l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
  fixedLit = huffman(l); fixedDist = huffman(new Uint8Array(30).fill(5));
}

export function inflate(src, outLength) {
  const out = new Uint8Array(outLength);
  let p = 2, bitBuf = 0, bitCount = 0, o = 0;                      // past the two bytes of the zlib header
  const bits = (n) => {
    while (bitCount < n) { bitBuf |= src[p++] << bitCount; bitCount += 8; }
    const v = bitBuf & ((1 << n) - 1); bitBuf >>>= n; bitCount -= n;
    return v;
  };
  const decode = (h) => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len <= 15; len++) {
      code |= bits(1);
      const c = h.count[len];
      if (code - c < first) return h.symbol[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error('inflate: bad code');
  };
  const codes = (lit, dist) => {
    for (;;) {
      const s = decode(lit);
      if (s < 256) { out[o++] = s; continue; }
      if (s === 256) return;
      const len = LEN_BASE[s - 257] + bits(LEN_EXTRA[s - 257]), d = decode(dist), back = DIST_BASE[d] + bits(DIST_EXTRA[d]);
      for (let i = 0; i < len; i++, o++) out[o] = out[o - back];
    }
  };
  for (let last = 0; !last;) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {                                              // stored: byte aligned, with its length and the length's complement
      bitBuf = 0; bitCount = 0;
      const len = src[p] | src[p + 1] << 8; p += 4;
      out.set(src.subarray(p, p + len), o); o += len; p += len;
    } else if (type === 1) {
      fixedCodes(); codes(fixedLit, fixedDist);
    } else if (type === 2) {
      const nLen = bits(5) + 257, nDist = bits(5) + 1, nCode = bits(4) + 4, lengths = new Uint8Array(320);
      for (let i = 0; i < nCode; i++) lengths[ORDER[i]] = bits(3);
      const lenCode = huffman(lengths.subarray(0, 19)), all = new Uint8Array(320);
      for (let i = 0; i < nLen + nDist;) {
        const s = decode(lenCode);
        if (s < 16) { all[i++] = s; continue; }
        let prev = 0, rep;
        if (s === 16) { prev = all[i - 1]; rep = 3 + bits(2); } else if (s === 17) rep = 3 + bits(3); else rep = 11 + bits(7);
        while (rep--) all[i++] = prev;
      }
      codes(huffman(all.subarray(0, nLen)), huffman(all.subarray(nLen, nLen + nDist)));
    } else throw new Error('inflate: bad block');
  }
  return out;
}
