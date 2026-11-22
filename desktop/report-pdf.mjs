import { BrowserWindow } from 'electron/main';
import { fileURLToPath } from 'node:url';

export async function createStudyPdf(payload) {
  const report = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: fileURLToPath(new URL('./report-preload.cjs', import.meta.url)),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    report.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    report.webContents.on('will-navigate', (event) => event.preventDefault());
    await report.loadFile(fileURLToPath(new URL('./report.html', import.meta.url)));
    report.webContents.send('report:data', payload);
    const ready = await report.webContents.executeJavaScript('window.reportReady');
    if (ready !== true) throw new Error('건축설계설명서를 준비하지 못했습니다.');
    return await report.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true });
  } finally {
    if (!report.isDestroyed()) report.destroy();
  }
}
