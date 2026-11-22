import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadCivilCraft } from '../src/civilcraft.mjs';
import { studySite } from '../src/site-study.mjs';
import { writeEarthworkCsv, writeStudyDxf } from '../src/study-exports.mjs';

const checkout = process.argv[2];
if (!checkout) {
  console.error('사용법: npm run verify:civil -- <CivilCraft 체크아웃 경로>');
  process.exit(1);
}

const [civil, xml, settings] = await Promise.all([
  loadCivilCraft(checkout),
  readFile(new URL('../fixtures/concept-station.xml', import.meta.url), 'utf8'),
  readFile(new URL('../fixtures/concept-study.json', import.meta.url), 'utf8'),
]);
const options = JSON.parse(settings);
const study = studySite(civil, xml, options);
assert.deepEqual(study.station, { value: 1050, x: 50, y: 50, railLevel: 13 });
assert.deepEqual(study.platform.section, { edgeOffset: 2, outerOffset: 8, level: 14.1 });
assert.deepEqual(study.section.line, [{ x: 50, y: 90 }, { x: 50, y: 50 }, { x: 50, y: 10 }]);
assert.deepEqual(study.plan.track.at(0), { x: 20, y: 50 });
assert.deepEqual(study.plan.platform.at(0), { x: 20, y: 48 });
assert.deepEqual(study.plan.platform.at(-1), { x: 20, y: 42 });

function levelAt(runs, offset) {
  for (const run of runs) {
    for (let index = 1; index < run.length; index++) {
      const [a, b] = [run[index - 1], run[index]];
      if (offset >= a.o && offset <= b.o) return a.z + (b.z - a.z) * (offset - a.o) / (b.o - a.o);
    }
  }
  throw new Error(`횡단면 오프셋 ${offset}의 표고가 없습니다.`);
}

assert.equal(levelAt(study.section.ground, 22), 10);
for (const alternative of study.alternatives) {
  assert.ok(Math.abs(levelAt(alternative.plannedSection, 22) - alternative.plazaLevel) < 1e-8);
  // Grid integration can accumulate a small residual near the slope toes.
  assert.ok(alternative.earthwork.cut < 0.01);
  assert.ok(alternative.earthwork.fill > 0);
}
assert.ok(study.alternatives[1].earthwork.fill > study.alternatives[0].earthwork.fill);

const revision = '1234567890abcdef';
const planDxf = writeStudyDxf(civil.writeDxf, study, revision, 'plan', 1);
const sectionDxf = writeStudyDxf(civil.writeDxf, study, revision, 'section', 1);
const csv = writeEarthworkCsv(study, revision);
assert.match(planDxf, /AC1009[\s\S]*GRADING_LIMIT[\s\S]*1234567890abcdef/);
assert.match(sectionDxf, /AC1009[\s\S]*PROPOSED_GROUND[\s\S]*1234567890abcdef/);
assert.equal(csv.codePointAt(0), 0xfeff);
assert.equal(csv.trim().split('\r\n').length, 3);
assert.equal(csv.match(/1234567890abcdef/g).length, 2);
assert.throws(() => writeStudyDxf(civil.writeDxf, study, revision, 'section', 2), /대안을 선택하세요/);

const leftPlatform = studySite(civil, xml, { ...options, platform: { ...options.platform, edgeOffset: -2 } });
assert.equal(leftPlatform.platform.section.outerOffset, -8);
assert.throws(() => studySite(civil, xml, {
  ...options,
  platform: { ...options.platform, end: 1101 },
}), /공통 측점 범위/);
assert.throws(() => studySite(civil, xml, {
  ...options,
  alternatives: [{ name: '범위 밖 사면', plazaLevel: 200 }],
}), /현황 지표면/);

console.log(JSON.stringify({
  station: study.station,
  platformSection: study.platform.section,
  alternatives: study.alternatives.map(({ name, plazaLevel, earthwork }) => ({ name, plazaLevel, earthwork })),
}, null, 2));
