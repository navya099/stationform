import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const checkout = process.argv[2];
if (!checkout) {
  console.error('사용법: npm run verify:civil -- <CivilCraft 체크아웃 경로>');
  process.exit(1);
}

const app = resolve(checkout, 'app');
const dependencies = new Map(
  ['delaunator', 'robust-predicates'].map((name) => [name, import.meta.resolve(name)]),
);
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    const url = dependencies.get(specifier);
    return url ? { url, shortCircuit: true } : nextResolve(specifier, context);
  },
});
const load = (file) => import(pathToFileURL(resolve(app, file)).href);

try {
  const { readLandXml } = await load('landxml.js');
  const { buildAlignment } = await load('alignment.js');
  const { buildProfile } = await load('profile.js');
  const { buildSurface, surfaceFromFaces } = await load('tin.js');
  const { gradedSurface, gridVolume } = await load('grading.js');
  const xml = await readFile(new URL('../fixtures/concept-station.xml', import.meta.url), 'utf8');
  const project = readLandXml(xml);
  assert.equal(project.units, 'm');

  const [track] = project.alignments;
  const [terrain] = project.surfaces;
  assert.ok(track && terrain && track.profiles.length, '선형, 계획 종단, 지표면이 필요합니다.');
  const alignment = buildAlignment(track);
  const profile = buildProfile(track.profiles[0].pvis);
  const { surface: ground } = surfaceFromFaces(terrain);
  assert.ok(ground, '현황 지표면을 생성하지 못했습니다.');

  const station = 1050;
  const { x, y } = alignment.pointAt(station);
  const railLevel = profile.elevationAt(station);
  assert.equal(x, 50);
  assert.equal(y, 50);
  assert.equal(railLevel, 13);

  const plazaX = x;
  const plazaY = y - 22;
  const pts = [
    { x: plazaX - 10, y: plazaY - 8 },
    { x: plazaX + 10, y: plazaY - 8 },
    { x: plazaX + 10, y: plazaY + 8 },
    { x: plazaX - 10, y: plazaY + 8 },
  ];
  const alternatives = [11, 12].map((z) => {
    const pad = { name: '역전광장', pts, z, cut: 2, fill: 2 };
    const { surface, report } = gradedSurface(ground, terrain.pts, terrain.breaklines, [pad], buildSurface);
    assert.ok(surface, JSON.stringify(report));
    assert.ok(Math.abs(surface.elevationAt(plazaX, plazaY) - z) < 1e-8);
    const { cut, fill, cell } = gridVolume(ground, surface, { cell: 0.5 });
    // The upstream grid integration can accumulate a small residual near the slope toes.
    assert.ok(cut < 0.01, `수평 지형 위 성토에서 예상 밖의 절토량이 발생했습니다. ${cut} m³`);
    assert.ok(fill > 0);
    return { plazaLevel: z, cut, fill, cell };
  });
  assert.ok(alternatives[1].fill > alternatives[0].fill);
  console.log(JSON.stringify({ units: 'm', station, railLevel, alternatives }, null, 2));
} finally {
  hook.deregister();
}
