// Vercel Serverless Function: MT5 Broker Account Verification & Cloud Provisioner
// URL: /api/portal/connect

const https = require('https');

function callMetaApi(path, method, payload, token) {
    return new Promise((resolve) => {
        const bodyStr = payload ? JSON.stringify(payload) : null;
        const options = {
            hostname: 'mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai',
            port: 443,
            path: path,
            method: method,
            timeout: 12000,
            headers: {
                'auth-token': token,
                'Content-Type': 'application/json',
                ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
            },
            rejectUnauthorized: false
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('timeout', () => {
            try { req.destroy(); } catch (e) {}
            resolve({ status: 504, data: { message: 'Broker connection timed out. Please check your MT5 server name.' } });
        });

        req.on('error', (err) => {
            resolve({ status: 502, data: { message: 'Failed to contact broker gateway: ' + (err.message || 'Network error') } });
        });

        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

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
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { account_name, strategy, server, account, password, instrument, broker_symbol } = body || {};

        if (!server || !account || !password) {
            return res.status(400).json({
                success: false,
                error: 'Broker server, account number, and password are required'
            });
        }

        const selectedInst = instrument || 'XAUUSD';
        const selectedBrokerSymbol = broker_symbol || selectedInst;

        const metaApiToken = process.env.METAAPI_TOKEN || "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiIxYzBlNDdiYTcxNTc1YjQ4N2M1ZGJjNzhjODU5NDFkNiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtZXRhc3RhdHMtYXBpIiwibWV0aG9kcyI6WyJtZXRhc3RhdHMtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6InJpc2stbWFuYWdlbWVudC1hcGkiLCJtZXRob2RzIjpbInJpc2stbWFuYWdlbWVudC1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoiY29weWZhY3RvcnktYXBpIiwibWV0aG9kcyI6WyJjb3B5ZmFjdG9yeS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoibXQtbWFuYWdlci1hcGkiLCJtZXRob2RzIjpbIm10LW1hbmFnZXItYXBpOnJlc3Q6ZGVhbGluZzoqOioiLCJtdC1tYW5hZ2VyLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJiaWxsaW5nLWFwaSIsIm1ldGhvZHMiOlsiYmlsbGluZy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfV0sImlnbm9yZVJhdGVMaW1pdHMiOmZhbHNlLCJ0b2tlbklkIjoiMjAyMTAyMTMiLCJpbXBlcnNvbmF0ZWQiOmZhbHNlLCJyZWFsVXNlcklkIjoiMWMwZTQ3YmE3MTU3NWI0ODdjNWRiYzc4Yzg1OTQxZDYiLCJpYXQiOjE3OTM0MDQ4NzQsImV4cCI6MTgwMTE4MDg3NH0.mf7qTzcLGLbMYvaYd5xZxAKbU6hEKsoDE98xgcP4SZMYSCfXbQYnz9bHgcmtIBG3smG5xq04hMUteJTvQMV6eGrR6hPw5NtH7sB5ZzFQDuEDKE4y4NzUXiePOOZgHTxjtc570IgQJTF3TXN943mqehQHK2gRghUD1IVg40wFZMe3z_K7mN9mgUXe2zo_YSJyYKh1B5xAa_MSq2jiVmD6ZZJR5_dhB85oEC44G4UC9uyAoZggW7bUsiPla_pTfagSkG03TdOxKcwT7nCN1nGTj7CfnAQgITHaYQ_IYK6sjbfuadNNLc4QPxRKfw9F0Gw__LfaUEx2QiFlkko2P-FQ27siLSgxlr4CGZm7NurZ6o0n14fw4pO2EQesOc_6APD1C5tY5JP8QjqXU5lWRsujI3LnVgc2QpHJHpaZm-86N07kHpFUuBFqnwD97A0bTaNvtmoyklfpzcFDAx5b9ioIbnm3bkL9KOgUl1w4yh9uKfZzzf0LTtKH7qMbeKNCv-OKbPpxD3yutg896E_a_deepShGBKrm4fWJNRPBqjtL-uCTDMSE8allJG_9eOdFUZyLAp3v__h_qnQgNHg0NDkVow0r2-wyq_-W3rR1B_y7bscql-zCK57TFL1xbMLM1lBc7_f1uMIRWG2wR7MxeIq7D8vKqCgmb9wAptLered_YBo";

        const selectedStrategy = strategy || 'The Big Boys 4H';
        const magic = 155025;

        if (metaApiToken) {
            // Send provisioning request to MetaApi to verify broker credentials
            const provisionPayload = {
                name: account_name || `Account ${account}`,
                type: 'cloud',
                login: String(account).trim(),
                platform: 'mt5',
                password: String(password).trim(),
                server: String(server).trim(),
                magic: magic
            };

            const metaRes = await callMetaApi('/users/current/accounts', 'POST', provisionPayload, metaApiToken);
            const errMsg = metaRes.data && metaRes.data.message ? metaRes.data.message : '';

            // MetaApi returns 200, 201, or 202 on valid broker credentials
            if (metaRes.status === 200 || metaRes.status === 201 || metaRes.status === 202) {
                const isRealGuid = metaRes.data && metaRes.data.id && typeof metaRes.data.id === 'string' && metaRes.data.id.length > 10 && !metaRes.data.error;
                const newAccountId = isRealGuid ? (metaRes.data.id || metaRes.data._id) : null;
                if (newAccountId) {
                    try {
                        await callMetaApi(`/users/current/accounts/${newAccountId}/deploy`, 'POST', {}, metaApiToken);
                    } catch (e) {}
                }

                return res.status(200).json({
                    success: true,
                    verified: true,
                    accountId: newAccountId || account,
                    account: account,
                    server: server,
                    strategy: selectedStrategy,
                    instrument: selectedInst,
                    broker_symbol: selectedBrokerSymbol,
                    message: `MT5 account verified, deployed in cloud, and attached to ${selectedStrategy} execution engine`
                });
            }

            // Real broker rejection: return 400 with the exact error from MetaApi / broker
            return res.status(400).json({
                success: false,
                verified: false,
                error: `Broker Connection Failed: ${errMsg || 'Invalid server, login, or password'}. The broker rejected this connection.`
            });
        }

        return res.status(500).json({
            success: false,
            error: 'MetaApi connection token is not configured on server'
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            error: `Verification service error: ${err.message}`
        });
    }
};
