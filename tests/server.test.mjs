import { after, before, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import querystring from 'node:querystring';
import { handleRequest, MAX_BODY_BYTES } from '../src/app.mjs';
import { validateForm, escapeHtml } from '../src/form.mjs';

const server = createServer(handleRequest);
before(async () => { server.listen(0, '127.0.0.1'); await once(server, 'listening'); });
after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
const send = (method, path, body = '', headers = {}, port = server.address().port) => new Promise((resolve, reject) => {
  const req = request({ host: '127.0.0.1', port, method, path, headers }, res => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    res.on('error', reject);
  });
  req.on('error', reject);
  if (Array.isArray(body)) {
    for (const chunk of body)
      req.write(chunk);
    req.end();
  } else {
    req.end(body);
  }
});
const form = { 'Content-Type': 'application/x-www-form-urlencoded' };
const checkHeaders = response => {
  assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(Number(response.headers['content-length']), Buffer.byteLength(response.body));
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.ok(response.headers['content-security-policy'].includes("frame-ancestors 'none'"));
};
for (const [path, title, description] of [['/', 'Home', 'Welcome to the Home Page'], ['/about', 'About', 'Learn more about us'], ['/contact', 'Contact', 'Get in touch']]) {
  test(`GET ${path}: required HTML and byte-exact headers`, async () => {
    const response = await send('GET', path);
    assert.equal(response.status, 200);
    for (const value of [`<title>${title}</title>`, `<h1>${title}</h1>`, `<p>${description}</p>`, '<!DOCTYPE html>'])
      assert.ok(response.body.includes(value));
    checkHeaders(response);
  });
}
test('GET ignores query parameters for routing', async () => assert.equal((await send('GET', '/about?ref=test')).status, 200));
for (const path of ['/missing', '/toString', '/__proto__', '/src/server.mjs']) {
  test(`GET ${path}: 404 without prototype or file exposure`, async () => {
    const response = await send('GET', path);
    assert.equal(response.status, 404);
    assert.ok(response.body.includes('Page Not Found'));
    checkHeaders(response);
  });
}
for (const method of ['PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
  test(`${method} /: 405 and Allow`, async () => {
    const response = await send(method, '/');
    assert.equal(response.status, 405);
    assert.equal(response.headers.allow, 'GET');
    assert.ok(response.body.includes('Method Not Allowed'));
    checkHeaders(response);
  });
}
test('HEAD is unsupported and contains no response body', async () => {
  const response = await send('HEAD', '/');
  assert.equal(response.status, 405);
  assert.equal(response.body, '');
  assert.ok(Number(response.headers['content-length']) > 0);
});
test('GET /submit is 405 with Allow POST', async () => {
  const response = await send('GET', '/submit');
  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, 'POST');
});
test('POST to a GET-only route is 405', async () => assert.equal((await send('POST', '/about', '', form)).status, 405));
test('POST unknown route is 404', async () => assert.equal((await send('POST', '/missing', 'test=data', form)).status, 404));
test('POST valid fields returns the required confirmation', async () => {
  const response = await send('POST', '/submit', 'name=Test+User&email=test%40example.com', form);
  assert.equal(response.status, 200);
  assert.ok(response.body.includes('<h1>Form Submitted</h1>'));
  assert.ok(response.body.includes('Name: Test User'));
  assert.ok(response.body.includes('Email: test@example.com'));
  checkHeaders(response);
});
test('POST trims whitespace and preserves Unicode', async () => {
  const response = await send('POST', '/submit', new URLSearchParams({ name: '  Олена 🌍  ', email: ' olena@example.com ' }).toString(), form);
  assert.equal(response.status, 200);
  assert.ok(response.body.includes('Name: Олена 🌍</p>'));
  checkHeaders(response);
});
test('POST escapes HTML rather than executing supplied markup', async () => {
  const response = await send('POST', '/submit', new URLSearchParams({ name: `<script>alert(1)</script> & "'`, email: 'safe@example.com' }).toString(), form);
  assert.equal(response.status, 200);
  assert.ok(!response.body.includes('<script>alert(1)</script>'));
  assert.ok(response.body.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;&#39;'));
});
for (const body of ['', 'name=&email=', 'name=+&email=a%40b.com', 'name=Alex', 'email=a%40b.com', 'name=Alex&email=invalid', 'name=Alex&email=a%40b', 'name=A&name=B&email=a%40b.com', 'name=A&email=a%40b.com&email=b%40b.com', `name=${'x'.repeat(101)}&email=a%40b.com`, `name=A&email=${'x'.repeat(250)}%40x.com`]) {
  test(`POST invalid form: ${body.slice(0, 44) || '(empty)'}`, async () => {
    const response = await send('POST', '/submit', body, form);
    assert.equal(response.status, 400);
    assert.ok(response.body.includes('Invalid form data'));
    checkHeaders(response);
  });
}
test('POST accepts MIME case variation and UTF-8 parameter', async () => assert.equal((await send('POST', '/submit', 'name=A&email=a%40b.com', { 'Content-Type': 'Application/X-WWW-Form-Urlencoded; charset=UTF-8' })).status, 200));
for (const headers of [{}, { 'Content-Type': 'application/json' }])
  test(`POST rejects missing/wrong Content-Type ${JSON.stringify(headers)}`, async () => assert.equal((await send('POST', '/submit', '{}', headers)).status, 400));
test('POST permits unrelated additional fields', async () => assert.equal((await send('POST', '/submit', 'name=A&email=a%40b.com&extra=value', form)).status, 200));
test('POST accepts a body split across several chunks', async () => {
  const body = Buffer.from('name=Олена&email=olena@example.com');
  const response = await send('POST', '/submit', [body.subarray(0, 6), body.subarray(6, 7), body.subarray(7)], form);
  assert.equal(response.status, 200);
  assert.ok(response.body.includes('Олена'));
});
test('POST over declared size limit returns 413', async () => {
  const body = 'x'.repeat(MAX_BODY_BYTES + 1);
  const response = await send('POST', '/submit', body, { ...form, 'Content-Length': Buffer.byteLength(body) });
  assert.equal(response.status, 413);
  checkHeaders(response);
});
test('POST chunked body over size limit returns 413', async () => {
  const response = await send('POST', '/submit', ['x'.repeat(MAX_BODY_BYTES), 'x'], form);
  assert.equal(response.status, 413);
  checkHeaders(response);
});
test('A body exactly at the size limit is accepted', async () => {
  const body = 'name=A&email=a%40b.com&padding=';
  assert.equal((await send('POST', '/submit', body + 'x'.repeat(MAX_BODY_BYTES - body.length), form)).status, 200);
});
test('Unexpected querystring failure produces 500, not a stack trace', async () => {
  const stub = mock.method(querystring, 'parse', () => { throw new Error('private-internal-error'); });
  try {
    const response = await send('POST', '/submit', 'name=A&email=a%40b.com', form);
    assert.equal(response.status, 500);
    assert.ok(response.body.includes('Server Error'));
    assert.ok(!response.body.includes('private-internal-error'));
    checkHeaders(response);
  } finally {
    stub.mock.restore();
  }
});
test('A disconnected client does not crash the server', async () => {
  const socket = connect(server.address().port, '127.0.0.1');
  await once(socket, 'connect');
  socket.write('POST /submit HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: 100\r\n\r\nname=partial');
  socket.destroy();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal((await send('GET', '/')).status, 200);
});
test('Twenty simultaneous requests complete independently', async () => {
  const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => send('POST', '/submit', `name=User${i}&email=user${i}%40example.com`, form)));
  responses.forEach((response, i) => { assert.equal(response.status, 200); assert.ok(response.body.includes(`Name: User${i}</p>`)); });
});
test('HTML escaping covers all five significant characters', () => assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;'));
test('Form validation rejects array fields', () => assert.equal(validateForm({ name: ['A'], email: 'a@b.com' }), null));
test('The exported server starts on PORT and responds on import', async () => {
  const child = spawn(process.execPath, ['src/server.mjs'], { env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const [output] = await once(child.stdout, 'data');
    const port = Number(output.toString().match(/localhost:(\d+)/)[1]);
    assert.equal((await send('GET', '/', '', {}, port)).status, 200);
  } finally {
    child.kill('SIGTERM');
    await once(child, 'exit');
  }
});
test('Invalid PORT fails clearly rather than silently falling back', () => {
  const result = spawnSync(process.execPath, ['src/server.mjs'], { env: { ...process.env, PORT: 'invalid' }, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes('PORT must be an integer'));
});

test('Repeated fields after the 1000th key are also rejected', async () => {
  const body = `name=A&email=a%40b.com&${'x=1&'.repeat(1001)}name=B`;
  assert.equal((await send('POST', '/submit', body, form)).status, 400);
});
test('An invalid absolute request URL returns 400', async () => assert.equal((await send('GET', 'http://[')).status, 400));
