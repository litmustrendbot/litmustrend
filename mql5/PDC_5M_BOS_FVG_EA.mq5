//+------------------------------------------------------------------+
//|                                     PDC_5M_BOS_FVG_EA.mq5        |
//|                        Copyright 2026, LitmusTrend Automated Bot |
//|                                       https://litmustrend.com    |
//+------------------------------------------------------------------+
#property copyright "LitmusTrend 2026"
#property link      "https://litmustrend.com"
#property version   "1.00"
#property description "PDC 5M BOS + FVG Strategy Expert Advisor for MetaTrader 5"

#include <Trade\Trade.mqh>

//--- INPUT PARAMETERS
input group "=== 1. Risk & Capital Management (10% Risk per Trade) ==="
input double   InpRiskPercent       = 10.0;           // Risk Percent per Trade (%)
input double   InpTakeProfitR       = 10.0;           // Final Take Profit Target (R:R Multiple)
input bool     InpEnableStepped     = true;           // Enable Stepped Trailing Stop (9.5R - 9.9R)
input int      InpMaxConsecLossDay  = 3;              // Max Consecutive Losses Per Day (0 = Disabled)

input group "=== 2. Daily Session & Previous Day Close (PDC) Bias ==="
input bool     InpUsePdcFilter      = true;           // Filter Trades by Previous Day Close
input color    InpPdcColor          = clrBlack;       // Previous Day Close Line Color (2x thick)

input group "=== 3. 5M Market Structure / BOS ==="
input int      InpPivotLookback     = 3;              // Internal Pivot Lookback (Bars left/right)
input bool     InpConfirmCloseWick  = true;           // BOS Candle Close Beyond Initiating Wick
input color    InpBosColor          = clrBlack;       // BOS Line Color (1x thick)

input group "=== 4. Zone & Entry Refinement ==="
input bool     InpUseFvgRefine      = true;           // Use FVG Entry Refinement
input int      InpMaxBarsWait       = 25;             // Max Bars to Wait for Retracement

input group "=== 5. Chart Visuals & Styling (Matching TradingView) ==="
input bool     InpShowZones         = true;           // Draw Entry Area Rectangle (FVG / Zone)
input bool     InpShowPositionTool  = true;           // Draw Long/Short Position Tool (Blue/Grey)
input bool     InpShowBosLine       = true;           // Draw BOS Horizontal Line
input bool     InpShowPdcLine       = true;           // Draw Previous Day Close Line
input bool     InpShowDashboard     = true;           // Show On-Chart Status Dashboard
input int      InpPosWidth          = 10;             // Position Tool Width (Bars)
input color    InpTargetColor       = C'33,150,243';  // Target Box Color (Sky Blue #2196F3)
input color    InpStopColor         = C'120,123,134'; // Stop Loss Box Color (Slate Grey #787B86)
input color    InpBullEntryColor    = C'38,166,154';  // Bullish Entry Line Color (Green #26A69A)
input color    InpBearEntryColor    = C'239,83,80';   // Bearish Entry Line Color (Red #EF5350)
input color    InpFvgColor          = C'255,167,38';  // FVG Box Color (Orange #FFA726)
input color    InpDemandColor       = clrDodgerBlue;  // Demand Zone Color
input color    InpSupplyColor       = clrCrimson;     // Supply Zone Color

input group "=== 6. EA Identification & Execution ==="
input ulong    InpMagicNumber       = 55505;          // Unique EA Magic Number
input ulong    InpSlippage          = 10;             // Allowed Slippage (Points)

//--- DEFINITIONS & PREFIXES
#define OBJ_PREFIX "PDC_BOS_"

//--- GLOBAL VARIABLES
CTrade         m_trade;
datetime       m_last5MBarTime      = 0;
datetime       m_lastDayTime        = 0;
double         m_pdcPrice           = 0.0;

int            m_dailyConsecLosses  = 0;
datetime       m_lastHistoryCheck   = 0;

// Market Structure tracking
double         m_lastSwingHigh      = 0.0;
datetime       m_lastSwingHighTime  = 0;
int            m_lastSwingHighShift = 0;

double         m_lastSwingLow       = 0.0;
datetime       m_lastSwingLowTime   = 0;
int            m_lastSwingLowShift  = 0;

