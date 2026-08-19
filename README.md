# LitmusTrend - Automated Forex & Crypto Trading Platform

LitmusTrend connects MetaTrader 5 (MT5) Expert Advisors to a Vercel-hosted web platform and Supabase database.

## Architecture

- **Web Frontend**: HTML5 / CSS3 / Modern JavaScript (`index.html`, `css/styles.css`, `js/app.js`)
- **Serverless API Routes**: Vercel endpoints (`/api/ea/log-trade.js`, `/api/ea/check-access.js`)
- **MT5 Expert Advisor**: MQL5 code with WebRequest integration (`mql5/LitmusTrend_EA.mq5`)
- **Python Bridge Engine**: MT5 local Python integration (`python/bridge.py`)
- **Database**: Supabase PostgreSQL (`supabase/schema.sql`)

## Setup Instructions

### 1. Supabase Database Setup
1. Log into your [Supabase Dashboard](https://supabase.com).
2. Go to **SQL Editor** -> **New Query**.
3. Paste and run the contents of `supabase/schema.sql`.

### 2. MetaTrader 5 EA Setup
1. Copy `mql5/LitmusTrend_EA.mq5` into your MT5 `MQL5/Experts/` folder.
2. Open MetaEditor 5 (F4 in MT5), open `LitmusTrend_EA.mq5` and click **Compile** (F7).
3. In MT5, go to **Tools -> Options -> Expert Advisors**.
4. Check **Allow Algorithmic Trading** and **Allow WebRequest for listed URL**.
5. Add your Vercel URL (e.g. `https://litmustrend.vercel.app`).
6. Attach `LitmusTrend_EA` to your chart.

### 3. Deploying to Vercel
1. Push code to your GitHub repo: `https://github.com/litmustrendbot/litmustrend.git`.
2. Connect your GitHub repository to Vercel. Vercel will automatically build and assign your live domain URL.
