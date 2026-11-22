import { drawPlan, drawSection } from './drawings.mjs';

const ui = Object.fromEntries([
  'open-source', 'open-settings', 'sample', 'study-form', 'station', 'alternative',
  'plaza-level', 'source-name', 'settings-name', 'calculate', 'status', 'track-name',
  'section-name', 'plan', 'section', 'volumes', 'rail-level', 'platform-level',
].map((id) => [id, document.getElementById(id)]));
const files = { source: null, settings: null };
const format = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let study;
let alternatives = [];
let selected = 0;

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
  if (!alternative) return;

  drawPlan(ui.plan, study);
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
  selected = 0;
  ui['plaza-level'].value = alternatives[0].plazaLevel ?? '';
}

function showSource(name) {
  files.source = name;
  ui['source-name'].textContent = name;
}

async function run() {
  study = undefined;
  present();
  message('계산 중');
  const station = ui.station.valueAsNumber;
  const levels = alternatives.map(({ plazaLevel }) => plazaLevel);
  study = await window.stationForm.run(station, levels);
  present();
  message('계산 완료');
}

async function task(action) {
  const controls = [ui['open-source'], ui['open-settings'], ui.sample, ui.station,
    ui.alternative, ui['plaza-level'], ui.calculate];
  for (const control of controls) control.disabled = true;
  try {
    await action();
  } catch (error) {
    message(error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''), true);
  } finally {
    for (const control of controls) control.disabled = false;
    for (const control of [ui.station, ui.alternative, ui['plaza-level']]) control.disabled = !files.settings;
    ui.calculate.disabled = !files.source || !files.settings;
  }
}

ui['open-source'].addEventListener('click', () => task(async () => {
  const source = await window.stationForm.openSource();
  if (!source) return;
  showSource(source);
  study = undefined;
  present();
  message('이 LandXML에 맞는 설계 조건을 선택하거나 확인한 뒤 계산하세요.');
}));
ui['open-settings'].addEventListener('click', () => task(async () => {
  const result = await window.stationForm.openSettings();
  if (!result) return;
  showSettings(result);
  study = undefined;
  present();
  message(files.source ? '설계 조건을 읽었습니다. 계산을 적용하세요.' : 'LandXML을 선택하세요.');
}));
ui.alternative.addEventListener('change', () => {
  selected = Number(ui.alternative.value);
  ui['plaza-level'].value = Number.isFinite(alternatives[selected].plazaLevel) ? alternatives[selected].plazaLevel : '';
  present();
});
ui['plaza-level'].addEventListener('input', () => {
  alternatives[selected].plazaLevel = ui['plaza-level'].valueAsNumber;
  if (study) message('입력 변경 사항을 반영하려면 계산을 적용하세요.');
});
ui.station.addEventListener('input', () => {
  if (study) message('입력 변경 사항을 반영하려면 계산을 적용하세요.');
});
ui['study-form'].addEventListener('submit', (event) => {
  event.preventDefault();
  if (files.source && files.settings) void task(run);
});
const loadSample = () => task(async () => {
  const result = await window.stationForm.openSample();
  showSource(result.source);
  showSettings(result);
  await run();
});
ui.sample.addEventListener('click', loadSample);
void loadSample();
