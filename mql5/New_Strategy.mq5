//+------------------------------------------------------------------+
//|                                             New_Strategy.mq5     |
//|                                       https://litmustrend.com    |
//+------------------------------------------------------------------+
#property copyright   "LitmusTrend"
#property link        "https://litmustrend.com"
#property version     "3.00"
#property description "New Strategy (Option C): 15M FVG + 5M Confirmation + User Stepped Ladder Trailing Stop (Single 5% Position)"

#include <Trade\Trade.mqh>

//--- Input Parameters
input group "=== 1. Risk & Dynamic Compounding Profile ==="
input double   InpTotalRiskPercent       = 1.0;                // Risk per Trade (% of Total Current Equity)
input double   InpMaxLotSizeCap          = 10.0;               // Max Single Order Lot Size Cap (Broker Liquidity Limit)
input int      InpMaxConcurrentPositions = 10;                 // Max Concurrent Positions (Trade All Setups)
input int      InpSecondsBeforeClose     = 5;                  // Pre-Close Execution Buffer (Seconds before 5M close)

input group "=== 2. Market Structure & 15M FVG Setup ==="
input int      InpPivotLookback          = 3;                  // 15M Fractal Pivot Lookback (bars)
input bool     InpFilterByDailyClose     = true;               // Macro Trend Filter: Previous Day Close (PDC)
input int      InpBosSearchBars          = 15;                 // Max 15M bars back from BOS to search for impulse FVG
input int      InpMaxFvgPerBos           = 2;                  // Max FVGs recorded per BOS impulse
input int      InpZoneExpiryBars5M       = 150;                // 5M Bars before FVG Zone Expires (~12.5 hours)

input group "=== 3. Expert Advisor Identity ==="
input ulong    InpMagicNumber            = 155025;             // EA Magic Number

//--- Structural POI Zone Definition
struct SFvgZone
{
   int      direction;         // +1 Bullish, -1 Bearish
   double   zoneTop;           // Upper boundary
   double   zoneBottom;        // Lower boundary
   datetime createdTime;       // 15M creation timestamp
   int      createdBar5M;      // 5M bar index
   bool     isActive;          // Waiting for entry
   double   highestHighInZone; // Highest high formed inside zone
   double   lowestLowInZone;   // Lowest low formed inside zone
   double   lastOppLow;        // Last bullish candle low (for bearish setup)
   double   lastOppHigh;       // Last bearish candle high (for bullish setup)
   bool     cand1Seen;         // 1st reversal candle checked
};

//--- Global Variables & State
CTrade         m_trade;
SFvgZone       m_zones[];
double         m_dailyClosePrice    = 0.0;
datetime       m_lastD1BarTime      = 0;
datetime       m_last15MBarTime     = 0;
datetime       m_last5MBarTime      = 0;

double         m_last15mSwingHigh   = 0.0;
double         m_last15mSwingLow    = 0.0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   if(_Period != PERIOD_M5)
   {
      Alert("[NEW STRATEGY ERROR] Please attach this EA directly to a 5-MINUTE (M5) chart!");
      return INIT_FAILED;
   }

   ArrayResize(m_zones, 0);
   m_trade.SetExpertMagicNumber(InpMagicNumber);
   PrintFormat("[NEW STRATEGY INITIALIZED] Single 1%% Position with Stepped Ladder Trailing Stop (1:3 BE -> 1:5 @ 1:1 -> 1:9 @ 1:5 -> 1:10 @ 1:6 ...)");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   ArrayFree(m_zones);
}

//+------------------------------------------------------------------+
//| Calculate User Stepped Ladder Locked R                           |
//+------------------------------------------------------------------+
double GetUserLadderLockedR(double maxR)
{
   if(maxR >= 40.0)      return MathFloor(maxR - 4.0);
   else if(maxR >= 39.0) return 35.0;
   else if(maxR >= 35.0) return 31.0;
   else if(maxR >= 33.0) return 30.0;
   else if(maxR >= 30.0) return 26.0;
   else if(maxR >= 29.0) return 25.0;
   else if(maxR >= 25.0) return 21.0;
   else if(maxR >= 23.0) return 20.0;
   else if(maxR >= 20.0) return 16.0;
   else if(maxR >= 19.0) return 15.0;
   else if(maxR >= 15.0) return 11.0;
   else if(maxR >= 13.0) return 10.0;
   else if(maxR >= 10.0) return 6.0;
   else if(maxR >= 9.0)  return 5.0;
   else if(maxR >= 5.0)  return 1.0;
   else if(maxR >= 3.0)  return 0.0; // 1:3 Break-Even
   else                  return -1.0; // Initial SL
}

