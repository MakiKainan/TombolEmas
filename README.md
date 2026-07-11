# TombolEmas

A single-button Electron app that fetches today's Antam gold prices from
[logammulia.com](https://www.logammulia.com/id/harga-emas-hari-ini) and saves
them as PDF.

## Output

A one-page PDF with the day's price table by weight, the buyback price, and
the date — named `Harga-Emas-YYYY-MM-DD.pdf` by default.

## How to run

```
npm install
npm start
```

Click the button. Choose where to save. Done.

## Requirements

- Node.js
- Internet connection (to reach logammulia.com)
