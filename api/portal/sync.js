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
        const data = liveAccounts[String(login).trim()] || null;
        return res.status(200).json({ success: true, data });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
};
