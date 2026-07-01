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
