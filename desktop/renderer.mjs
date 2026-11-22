import { drawPlan, drawSection } from './drawings.mjs';

const ui = Object.fromEntries([
  'open-project', 'save-project', 'project-name',
  'open-source', 'open-settings', 'sample', 'study-form', 'station', 'alternative',
  'plaza-level', 'source-name', 'settings-name', 'calculate', 'status', 'track-name',
  'section-name', 'plan', 'section', 'volumes', 'rail-level', 'platform-level',
  'report-intent', 'report-rationale',
  'building-enabled', 'building-fields', 'building-length', 'building-width', 'building-height',
  'building-clearance', 'building-summary', 'building-levels', 'building-area',
].map((id) => [id, document.getElementById(id)]));
const files = { source: null, settings: null };
const exportButtons = [...document.querySelectorAll('[data-export]')];
const buildingLegends = document.querySelectorAll('[data-building-legend]');
const buildingFields = {
  length: ui['building-length'],
  width: ui['building-width'],
  height: ui['building-height'],
  floorAboveRail: ui['building-clearance'],
};
const format = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let study;
let alternatives = [];
let selected = 0;
let projectName;
let dirty = false;
let settingsEdited = false;

function updateProjectStatus() {
  ui['project-name'].textContent = (projectName ?? '저장 전') + (dirty ? ' · 변경됨' : '');
}

function studyInput() {
  return [ui.station.valueAsNumber, alternatives.map(({ plazaLevel }) => plazaLevel)];
}

function readBuilding() {
  if (!ui['building-enabled'].checked) return null;
  return Object.fromEntries(Object.entries(buildingFields).map(([key, field]) => [key, field.valueAsNumber]));
}

function showBuilding(building) {
  ui['building-enabled'].checked = Boolean(building);
  ui['building-fields'].hidden = !building;
  for (const [key, field] of Object.entries(buildingFields)) field.value = building?.[key] ?? field.defaultValue;
}

function readReportNotes() {
  return { intent: ui['report-intent'].value, rationale: ui['report-rationale'].value };
}

function showReportNotes(notes) {
  ui['report-intent'].value = notes?.intent ?? '';
  ui['report-rationale'].value = notes?.rationale ?? '';
}

function updateExportButtons() {
  const building = readBuilding();
  const sameBuilding = building
    ? Object.entries(building).every(([key, value]) => value === study?.stationBuilding?.[key])
    : !study?.stationBuilding;
  const current = study && ui.station.valueAsNumber === study.station.value
    && sameBuilding
    && alternatives.every(({ plazaLevel }, index) => plazaLevel === study.alternatives[index].plazaLevel);
  for (const button of exportButtons) button.disabled = !current;
}

function message(text, error = false) {
  ui.status.textContent = text;
  ui.status.toggleAttribute('data-error', error);
}

function present() {
  const alternative = study?.alternatives[selected];
  ui.plan.replaceChildren();
  ui.section.replaceChildren();
  ui.volumes.replaceChildren();
  ui['track-name'].textContent = study?.track.name ?? '';
  ui['section-name'].textContent = alternative ? `A–A · ${study.station.value} m · 대안 ${alternative.name}` : '';
  ui['rail-level'].textContent = study ? `${format.format(study.station.railLevel)} m` : '—';
  ui['platform-level'].textContent = study ? `${format.format(study.platform.section.level)} m` : '—';
  const building = study?.stationBuilding;
  ui['building-summary'].hidden = !building;
  for (const legend of buildingLegends) legend.hidden = !building;
  if (building) {
    ui['building-levels'].textContent = `${format.format(building.floorLevel)} · ${format.format(building.roofLevel)} m`;
    ui['building-area'].textContent = `${format.format(building.footprintArea)} m²`;
  }
  if (!alternative) return;

  drawPlan(ui.plan, study, alternative);
  drawSection(ui.section, study, alternative);
  study.alternatives.forEach(({ name, earthwork }, index) => {
    const row = ui.volumes.insertRow();
    if (index === selected) row.setAttribute('aria-current', 'true');
    row.insertCell().textContent = name;
    row.insertCell().textContent = format.format(earthwork.cut);
    row.insertCell().textContent = format.format(earthwork.fill);
  });
}

function showSettings(result) {
  files.settings = result.settings;
  ui['settings-name'].textContent = files.settings;
  ui.station.value = result.station ?? '';
  alternatives = result.alternatives;
  ui.alternative.replaceChildren(...alternatives.map(({ name }, index) => new Option(name, index)));
  selected = result.selected ?? 0;
  ui.alternative.value = selected;
  ui['plaza-level'].value = alternatives[selected].plazaLevel ?? '';
  showBuilding(result.stationBuilding);
  settingsEdited = false;
}

