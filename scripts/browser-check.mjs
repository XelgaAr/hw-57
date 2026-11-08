import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const build = spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
assert.equal(build.status, 0);
await mkdir('reports', { recursive: true });
const children = [];
const results = [];
const start = async (script, args = [], env = {}) => {
  const child = spawn(process.execPath, [script, ...args], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Server startup timeout: ${output}`)), 10000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
    child.stderr.on('data', data => { output += data; });
    child.stdout.on('data', data => {
      output += data;
      const url = output.match(/http:\/\/(?:localhost|127\.0\.0\.1):\d+[^\s]*/)?.[0];
      if (url) {
        clearTimeout(timer);
        resolve(url.endsWith('/') ? url : `${url}/`);
      }
    });
  });
};
const check = async (name, run) => {
  await run();
  results.push({ name, status: 'passed' });
  console.log(`PASS ${name}`);
};
let browser;
let completed = false;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const live = await start('src/server.mjs', [], { PORT: '0', HOST: '127.0.0.1' });
  await check('Live server: Home, About and Contact navigation', async () => {
    await page.goto(live);
    assert.equal(await page.title(), 'Home');
    await page.getByRole('navigation').getByRole('link', { name: 'About', exact: true }).click();
    assert.equal(await page.title(), 'About');
    await page.getByRole('navigation').getByRole('link', { name: 'Contact', exact: true }).click();
    assert.equal(await page.title(), 'Contact');
    await page.screenshot({ path: 'reports/server-desktop.png', fullPage: true });
  });
  await check('Live form sends a real POST and renders the receipt', async () => {
    await page.getByLabel('Имя', { exact: true }).fill('Олена <script>alert(1)</script>');
    await page.getByLabel('Электронная почта').fill('olena@example.com');
    const response = page.waitForResponse(res => res.url() === `${live}submit` && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Отправить форму' }).click();
    assert.equal((await response).status(), 200);
    await page.waitForURL(`${live}submit`);
    assert.equal(await page.title(), 'Form Submitted');
    assert.ok((await page.locator('main').textContent()).includes('Name: Олена <script>alert(1)</script>'));
    assert.equal(await page.locator('script').count(), 0);
  });
  await check('Live server returns 404 with the expected page', async () => {
    const response = await page.goto(`${live}missing`);
    assert.equal(response.status(), 404);
    assert.equal(await page.title(), 'Page Not Found');
  });
  await check('Live server works at mobile width without horizontal overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(live);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: 'reports/server-mobile.png', fullPage: true });
  });
  const site = await start('scripts/preview.mjs', ['--port', '0', '--base', '/repository-check/']);
  await check('Static demo works below an arbitrary repository path', async () => {
    await page.goto(site);
    assert.equal(await page.title(), 'Home');
    assert.ok((await page.locator('.mode').textContent()).includes('Статическая демонстрация'));
    await page.getByRole('navigation').getByRole('link', { name: 'About', exact: true }).click();
    assert.equal(page.url(), `${site}about.html`);
    await page.getByRole('navigation').getByRole('link', { name: 'Contact', exact: true }).click();
    assert.equal(page.url(), `${site}contact.html`);
    await page.reload();
    assert.equal(await page.title(), 'Contact');
  });
  await check('Static form validates locally and never sends a POST', async () => {
    const posts = [];
    page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
    await page.getByLabel('Имя', { exact: true }).fill('Static user');
    await page.getByLabel('Электронная почта').fill('static@example.com');
    await page.getByRole('button', { name: 'Отправить форму' }).click();
    await page.locator('#form-result').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#form-result').textContent()).includes('Form Submitted'));
    assert.deepEqual(posts, []);
  });
  await check('Static form rejects whitespace-only names', async () => {
    await page.getByLabel('Имя', { exact: true }).fill('   ');
    await page.getByRole('button', { name: 'Отправить форму' }).click();
    assert.ok((await page.locator('#form-result').textContent()).includes('Invalid form data'));
  });
  await check('Static demo has no horizontal overflow on mobile and desktop', async () => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(site);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.screenshot({ path: 'reports/pages-desktop.png', fullPage: true });
  });
  assert.deepEqual(errors, []);
  completed = true;
  console.log(`${results.length} browser scenarios passed; no uncaught JavaScript errors.`);
} finally {
  await writeFile('reports/browser-results.json', JSON.stringify({ runtime: process.version, completed, scenarios: results }, null, 2));
  await browser?.close();
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
  }
}
