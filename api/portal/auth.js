// Vercel Serverless Function: Secure Backend Passcode Verification
// URL: /api/portal/auth

const crypto = require('crypto');

// One-way cryptographic hash of the authorized passcode (never plain text)
const AUTHORIZED_HASH = 'd52595aa3e78a76ecef102cb89b2faeb23e606b2ceb2ee3625a06e4b742977c6';

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

        if (!passcode) {
            return res.status(400).json({ success: false, error: 'Passcode required' });
        }

        const inputStr = String(passcode).trim();
        const inputHash = crypto.createHash('sha256').update(inputStr).digest('hex');

        // Check against environment variable if set, or against one-way hash
        let isValid = false;
        if (process.env.PORTAL_PASSCODE) {
            isValid = (inputStr === process.env.PORTAL_PASSCODE.trim());
        } else {
            isValid = (inputHash === AUTHORIZED_HASH);
        }

        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Access denied: Invalid passcode' });
        }

        // Generate cryptographic session token
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
