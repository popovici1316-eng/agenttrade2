import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════
// AGENTTRADE — Real Market Data | Paper Trading Demo
// Yahoo Finance prices | Claude AI news analysis
// ═══════════════════════════════════════════════════════════

const fmt = (n, d = 2) => Number(n).toFixed(d);
const fmtE = (n) => `€${Number(n).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)}%`;
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const ASSETS = {
  NVDA: { name: "NVIDIA Corp.", vol: 0.035, desc: "GPU + AI chips lider mondial" },
  TSLA: { name: "Tesla Inc.", vol: 0.04, desc: "EV + energie + robotică" },
  AMD: { name: "AMD Inc.", vol: 0.032, desc: "Procesoare + GPU competiție NVDA" },
  PLTR: { name: "Palantir Tech.", vol: 0.038, desc: "AI enterprise + contracte gov." },
  COIN: { name: "Coinbase Global", vol: 0.045, desc: "Bursă crypto, corelat cu BTC" },
  SOFI: { name: "SoFi Technologies", vol: 0.042, desc: "Fintech + banking digital" },
  MARA: { name: "Marathon Digital", vol: 0.055, desc: "Mining Bitcoin, ultra-volatil" },
  SMCI: { name: "Super Micro Comp.", vol: 0.05, desc: "Servere AI infrastructure" },
};

// ── Technical Indicators ──
function sma(d, n) { return d.map((_, i) => i < n - 1 ? null : d.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n); }
function ema(d, n) { const k = 2 / (n + 1); const r = [d[0]]; for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k)); return r; }
function rsiCalc(c, n = 14) {
  const r = new Array(c.length).fill(null); if (c.length < n + 1) return r;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
  let ag = g / n, al = l / n;
  r[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; ag = (ag * (n - 1) + Math.max(d, 0)) / n; al = (al * (n - 1) + Math.max(-d, 0)) / n; r[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); }
  return r;
}
function macdCalc(c) { const e12 = ema(c, 12), e26 = ema(c, 26), line = e12.map((v, i) => v - e26[i]), sig = ema(line, 9); return { line, signal: sig, hist: line.map((v, i) => v - sig[i]) }; }
function bollingerCalc(c, n = 20, sd = 2) {
  const m = sma(c, n);
  return m.map((mid, i) => { if (!mid) return null; const sl = c.slice(Math.max(0, i - n + 1), i + 1); const std = Math.sqrt(sl.reduce((a, v) => a + (v - mid) ** 2, 0) / sl.length); return { u: mid + sd * std, m: mid, l: mid - sd * std }; });
}

function analyze(history) {
  if (!history || history.length < 20) return null;
  const closes = history.map(h => h.close), L = closes.length - 1, price = closes[L];
  const rsiV = rsiCalc(closes), macdV = macdCalc(closes), bb = bollingerCalc(closes);
  const sma10 = sma(closes, 10), sma20 = sma(closes, 20);
  const tScore = (() => { let s = 0; if (sma10[L] && sma20[L]) { s += sma10[L] > sma20[L] ? 2 : -2; s += price > sma10[L] ? 1 : -1; } if (macdV.hist[L] > 0) s += 1; else s -= 1; return s; })();
  const mrScore = (() => { let s = 0; if (rsiV[L] !== null) { if (rsiV[L] < 30) s += 3; else if (rsiV[L] < 40) s += 1; else if (rsiV[L] > 70) s -= 3; else if (rsiV[L] > 60) s -= 1; } if (bb[L]) { if (price < bb[L].l) s += 2; if (price > bb[L].u) s -= 2; } return s; })();
  const mom3 = L >= 3 ? (closes[L] - closes[L - 3]) / closes[L - 3] : 0;
  const mom10 = L >= 10 ? (closes[L] - closes[L - 10]) / closes[L - 10] : 0;
  const volR = history[L].volume / (history.slice(-10).reduce((a, h) => a + h.volume, 0) / 10);
  const momScore = (() => { let s = 0; if (mom3 > 0.03) s += 2; else if (mom3 > 0.01) s += 1; else if (mom3 < -0.03) s -= 2; else if (mom3 < -0.01) s -= 1; if (mom10 > 0.05) s += 1; else if (mom10 < -0.05) s -= 1; if (volR > 1.5 && mom3 > 0) s += 1; return s; })();
  const mk = (name, score, max) => ({ name, score, signal: score >= 2 ? "BUY" : score <= -2 ? "SELL" : "HOLD", confidence: clamp(Math.abs(score) / max, 0, 1) });
  const total = tScore + mrScore + momScore;
  return {
    strategies: {
      trend: { ...mk("Trend", tScore, 4), reason: `SMA10${sma10[L] > sma20[L] ? ">" : "<"}SMA20 MACD${macdV.hist[L] > 0 ? "+" : "-"}` },
      meanRev: { ...mk("Mean Rev.", mrScore, 5), reason: `RSI:${rsiV[L] ? fmt(rsiV[L], 0) : "—"} BB:${bb[L] ? (price < bb[L].l ? "↓sub" : price > bb[L].u ? "↑supra" : "ok") : "—"}` },
      momentum: { ...mk("Momentum", momScore, 4), reason: `3d:${pct(mom3)} Vol:${fmt(volR, 1)}x` },
      combined: { score: total, signal: total >= 3 ? "STRONG BUY" : total >= 1 ? "BUY" : total <= -3 ? "STRONG SELL" : total <= -1 ? "SELL" : "HOLD", confidence: clamp(Math.abs(total) / 8, 0, 1) },
    },
    ind: { rsi: rsiV[L], macd: macdV.hist[L], sma10: sma10[L], sma20: sma20[L], bb: bb[L], mom3, mom10, volR },
  };
}

