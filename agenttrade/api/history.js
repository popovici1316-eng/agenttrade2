// api/history.js — Vercel Serverless Function
// Fetch 90-day OHLCV history from Yahoo Finance

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { sym = 'NVDA', days = 90 } = req.query;
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - parseInt(days) * 86400;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?period1=${period1}&period2=${period2}&interval=1d&events=history`;

    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    });
    if (!r.ok) throw new Error(`Yahoo error ${r.status}`);

    const data = await r.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error('No data');

    const timestamps = result.timestamp || [];
    const ohlcv = result.indicators?.quote?.[0] || {};

    const history = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString(),
      open: +(ohlcv.open?.[i] || 0).toFixed(2),
      high: +(ohlcv.high?.[i] || 0).toFixed(2),
      low: +(ohlcv.low?.[i] || 0).toFixed(2),
      close: +(ohlcv.close?.[i] || 0).toFixed(2),
      volume: ohlcv.volume?.[i] || 0,
    })).filter(d => d.close > 0);

    // Convert to EUR
    let eurRate = 0.92;
    try {
      const fxRes = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
      const fxData = await fxRes.json();
      eurRate = fxData.usd?.eur || 0.92;
    } catch (_) {}

    const historyEur = history.map(d => ({
      ...d,
      open: +(d.open * eurRate).toFixed(2),
      high: +(d.high * eurRate).toFixed(2),
      low: +(d.low * eurRate).toFixed(2),
      close: +(d.close * eurRate).toFixed(2),
    }));

    res.status(200).json({ success: true, sym, history: historyEur, eurRate });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
