const { BrowserWindow } = require('electron');
const { normalizePrices } = require('./normalize');

const URL = 'https://www.logammulia.com/id/harga-emas-hari-ini';

// Runs INSIDE the loaded page. Returns raw (string) values; normalize.js cleans them.
// ponytail: generic table scan — pin to real selectors after inspecting the live DOM.
const EXTRACT = `(() => {
  const rows = [];
  document.querySelectorAll('table tr').forEach((tr) => {
    const cells = tr.querySelectorAll('td');
    if (cells.length >= 2) {
      const berat = cells[0].innerText.trim();
      const jual = cells[cells.length - 1].innerText.trim();
      if (/gr|gram/i.test(berat) && /[0-9]/.test(jual)) rows.push({ berat, jual });
    }
  });
  const bodyText = document.body.innerText;
  const buybackMatch = bodyText.match(/buyback[^0-9]*([0-9.]+)/i);
  const buyback = buybackMatch ? buybackMatch[1] : '';
  const dateMatch = bodyText.match(/\\d{1,2}\\s+\\w+\\s+\\d{4}/);
  const tanggal = dateMatch ? dateMatch[0] : '';
  return { rows, buyback, tanggal };
})()`;

async function scrapePrices() {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false },
  });
  try {
    await win.loadURL(URL); // rejects on load failure (e.g. Akamai block / offline)
    // give client-side rendering a moment to settle
    await new Promise((r) => setTimeout(r, 2000));
    const raw = await win.webContents.executeJavaScript(EXTRACT);
    return normalizePrices(raw);
  } finally {
    win.destroy();
  }
}

module.exports = { scrapePrices };
