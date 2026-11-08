import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const args = process.argv.slice(2);
const port = Number(args.includes('--port') ? args[args.indexOf('--port') + 1] : 4173);
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : '/';
if (!Number.isInteger(port) || port < 0 || port > 65535 || !/^\/(?:[\w-]+\/)*$/.test(base))
  throw new Error('Use --port 0..65535 and --base /repository-name/');
const root = new URL('../dist/', import.meta.url);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  let status = 200;
  let body;
  let type = 'text/plain';
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = path.slice(base.length);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end('Method Not Allowed');
    }
    if (!path.startsWith(base) || relative.split('/').includes('..') || /[\\\0]/.test(relative))
      throw Object.assign(new Error(), { code: 'ENOENT' });
    const file = new URL(relative || 'index.html', root);
    if (!file.href.startsWith(root.href))
      throw Object.assign(new Error(), { code: 'ENOENT' });
    body = await readFile(file);
    type = mime[extname(file.pathname)] ?? 'application/octet-stream';
  } catch (error) {
    status = ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code) ? 404 : error instanceof URIError ? 400 : 500;
    body = Buffer.from(status === 404 ? 'Page Not Found' : status === 400 ? 'Bad Request' : 'Server Error');
  }
  res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Content-Length': body.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
  res.end(req.method === 'HEAD' ? undefined : body);
});
await new Promise((resolve, reject) => server.once('error', reject).listen(port, '127.0.0.1', resolve));
console.log(`Preview: http://127.0.0.1:${server.address().port}${base}`);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => { server.close(); server.closeAllConnections(); });
