export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const symbols = ['NVDA','TSLA','AMD','PLTR','COIN','SOFI','MARA','SMCI'];
  try {
    const results = await Promise.allSettled(symbols.map(sym =>
      fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=2d`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://finance.yahoo.com',
        },
      }).then(r => r.json())
    ));
    let eurRate = 0.92;
    try {
      const fx = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
      eurRate = (await fx.json()).usd?.eur || 0.92;
    } catch(_) {}
    const prices = {};
    results.forEach((r, i) => {
      if (r.status !== 'fulfilled') return;
      try {
        const meta = r.value.chart?.result?.[0]?.meta;
        if (!meta) return;
        const price = meta.regularMarketPrice || meta.previousClose;
        const prev = meta.previousClose || price;
        prices[symbols[i]] = {
          price, change: price-prev, changePct: (price-prev)/prev,
          volume: meta.regularMarketVolume||0,
          high: meta.regularMarketDayHigh||price,
          low: meta.regularMarketDayLow||price,
          open: meta.regularMarketOpen||price,
          prevClose: prev,
          priceEur: +(price*eurRate).toFixed(2),
          changeEur: +((price-prev)*eurRate).toFixed(2),
          eurRate, timestamp: Date.now(),
        };
      } catch(_) {}
    });
    if (!Object.keys(prices).length) throw new Error('No data');
    res.status(200).json({ success:true, prices, marketOpen:isMarketOpen(), timestamp:Date.now() });
  } catch(err) {
    res.status(500).json({ success:false, error:err.message });
  }
}
function isMarketOpen() {
  const ny = new Date(new Date().toLocaleString('en-US',{timeZone:'America/New_York'}));
  const t = ny.getHours()*60+ny.getMinutes();
  return ny.getDay()>=1 && ny.getDay()<=5 && t>=570 && t<960;
}
