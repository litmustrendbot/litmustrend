"""
=============================================================================
LITMUSTREND - LIVE PYTHON MT5 TRADING BOT
Strategy: New Strategy (Option C: 15M FVG + 5M Reversal Confirmation)
Trailing Stop: User Stepped Trailing Ladder (1:3 BE -> 1:5 @ 1:1 -> 1:9 @ 1:5 ...)
Risk Profile: Dynamic 5.0% Account Equity Risk per Trade (Cent Account Ready)
=============================================================================
"""

import time
import math
import logging
from datetime import datetime, timezone
import MetaTrader5 as mt5
import numpy as np

# ---------------------------------------------------------------------------
# CONFIGURATION & PARAMETERS
# ---------------------------------------------------------------------------
SYMBOL_PREFERENCE = ["XAUUSDm", "XAUUSD", "GOLD"] # Auto-detects your broker's symbol
MAGIC_NUMBER      = 155025
RISK_PERCENT      = 1.0         # 1.0% of dynamic account balance/equity per trade
MAX_LOT_CAP       = 10.0        # Max lot size cap for broker liquidity
PIVOT_LOOKBACK    = 3           # 15M Fractal pivot lookback (bars)
BOS_SEARCH_BARS   = 15          # Max 15M bars back to find impulse FVG
MAX_FVG_PER_BOS   = 2           # Max FVGs stored per BOS impulse
ZONE_EXPIRY_BARS  = 150         # 5M bars before zone expires (~12.5 hrs)
MIN_SL_DIST       = 0.50        # Minimum SL distance in dollars ($0.50)
POLL_INTERVAL_SEC = 2.0         # Check interval in seconds

# Configure clean logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("bot.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger("LitmusBot")

# ---------------------------------------------------------------------------
# USER STEPPED LADDER TRAILING STOP FUNCTION
# ---------------------------------------------------------------------------
def get_user_ladder_locked_r(max_r: float) -> float:
    if max_r >= 40.0:      return math.floor(max_r - 4.0)
    elif max_r >= 39.0:    return 35.0
    elif max_r >= 35.0:    return 31.0
    elif max_r >= 33.0:    return 30.0
    elif max_r >= 30.0:    return 26.0
    elif max_r >= 29.0:    return 25.0
    elif max_r >= 25.0:    return 21.0
    elif max_r >= 23.0:    return 20.0
    elif max_r >= 20.0:    return 16.0
    elif max_r >= 19.0:    return 15.0
    elif max_r >= 15.0:    return 11.0
    elif max_r >= 13.0:    return 10.0
    elif max_r >= 10.0:    return 6.0
    elif max_r >= 9.0:     return 5.0
    elif max_r >= 5.0:     return 1.0
    elif max_r >= 3.0:     return 0.0  # 1:3 Break-Even
    else:                  return -1.0 # Initial SL

