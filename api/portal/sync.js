// URL: /api/portal/sync
// Live synchronization endpoint connecting MT5 VPS Expert Advisor directly to Web Dashboard

let liveAccounts = {};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const { login, server, balance, equity, activeTrade, closedTrade, event } = body || {};

            if (!login) {
                return res.status(400).json({ success: false, error: 'Login ID required' });
            }

            const key = String(login).trim();
            if (!liveAccounts[key]) {
                liveAccounts[key] = {
                    login: key,
                    server: server || '',
                    balance: balance || 0,
                    equity: equity || 0,
                    activeTrade: null,
                    trades: [],
                    lastSync: Date.now()
                };
            }

            const acc = liveAccounts[key];
            if (balance !== undefined) acc.balance = balance;
            if (equity !== undefined) acc.equity = equity;
            if (server) acc.server = server;
            acc.lastSync = Date.now();

            if (event === 'OPEN') {
                acc.activeTrade = activeTrade;
            } else if (event === 'TRAILING') {
                if (acc.activeTrade && activeTrade) {
                    acc.activeTrade.trailing = activeTrade.trailing;
                    acc.activeTrade.sl = activeTrade.sl;
                    acc.activeTrade.pnl = activeTrade.pnl;
                } else if (activeTrade) {
                    acc.activeTrade = activeTrade;
                }
            } else if (event === 'CLOSE') {
                acc.activeTrade = null;
                if (closedTrade) {
                    acc.trades.unshift(closedTrade);
                    if (acc.trades.length > 50) acc.trades.pop();
                }
            } else if (event === 'HEARTBEAT') {
                if (activeTrade !== undefined) acc.activeTrade = activeTrade;
            }

            return res.status(200).json({ success: true, updated: key, timestamp: Date.now() });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    if (req.method === 'GET') {
        const login = req.query.login || req.query.account;
        if (!login) {
            return res.status(200).json({ success: true, accounts: liveAccounts });
        }
        const key = String(login).trim();
        let data = liveAccounts[key] || null;

        if (!data || !data.equity) {
            try {
                const token = process.env.METAAPI_TOKEN || "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiIxYzBlNDdiYTcxNTc1YjQ4N2M1ZGJjNzhjODU5NDFkNiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtZXRhc3RhdHMtYXBpIiwibWV0aG9kcyI6WyJtZXRhc3RhdHMtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6InJpc2stbWFuYWdlbWVudC1hcGkiLCJtZXRob2RzIjpbInJpc2stbWFuYWdlbWVudC1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoiY29weWZhY3RvcnktYXBpIiwibWV0aG9kcyI6WyJjb3B5ZmFjdG9yeS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoibXQtbWFuYWdlci1hcGkiLCJtZXRob2RzIjpbIm10LW1hbmFnZXItYXBpOnJlc3Q6ZGVhbGluZzoqOioiLCJtdC1tYW5hZ2VyLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJiaWxsaW5nLWFwaSIsIm1ldGhvZHMiOlsiYmlsbGluZy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfV0sImlnbm9yZVJhdGVMaW1pdHMiOmZhbHNlLCJ0b2tlbklkIjoiMjAyMTAyMTMiLCJpbXBlcnNvbmF0ZWQiOmZhbHNlLCJyZWFsVXNlcklkIjoiMWMwZTQ3YmE3MTU3NWI0ODdjNWRiYzc4Yzg1OTQxZDYiLCJpYXQiOjE3OTM0MDQ4NzQsImV4cCI6MTgwMTE4MDg3NH0.mf7qTzcLGLbMYvaYd5xZxAKbU6hEKsoDE98xgcP4SZMYSCfXbQYnz9bHgcmtIBG3smG5xq04hMUteJTvQMV6eGrR6hPw5NtH7sB5ZzFQDuEDKE4y4NzUXiePOOZgHTxjtc570IgQJTF3TXN943mqehQHK2gRghUD1IVg40wFZMe3z_K7mN9mgUXe2zo_YSJyYKh1B5xAa_MSq2jiVmD6ZZJR5_dhB85oEC44G4UC9uyAoZggW7bUsiPla_pTfagSkG03TdOxKcwT7nCN1nGTj7CfnAQgITHaYQ_IYK6sjbfuadNNLc4QPxRKfw9F0Gw__LfaUEx2QiFlkko2P-FQ27siLSgxlr4CGZm7NurZ6o0n14fw4pO2EQesOc_6APD1C5tY5JP8QjqXU5lWRsujI3LnVgc2QpHJHpaZm-86N07kHpFUuBFqnwD97A0bTaNvtmoyklfpzcFDAx5b9ioIbnm3bkL9KOgUl1w4yh9uKfZzzf0LTtKH7qMbeKNCv-OKbPpxD3yutg896E_a_deepShGBKrm4fWJNRPBqjtL-uCTDMSE8allJG_9eOdFUZyLAp3v__h_qnQgNHg0NDkVow0r2-wyq_-W3rR1B_y7bscql-zCK57TFL1xbMLM1lBc7_f1uMIRWG2wR7MxeIq7D8vKqCgmb9wAptLered_YBo";
                const metaRes = await fetch("https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/3b5afbf5-6e0f-43c5-9865-778b26e34d64/account-information", {
                    headers: { "auth-token": token }
                });
                if (metaRes.ok) {
                    const info = await metaRes.json();
                    if (!liveAccounts[key]) {
                        liveAccounts[key] = {
                            login: key,
                            server: info.server || 'Exness-MT5Trial10',
                            balance: info.balance,
                            equity: info.equity,
                            activeTrade: null,
                            trades: [],
                            lastSync: Date.now()
                        };
                    } else {
                        liveAccounts[key].balance = info.balance;
                        liveAccounts[key].equity = info.equity;
                    }
                    data = liveAccounts[key];
                }
            } catch (err) {}
        }

        return res.status(200).json({ success: true, data });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
};
