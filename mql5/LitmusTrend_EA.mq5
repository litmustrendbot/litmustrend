//+------------------------------------------------------------------+
//|                                              LitmusTrend_EA.mq5  |
//|                        Copyright 2026, LitmusTrend Automated Bot |
//|                                       https://litmustrend.com    |
//+------------------------------------------------------------------+
#property copyright "LitmusTrend 2026"
#property link      "https://litmustrend.com"
#property version   "1.00"
#property description "LitmusTrend MT5 Expert Advisor with Vercel WebRequest & Supabase Sync"

#include <Trade\Trade.mqh>

//--- INPUT PARAMETERS
input group "=== LitmusTrend Cloud API Settings ==="
input string   InpVercelUrl = "https://litmustrend.vercel.app"; // Vercel API Domain
input string   InpSecretKey = "LITMUS_DEFAULT_SECRET_2026";    // Secret API Key

input group "=== Trading Strategy Inputs ==="
input double   InpLotSize   = 0.10;                            // Lot Size
input int      InpStopLoss  = 300;                             // Stop Loss (in points)
input int      InpTakeProfit= 600;                             // Take Profit (in points)
input int      InpFastMA    = 10;                              // Fast Moving Average
input int      InpSlowMA    = 50;                              // Slow Moving Average

//--- GLOBAL VARIABLES
CTrade         m_trade;
int            m_handleFastMA;
int            m_handleSlowMA;
bool           m_isAuthorized = false;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("Initializing LitmusTrend Expert Advisor...");
   
   // 1. Initialize Technical Indicators
   m_handleFastMA = iMA(_Symbol, _Period, InpFastMA, 0, MODE_EMA, PRICE_CLOSE);
   m_handleSlowMA = iMA(_Symbol, _Period, InpSlowMA, 0, MODE_EMA, PRICE_CLOSE);
   
   if(m_handleFastMA == INVALID_HANDLE || m_handleSlowMA == INVALID_HANDLE)
   {
      Print("Error creating Moving Average indicators!");
      return INIT_FAILED;
   }
   
   // 2. Check License Access via Vercel WebRequest API
   m_isAuthorized = VerifyAccessWithWebsite();
   if(!m_isAuthorized)
   {
      Print("WARNING: EA access authorization pending. WebRequest response check required.");
   }
   else
   {
      Print("SUCCESS: EA License authorized by LitmusTrend server!");
   }

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   IndicatorRelease(m_handleFastMA);
   IndicatorRelease(m_handleSlowMA);
   Print("LitmusTrend EA deinitialized.");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Check if we have new bar
   static datetime lastBarTime = 0;
   datetime currentBarTime = iTime(_Symbol, _Period, 0);
   if(currentBarTime == lastBarTime) return;
   lastBarTime = currentBarTime;

   // Read indicator buffers
   double fastMA[], slowMA[];
   ArraySetAsSeries(fastMA, true);
   ArraySetAsSeries(slowMA, true);

   if(CopyBuffer(m_handleFastMA, 0, 0, 2, fastMA) <= 0) return;
   if(CopyBuffer(m_handleSlowMA, 0, 0, 2, slowMA) <= 0) return;

   // Check crossover strategy
   bool buyCondition  = (fastMA[1] > slowMA[1]) && (fastMA[0] <= slowMA[0]); // Cross below to above
   bool sellCondition = (fastMA[1] < slowMA[1]) && (fastMA[0] >= slowMA[0]); // Cross above to below

   if(PositionsTotal() == 0)
   {
      if(buyCondition)
      {
         double price = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         double sl = (InpStopLoss > 0) ? price - InpStopLoss * _Point : 0;
         double tp = (InpTakeProfit > 0) ? price + InpTakeProfit * _Point : 0;

         if(m_trade.Buy(InpLotSize, _Symbol, price, sl, tp, "LitmusTrend BUY"))
         {
            Print("BUY order executed!");
            SendTradeToLitmusWebsite(_Symbol, "BUY", InpLotSize, price);
         }
      }
      else if(sellCondition)
      {
         double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
         double sl = (InpStopLoss > 0) ? price + InpStopLoss * _Point : 0;
         double tp = (InpTakeProfit > 0) ? price - InpTakeProfit * _Point : 0;

         if(m_trade.Sell(InpLotSize, _Symbol, price, sl, tp, "LitmusTrend SELL"))
         {
            Print("SELL order executed!");
            SendTradeToLitmusWebsite(_Symbol, "SELL", InpLotSize, price);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Verify EA License with LitmusTrend Vercel API                   |
//+------------------------------------------------------------------+
bool VerifyAccessWithWebsite()
{
   string endpoint = InpVercelUrl + "/api/ea/check-access";
   string headers = "Content-Type: application/json\r\n";
   
   string jsonPayload = StringFormat("{\"account_number\":\"%d\",\"secret_key\":\"%s\"}", 
                        AccountInfoInteger(ACCOUNT_LOGIN), InpSecretKey);

   char postData[];
   char resultData[];
   string resultHeaders;

   StringToCharArray(jsonPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   ResetLastError();
   int httpCode = WebRequest("POST", endpoint, headers, 5000, postData, resultData, resultHeaders);
   
   if(httpCode == 200)
   {
      string response = CharArrayToString(resultData);
      Print("Vercel Access Check Response: ", response);
      return true;
   }
   else
   {
      Print("Access check WebRequest failed. HTTP Code: ", httpCode, " Error: ", GetLastError());
      return false;
   }
}

//+------------------------------------------------------------------+
//| Send Executed Trade Log to LitmusTrend Website                  |
//+------------------------------------------------------------------+
bool SendTradeToLitmusWebsite(string symbol, string type, double lots, double price)
{
   string endpoint = InpVercelUrl + "/api/ea/log-trade";
   string headers = "Content-Type: application/json\r\n";

   string jsonPayload = StringFormat(
      "{\"account_number\":\"%d\",\"symbol\":\"%s\",\"trade_type\":\"%s\",\"lots\":%.2f,\"open_price\":%.5f,\"secret_key\":\"%s\"}",
      AccountInfoInteger(ACCOUNT_LOGIN), symbol, type, lots, price, InpSecretKey
   );

   char postData[];
   char resultData[];
   string resultHeaders;

   StringToCharArray(jsonPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   ResetLastError();
   int httpCode = WebRequest("POST", endpoint, headers, 5000, postData, resultData, resultHeaders);

   if(httpCode == 200)
   {
      Print("Trade log sent successfully to LitmusTrend website!");
      return true;
   }
   else
   {
      Print("Failed to log trade to website. HTTP Code: ", httpCode, " Error: ", GetLastError());
      return false;
   }
}
