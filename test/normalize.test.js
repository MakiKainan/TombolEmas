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
