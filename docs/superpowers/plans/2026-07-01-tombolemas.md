# TombolEmas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-button Electron desktop app that scrapes today's gold prices from logammulia.com and saves a formatted PDF report.

**Architecture:** Electron app. A visible window has one button; on click the main process loads logammulia.com in a hidden Chromium window (real browser → passes Akamai), extracts the price table from the DOM, normalizes the numbers, renders a self-designed HTML report, and prints it to PDF via `webContents.printToPDF`, saved through a native Save dialog. Pure logic (number parsing, report HTML) lives in small testable modules; Electron glue stays thin.

**Tech Stack:** Node.js, Electron. Tests use the Node built-in test runner (`node:test` + `node:assert`) — no test-framework dependency.

## Global Constraints

- Source URL: `https://www.logammulia.com/id/harga-emas-hari-ini` (exact).
- PDF is self-designed (option A): full weight table (jual per weight) + buyback price + date. No source page branding/ads.
- Never produce a partial or empty PDF; on any failure show an error and write nothing.
- Only dependency is `electron`. Number parsing, report HTML, and tests use Node stdlib only.
- Indonesian number format: `.` is the thousands separator (prices are whole rupiah).
- UI copy is Indonesian (see spec status strings).

---

### Task 1: Project scaffold + app window

**Files:**
- Create: `package.json`
- Create: `main.js`
- Create: `index.html`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable Electron app (`npm start`) showing a window with a button (`id="ambil"`) and a status element (`id="status"`). The renderer calls `ipcRenderer.invoke('scrape')` on click (handler added in Task 4).

- [ ] **Step 1: Initialize git and ignore node_modules**

```bash
git init
printf "node_modules/\n*.pdf\n" > .gitignore
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "tombolemas",
  "version": "1.0.0",
  "description": "One-button gold price PDF from logammulia.com",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "test": "node --test"
  },
  "devDependencies": {
    "electron": "^31.0.0"
  }
}
```

- [ ] **Step 3: Install Electron**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>TombolEmas</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; margin-top: 60px; }
    h1 { font-size: 22px; }
    button { font-size: 20px; padding: 16px 28px; cursor: pointer; }
    button:disabled { opacity: .5; cursor: default; }
    #status { margin-top: 20px; color: #555; min-height: 1.4em; }
  </style>
