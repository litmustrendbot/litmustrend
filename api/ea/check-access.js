// Vercel Serverless Function: MT5 License & Access Check API
// URL: /api/ea/check-access

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { account_number, secret_key } = body;

        const expectedKey = process.env.EA_SECRET_KEY || 'LITMUS_DEFAULT_SECRET_2026';

        if (!secret_key || secret_key !== expectedKey) {
            return res.status(200).json({
                authorized: false,
                reason: 'Invalid or missing API Secret Key'
            });
        }

        // Return authorized access response to MT5 EA
        return res.status(200).json({
            authorized: true,
            account_number: account_number || '000000',
            plan: 'Pro Automated Trader',
            expires: '2026-12-31T23:59:59Z',
            message: 'Access granted'
        });
    } catch (err) {
        return res.status(500).json({ authorized: false, error: err.message });
    }
};
