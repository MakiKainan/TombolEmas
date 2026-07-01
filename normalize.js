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
