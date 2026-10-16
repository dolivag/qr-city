// Publica los paquetes que aún no están en npm. Angular se publica desde packages/angular/dist
// (lo que genera ng-packagr), el resto desde su carpeta. Uso: node scripts/publish.mjs [--dry-run]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const dryRun = process.argv.includes('--dry-run');
// El orden importa: core primero, porque los demás dependen de él.
const targets = [
  'packages/core',
  'packages/element',
  'packages/react',
  'packages/vue',
  'packages/angular/dist',
];

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

for (const dir of targets) {
  const { name, version } = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
  let published = false;
  try {
    execFileSync('npm', ['view', `${name}@${version}`, 'version'], { stdio: 'pipe' });
    published = true;
  } catch {
    // 404: aún no existe esa versión
  }
  if (published) {
    console.log(`= ${name}@${version} ya está publicado`);
    continue;
  }
  console.log(`+ publicando ${name}@${version}`);
  run('npm', ['publish', '--access', 'public', '--provenance', ...(dryRun ? ['--dry-run'] : [])], dir);
  if (!dryRun) run('git', ['tag', `${name}@${version}`]);
}
