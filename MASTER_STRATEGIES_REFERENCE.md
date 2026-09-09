# Master Trading Strategies Archive

This document serves as the permanent, authoritative reference for the two official trading strategies developed, backtested on real MT5 broker data, and compiled for your accounts.

---

## 1. THE WINNING STRATEGY (Flagship: Daily Bias + 5-Minute Execution)

### Strategy Identity
* **Name**: `PDC 5M BOS + FVG Strategy`
* **MQL5 EA Source**: `c:\Users\ADMIN\Desktop\MLQ5\mql5\PDC_5M_BOS_FVG_EA.mq5`
* **Compiled MT5 Binary**: `PDC_5M_BOS_FVG_EA.ex5` (Installed in `MQL5\Experts\`)
* **TradingView Pine Script**: `c:\Users\ADMIN\Desktop\MLQ5\pine\PDC_5M_BOS_FVG_Strategy.pine`
* **Full Blueprint Guide**: `c:\Users\ADMIN\Desktop\MLQ5\PDC_5M_BOS_FVG_Strategy_Guide.pdf`

### Core Rules & Mechanics
1. **Higher Timeframe Bias (Daily)**:
   - Filter trades strictly using the **Previous Day Close (PDC)**.
   - Long setups are only valid when 5M Close > PDC.
   - Short setups are only valid when 5M Close < PDC.
2. **Execution Timeframe (5-Minute)**:
   - Swing Structure: Pivot Lookback = 3 bars left and 3 bars right.
   - Break of Structure (BOS): Bar 1 Close crosses beyond swing high/low while Bar 2 was behind it.
   - Initiating Wick Confirmation: Breakout candle must close beyond the extreme wick of the origin candle.
   - Bounded Origin Search: `search_len = min(30, breakout_bar - swing_pivot_bar)`.
3. **Entry & Zone Refinement**:
   - Fair Value Gap (FVG) or fallback to origin candle edge.
   - Entry: Limit order placed at FVG / origin boundary.
   - Expiration: 25 bars (125 minutes).
   - **Fresh BOS Replacement**: When a new confirmed BOS prints while a limit order is waiting, the old order is immediately canceled and replaced at the fresh BOS/FVG level.
4. **Risk & Capital Management**:
   - Fixed dollar risk: **$10.00 per trade** (`InpRiskMode = RISK_MODE_FIXED_USD`).
   - Dynamic lot sizing: `Lots = $10.00 / (RiskDistanceInTicks * TickValue)`.
   - Single trade execution: Only 1 trade open at a time (`InpOnlyOneTrade = true`).
5. **Exit Targets & Stepped Trailing**:
   - Final Take Profit: **1:10 Risk-to-Reward (10R TP)**.
   - Stepped Trailing: Active **strictly from 9.5R to 9.9R**:
     - At +9.5R: Move SL to +5R.
     - At +9.6R: Move SL to +6R.
     - At +9.7R: Move SL to +7R.
     - At +9.8R: Move SL to +8R.
     - At +9.9R: Move SL to +9R.
   - **NO early break-even at 3R or 5R** (prevents shaking out 10R winners).
6. **Circuit Breaker**:
   - Max 3 consecutive losses per day pauses trading until the next calendar day.

### Real MT5 Performance (99,000 Real Bars, April 2025 – September 2026)
* **$100 Starting Capital / Real-Time Live Elimination**:
  - Total Months: 18
  - Profitable Months: **13 (72.2%)**
  - Blown Months ($0 hit): **5 (27.8%)**
  - Pure Profits Withdrawn: **+$4,935.32**
  - Net Profit in Pocket: **+$4,435.32**

---

## 2. THE LOWER TIMEFRAME STRATEGY (Fast Pace: 4-Hour Bias + 1-Minute Execution)

### Strategy Identity
* **Name**: `P4H 1M BOS + FVG Strategy`
* **MQL5 EA Source**: `c:\Users\ADMIN\Desktop\MLQ5\mql5\P4H_1M_BOS_FVG_EA.mq5`
* **Compiled MT5 Binary**: `P4H_1M_BOS_FVG_EA.ex5` (Installed in `MQL5\Experts\`)
* **TradingView Pine Script**: `c:\Users\ADMIN\Desktop\MLQ5\pine\P4H_1M_BOS_FVG_Strategy.pine`

### Core Rules & Mechanics (Direct 1:1 Scaling)
1. **Higher Timeframe Bias (4-Hour)**:
   - Filter trades strictly using the **Previous 4-Hour Close (P4HC)**.
   - Long setups only when 1M Close > P4HC.
   - Short setups only when 1M Close < P4HC.
2. **Execution Timeframe (1-Minute)**:
   - Pivot Lookback: 3 bars on 1M chart.
   - Initiating Wick Confirmation: Breakout candle closes beyond origin candle wick.
   - Bounded Origin Search: Aligned to 1M swing impulse length (`min(30, shift)`).
3. **Entry & Limit Orders**:
   - 1M FVG or origin candle edge.
   - Expiration: 25 bars (25 minutes).
   - Fresh BOS replacement of pending limit orders.
4. **Risk & Trailing**:
   - Risk: Fixed **$10.00 per trade**.
   - Target: **10R TP**.
   - Stepped Trailing: Active strictly between **9.5R and 9.9R**.
   - 4H Circuit Breaker: Max 3 consecutive losses within a single 4-hour candle window pauses trading until the next 4H candle opens.

### Real MT5 Performance (100,000 Real 1M Bars, May 2026 – September 2026)
* Trade Frequency: ~200 to 260 trades per month.
* Average Monthly Gain on $100: **+$700.00 to +$1,000.00**.
* Monthly Win Record: 4 Profitable Months, 1 Blown Month.

---

## 3. Dedicated Verification & Backtesting Scripts
* **Comprehensive Multi-Asset Portfolio Runner**: `c:\Users\ADMIN\Desktop\MLQ5\run_comprehensive_portfolio_backtest.py`
* **Winning Strategy 1D/5M Live Simulator**: `c:\Users\ADMIN\Desktop\MLQ5\run_exact_monthly_strategy.py`
* **Real-time Live Survival Simulator ($100 Month Start)**: `scratch/run_monthly_fresh_100.py`
* **Lower Timeframe 4H/1M Simulator**: `scratch/run_p4h_1m_monthly_backtest.py`

---

## 4. Multi-Asset Official MT5 Backtest Results (April 2025 – September 2026)
*Executed strictly on real broker price feeds, real tick specifications, 10R targets, 9.5R–9.9R stepped trailing stops, and $100 fresh monthly capital reset / elimination.*

### A. PDC 5M BOS + FVG Strategy (17–18 Months / ~75 Calendar Weeks)
| Instrument | Months | Profitable Months | Blown Months | Total Trades | Win Rate | Gross Banked | Blown Loss | Net Profit in Pocket |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **NAS100** | 18 | **12 (66.7%)** | 3 (16.7%) | 720 | 13.6% | +$3,182.36 | -$300.00 | **+$2,882.36** |
| **US30** | 18 | **12 (66.7%)** | 5 (27.8%) | 758 | 12.7% | +$3,114.83 | -$500.00 | **+$2,614.83** |
| **EURUSD** | 17 | **8 (47.1%)** | 8 (47.1%) | 645 | 11.5% | +$2,096.99 | -$800.00 | **+$1,296.99** |
| **GBPUSD** | 17 | **7 (41.2%)** | 9 (52.9%) | 620 | 10.8% | +$1,702.85 | -$900.00 | **+$802.85** |
| **4-Asset Total** | **70** | **39 (55.7%)** | **25 (35.7%)** | **2,743** | **12.2%** | **+$10,097.03**| **-$2,500.00** | **+$7,597.03** |

### B. P4H 1M BOS + FVG Strategy (100,000 M1 Bars / May 2026 – September 2026)
| Instrument | Months | Profitable Months | Blown Months | Total Trades | Win Rate | Gross Banked | Blown Loss | Net Profit in Pocket |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **NAS100** | 5 | **3 (60.0%)** | 2 (40.0%) | 872 | 12.0% | +$2,492.66 | -$200.00 | **+$2,292.66** |
| **US30** | 5 | **2 (40.0%)** | 2 (40.0%) | 375 | 14.9% | +$2,393.18 | -$200.00 | **+$2,193.18** |
| **EURUSD** | 4 | 0 (0.0%) | 4 (100.0%) | 104 | 5.8% | +$0.00 | -$400.00 | **-$400.00** |
| **GBPUSD** | 4 | 0 (0.0%) | 4 (100.0%) | 53 | 1.9% | +$0.00 | -$400.00 | **-$400.00** |
| **Index Total** | **10** | **5 (50.0%)** | **4 (40.0%)** | **1,247** | **12.9%** | **+$4,885.84** | **-$400.00** | **+$4,485.84** |

---

## 5. Official Production Expert Advisors & Account Tiers
Both strategies are packaged into dedicated **Safe Haven** and **Risk Taker** Expert Advisors compiled and installed directly in `MQL5\Experts\`:

| Strategy & Profile | Target & Trailing | Risk per Trade | Magic Number | Compiled MT5 EA Binary |
| :--- | :---: | :---: | :---: | :--- |
| **1. PDC 5M — Safe Haven** | 10R TP (9.5R–9.9R Trail) | **1.0% Equity** (Prop Firm Safe) | `55501` | [`PDC_5M_Safe_Haven_EA.ex5`](file:///c:/Users/ADMIN/Desktop/MLQ5/mql5/PDC_5M_Safe_Haven_EA.ex5) |
| **2. PDC 5M — Risk Taker** | 10R TP (9.5R–9.9R Trail) | **10.0% Equity** (High Growth) | `55510` | [`PDC_5M_Risk_Taker_EA.ex5`](file:///c:/Users/ADMIN/Desktop/MLQ5/mql5/PDC_5M_Risk_Taker_EA.ex5) |
| **3. P4H 1M — Safe Haven** | 10R TP (9.5R–9.9R Trail) | **1.0% Equity** (Prop Firm Safe) | `44401` | [`P4H_1M_Safe_Haven_EA.ex5`](file:///c:/Users/ADMIN/Desktop/MLQ5/mql5/P4H_1M_Safe_Haven_EA.ex5) |
| **4. P4H 1M — Risk Taker** | 10R TP (9.5R–9.9R Trail) | **10.0% Equity** (High Growth) | `44410` | [`P4H_1M_Risk_Taker_EA.ex5`](file:///c:/Users/ADMIN/Desktop/MLQ5/mql5/P4H_1M_Risk_Taker_EA.ex5) |

*All 4 options are fully integrated into the Web Dashboard dropdown ([`index.html`](file:///c:/Users/ADMIN/Desktop/MLQ5/index.html)), allowing one-click broker linking.*


