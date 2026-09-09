import MetaTrader5 as mt5
import numpy as np
from datetime import datetime, timezone, timedelta
import collections

def run_backtest(symbol="XAUUSD", initial_balance=1000.0, risk_pct=1.0, tp_r=10.0, max_consec_loss_day=0, max_consec_loss_4h=3, pivot_lookback=3, confirm_close_wick=True, use_fvg_refine=True, max_bars_wait=25, enable_stepped=True, reset_weekly=False):
    if not mt5.initialize():
        print("Failed to initialize MT5")
        return None
    
    sym_info = mt5.symbol_info(symbol)
    if sym_info is None:
        print(f"Symbol {symbol} not found")
        return None
        
    point = sym_info.point
    digits = sym_info.digits
    tick_size = sym_info.trade_tick_size if sym_info.trade_tick_size > 0 else point
    tick_val = sym_info.trade_tick_value if sym_info.trade_tick_value > 0 else 1.0
    contract_size = sym_info.trade_contract_size if sym_info.trade_contract_size > 0 else 1.0
    min_lot = sym_info.volume_min if sym_info.volume_min > 0 else 0.01
    lot_step = sym_info.volume_step if sym_info.volume_step > 0 else 0.01
    max_lot = sym_info.volume_max if sym_info.volume_max > 0 else 100.0

    print(f"Loading data for {symbol}...")
    # Fetch 4H bars for 2026
    h4_rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_H4, datetime(2025, 12, 1, tzinfo=timezone.utc), datetime(2026, 9, 9, tzinfo=timezone.utc))
    if h4_rates is None or len(h4_rates) == 0:
        print("No H4 rates")
        return None
        
    h4_times = np.array([r['time'] for r in h4_rates])
    h4_closes = np.array([r['close'] for r in h4_rates])

    # Fetch 1M bars from MT5
    m1_list = []
    pos = 0
    while True:
        chunk = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, pos, 40000)
        if chunk is None or len(chunk) == 0:
            break
        m1_list.append(chunk)
        pos += len(chunk)
        first_time = chunk[0]['time']
        if datetime.fromtimestamp(first_time, timezone.utc).year < 2026:
            break
        if len(chunk) < 40000:
            break

    all_m1 = np.concatenate(m1_list[::-1]) if len(m1_list) > 0 else np.array([])
    if len(all_m1) > 0:
        _, idx = np.unique(all_m1['time'], return_index=True)
        all_m1 = all_m1[idx]
        all_m1 = all_m1[all_m1['time'] >= datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp()]

    earliest_m1_time = all_m1[0]['time'] if len(all_m1) > 0 else datetime(2026, 9, 9, tzinfo=timezone.utc).timestamp()
    print(f"Direct broker 1M bars: {len(all_m1)}, available from {datetime.fromtimestamp(earliest_m1_time, timezone.utc)}")

    start_2026 = datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp()
    combined_bars = []
    
    # Generate early 2026 1M bars from M5 if earliest M1 starts later
    if earliest_m1_time > start_2026:
        m5_rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_M5, datetime(2026, 1, 1, tzinfo=timezone.utc), datetime.fromtimestamp(earliest_m1_time, timezone.utc))
        if m5_rates is not None and len(m5_rates) > 0:
            print(f"Interpolating 1M bars from {len(m5_rates)} M5 bars for early 2026 (Jan - May)...")
            for r in m5_rates:
                t, o, h, l, c = r['time'], r['open'], r['high'], r['low'], r['close']
                rng = h - l
                if rng <= 0: rng = point * 10
                if c >= o:
                    p_c = [o + rng * 0.05, l + rng * 0.1, l + rng * 0.45, h - rng * 0.1, c]
                    p_h = [max(o, p_c[0] + rng * 0.05), p_c[1] + rng * 0.1, p_c[2] + rng * 0.15, h, max(c, p_c[4])]
                    p_l = [min(o, p_c[0] - rng * 0.05), l, p_c[2] - rng * 0.1, p_c[3] - rng * 0.1, min(c, p_c[4])]
                else:
                    p_c = [o - rng * 0.05, h - rng * 0.1, h - rng * 0.45, l + rng * 0.1, c]
                    p_h = [max(o, p_c[0] + rng * 0.05), h, p_c[2] + rng * 0.1, p_c[3] + rng * 0.1, max(c, p_c[4])]
                    p_l = [min(o, p_c[0] - rng * 0.05), p_c[1] - rng * 0.1, p_c[2] - rng * 0.15, l, min(c, p_c[4])]
                for m in range(5):
                    bar_t = t + m * 60
                    if bar_t < earliest_m1_time:
                        combined_bars.append((bar_t, p_c[m-1] if m>0 else o, p_h[m], p_l[m], p_c[m], r['tick_volume']//5))

    # Append direct broker M1 bars
    for r in all_m1:
        combined_bars.append((r['time'], r['open'], r['high'], r['low'], r['close'], r['tick_volume']))

    dtype = [('time', '<i8'), ('open', '<f8'), ('high', '<f8'), ('low', '<f8'), ('close', '<f8'), ('tick_volume', '<i8')]
    rates = np.array(combined_bars, dtype=dtype)
    print(f"Total 2026 bars for backtest: {len(rates)} (From {datetime.fromtimestamp(rates[0]['time'], timezone.utc)} to {datetime.fromtimestamp(rates[-1]['time'], timezone.utc)})")

    # Strategy Simulation
    equity = initial_balance
    trades = []
    daily_consec_losses = 0
    htf_consec_losses = 0
    cur_day = -1
    cur_4h_idx = -1
    cur_week = -1
    
    last_swing_high = None
    last_swing_high_idx = -1
    last_swing_low = None
    last_swing_low_idx = -1
    
    setup_pending = False
    setup_dir = 0
    setup_entry = 0.0
    setup_sl = 0.0
    setup_risk_dist = 0.0
    setup_idx = -1
    setup_time = 0
    
    active_pos = None
    
    highs = rates['high']
    lows = rates['low']
    closes = rates['close']
    times = rates['time']
    n_bars = len(rates)
    
    peak_equity = equity
    max_dd_dollars = 0.0
    max_dd_pct = 0.0

    for i in range(pivot_lookback * 2 + 10, n_bars):
        bar_time = times[i]
        dt = datetime.fromtimestamp(bar_time, timezone.utc)
        day_id = dt.year * 1000 + dt.timetuple().tm_yday
        week_id = dt.year * 100 + dt.isocalendar()[1]
        
        # Weekly Reset if enabled
        if reset_weekly and (week_id != cur_week):
            cur_week = week_id
            equity = initial_balance
            peak_equity = initial_balance
            setup_pending = False
            active_pos = None
        elif not reset_weekly and (week_id != cur_week):
            cur_week = week_id

        # New Day Circuit Breaker Reset
        if day_id != cur_day:
            cur_day = day_id
            daily_consec_losses = 0

        # New 4H Window Circuit Breaker Reset
        h4_idx = np.searchsorted(h4_times, bar_time, side='right') - 1
        if h4_idx != cur_4h_idx:
            cur_4h_idx = h4_idx
            htf_consec_losses = 0
            
        is_daily_halted = (max_consec_loss_day > 0) and (daily_consec_losses >= max_consec_loss_day)
        is_4h_halted    = (max_consec_loss_4h > 0) and (htf_consec_losses >= max_consec_loss_4h)
        is_halted       = is_daily_halted or is_4h_halted
        
        # 1. Manage Active Position
        if active_pos is not None:
            pos_dir = active_pos['dir']
            pos_entry = active_pos['entry']
            pos_sl = active_pos['sl']
            pos_tp = active_pos['tp']
            pos_risk = active_pos['risk_dist']
            pos_lots = active_pos['lots']
            pos_risk_usd = active_pos['risk_usd']
            peak_r = active_pos['peak_r']
            
            bar_h = highs[i]
            bar_l = lows[i]
            
            trade_closed = False
            exit_price = 0.0
            pnl = 0.0
            
            if pos_dir == 1: # LONG
                current_r = (bar_h - pos_entry) / pos_risk
                peak_r = max(peak_r, current_r)
                active_pos['peak_r'] = peak_r
                
                # Stepped Trailing Stop
                if enable_stepped:
                    if peak_r >= 9.9:
                        pos_sl = max(pos_sl, pos_entry + (9.0 * pos_risk))
                    elif peak_r >= 9.8:
                        pos_sl = max(pos_sl, pos_entry + (8.0 * pos_risk))
                    elif peak_r >= 9.7:
                        pos_sl = max(pos_sl, pos_entry + (7.0 * pos_risk))
                    elif peak_r >= 9.6:
                        pos_sl = max(pos_sl, pos_entry + (6.0 * pos_risk))
                    elif peak_r >= 9.5:
                        pos_sl = max(pos_sl, pos_entry + (5.0 * pos_risk))
                    active_pos['sl'] = pos_sl
                    
                # Check TP
                if bar_h >= pos_tp:
                    trade_closed = True
                    exit_price = pos_tp
                    pnl = pos_risk_usd * tp_r
                    result = "TP (10R)"
                elif bar_l <= pos_sl:
                    trade_closed = True
                    exit_price = pos_sl
                    r_realized = (pos_sl - pos_entry) / pos_risk
                    pnl = pos_risk_usd * r_realized
                    result = "SL (-1R)" if r_realized < 0 else f"TRAIL (+{r_realized:.1f}R)"
                    
            elif pos_dir == -1: # SHORT
                current_r = (pos_entry - bar_l) / pos_risk
                peak_r = max(peak_r, current_r)
                active_pos['peak_r'] = peak_r
                
                if enable_stepped:
                    if peak_r >= 9.9:
                        pos_sl = min(pos_sl, pos_entry - (9.0 * pos_risk))
                    elif peak_r >= 9.8:
                        pos_sl = min(pos_sl, pos_entry - (8.0 * pos_risk))
                    elif peak_r >= 9.7:
                        pos_sl = min(pos_sl, pos_entry - (7.0 * pos_risk))
                    elif peak_r >= 9.6:
                        pos_sl = min(pos_sl, pos_entry - (6.0 * pos_risk))
                    elif peak_r >= 9.5:
                        pos_sl = min(pos_sl, pos_entry - (5.0 * pos_risk))
                    active_pos['sl'] = pos_sl
                    
                if bar_l <= pos_tp:
                    trade_closed = True
                    exit_price = pos_tp
                    pnl = pos_risk_usd * tp_r
                    result = "TP (10R)"
                elif bar_h >= pos_sl:
                    trade_closed = True
                    exit_price = pos_sl
                    r_realized = (pos_entry - pos_sl) / pos_risk
                    pnl = pos_risk_usd * r_realized
                    result = "SL (-1R)" if r_realized < 0 else f"TRAIL (+{r_realized:.1f}R)"
                    
            if trade_closed:
                equity += pnl
                if equity > peak_equity:
                    peak_equity = equity
                dd_usd = peak_equity - equity
                dd_pct = (dd_usd / peak_equity * 100.0) if peak_equity > 0 else 0.0
                if dd_usd > max_dd_dollars:
                    max_dd_dollars = dd_usd
                if dd_pct > max_dd_pct:
                    max_dd_pct = dd_pct
                    
                if pnl < 0:
                    daily_consec_losses += 1
                    htf_consec_losses   += 1
                else:
                    daily_consec_losses = 0
                    htf_consec_losses   = 0
                
                trades.append({
                    'entry_time': active_pos['entry_time'],
                    'exit_time': bar_time,
                    'dir': 'LONG' if pos_dir == 1 else 'SHORT',
                    'entry': pos_entry,
                    'exit': exit_price,
                    'lots': pos_lots,
                    'pnl': pnl,
                    'equity_after': equity,
                    'result': result,
                    'r_realized': pnl / pos_risk_usd,
                    'week': dt.isocalendar()[1]
                })
                active_pos = None

        # Circuit breaker: cancel pending setup
        if is_halted:
            setup_pending = False
            continue

        # 2. Check Pending Setup Fill / Expiration
        if setup_pending and active_pos is None:
            bars_waiting = i - setup_idx
            if bars_waiting > max_bars_wait:
                setup_pending = False
            elif setup_dir == 1: # Long
                if lows[i] <= setup_sl:
                    setup_pending = False
                elif lows[i] <= setup_entry:
                    risk_usd = equity * (risk_pct / 100.0)
                    loss_per_lot = (setup_risk_dist / tick_size) * tick_val
                    lots = risk_usd / loss_per_lot if loss_per_lot > 0 else min_lot
                    max_safe_lots = (equity * 100.0) / (setup_entry * contract_size)
                    lots = min(lots, max_safe_lots)
                    lots = max(min_lot, round(lots / lot_step) * lot_step)
                    
                    active_pos = {
                        'dir': 1,
                        'entry_time': bar_time,
                        'entry': setup_entry,
                        'sl': setup_sl,
                        'tp': setup_entry + (tp_r * setup_risk_dist),
                        'risk_dist': setup_risk_dist,
                        'lots': lots,
                        'risk_usd': risk_usd,
                        'peak_r': 0.0
                    }
                    setup_pending = False
            elif setup_dir == -1: # Short
                if highs[i] >= setup_sl:
                    setup_pending = False
                elif highs[i] >= setup_entry:
                    risk_usd = equity * (risk_pct / 100.0)
                    loss_per_lot = (setup_risk_dist / tick_size) * tick_val
                    lots = risk_usd / loss_per_lot if loss_per_lot > 0 else min_lot
                    max_safe_lots = (equity * 100.0) / (setup_entry * contract_size)
                    lots = min(lots, max_safe_lots)
                    lots = max(min_lot, round(lots / lot_step) * lot_step)
                    
                    active_pos = {
                        'dir': -1,
                        'entry_time': bar_time,
                        'entry': setup_entry,
                        'sl': setup_sl,
                        'tp': setup_entry - (tp_r * setup_risk_dist),
                        'risk_dist': setup_risk_dist,
                        'lots': lots,
                        'risk_usd': risk_usd,
                        'peak_r': 0.0
                    }
                    setup_pending = False

        # 3. Update Swing Points
        check_idx = i - 1 - pivot_lookback
        if check_idx >= pivot_lookback:
            is_sh = True
            sh_val = highs[check_idx]
            for k in range(1, pivot_lookback + 1):
                if highs[check_idx - k] >= sh_val or highs[check_idx + k] >= sh_val:
                    is_sh = False
                    break
            if is_sh:
                last_swing_high = sh_val
                last_swing_high_idx = check_idx
                
            is_sl = True
            sl_val = lows[check_idx]
            for k in range(1, pivot_lookback + 1):
                if lows[check_idx - k] <= sl_val or lows[check_idx + k] <= sl_val:
                    is_sl = False
                    break
            if is_sl:
                last_swing_low = sl_val
                last_swing_low_idx = check_idx

        # 4. Higher Timeframe 4H Bias
        h4_idx = np.searchsorted(h4_times, bar_time, side='right') - 1
        if h4_idx < 1:
            continue
        p4h_close = h4_closes[h4_idx - 1]
        
        close1 = closes[i - 1]
        close2 = closes[i - 2]
        
        is_bullish_bias = (close1 > p4h_close)
        is_bearish_bias = (close1 < p4h_close)
        
        min_allowed_dist = max(point * 5.0, (highs[i-1] - lows[i-1]) * 0.15)
        
        # 5. Bullish BOS
        bullish_bos = False
        bull_origin_high = highs[i-1]
        bull_origin_low = lows[i-1]
        
        if (not is_halted) and (last_swing_high is not None) and (close1 > last_swing_high) and (close2 <= last_swing_high) and is_bullish_bias:
            lowest_val = lows[i-1]
            origin_offset = 1
            search_len = min(30, i - 1)
            for s in range(1, search_len + 1):
                if lows[i - s] < lowest_val:
                    lowest_val = lows[i - s]
                    origin_offset = s
            wick_confirmed = (not confirm_close_wick) or (close1 > highs[i - origin_offset])
            if wick_confirmed:
                bullish_bos = True
                bull_origin_high = highs[i - origin_offset]
                bull_origin_low = lows[i - origin_offset]
                
        # 6. Bearish BOS
        bearish_bos = False
        bear_origin_high = highs[i-1]
        bear_origin_low = lows[i-1]
        
        if (not is_halted) and (last_swing_low is not None) and (close1 < last_swing_low) and (close2 >= last_swing_low) and is_bearish_bias:
            highest_val = highs[i-1]
            origin_offset = 1
            search_len = min(30, i - 1)
            for s in range(1, search_len + 1):
                if highs[i - s] > highest_val:
                    highest_val = highs[i - s]
                    origin_offset = s
            wick_confirmed = (not confirm_close_wick) or (close1 < lows[i - origin_offset])
            if wick_confirmed:
                bearish_bos = True
                bear_origin_high = highs[i - origin_offset]
                bear_origin_low = lows[i - origin_offset]

        # 7. Register Setup on BOS
        if bullish_bos and active_pos is None and not is_halted:
            has_fvg = False
            fvg_entry = 0.0
            fvg_sl = 0.0
            if use_fvg_refine:
                for k in range(1, 4):
                    if lows[i - k] > highs[i - k - 2]:
                        has_fvg = True
                        fvg_entry = lows[i - k]
                        fvg_sl = highs[i - k - 2]
                        break
            setup_pending = True
            setup_dir = 1
            setup_idx = i
            setup_time = bar_time
            if has_fvg:
                setup_entry = fvg_entry
                setup_sl = fvg_sl
            else:
                setup_entry = bull_origin_high
                setup_sl = bull_origin_low
            raw_dist = abs(setup_entry - setup_sl)
            setup_risk_dist = max(raw_dist, min_allowed_dist)
            setup_sl = setup_entry - setup_risk_dist
            if setup_sl >= setup_entry or setup_risk_dist <= 0:
                setup_pending = False

        elif bearish_bos and active_pos is None and not is_halted:
            has_fvg = False
            fvg_entry = 0.0
            fvg_sl = 0.0
            if use_fvg_refine:
                for k in range(1, 4):
                    if highs[i - k] < lows[i - k - 2]:
                        has_fvg = True
                        fvg_entry = highs[i - k]
                        fvg_sl = lows[i - k - 2]
                        break
            setup_pending = True
            setup_dir = -1
            setup_idx = i
            setup_time = bar_time
            if has_fvg:
                setup_entry = fvg_entry
                setup_sl = fvg_sl
            else:
                setup_entry = bear_origin_low
                setup_sl = bear_origin_high
            raw_dist = abs(setup_sl - setup_entry)
            setup_risk_dist = max(raw_dist, min_allowed_dist)
            setup_sl = setup_entry + setup_risk_dist
            if setup_sl <= setup_entry or setup_risk_dist <= 0:
                setup_pending = False

    return trades, initial_balance, equity, max_dd_pct, max_dd_dollars

if __name__ == "__main__":
    for sym in ["XAUUSD", "EURUSD"]:
        print(f"\n" + "=" * 92)
        print(f"MT5 2026 BACKTEST: {sym} (RESET TO $100 EVERY WEEK, 10% RISK, 4H BIAS / 1M EXECUTION)")
        print(f"=" * 92)
        res = run_backtest(sym, initial_balance=100.0, risk_pct=10.0, reset_weekly=True)
        if res:
            trades, init_bal, final_bal, _, _ = res
            
            # Group by week
            weeks = collections.defaultdict(list)
            for t in trades:
                weeks[t['week']].append(t)
                
            sorted_weeks = sorted(weeks.keys())
            
            print(f"\n{'Week':<6} | {'Date Range':<18} | {'Trades':<6} | {'W / L':<7} | {'Win %':<6} | {'Start Bal':<10} | {'End Bal':<10} | {'Weekly P/L ($)':<14} | {'Gain (%)':<8}")
            print("-" * 92)
            
            weekly_pnls = []
            profitable_weeks = 0
            losing_weeks = 0
            breakeven_weeks = 0
            total_net_pnl = 0.0
            
            for w in sorted_weeks:
                w_trades = weeks[w]
                w_wins = len([t for t in w_trades if t['pnl'] > 0])
                w_losses = len([t for t in w_trades if t['pnl'] < 0])
                w_rate = (w_wins / len(w_trades) * 100) if len(w_trades) > 0 else 0
                
                # Starting balance is $100
                w_start = 100.0
                w_end = w_trades[-1]['equity_after']
                w_pnl = w_end - w_start
                w_gain_pct = (w_pnl / w_start) * 100.0
                
                weekly_pnls.append((w, w_pnl, w_gain_pct, w_end))
                total_net_pnl += w_pnl
                
                if w_pnl > 0.01:
                    profitable_weeks += 1
                elif w_pnl < -0.01:
                    losing_weeks += 1
                else:
                    breakeven_weeks += 1
                    
                start_t = datetime.fromtimestamp(w_trades[0]['entry_time'], timezone.utc).strftime("%b %d")
                end_t = datetime.fromtimestamp(w_trades[-1]['exit_time'], timezone.utc).strftime("%b %d")
                date_str = f"{start_t} - {end_t}"
                
                pnl_str = f"{'+' if w_pnl>=0 else ''}${w_pnl:,.2f}"
                gain_str = f"{'+' if w_gain_pct>=0 else ''}{w_gain_pct:.1f}%"
                
                print(f"Wk {w:<3} | {date_str:<18} | {len(w_trades):<6} | {f'{w_wins}/{w_losses}':<7} | {w_rate:<5.1f}% | ${w_start:<9.2f} | ${w_end:<9.2f} | {pnl_str:<14} | {gain_str:<8}")
                
            print("=" * 92)
            
            total_trades = len(trades)
            total_wins = len([t for t in trades if t['pnl'] > 0])
            total_losses = len([t for t in trades if t['pnl'] < 0])
            overall_win_rate = (total_wins / total_trades * 100) if total_trades > 0 else 0
            
            best_wk = max(weekly_pnls, key=lambda x: x[1]) if weekly_pnls else (0,0,0,0)
            worst_wk = min(weekly_pnls, key=lambda x: x[1]) if weekly_pnls else (0,0,0,0)
            avg_wk_pnl = total_net_pnl / len(weekly_pnls) if weekly_pnls else 0
            
            print(f"\nPORTFOLIO PERFORMANCE SUMMARY FOR {sym} (STARTING $100 EACH WEEK):")
            print("-" * 65)
            print(f"Total Weeks Tested       : {len(weekly_pnls)} weeks")
            print(f"Profitable Weeks         : {profitable_weeks} ({profitable_weeks/len(weekly_pnls)*100:.1f}%)")
            print(f"Losing Weeks             : {losing_weeks} ({losing_weeks/len(weekly_pnls)*100:.1f}%)")
            print(f"Total Cumulative Profit  : {'+' if total_net_pnl>=0 else ''}${total_net_pnl:,.2f}")
            print(f"Average Weekly Return    : {'+' if avg_wk_pnl>=0 else ''}${avg_wk_pnl:,.2f} ({avg_wk_pnl:+.1f}%)")
            print(f"Best Week                : Week {best_wk[0]} ({'+' if best_wk[1]>=0 else ''}${best_wk[1]:,.2f}, {best_wk[2]:+.1f}%)")
            print(f"Worst Week               : Week {worst_wk[0]} ({'+' if worst_wk[1]>=0 else ''}${worst_wk[1]:,.2f}, {worst_wk[2]:+.1f}%)")
            print(f"Total Trades Taken       : {total_trades} (Wins: {total_wins}, Losses: {total_losses})")
            print(f"Overall Win Rate         : {overall_win_rate:.1f}%")
            print("-" * 65)
