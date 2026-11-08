import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';

let child;
let base;
before(async () => {
  const build = spawnSync(process.execPath, ['scripts/build.mjs'], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  child = spawn(process.execPath, ['scripts/preview.mjs', '--port', '0', '--base', '/repository-check/'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const [output] = await once(child.stdout, 'data');
  base = output.toString().match(/http:\/\/[^\s]+/)[0];
});
after(async () => {
  if (child?.exitCode === null) {
    child.kill('SIGTERM');
    await once(child, 'exit');
  }
});
for (const file of ['index.html', 'about.html', 'contact.html', 'assets/demo.mjs', 'assets/form.mjs']) {
  test(`Built asset is served below repository path: ${file}`, async () => {
    const response = await fetch(base + file);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const body = await response.arrayBuffer();
    assert.equal(Number(response.headers.get('content-length')), body.byteLength);
    assert.ok(body.byteLength > 0);
  });
}
test('Repository root serves the index document', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.ok((await response.text()).startsWith('<!DOCTYPE html>'));
});
test('Missing static asset has status 404', async () => assert.equal((await fetch(`${base}not-found.js`)).status, 404));
test('Static preview refuses POST', async () => assert.equal((await fetch(base, { method: 'POST', body: 'data' })).status, 405));
test('Requests outside repository path cannot expose project files', async () => assert.equal((await fetch(new URL('/package.json', base))).status, 404));
test('Static preview supports HEAD without response body', async () => {
  const response = await fetch(base, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.ok(Number(response.headers.get('content-length')) > 0);
  assert.equal(await response.text(), '');
});
