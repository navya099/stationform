import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadCivilCraft } from '../src/civilcraft.mjs';
import { calculateSiteStudy, studySite } from '../src/site-study.mjs';
import { writeEarthworkCsv, writeStudyDxf } from '../src/study-exports.mjs';
import { writeStudyIfc } from '../src/study-ifc.mjs';

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
const calculation = calculateSiteStudy(civil, xml, options);
const { study } = calculation;
assert.deepEqual(study.station, { value: 1050, x: 50, y: 50, railLevel: 13 });
assert.deepEqual(study.platform.section, { edgeOffset: 2, outerOffset: 8, level: 14.1 });
assert.deepEqual(study.section.line, [{ x: 50, y: 90 }, { x: 50, y: 50 }, { x: 50, y: 10 }]);
assert.deepEqual(study.plan.track.at(0), { x: 20, y: 50 });
assert.deepEqual(study.plan.platform.at(0), { x: 20, y: 48 });
assert.deepEqual(study.plan.platform.at(-1), { x: 20, y: 42 });
assert.deepEqual(study.stationBuilding.footprint, [
  { x: 38, y: 60 }, { x: 38, y: 40 }, { x: 62, y: 40 }, { x: 62, y: 60 },
]);
assert.deepEqual(study.stationBuilding.section, [
  { o: -10, z: 21 }, { o: 10, z: 21 }, { o: 10, z: 27 }, { o: -10, z: 27 },
]);
assert.equal(study.stationBuilding.footprintArea, 480);
assert.equal(study.stationBuilding.type, 'over-track');
assert.equal(study.accessRoad.length, 15);
assert.equal(study.accessRoad.connectionLevel, 10);
assert.deepEqual(study.accessRoad.footprint, [
  { x: 47, y: 5 }, { x: 53, y: 5 }, { x: 53, y: 20 }, { x: 47, y: 20 },
]);
assert.deepEqual(study.alternatives.map(({ accessRoad }) => Math.round(accessRoad.gradePercent * 100)), [667, 1333]);
assert.deepEqual(study.alternatives.map(({ accessRoad }) => accessRoad.exceedsLimit), [false, true]);
assert.equal(studySite(civil, xml, { ...options, accessRoad: undefined }).accessRoad, undefined);
assert.throws(() => studySite(civil, xml, {
  ...options,
  accessRoad: { ...options.accessRoad, plazaEdge: 3 },
}), /지정한 광장 경계부터/);
assert.throws(() => studySite(civil, xml, {
  ...options,
  accessRoad: { ...options.accessRoad, x: 50, y: -5 },
}), /현황 지표면 표고/);

const dimensions = { length: 24, width: 20, height: 6 };
const underTrack = studySite(civil, xml, {
  ...options,
  stationBuilding: { ...dimensions, type: 'under-track', roofBelowRail: 1 },
});
assert.equal(underTrack.stationBuilding.label, '선하역사');
assert.equal(underTrack.stationBuilding.floorLevel, 6);
assert.equal(underTrack.stationBuilding.roofLevel, 12);
assert.deepEqual(underTrack.stationBuilding.footprint, study.stationBuilding.footprint);

const elevatedOptions = {
  ...options,
  stationBuilding: { ...dimensions, type: 'elevated', floorAboveGround: 0.5 },
};
const highTrackXml = xml.replace('1000 12</PVI>', '1000 22</PVI>').replace('1100 14</PVI>', '1100 24</PVI>');
const elevated = studySite(civil, highTrackXml, elevatedOptions);
assert.equal(elevated.stationBuilding.label, '고가역사 하부');
assert.equal(elevated.stationBuilding.floorLevel, 10.5);
assert.equal(elevated.stationBuilding.roofLevel, 16.5);
assert.throws(() => studySite(civil, xml, elevatedOptions), /지붕 표고는 기준 레일면보다 낮아야/);
assert.throws(() => studySite(civil, xml, {
  ...options, stationBuilding: { ...dimensions, type: 'unknown' },
}), /지원하지 않는 역사 형식/);
assert.equal(studySite(civil, xml, { ...options, stationBuilding: undefined }).stationBuilding, undefined);
assert.throws(() => studySite(civil, xml, {
  ...options,
  stationBuilding: { ...options.stationBuilding, width: -1 },
}), /선상역사 폭/);
assert.throws(() => studySite(civil, xml, {
  ...options,
  stationBuilding: { ...options.stationBuilding, length: 110 },
}), /역사 본체가 선형과 계획 종단의 공통 측점 범위/);

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
const ifc = writeStudyIfc(civil.writeCivilIfc, calculation, 1, { name: 'StationForm', revision });
assert.match(ifc, /FILE_SCHEMA\(\('IFC4X3_ADD2'\)\)/);
assert.match(ifc, /IFCBUILDINGELEMENTPROXY\(/);
assert.match(ifc, /IFCSLAB\(/);
assert.match(ifc, /IFCPAVEMENT\(/);
assert.match(ifc, /'AccessRoadGradeExceedsLimit',\$,IFCBOOLEAN\(\.T\.\)/);
assert.match(ifc, /IFCTRIANGULATEDIRREGULARNETWORK\(/);
assert.match(ifc, /'CalculationId',\$,IFCLABEL\('1234567890abcdef'\)/);
assert.match(ifc, /'Alternative',\$,IFCLABEL\('B'\)/);
assert.match(ifc, /'PlazaLevel',\$,IFCLENGTHMEASURE\(12\.\)/);
assert.throws(() => writeStudyIfc(civil.writeCivilIfc, calculation, 2, { name: 'StationForm', revision }), /대안을 선택하세요/);
assert.match(planDxf, /AC1009[\s\S]*GRADING_LIMIT[\s\S]*1234567890abcdef/);
assert.match(sectionDxf, /AC1009[\s\S]*PROPOSED_GROUND[\s\S]*1234567890abcdef/);
assert.match(planDxf, /STATION_BUILDING/);
assert.match(planDxf, /ACCESS_ROAD/);
assert.match(sectionDxf, /STATION_BUILDING/);
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