function showSource(name) {
  files.source = name;
  ui['source-name'].textContent = name;
}

async function run() {
  study = undefined;
  present();
  message('계산 중');
  study = await window.stationForm.run(...studyInput(), readBuilding());
  present();
  message('계산 완료');
}

async function task(action) {
  const controls = [ui['open-project'], ui['save-project'], ui['open-source'], ui['open-settings'], ui.sample, ui.station,
    ui.alternative, ui['plaza-level'], ui.calculate, ui['report-intent'], ui['report-rationale'],
    ui['building-enabled'], ui['building-fields'], ...exportButtons];
  for (const control of controls) control.disabled = true;
  try {
    await action();
  } catch (error) {
    message(error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''), true);
  } finally {
    updateProjectStatus();
    for (const control of controls) control.disabled = false;
    for (const control of [ui.station, ui.alternative, ui['plaza-level']]) control.disabled = !files.settings;
    ui['building-enabled'].disabled = !files.settings;
    ui['building-fields'].disabled = !files.settings || !ui['building-enabled'].checked;
    ui.calculate.disabled = !files.source || !files.settings;
    ui['save-project'].disabled = ui.calculate.disabled;
    updateExportButtons();
  }
}

ui['open-source'].addEventListener('click', () => task(async () => {
  const source = await window.stationForm.openSource();
  if (!source) return;
  showSource(source);
  dirty = true;
  study = undefined;
  present();
  message('이 LandXML에 맞는 설계 조건을 선택하거나 확인한 뒤 계산하세요.');
}));
ui['open-settings'].addEventListener('click', () => task(async () => {
  if (settingsEdited && !await window.stationForm.confirmDiscard()) return;
  const result = await window.stationForm.openSettings();
  if (!result) return;
  showSettings(result);
  dirty = true;
  study = undefined;
  present();
  message(files.source ? '설계 조건을 읽었습니다. 계산을 적용하세요.' : 'LandXML을 선택하세요.');
}));
ui.alternative.addEventListener('change', () => {
  selected = Number(ui.alternative.value);
  ui['plaza-level'].value = Number.isFinite(alternatives[selected].plazaLevel) ? alternatives[selected].plazaLevel : '';
  present();
  dirty = true;
  updateProjectStatus();
});
function studyChanged() {
  dirty = settingsEdited = true;
  updateProjectStatus();
  updateExportButtons();
  if (study) message('입력 변경 사항을 반영하려면 계산을 적용하세요.');
}

ui['plaza-level'].addEventListener('input', () => {
  alternatives[selected].plazaLevel = ui['plaza-level'].valueAsNumber;
  studyChanged();
});
ui.station.addEventListener('input', studyChanged);
ui['building-enabled'].addEventListener('change', () => {
  ui['building-fields'].hidden = ui['building-fields'].disabled = !ui['building-enabled'].checked;
  studyChanged();
});
for (const field of Object.values(buildingFields)) field.addEventListener('input', studyChanged);
ui['study-form'].addEventListener('submit', (event) => {
  event.preventDefault();
  if (files.source && files.settings) void task(run);
});
const loadSample = () => task(async () => {
  if (dirty && !await window.stationForm.confirmDiscard()) return;
  const result = await window.stationForm.openSample();
  showSource(result.source);
  showSettings(result);
  projectName = undefined;
  showReportNotes();
  dirty = false;
  await run();
});
ui['open-project'].addEventListener('click', () => task(async () => {
  if (dirty && !await window.stationForm.confirmDiscard()) return;
  const result = await window.stationForm.openProject();
  if (!result) return;
  showSource(result.source);
  showSettings(result);
  projectName = result.projectName;
  showReportNotes(result.report);
  dirty = false;
  await run();
}));
ui['save-project'].addEventListener('click', () => task(async () => {
  const name = await window.stationForm.saveProject(...studyInput(), selected, readReportNotes(), readBuilding());
  if (!name) return;
  projectName = name;
  dirty = settingsEdited = false;
  message('프로젝트를 저장했습니다.');
}));
window.addEventListener('beforeunload', (event) => {
  if (dirty) event.preventDefault();
});
for (const field of [ui['report-intent'], ui['report-rationale']]) {
  field.addEventListener('input', () => {
    dirty = true;
    updateProjectStatus();
  });
}
for (const button of exportButtons) {
  button.addEventListener('click', () => task(async () => {
    const name = await window.stationForm.exportStudy(
      button.dataset.export, ...studyInput(), selected, readReportNotes(), readBuilding(),
    );
    if (name) message(`${name} 파일을 저장했습니다.`);
  }));
}
ui.sample.addEventListener('click', loadSample);
void loadSample();
