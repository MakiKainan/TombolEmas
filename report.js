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
