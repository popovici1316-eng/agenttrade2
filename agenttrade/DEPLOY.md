# 🚀 AgentTrade — Ghid Deploy pe Vercel

## Ce vei obține
URL permanent (ex: `agenttrade.vercel.app`) accesibil de pe orice device,
24/7, cu prețuri reale Yahoo Finance + AI Claude.

---

## Pasul 1 — Instalează Git (dacă nu ai)
https://git-scm.com/downloads → Download → Install

## Pasul 2 — Cont GitHub
1. Du-te la https://github.com/signup
2. Creează cont gratuit

## Pasul 3 — Urcă proiectul pe GitHub
Deschide Terminal (Windows: cmd sau PowerShell) în folderul `agenttrade`:

```bash
# Inițializează git
git init
git add .
git commit -m "AgentTrade initial"

# Creează repo pe GitHub (cu GitHub CLI sau manual pe site)
# Manual: github.com → New Repository → nume: agenttrade → Create
# Apoi:
git remote add origin https://github.com/TU_USER/agenttrade.git
git branch -M main
git push -u origin main
```

## Pasul 4 — Deploy pe Vercel
1. Du-te la https://vercel.com/signup
2. Sign up cu GitHub
3. Click **"Add New Project"**
4. Selectează repo-ul `agenttrade`
5. **Framework Preset**: Vite (detectat automat)
6. Click **Deploy** ✅

Vercel va construi și da un URL în ~2 minute.

## Pasul 5 — Adaugă Anthropic API Key
În Vercel Dashboard → Settings → Environment Variables:

```
Name:  ANTHROPIC_API_KEY
Value: sk-ant-...cheia ta...
```

Redeploy după ce adaugi variabila.

---

## Structura fișierelor
```
agenttrade/
├── api/
│   ├── prices.js      ← Yahoo Finance prețuri reale
│   ├── news.js        ← RSS feeds știri reale
│   └── history.js     ← OHLCV 90 zile
├── src/
│   ├── main.jsx
│   └── App.jsx        ← UI principal
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

## Cum funcționează 24/7
- **Vercel** = cloud gratuit, rulează API-urile serverless
- **Browser** = deschizi URL-ul, agentul pornește
- **Prețuri** = fetch la Yahoo Finance la fiecare 5 minute
- **Știri** = RSS feeds reale (Reuters, WSJ, Yahoo Finance)
- **AI** = Claude analizează știrile live via Anthropic API

## Limitări gratuite Vercel
- 100GB bandwidth/lună ✅
- 100k API calls/lună ✅ (suficient)
- Serverless functions: 10s timeout ✅

## Debugging
- Vercel Dashboard → Deployments → Functions → Logs
- Browser DevTools → Console pentru erori frontend

---
⚠ Paper trading demo. Nu se execută tranzacții reale.
