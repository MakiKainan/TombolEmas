const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const { scrapePrices } = require('./scrape');
const { buildReportHtml } = require('./report');

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 320,
    webPreferences: {
      // ponytail: local single-user tool, nodeIntegration is fine here;
      // tighten with a preload if this ever ships beyond your own laptop
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadFile('index.html');
}

async function renderPdf(html) {
  const win = new BrowserWindow({ show: false });
  try {
    await win.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent(html)
    );
    return await win.webContents.printToPDF({ printBackground: true });
  } finally {
    win.destroy();
  }
}

function defaultFilename() {
  const d = new Date();
  const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
  return `Harga-Emas-${iso}.pdf`;
}

ipcMain.handle('scrape', async () => {
  const data = await scrapePrices();            // throws → renderer shows error
  const pdf = await renderPdf(buildReportHtml(data));
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultFilename(),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return null;       // nothing written
  fs.writeFileSync(filePath, pdf);              // write only after success
  return filePath;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
