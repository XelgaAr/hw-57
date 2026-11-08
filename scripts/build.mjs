import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { pages, renderPage } from '../src/pages.mjs';

const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(new URL('assets/', dist), { recursive: true });
for (const [path, page] of Object.entries(pages))
  await writeFile(new URL(path === '/' ? 'index.html' : `${path.slice(1)}.html`, dist), renderPage(...page, true));
await writeFile(new URL('404.html', dist), renderPage('Page Not Found', 'HTTP 404', '', true));
await cp(new URL('../web/demo.mjs', import.meta.url), new URL('assets/demo.mjs', dist));
await cp(new URL('../src/form.mjs', import.meta.url), new URL('assets/form.mjs', dist));
await writeFile(new URL('.nojekyll', dist), '');
console.log('Static demonstration built in dist/');
