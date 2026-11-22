import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron/main';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCivilCraft } from '../src/civilcraft.mjs';
import { studySite } from '../src/site-study.mjs';

const checkout = process.env.STATIONFORM_CIVILCRAFT || process.argv[2];
const sampleXml = new URL('../fixtures/concept-station.xml', import.meta.url);
const sampleOptions = new URL('../fixtures/concept-study.json', import.meta.url);

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
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());

  const handle = (channel, run) => ipcMain.handle(channel, async (event, ...args) => {
    if (event.senderFrame !== window.webContents.mainFrame) throw new Error('잘못된 요청입니다.');
    return run(...args);
  });
  const choose = async (filters) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters,
    });
    if (canceled) return null;
    return { name: basename(filePaths[0]), content: await readFile(filePaths[0], 'utf8') };
  };
  const readSettings = (content) => {
    const options = JSON.parse(content);
    if (!options || !Array.isArray(options.alternatives) || !options.alternatives.length) {
      throw new Error('설계 조건 JSON에 대안 목록이 필요합니다.');
    }
    return {
      options,
      fields: {
        station: options.station,
        alternatives: options.alternatives.map(({ name, plazaLevel }) => ({ name, plazaLevel })),
      },
    };
  };

  handle('study:sample', async () => {
    const [xml, json] = await Promise.all([readFile(sampleXml, 'utf8'), readFile(sampleOptions, 'utf8')]);
    const parsed = readSettings(json);
    source = xml;
    settings = parsed.options;
    return { source: 'concept-station.xml', settings: 'concept-study.json', ...parsed.fields };
  });
  handle('study:source', async () => {
    const file = await choose([{ name: 'LandXML', extensions: ['xml', 'landxml'] }]);
    if (file) source = file.content;
    return file?.name ?? null;
  });
  handle('study:settings', async () => {
    const file = await choose([{ name: '설계 조건', extensions: ['json'] }]);
    if (!file) return null;
    const { options, fields } = readSettings(file.content);
    settings = options;
    return { settings: file.name, ...fields };
  });
  handle('study:run', (station, levels) => {
    if (!source || !settings) throw new Error('LandXML과 설계 조건을 먼저 여세요.');
    if (!Number.isFinite(station) || !Array.isArray(levels) || levels.length !== settings.alternatives.length
      || !levels.every(Number.isFinite)) {
      throw new Error('측점과 모든 대안의 광장 계획고를 입력하세요.');
    }
    return studySite(engine, source, {
      ...settings,
      station,
      alternatives: settings.alternatives.map((alternative, index) => ({ ...alternative, plazaLevel: levels[index] })),
    });
  });

  window.loadFile(fileURLToPath(new URL('./index.html', import.meta.url)));
}

app.on('window-all-closed', () => app.quit());