// ── Components ──
function Spark({ data, w = 100, h = 28, color = "#4ade80" }) {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  return <svg width={w} height={h} style={{ display: "block" }}><polyline points={data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / rng) * h}`).join(" ")} fill="none" stroke={color} strokeWidth="1.5" /></svg>;
}

const SC = { "STRONG BUY": ["#064e3b", "#6ee7b7", "#10b981"], BUY: ["#052e16", "#4ade80", "#22c55e"], HOLD: ["#1c1917", "#a8a29e", "#57534e"], SELL: ["#450a0a", "#fca5a5", "#ef4444"], "STRONG SELL": ["#7f1d1d", "#fecaca", "#dc2626"] };
function Badge({ s, big }) { const c = SC[s] || SC.HOLD; return <span style={{ padding: big ? "3px 12px" : "2px 7px", borderRadius: 3, fontSize: big ? 12 : 9.5, fontWeight: 700, background: c[0], color: c[1], border: `1px solid ${c[2]}` }}>{s}</span>; }
function SentDot({ v }) {
  if (v === null || v === undefined) return <span style={{ color: "#57534e", fontSize: 9 }}>⏳</span>;
  return <span style={{ color: v > 0.2 ? "#4ade80" : v < -0.2 ? "#f87171" : "#facc15", fontSize: 9.5, fontWeight: 600 }}>{v > 0 ? "▲" : v < 0 ? "▼" : "●"} {v > 0.2 ? "Bullish" : v < -0.2 ? "Bearish" : "Neutru"} ({fmt(v * 100, 0)}%)</span>;
}

function StatusBar({ marketOpen, lastUpdate, loading, error }) {
  const G = "#4ade80", R = "#f87171", Y = "#facc15";
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 9, padding: "4px 18px", background: "#111114", borderBottom: "1px solid #1a1a1f" }}>
      <span style={{ color: marketOpen ? G : Y }}>
        <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: marketOpen ? G : Y, marginRight: 4 }} />
        {marketOpen ? "NYSE DESCHIS" : "NYSE ÎNCHIS (pre/after hours)"}
      </span>
      {loading && <span style={{ color: Y, animation: "pulse 1s infinite" }}>⟳ Actualizare...</span>}
      {error && <span style={{ color: R }}>⚠ {error}</span>}
      {lastUpdate && !loading && <span style={{ color: "#555" }}>Actualizat: {new Date(lastUpdate).toLocaleTimeString()}</span>}
      <span style={{ color: "#333", marginLeft: "auto" }}>Date reale · Yahoo Finance · EUR</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
export default function App() {
  const INITIAL_CASH = 100;
  const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

  const [mkt, setMkt] = useState({});       // sym → history array
  const [liveP, setLiveP] = useState({});   // sym → live price data
  const [anal, setAnal] = useState({});
  const [port, setPort] = useState({ cash: INITIAL_CASH, pos: {}, hist: [] });
  const [trades, setTrades] = useState([]);
  const [news, setNews] = useState([]);
  const [sentScores, setSentScores] = useState({});
  const [tab, setTab] = useState("dash");
  const [sel, setSel] = useState("NVDA");
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [aiProc, setAiProc] = useState(false);
  const [aiLog, setAiLog] = useState([]);
  const [risk, setRisk] = useState({ maxPosPct: 0.35, stopLoss: 0.06, trailStop: true, newsW: 0.4, maxOpen: 3 });
  const [strat, setStrat] = useState({ trend: true, meanRev: true, momentum: true, newsAI: true });
  const [log, setLog] = useState([]);
  const [marketOpen, setMarketOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [priceError, setPriceError] = useState(null);
  const [dailyPnL, setDailyPnL] = useState([]);

  const intRef = useRef(null);
  const priceIntRef = useRef(null);
  const newsQ = useRef([]);
  const portRef = useRef(port);
  const mktRef = useRef(mkt);
  const sentRef = useRef(sentScores);
  const analRef = useRef(anal);
  const riskRef = useRef(risk);
  const stratRef = useRef(strat);
  const livePRef = useRef(liveP);

  useEffect(() => { portRef.current = port; }, [port]);
  useEffect(() => { mktRef.current = mkt; }, [mkt]);
  useEffect(() => { sentRef.current = sentScores; }, [sentScores]);
  useEffect(() => { analRef.current = anal; }, [anal]);
  useEffect(() => { riskRef.current = risk; }, [risk]);
  useEffect(() => { stratRef.current = strat; }, [strat]);
  useEffect(() => { livePRef.current = liveP; }, [liveP]);

  const addLog = useCallback((msg, type = "info") => setLog(p => [{ time: new Date(), msg, type, id: uid() }, ...p].slice(0, 300)), []);

  // ── Fetch real prices ──
  const fetchPrices = useCallback(async () => {
    setLoadingPrices(true);
    setPriceError(null);
    try {
      const res = await fetch('/api/prices');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setLiveP(data.prices);
      setMarketOpen(data.marketOpen);
      setLastUpdate(data.timestamp);

      // Update history arrays with new real price point
      setMkt(prev => {
        const next = { ...prev };
        Object.entries(data.prices).forEach(([sym, p]) => {
          const hist = prev[sym] || [];
          const newPoint = {
            date: new Date(),
            open: p.open * p.eurRate,
            high: p.high * p.eurRate,
            low: p.low * p.eurRate,
            close: p.priceEur,
            volume: p.volume,
          };
          const updated = [...hist, newPoint].slice(-200);
          next[sym] = updated;
        });
        return next;
      });

      addLog(`📊 Prețuri reale actualizate — ${Object.keys(data.prices).length} simboluri`, "system");
    } catch (err) {
      setPriceError(err.message);
      addLog(`⚠ Eroare prețuri: ${err.message}`, "loss");
    } finally {
      setLoadingPrices(false);
    }
  }, [addLog]);

  // ── Fetch history for a symbol ──
  const fetchHistory = useCallback(async (sym) => {
    try {
      const res = await fetch(`/api/history?sym=${sym}&days=90`);
      const data = await res.json();
      if (!data.success) return;
      setMkt(prev => ({ ...prev, [sym]: data.history }));
      setAnal(prev => ({ ...prev, [sym]: analyze(data.history) }));
    } catch (e) {
      console.warn(`History fetch failed for ${sym}:`, e);
    }
  }, []);

  // ── Fetch real news ──
  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      if (!data.success) return;
      setNews(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const newItems = data.news
          .filter(n => !existingIds.has(n.id))
          .map(n => ({ ...n, analyzed: false, aiSent: null, aiText: null, aiAction: null }));
        newItems.forEach(item => newsQ.current.push(item));
        return [...newItems, ...prev].slice(0, 150);
      });
    } catch (e) {
      console.warn('News fetch failed:', e);
    }
  }, []);

  // ── Init: load history for all symbols ──
  useEffect(() => {
    const init = async () => {
      addLog("🔄 Se încarcă date istorice reale...", "system");
      await Promise.all(Object.keys(ASSETS).map(sym => fetchHistory(sym)));
      await fetchPrices();
      await fetchNews();
      addLog("✅ Date inițializate — piață reală", "system");
    };
    init();
  }, []);

  // ── Recalculate analysis when mkt changes ──
  useEffect(() => {
    const newAnal = {};
    Object.entries(mkt).forEach(([sym, hist]) => {
      if (hist && hist.length >= 20) newAnal[sym] = analyze(hist);
    });
    if (Object.keys(newAnal).length > 0) setAnal(newAnal);
  }, [mkt]);

  // ── AI News Analysis ──
  const analyzeWithAI = useCallback(async (item) => {
    try {
      setAiProc(true);
      const lp = livePRef.current[item.sym];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          messages: [{ role: "user", content: `Ești analist financiar expert specializat pe acțiuni volatile. Analizează această știre REALĂ pentru un trader cu buget mic (100€) care face swing trading pe termen scurt (1-5 zile).