// Pending Setup State
bool           m_setupPending       = false;
int            m_setupDir           = 0; // +1 Long, -1 Short
double         m_setupEntry         = 0.0;
double         m_setupSL            = 0.0;
double         m_setupRiskDist      = 0.0;
datetime       m_setupTime          = 0;
int            m_setupBarShift      = 0;
ulong          m_pendingOrderTicket = 0;

// Active Trade Tracking
double         m_activeEntry        = 0.0;
double         m_activeRisk         = 0.0;
double         m_peakR              = 0.0;
ulong          m_activeTicket       = 0;

//+------------------------------------------------------------------+
//| Check if Trading is Halted Today by Circuit Breaker              |
//+------------------------------------------------------------------+
bool IsDailyHalted()
{
   return (InpMaxConsecLossDay > 0 && m_dailyConsecLosses >= InpMaxConsecLossDay);
}

//+------------------------------------------------------------------+
//| Update Daily Consecutive Losses from Account Deal History        |
//+------------------------------------------------------------------+
void UpdateDailyLosses()
{
   datetime dayStart = iTime(_Symbol, PERIOD_D1, 0);
   if(HistorySelect(dayStart, TimeCurrent()))
   {
      int dealsTotal = HistoryDealsTotal();
      int consec = 0;
      for(int i = 0; i < dealsTotal; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket > 0)
         {
            long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
            string sym = HistoryDealGetString(ticket, DEAL_SYMBOL);
            long entryType = HistoryDealGetInteger(ticket, DEAL_ENTRY);
            
            if(sym == _Symbol && magic == InpMagicNumber && entryType == DEAL_ENTRY_OUT)
            {
               double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
               if(profit < 0)
                  consec++;
               else if(profit > 0)
                  consec = 0; // Reset streak on a win
            }
         }
      }
      m_dailyConsecLosses = consec;
   }
}

//+------------------------------------------------------------------+
//| Update Previous Day Close Price and Render 2x Black Line         |
//+------------------------------------------------------------------+
void UpdatePDC()
{
   MqlRates dailyRates[];
   ArraySetAsSeries(dailyRates, true);
   if(CopyRates(_Symbol, PERIOD_D1, 1, 2, dailyRates) >= 1)
   {
      m_pdcPrice = dailyRates[0].close;
      if(InpShowPdcLine)
      {
         string lineName = OBJ_PREFIX + "PDC_LINE";
         ObjectDelete(0, lineName);
         if(ObjectCreate(0, lineName, OBJ_HLINE, 0, 0, m_pdcPrice))
         {
            ObjectSetInteger(0, lineName, OBJPROP_COLOR, InpPdcColor);
            ObjectSetInteger(0, lineName, OBJPROP_WIDTH, 2);
            ObjectSetInteger(0, lineName, OBJPROP_STYLE, STYLE_SOLID);
            ObjectSetString(0, lineName, OBJPROP_TEXT, "Previous Day Close");
            ObjectSetInteger(0, lineName, OBJPROP_SELECTABLE, false);
            ObjectSetInteger(0, lineName, OBJPROP_BACK, true);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Draw Horizontal BOS Line                                         |
//+------------------------------------------------------------------+
void DrawBOSLine(string name, datetime t1, double price, datetime t2)
{
   ObjectDelete(0, name);
   if(ObjectCreate(0, name, OBJ_TREND, 0, t1, price, t2, price))
   {
      ObjectSetInteger(0, name, OBJPROP_COLOR, InpBosColor);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
      ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_SOLID);
      ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_BACK, true);
   }
}

//+------------------------------------------------------------------+
//| Draw Visual Rectangle Box (FVG, Demand/Supply, Position Tool)    |
//+------------------------------------------------------------------+
void DrawBox(string name, datetime t1, double p1, datetime t2, double p2, color bgClr, color borderClr, int width)
{
   ObjectDelete(0, name);
   if(ObjectCreate(0, name, OBJ_RECTANGLE, 0, t1, p1, t2, p2))
   {
      ObjectSetInteger(0, name, OBJPROP_COLOR, borderClr);
      ObjectSetInteger(0, name, OBJPROP_BGCOLOR, bgClr);
      ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_SOLID);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, width);
      ObjectSetInteger(0, name, OBJPROP_FILL, true);
      ObjectSetInteger(0, name, OBJPROP_BACK, true);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   }
}

