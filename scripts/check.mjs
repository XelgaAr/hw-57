import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

let checked = 0;
const visit = async directory => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', 'coverage', 'reports'].includes(entry.name))
      continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
    } else if (/\.(?:m?js|json)$/.test(entry.name)) {
      if (entry.name.endsWith('.json')) {
        JSON.parse(await readFile(path, 'utf8'));
      } else {
        const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
        if (result.status !== 0)
          throw new Error(result.stderr || result.error?.message || `Cannot parse ${path}`);
      }
      checked++;
    }
  }
};
await visit(process.cwd());
console.log(`Syntax and JSON checks: ${checked} files OK`);
