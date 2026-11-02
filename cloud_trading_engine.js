/**
 * LITMUSTREND CLOUD TRADING ENGINE
 * Powered by MetaApi.cloud REST & Streaming RPC API
 * Strategy: Option C (15M FVG + 5M Reversal Confirmation + Stepped Trailing Stop Ladder + 1% Dynamic Risk)
 * Multi-Symbol Support: BTCUSD (Bitcoin 24/7), XAUUSD (Gold), NAS100 (Nasdaq)
 */

const MetaApi = require('metaapi.cloud-sdk').default;

const METAAPI_TOKEN = process.env.METAAPI_TOKEN || "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiIxYzBlNDdiYTcxNTc1YjQ4N2M1ZGJjNzhjODU5NDFkNiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtZXRhc3RhdHMtYXBpIiwibWV0aG9kcyI6WyJtZXRhc3RhdHMtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6InJpc2stbWFuYWdlbWVudC1hcGkiLCJtZXRob2RzIjpbInJpc2stbWFuYWdlbWVudC1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoiY29weWZhY3RvcnktYXBpIiwibWV0aG9kcyI6WyJjb3B5ZmFjdG9yeS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoibXQtbWFuYWdlci1hcGkiLCJtZXRob2RzIjpbIm10LW1hbmFnZXItYXBpOnJlc3Q6ZGVhbGluZzoqOioiLCJtdC1tYW5hZ2VyLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJiaWxsaW5nLWFwaSIsIm1ldGhvZHMiOlsiYmlsbGluZy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfV0sImlnbm9yZVJhdGVMaW1pdHMiOmZhbHNlLCJ0b2tlbklkIjoiMjAyMTAyMTMiLCJpbXBlcnNvbmF0ZWQiOmZhbHNlLCJyZWFsVXNlcklkIjoiMWMwZTQ3YmE3MTU3NWI0ODdjNWRiYzc4Yzg1OTQxZDYiLCJpYXQiOjE3OTM0MDQ4NzQsImV4cCI6MTgwMTE4MDg3NH0.mf7qTzcLGLbMYvaYd5xZxAKbU6hEKsoDE98xgcP4SZMYSCfXbQYnz9bHgcmtIBG3smG5xq04hMUteJTvQMV6eGrR6hPw5NtH7sB5ZzFQDuEDKE4y4NzUXiePOOZgHTxjtc570IgQJTF3TXN943mqehQHK2gRghUD1IVg40wFZMe3z_K7mN9mgUXe2zo_YSJyYKh1B5xAa_MSq2jiVmD6ZZJR5_dhB85oEC44G4UC9uyAoZggW7bUsiPla_pTfagSkG03TdOxKcwT7nCN1nGTj7CfnAQgITHaYQ_IYK6sjbfuadNNLc4QPxRKfw9F0Gw__LfaUEx2QiFlkko2P-FQ27siLSgxlr4CGZm7NurZ6o0n14fw4pO2EQesOc_6APD1C5tY5JP8QjqXU5lWRsujI3LnVgc2QpHJHpaZm-86N07kHpFUuBFqnwD97A0bTaNvtmoyklfpzcFDAx5b9ioIbnm3bkL9KOgUl1w4yh9uKfZzzf0LTtKH7qMbeKNCv-OKbPpxD3yutg896E_a_deepShGBKrm4fWJNRPBqjtL-uCTDMSE8allJG_9eOdFUZyLAp3v__h_qnQgNHg0NDkVow0r2-wyq_-W3rR1B_y7bscql-zCK57TFL1xbMLM1lBc7_f1uMIRWG2wR7MxeIq7D8vKqCgmb9wAptLered_YBo";
const SYMBOLS = (process.env.TRADING_SYMBOLS || process.env.TRADING_SYMBOL || 'XAUUSDc,XAUUSDm,XAUUSD')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
const RISK_PERCENT = parseFloat(process.env.RISK_PERCENT || '1.0');
const PRE_CLOSE_SECONDS = 15;
const MAGIC_NUMBER = 155025;
const MAX_CONCURRENT_POSITIONS = 10;