</head>
<body>
  <h1>TombolEmas</h1>
  <button id="ambil">Ambil Harga Emas</button>
  <div id="status">Tekan tombol untuk mengambil harga emas hari ini</div>
  <script>
    const { ipcRenderer } = require('electron');
    const btn = document.getElementById('ambil');
    const status = document.getElementById('status');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      status.textContent = 'Mengambil data…';
      try {
        const savedPath = await ipcRenderer.invoke('scrape');
        status.textContent = savedPath
          ? 'PDF tersimpan ✓ (' + savedPath + ')'
          : 'Dibatalkan';
      } catch (err) {
        status.textContent = 'Gagal mengambil data, coba lagi';
        console.error(err);
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 5: Create `main.js` (window only for now)**

```js
const { app, BrowserWindow } = require('electron');

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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 6: Run the app**

Run: `npm start`
Expected: a window opens titled "TombolEmas" with a button. Clicking it shows "Gagal mengambil data, coba lagi" (no handler yet — expected). Close the window.

- [ ] **Step 7: Commit**

```bash
git add package.json main.js index.html .gitignore
git commit -m "feat: scaffold TombolEmas Electron app window"
```

---

### Task 2: Price normalization module (pure logic, TDD)

**Files:**
- Create: `normalize.js`
- Create: `test/normalize.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseRupiah(str) -> number` — strips non-digits, returns integer rupiah or `NaN`.
  - `normalizePrices(raw) -> { table: [{berat: string, jual: number}], buyback: number, tanggal: string }` where `raw = { rows: [{berat, jual}], buyback, tanggal }`. Throws `Error('Data harga tidak lengkap')` if no valid rows or buyback.

- [ ] **Step 1: Write the failing test**

```js
// test/normalize.test.js
const test = require('node:test');
const assert = require('node:assert');
const { parseRupiah, normalizePrices } = require('../normalize');

test('parseRupiah strips currency formatting', () => {
  assert.strictEqual(parseRupiah('Rp 1.234.567'), 1234567);
  assert.strictEqual(parseRupiah('1.055.000,-'), 1055000);
  assert.ok(Number.isNaN(parseRupiah('')));
  assert.ok(Number.isNaN(parseRupiah('-')));
});

test('normalizePrices builds clean structured data', () => {
  const raw = {
    rows: [
      { berat: ' 1 gr ', jual: 'Rp 1.055.000' },
      { berat: '5 gr', jual: '5.250.000' },
      { berat: 'kosong', jual: 'n/a' }, // dropped: jual not numeric
    ],
    buyback: 'Rp 950.000',
    tanggal: ' 1 Juli 2026 ',
  };
  const out = normalizePrices(raw);
  assert.deepStrictEqual(out.table, [
    { berat: '1 gr', jual: 1055000 },
    { berat: '5 gr', jual: 5250000 },
  ]);
  assert.strictEqual(out.buyback, 950000);
  assert.strictEqual(out.tanggal, '1 Juli 2026');
});

test('normalizePrices throws when data incomplete', () => {
  assert.throws(
    () => normalizePrices({ rows: [], buyback: 'Rp 1', tanggal: '' }),
    /Data harga tidak lengkap/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/normalize.test.js`
Expected: FAIL — cannot find module `../normalize`.

- [ ] **Step 3: Write `normalize.js`**

```js
// ponytail: prices are whole rupiah, so stripping every non-digit is safe.
// If the source ever shows ",xx" decimals, revisit before the strip corrupts them.
function parseRupiah(str) {
  const digits = String(str).replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : NaN;
}

function normalizePrices(raw) {
  const table = (raw.rows || [])
    .map((r) => ({ berat: String(r.berat).trim(), jual: parseRupiah(r.jual) }))
    .filter((r) => r.berat && Number.isFinite(r.jual));
  const buyback = parseRupiah(raw.buyback);
  if (table.length === 0 || !Number.isFinite(buyback)) {
    throw new Error('Data harga tidak lengkap');
  }
  return { table, buyback, tanggal: String(raw.tanggal || '').trim() };
}

module.exports = { parseRupiah, normalizePrices };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/normalize.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add normalize.js test/normalize.test.js
git commit -m "feat: add price normalization with tests"
```

---

### Task 3: Report HTML builder (pure logic, TDD)

**Files:**
- Create: `report.js`
- Create: `test/report.test.js`

**Interfaces:**
- Consumes: the shape produced by `normalizePrices` — `{ table: [{berat, jual}], buyback, tanggal }`.
- Produces:
  - `formatRupiah(n) -> string` — e.g. `1234567 -> "Rp 1.234.567"` (Indonesian grouping).
  - `buildReportHtml(data) -> string` — a full self-contained HTML document string for the PDF.

- [ ] **Step 1: Write the failing test**

```js
// test/report.test.js
const test = require('node:test');
const assert = require('node:assert');
const { formatRupiah, buildReportHtml } = require('../report');

test('formatRupiah groups with dots', () => {
  assert.strictEqual(formatRupiah(1234567), 'Rp 1.234.567');
  assert.strictEqual(formatRupiah(950000), 'Rp 950.000');
});

test('buildReportHtml embeds date, rows, and buyback', () => {
  const html = buildReportHtml({
    table: [
      { berat: '1 gr', jual: 1055000 },
      { berat: '5 gr', jual: 5250000 },
    ],
    buyback: 950000,
    tanggal: '1 Juli 2026',
  });
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /1 Juli 2026/);
  assert.match(html, /1 gr/);
  assert.match(html, /Rp 1\.055\.000/);
  assert.match(html, /Rp 5\.250\.000/);
  assert.match(html, /Rp 950\.000/); // buyback
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/report.test.js`
Expected: FAIL — cannot find module `../report`.

- [ ] **Step 3: Write `report.js`**

```js
function formatRupiah(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function buildReportHtml({ table, buyback, tanggal }) {
  const rows = table
    .map(
      (r) =>
        `<tr><td>${r.berat}</td><td class="num">${formatRupiah(r.jual)}</td></tr>`
    )
    .join('\n');
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #222; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .date { color: #666; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  .num { text-align: right; }
  .buyback { margin-top: 16px; font-weight: bold; }
</style></head><body>
  <h1>Harga Emas Antam — Logam Mulia</h1>
  <div class="date">${tanggal}</div>
  <table>
    <thead><tr><th>Berat</th><th class="num">Harga Jual</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <div class="buyback">Buyback / Harga Beli: ${formatRupiah(buyback)} / gram</div>
</body></html>`;
}

module.exports = { formatRupiah, buildReportHtml };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/report.test.js`
Expected: PASS (2 tests). If `formatRupiah` grouping fails, the Node build lacks full ICU — install Node 20+ (full ICU by default) and re-run.

- [ ] **Step 5: Commit**

```bash
git add report.js test/report.test.js
git commit -m "feat: add PDF report HTML builder with tests"
```

---

### Task 4: Scrape logammulia in a hidden window

**Files:**
- Create: `scrape.js`
- Modify: `main.js` (add the `scrape` IPC handler wiring)

**Interfaces:**
- Consumes: `normalizePrices` from `normalize.js`.
- Produces: `scrapePrices() -> Promise<{ table, buyback, tanggal }>` (normalized). Opens a hidden `BrowserWindow`, loads the source URL, extracts raw rows from the DOM, normalizes, and returns. Throws on load failure or missing data.

**Note on selectors (from spec's open item):** the exact DOM selectors cannot be verified from the build environment (Akamai blocks non-browser requests). The in-page extraction below is a defensive best-effort that scans price tables generically; Step 4 verifies and pins it against the live page on the operator's laptop.

- [ ] **Step 1: Create `scrape.js`**

```js
const { BrowserWindow } = require('electron');
const { normalizePrices } = require('./normalize');

const URL = 'https://www.logammulia.com/id/harga-emas-hari-ini';

// Runs INSIDE the loaded page. Returns raw (string) values; normalize.js cleans them.
// ponytail: generic table scan — pins to real selectors after inspecting the live DOM.
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
```

- [ ] **Step 2: Wire the IPC handler in `main.js`**

Replace the entire contents of `main.js` with:

```js
const { app, BrowserWindow, ipcMain } = require('electron');
const { scrapePrices } = require('./scrape');

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 320,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadFile('index.html');
}

// Temporary handler for this task: scrape and log. PDF/save added in Task 5.
ipcMain.handle('scrape', async () => {
  const data = await scrapePrices();
  console.log('SCRAPED:', JSON.stringify(data, null, 2));
  return null; // no file saved yet
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 3: Run the app and trigger a scrape**

Run: `npm start`, click "Ambil Harga Emas", watch the terminal.
Expected: terminal prints `SCRAPED:` with a `table` of weight rows, a `buyback` number, and a `tanggal`. UI shows "Dibatalkan" (because the handler returns null — expected this task).

- [ ] **Step 4: Verify and pin selectors (manual, on the live page)**

If the scraped `table` is empty or wrong:
1. Temporarily set `show: true` in `scrape.js` and add `win.webContents.openDevTools()` after `loadURL`.
2. Inspect the real price table markup on logammulia.
3. Adjust the `EXTRACT` querySelector(s) and the buyback/date regexes to match the actual DOM.
4. Revert `show` to `false` and remove `openDevTools`.
Re-run Step 3 until the printed data is correct.

- [ ] **Step 5: Commit**

```bash
git add scrape.js main.js
git commit -m "feat: scrape logammulia prices in hidden window"
```

---

### Task 5: Render PDF and save

**Files:**
- Modify: `main.js` (replace the temporary `scrape` handler with the full render + save flow)

**Interfaces:**
- Consumes: `scrapePrices` from `scrape.js`, `buildReportHtml` from `report.js`.
- Produces: the final `scrape` IPC handler — returns the saved file path (string) on success, `null` if the user cancels the Save dialog; throws on scrape/render failure (renderer shows the error).

- [ ] **Step 1: Replace `main.js` with the full flow**

```js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const { scrapePrices } = require('./scrape');
const { buildReportHtml } = require('./report');

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 320,
    webPreferences: {
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
```

- [ ] **Step 2: Run the full flow (success path)**

Run: `npm start`, click the button.
Expected: after ~2-3s a Save dialog appears defaulting to `Harga-Emas-YYYY-MM-DD.pdf`. Save it, then open the PDF: it shows the title, date, the full weight table with rupiah-formatted jual prices, and the buyback line. UI shows "PDF tersimpan ✓".

- [ ] **Step 3: Verify the failure path (no partial PDF)**

Turn off Wi-Fi, run `npm start`, click the button.
Expected: no Save dialog, no file written; UI shows "Gagal mengambil data, coba lagi". Turn Wi-Fi back on.

- [ ] **Step 4: Verify the cancel path**

Run `npm start`, click the button, then press Cancel in the Save dialog.
Expected: no file written; UI shows "Dibatalkan".

- [ ] **Step 5: Commit**

```bash
git add main.js
git commit -m "feat: render report to PDF and save via dialog"
```

---

## Self-Review

**Spec coverage:**
- Desktop app, one window, one button → Task 1. ✓
- Electron / Chromium beats Akamai → Task 4 (hidden window `loadURL`). ✓
- Source URL → Global Constraints + Task 4. ✓
- Extract full weight table + buyback + date → Task 4 `EXTRACT` + Task 2 normalize. ✓
- Self-designed PDF (table + buyback + date) → Task 3 + Task 5. ✓
- Save dialog with dated default name → Task 5. ✓
- Status states (idle/working/success/failure) → Task 1 `index.html`. ✓
- Never write partial/empty PDF → Task 5 (write only after success; failure/cancel paths tested). ✓
- Only dependency is electron; stdlib tests → package.json + `node:test`. ✓
- Out of scope (no scheduling/history/WhatsApp) → nothing added. ✓
- Open item (selectors) → Task 4 Step 4 explicit verification. ✓

**Placeholder scan:** No TBD/TODO left in code. The one deliberate open item (selectors) has a concrete verification procedure, not a placeholder.

**Type consistency:** `normalizePrices` output `{table:[{berat,jual}], buyback, tanggal}` is consumed unchanged by `buildReportHtml` and `scrapePrices`. `scrape` IPC returns `string | null`; renderer handles both plus thrown errors. Consistent across tasks.

## Notes / Deviations from spec

- Spec listed a static `report.html`; the plan uses a `report.js` `buildReportHtml(data)` function instead, because the template needs data injected and this makes it unit-testable. Same output, one fewer moving part.
- Packaging to a standalone `.exe` (electron-builder) remains out of scope per spec; `npm start` launches the app. Add later if you want a double-click icon.
