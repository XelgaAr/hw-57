import { URL } from 'node:url';
import querystring from 'node:querystring';
import { renderPage, pages } from './pages.mjs';
import { escapeHtml, validateForm } from './form.mjs';

export const MAX_BODY_BYTES = 16 * 1024;

export const handleRequest = (req, res) => {
  const send = (status, title, description, content = '', headers = {}) => {
    if (res.writableEnded || res.destroyed)
      return;
    const html = renderPage(title, description, content);
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
      ...headers
    });
    res.end(html);
  };
  const fail = status => {
    const title = { 400: 'Invalid form data', 404: 'Page Not Found', 405: 'Method Not Allowed', 413: 'Payload Too Large', 500: 'Server Error' }[status];
    send(status, title, `HTTP ${status}`, '', status === 413 ? { Connection: 'close' } : {});
  };
  req.on('error', () => fail(400));
  try {
    const url = URL.parse(req.url, 'http://localhost');
    if (!url) {
      req.resume();
      return fail(400);
    }
    const page = Object.hasOwn(pages, url.pathname) ? pages[url.pathname] : null;
    const allowed = url.pathname === '/submit' ? 'POST' : page ? 'GET' : 'GET, POST';
    if (!['GET', 'POST'].includes(req.method)) {
      req.resume();
      return send(405, 'Method Not Allowed', 'HTTP 405', '', { Allow: allowed });
    }
    if (!page && url.pathname !== '/submit') {
      req.resume();
      return fail(404);
    }
    if (req.method === 'GET' && page)
      return send(200, ...page);
    if (req.method !== 'POST' || url.pathname !== '/submit') {
      req.resume();
      return send(405, 'Method Not Allowed', 'HTTP 405', '', { Allow: allowed });
    }
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
      req.resume();
      return fail(400);
    }
    if (Number(req.headers['content-length']) > MAX_BODY_BYTES) {
      req.resume();
      return fail(413);
    }
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      if (res.writableEnded)
        return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0;
        return fail(413);
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (res.writableEnded)
        return;
      try {
        const data = validateForm(querystring.parse(Buffer.concat(chunks, size).toString('utf8'), undefined, undefined, { maxKeys: 0 }));
        if (!data)
          return fail(400);
        send(200, 'Form Submitted', 'Your request has been received.', `<section class="panel receipt"><span class="eyebrow">SUBMISSION RECEIPT</span><p>Name: ${escapeHtml(data.name)}</p><p>Email: ${escapeHtml(data.email)}</p><p class="muted">Данные обработаны в памяти и не сохраняются на сервере.</p><a class="button" href="/contact">Новая отправка →</a></section>`);
      } catch {
        fail(500);
      }
    });
  } catch {
    fail(500);
  }
};