Știre: "${item.headline}"
Sursă: ${item.source}
Acțiune: ${item.sym} — ${ASSETS[item.sym]?.desc || ""}
Preț actual real: ${lp ? `€${lp.priceEur} (${lp.changePct >= 0 ? "+" : ""}${(lp.changePct * 100).toFixed(2)}% azi)` : "necunoscut"}

Răspunde DOAR cu JSON valid (fără text extra):
{
  "sentiment": <-1.0 la 1.0>,
  "confidence": <0 la 1>,
  "action": "<BUY|SELL|HOLD>",
  "reasoning": "<max 2 propoziții în română>",
  "urgency": "<imediat|în curând|poate aștepta>",
  "riskLevel": "<scăzut|mediu|ridicat>"
}` }],
        }),
      });
      const data = await res.json();
      const txt = data.content?.map(i => i.text || "").join("") || "";
      const parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());

      setNews(p => p.map(n => n.id === item.id ? { ...n, analyzed: true, aiSent: parsed.sentiment, aiText: parsed.reasoning, aiAction: parsed.action, aiConf: parsed.confidence, aiUrg: parsed.urgency, aiRisk: parsed.riskLevel } : n));
      setSentScores(p => ({ ...p, [item.sym]: [...(p[item.sym] || []), { s: parsed.sentiment, c: parsed.confidence, t: new Date() }].slice(-10) }));
      setAiLog(p => [{ id: uid(), time: new Date(), sym: item.sym, headline: item.headline, ...parsed }, ...p].slice(0, 60));
      addLog(`🤖 ${item.sym}: ${parsed.action} (${fmt(parsed.sentiment * 100, 0)}%) — ${parsed.reasoning}`, parsed.sentiment > 0.2 ? "buy" : parsed.sentiment < -0.2 ? "loss" : "info");
      return parsed;
    } catch (err) {
      const sent = item.sentiment || 0;
      const fb = { sentiment: sent, confidence: 0.4, action: sent > 0.2 ? "BUY" : sent < -0.2 ? "SELL" : "HOLD", reasoning: "Analiză keyword automată (AI indisponibil)" };
      setNews(p => p.map(n => n.id === item.id ? { ...n, analyzed: true, aiSent: fb.sentiment, aiText: fb.reasoning, aiAction: fb.action } : n));
      setSentScores(p => ({ ...p, [item.sym]: [...(p[item.sym] || []), { s: fb.sentiment, c: 0.4, t: new Date() }].slice(-10) }));
      return fb;
    } finally { setAiProc(false); }
  }, [addLog]);

  const getAISent = useCallback((sym) => {
    const sc = sentRef.current[sym]; if (!sc || !sc.length) return { score: 0, count: 0 };
    const r = sc.slice(-5);
    const w = r.reduce((a, s, i) => a + s.s * s.c * (i + 1), 0) / r.reduce((a, _, i) => a + (i + 1), 0);
    return { score: w, count: sc.length };
  }, []);

  // ── AI news queue ──
  useEffect(() => {
    if (!running || !strat.newsAI) return;
    const iv = setInterval(async () => {
      if (newsQ.current.length > 0 && !aiProc) {
        await analyzeWithAI(newsQ.current.shift());
      }
    }, 3500);
    return () => clearInterval(iv);
  }, [running, strat.newsAI, aiProc, analyzeWithAI]);

  // ── Price refresh interval ──
  useEffect(() => {
    if (!running) return;
    priceIntRef.current = setInterval(async () => {
      await fetchPrices();
      await fetchNews();
    }, UPDATE_INTERVAL);
    return () => clearInterval(priceIntRef.current);
  }, [running, fetchPrices, fetchNews]);

  // ── Trading tick (every 30s when running, uses real prices) ──
  useEffect(() => {
    if (!running) return;
    intRef.current = setInterval(() => {
      setTick(t => t + 1);
    }, 30000); // every 30s check signals
    return () => clearInterval(intRef.current);
  }, [running]);

  // ── Auto-trading logic ──
  useEffect(() => {
    if (!running || tick === 0) return;
    const curMkt = mktRef.current;
    const curAnal = analRef.current;
    const curPort = portRef.current;
    const curRisk = riskRef.current;
    const curStrat = stratRef.current;
    const curLiveP = livePRef.current;

    // Track P&L
    const tv = curPort.cash + Object.entries(curPort.pos).reduce((a, [s, p]) => {
      const cp = curLiveP[s]?.priceEur || (curMkt[s]?.[curMkt[s].length - 1]?.close || p.avgP);
      return a + cp * p.qty;
    }, 0);
    setDailyPnL(p => [...p, { time: Date.now(), value: tv, pnl: tv - INITIAL_CASH }].slice(-288));

    Object.entries(curAnal).forEach(([sym, a]) => {
      if (!a) return;
      const { strategies } = a;
      const lp = curLiveP[sym];
      const hist = curMkt[sym];
      if (!lp && !hist?.length) return;
      const price = lp?.priceEur || hist[hist.length - 1].close;

      let buyV = 0, sellV = 0;
      if (curStrat.trend) { if (strategies.trend.signal === "BUY") buyV++; if (strategies.trend.signal === "SELL") sellV++; }
      if (curStrat.meanRev) { if (strategies.meanRev.signal === "BUY") buyV++; if (strategies.meanRev.signal === "SELL") sellV++; }
      if (curStrat.momentum) { if (strategies.momentum.signal === "BUY") buyV++; if (strategies.momentum.signal === "SELL") sellV++; }

      const aiS = getAISent(sym);
      if (curStrat.newsAI && aiS.count > 0) {
        if (aiS.score > 0.25) buyV += curRisk.newsW * 2.5;
        else if (aiS.score < -0.25) sellV += curRisk.newsW * 2.5;
      }

      const openCount = Object.keys(curPort.pos).length;

      // BUY
      if (buyV >= 2 && !curPort.pos[sym] && openCount < curRisk.maxOpen) {
        const alloc = Math.min(tv * curRisk.maxPosPct, curPort.cash * 0.9);
        const qty = Math.floor((alloc / price) * 100) / 100;
        if (qty > 0 && curPort.cash >= qty * price) {
          const cost = qty * price;
          setPort(p => ({ ...p, cash: p.cash - cost, pos: { ...p.pos, [sym]: { qty, avgP: price, entry: new Date(), sl: price * (1 - curRisk.stopLoss), hwm: price } } }));
          setTrades(p => [{ id: uid(), sym, side: "BUY", qty, price, time: new Date(), reason: `Tech:${buyV.toFixed(1)} AI:${aiS.count > 0 ? fmt(aiS.score, 2) : "—"}` }, ...p]);
          addLog(`🟢 BUY ${fmt(qty, 2)}× ${sym} @ ${fmtE(price)} (${fmtE(cost)})`, "buy");
        }
      }

      // SELL
      if (sellV >= 2 && curPort.pos[sym]) {
        const pos = curPort.pos[sym], rev = pos.qty * price, pnl = rev - pos.qty * pos.avgP;
        setPort(p => { const np = { ...p.pos }; delete np[sym]; return { ...p, cash: p.cash + rev, pos: np, hist: [...p.hist, { sym, pnl, exitP: price, ...pos }] }; });
        setTrades(p => [{ id: uid(), sym, side: "SELL", qty: pos.qty, price, time: new Date(), pnl, reason: `Tech:${sellV.toFixed(1)} AI:${aiS.count > 0 ? fmt(aiS.score, 2) : "—"}` }, ...p]);
        addLog(`🔴 SELL ${fmt(pos.qty, 2)}× ${sym} @ ${fmtE(price)} P&L: ${fmtE(pnl)}`, pnl >= 0 ? "profit" : "loss");
      }

      // Trailing Stop
      if (curPort.pos[sym]) {
        const pos = curPort.pos[sym];
        if (curRisk.trailStop && price > (pos.hwm || pos.avgP)) {
          const ns = price * (1 - curRisk.stopLoss);
          if (ns > pos.sl) setPort(p => ({ ...p, pos: { ...p.pos, [sym]: { ...p.pos[sym], sl: ns, hwm: price } } }));
        }
        if (price <= pos.sl) {
          const rev = pos.qty * price, pnl = rev - pos.qty * pos.avgP;
          setPort(p => { const np = { ...p.pos }; delete np[sym]; return { ...p, cash: p.cash + rev, pos: np, hist: [...p.hist, { sym, pnl, exitP: price, ...pos }] }; });
          setTrades(p => [{ id: uid(), sym, side: "⛔STOP", qty: pos.qty, price, time: new Date(), pnl }, ...p]);
          addLog(`⛔ STOP ${sym} @ ${fmtE(price)} P&L: ${fmtE(pnl)}`, "loss");
        }
      }
    });
  }, [tick, running]);

  const toggle = () => {
    if (running) {
      clearInterval(intRef.current);
      clearInterval(priceIntRef.current);
      addLog("⏸ Agent oprit", "system");
    } else {
      addLog("▶ Agent pornit — date piață reală, paper trading 100€", "system");
    }
    setRunning(!running);
  };

  useEffect(() => () => { clearInterval(intRef.current); clearInterval(priceIntRef.current); }, []);

  // Calcs
  const tv = port.cash + Object.entries(port.pos).reduce((a, [s, p]) => {
    const cp = liveP[s]?.priceEur || (mkt[s]?.[mkt[s].length - 1]?.close || p.avgP);
    return a + cp * p.qty;
  }, 0);
  const totalPnL = tv - INITIAL_CASH;
  const wr = port.hist.length > 0 ? port.hist.filter(h => h.pnl >= 0).length / port.hist.length : 0;
  const bestTrade = port.hist.length > 0 ? Math.max(...port.hist.map(h => h.pnl)) : 0;
  const worstTrade = port.hist.length > 0 ? Math.min(...port.hist.map(h => h.pnl)) : 0;

  const G = "#4ade80", R = "#f87171", Y = "#facc15", P = "#a78bfa";
  const bg0 = "#0a0a0b", bg1 = "#151518", bg2 = "#222228", bdr = "#2e2e36";
  const gray = "#6b6b78", muted = "#9898a6", white = "#f0f0f4";

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", background: bg0, color: "#ddd", minHeight: "100vh", fontSize: 12 }}>
      {/* Header */}
      <div style={{ padding: "12px 18px", borderBottom: `1px solid ${bdr}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, background: `linear-gradient(180deg,${bg1},${bg0})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: white }}><span style={{ color: G }}>◆</span> AGENT<span style={{ color: G }}>TRADE</span></span>
          <span style={{ fontSize: 9, color: "#10b981", border: "1px solid #10b98144", padding: "1px 6px", borderRadius: 3, fontWeight: 600 }}>PIAȚĂ REALĂ</span>
          <span style={{ fontSize: 9, color: Y, border: `1px solid ${Y}44`, padding: "1px 6px", borderRadius: 3, fontWeight: 600 }}>100€ DEMO</span>
          {aiProc && <span style={{ fontSize: 9, color: G, animation: "pulse 1s infinite" }}>🤖 AI...</span>}
          {loadingPrices && <span style={{ fontSize: 9, color: Y, animation: "pulse 1s infinite" }}>📊 Yahoo Finance...</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={fetchPrices} disabled={loadingPrices} style={{ padding: "5px 12px", borderRadius: 4, border: `1px solid ${bg2}`, background: bg2, color: loadingPrices ? gray : white, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace" }}>
            ⟳ Refresh
          </button>
          <span style={{ fontSize: 10, color: gray }}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: running ? G : gray, marginRight: 5, animation: running ? "pulse 1.5s infinite" : "none" }} />
            {running ? `Tick #${tick}` : "Oprit"}
          </span>
          <button onClick={toggle} style={{ padding: "7px 18px", borderRadius: 5, border: "none", fontWeight: 700, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", background: running ? "#dc2626" : G, color: running ? "#fff" : "#052e16" }}>
            {running ? "⏸ Stop" : "▶ Start"}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar marketOpen={marketOpen} lastUpdate={lastUpdate} loading={loadingPrices} error={priceError} />

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "8px 18px", borderBottom: "1px solid #1a1a1f" }}>
        {[
          { l: "💰 Portofoliu", v: fmtE(tv), c: white },
          { l: "📈 P&L Total", v: `${fmtE(totalPnL)} (${pct(totalPnL / INITIAL_CASH)})`, c: totalPnL >= 0 ? G : R },
          { l: "💵 Cash", v: fmtE(port.cash), c: white },
          { l: "📊 Poziții", v: `${Object.keys(port.pos).length}/${risk.maxOpen}`, c: white },
          { l: "🎯 Win Rate", v: `${fmt(wr * 100, 0)}%`, c: wr >= 0.5 ? G : Y },
          { l: "📰 AI Analize", v: `${news.filter(n => n.analyzed).length}`, c: P },
        ].map(s => (
          <div key={s.l} style={{ flex: "1 1 110px", background: bg1, borderRadius: 5, padding: "7px 10px", border: `1px solid ${bg2}` }}>
            <div style={{ fontSize: 8.5, color: gray, letterSpacing: 0.8, marginBottom: 2 }}>{s.l}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", padding: "0 18px", borderBottom: `1px solid ${bg2}`, background: bg1 }}>
        {[["dash", "◉ Dashboard"], ["detail", "📊 Detalii"], ["port", "💼 Portofoliu"], ["news", "📰 News+AI"], ["cfg", "⚙ Setări"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "8px 14px", fontSize: 10.5, fontWeight: tab === id ? 700 : 400, color: tab === id ? G : gray, borderBottom: tab === id ? `2px solid ${G}` : "2px solid transparent", background: "none", border: "none", fontFamily: "'IBM Plex Mono',monospace" }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: "12px 18px" }}>

        {/* ═══ DASHBOARD ═══ */}
        {tab === "dash" && (
          <>
            {dailyPnL.length > 1 && (
              <div style={{ background: bg1, border: `1px solid ${bg2}`, borderRadius: 6, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Evoluție Portofoliu (€) — Date Reale</div>
                <Spark data={dailyPnL.map(d => d.value)} w={700} h={50} color={totalPnL >= 0 ? G : R} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: gray }}>
                  <span>Start: {fmtE(INITIAL_CASH)}</span>
                  <span>Acum: {fmtE(tv)}</span>
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
              {Object.entries(ASSETS).map(([sym, asset]) => {
                const hist = mkt[sym], a = anal[sym];
                const lp = liveP[sym];
                const price = lp?.priceEur || hist?.[hist.length - 1]?.close || 0;
                const chg = lp ? lp.changePct : (hist?.length >= 2 ? (hist[hist.length - 1].close - hist[hist.length - 2].close) / hist[hist.length - 2].close : 0);
                const aiS = getAISent(sym), pos = port.pos[sym];
                const lastNews = news.filter(n => n.sym === sym).slice(0, 1)[0];
                return (
                  <div key={sym} onClick={() => { setSel(sym); setTab("detail"); }} style={{ background: bg1, border: `1px solid ${sel === sym ? G : bg2}`, borderRadius: 7, padding: 12, cursor: "pointer", transition: "border-color 0.2s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: white }}>{sym}</span>
                        {lp && <span style={{ marginLeft: 6, fontSize: 8, padding: "1px 4px", background: "#042c53", color: "#85b7eb", borderRadius: 3 }}>LIVE</span>}
                        {pos && <span style={{ marginLeft: 4, fontSize: 8, padding: "1px 5px", background: "#052e16", color: G, borderRadius: 3 }}>OPEN {fmt(pos.qty, 2)}×</span>}
                      </div>
                      {a ? <Badge s={a.strategies.combined.signal} /> : <span style={{ fontSize: 9, color: gray }}>Se încarcă...</span>}
                    </div>
                    <div style={{ fontSize: 9, color: gray, marginBottom: 5 }}>{asset.desc}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: white }}>{price > 0 ? fmtE(price) : "—"}</div>
                        <div style={{ fontSize: 10, color: chg >= 0 ? G : R, fontWeight: 600 }}>
                          {pct(chg)} {lp ? `(${lp.changeEur >= 0 ? "+" : ""}${fmtE(lp.changeEur)})` : ""}
                        </div>
                      </div>
                      {hist && hist.length > 5 && <Spark data={hist.slice(-40).map(h => h.close)} color={chg >= 0 ? G : R} />}
                    </div>
                    {pos && (
                      <div style={{ marginTop: 6, padding: "4px 6px", background: bg0, borderRadius: 3, fontSize: 9.5, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: gray }}>P&L:</span>
                        <span style={{ color: (price - pos.avgP) >= 0 ? G : R, fontWeight: 700 }}>{fmtE((price - pos.avgP) * pos.qty)} ({pct((price - pos.avgP) / pos.avgP)})</span>
                      </div>
                    )}
                    {a && (
                      <div style={{ marginTop: 5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 3 }}>
                          {[["T", "trend"], ["MR", "meanRev"], ["M", "momentum"]].map(([l, k]) => {
                            const sig = a.strategies[k].signal;
                            return <span key={k} style={{ fontSize: 8, padding: "1px 3px", borderRadius: 2, background: sig === "BUY" ? "#052e16" : sig === "SELL" ? "#450a0a" : bg2, color: sig === "BUY" ? G : sig === "SELL" ? R : gray }}>{l}</span>;
                          })}
                        </div>
                        <SentDot v={aiS.count > 0 ? aiS.score : null} />
                      </div>
                    )}
                    {lastNews && (
                      <div style={{ marginTop: 5, fontSize: 9, color: muted, padding: "3px 6px", background: bg0, borderRadius: 3, borderLeft: `2px solid ${lastNews.cat === "positive" ? G : lastNews.cat === "negative" ? R : Y}`, lineHeight: 1.3 }}>
                        {lastNews.real ? "📰" : "🤖"} {lastNews.headline.slice(0, 65)}...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ═══ DETALII ═══ */}
        {tab === "detail" && (() => {
          const hist = mkt[sel], a = anal[sel], lp = liveP[sel];
          const price = lp?.priceEur || hist?.[hist?.length - 1]?.close || 0;
          const aiS = getAISent(sel);
          const assetNews = news.filter(n => n.sym === sel).slice(0, 6);
          const assetAI = aiLog.filter(l => l.sym === sel).slice(0, 5);
          return (
            <>
              <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
                {Object.keys(ASSETS).map(s => <button key={s} onClick={() => setSel(s)} style={{ padding: "3px 8px", borderRadius: 3, border: `1px solid ${sel === s ? G : bg2}`, background: sel === s ? bg2 : "transparent", color: sel === s ? G : gray, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace" }}>{s}</button>)}
                <button onClick={() => fetchHistory(sel)} style={{ padding: "3px 8px", borderRadius: 3, border: `1px solid ${bg2}`, background: "transparent", color: muted, fontSize: 9, fontFamily: "'IBM Plex Mono',monospace" }}>⟳ Reîncarcă</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ background: bg1, border: `1px solid ${bg2}`, borderRadius: 7, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: white }}>{sel} {lp && <span style={{ fontSize: 10, color: "#85b7eb" }}>● LIVE</span>}</div>
                        <div style={{ fontSize: 9, color: gray }}>{ASSETS[sel].desc}</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: white, marginTop: 4 }}>{fmtE(price)}</div>
                        {lp && <div style={{ fontSize: 11, color: lp.changePct >= 0 ? G : R }}>{pct(lp.changePct)} azi ({fmtE(lp.changeEur)})</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>{a ? <Badge s={a.strategies.combined.signal} big /> : <span style={{ color: gray }}>Se calculează...</span>}</div>
                    </div>
                    {lp && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5, marginBottom: 10 }}>
                        {[
                          { l: "High", v: fmtE(lp.high * lp.eurRate) },
                          { l: "Low", v: fmtE(lp.low * lp.eurRate) },
                          { l: "Open", v: fmtE(lp.open * lp.eurRate) },
                          { l: "Volume", v: (lp.volume / 1e6).toFixed(1) + "M" },
                        ].map(i => <div key={i.l} style={{ background: bg0, padding: 5, borderRadius: 3 }}><div style={{ fontSize: 7.5, color: gray, textTransform: "uppercase" }}>{i.l}</div><div style={{ fontSize: 11, fontWeight: 700, color: white, marginTop: 1 }}>{i.v}</div></div>)}
                      </div>
                    )}
                    {a && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                        {["trend", "meanRev", "momentum"].map(k => {
                          const st = a.strategies[k];
                          return <div key={k} style={{ background: bg0, borderRadius: 4, padding: 8, border: `1px solid ${bg2}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 9, fontWeight: 700, color: muted }}>{st.name}</span><Badge s={st.signal} /></div>
                            <div style={{ fontSize: 9, color: gray }}>{st.reason}</div>
                          </div>;
                        })}
                      </div>
                    )}
                  </div>
                  {a && (
                    <div style={{ background: bg1, border: `1px solid ${bg2}`, borderRadius: 7, padding: 14 }}>
                      <div style={{ fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Indicatori Tehnici</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
                        {[
                          { l: "RSI", v: a.ind.rsi ? fmt(a.ind.rsi, 0) : "—", w: a.ind.rsi && (a.ind.rsi > 70 || a.ind.rsi < 30) },
                          { l: "MACD", v: fmt(a.ind.macd, 3) },
                          { l: "SMA10", v: a.ind.sma10 ? fmtE(a.ind.sma10) : "—" },
                          { l: "SMA20", v: a.ind.sma20 ? fmtE(a.ind.sma20) : "—" },
                          { l: "Mom 3d", v: pct(a.ind.mom3) },
                          { l: "Mom 10d", v: pct(a.ind.mom10) },
                          { l: "BB ↑", v: a.ind.bb?.u ? fmtE(a.ind.bb.u) : "—" },
                          { l: "Vol", v: `${fmt(a.ind.volR, 1)}x` },
                        ].map(i => <div key={i.l} style={{ background: bg0, padding: 5, borderRadius: 3 }}><div style={{ fontSize: 7.5, color: gray, textTransform: "uppercase", letterSpacing: 1 }}>{i.l}</div><div style={{ fontSize: 12, fontWeight: 700, color: i.w ? Y : white, marginTop: 2 }}>{i.v}</div></div>)}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ background: bg1, border: `1px solid ${aiProc ? `${G}66` : bg2}`, borderRadius: 7, padding: 14, marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🤖 AI Sentiment — {sel}</div>
                    <div style={{ textAlign: "center", padding: "8px 0" }}>
                      <div style={{ fontSize: 32, fontWeight: 800, color: aiS.count > 0 ? (aiS.score > 0.2 ? G : aiS.score < -0.2 ? R : Y) : gray }}>{aiS.count > 0 ? fmt(aiS.score * 100, 0) : "—"}</div>
                      <div style={{ fontSize: 9, color: muted }}>{aiS.count > 0 ? `${aiS.count} analize știri reale` : "Nicio analiză"}</div>
                    </div>
                    {assetAI.map(l => <div key={l.id} style={{ padding: "4px 0", borderTop: `1px solid ${bg2}`, fontSize: 9.5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><Badge s={l.action} /><span style={{ color: gray }}>{new Date(l.time).toLocaleTimeString()}</span></div>
                      <div style={{ color: muted, marginTop: 2, lineHeight: 1.3 }}>{l.reasoning}</div>
                    </div>)}
                  </div>
                  <div style={{ background: bg1, border: `1px solid ${bg2}`, borderRadius: 7, padding: 14 }}>
                    <div style={{ fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📰 Știri Reale — {sel}</div>
                    {assetNews.length === 0 ? <div style={{ color: gray, textAlign: "center", padding: 10 }}>Nicio știre. Apasă Start.</div> : assetNews.map(n => <div key={n.id} style={{ padding: "5px 0", borderBottom: `1px solid ${bg2}`, fontSize: 10 }}>
                      <div style={{ color: white, lineHeight: 1.3 }}>{n.headline}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                        <span style={{ fontSize: 8.5, color: gray }}>{n.source}</span>
                        {n.analyzed ? <SentDot v={n.aiSent} /> : <span style={{ fontSize: 8.5, color: Y }}>⏳</span>}
                      </div>
                      {n.aiText && <div style={{ fontSize: 8.5, color: muted, marginTop: 2, padding: "2px 5px", background: bg0, borderRadius: 2, borderLeft: `2px solid ${n.aiSent > 0.2 ? G : n.aiSent < -0.2 ? R : Y}` }}>🤖 {n.aiText}</div>}
                    </div>)}
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        {/* ═══ PORTOFOLIU ═══ */}
        {tab === "port" && (
          <>
            <div style={{ background: bg1, border: `1px solid ${bg2}`, borderRadius: 7, padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Poziții Deschise</div>
              {Object.keys(port.pos).length === 0 ? <div style={{ color: gray, textAlign: "center", padding: 14 }}>Nicio poziție. Apasă Start.</div> :
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr>
                  {["Simbol", "Qty", "Intrare", "Curent", "P&L", "Stop", "AI", ""].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 6px", borderBottom: `1px solid ${bg2}`, color: gray, fontSize: 9, textTransform: "uppercase" }}>{h}</th>)}
                </tr></thead><tbody>
                  {Object.entries(port.pos).map(([sym, pos]) => {
                    const lp = liveP[sym];
                    const cp = lp?.priceEur || mkt[sym]?.[mkt[sym].length - 1]?.close || pos.avgP;
                    const pnl = (cp - pos.avgP) * pos.qty;
                    return <tr key={sym}>
                      <td style={{ padding: "5px 6px", borderBottom: "1px solid #1a1a1f" }}><strong>{sym}</strong></td>
                      <td style={{ padding: "5px 6px", borderBottom: "1px solid #1a1a1f" }}>{fmt(pos.qty, 2)}</td>
                      <td style={{ padding: "5px 6px", borderBottom: "1px solid #1a1a1f" }}>{fmtE(pos.avgP)}</td>
                      <td style={{ padding: "5px 6px", borderBottom: "1px solid #1a1a1f" }}>{fmtE(cp)} {lp && <span style={{ fontSize: 8, color: "#85b7eb" }}>●</span>}</td>
                      <td style={{ padding: "5px 6px", borderBottom: "1px solid #1a1a1f", color: pnl >= 0 ? G : R, fontWeight: 700 }}>{fmtE(pnl)}</td>
                      <td style={{ padding: "5px 6px", borderBottom: "1px solid #1a1a1f" }}>{fmtE(pos.sl)}</td>
                      <td style={{ padding: "5px 6px", borderBottom: "1px solid #1a1a1f" }}><SentDot v={getAISent(sym).count > 0 ? getAISent(sym).score : null} /></td>
                      <td style={{ padding: "5px 6px", borderBottom: "1px solid #1a1a1f" }}><button onClick={() => {
                        const rev = pos.qty * cp, pnl2 = rev - pos.qty * pos.avgP;
                        setPort(p => { const np = { ...p.pos }; delete np[sym]; return { ...p, cash: p.cash + rev, pos: np, hist: [...p.hist, { sym, pnl: pnl2, exitP: cp, ...pos }] }; });
                        setTrades(p => [{ id: uid(), sym, side: "MANUAL", qty: pos.qty, price: cp, time: new Date(), pnl: pnl2 }, ...p]);
                        addLog(`📤 MANUAL ${sym} P&L: ${fmtE(pnl2)}`, pnl2 >= 0 ? "profit" : "loss");
                      }} style={{ padding: "2px 8px", borderRadius: 3, border: `1px solid ${bg2}`, background: bg2, color: "#ddd", fontSize: 10, fontFamily: "'IBM Plex Mono',monospace" }}>Vinde</button></td>
                    </tr>;
                  })}
                </tbody></table>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              {[
                { l: "Trades Total", v: trades.length, c: white },
                { l: "Win Rate", v: `${fmt(wr * 100, 0)}%`, c: wr >= 0.5 ? G : R },
                { l: "Cel mai bun", v: fmtE(bestTrade), c: G },
                { l: "Cel mai rău", v: fmtE(worstTrade), c: R },
              ].map(s => <div key={s.l} style={{ background: bg1, border: `1px solid ${bg2}`, borderRadius: 5, padding: "8px 10px" }}><div style={{ fontSize: 8, color: gray, textTransform: "uppercase", letterSpacing: 1 }}>{s.l}</div><div style={{ fontSize: 16, fontWeight: 700, color: s.c, marginTop: 2 }}>{s.v}</div></div>)}
            </div>
            <div style={{ background: bg1, border: `1px solid ${bg2}`, borderRadius: 7, padding: 14 }}>
              <div style={{ fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Istoric Tranzacții ({trades.length})</div>
              {trades.length === 0 ? <div style={{ color: gray, textAlign: "center", padding: 14 }}>Nicio tranzacție.</div> :
                <div style={{ maxHeight: 280, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}><thead><tr>
                    {["Timp", "Sym", "Tip", "Qty", "Preț", "P&L", "Motiv"].map(h => <th key={h} style={{ textAlign: "left", padding: "4px 6px", borderBottom: `1px solid ${bg2}`, color: gray, fontSize: 8.5, textTransform: "uppercase", position: "sticky", top: 0, background: bg1 }}>{h}</th>)}
                  </tr></thead><tbody>
                    {trades.map(t => <tr key={t.id}>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #1a1a1f", fontSize: 9 }}>{new Date(t.time).toLocaleTimeString()}</td>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #1a1a1f", fontWeight: 700 }}>{t.sym}</td>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #1a1a1f", color: t.side.includes("BUY") ? G : R, fontWeight: 700 }}>{t.side}</td>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #1a1a1f" }}>{fmt(t.qty, 2)}</td>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #1a1a1f" }}>{fmtE(t.price)}</td>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #1a1a1f", color: (t.pnl || 0) >= 0 ? G : R }}>{t.pnl !== undefined ? fmtE(t.pnl) : "—"}</td>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #1a1a1f", fontSize: 9, color: muted }}>{t.reason || "manual"}</td>
                    </tr>)}
                  </tbody></table>
                </div>}
            </div>
          </>
        )}

        {/* ═══ NEWS ═══ */}
        {tab === "news" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 10 }}>
            <div style={{ background: bg1, border: `1px solid ${bg2}`, borderRadius: 7, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: 1 }}>📰 Știri Reale ({news.length})</div>
                <button onClick={fetchNews} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, border: `1px solid ${bg2}`, background: "transparent", color: gray, fontFamily: "'IBM Plex Mono',monospace" }}>⟳ Refresh</button>
              </div>
              <div style={{ maxHeight: 500, overflow: "auto" }}>
                {news.length === 0 ? <div style={{ color: gray, textAlign: "center", padding: 20 }}>Apasă Start pentru știri reale.</div> : news.map(n => (
                  <div key={n.id} style={{ padding: "7px 0", borderBottom: `1px solid ${bg2}` }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 14 }}>{n.cat === "positive" ? "📈" : n.cat === "negative" ? "📉" : "📊"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: white, lineHeight: 1.3 }}>{n.headline}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <span style={{ fontSize: 9, color: muted }}>{n.source}</span>
                            <span style={{ fontSize: 8, padding: "1px 4px", background: bg2, borderRadius: 2, color: gray }}>{n.sym}</span>
                            {n.real && <span style={{ fontSize: 8, color: "#85b7eb" }}>● real</span>}
                          </div>
                          {n.analyzed ? <SentDot v={n.aiSent} /> : <span style={{ fontSize: 9, color: Y }}>⏳ AI...</span>}
                        </div>
                        {n.aiText && <div style={{ fontSize: 9.5, color: muted, marginTop: 4, padding: "3px 6px", background: bg0, borderRadius: 3, borderLeft: `2px solid ${n.aiSent > 0.2 ? G : n.aiSent < -0.2 ? R : Y}`, lineHeight: 1.3 }}>🤖 {n.aiText}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ background: bg1, border: `1px solid ${bg2}`, borderRadius: 7, padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Sentiment per Acțiune</div>
                {Object.entries(sentScores).filter(([, v]) => v.length > 0).map(([sym, scores]) => {
                  const avg = scores.reduce((a, s) => a + s.s, 0) / scores.length;
                  return <div key={sym} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: `1px solid ${bg2}` }}>
                    <span style={{ fontWeight: 600, fontSize: 11 }}>{sym}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 50, height: 3, background: bg2, borderRadius: 2, overflow: "hidden", position: "relative" }}>
                        <div style={{ position: "absolute", left: "50%", top: 0, width: `${Math.abs(avg) * 50}%`, height: "100%", background: avg > 0 ? G : R, borderRadius: 2, transform: avg < 0 ? "translateX(-100%)" : "none" }} />
                      </div>
                      <span style={{ fontSize: 9.5, color: avg > 0.2 ? G : avg < -0.2 ? R : Y, fontWeight: 600 }}>{fmt(avg * 100, 0)}%</span>
                    </div>
                  </div>;
                })}
                {Object.keys(sentScores).length === 0 && <div style={{ color: gray, fontSize: 9 }}>Pornește agentul pentru analiză AI.</div>}
              </div>
              <div style={{ background: bg1, border: `1px solid ${bg2}`, borderRadius: 7, padding: 14 }}>
                <div style={{ fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🤖 AI Log ({aiLog.length})</div>
                <div style={{ maxHeight: 300, overflow: "auto" }}>
                  {aiLog.map(l => <div key={l.id} style={{ padding: "4px 0", borderBottom: `1px solid ${bg2}`, fontSize: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 700 }}>{l.sym}</span><Badge s={l.action} /></div>
                    <div style={{ fontSize: 9, color: muted, marginTop: 2 }}>{l.reasoning}</div>
                    <div style={{ fontSize: 8.5, color: gray, marginTop: 1 }}>Sent:{fmt(l.sentiment, 2)} Conf:{fmt(l.confidence * 100, 0)}% Risk:{l.riskLevel}</div>
                  </div>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ SETĂRI ═══ */}
        {tab === "cfg" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: bg1, border: `1px solid ${bg2}`, borderRadius: 7, padding: 14 }}>
              <div style={{ fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>⚙ Risk Management</div>
              {[
                { l: "Max Poziție (%)", k: "maxPosPct", mn: 10, mx: 60, c: G },
                { l: "Stop-Loss (%)", k: "stopLoss", mn: 2, mx: 15, c: R },
                { l: "Ponderea AI (%)", k: "newsW", mn: 10, mx: 80, c: P },
                { l: "Max Poziții Simultane", k: "maxOpen", mn: 1, mx: 6, c: Y },
              ].map(({ l, k, mn, mx, c }) => (
                <label key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
                  <span style={{ fontSize: 11 }}>{l}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="range" min={mn} max={mx} value={k === "maxOpen" ? risk[k] : risk[k] * 100} onChange={e => setRisk(p => ({ ...p, [k]: k === "maxOpen" ? parseInt(e.target.value) : e.target.value / 100 }))} style={{ width: 90, accentColor: c }} />
                    <span style={{ color: c, fontWeight: 700, width: 35, textAlign: "right" }}>{k === "maxOpen" ? risk[k] : `${fmt(risk[k] * 100, 0)}%`}</span>
                  </div>
                </label>
              ))}
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
                <span style={{ fontSize: 11 }}>Trailing Stop</span>
                <input type="checkbox" checked={risk.trailStop} onChange={e => setRisk(p => ({ ...p, trailStop: e.target.checked }))} />
              </label>
            </div>
            <div style={{ background: bg1, border: `1px solid ${bg2}`, borderRadius: 7, padding: 14 }}>
              <div style={{ fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📊 Strategii Active</div>
              {[
                { k: "trend", l: "Trend Following", d: "SMA10/20 + MACD" },
                { k: "meanRev", l: "Mean Reversion", d: "RSI + Bollinger Bands" },
                { k: "momentum", l: "Momentum", d: "Impuls 3/10 zile + volum" },
                { k: "newsAI", l: "🤖 AI News Analysis", d: "Claude analizează știri reale" },
              ].map(s => (
                <label key={s.k} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 0", cursor: "pointer" }}>
                  <input type="checkbox" checked={strat[s.k]} onChange={e => setStrat(p => ({ ...p, [s.k]: e.target.checked }))} style={{ marginTop: 2 }} />
                  <div><div style={{ fontSize: 11, fontWeight: 600 }}>{s.l}</div><div style={{ fontSize: 9.5, color: gray }}>{s.d}</div></div>
                </label>
              ))}
              <div style={{ marginTop: 12, padding: "10px", background: bg0, borderRadius: 5, border: `1px solid ${bg2}` }}>
                <div style={{ fontSize: 9, color: gray, marginBottom: 4 }}>⏱ Update interval</div>
                <div style={{ fontSize: 11, color: white }}>Prețuri: la 5 minute</div>
                <div style={{ fontSize: 11, color: white }}>Semnale: la 30 secunde</div>
                <div style={{ fontSize: 11, color: white }}>Știri: la 5 minute</div>
              </div>
            </div>
            <div style={{ background: bg1, border: `1px solid ${bg2}`, borderRadius: 7, padding: 14, gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Jurnal System ({log.length})</div>
              <div style={{ maxHeight: 220, overflow: "auto", fontSize: 10.5 }}>
                {log.map(e => <div key={e.id} style={{ padding: "2px 0", borderBottom: "1px solid #1a1a1f", display: "flex", gap: 6 }}>
                  <span style={{ color: gray, fontSize: 9, minWidth: 65 }}>{e.time.toLocaleTimeString()}</span>
                  <span style={{ color: e.type === "buy" ? G : e.type === "loss" ? R : e.type === "profit" ? G : e.type === "news" ? P : muted }}>{e.msg}</span>
                </div>)}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "10px 18px", borderTop: "1px solid #1a1a1f", fontSize: 9, color: gray, textAlign: "center" }}>
        ⚠ Paper trading demo — prețuri reale Yahoo Finance, tranzacții simulate. Investițiile implică risc de pierdere a capitalului.
      </div>
    </div>
  );
}