# ---------------------------------------------------------------------------
# BOT ENGINE CLASS
# ---------------------------------------------------------------------------
class LitmusTradingBot:
    def __init__(self):
        self.symbol = None
        self.digits = 2
        self.point = 0.01
        self.zones = []
        self.last_d1_time = 0
        self.pdc = 0.0
        self.last_15m_time = 0
        self.last_5m_time = 0
        self.last_sh = 0.0
        self.last_sl = 0.0
        self.position_max_r = {} # ticket -> max_r

    def connect(self) -> bool:
        """Connects to local MetaTrader 5 terminal."""
        if not mt5.initialize():
            log.error(f"Failed to initialize MT5: {mt5.last_error()}")
            return False
            
        terminal_info = mt5.terminal_info()
        account_info = mt5.account_info()
        log.info(f"Connected to MT5 Build {terminal_info.build} | Account #{account_info.login} ({account_info.company})")
        log.info(f"Equity: ${account_info.equity:,.2f} | Leverage: 1:{account_info.leverage}")

        # Auto-detect symbol
        for s in SYMBOL_PREFERENCE:
            info = mt5.symbol_info(s)
            if info is not None:
                if not info.visible:
                    mt5.symbol_select(s, True)
                self.symbol = s
                self.digits = info.digits
                self.point = info.point
                log.info(f"Active Trading Symbol: {self.symbol} (Digits: {self.digits}, Point: {self.point})")
                return True

        log.error(f"None of the target symbols {SYMBOL_PREFERENCE} found in Market Watch!")
        return False

    def update_pdc(self):
        """Updates Previous Day Close (D1 PDC) for macro trend alignment."""
        rates_d1 = mt5.copy_rates_from_pos(self.symbol, mt5.TIMEFRAME_D1, 0, 2)
        if rates_d1 is not None and len(rates_d1) >= 2:
            d1_time = int(rates_d1[-1]['time'])
            if d1_time != self.last_d1_time:
                self.last_d1_time = d1_time
                self.pdc = float(rates_d1[-2]['close'])
                log.info(f"[MACRO FILTER UPDATE] Previous Day Close (PDC): ${self.pdc:.2f}")

    def update_15m_structure(self):
        """Scans 15M candles for Fractal BOS and maps active FVG zones."""
        rates_15m = mt5.copy_rates_from_pos(self.symbol, mt5.TIMEFRAME_M15, 0, PIVOT_LOOKBACK * 2 + BOS_SEARCH_BARS + 15)
        if rates_15m is None or len(rates_15m) < (PIVOT_LOOKBACK * 2 + BOS_SEARCH_BARS + 10):
            return

        cur_15m_t = int(rates_15m[-1]['time'])
        if cur_15m_t == self.last_15m_time:
            return
        self.last_15m_time = cur_15m_t

        # Completed bars: exclude index -1 (currently forming bar)
        closed_bars = rates_15m[:-1]
        n_c = len(closed_bars)

        # 1. Identify 15M Swings (Lookback=3)
        self.last_sh = 0.0
        self.last_sl = 0.0
        for i in range(n_c - 1 - PIVOT_LOOKBACK, max(0, n_c - 25), -1):
            h_i = closed_bars[i]['high']
            l_i = closed_bars[i]['low']
            is_sh = True
            is_sl = True
            for k in range(1, PIVOT_LOOKBACK + 1):
                if closed_bars[i - k]['high'] >= h_i or closed_bars[i + k]['high'] > h_i:
                    is_sh = False
                if closed_bars[i - k]['low'] <= l_i or closed_bars[i + k]['low'] < l_i:
                    is_sl = False
            if is_sh and self.last_sh == 0.0:
                self.last_sh = h_i
            if is_sl and self.last_sl == 0.0:
                self.last_sl = l_i
            if self.last_sh > 0 and self.last_sl > 0:
                break

        # 2. Check last closed bar for BOS
        c1 = float(closed_bars[-1]['close'])
        c2 = float(closed_bars[-2]['close'])

        macro_bull = (self.pdc == 0.0) or (c1 > self.pdc)
        macro_bear = (self.pdc == 0.0) or (c1 < self.pdc)

        bullish_bos = macro_bull and (self.last_sh > 0) and (c1 > self.last_sh) and (c2 <= self.last_sh)
        bearish_bos = macro_bear and (self.last_sl > 0) and (c1 < self.last_sl) and (c2 >= self.last_sl)

        if bullish_bos:
            log.info(f"⚡ [15M BULLISH BOS] Closed above Swing High ${self.last_sh:.2f} (Close: ${c1:.2f} > PDC ${self.pdc:.2f})")
            fvg_cnt = 0
            for k in range(n_c - 1, max(0, n_c - 1 - BOS_SEARCH_BARS), -1):
                if fvg_cnt >= MAX_FVG_PER_BOS: break
                if k >= 2 and closed_bars[k]['low'] > closed_bars[k - 2]['high']:
                    z_top = float(closed_bars[k]['low'])
                    z_bottom = float(closed_bars[k - 1]['low'])
                    self.zones.append({
                        'dir': 1, 'zone_top': z_top, 'zone_bottom': z_bottom,
                        'created_time': cur_15m_t, 'bars_5m_alive': 0, 'is_active': True,
                        'lowest_low': 999999.0, 'highest_high': 0.0,
                        'last_opp': None, 'cand_1': False
                    })
                    fvg_cnt += 1
                    log.info(f"   Mapped 15M Bullish FVG Zone: ${z_bottom:.2f} - ${z_top:.2f}")

        elif bearish_bos:
            log.info(f"⚡ [15M BEARISH BOS] Closed below Swing Low ${self.last_sl:.2f} (Close: ${c1:.2f} < PDC ${self.pdc:.2f})")
            fvg_cnt = 0
            for k in range(n_c - 1, max(0, n_c - 1 - BOS_SEARCH_BARS), -1):
                if fvg_cnt >= MAX_FVG_PER_BOS: break
                if k >= 2 and closed_bars[k]['high'] < closed_bars[k - 2]['low']:
                    z_bottom = float(closed_bars[k]['high'])
                    z_top = float(closed_bars[k - 1]['high'])
                    self.zones.append({
                        'dir': -1, 'zone_bottom': z_bottom, 'zone_top': z_top,
                        'created_time': cur_15m_t, 'bars_5m_alive': 0, 'is_active': True,
                        'lowest_low': 999999.0, 'highest_high': 0.0,
                        'last_opp': None, 'cand_1': False
                    })
                    fvg_cnt += 1
                    log.info(f"   Mapped 15M Bearish FVG Zone: ${z_bottom:.2f} - ${z_top:.2f}")

    def check_5m_reversals(self):
        """Scans for 5M candle confirmations inside mapped FVG zones."""
        # Ensure no open position already exists for this EA
        open_pos = mt5.positions_get(symbol=self.symbol)
        if open_pos is not None:
            my_positions = [p for p in open_pos if p.magic == MAGIC_NUMBER]
            if len(my_positions) > 0:
                return # EA maintains single position capacity

        rates_5m = mt5.copy_rates_from_pos(self.symbol, mt5.TIMEFRAME_M5, 0, 5)
        if rates_5m is None or len(rates_5m) < 4:
            return

        cur_5m_t = int(rates_5m[-1]['time'])
        if cur_5m_t == self.last_5m_time:
            return
        self.last_5m_time = cur_5m_t

        prev_5m = rates_5m[-2] # Most recently completed 5M bar
        o1 = float(prev_5m['open'])
        h1 = float(prev_5m['high'])
        l1 = float(prev_5m['low'])
        c1 = float(prev_5m['close'])
        is_bull = c1 > o1
        is_bear = c1 < o1

        for z in self.zones:
            if not z['is_active']: continue
            z['bars_5m_alive'] += 1
            if z['bars_5m_alive'] > ZONE_EXPIRY_BARS:
                z['is_active'] = False
                continue

            # --- BEARISH CONFIRMATION SETUP ---
            if z['dir'] == -1:
                in_zone = (h1 >= z['zone_bottom'])
                if in_zone:
                    z['highest_high'] = max(z['highest_high'], h1)

                if not in_zone and z['last_opp'] is None:
                    continue

                if is_bull:
                    z['last_opp'] = l1 # Mark low of bullish push
                    z['cand_1'] = False
                    continue
                elif is_bear and z['last_opp'] is not None:
                    trigger = False
                    if c1 < z['last_opp']:
                        trigger = True
                    elif not z['cand_1']:
                        z['cand_1'] = True
                        continue
                    elif z['cand_1']:
                        trigger = True

                    if trigger:
                        entry_pr = c1
                        sl_pr = max(z['zone_top'], entry_pr + MIN_SL_DIST)
                        self.execute_market_order(mt5.ORDER_TYPE_SELL, entry_pr, sl_pr)
                        z['is_active'] = False
                        break

            # --- BULLISH CONFIRMATION SETUP ---
            elif z['dir'] == 1:
                in_zone = (l1 <= z['zone_top'])
                if in_zone:
                    z['lowest_low'] = min(z['lowest_low'], l1)

                if not in_zone and z['last_opp'] is None:
                    continue

                if is_bear:
                    z['last_opp'] = h1 # Mark high of bearish dip
                    z['cand_1'] = False
                    continue
                elif is_bull and z['last_opp'] is not None:
                    trigger = False
                    if c1 > z['last_opp']:
                        trigger = True
                    elif not z['cand_1']:
                        z['cand_1'] = True
                        continue
                    elif z['cand_1']:
                        trigger = True

                    if trigger:
                        entry_pr = c1
                        sl_pr = min(z['zone_bottom'], entry_pr - MIN_SL_DIST)
                        self.execute_market_order(mt5.ORDER_TYPE_BUY, entry_pr, sl_pr)
                        z['is_active'] = False
                        break

    def calculate_lot_size(self, entry_price: float, sl_price: float) -> float:
        """Calculates lot size based on 1.0% dynamic account equity risk."""
        risk_dist = abs(entry_price - sl_price)
        if risk_dist <= 0: return 0.01

        info = mt5.symbol_info(self.symbol)
        
        # Gold on both Cent (USC) and Standard (USD) moves 100 account units per 1.00 lot per $1.00 move
        if "XAU" in self.symbol.upper() or "GOLD" in self.symbol.upper():
            loss_per_lot = 100.0 * risk_dist
        else:
            tick_size = info.trade_tick_size if info.trade_tick_size > 0 else 0.01
            tick_value = info.trade_tick_value if info.trade_tick_value > 0 else 1.0
            loss_per_lot = (risk_dist / tick_size) * tick_value
            
        if loss_per_lot <= 0: return info.volume_min

        account = mt5.account_info()
        risk_amount = account.equity * (RISK_PERCENT / 100.0)
        calc_lots = risk_amount / loss_per_lot

        min_lot = info.volume_min
        max_lot = min(info.volume_max, MAX_LOT_CAP)
        lot_step = info.volume_step if info.volume_step > 0 else 0.01

        calc_lots = max(min_lot, min(max_lot, calc_lots))
        calc_lots = math.floor(calc_lots / lot_step) * lot_step
        return round(calc_lots, 2)

    def execute_market_order(self, order_type, entry_price: float, sl_price: float):
        """Dispatches market order to MT5 trade server."""
        lots = self.calculate_lot_size(entry_price, sl_price)
        tick = mt5.symbol_info_tick(self.symbol)
        price = tick.ask if order_type == mt5.ORDER_TYPE_BUY else tick.bid
        risk_dist = abs(price - sl_price)

        order_str = "BUY" if order_type == mt5.ORDER_TYPE_BUY else "SELL"
        comment = f"Ladder5M Risk:{risk_dist:.2f}"

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": self.symbol,
            "volume": float(lots),
            "type": order_type,
            "price": price,
            "sl": float(round(sl_price, self.digits)),
            "tp": 0.0,
            "deviation": 20,
            "magic": MAGIC_NUMBER,
            "comment": comment,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        result = mt5.order_send(request)
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            # Fallback filling mode FOK
            request["type_filling"] = mt5.ORDER_FILLING_FOK
            result = mt5.order_send(request)

        if result.retcode == mt5.TRADE_RETCODE_DONE:
            log.info(f"🚀 [ORDER EXECUTED] {order_str} {lots} Lots @ ${price:.2f} | Structural SL: ${sl_price:.2f} | Ticket #{result.order}")
        else:
            log.error(f"❌ [ORDER FAILED] Error: {result.retcode} ({result.comment})")

    def manage_stepped_trailing_stops(self):
        """Active Trailing Engine: Updates trailing stops on every price tick according to Stepped Ladder."""
        open_pos = mt5.positions_get(symbol=self.symbol)
        if open_pos is None: return

        for p in open_pos:
            if p.magic != MAGIC_NUMBER: continue

            ticket = p.ticket
            p_type = p.type
            open_price = p.price_open
            current_sl = p.sl
            current_price = p.price_current
            comment = p.comment

            # Extract initial risk distance
            initial_risk = 0.0
            if "Risk:" in comment:
                try:
                    initial_risk = float(comment.split("Risk:")[1].strip())
                except:
                    pass

            if initial_risk <= 0:
                if p_type == mt5.POSITION_TYPE_BUY and current_sl < open_price and current_sl > 0:
                    initial_risk = open_price - current_sl
                elif p_type == mt5.POSITION_TYPE_SELL and current_sl > open_price:
                    initial_risk = current_sl - open_price

            if initial_risk <= 0: continue

            # Track peak R
            cur_r = (current_price - open_price) / initial_risk if p_type == mt5.POSITION_TYPE_BUY else (open_price - current_price) / initial_risk
            prev_max_r = self.position_max_r.get(ticket, 0.0)
            if cur_r > prev_max_r:
                self.position_max_r[ticket] = cur_r
                prev_max_r = cur_r

            locked_r = get_user_ladder_locked_r(prev_max_r)
            if locked_r < 0.0: continue # Still at initial SL

            if p_type == mt5.POSITION_TYPE_BUY:
                target_sl = round(open_price + (locked_r * initial_risk), self.digits)
                if target_sl > current_sl + (self.point * 2.0):
                    req = {
                        "action": mt5.TRADE_ACTION_SLTP,
                        "position": ticket,
                        "sl": float(target_sl),
                        "tp": float(p.tp),
                    }
                    res = mt5.order_send(req)
                    if res.retcode == mt5.TRADE_RETCODE_DONE:
                        log.info(f"🔒 [TRAILING STOP UPDATED] BUY #{ticket} | Max R: {prev_max_r:.2f}R | New SL: ${target_sl:.2f} (Locked: +{locked_r:.1f}R)")

            elif p_type == mt5.POSITION_TYPE_SELL:
                target_sl = round(open_price - (locked_r * initial_risk), self.digits)
                if current_sl == 0.0 or target_sl < current_sl - (self.point * 2.0):
                    req = {
                        "action": mt5.TRADE_ACTION_SLTP,
                        "position": ticket,
                        "sl": float(target_sl),
                        "tp": float(p.tp),
                    }
                    res = mt5.order_send(req)
                    if res.retcode == mt5.TRADE_RETCODE_DONE:
                        log.info(f"🔒 [TRAILING STOP UPDATED] SELL #{ticket} | Max R: {prev_max_r:.2f}R | New SL: ${target_sl:.2f} (Locked: +{locked_r:.1f}R)")

    def run(self):
        """Main operational continuous loop."""
        log.info("Starting LitmusTrend Live Trading Bot...")
        while True:
            try:
                # 1. Ensure MT5 connection alive
                if not mt5.terminal_info():
                    log.warning("Terminal connection lost! Reconnecting...")
                    if not self.connect():
                        time.sleep(5)
                        continue

                # 2. Update Previous Day Close (D1)
                self.update_pdc()

                # 3. Update 15M Structure & Mapped FVGs
                self.update_15m_structure()

                # 4. Check 5M Reversal Confirmation inside active zones
                self.check_5m_reversals()

                # 5. Manage Stepped Trailing Stop on open positions
                self.manage_stepped_trailing_stops()

                time.sleep(POLL_INTERVAL_SEC)

            except Exception as e:
                log.error(f"Unexpected error in bot loop: {e}", exc_info=True)
                time.sleep(5)

# ---------------------------------------------------------------------------
# ENTRY POINT
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    bot = LitmusTradingBot()
    if bot.connect():
        bot.run()
    else:
        print("Initialization failed. Check MT5 connection.")
