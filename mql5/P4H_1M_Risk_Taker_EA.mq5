//+------------------------------------------------------------------+
//|                                     P4H_1M_BOS_FVG_EA.mq5        |
//|                        Copyright 2026, LitmusTrend Automated Bot |
//|                                       https://litmustrend.com    |
//+------------------------------------------------------------------+
#property copyright "LitmusTrend 2026"
#property link      "https://litmustrend.com"
#property version   "1.00"
#property description "P4H 1M BOS + FVG - Risk Taker (10% Risk) Expert Advisor"

#include <Trade\Trade.mqh>

enum ENUM_STRATEGY_TIER
{
   TIER_SAFE_HAVEN = 0, // Safe Haven (1.0% Equity Risk â€¢ Prop Firm Safe)
   TIER_RISK_TAKER = 1, // Risk Taker (10.0% Equity Risk â€¢ High Growth)
   TIER_CUSTOM     = 2  // Custom Risk ($10 Fixed USD or Custom %)
};

enum ENUM_RISK_MODE
{
   RISK_MODE_FIXED_USD = 0, // Fixed Dollar Amount ($)
   RISK_MODE_PERCENT   = 1  // Percent of Equity (%)
};

//--- INPUT PARAMETERS
input group "=== 1. Strategy Tier & Capital Risk ==="
input ENUM_STRATEGY_TIER InpStrategyTier = TIER_RISK_TAKER; // Default Risk Taker 10% Risk // Account Strategy Tier Profile
input ENUM_RISK_MODE InpRiskMode    = RISK_MODE_PERCENT; // Custom Risk Mode (if Tier = Custom)
input double   InpRiskUsd           = 10.0;           // Custom Risk Amount ($) (if Fixed USD)
input double   InpRiskPercent       = 1.0;            // Custom Risk Percent (%) (if Percent)
input double   InpTakeProfitR       = 10.0;           // Final Take Profit Target (R:R Multiple)
input bool     InpEnableStepped     = true;           // Enable Stepped Trailing Stop (9.5R - 9.9R)
input int      InpMaxConsecLossDay  = 0;              // Max Consecutive Losses Per Day (0 = Disabled)
input int      InpMaxConsecLoss4H   = 3;              // Max Consecutive Losses Per 4H (Pause until next 4H candle)
input bool     InpOnlyOneTrade      = true;           // Do Not Open Another Trade While Running (true = strictly one trade)
input int      InpMaxTradesPerDay   = 0;              // Max Trades Per Day (0 = Unlimited, 1 = One Trade/Day)

input group "=== 2. Higher Timeframe & Previous 4H Close (P4HC) Bias ==="
input bool     InpUseP4hFilter      = true;           // Filter Trades by Previous 4H Close
input color    InpP4hColor          = clrBlack;       // Previous 4H Close Line Color (2x thick)

input group "=== 3. 1M Market Structure / BOS ==="
input int      InpPivotLookback     = 3;              // Internal Pivot Lookback (Bars left/right)
input bool     InpConfirmCloseWick  = true;           // BOS Candle Close Beyond Initiating Wick
input color    InpBosColor          = clrBlack;       // BOS Line Color (1x thick)

input group "=== 4. Zone & Entry Refinement ==="
input bool     InpUseFvgRefine      = true;           // Use FVG Entry Refinement
input int      InpMaxBarsWait       = 25;             // Max Bars to Wait for Retracement (1M Bars)

input group "=== 5. Chart Visuals & Styling (Matching TradingView) ==="
input bool     InpShowZones         = true;           // Draw Entry Area Rectangle (FVG / Zone)
input bool     InpShowPositionTool  = true;           // Draw Long/Short Position Tool (Blue/Grey)
input bool     InpShowBosLine       = true;           // Draw BOS Horizontal Line
input bool     InpShowP4hLine       = true;           // Draw Previous 4H Close Line
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
input ulong    InpMagicNumber       = 55501;          // Unique EA Magic Number (4H-1M)
input ulong    InpSlippage          = 10;             // Allowed Slippage (Points)

//--- DEFINITIONS & PREFIXES
#define OBJ_PREFIX "P4H_BOS_"

