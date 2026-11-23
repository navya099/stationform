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
  drawPlan(element('plan'), study, alternative);
  drawSection(element('section'), study, alternative);
  await document.fonts.ready;
  return true;
}

window.reportReady = render();
