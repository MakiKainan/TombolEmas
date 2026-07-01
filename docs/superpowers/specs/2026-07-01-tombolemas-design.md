# TombolEmas — Design

**Date:** 2026-07-01
**Status:** Approved

## Goal

A desktop app on the operator's Windows laptop. Press one button; the app scrapes
today's gold prices from logammulia.com and produces a formatted PDF report saved
to the computer. No sending, no scheduling — a manual, on-demand tool.

## Decisions

- **Shape:** Desktop app, double-clickable, single window with one button.
- **Stack:** Electron. Chromium is built in and serves all three needs — it loads
  the source page as a real browser (passing Akamai bot protection), and its native
  `printToPDF` renders the report. No Puppeteer, no second browser download.
- **Source:** `https://www.logammulia.com/id/harga-emas-hari-ini`.
- **PDF content:** A clean, self-designed report (option A) containing the **full
  weight table** (0.5g … 100g jual prices), the **buyback** price, and the **date**.
- **No WhatsApp, no scheduling, no history.**

## Why Electron (context)

logammulia.com sits behind Akamai bot protection. Plain HTTP scraping
(`axios`/`curl`) returns `403 Forbidden` even with browser headers — verified
2026-07-01. A real Chromium instance is required to load the page. Electron bundles
Chromium, so the same runtime provides the scraping browser, the app window, and
PDF rendering from one dependency.

## UI

One small window (`index.html`):
- Title: "TombolEmas"
- One large button: "Ambil Harga Emas"
- A status line that reflects state:
  - idle → "Tekan tombol untuk mengambil harga emas hari ini"
  - working → "Mengambil data…"
  - success → "PDF tersimpan ✓"
  - failure → "Gagal mengambil data, coba lagi"

## Flow (on button press)

```
button click
  → main process opens a HIDDEN BrowserWindow
  → load logammulia URL (real Chromium → passes Akamai)
  → wait for the price table to render
  → extract { table: [{weight, hargaJual}...], buyback, tanggal } from the DOM
  → fill report.html template with the data
  → render template to PDF via webContents.printToPDF()
  → show Save dialog (default name: Harga-Emas-YYYY-MM-DD.pdf)
  → update status to success
```

## PDF Report (report.html template)

- Header: "Harga Emas Antam — Logam Mulia" + date (`tanggal`).
- A table: two columns — Berat (weight) | Harga Jual (Rp).
- A line below the table: Buyback / Harga Beli: Rp {buyback} / gram.
- Simple, print-friendly styling. No page branding/ads copied from source.

## Error Handling

- Page fails to load / times out → status "Gagal…", no PDF produced.
- Akamai block or unexpected page → same; log details to the console/log for
  diagnosis.
- Price table not found in the DOM (selectors changed) → treat as failure, no PDF.
- Never write a partial or empty PDF.

## Files

- `main.js` — Electron main process: window, scrape, PDF render, save dialog
- `index.html` — button UI + status
- `report.html` — PDF report template
- `package.json` — dependency: `electron`

## Out of Scope (YAGNI)

No scheduling/auto-run, no price history or storage, no settings screen, no
auto-update, no WhatsApp/sending. Packaging to a standalone `.exe` (electron-builder)
is optional and can be added later; running via `npm start` is enough to start.

## Open Item (resolve at build time)

Exact DOM selectors for logammulia's price table cannot be verified from this
environment (Akamai blocks non-browser requests here). They will be pinned by
testing the scraper on the operator's laptop, where the page loads normally.
The extractor will be written defensively and fail cleanly if selectors don't match.
