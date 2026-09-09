import MetaTrader5 as mt5
from datetime import datetime, date
import numpy as np
import os
import sys

def fetch_bars_chunked(symbol, tf, target_count=100000, chunk_size=20000):
    mt5.symbol_select(symbol, True)
    all_chunks = []
    offset = 0
    while offset < target_count:
        chunk = mt5.copy_rates_from_pos(symbol, tf, offset, min(chunk_size, target_count - offset))
        if chunk is None or len(chunk) == 0:
            break
        all_chunks.append(chunk)
        offset += len(chunk)
        if len(chunk) < chunk_size:
            break
    if not all_chunks:
        return np.array([])
    merged = np.concatenate(all_chunks[::-1])
    _, idx = np.unique(merged['time'], return_index=True)
    return merged[idx]

def run_pdc_5m_backtest(symbol):
    print(f"\n=======================================================")
    print(f"   RUNNING PDC 5M BOS + FVG STRATEGY ON {symbol}")
    print(f"=======================================================")
    
    rates_5m = fetch_bars_chunked(symbol, mt5.TIMEFRAME_M5, 100000)
    rates_d1 = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_D1, 0, 1000)
    
    if rates_5m is None or len(rates_5m) == 0:
        print(f"Error: Could not fetch M5 rates for {symbol}")
        return None
        
    sym_info = mt5.symbol_info(symbol)
    tick_size = sym_info.trade_tick_size if sym_info.trade_tick_size > 0 else sym_info.point
    tick_val  = sym_info.trade_tick_value if sym_info.trade_tick_value > 0 else 1.0
    min_lot   = sym_info.volume_min
    max_lot   = sym_info.volume_max
    lot_step  = sym_info.volume_step if sym_info.volume_step > 0 else 0.01
    point     = sym_info.point
    
    first_time = datetime.fromtimestamp(rates_5m[0]['time'])
    last_time = datetime.fromtimestamp(rates_5m[-1]['time'])
    print(f"Data: {len(rates_5m)} real 5M bars | From {first_time} to {last_time}")
    
    pdc_map = {}
    for i in range(1, len(rates_d1)):
        d_cur = datetime.fromtimestamp(rates_d1[i]['time']).date()
        prev_close = rates_d1[i-1]['close']
        pdc_map[d_cur] = prev_close
        
    risk_usd = 10.0
    tp_r = 10.0
    pivot_lookback = 3
    max_bars_wait = 25
    max_consec_loss_day = 3
    
    monthly_bars = {}
    for i, bar in enumerate(rates_5m):
        dt = datetime.fromtimestamp(bar['time'])
        m_key = (dt.year, dt.month)
        if m_key not in monthly_bars:
            monthly_bars[m_key] = []
        monthly_bars[m_key].append((i, bar))
        
    monthly_results = []
    all_trades = []
    
    for m_key in sorted(monthly_bars.keys()):
        yr, mo = m_key
        bars_in_month = monthly_bars[m_key]
        month_label = date(yr, mo, 1).strftime("%B %Y")
        
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
                    
        for (i, bar) in bars_in_month:
            bar_time = datetime.fromtimestamp(bar['time'])
            cur_date = bar_time.date()
            if cur_date not in daily_losses:
                daily_losses[cur_date] = 0
                
            cur_high = bar['high']
            cur_low  = bar['low']
            
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
                        all_trades.append(pos)
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
                        all_trades.append(pos)
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
                        all_trades.append(pos)
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
                        all_trades.append(pos)
                        active_position = None
                        
                if equity <= 0:
                    capital_lost = True
                    break
                    
            if capital_lost:
                break
                
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
                            'symbol': symbol,
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
                    'dir': 1, 'entry': entry_p, 'sl': sl_p, 'tp': tp_p,
                    'risk_dist': risk_dist, 'lots': lots, 'bar_idx': i
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
                    'dir': -1, 'entry': entry_p, 'sl': sl_p, 'tp': tp_p,
                    'risk_dist': risk_dist, 'lots': lots, 'bar_idx': i
                }
                
        win_trades = [t for t in trades if t['pnl'] > 0]
        loss_trades = [t for t in trades if t['pnl'] < 0]
        profit_banked = max(0.0, equity - 100.0) if not capital_lost else 0.0
        
        monthly_results.append({
            'month': month_label,
            'starting_capital': 100.0,
            'final_equity': 0.0 if capital_lost else equity,
            'profit_banked': profit_banked,
            'is_blown': capital_lost,
            'total_trades': len(trades),
            'wins': len(win_trades),
            'losses': len(loss_trades)
        })
        
    return {
        'symbol': symbol,
        'strategy': 'PDC 5M BOS + FVG',
        'monthly': monthly_results,
        'trades': all_trades
    }

