// Vercel Serverless Function: Proxy 1.0% Test Trade to Render Cloud Engine
// URL: /api/portal/test-trade

const https = require('https');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    try {
        const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
        
        const options = {
            hostname: 'litmustrend.onrender.com',
            port: 443,
            path: '/test-trade',
            method: 'POST',
            timeout: 25000,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr)
            }
        };

        const proxyReq = https.request(options, (proxyRes) => {
            let data = '';
            proxyRes.on('data', chunk => data += chunk);
            proxyRes.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    res.status(proxyRes.statusCode).json(parsed);
                } catch (e) {
                    res.status(proxyRes.statusCode).send(data);
                }
            });
        });

        proxyReq.on('timeout', () => {
            proxyReq.destroy();
            res.status(504).json({ success: false, error: 'Render engine timed out' });
        });

        proxyReq.on('error', (err) => {
            res.status(502).json({ success: false, error: 'Failed to contact Render engine: ' + err.message });
        });

        proxyReq.write(bodyStr);
        proxyReq.end();
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};
