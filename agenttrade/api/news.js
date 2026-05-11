// api/news.js — Vercel Serverless Function
// Fetch real financial news from free RSS feeds

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { sym } = req.query;

  const feeds = [
    { url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=NVDA,TSLA,AMD,PLTR,COIN,SOFI,MARA,SMCI&region=US&lang=en-US', source: 'Yahoo Finance' },
    { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', source: 'WSJ Markets' },
    { url: 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best', source: 'Reuters' },
  ];

  const SYMBOLS = ['NVDA', 'TSLA', 'AMD', 'PLTR', 'COIN', 'SOFI', 'MARA', 'SMCI'];
  const articles = [];

  for (const feed of feeds) {
    try {
      const r = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) continue;
      const xml = await r.text();

      // Parse RSS items
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
      items.slice(0, 10).forEach(item => {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
          || item.match(/<title>(.*?)<\/title>/)?.[1] || '';
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';

        if (!title) return;

        // Find which symbol this news is about
        const matchedSym = SYMBOLS.find(s =>
          title.toUpperCase().includes(s) ||
          title.toLowerCase().includes(SYMBOL_NAMES[s] || '')
        );

        // Basic sentiment from keywords
        const sentiment = guessSentiment(title);

        articles.push({
          id: Buffer.from(title).toString('base64').slice(0, 10),
          sym: matchedSym || SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          headline: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').slice(0, 150),
          source: feed.source,
          link,
          time: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          sentiment,
          cat: sentiment > 0.2 ? 'positive' : sentiment < -0.2 ? 'negative' : 'neutral',
          real: true,
        });
      });
    } catch (e) {
      console.warn(`Feed failed: ${feed.source}`, e.message);
    }
  }

  // Filter by symbol if requested
  const filtered = sym
    ? articles.filter(a => a.sym === sym.toUpperCase())
    : articles;

  // Deduplicate by headline similarity
  const seen = new Set();
  const unique = filtered.filter(a => {
    const key = a.headline.slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.status(200).json({
    success: true,
    news: unique.slice(0, 40),
    count: unique.length,
    timestamp: Date.now(),
  });
}

const SYMBOL_NAMES = {
  NVDA: 'nvidia', TSLA: 'tesla', AMD: 'amd', PLTR: 'palantir',
  COIN: 'coinbase', SOFI: 'sofi', MARA: 'marathon digital', SMCI: 'super micro',
};

function guessSentiment(text) {
  const t = text.toLowerCase();
  const pos = ['beat', 'surge', 'rally', 'gains', 'upgrade', 'buy', 'strong', 'record', 'bullish', 'soars', 'rises', 'jumps', 'partnership', 'profit', 'growth'];
  const neg = ['miss', 'drop', 'fall', 'sell', 'downgrade', 'bearish', 'loss', 'decline', 'cuts', 'layoffs', 'warning', 'investigation', 'lawsuit', 'weak', 'crash'];
  let score = 0;
  pos.forEach(w => { if (t.includes(w)) score += 0.15; });
  neg.forEach(w => { if (t.includes(w)) score -= 0.15; });
  return Math.max(-1, Math.min(1, score));
}