// User Stepped Trailing Stop Ladder Function
function getLadderLockedR(maxR) {
    if (maxR >= 40.0) return Math.floor(maxR - 4.0);
    else if (maxR >= 39.0) return 35.0;
    else if (maxR >= 35.0) return 31.0;
    else if (maxR >= 33.0) return 30.0;
    else if (maxR >= 30.0) return 26.0;
    else if (maxR >= 29.0) return 25.0;
    else if (maxR >= 25.0) return 21.0;
    else if (maxR >= 23.0) return 20.0;
    else if (maxR >= 20.0) return 16.0;
    else if (maxR >= 19.0) return 15.0;
    else if (maxR >= 15.0) return 11.0;
    else if (maxR >= 13.0) return 10.0;
    else if (maxR >= 10.0) return 6.0;
    else if (maxR >= 9.0)  return 5.0;
    else if (maxR >= 5.0)  return 1.0;
    else if (maxR >= 3.0)  return 0.0; // 1:3 Break-Even
    return -1.0;
}

const engineLogs = [];
function addEngineLog(msg) {
    const entry = `[${new Date().toISOString()}] ${msg}`;
    console.log(entry);
    engineLogs.push(entry);
    if (engineLogs.length > 50) engineLogs.shift();
}

class LitmusCloudEngine {
    constructor(token, accountId) {
        this.token = token;
        this.accountId = accountId;
        this.metaApi = new MetaApi(token);
        this.activeEngines = new Map();
        this.connections = new Map();
        this.attachedAccounts = [];
        this.zones = {}; // Per-symbol FVG POI zones
        this.dailyClose = {}; // Per-symbol Previous Day Close (PDC for New Strategy)
        this.h4Close = {}; // Per-symbol Previous 4H Close (for The Big Boys)
        this.swingHigh = {};
        this.swingLow = {};
        this.lastTraded5MTime = {};
        this.last15MTime = {};
        this.lastPrices = {};
        this.isScanning = false;
    }

    async start() {
        addEngineLog(`Starting Multi-Account Cloud Engine Coordinator...`);

        const attachAccount = async (accId) => {
            if (this.activeEngines.has(accId)) return;
            this.activeEngines.set(accId, true);
            addEngineLog(`Attempting to attach account: ${accId}...`);

            let retries = 0;
            while (retries < 15) {
                try {
                    const account = await this.metaApi.metatraderAccountApi.getAccount(accId);
                    if (!account) {
                        addEngineLog(`Account ${accId} not found in MetaApi`);
                        break;
                    }

                    // If account state is undeployed, deploy it
                    if (account.state !== 'DEPLOYED') {
                        addEngineLog(`Account ${accId} state: ${account.state}. Requesting deployment...`);
                        try { await account.deploy(); } catch (e) {}
                    }

                    addEngineLog(`Waiting for account ${account.login || accId} to connect to broker...`);
                    await account.waitConnected();
                    const connection = account.getStreamingConnection();
                    await connection.connect();
                    await connection.waitSynchronized();
                    this.connections.set(account.id, connection);
                    addEngineLog(`Account ${account.login || accId} Synchronized with Broker! Scanning active on: ${SYMBOLS.join(', ')}...`);

                    let accStrategy = 'The Big Boys 4H';
                    try {
                        const syncRes = await fetch(`https://litmustrend.vercel.app/api/portal/sync?login=${account.login}`);
                        if (syncRes.ok) {
                            const syncData = await syncRes.json();
                            if (syncData && syncData.strategy) accStrategy = syncData.strategy;
                        }
                    } catch (e) {}

                    this.attachedAccounts.push({
                        id: account.id,
                        login: account.login,
                        server: account.server,
                        strategy: accStrategy,
                        state: 'CONNECTED',
                        symbols: SYMBOLS,
                        connectedAt: Date.now()
                    });

                    // Initialize symbol zones & subscribe to market data
                    for (const sym of SYMBOLS) {
                        if (!this.zones[sym]) this.zones[sym] = [];
                        let isSubscribed = false;
                        try {
                            await connection.subscribeToMarketData(sym);
                            isSubscribed = true;
                            addEngineLog(`[Market Data] Subscribed to real-time quotes for ${sym}`);
                        } catch (subErr) {
                            addEngineLog(`[Subscription Error] ${sym}: ${subErr.message}`);
                        }

                        if (isSubscribed) {
                            try {
                                await this.updateMacroFilters(account, sym);
                                await this.update15MStructure(account, sym);
                                addEngineLog(`[Init Structure] ${sym} D1 PDC=${this.dailyClose[sym] || 'None'} 4H Close=${this.h4Close[sym] || 'None'} SH=${this.swingHigh[sym] || 'None'} SL=${this.swingLow[sym] || 'None'} ActiveZones=${(this.zones[sym] || []).length}`);
                            } catch (structErr) {
                                addEngineLog(`[Init Structure Error] ${sym}: ${structErr.message}`);
                            }
                        }
                    }

                    // Start Market Structure & Signal Evaluation Loop (Runs every 1000ms)
                    setInterval(() => this.scanMarket(account, connection), 1000);

                    // Start Stepped Ladder Trailing Loop (Runs every 2000ms)
                    setInterval(() => this.manageOpenPositions(connection), 2000);

                    // Start Web Dashboard Sync Telemetry Loop (Runs every 8000ms)
                    setInterval(() => this.syncHeartbeat(connection), 8000);
                    break;

                } catch (err) {
                    retries++;
                    if (err.message && (err.message.includes('not found') || err.message.includes('404'))) {
                        addEngineLog(`Account ${accId} does not exist in MetaApi. Stopping retries.`);
                        break;
                    }
                    addEngineLog(`Account ${accId} waiting (${err.message}). Retrying in 15 seconds (attempt ${retries}/15)...`);
                    await new Promise(r => setTimeout(r, 15000));
                }
            }
        };

        const discoverAccounts = async () => {
            try {
                const res = await fetch("https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts", {
                    headers: { "auth-token": this.token }
                });
                if (res.ok) {
                    const accounts = await res.json();
                    addEngineLog(`Discovered ${accounts.length} accounts from MetaApi provisioning API`);
                    for (const acc of accounts) {
                        const accId = acc._id || acc.id;
                        if (!this.activeEngines.has(accId)) {
                            addEngineLog(`Discovered account: ${acc.login} (${accId}, state=${acc.state})! Attaching...`);
                            attachAccount(accId);
                        }
                    }
                }
            } catch (pollErr) {
                addEngineLog(`Discovery error: ${pollErr.message}`);
            }
        };

        // Attach primary account immediately if provided
        if (this.accountId) {
            attachAccount(this.accountId);
        }

        // Run account discovery immediately on startup and poll every 15s
        await discoverAccounts();
        setInterval(discoverAccounts, 15000);
    }

