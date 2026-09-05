// Vercel Serverless Function: Auto-Trading Portal Account Provisioner
// URL: /api/portal/connect

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { email, server, account, password, risk_tier } = body || {};

        if (!email || !server || !account || !password) {
            return res.status(400).json({ error: 'Missing required credentials' });
        }

        console.log(`[CLOUD BOT REGISTERED] Account: ${account} | Server: ${server} | Risk: ${risk_tier || '10%'}`);

        // In production, you can persist credentials directly to Supabase table trading_accounts
        // const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        // await supabase.from('trading_accounts').upsert([{ user_email: email, broker_server: server, account_number: account, risk_tier: risk_tier || '10%', status: 'ACTIVE' }]);

        return res.status(200).json({
            success: true,
            message: `Account ${account} registered to ${risk_tier || '10%'} Risk Cloud Engine`,
            account: account,
            server: server,
            risk_tier: risk_tier || '10%',
            balance: '100.00',
            status: 'ACTIVE'
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
