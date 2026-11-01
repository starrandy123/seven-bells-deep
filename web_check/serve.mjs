// A small static server for a frozen copy, on its own port (no dependencies): node serve.mjs <dir> <port>
// It serves the files as they are, no cache, no compression: what the checks read is what is in the folder. The size a host would send
// gzipped is counted by the check itself (load.mjs).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const [dir = '../web', port = '8800'] = process.argv.slice(2); const root = path.resolve(dir);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2', '.svg': 'image/svg+xml', '.css': 'text/css', '.md': 'text/markdown', '.txt': 'text/plain', '.wasm': 'application/wasm' };
http.createServer((req, res) => {
  let u; try { u = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  const f = path.join(root, u.endsWith('/') ? u + 'index.html' : u);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}).listen(+port, '127.0.0.1', () => console.log('serving ' + root + ' on http://127.0.0.1:' + port + '/'));
