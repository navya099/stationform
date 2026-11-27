import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packager } from '@electron/packager';
import { build } from 'esbuild';
import { civilCraftModules } from '../src/civilcraft.mjs';

const civilRevision = 'a83c0c1011ef1c0d4bb9f2e9c39bc18a4cf016f7';
const repo = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(await readFile(join(repo, 'package.json'), 'utf8'));
const electronVersion = pkg.devDependencies.electron;

function validateCheckout(checkout) {
  const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
  if (git('rev-parse', 'HEAD') !== civilRevision || git('diff', 'HEAD', '--name-only', '--', 'app', 'LICENSE', 'NOTICE')) {
    throw new Error(`CivilCraft의 수정되지 않은 리비전 ${civilRevision}을 사용하세요.`);
  }
}

async function localElectronZip(platform, arch) {
  const directory = process.env.STATIONFORM_ELECTRON_ZIPS;
  if (!directory) return undefined;
  const filename = `electron-v${electronVersion}-${platform}-${arch}.zip`;
  const checksums = JSON.parse(await readFile(join(repo, 'node_modules/electron/checksums.json'), 'utf8'));
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(resolve(directory, filename))) hash.update(chunk);
  if (hash.digest('hex') !== checksums[filename]) throw new Error(`Electron ZIP의 체크섬이 일치하지 않습니다. ${filename}`);
  return resolve(directory);
}

async function buildApp(checkout, stage, licenses) {
  await Promise.all([
    mkdir(join(stage, 'vendor'), { recursive: true }),
    mkdir(licenses),
  ]);
  const modules = Object.entries(civilCraftModules)
    .map(([file, names]) => `export { ${names.join(', ')} } from './${file}';`)
    .join('\n');
  const dependencies = ['delaunator', 'robust-predicates'];
  const alias = Object.fromEntries(dependencies.map((name) => [name, fileURLToPath(import.meta.resolve(name))]));

  await Promise.all([
    ...['desktop', 'src', 'fixtures'].map((dir) => cp(join(repo, dir), join(stage, dir), { recursive: true })),
    writeFile(join(stage, 'package.json'), JSON.stringify({
      name: pkg.name, version: pkg.version, main: 'desktop/main.mjs', private: true, license: pkg.license,
    }, null, 2) + '\n'),
    build({
      stdin: { contents: modules, resolveDir: join(checkout, 'app'), sourcefile: 'stationform-civilcraft.mjs' },
      outfile: join(stage, 'vendor/civilcraft.mjs'),
      platform: 'node',
      format: 'esm',
      target: 'node24',
      bundle: true,
      alias,
      legalComments: 'eof',
    }),
    copyFile(join(repo, 'LICENSE'), join(licenses, 'StationForm-LICENSE.txt')),
    copyFile(join(checkout, 'LICENSE'), join(licenses, 'CivilCraft-LICENSE.txt')),
    copyFile(join(checkout, 'NOTICE'), join(licenses, 'CivilCraft-NOTICE.txt')),
    ...dependencies.map((name) =>
      copyFile(join(repo, 'node_modules', name, 'LICENSE'), join(licenses, `${name}-LICENSE.txt`))),
    writeFile(join(licenses, 'SOURCE.txt'), [
      'CivilCraft calculation and export modules compiled into one JavaScript module by StationForm.',
      `https://github.com/getcadcraft/civilcraft/tree/${civilRevision}`,
      ...dependencies.map((name) => `${name} ${pkg.devDependencies[name]} — https://www.npmjs.com/package/${name}`),
      '',
    ].join('\n')),
  ]);
}

async function run() {
  const [argument, platform = process.platform, arch = process.arch] = process.argv.slice(2);
  if (!argument || !['linux', 'win32'].includes(platform) || !['x64', 'arm64'].includes(arch)) {
    throw new Error('사용법: npm run pack:desktop -- <CivilCraft 경로> [linux|win32] [x64|arm64]');
  }
  const checkout = resolve(argument);
  validateCheckout(checkout);
  const electronZipDir = await localElectronZip(platform, arch);
  const temporary = await mkdtemp(join(tmpdir(), 'stationform-pack-'));
  try {
    const stage = join(temporary, 'app');
    const licenses = join(temporary, 'licenses');
    await buildApp(checkout, stage, licenses);
    const paths = await packager({
      dir: stage,
      out: join(repo, 'dist'),
      name: 'StationForm',
      platform,
      arch,
      electronVersion,
      electronZipDir,
      asar: true,
      prune: false,
      overwrite: true,
      extraResource: [licenses],
      win32metadata: { CompanyName: 'StationForm', ProductName: 'StationForm' },
    });
    for (const path of paths) console.log(path);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

try {
  await run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
