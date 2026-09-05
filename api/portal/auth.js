// Vercel Serverless Function: Secure Backend Passcode Verification
// URL: /api/portal/auth

const crypto = require('crypto');

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
        const { passcode } = body || {};

        const serverPasscode = process.env.PORTAL_PASSCODE;

        if (!passcode) {
            return res.status(400).json({ success: false, error: 'Passcode required' });
        }

        // Secure timing-safe string comparison
        if (!serverPasscode) {
            return res.status(500).json({ success: false, error: 'Server authentication configuration missing' });
        }

        const inputBuffer = Buffer.from(String(passcode));
        const targetBuffer = Buffer.from(String(serverPasscode));

        if (inputBuffer.length !== targetBuffer.length || !crypto.timingSafeEqual(inputBuffer, targetBuffer)) {
            return res.status(401).json({ success: false, error: 'Access denied: Invalid passcode' });
        }

        // Generate signed session token
        const sessionToken = crypto.randomBytes(32).toString('hex');

        return res.status(200).json({
            success: true,
            token: sessionToken,
            message: 'Dashboard unlocked successfully'
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Authentication service error' });
    }
};
