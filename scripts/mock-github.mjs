// A tiny stand-in for GitHub's contents API, used only to test the admin without a real repository.
// node scripts/mock-github.mjs <repoDir> [port]    serves <repoDir>/docs at / and the API at /api
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const repoDir = path.resolve(process.argv[2] || 'mockrepo');
const port = Number(process.argv[3] || 4000);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const sha = (buf) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(body)); };
const log = [];

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const m = /^\/api\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/.exec(url.pathname);
  if (url.pathname === '/__log') return json(res, 200, log);
  if (m) {
    const auth = req.headers.authorization || '';
    if (auth !== 'Bearer test-token' && auth !== 'Bearer readonly-token') return json(res, 401, { message: 'Bad credentials' });
    const rel = decodeURIComponent(m[3]); const file = path.join(repoDir, rel);
    if (!file.startsWith(repoDir)) return json(res, 400, {});
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    const exists = fs.existsSync(file);
    if (req.method === 'GET') {
      if (!exists) return json(res, 404, { message: 'Not Found' });
      const buf = fs.readFileSync(file);
      return json(res, 200, { name: path.basename(file), path: rel, sha: sha(buf), content: buf.toString('base64'), encoding: 'base64' });
    }
    if (auth === 'Bearer readonly-token') return json(res, 403, { message: 'Resource not accessible by personal access token' });
    if (req.method === 'PUT') {
      if (exists) { if (!body.sha) return json(res, 422, { message: 'sha wasn\'t supplied' }); if (body.sha !== sha(fs.readFileSync(file))) return json(res, 409, { message: 'does not match' }); }
      const buf = Buffer.from(body.content, 'base64'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf);
      log.push(`PUT ${rel} (${buf.length} bytes) "${body.message}"`);
      return json(res, exists ? 200 : 201, { content: { path: rel, sha: sha(buf) } });
    }
    if (req.method === 'DELETE') {
      if (!exists) return json(res, 404, {}); if (body.sha !== sha(fs.readFileSync(file))) return json(res, 409, {});
      fs.unlinkSync(file); log.push(`DELETE ${rel} "${body.message}"`); return json(res, 200, { commit: {} });
    }
  }
  // static site = <repoDir>/docs
  const p = decodeURIComponent(url.pathname); const f = path.join(repoDir, 'docs', p === '/' ? 'index.html' : p);
  if (!f.startsWith(path.join(repoDir, 'docs')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`Mock GitHub + site on http://localhost:${port}`));