    async syncHeartbeat(connection) {
        try {
            const accInfo = connection.terminalState ? connection.terminalState.accountInformation : null;
            if (!accInfo) return;
            const positions = connection.terminalState ? connection.terminalState.positions : [];
            let activeTrade = null;
            if (positions && positions.length > 0) {
                const p = positions[0];
                activeTrade = {
                    symbol: p.symbol,
                    type: p.type === 'POSITION_TYPE_BUY' ? 'BUY' : 'SELL',
                    lots: p.volume,
                    entry: p.openPrice ? p.openPrice.toFixed(2) : '-',
                    target: 'Stepped Ladder',
                    trailing: p.stopLoss ? `SL: ${p.stopLoss.toFixed(2)}` : 'Initial SL',
                    pnl: `${p.unrealizedProfit >= 0 ? '+' : ''}$${(p.unrealizedProfit || 0).toFixed(2)}`
                };
            }
            this.sendSyncPayload({
                login: String(accInfo.login || '161787744'),
                server: accInfo.server || 'Exness-MT5Real21',
                balance: accInfo.balance,
                equity: accInfo.equity,
                event: 'HEARTBEAT',
                activeTrade
            });
        } catch (e) {}
    }

    sendSyncPayload(payload) {
        try {
            const https = require('https');
            const data = JSON.stringify(payload);
            const req = https.request('https://litmustrend.vercel.app/api/portal/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, () => {});
            req.on('error', () => {});
            req.write(data);
            req.end();
        } catch (e) {}
    }

    // Dynamic 1.0% Lot Sizing
    calculateLotSize(connection, symbol, entryPrice, slPrice, riskPercent) {
        const riskDist = Math.abs(entryPrice - slPrice);
        if (riskDist <= 0) return 0.01;

        const terminalState = connection.terminalState;
        const accountInfo = terminalState ? terminalState.accountInformation : null;
        const equity = accountInfo && accountInfo.equity > 0 ? accountInfo.equity : 100.0;

        const spec = terminalState ? terminalState.specification(symbol) : null;
        const tickSize = spec && spec.tickSize > 0 ? spec.tickSize : 0.01;
        const tickValue = spec && spec.tickValue > 0 ? spec.tickValue : 1.0;
        const minLot = spec && spec.minVolume > 0 ? spec.minVolume : 0.01;
        const maxLot = spec && spec.maxVolume > 0 ? Math.min(spec.maxVolume, 10.0) : 10.0;
        const lotStep = spec && spec.volumeStep > 0 ? spec.volumeStep : 0.01;

        const lossPerLot = (riskDist / tickSize) * tickValue;
        if (lossPerLot <= 0) return minLot;

        const riskAmount = equity * (riskPercent / 100.0);
        let lot = riskAmount / lossPerLot;
        lot = Math.max(minLot, Math.min(maxLot, lot));
        lot = Math.floor(lot / lotStep) * lotStep;

        return parseFloat(lot.toFixed(2));
    }

    // Update Macro Filters (D1 Previous Day Close & 4H Previous Candle Close)
    async updateMacroFilters(account, symbol) {
        try {
            const candlesD1 = await account.getHistoricalCandles(symbol, '1d', undefined, 5);
            if (candlesD1 && candlesD1.length >= 2) {
                this.dailyClose[symbol] = candlesD1[candlesD1.length - 2].close;
            }
        } catch (e) {
            addEngineLog(`[Macro D1 Error] ${symbol}: ${e.message}`);
        }

        try {
            const candles4H = await account.getHistoricalCandles(symbol, '4h', undefined, 5);
            if (candles4H && candles4H.length >= 2) {
                this.h4Close[symbol] = candles4H[candles4H.length - 2].close;
            }
        } catch (e) {
            addEngineLog(`[Macro 4H Error] ${symbol}: ${e.message}`);
        }

        addEngineLog(`[Macro Filters] ${symbol} D1 PDC=${this.dailyClose[symbol] || 'None'} | 4H Close=${this.h4Close[symbol] || 'None'}`);
    }

    // Update 15M Structure & Fair Value Gaps
    async update15MStructure(account, symbol) {
        try {
            const r15 = await account.getHistoricalCandles(symbol, '15m', undefined, 40);
            if (!r15 || r15.length < 25) {
                addEngineLog(`[15M Structure] ${symbol}: received ${r15 ? r15.length : 0} candles`);
                return;
            }

            const n = r15.length;
            const lastClosed = r15[n - 2];
            const prevClosed = r15[n - 3];
            const c1 = lastClosed.close;
            const c2 = prevClosed.close;

            // 1. Fractal Swings (Lookback = 3)
            const lookback = 3;
            let currentSH = null;
            let currentSL = null;
            for (let i = n - 2 - lookback; i >= lookback; i--) {
                let isHigh = true;
                let isLow = true;
                for (let k = 1; k <= lookback; k++) {
                    if (r15[i].high <= r15[i - k].high || r15[i].high < r15[i + k].high) isHigh = false;
                    if (r15[i].low >= r15[i - k].low || r15[i].low > r15[i + k].low) isLow = false;
                }
                if (isHigh && !currentSH) currentSH = r15[i].high;
                if (isLow && !currentSL) currentSL = r15[i].low;
                if (currentSH && currentSL) break;
            }
            if (currentSH) this.swingHigh[symbol] = currentSH;
            if (currentSL) this.swingLow[symbol] = currentSL;

            // 2. Trend & BOS Check (Both 4H for The Big Boys and D1 for New Strategy)
            const pdc = this.dailyClose[symbol] || 0;
            const p4hc = this.h4Close[symbol] || 0;

            const macroBull_4H = (p4hc === 0) || (c1 > p4hc);
            const macroBear_4H = (p4hc === 0) || (c1 < p4hc);

            const macroBull_D1 = (pdc === 0) || (c1 > pdc);
            const macroBear_D1 = (pdc === 0) || (c1 < pdc);

            const macroBull = macroBull_4H || macroBull_D1;
            const macroBear = macroBear_4H || macroBear_D1;

            const bullishBOS = macroBull && (this.swingHigh[symbol] > 0) && (c1 > this.swingHigh[symbol]) && (c2 <= this.swingHigh[symbol]);
            const bearishBOS = macroBear && (this.swingLow[symbol] > 0) && (c1 < this.swingLow[symbol]) && (c2 >= this.swingLow[symbol]);

            if (!this.zones[symbol]) this.zones[symbol] = [];

            // If we have no active zones, check recent historical BOS & FVGs across past 25 bars
            const activeZones = this.zones[symbol].filter(z => z.isActive);
            const needHistoricalScan = (activeZones.length === 0);

            if (bullishBOS || bearishBOS || needHistoricalScan) {
                let fvgCount = 0;
                for (let k = n - 2; k >= Math.max(2, n - 25) && fvgCount < 4; k--) {
                    if (r15[k] && r15[k - 1] && r15[k - 2]) {
                        if (macroBull && r15[k].low > r15[k - 2].high) {
                            const zTop = r15[k].low;
                            const zBottom = r15[k - 1].low;
                            const exists = this.zones[symbol].some(z => Math.abs(z.zoneTop - zTop) < 0.2);
                            if (!exists) {
                                this.zones[symbol].push({
                                    direction: 1, // Bullish
                                    zoneTop: zTop,
                                    zoneBottom: zBottom,
                                    isActive: true,
                                    ageBars: (n - 2 - k) * 3,
                                    lastOppHigh: 0,
                                    cand1Seen: false
                                });
                                fvgCount++;
                            }
                        } else if (macroBear && r15[k].high < r15[k - 2].low) {
                            const zBottom = r15[k].high;
                            const zTop = r15[k - 1].high;
                            const exists = this.zones[symbol].some(z => Math.abs(z.zoneBottom - zBottom) < 0.2);
                            if (!exists) {
                                this.zones[symbol].push({
                                    direction: -1, // Bearish
                                    zoneBottom: zBottom,
                                    zoneTop: zTop,
                                    isActive: true,
                                    ageBars: (n - 2 - k) * 3,
                                    lastOppLow: 0,
                                    cand1Seen: false
                                });
                                fvgCount++;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            addEngineLog(`[15M Structure Error] ${symbol}: ${e.message}`);
        }
    }

    async scanMarket(account, connection) {
        if (this.isScanning) return;
        this.isScanning = true;

        try {
            const terminalState = connection.terminalState;

            for (const sym of SYMBOLS) {
                // 1. Fetch live quote from subscribed streaming state
                const price = terminalState ? terminalState.price(sym) : null;
                if (!price || !price.bid || !price.ask) continue;
                this.lastPrices[sym] = { bid: price.bid, ask: price.ask, time: new Date().toISOString() };

                // 2. Maintain 15M Structure & PDC filter periodically (every 60s)
                const nowMs = Date.now();
                if (!this.last15MTime[sym] || nowMs - this.last15MTime[sym] >= 60000) {
                    this.last15MTime[sym] = nowMs;
                    await this.updateMacroFilters(account, sym);
                    await this.update15MStructure(account, sym);
                }

                const now = new Date();
                const secondsIn5M = (now.getMinutes() % 5) * 60 + now.getSeconds();
                const secondsRemaining = 300 - secondsIn5M;

                // 3. Pre-close trigger: check within final 5 seconds of the 5M candle
                if (secondsRemaining <= PRE_CLOSE_SECONDS) {
                    const currentBarKey = `${sym}-${now.getUTCHours()}:${Math.floor(now.getUTCMinutes() / 5) * 5}`;
                    if (this.lastTraded5MTime[sym] === currentBarKey) continue;
                    this.lastTraded5MTime[sym] = currentBarKey;

                    const activeZonesCount = (this.zones[sym] || []).filter(z => z.isActive).length;
                    addEngineLog(`[5M Pre-Close Evaluation] ${sym} | Bid=${price.bid} Ask=${price.ask} | Active Zones=${activeZonesCount}`);

                    // Evaluate and execute 5M confirmation trade inside active FVG
                    await this.evaluateSetup(account, connection, sym, price);
                }
            }
        } catch (e) {
            console.error('Scan error:', e.message);
        } finally {
            this.isScanning = false;
        }
    }

    async evaluateSetup(account, connection, symbol, currentPrice) {
        try {
            const zones = this.zones[symbol] || [];
            if (zones.length === 0) return;

            // Check current open positions count
            const positions = connection.terminalState ? connection.terminalState.positions : [];
            const openCount = positions ? positions.filter(p => p.symbol === symbol && p.magic === MAGIC_NUMBER).length : 0;
            if (openCount >= MAX_CONCURRENT_POSITIONS) return;

            // Fetch last 4 5M candles from account
            const r5 = await account.getHistoricalCandles(symbol, '5m', undefined, 4);
            if (!r5 || r5.length < 3) return;

            const c5 = r5[r5.length - 1]; // Forming candle (within final 5s of close)
            const o1 = c5.open, h1 = c5.high, l1 = c5.low, cl1 = c5.close;
            const isBull5M = cl1 > o1;
            const isBear5M = cl1 < o1;

            // Account-level strategy filter check
            const attached = this.attachedAccounts.find(a => a.id === account.id || String(a.login) === String(account.login));
            const isD1 = attached && attached.strategy && (attached.strategy.includes('D1') || attached.strategy.includes('New Strategy'));
            const macroFilter = isD1 ? (this.dailyClose[symbol] || 0) : (this.h4Close[symbol] || 0);

            for (const zone of zones) {
                if (!zone.isActive) continue;

                // Enforce account's macro filter alignment (D1 PDC vs 4H Close)
                if (macroFilter > 0) {
                    if (zone.direction === 1 && currentPrice.ask < macroFilter) continue;
                    if (zone.direction === -1 && currentPrice.bid > macroFilter) continue;
                }

                zone.ageBars = (zone.ageBars || 0) + 1;
                if (zone.ageBars > 150) {
                    zone.isActive = false;
                    continue;
                }

                // --- BEARISH SETUP (Waiting for 5M reversal inside Bearish FVG) ---
                if (zone.direction === -1) {
                    const inZone = (h1 >= zone.zoneBottom);
                    if (!inZone && (!zone.lastOppLow || zone.lastOppLow === 0)) continue;

                    if (isBull5M) {
                        zone.lastOppLow = l1;
                        zone.cand1Seen = false;
                        continue;
                    } else if (isBear5M && zone.lastOppLow > 0) {
                        let trigger = false;
                        if (cl1 < zone.lastOppLow) trigger = true;
                        else if (!zone.cand1Seen) {
                            zone.cand1Seen = true;
                            continue;
                        } else if (zone.cand1Seen) {
                            trigger = true;
                        }

                        if (trigger) {
                            const entryPrice = currentPrice.bid;
                            let slPrice = zone.zoneTop;
                            const minSlDist = (symbol.includes('BTC') || symbol.includes('NAS')) ? 5.0 : 0.50;
                            if (slPrice < entryPrice + minSlDist) slPrice = entryPrice + minSlDist;

                            const riskDist = slPrice - entryPrice;
                            const lots = this.calculateLotSize(connection, symbol, entryPrice, slPrice, RISK_PERCENT);

                            console.log(`[ORDER EXECUTION] Placing SELL on ${symbol} | Lots: ${lots} | SL: ${slPrice} | Risk Dist: ${riskDist.toFixed(2)}`);
                            const result = await connection.createMarketSellOrder(symbol, lots, slPrice, 0, {
                                comment: `Ladder5M Risk:${riskDist.toFixed(2)}`,
                                magic: MAGIC_NUMBER
                            });

                            console.log(`[SELL ENTERED SUCCESS] Order ID: ${result ? result.orderId : 'Accepted'} on ${symbol}`);
                            zone.isActive = false;
                            const liveAcc = connection.terminalState ? connection.terminalState.accountInformation : null;
                            this.sendSyncPayload({
                                login: liveAcc ? String(liveAcc.login) : '161787744',
                                server: liveAcc ? liveAcc.server : 'Exness-MT5Real21',
                                event: 'OPEN',
                                activeTrade: {
                                    symbol: symbol,
                                    type: 'SELL',
                                    lots: lots,
                                    entry: entryPrice.toFixed(2),
                                    target: 'Stepped Ladder',
                                    trailing: 'Initial SL',
                                    pnl: '+$0.00'
                                }
                            });
                            break;
                        }
                    }
                }
                // --- BULLISH SETUP (Waiting for 5M reversal inside Bullish FVG) ---
                else if (zone.direction === 1) {
                    const inZone = (l1 <= zone.zoneTop);
                    if (!inZone && (!zone.lastOppHigh || zone.lastOppHigh === 0)) continue;

                    if (isBear5M) {
                        zone.lastOppHigh = h1;
                        zone.cand1Seen = false;
                        continue;
                    } else if (isBull5M && zone.lastOppHigh > 0) {
                        let trigger = false;
                        if (cl1 > zone.lastOppHigh) trigger = true;
                        else if (!zone.cand1Seen) {
                            zone.cand1Seen = true;
                            continue;
                        } else if (zone.cand1Seen) {
                            trigger = true;
                        }

                        if (trigger) {
                            const entryPrice = currentPrice.ask;
                            let slPrice = zone.zoneBottom;
                            const minSlDist = (symbol.includes('BTC') || symbol.includes('NAS')) ? 5.0 : 0.50;
                            if (slPrice > entryPrice - minSlDist) slPrice = entryPrice - minSlDist;

                            const riskDist = entryPrice - slPrice;
                            const lots = this.calculateLotSize(connection, symbol, entryPrice, slPrice, RISK_PERCENT);

                            console.log(`[ORDER EXECUTION] Placing BUY on ${symbol} | Lots: ${lots} | SL: ${slPrice} | Risk Dist: ${riskDist.toFixed(2)}`);
                            const result = await connection.createMarketBuyOrder(symbol, lots, slPrice, 0, {
                                comment: `Ladder5M Risk:${riskDist.toFixed(2)}`,
                                magic: MAGIC_NUMBER
                            });

                            console.log(`[BUY ENTERED SUCCESS] Order ID: ${result ? result.orderId : 'Accepted'} on ${symbol}`);
                            zone.isActive = false;
                            const liveAcc = connection.terminalState ? connection.terminalState.accountInformation : null;
                            this.sendSyncPayload({
                                login: liveAcc ? String(liveAcc.login) : '161787744',
                                server: liveAcc ? liveAcc.server : 'Exness-MT5Real21',
                                event: 'OPEN',
                                activeTrade: {
                                    symbol: symbol,
                                    type: 'BUY',
                                    lots: lots,
                                    entry: entryPrice.toFixed(2),
                                    target: 'Stepped Ladder',
                                    trailing: 'Initial SL',
                                    pnl: '+$0.00'
                                }
                            });
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            console.error(`[Trade Execution Error] on ${symbol}:`, e.message);
        }
    }

    async manageOpenPositions(connection) {
        try {
            const positions = connection.terminalState ? connection.terminalState.positions : [];
            if (!positions || positions.length === 0) return;

            for (const pos of positions) {
                if (pos.magic !== MAGIC_NUMBER) continue;

                const openPrice = pos.openPrice;
                const currentPrice = pos.currentPrice;
                const sl = pos.stopLoss;

                // Extract risk distance from comment: "Ladder5M Risk:1.25"
                let riskDist = 0;
                if (pos.comment && pos.comment.includes('Risk:')) {
                    const match = pos.comment.match(/Risk:([0-9.]+)/);
                    if (match && match[1]) riskDist = parseFloat(match[1]);
                }
                if (riskDist <= 0 && sl > 0) {
                    riskDist = Math.abs(openPrice - sl);
                }
                if (riskDist <= 0) continue;

                let curR = 0;
                if (pos.type === 'POSITION_TYPE_BUY') {
                    curR = (currentPrice - openPrice) / riskDist;
                } else if (pos.type === 'POSITION_TYPE_SELL') {
                    curR = (openPrice - currentPrice) / riskDist;
                }

                const lockedR = getLadderLockedR(curR);
                if (lockedR >= 0.0) {
                    let targetSL = 0;
                    if (pos.type === 'POSITION_TYPE_BUY') {
                        targetSL = openPrice + (lockedR * riskDist);
                        if (targetSL > sl + 0.05) {
                            console.log(`[Ladder Trail] Moving BUY SL on ${pos.symbol} to Lock +${lockedR}R (New SL: ${targetSL.toFixed(2)})`);
                            await connection.modifyPosition(pos.id, targetSL, pos.takeProfit);
                            const liveAcc = connection.terminalState ? connection.terminalState.accountInformation : null;
                            this.sendSyncPayload({
                                login: liveAcc ? String(liveAcc.login) : '161787744',
                                server: liveAcc ? liveAcc.server : 'Exness-MT5Real21',
                                event: 'TRAILING',
                                activeTrade: {
                                    symbol: pos.symbol,
                                    type: 'BUY',
                                    lots: pos.volume,
                                    entry: openPrice.toFixed(2),
                                    target: 'Stepped Ladder',
                                    trailing: `+${lockedR.toFixed(1)}R Locked`,
                                    pnl: `${pos.unrealizedProfit >= 0 ? '+' : ''}$${(pos.unrealizedProfit || 0).toFixed(2)}`
                                }
                            });
                        }
                    } else if (pos.type === 'POSITION_TYPE_SELL') {
                        targetSL = openPrice - (lockedR * riskDist);
                        if (targetSL < sl - 0.05 || sl === 0) {
                            console.log(`[Ladder Trail] Moving SELL SL on ${pos.symbol} to Lock +${lockedR}R (New SL: ${targetSL.toFixed(2)})`);
                            await connection.modifyPosition(pos.id, targetSL, pos.takeProfit);
                            const liveAcc = connection.terminalState ? connection.terminalState.accountInformation : null;
                            this.sendSyncPayload({
                                login: liveAcc ? String(liveAcc.login) : '161787744',
                                server: liveAcc ? liveAcc.server : 'Exness-MT5Real21',
                                event: 'TRAILING',
                                activeTrade: {
                                    symbol: pos.symbol,
                                    type: 'SELL',
                                    lots: pos.volume,
                                    entry: openPrice.toFixed(2),
                                    target: 'Stepped Ladder',
                                    trailing: `+${lockedR.toFixed(1)}R Locked`,
                                    pnl: `${pos.unrealizedProfit >= 0 ? '+' : ''}$${(pos.unrealizedProfit || 0).toFixed(2)}`
                                }
                            });
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Manage positions error:', e.message);
        }
    }
}

module.exports = LitmusCloudEngine;

if (require.main === module) {
    let engine = null;

    // Lightweight HTTP health check & control listener for Render / Cloud deployment
    const http = require('http');
    const port = process.env.PORT || 3000;
    http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            return res.end();
        }

        if (req.url === '/test-trade' && req.method === 'POST') {
            try {
                if (!engine || !engine.attachedAccounts || engine.attachedAccounts.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, error: 'No attached broker accounts found in engine' }));
                }

                const attached = engine.attachedAccounts[0];
                const acc = await engine.metaApi.metatraderAccountApi.getAccount(attached.id);
                let connection = (engine.connections && engine.connections.get(attached.id)) || acc.getStreamingConnection();
                if (!connection.synchronized) {
                    try {
                        await connection.connect();
                        await connection.waitSynchronized();
                    } catch (e) {}
                }

                const sym = 'XAUUSDc';
                const terminalState = connection.terminalState;
                const price = terminalState ? terminalState.price(sym) : null;
                const entryPrice = (price && price.ask) ? price.ask : (engine.lastPrices[sym] ? engine.lastPrices[sym].ask : 3902.0);
                const slDist = 1.50; // $1.50 risk distance for 1% test trade
                const slPrice = Number((entryPrice - slDist).toFixed(3));

                const lots = engine.calculateLotSize(connection, sym, entryPrice, slPrice, 1.0);
                addEngineLog(`[TEST TRADE TRIGGERED] Placing 1% BUY on ${sym} | Lots: ${lots} | Entry: ${entryPrice} | SL: ${slPrice} | Risk Dist: ${slDist}`);

                const result = await connection.createMarketBuyOrder(sym, lots, slPrice, 0, {
                    comment: `Ladder5M Risk:${slDist.toFixed(2)}`,
                    magic: MAGIC_NUMBER
                });

                addEngineLog(`[TEST TRADE SUCCESS] Order ID: ${result ? result.orderId : 'Accepted'} on ${sym}`);

                engine.sendSyncPayload({
                    login: String(attached.login),
                    server: attached.server,
                    event: 'OPEN',
                    activeTrade: {
                        symbol: sym,
                        type: 'BUY',
                        lots: lots,
                        entry: entryPrice.toFixed(2),
                        target: 'Stepped Ladder',
                        trailing: 'Initial SL',
                        pnl: '+$0.00'
                    }
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    success: true,
                    orderId: result ? result.orderId : 'Accepted',
                    symbol: sym,
                    lots: lots,
                    entry: entryPrice.toFixed(2),
                    sl: slPrice.toFixed(2),
                    message: `1.0% Test Trade placed successfully on Exness!`
                }));
            } catch (tradeErr) {
                addEngineLog(`[TEST TRADE ERROR] ${tradeErr.message}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: tradeErr.message }));
            }
        }

        if (req.url === '/candles') {
            try {
                if (engine && engine.metaApi) {
                    const accId = (engine.attachedAccounts[0] && engine.attachedAccounts[0].id) || '577b0f29-4dc8-45d9-8b47-3472811e1fc7';
                    const acc = await engine.metaApi.metatraderAccountApi.getAccount(accId);
                    const c5 = await acc.getHistoricalCandles('XAUUSDc', '5m', undefined, 120);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify(c5));
                }
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: err.message }));
            }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'online',
            service: 'LitmusTrend Cloud Engine',
            strategy: 'Dual-Engine: The Big Boys (4H/15M/5M) & New Strategy (D1/15M/5M)',
            symbols: SYMBOLS,
            magicNumber: MAGIC_NUMBER,
            riskPercent: RISK_PERCENT,
            attachedAccounts: engine ? engine.attachedAccounts : [],
            activeEnginesCount: engine ? engine.attachedAccounts.length : 0,
            uptime: process.uptime(),
            zones: engine ? engine.zones : {},
            dailyClose: engine ? engine.dailyClose : {},
            h4Close: engine ? engine.h4Close : {},
            swingHigh: engine ? engine.swingHigh : {},
            swingLow: engine ? engine.swingLow : {},
            liveQuotes: engine ? engine.lastPrices : {},
            logs: engineLogs
        }, null, 2));
    }).listen(port, () => {
        addEngineLog(`Health server listening on port ${port}`);
    });

    const activeAccountId = process.env.METAAPI_ACCOUNT_ID || null;
    if (!METAAPI_TOKEN) {
        addEngineLog('[Notice] Set METAAPI_TOKEN in environment to start live cloud trading.');
    } else {
        engine = new LitmusCloudEngine(METAAPI_TOKEN, activeAccountId);
        engine.start();
    }
}