//+------------------------------------------------------------------+
//| Manage Open Positions: User Stepped Ladder Trailing Stop         |
//+------------------------------------------------------------------+
void ManageOpenPositions()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagicNumber) continue;

      long   posType   = PositionGetInteger(POSITION_TYPE);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentPr = PositionGetDouble(POSITION_PRICE_CURRENT);

      // Extract initial risk distance
      string comment = PositionGetString(POSITION_COMMENT);
      double initialRisk = 0.0;
      
      // If comment contains initial risk distance
      if(StringFind(comment, "Risk:") >= 0)
      {
         string sub = StringSubstr(comment, StringFind(comment, "Risk:") + 5);
         initialRisk = StringToDouble(sub);
      }
      
      if(initialRisk <= 0)
      {
         if(posType == POSITION_TYPE_BUY && currentSL < openPrice && currentSL > 0)
            initialRisk = openPrice - currentSL;
         else if(posType == POSITION_TYPE_SELL && currentSL > openPrice)
            initialRisk = currentSL - openPrice;
      }

      if(initialRisk <= 0) continue;

      if(posType == POSITION_TYPE_BUY)
      {
         double curR = (currentPr - openPrice) / initialRisk;
         double lockedR = GetUserLadderLockedR(curR);
         if(lockedR >= 0.0)
         {
            double targetSL = NormalizeDouble(openPrice + (lockedR * initialRisk), _Digits);
            if(targetSL > currentSL + (_Point * 2.0))
            {
               m_trade.SetExpertMagicNumber(InpMagicNumber);
               m_trade.PositionModify(ticket, targetSL, 0.0);
               PrintFormat("[BUY SL TRAIL UPDATED] Ticket #%I64u | Max R: %.2f | New SL: %.5f (Locked: +%.1fR)", ticket, curR, targetSL, lockedR);
            }
         }
      }
      else if(posType == POSITION_TYPE_SELL)
      {
         double curR = (openPrice - currentPr) / initialRisk;
         double lockedR = GetUserLadderLockedR(curR);
         if(lockedR >= 0.0)
         {
            double targetSL = NormalizeDouble(openPrice - (lockedR * initialRisk), _Digits);
            if(currentSL == 0 || targetSL < currentSL - (_Point * 2.0))
            {
               m_trade.SetExpertMagicNumber(InpMagicNumber);
               m_trade.PositionModify(ticket, targetSL, 0.0);
               PrintFormat("[SELL SL TRAIL UPDATED] Ticket #%I64u | Max R: %.2f | New SL: %.5f (Locked: +%.1fR)", ticket, curR, targetSL, lockedR);
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Update Previous Day Close (D1 PDC)                               |
//+------------------------------------------------------------------+
void UpdateMacroD1Filter()
{
   datetime d1Time = iTime(_Symbol, PERIOD_D1, 0);
   if(d1Time != m_lastD1BarTime)
   {
      m_lastD1BarTime = d1Time;
      MqlRates d1Rates[];
      ArraySetAsSeries(d1Rates, true);
      if(CopyRates(_Symbol, PERIOD_D1, 1, 1, d1Rates) > 0)
      {
         m_dailyClosePrice = d1Rates[0].close;
      }
   }
}

//+------------------------------------------------------------------+
//| Update 15M Market Structure & Impulse FVGs                       |
//+------------------------------------------------------------------+
void Update15MStructure()
{
   datetime m15Time = iTime(_Symbol, PERIOD_M15, 0);
   if(m15Time == m_last15MBarTime) return;
   m_last15MBarTime = m15Time;

   MqlRates r15[];
   ArraySetAsSeries(r15, true);
   int needed = InpPivotLookback * 2 + InpBosSearchBars + 10;
   if(CopyRates(_Symbol, PERIOD_M15, 1, needed, r15) < needed) return;

   // 1. Identify 15M Swing Points
   for(int i = 1; i <= 20; i++)
   {
      bool isHigh = true;
      bool isLow  = true;
      for(int k = 1; k <= InpPivotLookback; k++)
      {
         if(r15[i].high <= r15[i - k].high || r15[i].high < r15[i + k].high) isHigh = false;
         if(r15[i].low  >= r15[i - k].low  || r15[i].low  > r15[i + k].low)  isLow  = false;
      }
      if(isHigh && m_last15mSwingHigh == 0.0) m_last15mSwingHigh = r15[i].high;
      if(isLow  && m_last15mSwingLow  == 0.0) m_last15mSwingLow  = r15[i].low;
      if(m_last15mSwingHigh > 0 && m_last15mSwingLow > 0) break;
   }

   // 2. Check 15M Candle Close for BOS
   double c1 = r15[0].close;
   double c2 = r15[1].close;

   bool macroBull = !InpFilterByDailyClose || (m_dailyClosePrice == 0.0) || (c1 >  m_dailyClosePrice);
   bool macroBear = !InpFilterByDailyClose || (m_dailyClosePrice == 0.0) || (c1 <  m_dailyClosePrice);

   bool bullishBOS = macroBull && (m_last15mSwingHigh > 0) && (c1 > m_last15mSwingHigh) && (c2 <= m_last15mSwingHigh);
   bool bearishBOS = macroBear && (m_last15mSwingLow  > 0) && (c1 < m_last15mSwingLow)  && (c2 >= m_last15mSwingLow);

   if(bullishBOS || bearishBOS)
   {
      int fvgCount = 0;
      for(int k = 0; k < InpBosSearchBars - 2 && fvgCount < InpMaxFvgPerBos; k++)
      {
         if(bullishBOS)
         {
            if(r15[k].low > r15[k + 2].high)
            {
               SFvgZone zone;
               zone.direction          = 1;
               zone.zoneTop            = r15[k].low;
               zone.zoneBottom         = r15[k + 1].low;
               zone.createdTime        = r15[0].time;
               zone.createdBar5M       = 0;
               zone.isActive           = true;
               zone.lowestLowInZone    = 999999.0;
               zone.highestHighInZone  = 0.0;
               zone.lastOppLow         = 0.0;
               zone.lastOppHigh        = 0.0;
               zone.cand1Seen          = false;

               int sz = ArraySize(m_zones);
               ArrayResize(m_zones, sz + 1);
               m_zones[sz] = zone;
               fvgCount++;
            }
         }
         else if(bearishBOS)
         {
            if(r15[k].high < r15[k + 2].low)
            {
               SFvgZone zone;
               zone.direction          = -1;
               zone.zoneBottom         = r15[k].high;
               zone.zoneTop            = r15[k + 1].high;
               zone.createdTime        = r15[0].time;
               zone.createdBar5M       = 0;
               zone.isActive           = true;
               zone.lowestLowInZone    = 999999.0;
               zone.highestHighInZone  = 0.0;
               zone.lastOppLow         = 0.0;
               zone.lastOppHigh        = 0.0;
               zone.cand1Seen          = false;

               int sz = ArraySize(m_zones);
               ArrayResize(m_zones, sz + 1);
               m_zones[sz] = zone;
               fvgCount++;
            }
         }
      }

      if(bullishBOS) m_last15mSwingHigh = r15[0].high;
      if(bearishBOS) m_last15mSwingLow  = r15[0].low;
   }
}

//+------------------------------------------------------------------+
//| Check 5M Reversal Confirmation inside Active 15M FVGs            |
//+------------------------------------------------------------------+
void Check5MConfirmation()
{
   datetime m5Time = iTime(_Symbol, PERIOD_M5, 0);
   datetime curTime = TimeCurrent();
   int secondsIntoBar = (int)(curTime - m5Time);
   int secondsRemaining = 300 - secondsIntoBar;

   // Pre-close timing check
   if(InpSecondsBeforeClose > 0)
   {
      // Wait until we are within the final N seconds of the 5M candle
      if(secondsRemaining > InpSecondsBeforeClose) return;
      if(m5Time == m_last5MBarTime) return; // Already evaluated this bar
   }
   else
   {
      // Traditional execution on bar open
      if(m5Time == m_last5MBarTime) return;
   }
   m_last5MBarTime = m5Time;

   // Check max concurrent positions (allows trading all simultaneous setups)
   int currentOpenPositions = 0;
   for(int p = PositionsTotal() - 1; p >= 0; p--)
   {
      ulong t = PositionGetTicket(p);
      if(PositionSelectByTicket(t) && PositionGetString(POSITION_SYMBOL) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
         currentOpenPositions++;
   }
   if(currentOpenPositions >= InpMaxConcurrentPositions)
      return;

   MqlRates r5[];
   ArraySetAsSeries(r5, true);
   
   // If executing 5s before close, copy bar 0 (forming candle); otherwise copy bar 1 (closed candle)
   int startBar = (InpSecondsBeforeClose > 0) ? 0 : 1;
   if(CopyRates(_Symbol, PERIOD_M5, startBar, 3, r5) < 3) return;

   double o1 = r5[0].open,  h1 = r5[0].high,  l1 = r5[0].low,  c1 = r5[0].close;
   bool isBull5M = c1 > o1;
   bool isBear5M = c1 < o1;

   for(int i = ArraySize(m_zones) - 1; i >= 0; i--)
   {
      if(!m_zones[i].isActive) continue;

      m_zones[i].createdBar5M++;
      if(m_zones[i].createdBar5M > InpZoneExpiryBars5M)
      {
         m_zones[i].isActive = false;
         continue;
      }

      // --- BEARISH SETUP (Waiting for 5M reversal inside Bearish FVG) ---
      if(m_zones[i].direction == -1)
      {
         bool inZone = (h1 >= m_zones[i].zoneBottom);
         if(inZone)
            m_zones[i].highestHighInZone = MathMax(m_zones[i].highestHighInZone, h1);

         if(!inZone && m_zones[i].lastOppLow == 0.0) continue;

         if(isBull5M)
         {
            m_zones[i].lastOppLow  = l1;
            m_zones[i].cand1Seen   = false;
            continue;
         }
         else if(isBear5M && m_zones[i].lastOppLow > 0)
         {
            bool trigger = false;
            if(c1 < m_zones[i].lastOppLow)
               trigger = true;
            else if(!m_zones[i].cand1Seen)
            {
               m_zones[i].cand1Seen = true;
               continue;
            }
            else if(m_zones[i].cand1Seen)
               trigger = true;

            if(trigger)
            {
               double entryPrice = c1;
               double slPrice    = m_zones[i].zoneTop; // Option C Structural SL
               double minSlDist  = 0.50;
               if(slPrice < entryPrice + minSlDist) slPrice = entryPrice + minSlDist;

               double riskDist   = slPrice - entryPrice;
               double lots       = CalculateLotSize(entryPrice, slPrice, InpTotalRiskPercent);

               string orderComment = StringFormat("Ladder5M Risk:%.2f", riskDist);
               m_trade.SetExpertMagicNumber(InpMagicNumber);
               if(m_trade.Sell(lots, _Symbol, entryPrice, slPrice, 0.0, orderComment))
               {
                  PrintFormat("[SELL ENTERED] Lots: %.2f @ %.5f | Structural SL: %.5f | Stepped Ladder Active", lots, entryPrice, slPrice);
               }

               m_zones[i].isActive = false;
            }
         }
      }
      // --- BULLISH SETUP (Waiting for 5M reversal inside Bullish FVG) ---
      else if(m_zones[i].direction == 1)
      {
         bool inZone = (l1 <= m_zones[i].zoneTop);
         if(inZone)
            m_zones[i].lowestLowInZone = MathMin(m_zones[i].lowestLowInZone, l1);

         if(!inZone && m_zones[i].lastOppHigh == 0.0) continue;

         if(isBear5M)
         {
            m_zones[i].lastOppHigh = h1;
            m_zones[i].cand1Seen   = false;
            continue;
         }
         else if(isBull5M && m_zones[i].lastOppHigh > 0)
         {
            bool trigger = false;
            if(c1 > m_zones[i].lastOppHigh)
               trigger = true;
            else if(!m_zones[i].cand1Seen)
            {
               m_zones[i].cand1Seen = true;
               continue;
            }
            else if(m_zones[i].cand1Seen)
               trigger = true;

            if(trigger)
            {
               double entryPrice = c1;
               double slPrice    = m_zones[i].zoneBottom; // Option C Structural SL
               double minSlDist  = 0.50;
               if(slPrice > entryPrice - minSlDist) slPrice = entryPrice - minSlDist;

               double riskDist   = entryPrice - slPrice;
               double lots       = CalculateLotSize(entryPrice, slPrice, InpTotalRiskPercent);

               string orderComment = StringFormat("Ladder5M Risk:%.2f", riskDist);
               m_trade.SetExpertMagicNumber(InpMagicNumber);
               if(m_trade.Buy(lots, _Symbol, entryPrice, slPrice, 0.0, orderComment))
               {
                  PrintFormat("[BUY ENTERED] Lots: %.2f @ %.5f | Structural SL: %.5f | Stepped Ladder Active", lots, entryPrice, slPrice);
               }

               m_zones[i].isActive = false;
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Calculate Lot Size with DYNAMIC COMPOUNDING (% of Total Equity)  |
//+------------------------------------------------------------------+
double CalculateLotSize(double entryPrice, double slPrice, double riskPercent)
{
   double riskDist = MathAbs(entryPrice - slPrice);
   if(riskDist <= 0) return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);

   double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   if(tickSize <= 0 || tickValue <= 0) return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);

   double lossPerLot = (riskDist / tickSize) * tickValue;
   if(lossPerLot <= 0) return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);

   double equity     = AccountInfoDouble(ACCOUNT_EQUITY);
   double riskAmount = equity * (riskPercent / 100.0);

   double calculatedLots = riskAmount / lossPerLot;

   double minLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot  = MathMin(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX), InpMaxLotSizeCap);
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   calculatedLots = MathMax(minLot, MathMin(maxLot, calculatedLots));
   calculatedLots = MathFloor(calculatedLots / lotStep) * lotStep;

   return NormalizeDouble(calculatedLots, 2);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // 1. Manage Stepped Ladder Trailing Stop on every price tick
   ManageOpenPositions();

   // 2. Update D1 Macro Filter & 15M Structure
   UpdateMacroD1Filter();
   Update15MStructure();

   // 3. Scan for 5M Reversal Confirmations
   Check5MConfirmation();
}
//+------------------------------------------------------------------+
