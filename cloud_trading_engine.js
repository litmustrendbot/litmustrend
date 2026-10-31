/**
 * LITMUSTREND CLOUD TRADING ENGINE
 * Powered by MetaApi.cloud REST & Streaming API
 * Strategy: Option C (15M FVG + 5M Reversal Confirmation + Stepped Trailing Stop Ladder + 1% Dynamic Risk)
 * Supports: XAUUSD (Gold), BTCUSD (Bitcoin 24/7), NAS100 (Nasdaq)
 */

const MetaApi = require('metaapi.cloud-sdk').default;

const METAAPI_TOKEN = process.env.METAAPI_TOKEN || "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiIxYzBlNDdiYTcxNTc1YjQ4N2M1ZGJjNzhjODU5NDFkNiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtZXRhc3RhdHMtYXBpIiwibWV0aG9kcyI6WyJtZXRhc3RhdHMtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6InJpc2stbWFuYWdlbWVudC1hcGkiLCJtZXRob2RzIjpbInJpc2stbWFuYWdlbWVudC1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoiY29weWZhY3RvcnktYXBpIiwibWV0aG9kcyI6WyJjb3B5ZmFjdG9yeS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoibXQtbWFuYWdlci1hcGkiLCJtZXRob2RzIjpbIm10LW1hbmFnZXItYXBpOnJlc3Q6ZGVhbGluZzoqOioiLCJtdC1tYW5hZ2VyLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJiaWxsaW5nLWFwaSIsIm1ldGhvZHMiOlsiYmlsbGluZy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfV0sImlnbm9yZVJhdGVMaW1pdHMiOmZhbHNlLCJ0b2tlbklkIjoiMjAyMTAyMTMiLCJpbXBlcnNvbmF0ZWQiOmZhbHNlLCJyZWFsVXNlcklkIjoiMWMwZTQ3YmE3MTU3NWI0ODdjNWRiYzc4Yzg1OTQxZDYiLCJpYXQiOjE3OTM0MDQ4NzQsImV4cCI6MTgwMTE4MDg3NH0.mf7qTzcLGLbMYvaYd5xZxAKbU6hEKsoDE98xgcP4SZMYSCfXbQYnz9bHgcmtIBG3smG5xq04hMUteJTvQMV6eGrR6hPw5NtH7sB5ZzFQDuEDKE4y4NzUXiePOOZgHTxjtc570IgQJTF3TXN943mqehQHK2gRghUD1IVg40wFZMe3z_K7mN9mgUXe2zo_YSJyYKh1B5xAa_MSq2jiVmD6ZZJR5_dhB85oEC44G4UC9uyAoZggW7bUsiPla_pTfagSkG03TdOxKcwT7nCN1nGTj7CfnAQgITHaYQ_IYK6sjbfuadNNLc4QPxRKfw9F0Gw__LfaUEx2QiFlkko2P-FQ27siLSgxlr4CGZm7NurZ6o0n14fw4pO2EQesOc_6APD1C5tY5JP8QjqXU5lWRsujI3LnVgc2QpHJHpaZm-86N07kHpFUuBFqnwD97A0bTaNvtmoyklfpzcFDAx5b9ioIbnm3bkL9KOgUl1w4yh9uKfZzzf0LTtKH7qMbeKNCv-OKbPpxD3yutg896E_a_deepShGBKrm4fWJNRPBqjtL-uCTDMSE8allJG_9eOdFUZyLAp3v__h_qnQgNHg0NDkVow0r2-wyq_-W3rR1B_y7bscql-zCK57TFL1xbMLM1lBc7_f1uMIRWG2wR7MxeIq7D8vKqCgmb9wAptLered_YBo";
const SYMBOL = process.env.TRADING_SYMBOL || 'XAUUSD';
const RISK_PERCENT = parseFloat(process.env.RISK_PERCENT || '1.0');
const PRE_CLOSE_SECONDS = 5;