//--- GLOBAL VARIABLES
CTrade         m_trade;
datetime       m_last1MBarTime      = 0;
datetime       m_lastDayTime        = 0;
datetime       m_last4HTime         = 0;
double         m_p4hPrice           = 0.0;

// Runtime Strategy Tier Variables
ulong          g_magic              = 44401;
ENUM_RISK_MODE g_riskMode           = RISK_MODE_PERCENT;
double         g_riskPercent        = 1.0;
double         g_riskUsd            = 10.0;
string         g_tierName           = "Safe Haven (1% Risk)";

int            m_dailyConsecLosses  = 0;
int            m_4hConsecLosses     = 0;
int            m_dailyTradesCount   = 0;
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
//| Check if Trading is Halted Today by Circuit Breakers             |
//+------------------------------------------------------------------+
bool IsDailyHalted()
{
   return (InpMaxConsecLossDay > 0 && m_dailyConsecLosses >= InpMaxConsecLossDay);
}

bool Is4hHalted()
{
   return (InpMaxConsecLoss4H > 0 && m_4hConsecLosses >= InpMaxConsecLoss4H);
}

bool IsTradingHalted()
{
   return (IsDailyHalted() || Is4hHalted());
}

//+------------------------------------------------------------------+
//| Update Consecutive Losses (Daily & 4-Hour) from Deal History     |
//+------------------------------------------------------------------+
void UpdateLosses()
{
   datetime dayStart = iTime(_Symbol, PERIOD_D1, 0);
   datetime h4Start  = iTime(_Symbol, PERIOD_H4, 0);
   
   if(HistorySelect(dayStart, TimeCurrent()))
   {
      int dealsTotal = HistoryDealsTotal();
      int consecDay = 0;
      int consec4H  = 0;
      
      for(int i = 0; i < dealsTotal; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket > 0)
         {
            long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
            string sym = HistoryDealGetString(ticket, DEAL_SYMBOL);
            long entryType = HistoryDealGetInteger(ticket, DEAL_ENTRY);
            
            if(sym == _Symbol && magic == g_magic && entryType == DEAL_ENTRY_OUT)
            {
               double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
               datetime dealTime = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
               
               if(profit < 0)
                  consecDay++;
               else if(profit > 0)
                  consecDay = 0; // Reset daily streak on a win
                  
               if(dealTime >= h4Start)
               {
                  if(profit < 0)
                     consec4H++;
                  else if(profit > 0)
                     consec4H = 0; // Reset 4H streak on a win
               }
            }
         }
      }
      m_dailyConsecLosses = consecDay;
      m_4hConsecLosses    = consec4H;
   }
}