def run_p4h_1m_backtest(symbol):
    print(f"\n=======================================================")
    print(f"   RUNNING P4H 1M BOS + FVG STRATEGY ON {symbol}")
    print(f"=======================================================")
    
    rates_1m = fetch_bars_chunked(symbol, mt5.TIMEFRAME_M1, 100000)
    rates_h4 = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_H4, 0, 2000)
    
    if rates_1m is None or len(rates_1m) == 0:
        print(f"Error: Could not fetch M1 rates for {symbol}")
        return None
        
    sym_info = mt5.symbol_info(symbol)
    tick_size = sym_info.trade_tick_size if sym_info.trade_tick_size > 0 else sym_info.point
    tick_val  = sym_info.trade_tick_value if sym_info.trade_tick_value > 0 else 1.0
    min_lot   = sym_info.volume_min
    max_lot   = sym_info.volume_max
    lot_step  = sym_info.volume_step if sym_info.volume_step > 0 else 0.01
    point     = sym_info.point
    
    first_time = datetime.fromtimestamp(rates_1m[0]['time'])
    last_time = datetime.fromtimestamp(rates_1m[-1]['time'])
    print(f"Data: {len(rates_1m)} real 1M bars | From {first_time} to {last_time}")
    
    h4_times = rates_h4['time']
    h4_closes = rates_h4['close']
    
    def get_p4hc(bar_t):
        idx = np.searchsorted(h4_times, bar_t, side='right') - 1
        if idx >= 1:
            return h4_closes[idx - 1], h4_times[idx]
        return None, None
        
    risk_usd = 10.0
    tp_r = 10.0
    pivot_lookback = 3
    max_bars_wait = 25
    max_consec_loss_h4 = 3
    
    monthly_bars = {}
    for i, bar in enumerate(rates_1m):
        dt = datetime.fromtimestamp(bar['time'])
        m_key = (dt.year, dt.month)
        if m_key not in monthly_bars:
            monthly_bars[m_key] = []
        monthly_bars[m_key].append((i, bar))
        
    monthly_results = []
    all_trades = []
    
    for m_key in sorted(monthly_bars.keys()):
        yr, mo = m_key
        bars_in_month = monthly_bars[m_key]
        month_label = date(yr, mo, 1).strftime("%B %Y")
        
        equity = 100.0
        capital_lost = False
        trades = []
        h4_losses = {}
        
        last_swing_high = None
        last_swing_high_idx = None
        last_swing_low = None
        last_swing_low_idx = None
        
        pending_setup = None
        active_position = None
        
        start_global_idx = bars_in_month[0][0]
        pre_start = max(pivot_lookback * 2 + 5, start_global_idx - 50)
        for pre_i in range(pre_start, start_global_idx):
            check_idx = pre_i - 1 - pivot_lookback
            if check_idx >= pivot_lookback:
                is_swing_high = True
                for k in range(1, pivot_lookback + 1):
                    if rates_1m[check_idx]['high'] <= rates_1m[check_idx - k]['high'] or rates_1m[check_idx]['high'] <= rates_1m[check_idx + k]['high']:
                        is_swing_high = False
                        break
                if is_swing_high:
                    last_swing_high = rates_1m[check_idx]['high']
                    last_swing_high_idx = check_idx
                is_swing_low = True
                for k in range(1, pivot_lookback + 1):
                    if rates_1m[check_idx]['low'] >= rates_1m[check_idx - k]['low'] or rates_1m[check_idx]['low'] >= rates_1m[check_idx + k]['low']:
                        is_swing_low = False
                        break
                if is_swing_low:
                    last_swing_low = rates_1m[check_idx]['low']
                    last_swing_low_idx = check_idx
                    
        for (i, bar) in bars_in_month:
            bar_time = datetime.fromtimestamp(bar['time'])
            cur_high = bar['high']
            cur_low  = bar['low']
            
            p4hc, h4_cur_open_time = get_p4hc(bar['time'])
            if h4_cur_open_time not in h4_losses:
                h4_losses[h4_cur_open_time] = 0
                
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
                        h4_losses[h4_cur_open_time] = 0
                        trades.append(pos)
                        all_trades.append(pos)
                        active_position = None
                    elif cur_low <= pos['sl']:
                        pnl = pos['lots'] * ((pos['sl'] - pos['entry']) / tick_size) * tick_val
                        equity += pnl
                        pos['pnl'] = pnl
                        pos['result'] = 'SL' if pnl < 0 else 'TRAIL_WIN'
                        if pnl < 0:
                            h4_losses[h4_cur_open_time] += 1
                        else:
                            h4_losses[h4_cur_open_time] = 0
                        trades.append(pos)
                        all_trades.append(pos)
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
                        h4_losses[h4_cur_open_time] = 0
                        trades.append(pos)
                        all_trades.append(pos)
                        active_position = None
                    elif cur_high >= pos['sl']:
                        pnl = pos['lots'] * ((pos['entry'] - pos['sl']) / tick_size) * tick_val
                        equity += pnl
                        pos['pnl'] = pnl
                        pos['result'] = 'SL' if pnl < 0 else 'TRAIL_WIN'
                        if pnl < 0:
                            h4_losses[h4_cur_open_time] += 1
                        else:
                            h4_losses[h4_cur_open_time] = 0
                        trades.append(pos)
                        all_trades.append(pos)
                        active_position = None
                        
                if equity <= 0:
                    capital_lost = True
                    break
                    
            if capital_lost:
                break
                
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
                            'symbol': symbol,
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
                        
            check_idx = i - 1 - pivot_lookback
            if check_idx >= pivot_lookback:
                is_swing_high = True
                for k in range(1, pivot_lookback + 1):
                    if rates_1m[check_idx]['high'] <= rates_1m[check_idx - k]['high'] or rates_1m[check_idx]['high'] <= rates_1m[check_idx + k]['high']:
                        is_swing_high = False
                        break
                if is_swing_high:
                    last_swing_high = rates_1m[check_idx]['high']
                    last_swing_high_idx = check_idx
                is_swing_low = True
                for k in range(1, pivot_lookback + 1):
                    if rates_1m[check_idx]['low'] >= rates_1m[check_idx - k]['low'] or rates_1m[check_idx]['low'] >= rates_1m[check_idx + k]['low']:
                        is_swing_low = False
                        break
                if is_swing_low:
                    last_swing_low = rates_1m[check_idx]['low']
                    last_swing_low_idx = check_idx
                    
            c1 = rates_1m[i-1]['close']
            c2 = rates_1m[i-2]['close']
            if p4hc is None:
                continue
                
            is_bull_bias = (c1 > p4hc)
            is_bear_bias = (c1 < p4hc)
            is_h4_halted = (h4_losses.get(h4_cur_open_time, 0) >= max_consec_loss_h4)
            
            if is_h4_halted:
                pending_setup = None
                continue
                
            bullish_bos = False
            bull_origin_high = 0.0
            bull_origin_low = 0.0
            if last_swing_high is not None and (c1 > last_swing_high) and (c2 <= last_swing_high) and is_bull_bias:
                lowest_val = rates_1m[i-1]['low']
                origin_idx = i-1
                search_len = min(30, i - 1 - last_swing_high_idx) if last_swing_high_idx else 10
                for s in range(1, max(1, search_len + 1)):
                    if rates_1m[i - 1 - s]['low'] < lowest_val:
                        lowest_val = rates_1m[i - 1 - s]['low']
                        origin_idx = i - 1 - s
                if c1 > rates_1m[origin_idx]['high']:
                    bullish_bos = True
                    bull_origin_high = rates_1m[origin_idx]['high']
                    bull_origin_low = rates_1m[origin_idx]['low']
                    
            bearish_bos = False
            bear_origin_high = 0.0
            bear_origin_low = 0.0
            if last_swing_low is not None and (c1 < last_swing_low) and (c2 >= last_swing_low) and is_bear_bias:
                highest_val = rates_1m[i-1]['high']
                origin_idx = i-1
                search_len = min(30, i - 1 - last_swing_low_idx) if last_swing_low_idx else 10
                for s in range(1, max(1, search_len + 1)):
                    if rates_1m[i - 1 - s]['high'] > highest_val:
                        highest_val = rates_1m[i - 1 - s]['high']
                        origin_idx = i - 1 - s
                if c1 < rates_1m[origin_idx]['low']:
                    bearish_bos = True
                    bear_origin_high = rates_1m[origin_idx]['high']
                    bear_origin_low = rates_1m[origin_idx]['low']
                    
            if bullish_bos and active_position is None:
                has_fvg = False
                fvg_entry = 0.0
                fvg_sl = 0.0
                for k in range(1, 4):
                    if rates_1m[i - k]['low'] > rates_1m[i - k - 2]['high']:
                        has_fvg = True
                        fvg_entry = rates_1m[i - k]['low']
                        fvg_sl = rates_1m[i - k - 2]['high']
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
                    'dir': 1, 'entry': entry_p, 'sl': sl_p, 'tp': tp_p,
                    'risk_dist': risk_dist, 'lots': lots, 'bar_idx': i
                }
            elif bearish_bos and active_position is None:
                has_fvg = False
                fvg_entry = 0.0
                fvg_sl = 0.0
                for k in range(1, 4):
                    if rates_1m[i - k]['high'] < rates_1m[i - k - 2]['low']:
                        has_fvg = True
                        fvg_entry = rates_1m[i - k]['high']
                        fvg_sl = rates_1m[i - k - 2]['low']
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
                    'dir': -1, 'entry': entry_p, 'sl': sl_p, 'tp': tp_p,
                    'risk_dist': risk_dist, 'lots': lots, 'bar_idx': i
                }
                
        win_trades = [t for t in trades if t['pnl'] > 0]
        loss_trades = [t for t in trades if t['pnl'] < 0]
        profit_banked = max(0.0, equity - 100.0) if not capital_lost else 0.0
        
        monthly_results.append({
            'month': month_label,
            'starting_capital': 100.0,
            'final_equity': 0.0 if capital_lost else equity,
            'profit_banked': profit_banked,
            'is_blown': capital_lost,
            'total_trades': len(trades),
            'wins': len(win_trades),
            'losses': len(loss_trades)
        })
        
    return {
        'symbol': symbol,
        'strategy': 'P4H 1M BOS + FVG',
        'monthly': monthly_results,
        'trades': all_trades
    }