//+------------------------------------------------------------------+
//| Draw Entry Price Level Line                                      |
//+------------------------------------------------------------------+
void DrawEntryLine(string name, datetime t1, double price, datetime t2, color clr)
{
   ObjectDelete(0, name);
   if(ObjectCreate(0, name, OBJ_TREND, 0, t1, price, t2, price))
   {
      ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, 2);
      ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_SOLID);
      ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_BACK, true);
   }
}

//+------------------------------------------------------------------+
//+------------------------------------------------------------------+
//| Calculate Dynamic Lot Size for Exact 10% Account Equity Risk     |
//+------------------------------------------------------------------+
double CalculateLotSize(double entryPrice, double slPrice)
{
   double riskDist = MathAbs(entryPrice - slPrice);
   if(riskDist <= 0) return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);

   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize <= 0) tickSize = _Point;

   double lossPerLot = (riskDist / tickSize) * tickValue;
   if(lossPerLot <= 0) return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);

   // Calculate dynamic risk amount: 10% of Current Account Equity
   double accountEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   if(accountEquity <= 0) accountEquity = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskAmount = accountEquity * (InpRiskPercent / 100.0);

   double calculatedLots = riskAmount / lossPerLot;

   // Safe leverage limit: prevent excessive margin exposure on tiny stops
   double maxSafeUnits  = (accountEquity * 100.0) / entryPrice; // 100x leverage cap
   double contractSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_CONTRACT_SIZE);
   if(contractSize > 0)
   {
      double maxSafeLots = maxSafeUnits / contractSize;
      calculatedLots = MathMin(calculatedLots, maxSafeLots);
   }

   double minLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   calculatedLots = MathFloor(calculatedLots / lotStep) * lotStep;
   if(calculatedLots < minLot) calculatedLots = minLot;
   if(calculatedLots > maxLot) calculatedLots = maxLot;

   return NormalizeDouble(calculatedLots, 2);
}

//+------------------------------------------------------------------+
//| Check Open Positions Count Managed by this EA                    |
//+------------------------------------------------------------------+
int OpenPositionsCount()
{
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
         count++;
   }
   return count;
}

//+------------------------------------------------------------------+
//| Check Open Orders Count Managed by this EA                       |
//+------------------------------------------------------------------+
int OpenOrdersCount()
{
   int count = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0 && OrderGetString(ORDER_SYMBOL) == _Symbol && OrderGetInteger(ORDER_MAGIC) == InpMagicNumber)
         count++;
   }
   return count;
}

//+------------------------------------------------------------------+
//| Cancel All Pending Orders Managed by this EA                     |
//+------------------------------------------------------------------+
void CancelPendingOrders()
{
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0 && OrderGetString(ORDER_SYMBOL) == _Symbol && OrderGetInteger(ORDER_MAGIC) == InpMagicNumber)
      {
         m_trade.OrderDelete(ticket);
      }
   }
   m_setupPending = false;
   m_pendingOrderTicket = 0;
}