//+------------------------------------------------------------------+
//| Update Previous 4H Close Price and Render 2x Black Line          |
//+------------------------------------------------------------------+
void UpdateP4H()
{
   MqlRates h4Rates[];
   ArraySetAsSeries(h4Rates, true);
   if(CopyRates(_Symbol, PERIOD_H4, 1, 2, h4Rates) >= 1)
   {
      m_p4hPrice = h4Rates[0].close;
      if(InpShowP4hLine)
      {
         string lineName = OBJ_PREFIX + "P4H_LINE";
         ObjectDelete(0, lineName);
         if(ObjectCreate(0, lineName, OBJ_HLINE, 0, 0, m_p4hPrice))
         {
            ObjectSetInteger(0, lineName, OBJPROP_COLOR, InpP4hColor);
            ObjectSetInteger(0, lineName, OBJPROP_WIDTH, 2);
            ObjectSetInteger(0, lineName, OBJPROP_STYLE, STYLE_SOLID);
            ObjectSetString(0, lineName, OBJPROP_TEXT, "Previous 4H Close");
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

   // Calculate risk amount: Fixed Dollar Amount or Percent of Current Account Equity
   double accountEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   if(accountEquity <= 0) accountEquity = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskAmount = (g_riskMode == RISK_MODE_FIXED_USD) ? g_riskUsd : (accountEquity * (g_riskPercent / 100.0));

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
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == g_magic)
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
      if(ticket > 0 && OrderGetString(ORDER_SYMBOL) == _Symbol && OrderGetInteger(ORDER_MAGIC) == g_magic)
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
      if(ticket > 0 && OrderGetString(ORDER_SYMBOL) == _Symbol && OrderGetInteger(ORDER_MAGIC) == g_magic)
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
   if(m_p4hPrice > 0)
      biasStr = (curClose > m_p4hPrice) ? "BULLISH (Longs Only)" : "BEARISH (Shorts Only)";

   string posStr = "FLAT";
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == g_magic)
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

   string circuitStr = "ACTIVE";
   if(IsDailyHalted())
      circuitStr = "HALTED (Daily 3 Losses)";
   else if(Is4hHalted())
      circuitStr = "HALTED (4H 3 Losses)";
   else
      circuitStr = "ACTIVE (" + IntegerToString(m_dailyConsecLosses) + "/" + IntegerToString(InpMaxConsecLossDay) + " Day, " + IntegerToString(m_4hConsecLosses) + "/" + IntegerToString(InpMaxConsecLoss4H) + " 4H)";

   string text = "\n";
   text += "====================================================\n";
   text += "   P4H 1M BOS + FVG STRATEGY (MQL5 EA)\n";
   text += "====================================================\n";
   double currentRiskUsd = (g_riskMode == RISK_MODE_FIXED_USD) ? g_riskUsd : (AccountInfoDouble(ACCOUNT_EQUITY) * (g_riskPercent / 100.0));
   string riskStr = (g_riskMode == RISK_MODE_FIXED_USD) ? ("$" + DoubleToString(g_riskUsd, 2) + " Fixed") : (DoubleToString(g_riskPercent, 1) + "% ($" + DoubleToString(currentRiskUsd, 2) + ")");
   text += " Strategy Tier Profile   : " + g_tierName + "\n";
   text += " Instrument / Broker     : " + _Symbol + " [" + TerminalInfoString(TERMINAL_COMPANY) + "]\n";
   text += " Timeframe Setup         : 1M Execution / 4H Bias\n";
   text += " Account Equity          : $" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + "\n";
   text += " Risk per Trade          : " + riskStr + "\n";
   text += " Take Profit Target      : " + DoubleToString(InpTakeProfitR, 1) + "R\n";
   text += " 4H Directional Bias     : " + biasStr + "\n";
   text += " Previous 4H Close (P4HC): " + DoubleToString(m_p4hPrice, _Digits) + "\n";
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
   Print("Initializing P4H 1M BOS + FVG Expert Advisor...");

   if(InpStrategyTier == TIER_SAFE_HAVEN)
   {
      g_magic = 44401;
      g_riskMode = RISK_MODE_PERCENT;
      g_riskPercent = 1.0;
      g_tierName = "Safe Haven (1% Risk â€¢ Prop Firm Safe)";
   }
   else if(InpStrategyTier == TIER_RISK_TAKER)
   {
      g_magic = 44410;
      g_riskMode = RISK_MODE_PERCENT;
      g_riskPercent = 10.0;
      g_tierName = "Risk Taker (10% Risk â€¢ High Growth)";
   }
   else
   {
      g_magic = InpMagicNumber;
      g_riskMode = InpRiskMode;
      g_riskPercent = InpRiskPercent;
      g_riskUsd = InpRiskUsd;
      g_tierName = "Custom Risk Profile";
   }

   m_trade.SetExpertMagicNumber(g_magic);
   m_trade.SetMarginMode();
   m_trade.SetTypeFillingBySymbol(_Symbol);
   m_trade.SetDeviationInPoints(InpSlippage);

   UpdateP4H();
   UpdateLosses();
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
   Print("P4H 1M BOS + FVG EA deinitialized.");
}

//+------------------------------------------------------------------+
//| Active Trade Management (Stepped Trailing Stop 9.5R -> 10R TP)   |
//+------------------------------------------------------------------+
void ManageActiveTrade()
{
   int openCount = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == g_magic)
      {
         openCount++;
         ulong ticket = PositionGetInteger(POSITION_TICKET);
         long type    = PositionGetInteger(POSITION_TYPE);
         double curSL = PositionGetDouble(POSITION_SL);
         double curTP = PositionGetDouble(POSITION_TP);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);

         // Calculate independent risk distance for this specific position
         double posRisk = 0.0;
         if(curTP > 0 && InpTakeProfitR > 0)
            posRisk = MathAbs(curTP - openPrice) / InpTakeProfitR;
         else if(curSL > 0)
            posRisk = MathAbs(openPrice - curSL);

         if(posRisk <= 0) posRisk = _Point * 10.0;

         double curPrice = (type == POSITION_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         double currentR = 0.0;

         if(type == POSITION_TYPE_BUY)
         {
            currentR = (curPrice - openPrice) / posRisk;
            m_peakR  = MathMax(m_peakR, currentR);

            if(InpEnableStepped && posRisk > 0)
            {
               double newSL = curSL;
               if(currentR >= 9.9)
                  newSL = MathMax(curSL, openPrice + (9.0 * posRisk));
               else if(currentR >= 9.8)
                  newSL = MathMax(curSL, openPrice + (8.0 * posRisk));
               else if(currentR >= 9.7)
                  newSL = MathMax(curSL, openPrice + (7.0 * posRisk));
               else if(currentR >= 9.6)
                  newSL = MathMax(curSL, openPrice + (6.0 * posRisk));
               else if(currentR >= 9.5)
                  newSL = MathMax(curSL, openPrice + (5.0 * posRisk));

               newSL = NormalizeDouble(newSL, _Digits);
               if(newSL > curSL + _Point)
               {
                  PrintFormat("[STEPPED SL] Long #%d: Current %.2fR -> Moving SL to %.5f", ticket, currentR, newSL);
                  m_trade.PositionModify(ticket, newSL, curTP);
               }
            }
         }
         else if(type == POSITION_TYPE_SELL)
         {
            currentR = (openPrice - curPrice) / posRisk;
            m_peakR  = MathMax(m_peakR, currentR);

            if(InpEnableStepped && posRisk > 0)
            {
               double newSL = curSL;
               if(currentR >= 9.9)
                  newSL = MathMin(curSL, openPrice - (9.0 * posRisk));
               else if(currentR >= 9.8)
                  newSL = MathMin(curSL, openPrice - (8.0 * posRisk));
               else if(currentR >= 9.7)
                  newSL = MathMin(curSL, openPrice - (7.0 * posRisk));
               else if(currentR >= 9.6)
                  newSL = MathMin(curSL, openPrice - (6.0 * posRisk));
               else if(currentR >= 9.5)
                  newSL = MathMin(curSL, openPrice - (5.0 * posRisk));

               newSL = NormalizeDouble(newSL, _Digits);
               if((curSL <= 0 || newSL < curSL - _Point) && newSL > 0)
               {
                  PrintFormat("[STEPPED SL] Short #%d: Current %.2fR -> Moving SL to %.5f", ticket, currentR, newSL);
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

   // 2. New Day Detection (Rollover Circuit Breaker)
   datetime curDayTime = iTime(_Symbol, PERIOD_D1, 0);
   if(curDayTime != m_lastDayTime)
   {
      m_lastDayTime = curDayTime;
      m_dailyConsecLosses = 0;
      m_dailyTradesCount  = 0;
   }

   // 3. New 4H Period Detection (Rollover 4H Bias & 4H Circuit Breaker)
   datetime cur4HTime = iTime(_Symbol, PERIOD_H4, 0);
   if(cur4HTime != m_last4HTime)
   {
      m_last4HTime = cur4HTime;
      m_4hConsecLosses = 0;
      UpdateP4H();
   }

   // 4. New 1M Bar Check
   datetime cur1MTime = iTime(_Symbol, PERIOD_M1, 0);
   if(cur1MTime == m_last1MBarTime) return; // Only process strategy signals at bar close
   m_last1MBarTime = cur1MTime;

   // 5. Update Closed Trades Status
   UpdateLosses();

   // 6. Check Circuit Breakers (Daily & 4H)
   if(IsTradingHalted())
   {
      if(m_setupPending)
         CancelPendingOrders();
      return;
   }

   // 7. Copy 1M Rates (Completed bars: shift 1 is just-closed bar)
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, PERIOD_M1, 0, 50, rates);
   if(copied < 35) return;

   // 8. Update Swing Points
   UpdateSwingPoints(rates, copied);

   // 9. Bias Check
   double close1 = rates[1].close;
   double close2 = rates[2].close;
   bool isBullishBias = !InpUseP4hFilter || (m_p4hPrice == 0.0) || (close1 > m_p4hPrice);
   bool isBearishBias = !InpUseP4hFilter || (m_p4hPrice == 0.0) || (close1 < m_p4hPrice);

   // 10. Minimum Zone Distance Filter
   double atr14 = (rates[1].high - rates[1].low);
   double minAllowedDist = MathMax(_Point * 5.0, atr14 * 0.15);

   // 11. Bullish BOS Condition
   bool bullishBOS = false;
   int bullOriginOffset = 1;
   double bullOriginHigh = rates[1].high;
   double bullOriginLow  = rates[1].low;

   if(!IsTradingHalted() && m_lastSwingHigh > 0 && (close1 > m_lastSwingHigh) && (close2 <= m_lastSwingHigh) && isBullishBias)
   {
      // Find origin lowest point between swing high and current bar
      double lowestVal = rates[1].low;
      int searchLen = MathMin(30, (m_lastSwingHighShift > 1) ? (m_lastSwingHighShift - 1) : 10);
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
         PrintFormat("[BULLISH BOS 1M] Confirmed at %.5f (Swing High: %.5f)", close1, m_lastSwingHigh);
      }
   }

   // 12. Bearish BOS Condition
   bool bearishBOS = false;
   int bearOriginOffset = 1;
   double bearOriginHigh = rates[1].high;
   double bearOriginLow  = rates[1].low;

   if(!IsTradingHalted() && m_lastSwingLow > 0 && (close1 < m_lastSwingLow) && (close2 >= m_lastSwingLow) && isBearishBias)
   {
      // Find origin highest point between swing low and current bar
      double highestVal = rates[1].high;
      int searchLen = MathMin(30, (m_lastSwingLowShift > 1) ? (m_lastSwingLowShift - 1) : 10);
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
         PrintFormat("[BEARISH BOS 1M] Confirmed at %.5f (Swing Low: %.5f)", close1, m_lastSwingLow);
      }
   }

   bool canTakeTrade = (!InpOnlyOneTrade || OpenPositionsCount() == 0) && (InpMaxTradesPerDay == 0 || m_dailyTradesCount < InpMaxTradesPerDay) && !IsTradingHalted();

   // 13. Register Bullish Setup on Confirmed BOS
   if(bullishBOS && canTakeTrade)
   {
      CancelPendingOrders(); // Replace any waiting pending order with the fresh BOS setup

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

      datetime widthTime = rates[1].time + (InpPosWidth * 60); // 1M bar = 60s

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

         if(m_trade.BuyLimit(lots, m_setupEntry, _Symbol, m_setupSL, tpLevel, ORDER_TIME_GTC, 0, "P4H 1M Long"))
         {
            m_pendingOrderTicket = m_trade.ResultOrder();
            PrintFormat("[ORDER PLACED] Buy Limit #%d: %.2f lots at %.5f (SL: %.5f, TP: %.5f)", m_pendingOrderTicket, lots, m_setupEntry, m_setupSL, tpLevel);
         }
      }
   }

   // 14. Register Bearish Setup on Confirmed BOS
   if(bearishBOS && canTakeTrade)
   {
      if(InpOnlyOneTrade) CancelPendingOrders();

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

      datetime widthTime = rates[1].time + (InpPosWidth * 60); // 1M bar = 60s

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

         if(m_trade.SellLimit(lots, m_setupEntry, _Symbol, m_setupSL, tpLevel, ORDER_TIME_GTC, 0, "P4H 1M Short"))
         {
            m_pendingOrderTicket = m_trade.ResultOrder();
            PrintFormat("[ORDER PLACED] Sell Limit #%d: %.2f lots at %.5f (SL: %.5f, TP: %.5f)", m_pendingOrderTicket, lots, m_setupEntry, m_setupSL, tpLevel);
         }
      }
   }

   // 15. Invalidation Check for Pending Limit Orders (1M Bars)
   if(m_setupPending && OpenPositionsCount() == 0)
   {
      int barsWaiting = iBarShift(_Symbol, PERIOD_M1, m_setupTime);
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
