import { drawPlan, drawSection } from './drawings.mjs';

const number = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const format = (value) => number.format(value);
const element = (id) => document.getElementById(id);

async function render() {
  const { study, revision, selected, notes, project, source } = await window.reportInput.read();
  const alternative = study.alternatives[selected];
  element('project').textContent = project;
  element('revision').textContent = `계산 ID ${revision}`;
  element('figure-revision').textContent = `선택 대안 ${alternative.name} · 측점 ${study.station.value} m · 계산 ID ${revision}`;
  element('intent').textContent = notes?.intent.trim() || '미작성';
  element('rationale').textContent = notes?.rationale.trim() || '미작성';

  const overview = [
    ['선로', study.track.name], ['종단', study.track.profile],
    ['기준 측점', `${format(study.station.value)} m`], ['레일면 표고', `${format(study.station.railLevel)} m`],
    ['승강장 폭', `${format(study.platform.width)} m`], ['승강장 표고', `${format(study.platform.section.level)} m`],
    ['선택 대안', alternative.name], ['LandXML', source],
  ];
  const building = study.stationBuilding;
  if (building) {
    overview.push(
      ['역사 형식', `${building.label} 개념 매스`],
      ['길이 · 폭 · 높이', `${format(building.length)} × ${format(building.width)} × ${format(building.height)} m`],
      ['바닥 면적', `${format(building.footprintArea)} m²`],
      ['바닥 · 지붕 표고', `${format(building.floorLevel)} · ${format(building.roofLevel)} m`],
    );
    for (const legend of document.querySelectorAll('[data-building-legend]')) legend.hidden = false;
  }
  for (const [label, value] of overview) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    element('overview').append(term, description);
  }
  for (const [index, { name, plazaLevel, earthwork }] of study.alternatives.entries()) {
    const row = element('alternatives').insertRow();
    if (index === selected) row.classList.add('selected');
    row.insertCell().textContent = index === selected ? `${name} (선택)` : name;
    for (const value of [plazaLevel, earthwork.cut, earthwork.fill, earthwork.cell, earthwork.area]) {
      row.insertCell().textContent = format(value);
    }
  }
  const road = study.accessRoad;
  const gradingScope = road ? '광장과 진입로의 통합 정지' : '광장 정지';
  element('volume-scope').textContent = `토공량은 ${gradingScope} 사면이 현황 지형에 접합하는 경계 안에서 산정한 격자 기반 개략값입니다.`;
  if (road) {
    element('access-review').hidden = document.querySelector('[data-road-legend]').hidden = false;
    element('access-overview').textContent = `길이 ${format(road.length)} m · 폭 ${format(road.width)} m · 검토 경사 ${format(road.maxGradePercent)} %`;
    for (const [index, { name, accessRoad }] of study.alternatives.entries()) {
      const row = element('access-grades').insertRow();
      if (index === selected) row.classList.add('selected');
      row.insertCell().textContent = name;
      row.insertCell().textContent = format(accessRoad.gradePercent);
      row.insertCell().textContent = accessRoad.exceedsLimit ? '초과' : '범위 내';
    }
  }
  drawPlan(element('plan'), study, alternative);
  drawSection(element('section'), study, alternative);
  await document.fonts.ready;
  return true;
}

window.reportReady = render();
