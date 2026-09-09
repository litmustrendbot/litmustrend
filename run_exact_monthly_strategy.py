import MetaTrader5 as mt5
from datetime import datetime, date
import math

def run_monthly_reset_backtest():
    if not mt5.initialize():
        print("Failed to initialize MT5")
        return

    symbol = "XAUUSD"
    # Fetch all available 5M rates (99,000 bars back to April 2025)
    rates_5m = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M5, 0, 99000)
    rates_d1 = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_D1, 0, 1000)

    sym_info = mt5.symbol_info(symbol)
    tick_size = sym_info.trade_tick_size if sym_info.trade_tick_size > 0 else sym_info.point
    tick_val  = sym_info.trade_tick_value
    min_lot   = sym_info.volume_min
    max_lot   = sym_info.volume_max
    lot_step  = sym_info.volume_step
    point     = sym_info.point

    mt5.shutdown()

    if rates_5m is None or len(rates_5m) == 0:
        print("No rates fetched")
        return

    first_time = datetime.fromtimestamp(rates_5m[0]['time'])
    last_time = datetime.fromtimestamp(rates_5m[-1]['time'])
    print(f"Loaded {len(rates_5m)} real 5M bars from {first_time} to {last_time}")

    # Map D1 close for PDC
    pdc_map = {}
    for i in range(1, len(rates_d1)):
        d_cur = datetime.fromtimestamp(rates_d1[i]['time']).date()
        prev_close = rates_d1[i-1]['close']
        pdc_map[d_cur] = prev_close

    # Strategy Parameters
    risk_usd = 10.0
    tp_r = 10.0
    pivot_lookback = 3
    max_bars_wait = 25
    max_consec_loss_day = 3

    # Group bars by month
    monthly_bars = {}
    for i, bar in enumerate(rates_5m):
        dt = datetime.fromtimestamp(bar['time'])
        m_key = (dt.year, dt.month)
        if m_key not in monthly_bars:
            monthly_bars[m_key] = []
        monthly_bars[m_key].append((i, bar))

    print(f"Total full months to test: {len(monthly_bars)}")

    results = []

    for m_key in sorted(monthly_bars.keys()):
        yr, mo = m_key
        bars_in_month = monthly_bars[m_key]
        month_name = date(yr, mo, 1).strftime("%B %Y")

        # Each month we start fresh with $100
        equity = 100.0
        capital_lost = False
        trades = []
        daily_losses = {}

        last_swing_high = None
        last_swing_high_idx = None
        last_swing_low = None
        last_swing_low_idx = None

        pending_setup = None
        active_position = None

        start_global_idx = bars_in_month[0][0]
        # Pre-seed swing points using up to 50 bars before month start if available
        pre_start = max(pivot_lookback * 2 + 5, start_global_idx - 50)
        for pre_i in range(pre_start, start_global_idx):
            check_idx = pre_i - 1 - pivot_lookback
            if check_idx >= pivot_lookback:
                is_swing_high = True
                for k in range(1, pivot_lookback + 1):
                    if rates_5m[check_idx]['high'] <= rates_5m[check_idx - k]['high'] or rates_5m[check_idx]['high'] <= rates_5m[check_idx + k]['high']:
                        is_swing_high = False
                        break
                if is_swing_high:
                    last_swing_high = rates_5m[check_idx]['high']
                    last_swing_high_idx = check_idx

                is_swing_low = True
                for k in range(1, pivot_lookback + 1):
                    if rates_5m[check_idx]['low'] >= rates_5m[check_idx - k]['low'] or rates_5m[check_idx]['low'] >= rates_5m[check_idx + k]['low']:
                        is_swing_low = False
                        break
                if is_swing_low:
                    last_swing_low = rates_5m[check_idx]['low']
                    last_swing_low_idx = check_idx

        # Run through month bars
        for (i, bar) in bars_in_month:
            bar_time = datetime.fromtimestamp(bar['time'])
            cur_date = bar_time.date()
            if cur_date not in daily_losses:
                daily_losses[cur_date] = 0

            cur_high  = bar['high']
            cur_low   = bar['low']

            # 1. Manage Active Position
            if active_position is not None:
                pos = active_position
                if pos['dir'] == 1:
                    current_r = (cur_high - pos['entry']) / pos['risk_dist']
                    pos['peak_r'] = max(pos['peak_r'], current_r)

                    new_sl = pos['sl']
                    if pos['peak_r'] >= 9.9:
                        new_sl = max(new_sl, pos['entry'] + 9.0 * pos['risk_dist'])
                    elif pos['peak_r'] >= 9.8:
                        new_sl = max(new_sl, pos['entry'] + 8.0 * pos['risk_dist'])
                    elif pos['peak_r'] >= 9.7:
                        new_sl = max(new_sl, pos['entry'] + 7.0 * pos['risk_dist'])
                    elif pos['peak_r'] >= 9.6:
                        new_sl = max(new_sl, pos['entry'] + 6.0 * pos['risk_dist'])
                    elif pos['peak_r'] >= 9.5:
                        new_sl = max(new_sl, pos['entry'] + 5.0 * pos['risk_dist'])
                    pos['sl'] = new_sl

                    if cur_high >= pos['tp']:
                        pnl = pos['lots'] * ((pos['tp'] - pos['entry']) / tick_size) * tick_val
                        equity += pnl
                        pos['pnl'] = pnl
                        pos['result'] = 'TP'
                        daily_losses[cur_date] = 0
                        trades.append(pos)
                        active_position = None
                    elif cur_low <= pos['sl']:
                        pnl = pos['lots'] * ((pos['sl'] - pos['entry']) / tick_size) * tick_val
                        equity += pnl
                        pos['pnl'] = pnl
                        pos['result'] = 'SL' if pnl < 0 else 'TRAIL_WIN'
                        if pnl < 0:
                            daily_losses[cur_date] += 1
                        else:
                            daily_losses[cur_date] = 0
                        trades.append(pos)
                        active_position = None

                elif pos['dir'] == -1:
                    current_r = (pos['entry'] - cur_low) / pos['risk_dist']
                    pos['peak_r'] = max(pos['peak_r'], current_r)

                    new_sl = pos['sl']
                    if pos['peak_r'] >= 9.9:
                        new_sl = min(new_sl, pos['entry'] - 9.0 * pos['risk_dist'])
                    elif pos['peak_r'] >= 9.8:
                        new_sl = min(new_sl, pos['entry'] - 8.0 * pos['risk_dist'])
                    elif pos['peak_r'] >= 9.7:
                        new_sl = min(new_sl, pos['entry'] - 7.0 * pos['risk_dist'])
                    elif pos['peak_r'] >= 9.6:
                        new_sl = min(new_sl, pos['entry'] - 6.0 * pos['risk_dist'])
                    elif pos['peak_r'] >= 9.5:
                        new_sl = min(new_sl, pos['entry'] - 5.0 * pos['risk_dist'])
                    pos['sl'] = new_sl

                    if cur_low <= pos['tp']:
                        pnl = pos['lots'] * ((pos['entry'] - pos['tp']) / tick_size) * tick_val
                        equity += pnl
                        pos['pnl'] = pnl
                        pos['result'] = 'TP'
                        daily_losses[cur_date] = 0
                        trades.append(pos)
                        active_position = None
                    elif cur_high >= pos['sl']:
                        pnl = pos['lots'] * ((pos['entry'] - pos['sl']) / tick_size) * tick_val
                        equity += pnl
                        pos['pnl'] = pnl
                        pos['result'] = 'SL' if pnl < 0 else 'TRAIL_WIN'
                        if pnl < 0:
                            daily_losses[cur_date] += 1
                        else:
                            daily_losses[cur_date] = 0
                        trades.append(pos)
                        active_position = None

                # Check if capital was lost
                if equity <= 0:
                    capital_lost = True
                    break # Blown account for this month

            if capital_lost:
                break

            # 2. Check Pending Limit Order
            if pending_setup is not None and active_position is None:
                setup = pending_setup
                if (i - setup['bar_idx']) > max_bars_wait:
                    pending_setup = None
                elif setup['dir'] == 1 and cur_low <= setup['sl']:
                    pending_setup = None
                elif setup['dir'] == -1 and cur_high >= setup['sl']:
                    pending_setup = None
                else:
                    filled = False
                    if setup['dir'] == 1 and cur_low <= setup['entry']:
                        filled = True
                    elif setup['dir'] == -1 and cur_high >= setup['entry']:
                        filled = True

                    if filled:
                        active_position = {
                            'dir': setup['dir'],
                            'entry': setup['entry'],
                            'sl': setup['sl'],
                            'tp': setup['tp'],
                            'risk_dist': setup['risk_dist'],
                            'lots': setup['lots'],
                            'entry_time': bar_time,
                            'peak_r': 0.0
                        }
                        pending_setup = None

            # 3. Swing detection
            check_idx = i - 1 - pivot_lookback
            if check_idx >= pivot_lookback:
                is_swing_high = True
                for k in range(1, pivot_lookback + 1):
                    if rates_5m[check_idx]['high'] <= rates_5m[check_idx - k]['high'] or rates_5m[check_idx]['high'] <= rates_5m[check_idx + k]['high']:
                        is_swing_high = False
                        break
                if is_swing_high:
                    last_swing_high = rates_5m[check_idx]['high']
                    last_swing_high_idx = check_idx

                is_swing_low = True
                for k in range(1, pivot_lookback + 1):
                    if rates_5m[check_idx]['low'] >= rates_5m[check_idx - k]['low'] or rates_5m[check_idx]['low'] >= rates_5m[check_idx + k]['low']:
                        is_swing_low = False
                        break
                if is_swing_low:
                    last_swing_low = rates_5m[check_idx]['low']
                    last_swing_low_idx = check_idx

            # 4. Strategy Signal Check
            c1 = rates_5m[i-1]['close']
            c2 = rates_5m[i-2]['close']
            pdc = pdc_map.get(cur_date, None)
            if pdc is None:
                continue

            is_bull_bias = (c1 > pdc)
            is_bear_bias = (c1 < pdc)
            is_daily_halted = (daily_losses.get(cur_date, 0) >= max_consec_loss_day)

            if is_daily_halted:
                pending_setup = None
                continue

            bullish_bos = False
            bull_origin_high = 0.0
            bull_origin_low = 0.0
            if last_swing_high is not None and (c1 > last_swing_high) and (c2 <= last_swing_high) and is_bull_bias:
                lowest_val = rates_5m[i-1]['low']
                origin_idx = i-1
                search_len = min(30, i - 1 - last_swing_high_idx) if last_swing_high_idx else 10
                for s in range(1, max(1, search_len + 1)):
                    if rates_5m[i - 1 - s]['low'] < lowest_val:
                        lowest_val = rates_5m[i - 1 - s]['low']
                        origin_idx = i - 1 - s
                if c1 > rates_5m[origin_idx]['high']:
                    bullish_bos = True
                    bull_origin_high = rates_5m[origin_idx]['high']
                    bull_origin_low = rates_5m[origin_idx]['low']

            bearish_bos = False
            bear_origin_high = 0.0
            bear_origin_low = 0.0
            if last_swing_low is not None and (c1 < last_swing_low) and (c2 >= last_swing_low) and is_bear_bias:
                highest_val = rates_5m[i-1]['high']
                origin_idx = i-1
                search_len = min(30, i - 1 - last_swing_low_idx) if last_swing_low_idx else 10
                for s in range(1, max(1, search_len + 1)):
                    if rates_5m[i - 1 - s]['high'] > highest_val:
                        highest_val = rates_5m[i - 1 - s]['high']
                        origin_idx = i - 1 - s
                if c1 < rates_5m[origin_idx]['low']:
                    bearish_bos = True
                    bear_origin_high = rates_5m[origin_idx]['high']
                    bear_origin_low = rates_5m[origin_idx]['low']

            if bullish_bos and active_position is None:
                has_fvg = False
                fvg_entry = 0.0
                fvg_sl = 0.0
                for k in range(1, 4):
                    if rates_5m[i - k]['low'] > rates_5m[i - k - 2]['high']:
                        has_fvg = True
                        fvg_entry = rates_5m[i - k]['low']
                        fvg_sl = rates_5m[i - k - 2]['high']
                        break

                entry_p = fvg_entry if has_fvg else bull_origin_high
                sl_p = fvg_sl if has_fvg else bull_origin_low
                risk_dist = max(abs(entry_p - sl_p), point * 5)
                sl_p = entry_p - risk_dist
                tp_p = entry_p + (tp_r * risk_dist)

                ticks_in_risk = risk_dist / tick_size
                risk_per_lot = ticks_in_risk * tick_val
                raw_lots = risk_usd / risk_per_lot if risk_per_lot > 0 else min_lot
                lots = round(raw_lots / lot_step) * lot_step
                lots = max(min_lot, min(max_lot, lots))

                pending_setup = {
                    'dir': 1,
                    'entry': entry_p,
                    'sl': sl_p,
                    'tp': tp_p,
                    'risk_dist': risk_dist,
                    'lots': lots,
                    'bar_idx': i
                }

            elif bearish_bos and active_position is None:
                has_fvg = False
                fvg_entry = 0.0
                fvg_sl = 0.0
                for k in range(1, 4):
                    if rates_5m[i - k]['high'] < rates_5m[i - k - 2]['low']:
                        has_fvg = True
                        fvg_entry = rates_5m[i - k]['high']
                        fvg_sl = rates_5m[i - k - 2]['low']
                        break

                entry_p = fvg_entry if has_fvg else bear_origin_low
                sl_p = fvg_sl if has_fvg else bear_origin_high
                risk_dist = max(abs(sl_p - entry_p), point * 5)
                sl_p = entry_p + risk_dist
                tp_p = entry_p - (tp_r * risk_dist)

                ticks_in_risk = risk_dist / tick_size
                risk_per_lot = ticks_in_risk * tick_val
                raw_lots = risk_usd / risk_per_lot if risk_per_lot > 0 else min_lot
                lots = round(raw_lots / lot_step) * lot_step
                lots = max(min_lot, min(max_lot, lots))

                pending_setup = {
                    'dir': -1,
                    'entry': entry_p,
                    'sl': sl_p,
                    'tp': tp_p,
                    'risk_dist': risk_dist,
                    'lots': lots,
                    'bar_idx': i
                }

        # Month finished
        wins = len([t for t in trades if t['pnl'] > 0])
        losses = len([t for t in trades if t['pnl'] < 0])
        total_t = len(trades)
        profit_sum = sum(t['pnl'] for t in trades if t['pnl'] > 0)
        loss_sum = abs(sum(t['pnl'] for t in trades if t['pnl'] < 0))
        net = profit_sum - loss_sum

        results.append({
            'month': month_name,
            'starting_capital': 100.0,
            'ending_equity': equity if not capital_lost else 0.0,
            'capital_lost': capital_lost,
            'trades': total_t,
            'wins': wins,
            'losses': losses,
            'profit': profit_sum,
            'loss': loss_sum,
            'net': net
        })

    print("\n=========================================================================================")
    print("      REAL BROKER 5M BACKTEST: MONTHLY $100 RESET (OCTAFX REAL DATA)                   ")
    print("=========================================================================================")
    print(f"{'Month':<16} | {'Trades':<6} | {'Wins':<4} | {'Losses':<6} | {'Net PnL ($)':<12} | {'End Equity':<10} | {'Status':<16}")
    print("-----------------------------------------------------------------------------------------")
    for r in results:
        status_str = "CAPITAL LOST" if r['capital_lost'] else ("PROFITABLE" if r['net'] > 0 else "DRAWDOWN")
        print(f"{r['month']:<16} | {r['trades']:<6} | {r['wins']:<4} | {r['losses']:<6} | ${r['net']:<+11.2f} | ${r['ending_equity']:<9.2f} | {status_str:<16}")
    print("=========================================================================================")

if __name__ == "__main__":
    run_monthly_reset_backtest()
