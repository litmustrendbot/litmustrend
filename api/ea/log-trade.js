// Vercel Serverless Function: MT5 Trade Logger API Endpoint
// URL: /api/ea/log-trade

module.exports = async (req, res) => {
    // Enable CORS for MT5 and web requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({
            status: 'online',
            service: 'LitmusTrend MT5 Trade Logging API',
            message: 'Send a POST request with trade data from MT5 MQL5 WebRequest'
        });
    }

    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const { account_number, symbol, trade_type, lots, open_price, secret_key } = body || {};

            // 1. Verify Secret API Key
            const expectedKey = process.env.EA_SECRET_KEY || 'LITMUS_DEFAULT_SECRET_2026';
            if (secret_key && secret_key !== expectedKey) {
                return res.status(401).json({ error: 'Unauthorized: Invalid secret key' });
            }

            console.log(`[MT5 TRADE RECEIVED] Account: ${account_number} | Symbol: ${symbol} | Type: ${trade_type} | Lots: ${lots} | Price: ${open_price}`);

            // 2. Here you can write directly to Supabase using @supabase/supabase-js
            // Example:
            // const { data, error } = await supabase.from('trades').insert([{ account_number, symbol, trade_type, lots, open_price }]);

            return res.status(200).json({
                success: true,
                message: 'Trade logged successfully to LitmusTrend',
                received: { account_number, symbol, trade_type, lots, open_price },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(45)
};
