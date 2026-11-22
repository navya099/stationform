import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron/main';
import { lstat, readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCivilCraft } from '../src/civilcraft.mjs';
import { readProjectFile, writeProjectFile } from '../src/project-file.mjs';
import { studySite } from '../src/site-study.mjs';

const checkout = process.env.STATIONFORM_CIVILCRAFT || process.argv[2];
const sampleXml = new URL('../fixtures/concept-station.xml', import.meta.url);
const sampleOptions = new URL('../fixtures/concept-study.json', import.meta.url);
const projectFilters = [{ name: 'StationForm 프로젝트', extensions: ['stationform'] }];

app.commandLine.appendSwitch('disable-background-networking');
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  if (!checkout) throw new Error('npm run desktop -- <CivilCraft 체크아웃 경로>');
  openWindow(await loadCivilCraft(checkout));
}).catch((error) => {
  dialog.showErrorBox('StationForm을 시작할 수 없습니다', error.message);
  app.exit(1);
});

function openWindow(engine) {
  const window = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 760,
    minHeight: 580,
    backgroundColor: '#111a24',
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      sandbox: true,
      contextIsolation: true,
    },
  });

  let source;
  let settings;
  let projectPath;
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());

  const handle = (channel, run) => ipcMain.handle(channel, async (event, ...args) => {
    if (event.senderFrame !== window.webContents.mainFrame) throw new Error('잘못된 요청입니다.');
    return run(...args);
  });
  const choosePath = async (filters) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters,
    });
    return canceled ? null : filePaths[0];
  };
  const readDocument = async (path, name = basename(path)) => ({ name, content: await readFile(path, 'utf8') });
  const fields = ({ name, options }) => {
    if (!Array.isArray(options?.alternatives) || !options.alternatives.length) {
      throw new Error('설계 조건 JSON에 대안 목록이 필요합니다.');
    }
    return {
      settings: name,
      station: options.station,
      alternatives: options.alternatives.map(({ name, plazaLevel }) => ({ name, plazaLevel })),
    };
  };
  const updatedOptions = (station, levels) => {
    if (!source || !settings) throw new Error('LandXML과 설계 조건을 먼저 여세요.');
    const { options } = settings;
    if (!Number.isFinite(station) || !Array.isArray(levels) || levels.length !== options.alternatives.length
      || !levels.every(Number.isFinite)) {
      throw new Error('측점과 모든 대안의 광장 계획고를 입력하세요.');
    }
    return {
      ...options,
      station,
      alternatives: options.alternatives.map((alternative, index) => ({ ...alternative, plazaLevel: levels[index] })),
    };
  };
  const confirmDiscard = () => dialog.showMessageBoxSync(window, {
    type: 'warning',
    message: '저장하지 않은 프로젝트 변경 사항이 있습니다.',
    buttons: ['계속 편집', '변경 사항 버리기'],
    defaultId: 0,
    cancelId: 0,
  }) === 1;
  window.webContents.on('will-prevent-unload', (event) => {
    if (confirmDiscard()) event.preventDefault();
  });
  handle('project:discard', confirmDiscard);

  handle('study:sample', async () => {
    const [xml, json] = await Promise.all([readFile(sampleXml, 'utf8'), readFile(sampleOptions, 'utf8')]);
    const nextSettings = { name: 'concept-study.json', options: JSON.parse(json) };
    const result = fields(nextSettings);
    source = { name: 'concept-station.xml', content: xml };
    settings = nextSettings;
    projectPath = undefined;
    return { source: source.name, ...result };
  });
  handle('study:source', async () => {
    const path = await choosePath([{ name: 'LandXML', extensions: ['xml', 'landxml'] }]);
    if (!path) return null;
    source = await readDocument(path);
    return source.name;
  });
  handle('study:settings', async () => {
    const path = await choosePath([{ name: '설계 조건', extensions: ['json'] }]);
    if (!path) return null;
    const file = await readDocument(path);
    const nextSettings = { name: file.name, options: JSON.parse(file.content) };
    const result = fields(nextSettings);
    settings = nextSettings;
    return result;
  });
  handle('study:run', (station, levels) => {
    const options = updatedOptions(station, levels);
    return studySite(engine, source.content, options);
  });
  handle('project:open', async () => {
    const path = await choosePath(projectFilters);
    if (!path) return null;
    const project = await readProjectFile(path);
    const result = {
      projectName: basename(path),
      source: project.source.name,
      selected: project.selected,
      ...fields(project.settings),
    };
    ({ source, settings } = project);
    projectPath = path;
    return result;
  });
  handle('project:save', async (station, levels, selected) => {
    const options = updatedOptions(station, levels);
    let path = projectPath;
    if (!path) {
      const base = basename(source.name).replace(/\.(?:landxml|xml)$/i, '');
      const choice = await dialog.showSaveDialog(window, { defaultPath: `${base}.stationform`, filters: projectFilters });
      if (choice.canceled || !choice.filePath) return null;
      path = choice.filePath;
      if (!path.toLowerCase().endsWith('.stationform')) {
        path += '.stationform';
        const exists = await lstat(path).then(() => true, (error) => {
          if (error.code !== 'ENOENT') throw error;
          return false;
        });
        if (exists) throw new Error('같은 이름의 프로젝트가 있습니다. 저장할 파일 이름에 .stationform을 포함하세요.');
      }
    }
    const savedSettings = { ...settings, options };
    await writeProjectFile(path, { source, settings: savedSettings, selected });
    settings = savedSettings;
    projectPath = path;
    return basename(path);
  });

  window.loadFile(fileURLToPath(new URL('./index.html', import.meta.url)));
}

app.on('window-all-closed', () => app.quit());
