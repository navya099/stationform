const layers = {
  TRACK_CENTER: 7,
  PLATFORM: 4,
  PLAZA: 3,
  ACCESS_ROAD: 30,
  ROAD_CENTER: 32,
  STATION_BUILDING: 6,
  GRADING_LIMIT: 94,
  SECTION_CUT: 2,
  EXISTING_GROUND: 8,
  PROPOSED_GROUND: 3,
  RAIL_LEVEL: 1,
  ANNOTATIONS: 7,
};

function cell(value) {
  if (typeof value === 'number') return String(value);
  // Quoting is required independently of neutralizing formulas in spreadsheet apps.
  const text = /^[\s\uFEFF]*[=+\-@]/.test(value) ? "'" + value : value;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function writeEarthworkCsv(study, revision) {
  const headers = ['계산 ID', '선로', '종단', '측점 (m)', '대안', '광장 계획고 (m)', '절토 (m³)',
    '성토 (m³)', '순성토 (m³)', '격자 크기 (m)', '계산 면적 (m²)',
    '진입로 길이 (m)', '진입로 종단경사 (%)', '검토 경사 (%)', '경사 초과', '토공량 범위'];
  const rows = study.alternatives.map(({ name, plazaLevel, earthwork, accessRoad }) => [
    revision, study.track.name, study.track.profile, study.station.value, name, plazaLevel,
    earthwork.cut, earthwork.fill, earthwork.net, earthwork.cell, earthwork.area,
    study.accessRoad?.length ?? '', accessRoad?.gradePercent ?? '', study.accessRoad?.maxGradePercent ?? '',
    accessRoad ? (accessRoad.exceedsLimit ? '예' : '아니오') : '',
    study.accessRoad ? '광장·진입로' : '광장',
  ]);
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

function polyline(layer, pts, closed = false) {
  return { type: 'poly', layer, pts, closed };
}

function label(x, y, text, h = 0.8) {
  return { type: 'text', layer: 'ANNOTATIONS', x, y, text, h };
}

function planEntities(study, alternative) {
  const { track, platform, plaza } = study.plan;
  const { line } = study.section;
  return [
    polyline('TRACK_CENTER', track),
    polyline('PLATFORM', platform, true),
    polyline('PLAZA', plaza, true),
    ...(study.accessRoad ? [
      polyline('ACCESS_ROAD', study.accessRoad.footprint, true),
      polyline('ROAD_CENTER', study.accessRoad.centerline),
    ] : []),
    ...(study.stationBuilding ? [polyline('STATION_BUILDING', study.stationBuilding.footprint, true)] : []),
    polyline('GRADING_LIMIT', alternative.gradingBoundary, true),
    polyline('SECTION_CUT', line),
    ...[line[0], line.at(-1)].map(({ x, y }) => label(x, y, 'A')),
  ];
}

function sectionEntities(study, alternative) {
  const { edgeOffset, outerOffset, level } = study.platform.section;
  const { railLevel } = study.station;
  const profile = (runs, layer) => runs.map((run) => polyline(layer, run.map(({ o, z }) => ({ x: o, y: z }))));
  return [
    ...profile(study.section.ground, 'EXISTING_GROUND'),
    ...profile(alternative.plannedSection, 'PROPOSED_GROUND'),
    polyline('PLATFORM', [{ x: edgeOffset, y: level }, { x: outerOffset, y: level }]),
    ...(study.stationBuilding ? [polyline('STATION_BUILDING',
      study.stationBuilding.section.map(({ o, z }) => ({ x: o, y: z })), true)] : []),
    { type: 'point', layer: 'RAIL_LEVEL', x: 0, y: railLevel },
    label(0, railLevel, `레일면 ${railLevel.toFixed(2)} m`),
    label(edgeOffset, level, `승강장 ${level.toFixed(2)} m`),
  ];
}

export function writeStudyDxf(writeDxf, study, revision, view, selected) {
  const alternative = Number.isInteger(selected) ? study.alternatives[selected] : undefined;
  if (!alternative) throw new Error('내보낼 대안을 선택하세요.');
  const isPlan = view === 'plan';
  if (!isPlan && view !== 'section') throw new Error('지원하지 않는 DXF 도면입니다.');
  const entities = isPlan ? planEntities(study, alternative) : sectionEntities(study, alternative);
  const anchor = isPlan ? study.section.line[0] : { x: 0, y: study.station.railLevel };
  const title = isPlan ? '배치 평면' : 'A–A 횡단면';
  const buildingType = study.stationBuilding ? ` / ${study.stationBuilding.label}` : '';
  entities.push(label(anchor.x, anchor.y + 3,
    `${title}${buildingType} / ${study.station.value} m / 대안 ${alternative.name} / ID ${revision}`));
  const names = [...new Set(entities.map(({ layer }) => layer))];
  return writeDxf({ units: 'm', entities, layers: names.map((name) => ({ name, color: layers[name] })) }).text;
}