//+------------------------------------------------------------------+
//| Update On-Chart HUD Dashboard                                    |
//+------------------------------------------------------------------+
void UpdateDashboard()
{
   if(!InpShowDashboard) return;

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   double curClose = 0.0;
   if(CopyRates(_Symbol, PERIOD_CURRENT, 0, 1, rates) >= 1)
      curClose = rates[0].close;

   string biasStr = "NEUTRAL";
   if(m_pdcPrice > 0)
      biasStr = (curClose > m_pdcPrice) ? "BULLISH (Longs Only)" : "BEARISH (Shorts Only)";

   string posStr = "FLAT";
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
      {
         long type = PositionGetInteger(POSITION_TYPE);
         posStr = (type == POSITION_TYPE_BUY) ? "LONG" : "SHORT";
         break;
      }
   }
   if(posStr == "FLAT" && m_setupPending)
   {
      posStr = (m_setupDir == 1) ? "PENDING BUY LIMIT" : "PENDING SELL LIMIT";
   }

   string circuitStr = IsDailyHalted() ? "HALTED (3 Losses Hit)" : ("ACTIVE (" + IntegerToString(m_dailyConsecLosses) + "/" + IntegerToString(InpMaxConsecLossDay) + " Losses)");

   string text = "\n";
   text += "====================================================\n";
   text += "   PDC 5M BOS + FVG STRATEGY (MQL5 EA)\n";
   text += "====================================================\n";
   double currentRiskUsd = AccountInfoDouble(ACCOUNT_EQUITY) * (InpRiskPercent / 100.0);
   text += " Instrument / Broker     : " + _Symbol + " [" + TerminalInfoString(TERMINAL_COMPANY) + "]\n";
   text += " Account Equity          : $" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + "\n";
   text += " Risk per Trade          : " + DoubleToString(InpRiskPercent, 1) + "% ($" + DoubleToString(currentRiskUsd, 2) + ")\n";
   text += " Take Profit Target      : " + DoubleToString(InpTakeProfitR, 1) + "R\n";
   text += " Daily Directional Bias  : " + biasStr + "\n";
   text += " Previous Day Close (PDC): " + DoubleToString(m_pdcPrice, _Digits) + "\n";
   text += " Current Strategy State  : " + posStr + "\n";
   text += " Peak R:R Achieved       : " + DoubleToString(m_peakR, 2) + "R\n";
   text += " Daily Circuit Breaker   : " + circuitStr + "\n";
   text += " Open Positions / Orders : " + IntegerToString(OpenPositionsCount()) + " pos / " + IntegerToString(OpenOrdersCount()) + " ord\n";
   text += "====================================================\n";
   Comment(text);
}

//+------------------------------------------------------------------+
//| Scan for Internal Swing Points (3 Bars Left / 3 Bars Right)      |
//+------------------------------------------------------------------+
void UpdateSwingPoints(const MqlRates &rates[], int total)
{
   int lookback = InpPivotLookback;
   if(total < (lookback * 2 + 5)) return;

   // Check if bar 4 (i = lookback + 1) was a pivot high/low
   int checkShift = lookback + 1;

   // Swing High Check
   bool isSwingHigh = true;
   for(int k = 1; k <= lookback; k++)
   {
      if(rates[checkShift].high <= rates[checkShift + k].high || rates[checkShift].high <= rates[checkShift - k].high)
      {
         isSwingHigh = false;
         break;
      }
   }
   if(isSwingHigh)
   {
      m_lastSwingHigh      = rates[checkShift].high;
      m_lastSwingHighTime  = rates[checkShift].time;
      m_lastSwingHighShift = checkShift;
   }

   // Swing Low Check
   bool isSwingLow = true;
   for(int k = 1; k <= lookback; k++)
   {
      if(rates[checkShift].low >= rates[checkShift + k].low || rates[checkShift].low >= rates[checkShift - k].low)
      {
         isSwingLow = false;
         break;
      }
   }
   if(isSwingLow)
   {
      m_lastSwingLow      = rates[checkShift].low;
      m_lastSwingLowTime  = rates[checkShift].time;
      m_lastSwingLowShift = checkShift;
   }
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("Initializing PDC 5M BOS + FVG Expert Advisor...");
   m_trade.SetExpertMagicNumber(InpMagicNumber);
   m_trade.SetMarginMode();
   m_trade.SetTypeFillingBySymbol(_Symbol);
   m_trade.SetDeviationInPoints(InpSlippage);

   UpdatePDC();
   UpdateDailyLosses();
   UpdateDashboard();

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   ObjectsDeleteAll(0, OBJ_PREFIX);
   Comment("");
   Print("PDC 5M BOS + FVG EA deinitialized.");
}