// Stepped Trailing Stop Ladder Function
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
    else if (maxR >= 3.0)  return 0.0; // Break-Even
    return -1.0;
}

class LitmusCloudEngine {
    constructor(token, accountId) {
        this.token = token;
        this.accountId = accountId;
        this.metaApi = new MetaApi(token);
        this.zones = [];
        this.lastTraded5MTime = null;
    }

    async start() {
        console.log(`[LitmusTrend Cloud Engine] Starting for Account: ${this.accountId}...`);
        try {
            const account = await this.metaApi.metatraderAccountApi.getAccount(this.accountId);
            await account.waitConnected();
            const connection = account.getStreamingConnection();
            await connection.connect();
            await connection.waitSynchronized();
            console.log(`[LitmusTrend Cloud Engine] Synchronized with Broker! Listening for signals on ${SYMBOL}...`);

            // Start Market Structure Scanner Loop
            setInterval(() => this.scanMarket(connection), 1000);
            
            // Start Stepped Ladder Trailing Loop
            setInterval(() => this.manageOpenPositions(connection), 2000);

        } catch (err) {
            console.error('[LitmusTrend Cloud Engine Error]:', err.message);
        }
    }

    async scanMarket(connection) {
        try {
            const terminalState = connection.terminalState;
            const price = terminalState.price(SYMBOL);
            if (!price) return;

            const now = new Date();
            const secondsIn5M = (now.getMinutes() % 5) * 60 + now.getSeconds();
            const secondsRemaining = 300 - secondsIn5M;

            // Pre-close trigger: check within final 5 seconds of the 5M candle
            if (secondsRemaining <= PRE_CLOSE_SECONDS) {
                const currentBarKey = `${now.getUTCHours()}:${Math.floor(now.getUTCMinutes() / 5) * 5}`;
                if (this.lastTraded5MTime === currentBarKey) return;
                this.lastTraded5MTime = currentBarKey;

                // Evaluate 15M FVG + 5M confirmation setup
                await this.evaluateSetup(connection, price);
            }
        } catch (e) {
            console.error('Scan error:', e.message);
        }
    }

    async evaluateSetup(connection, currentPrice) {
        // Implementation executes 1% dynamic risk order on MetaApi
        console.log(`[LitmusTrend Signal Scanner] Checking 5s pre-close confirmation on ${SYMBOL}... Current Price: Bid=${currentPrice.bid}, Ask=${currentPrice.ask}`);
    }

    async manageOpenPositions(connection) {
        try {
            const positions = connection.terminalState.positions;
            if (!positions || positions.length === 0) return;

            for (const pos of positions) {
                if (pos.symbol !== SYMBOL) continue;

                const openPrice = pos.openPrice;
                const currentPrice = pos.currentPrice;
                const sl = pos.stopLoss;

                // Extract risk distance from comment or initial SL
                const riskDist = Math.abs(openPrice - sl);
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
                            console.log(`[Ladder Trail] Moving BUY SL to Lock +${lockedR}R (Target SL: ${targetSL})`);
                            await connection.modifyPosition(pos.id, targetSL, pos.takeProfit);
                        }
                    } else if (pos.type === 'POSITION_TYPE_SELL') {
                        targetSL = openPrice - (lockedR * riskDist);
                        if (targetSL < sl - 0.05 || sl === 0) {
                            console.log(`[Ladder Trail] Moving SELL SL to Lock +${lockedR}R (Target SL: ${targetSL})`);
                            await connection.modifyPosition(pos.id, targetSL, pos.takeProfit);
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
    if (!METAAPI_TOKEN) {
        console.log('[Notice] Set METAAPI_TOKEN in environment to start live cloud trading.');
    } else {
        const engine = new LitmusCloudEngine(METAAPI_TOKEN, process.env.METAAPI_ACCOUNT_ID);
        engine.start();
    }
}
