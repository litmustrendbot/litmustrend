import MetaTrader5 as mt5
import numpy as np
from datetime import datetime, timezone

def test_trade_limits(symbol="XAUUSD", risk_pct=10.0, mode="standard"):
    # mode: 'standard' (1 trade at a time), 'max_1_per_day', 'max_1_per_4h', 'cooldown_30m'
    mt5.initialize()
    sym_info = mt5.symbol_info(symbol)
    point = sym_info.point
    tick_size = sym_info.trade_tick_size if sym_info.trade_tick_size > 0 else point
    tick_val = sym_info.trade_tick_value if sym_info.trade_tick_value > 0 else 1.0
    contract_size = sym_info.trade_contract_size if sym_info.trade_contract_size > 0 else 1.0
    min_lot = sym_info.volume_min if sym_info.volume_min > 0 else 0.01
    lot_step = sym_info.volume_step if sym_info.volume_step > 0 else 0.01

    h4_rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_H4, datetime(2025, 12, 1, tzinfo=timezone.utc), datetime(2026, 9, 9, tzinfo=timezone.utc))
    h4_times = np.array([r['time'] for r in h4_rates])
    h4_closes = np.array([r['close'] for r in h4_rates])

    # Fetch 1M
    m1_list = []
    pos = 0
    while True:
        chunk = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, pos, 40000)
        if chunk is None or len(chunk) == 0: break
        m1_list.append(chunk)
        pos += len(chunk)
        if datetime.fromtimestamp(chunk[0]['time'], timezone.utc).year < 2026 or len(chunk) < 40000: break

    all_m1 = np.concatenate(m1_list[::-1])
    _, idx = np.unique(all_m1['time'], return_index=True)
    all_m1 = all_m1[idx]
    all_m1 = all_m1[all_m1['time'] >= datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp()]
    earliest_m1 = all_m1[0]['time']

    combined = []
    m5_rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_M5, datetime(2026, 1, 1, tzinfo=timezone.utc), datetime.fromtimestamp(earliest_m1, timezone.utc))
    if m5_rates is not None:
        for r in m5_rates:
            t, o, h, l, c = r['time'], r['open'], r['high'], r['low'], r['close']
            rng = max(point * 10, h - l)
            if c >= o:
                p_c = [o + rng * 0.05, l + rng * 0.1, l + rng * 0.45, h - rng * 0.1, c]
                p_h = [max(o, p_c[0] + rng * 0.05), p_c[1] + rng * 0.1, p_c[2] + rng * 0.15, h, max(c, p_c[4])]
                p_l = [min(o, p_c[0] - rng * 0.05), l, p_c[2] - rng * 0.1, p_c[3] - rng * 0.1, min(c, p_c[4])]
            else:
                p_c = [o - rng * 0.05, h - rng * 0.1, h - rng * 0.45, l + rng * 0.1, c]
                p_h = [max(o, p_c[0] + rng * 0.05), h, p_c[2] + rng * 0.1, p_c[3] + rng * 0.1, max(c, p_c[4])]
                p_l = [min(o, p_c[0] - rng * 0.05), p_c[1] - rng * 0.1, p_c[2] - rng * 0.15, l, min(c, p_c[4])]
            for m in range(5):
                bt = t + m * 60
                if bt < earliest_m1:
                    combined.append((bt, p_c[m-1] if m>0 else o, p_h[m], p_l[m], p_c[m], r['tick_volume']//5))
    for r in all_m1:
        combined.append((r['time'], r['open'], r['high'], r['low'], r['close'], r['tick_volume']))

    rates = np.array(combined, dtype=[('time', '<i8'), ('open', '<f8'), ('high', '<f8'), ('low', '<f8'), ('close', '<f8'), ('tick_volume', '<i8')])
    highs, lows, closes, times = rates['high'], rates['low'], rates['close'], rates['time']
    n_bars = len(rates)

    equity = 100.0
    trades = []
    daily_consec_losses = 0
    cur_day = -1
    cur_4h_idx = -1
    trades_today = 0
    trades_this_4h = 0
    last_trade_exit_time = 0

    last_sh, last_sl = None, None
    last_sh_idx, last_sl_idx = -1, -1
    setup_pending = False
    setup_dir, setup_entry, setup_sl_p, setup_risk, setup_idx = 0, 0.0, 0.0, 0.0, -1
    active_pos = None

    for i in range(16, n_bars):
        bar_time = times[i]
        dt = datetime.fromtimestamp(bar_time, timezone.utc)
        day_id = dt.year * 1000 + dt.timetuple().tm_yday
        if day_id != cur_day:
            cur_day = day_id
            daily_consec_losses = 0
            trades_today = 0

        h4_idx = np.searchsorted(h4_times, bar_time, side='right') - 1
        if h4_idx != cur_4h_idx:
            cur_4h_idx = h4_idx
            trades_this_4h = 0

        is_daily_halted = (daily_consec_losses >= 3)

        # Manage active position
        if active_pos is not None:
            p_dir, p_ent, p_sl, p_tp = active_pos['dir'], active_pos['entry'], active_pos['sl'], active_pos['tp']
            p_risk, p_risk_usd, peak_r = active_pos['risk_dist'], active_pos['risk_usd'], active_pos['peak_r']
            bh, bl = highs[i], lows[i]
            closed = False
            pnl = 0.0

            if p_dir == 1:
                cur_r = (bh - p_ent) / p_risk
                peak_r = max(peak_r, cur_r)
                active_pos['peak_r'] = peak_r
                if peak_r >= 9.9: p_sl = max(p_sl, p_ent + 9.0 * p_risk)
                elif peak_r >= 9.8: p_sl = max(p_sl, p_ent + 8.0 * p_risk)
                elif peak_r >= 9.7: p_sl = max(p_sl, p_ent + 7.0 * p_risk)
                elif peak_r >= 9.6: p_sl = max(p_sl, p_ent + 6.0 * p_risk)
                elif peak_r >= 9.5: p_sl = max(p_sl, p_ent + 5.0 * p_risk)
                active_pos['sl'] = p_sl

                if bh >= p_tp:
                    closed, pnl = True, p_risk_usd * 10.0
                elif bl <= p_sl:
                    closed, pnl = True, p_risk_usd * ((p_sl - p_ent) / p_risk)
            else:
                cur_r = (p_ent - bl) / p_risk
                peak_r = max(peak_r, cur_r)
                active_pos['peak_r'] = peak_r
                if peak_r >= 9.9: p_sl = min(p_sl, p_ent - 9.0 * p_risk)
                elif peak_r >= 9.8: p_sl = min(p_sl, p_ent - 8.0 * p_risk)
                elif peak_r >= 9.7: p_sl = min(p_sl, p_ent - 7.0 * p_risk)
                elif peak_r >= 9.6: p_sl = min(p_sl, p_ent - 6.0 * p_risk)
                elif peak_r >= 9.5: p_sl = min(p_sl, p_ent - 5.0 * p_risk)
                active_pos['sl'] = p_sl

                if bl <= p_tp:
                    closed, pnl = True, p_risk_usd * 10.0
                elif bh >= p_sl:
                    closed, pnl = True, p_risk_usd * ((p_ent - p_sl) / p_risk)

            if closed:
                equity += pnl
                if pnl < 0: daily_consec_losses += 1
                else: daily_consec_losses = 0
                last_trade_exit_time = bar_time
                trades.append({'pnl': pnl, 'equity': equity, 'time': bar_time, 'week': dt.isocalendar()[1]})
                active_pos = None

        if is_daily_halted:
            setup_pending = False
            continue

        # Check pending fill
        if setup_pending and active_pos is None:
            if (i - setup_idx) > 25:
                setup_pending = False
            elif setup_dir == 1:
                if lows[i] <= setup_sl_p: setup_pending = False
                elif lows[i] <= setup_entry:
                    risk_usd = equity * (risk_pct / 100.0)
                    active_pos = {'dir': 1, 'entry': setup_entry, 'sl': setup_sl_p, 'tp': setup_entry + 10.0 * setup_risk, 'risk_dist': setup_risk, 'risk_usd': risk_usd, 'peak_r': 0.0}
                    trades_today += 1
                    trades_this_4h += 1
                    setup_pending = False
            elif setup_dir == -1:
                if highs[i] >= setup_sl_p: setup_pending = False
                elif highs[i] >= setup_entry:
                    risk_usd = equity * (risk_pct / 100.0)
                    active_pos = {'dir': -1, 'entry': setup_entry, 'sl': setup_sl_p, 'tp': setup_entry - 10.0 * setup_risk, 'risk_dist': setup_risk, 'risk_usd': risk_usd, 'peak_r': 0.0}
                    trades_today += 1
                    trades_this_4h += 1
                    setup_pending = False

        # Additional filter checks for new signals:
        if active_pos is not None:
            continue # Already running a trade -> DO NOT OPEN ANOTHER TRADE

        if mode == 'max_1_per_day' and trades_today >= 1:
            continue
        if mode == 'max_1_per_4h' and trades_this_4h >= 1:
            continue
        if mode == 'cooldown_30m' and (bar_time - last_trade_exit_time) < 1800:
            continue

        # Swings
        chk = i - 4
        if chk >= 3:
            if all(highs[chk] > highs[chk-k] and highs[chk] > highs[chk+k] for k in range(1, 4)):
                last_sh, last_sh_idx = highs[chk], chk
            if all(lows[chk] < lows[chk-k] and lows[chk] < lows[chk+k] for k in range(1, 4)):
                last_sl, last_sl_idx = lows[chk], chk

        if h4_idx < 1: continue
        p4h_c = h4_closes[h4_idx - 1]
        c1, c2 = closes[i-1], closes[i-2]

        if not is_daily_halted and last_sh and c1 > last_sh and c2 <= last_sh and c1 > p4h_c:
            low_v, off = lows[i-1], 1
            for s in range(1, min(30, i-1) + 1):
                if lows[i-s] < low_v: low_v, off = lows[i-s], s
            if c1 > highs[i - off]:
                has_fvg, fe, fs = False, 0.0, 0.0
                for k in range(1, 4):
                    if lows[i-k] > highs[i-k-2]: has_fvg, fe, fs = True, lows[i-k], highs[i-k-2]; break
                setup_pending, setup_dir, setup_idx = True, 1, i
                setup_entry = fe if has_fvg else highs[i-off]
                sl_tmp = fs if has_fvg else lows[i-off]
                setup_risk = max(abs(setup_entry - sl_tmp), point * 5.0)
                setup_sl_p = setup_entry - setup_risk

        elif not is_daily_halted and last_sl and c1 < last_sl and c2 >= last_sl and c1 < p4h_c:
            hi_v, off = highs[i-1], 1
            for s in range(1, min(30, i-1) + 1):
                if highs[i-s] > hi_v: hi_v, off = highs[i-s], s
            if c1 < lows[i - off]:
                has_fvg, fe, fs = False, 0.0, 0.0
                for k in range(1, 4):
                    if highs[i-k] < lows[i-k-2]: has_fvg, fe, fs = True, highs[i-k], lows[i-k-2]; break
                setup_pending, setup_dir, setup_idx = True, -1, i
                setup_entry = fe if has_fvg else lows[i-off]
                sl_tmp = fs if has_fvg else highs[i-off]
                setup_risk = max(abs(sl_tmp - setup_entry), point * 5.0)
                setup_sl_p = setup_entry + setup_risk

    wins = [t for t in trades if t['pnl'] > 0]
    wr = len(wins)/len(trades)*100 if len(trades)>0 else 0
    print(f"Mode: {mode:<15} | Trades: {len(trades):<5} | Wins: {len(wins):<4} | WinRate: {wr:<5.1f}% | Final Equity: ${equity:<10,.2f} | Net: {((equity-100)/100)*100:+,.1f}%")

if __name__ == "__main__":
    for m in ['standard', 'max_1_per_4h', 'cooldown_30m', 'max_1_per_day']:
        test_trade_limits(mode=m)