//+------------------------------------------------------------------+
//| Active Trade Management (Stepped Trailing Stop 9.5R -> 10R TP)   |
//+------------------------------------------------------------------+
void ManageActiveTrade()
{
   int openCount = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
      {
         openCount++;
         ulong ticket = PositionGetInteger(POSITION_TICKET);
         long type    = PositionGetInteger(POSITION_TYPE);
         double curSL = PositionGetDouble(POSITION_SL);
         double curTP = PositionGetDouble(POSITION_TP);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);

         if(m_activeTicket != ticket)
         {
            m_activeTicket = ticket;
            m_activeEntry  = openPrice;
            m_activeRisk   = (m_setupRiskDist > 0) ? m_setupRiskDist : MathAbs(openPrice - curSL);
            m_peakR        = 0.0;
         }

         double curPrice = (type == POSITION_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         double currentR = 0.0;

         if(type == POSITION_TYPE_BUY)
         {
            currentR = (curPrice - m_activeEntry) / (m_activeRisk > 0 ? m_activeRisk : _Point);
            m_peakR  = MathMax(m_peakR, currentR);

            if(InpEnableStepped && m_activeRisk > 0)
            {
               double newSL = curSL;
               if(m_peakR >= 9.9)
                  newSL = MathMax(curSL, m_activeEntry + (9.0 * m_activeRisk));
               else if(m_peakR >= 9.8)
                  newSL = MathMax(curSL, m_activeEntry + (8.0 * m_activeRisk));
               else if(m_peakR >= 9.7)
                  newSL = MathMax(curSL, m_activeEntry + (7.0 * m_activeRisk));
               else if(m_peakR >= 9.6)
                  newSL = MathMax(curSL, m_activeEntry + (6.0 * m_activeRisk));
               else if(m_peakR >= 9.5)
                  newSL = MathMax(curSL, m_activeEntry + (5.0 * m_activeRisk));

               newSL = NormalizeDouble(newSL, _Digits);
               if(newSL > curSL + _Point)
               {
                  PrintFormat("[STEPPED SL] Long #%d: Peak %.2fR -> Moving SL to %.5f", ticket, m_peakR, newSL);
                  m_trade.PositionModify(ticket, newSL, curTP);
               }
            }
         }
         else if(type == POSITION_TYPE_SELL)
         {
            currentR = (m_activeEntry - curPrice) / (m_activeRisk > 0 ? m_activeRisk : _Point);
            m_peakR  = MathMax(m_peakR, currentR);

            if(InpEnableStepped && m_activeRisk > 0)
            {
               double newSL = curSL;
               if(m_peakR >= 9.9)
                  newSL = MathMin(curSL, m_activeEntry - (9.0 * m_activeRisk));
               else if(m_peakR >= 9.8)
                  newSL = MathMin(curSL, m_activeEntry - (8.0 * m_activeRisk));
               else if(m_peakR >= 9.7)
                  newSL = MathMin(curSL, m_activeEntry - (7.0 * m_activeRisk));
               else if(m_peakR >= 9.6)
                  newSL = MathMin(curSL, m_activeEntry - (6.0 * m_activeRisk));
               else if(m_peakR >= 9.5)
                  newSL = MathMin(curSL, m_activeEntry - (5.0 * m_activeRisk));

               newSL = NormalizeDouble(newSL, _Digits);
               if(newSL < curSL - _Point && curSL > 0)
               {
                  PrintFormat("[STEPPED SL] Short #%d: Peak %.2fR -> Moving SL to %.5f", ticket, m_peakR, newSL);
                  m_trade.PositionModify(ticket, newSL, curTP);
               }
            }
         }
      }
   }

   if(openCount == 0)
   {
      m_activeTicket = 0;
      m_activeEntry  = 0.0;
   }
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // 1. Manage Active Positions on every tick (Live Stepped Trailing)
   ManageActiveTrade();
   UpdateDashboard();

   // 2. New Day Detection (Rollover PDC & Circuit Breaker)
   datetime curDayTime = iTime(_Symbol, PERIOD_D1, 0);
   if(curDayTime != m_lastDayTime)
   {
      m_lastDayTime = curDayTime;
      UpdatePDC();
      m_dailyConsecLosses = 0;
      Print("[NEW DAY] Daily session reset. Previous Day Close updated to ", m_pdcPrice);
   }

   // 3. New 5M Bar Check
   datetime cur5MTime = iTime(_Symbol, PERIOD_M5, 0);
   if(cur5MTime == m_last5MBarTime) return; // Only process strategy signals at bar close
   m_last5MBarTime = cur5MTime;

   // 4. Update Closed Trades Status
   UpdateDailyLosses();

   // 5. Check Daily Circuit Breaker
   if(IsDailyHalted())
   {
      if(m_setupPending)
         CancelPendingOrders();
      return;
   }

   // 6. Copy 5M Rates (Completed bars: shift 1 is just-closed bar)
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, PERIOD_M5, 0, 50, rates);
   if(copied < 35) return;

   // 7. Update Swing Points
   UpdateSwingPoints(rates, copied);

   // 8. Bias Check
   double close1 = rates[1].close;
   double close2 = rates[2].close;
   bool isBullishBias = !InpUsePdcFilter || (m_pdcPrice == 0.0) || (close1 > m_pdcPrice);
   bool isBearishBias = !InpUsePdcFilter || (m_pdcPrice == 0.0) || (close1 < m_pdcPrice);

   // 9. Minimum Zone Distance Filter
   double atr14 = (rates[1].high - rates[1].low);
   double minAllowedDist = MathMax(_Point * 5.0, atr14 * 0.15);

   // 10. Bullish BOS Condition
   bool bullishBOS = false;
   int bullOriginOffset = 1;
   double bullOriginHigh = rates[1].high;
   double bullOriginLow  = rates[1].low;

   if(!IsDailyHalted() && m_lastSwingHigh > 0 && (close1 > m_lastSwingHigh) && (close2 <= m_lastSwingHigh) && isBullishBias)
   {
      // Find origin lowest point between swing high and current bar
      double lowestVal = rates[1].low;
      int searchLen = MathMin(30, copied - 1);
      for(int s = 1; s <= searchLen; s++)
      {
         if(rates[s].low < lowestVal)
         {
            lowestVal = rates[s].low;
            bullOriginOffset = s;
         }
      }

      bool wickConfirmed = !InpConfirmCloseWick || (close1 > rates[bullOriginOffset].high);
      if(wickConfirmed)
      {
         bullishBOS     = true;
         bullOriginHigh = rates[bullOriginOffset].high;
         bullOriginLow  = rates[bullOriginOffset].low;

         if(InpShowBosLine)
         {
            string bosName = OBJ_PREFIX + "BOS_BULL_" + TimeToString(rates[1].time);
            DrawBOSLine(bosName, m_lastSwingHighTime, m_lastSwingHigh, rates[1].time);
         }
         PrintFormat("[BULLISH BOS] Confirmed at %.5f (Swing High: %.5f)", close1, m_lastSwingHigh);
      }
   }

   // 11. Bearish BOS Condition
   bool bearishBOS = false;
   int bearOriginOffset = 1;
   double bearOriginHigh = rates[1].high;
   double bearOriginLow  = rates[1].low;

   if(!IsDailyHalted() && m_lastSwingLow > 0 && (close1 < m_lastSwingLow) && (close2 >= m_lastSwingLow) && isBearishBias)
   {
      // Find origin highest point between swing low and current bar
      double highestVal = rates[1].high;
      int searchLen = MathMin(30, copied - 1);
      for(int s = 1; s <= searchLen; s++)
      {
         if(rates[s].high > highestVal)
         {
            highestVal = rates[s].high;
            bearOriginOffset = s;
         }
      }

      bool wickConfirmed = !InpConfirmCloseWick || (close1 < rates[bearOriginOffset].low);
      if(wickConfirmed)
      {
         bearishBOS     = true;
         bearOriginHigh = rates[bearOriginOffset].high;
         bearOriginLow  = rates[bearOriginOffset].low;

         if(InpShowBosLine)
         {
            string bosName = OBJ_PREFIX + "BOS_BEAR_" + TimeToString(rates[1].time);
            DrawBOSLine(bosName, m_lastSwingLowTime, m_lastSwingLow, rates[1].time);
         }
         PrintFormat("[BEARISH BOS] Confirmed at %.5f (Swing Low: %.5f)", close1, m_lastSwingLow);
      }
   }

   // 12. Register Bullish Setup on Confirmed BOS
   if(bullishBOS && OpenPositionsCount() == 0 && !IsDailyHalted())
   {
      CancelPendingOrders();

      bool hasFvg = false;
      double fvgEntryPrice = 0.0;
      double fvgSlPrice    = 0.0;
      int fvgStartBar      = 1;

      if(InpUseFvgRefine)
      {
         for(int k = 1; k <= 3; k++)
         {
            if(rates[k].low > rates[k + 2].high)
            {
               hasFvg = true;
               fvgEntryPrice = rates[k].low;
               fvgSlPrice    = rates[k + 2].high;
               fvgStartBar   = k + 2;
               break;
            }
         }
      }

      m_setupPending = true;
      m_setupDir     = 1;
      m_setupTime    = rates[1].time;
      m_setupBarShift= 1;

      datetime widthTime = rates[1].time + (InpPosWidth * 300);

      if(hasFvg)
      {
         m_setupEntry = fvgEntryPrice;
         m_setupSL    = fvgSlPrice;
         if(InpShowZones)
         {
            string fvgBox = OBJ_PREFIX + "FVG_" + TimeToString(rates[1].time);
            DrawBox(fvgBox, rates[fvgStartBar].time, fvgEntryPrice, widthTime, fvgSlPrice, InpFvgColor, clrOrange, 1);
         }
      }
      else
      {
         m_setupEntry = bullOriginHigh;
         m_setupSL    = bullOriginLow;
         if(InpShowZones)
         {
            string zoneBox = OBJ_PREFIX + "DEMAND_" + TimeToString(rates[1].time);
            DrawBox(zoneBox, rates[bullOriginOffset].time, bullOriginHigh, widthTime, bullOriginLow, InpDemandColor, clrBlue, 1);
         }
      }

      double rawDist = MathAbs(m_setupEntry - m_setupSL);
      m_setupRiskDist = MathMax(rawDist, minAllowedDist);
      m_setupSL       = m_setupEntry - m_setupRiskDist;

      if(m_setupSL >= m_setupEntry || m_setupRiskDist <= 0)
      {
         m_setupPending = false;
      }
      else
      {
         double tpLevel = m_setupEntry + (InpTakeProfitR * m_setupRiskDist);
         
         // Draw TradingView-style Position Tool
         if(InpShowPositionTool)
         {
            string tpBox = OBJ_PREFIX + "TP_BOX_" + TimeToString(rates[1].time);
            string slBox = OBJ_PREFIX + "SL_BOX_" + TimeToString(rates[1].time);
            string entLine = OBJ_PREFIX + "ENT_LINE_" + TimeToString(rates[1].time);

            DrawBox(tpBox, rates[1].time, tpLevel, widthTime, m_setupEntry, InpTargetColor, InpTargetColor, 1);
            DrawBox(slBox, rates[1].time, m_setupEntry, widthTime, m_setupSL, InpStopColor, InpStopColor, 1);
            DrawEntryLine(entLine, rates[1].time, m_setupEntry, widthTime, InpBullEntryColor);
         }

         // Place MT5 Buy Limit Order
         double lots = CalculateLotSize(m_setupEntry, m_setupSL);
         m_setupEntry = NormalizeDouble(m_setupEntry, _Digits);
         m_setupSL    = NormalizeDouble(m_setupSL, _Digits);
         tpLevel      = NormalizeDouble(tpLevel, _Digits);

         if(m_trade.BuyLimit(lots, m_setupEntry, _Symbol, m_setupSL, tpLevel, ORDER_TIME_GTC, 0, "PDC 5M Long"))
         {
            m_pendingOrderTicket = m_trade.ResultOrder();
            PrintFormat("[ORDER PLACED] Buy Limit #%d: %.2f lots at %.5f (SL: %.5f, TP: %.5f)", m_pendingOrderTicket, lots, m_setupEntry, m_setupSL, tpLevel);
         }
      }
   }

   // 13. Register Bearish Setup on Confirmed BOS
   if(bearishBOS && OpenPositionsCount() == 0 && !IsDailyHalted())
   {
      CancelPendingOrders();

      bool hasFvg = false;
      double fvgEntryPrice = 0.0;
      double fvgSlPrice    = 0.0;
      int fvgStartBar      = 1;

      if(InpUseFvgRefine)
      {
         for(int k = 1; k <= 3; k++)
         {
            if(rates[k].high < rates[k + 2].low)
            {
               hasFvg = true;
               fvgEntryPrice = rates[k].high;
               fvgSlPrice    = rates[k + 2].low;
               fvgStartBar   = k + 2;
               break;
            }
         }
      }

      m_setupPending = true;
      m_setupDir     = -1;
      m_setupTime    = rates[1].time;
      m_setupBarShift= 1;

      datetime widthTime = rates[1].time + (InpPosWidth * 300);

      if(hasFvg)
      {
         m_setupEntry = fvgEntryPrice;
         m_setupSL    = fvgSlPrice;
         if(InpShowZones)
         {
            string fvgBox = OBJ_PREFIX + "FVG_" + TimeToString(rates[1].time);
            DrawBox(fvgBox, rates[fvgStartBar].time, fvgSlPrice, widthTime, fvgEntryPrice, InpFvgColor, clrOrange, 1);
         }
      }
      else
      {
         m_setupEntry = bearOriginLow;
         m_setupSL    = bearOriginHigh;
         if(InpShowZones)
         {
            string zoneBox = OBJ_PREFIX + "SUPPLY_" + TimeToString(rates[1].time);
            DrawBox(zoneBox, rates[bearOriginOffset].time, bearOriginHigh, widthTime, bearOriginLow, InpSupplyColor, clrRed, 1);
         }
      }

      double rawDist = MathAbs(m_setupSL - m_setupEntry);
      m_setupRiskDist = MathMax(rawDist, minAllowedDist);
      m_setupSL       = m_setupEntry + m_setupRiskDist;

      if(m_setupSL <= m_setupEntry || m_setupRiskDist <= 0)
      {
         m_setupPending = false;
      }
      else
      {
         double tpLevel = m_setupEntry - (InpTakeProfitR * m_setupRiskDist);
         
         // Draw TradingView-style Position Tool
         if(InpShowPositionTool)
         {
            string tpBox = OBJ_PREFIX + "TP_BOX_" + TimeToString(rates[1].time);
            string slBox = OBJ_PREFIX + "SL_BOX_" + TimeToString(rates[1].time);
            string entLine = OBJ_PREFIX + "ENT_LINE_" + TimeToString(rates[1].time);

            DrawBox(tpBox, rates[1].time, m_setupEntry, widthTime, tpLevel, InpTargetColor, InpTargetColor, 1);
            DrawBox(slBox, rates[1].time, m_setupSL, widthTime, m_setupEntry, InpStopColor, InpStopColor, 1);
            DrawEntryLine(entLine, rates[1].time, m_setupEntry, widthTime, InpBearEntryColor);
         }

         // Place MT5 Sell Limit Order
         double lots = CalculateLotSize(m_setupEntry, m_setupSL);
         m_setupEntry = NormalizeDouble(m_setupEntry, _Digits);
         m_setupSL    = NormalizeDouble(m_setupSL, _Digits);
         tpLevel      = NormalizeDouble(tpLevel, _Digits);

         if(m_trade.SellLimit(lots, m_setupEntry, _Symbol, m_setupSL, tpLevel, ORDER_TIME_GTC, 0, "PDC 5M Short"))
         {
            m_pendingOrderTicket = m_trade.ResultOrder();
            PrintFormat("[ORDER PLACED] Sell Limit #%d: %.2f lots at %.5f (SL: %.5f, TP: %.5f)", m_pendingOrderTicket, lots, m_setupEntry, m_setupSL, tpLevel);
         }
      }
   }

   // 14. Invalidation Check for Pending Limit Orders
   if(m_setupPending && OpenPositionsCount() == 0)
   {
      int barsWaiting = iBarShift(_Symbol, PERIOD_M5, m_setupTime);
      if(barsWaiting > InpMaxBarsWait)
      {
         PrintFormat("[CANCELLED] Pending setup expired after %d bars without retracement fill.", barsWaiting);
         CancelPendingOrders();
      }
      else if(m_setupDir == 1 && rates[1].low <= m_setupSL)
      {
         PrintFormat("[CANCELLED] Long setup invalidated: price violated SL (%.5f) before entry fill.", m_setupSL);
         CancelPendingOrders();
      }
      else if(m_setupDir == -1 && rates[1].high >= m_setupSL)
      {
         PrintFormat("[CANCELLED] Short setup invalidated: price violated SL (%.5f) before entry fill.", m_setupSL);
         CancelPendingOrders();
      }
   }
}
//+------------------------------------------------------------------+
