import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const native = process.argv.includes('--native');
const args = native ? ['--test', '--test-reporter=spec', ...(await readdir('tests')).filter(name => name.endsWith('.test.mjs')).map(name => `tests/${name}`)] : ['node_modules/vitest/vitest.mjs', 'run'];
const result = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error?.message ?? ''}`;
const escape = value => value.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
const title = `${native ? 'Node.js native tests' : 'Vitest assignment tests'} · ${result.status === 0 ? 'PASS' : 'FAIL'}`;
await mkdir('reports', { recursive: true });
await writeFile('reports/test-output.txt', output);
await writeFile('reports/test-report.html', `<!DOCTYPE html><html lang="en"><meta charset="utf-8"><title>${title}</title><style>body{font:15px/1.6 system-ui;background:#111b2a;color:#e4ecf8;margin:0;padding:36px}h1{font-size:27px}p{color:#a3b9cc}pre{font:13px/1.8 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#1c2a3e;padding:24px;border-radius:12px}</style><h1>${title}</h1><p>${escape(process.version)} · ${new Date().toISOString()} · Exit code ${result.status ?? 'unavailable'}</p><pre>${escape(output)}</pre></html>`);
console.log(output);
try {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent(await (await import('node:fs/promises')).readFile('reports/test-report.html', 'utf8'));
    await page.screenshot({ path: 'reports/tests.png', fullPage: true });
    console.log('Screenshot: reports/tests.png');
  } finally {
    await browser.close();
  }
} catch (error) {
  console.warn(`HTML and text reports saved; screenshot unavailable: ${error.message}`);
}
process.exitCode = result.status === 0 ? 0 : 1;