def main():
    if not mt5.initialize():
        print("Failed to initialize MT5")
        sys.exit(1)
        
    account = mt5.account_info()
    term = mt5.terminal_info()
    print("=" * 70)
    print(f"MT5 CONNECTED: {term.name} | Account: {account.login} | Server: {account.server}")
    print(f"Company: {account.company} | Trade Allowed: {account.trade_allowed}")
    print("=" * 70)
    
    symbols = ['EURUSD', 'GBPUSD', 'NAS100', 'US30']
    all_summary = []
    
    for s in symbols:
        res_5m = run_pdc_5m_backtest(s)
        if res_5m:
            all_summary.append(res_5m)
            
        res_1m = run_p4h_1m_backtest(s)
        if res_1m:
            all_summary.append(res_1m)
            
    mt5.shutdown()
    
    print("\n\n" + "#" * 80)
    print("                 MASTER REAL DATA BACKTEST SUMMARY REPORT")
    print("#" * 80)
    
    for item in all_summary:
        sym = item['symbol']
        strat = item['strategy']
        monthly = item['monthly']
        total_months = len(monthly)
        profitable_m = len([m for m in monthly if m['profit_banked'] > 0])
        blown_m = len([m for m in monthly if m['is_blown']])
        total_profit = sum(m['profit_banked'] for m in monthly)
        total_trades = sum(m['total_trades'] for m in monthly)
        total_wins = sum(m['wins'] for m in monthly)
        win_rate = (total_wins / total_trades * 100) if total_trades > 0 else 0.0
        net_in_pocket = total_profit - (blown_m * 100.0)
        
        print(f"\n=======================================================")
        print(f"  {sym} -- {strat}")
        print(f"=======================================================")
        print(f"Total Months Tested: {total_months}")
        print(f"Profitable Months:   {profitable_m} ({(profitable_m/total_months*100):.1f}%)")
        print(f"Blown Months:        {blown_m} ({(blown_m/total_months*100):.1f}%)")
        print(f"Total Trades Taken:  {total_trades} (Win Rate: {win_rate:.1f}%)")
        print(f"Gross Profit Banked: +${total_profit:,.2f}")
        print(f"Blown Account Losses:-${(blown_m * 100.0):,.2f}")
        print(f"NET PROFIT IN POCKET: +${net_in_pocket:,.2f}")
        print("-" * 55)
        print(f"{'Month':<16} | {'Trades':<6} | {'W/L':<7} | {'Banked Profit':<14} | {'Status'}")
        print("-" * 55)
        for m in monthly:
            status = "BLOWN ($0)" if m['is_blown'] else ("+$" + f"{m['profit_banked']:.2f}")
            wl = f"{m['wins']}/{m['losses']}"
            print(f"{m['month']:<16} | {m['total_trades']:<6} | {wl:<7} | ${m['profit_banked']:<13.2f} | {status}")
            
    print("\n" + "#" * 80)
    print("                     END OF MASTER REPORT")
    print("#" * 80)

if __name__ == '__main__':
    main()
