// api/prices.js — Vercel Serverless Function
// Fetch real stock prices from Yahoo Finance (no API key needed)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const symbols = ['NVDA', 'TSLA', 'AMD', 'PLTR', 'COIN', 'SOFI', 'MARA', 'SMCI'];
  const query = symbols.join('%2C');

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${query}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,regularMarketDayHigh,regularMarketDayLow,regularMarketOpen,fiftyTwoWeekHigh,fiftyTwoWeekLow,regularMarketPreviousClose`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`Yahoo Finance error: ${response.status}`);

    const data = await response.json();
    const quotes = data.quoteResponse?.result || [];

    const prices = {};
    quotes.forEach(q => {
      prices[q.symbol] = {
        price: q.regularMarketPrice,
        change: q.regularMarketChange,
        changePct: q.regularMarketChangePercent / 100,
        volume: q.regularMarketVolume,
        high: q.regularMarketDayHigh,
        low: q.regularMarketDayLow,
        open: q.regularMarketOpen,
        prevClose: q.regularMarketPreviousClose,
        week52High: q.fiftyTwoWeekHigh,
        week52Low: q.fiftyTwoWeekLow,
        timestamp: Date.now(),
      };
    });

    // Convert USD to EUR (approximate — ECB rate)
    const fxUrl = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';
    let eurRate = 0.92; // fallback
    try {
      const fxRes = await fetch(fxUrl);
      const fxData = await fxRes.json();
      eurRate = fxData.usd?.eur || 0.92;
    } catch (_) {}

    Object.keys(prices).forEach(sym => {
      const p = prices[sym];
      p.priceEur = +(p.price * eurRate).toFixed(2);
      p.changeEur = +(p.change * eurRate).toFixed(2);
      p.eurRate = eurRate;
    });

    res.status(200).json({ success: true, prices, marketOpen: isMarketOpen(), timestamp: Date.now() });
  } catch (err) {
    console.error('prices.js error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

function isMarketOpen() {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = nyTime.getDay(); // 0=Sun, 6=Sat
  const hour = nyTime.getHours();
  const min = nyTime.getMinutes();
  const totalMin = hour * 60 + min;
  // NYSE: Mon-Fri 9:30-16:00 ET
  return day >= 1 && day <= 5 && totalMin >= 570 && totalMin < 960;
}
