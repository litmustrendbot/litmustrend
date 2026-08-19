"""
LitmusTrend Python MT5 Bridge & Signal Engine
Connects MetaTrader 5 locally via Python API and syncs with Supabase / Vercel API
"""

import sys
import time
import requests
import json

# Try importing MetaTrader5 module
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False
    print("[NOTICE] MetaTrader5 package not installed. Install via: pip install MetaTrader5")

VERCEL_API_URL = "https://litmustrend.vercel.app/api/ea/log-trade"
SECRET_KEY = "LITMUS_DEFAULT_SECRET_2026"

def initialize_mt5():
    if not MT5_AVAILABLE:
        print("[ERROR] MetaTrader5 module is missing.")
        return False
        
    if not mt5.initialize():
        print(f"[ERROR] MT5 initialization failed. Code: {mt5.last_error()}")
        return False
        
    account_info = mt5.account_info()
    if account_info is not None:
        print(f"[SUCCESS] Connected to MT5 Account: {account_info.login} ({account_info.company})")
        print(f"Balance: ${account_info.balance:.2f} | Equity: ${account_info.equity:.2f}")
    return True

def sync_open_positions():
    if not MT5_AVAILABLE:
        return
        
    positions = mt5.positions_get()
    if positions is None:
        print("[INFO] No open positions in MT5.")
        return
        
    print(f"[SYNC] Found {len(positions)} open positions. Syncing to LitmusTrend website...")
    for pos in positions:
        payload = {
            "account_number": pos.login,
            "symbol": pos.symbol,
            "trade_type": "BUY" if pos.type == 0 else "SELL",
            "lots": pos.volume,
            "open_price": pos.price_open,
            "secret_key": SECRET_KEY
        }
        
        try:
            res = requests.post(VERCEL_API_URL, json=payload, timeout=5)
            print(f"Position #{pos.ticket} ({pos.symbol}) synced. API Status: {res.status_code}")
        except Exception as e:
            print(f"[ERROR] Failed to send position to website: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("      LitmusTrend Python MT5 Bridge Engine      ")
    print("=" * 60)
    
    if initialize_mt5():
        print("\nStarting live position monitoring loop (Ctrl+C to stop)...")
        try:
            while True:
                sync_open_positions()
                time.sleep(10)
        except KeyboardInterrupt:
            print("\nShutting down MT5 Python bridge.")
            mt5.shutdown()
