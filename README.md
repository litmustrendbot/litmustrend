# LitmusTrend | PDC 5M BOS + FVG Institutional Trading Platform

A modern algorithmic trading platform and web dispatcher engineered specifically for the **PDC 5M BOS + FVG Strategy**.

## Strategy Specifications
- **Execution Timeframe**: 5-Minute (M5)
- **Anchor Bias**: Previous Day Close (PDC)
- **Structure**: 5M Swing Point Fractals (3 bars left/right lookback) + Confirmed Candle Close
- **Zone Refinement**: Fair Value Gap (FVG) / Impulse Origin Demand & Supply
- **Target**: 1:10 Risk:Reward Asymmetry
- **Trailing Stop**: Stepped Trailing active from +9.5R to +9.9R
- **Circuit Breaker**: Max 3 consecutive losses per day

## 3 Production Expert Advisors
1. **`PDC_5M_10_Percent_Risk_EA.mq5`**: High-growth compounding (10% equity risk per trade).
2. **`PDC_5M_5_Percent_Risk_EA.mq5`**: Balanced growth (5% equity risk per trade).
3. **`PDC_5M_1_Percent_Risk_EA.mq5`**: Prop Firm compliance (1% equity risk per trade).

## Technology Stack
- **Web Frontend**: HTML5 / Modern CSS / Vanilla JS (`index.html`, `css/styles.css`, `js/app.js`)
- **Serverless Backend**: Vercel Serverless Functions (`api/portal/connect.js`)
- **Cloud Database**: Supabase PostgreSQL (`supabase/schema.sql`)
- **Trading Engine**: MetaTrader 5 (MQL5) & MetaApi Cloud
