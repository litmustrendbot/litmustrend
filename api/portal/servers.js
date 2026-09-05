// Vercel Serverless Function: Real-Time MT5 Live Broker & Server Search
// Queries MetaQuotes MT5 global registry via MetaApi Cloud Gateway
// URL: /api/portal/servers?query=brokerName

const https = require('https');
const fs = require('fs');
const path = require('path');

const searchCache = new Map();

function getMetaApiToken() {
    if (process.env.METAAPI_TOKEN) {
        return process.env.METAAPI_TOKEN;
    }
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const fileData = fs.readFileSync(envPath, 'utf8');
            const match = fileData.match(/METAAPI_TOKEN=([^\r\n]+)/);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
    } catch (e) {}
    return null;
}

function fetchMetaApiServers(query, token) {
    return new Promise((resolve) => {
        const encodedQuery = encodeURIComponent(query);
        const options = {
            hostname: 'mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai',
            port: 443,
            path: '/known-mt-servers/5/search?query=' + encodedQuery,
            method: 'GET',
            headers: {
                'auth-token': token,
                'Accept': 'application/json'
            },
            rejectUnauthorized: false,
            timeout: 8000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: {} });
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ status: 504, data: {} });
        });

        req.on('error', (err) => {
            resolve({ status: 500, error: err.message, data: {} });
        });

        req.end();
    });
}

// Strictly live servers: filter out all demo, trial, contest, practice
function isLiveServer(srvName) {
    if (!srvName || typeof srvName !== 'string') return false;
    const lower = srvName.toLowerCase();
    const demoKeywords = ['demo', 'trial', 'practice', 'contest'];
    return !demoKeywords.some(kw => lower.includes(kw));
}

// Built-in verified live servers fallback if network fails
const VERIFIED_LIVE_FALLBACK = [
    {
        name: 'FundedNext Ltd',
        servers: ['FundedNext-Server', 'FundedNext-Server 2', 'FundedNext-Server 3']
    },
    {
        name: 'Exness Technologies Ltd',
        servers: [
            'Exness-MT5Real', 'Exness-MT5Real2', 'Exness-MT5Real3', 'Exness-MT5Real4',
            'Exness-MT5Real5', 'Exness-MT5Real6', 'Exness-MT5Real7', 'Exness-MT5Real8',
            'Exness-MT5Real9', 'Exness-MT5Real10', 'Exness-MT5Real11', 'Exness-MT5Real12',
            'Exness-MT5Real14', 'Exness-MT5Real15', 'Exness-MT5Real16', 'Exness-MT5Real17'
        ]
    },
    {
        name: 'FTMO Global Markets Ltd',
        servers: ['FTMO-Server', 'FTMO-Server2', 'FTMO-Server3', 'FTMO-Server4', 'FTMO-Server5']
    },
    {
        name: 'IC Markets Ltd',
        servers: [
            'ICMarketsInternational-MT5', 'ICMarketsInternational-MT5-2', 'ICMarketsInternational-MT5-3',
            'ICMarketsInternational-MT5-4', 'ICMarketsSC-MT5', 'ICMarketsSC-MT5-2', 'ICMarketsSC-MT5-3',
            'ICMarketsSC-MT5-4', 'ICMarketsEU-MT5'
        ]
    },
    {
        name: 'Deriv.com Limited',
        servers: ['Deriv-Server', 'Deriv-Server-02', 'Deriv-Server-03']
    },
    {
        name: 'Pepperstone Markets',
        servers: ['Pepperstone-MT5-Live01', 'Pepperstone-MT5-Live02', 'Pepperstone-MT5-Live03']
    },
    {
        name: 'Funding Pips Ltd',
        servers: ['FundingPips-Server', 'FundingPips-Server-2']
    },
    {
        name: 'Octa Markets Incorporated',
        servers: ['OctaFX-Real', 'OctaFX-Real2', 'OctaFX-Real3']
    },
    {
        name: 'XM Global',
        servers: [
            'XMGlobal-MT5', 'XMGlobal-MT5 2', 'XMGlobal-MT5 3', 'XMGlobal-MT5 4',
            'XMGlobal-MT5 5', 'XMGlobal-MT5 6', 'XMGlobal-MT5 7'
        ]
    }
];

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const query = (req.query && req.query.query ? req.query.query : '').trim();
    const cacheKey = query.toLowerCase();

    if (cacheKey && searchCache.has(cacheKey)) {
        return res.status(200).json(searchCache.get(cacheKey));
    }

    const token = getMetaApiToken();
    if (!token) {
        const filtered = VERIFIED_LIVE_FALLBACK.filter(b => 
            !query || b.name.toLowerCase().includes(query.toLowerCase()) || 
            b.servers.some(s => s.toLowerCase().includes(query.toLowerCase()))
        );
        return res.status(200).json({ success: true, source: 'fallback', brokers: filtered });
    }

    const targetQuery = query || 'FundedNext';

    try {
        const metaRes = await fetchMetaApiServers(targetQuery, token);

        if (metaRes.status === 200 && metaRes.data && typeof metaRes.data === 'object') {
            const brokers = [];

            for (const [companyName, serverList] of Object.entries(metaRes.data)) {
                if (Array.isArray(serverList)) {
                    // Strictly live servers only: remove all demo/trial
                    const liveServers = serverList.filter(isLiveServer);
                    if (liveServers.length > 0) {
                        brokers.push({
                            name: companyName,
                            servers: liveServers
                        });
                    }
                }
            }

            brokers.sort((a, b) => {
                const aNameMatch = a.name.toLowerCase().startsWith(query.toLowerCase());
                const bNameMatch = b.name.toLowerCase().startsWith(query.toLowerCase());
                if (aNameMatch && !bNameMatch) return -1;
                if (!aNameMatch && bNameMatch) return 1;
                return a.name.localeCompare(b.name);
            });

            const result = { success: true, source: 'live_metaapi', brokers };
            if (query) {
                searchCache.set(cacheKey, result);
            }
            return res.status(200).json(result);
        } else {
            const filtered = VERIFIED_LIVE_FALLBACK.filter(b => 
                !query || b.name.toLowerCase().includes(query.toLowerCase()) || 
                b.servers.some(s => s.toLowerCase().includes(query.toLowerCase()))
            );
            return res.status(200).json({ success: true, source: 'fallback', brokers: filtered });
        }
    } catch (err) {
        const filtered = VERIFIED_LIVE_FALLBACK.filter(b => 
            !query || b.name.toLowerCase().includes(query.toLowerCase()) || 
            b.servers.some(s => s.toLowerCase().includes(query.toLowerCase()))
        );
        return res.status(200).json({ success: true, source: 'fallback_error', brokers: filtered });
    }
};
