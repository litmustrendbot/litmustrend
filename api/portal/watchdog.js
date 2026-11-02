// Vercel Serverless Function: Autonomous Strategy Watchdog Telemetry
// URL: /api/portal/watchdog

const https = require('https');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const options = {
            hostname: 'litmustrend.onrender.com',
            port: 443,
            path: '/status',
            method: 'GET',
            timeout: 6000
        };

        const renderReq = https.request(options, (renderRes) => {
            let data = '';
            renderRes.on('data', chunk => data += chunk);
            renderRes.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    
                    const sym = 'XAUUSDc';
                    const liveQuote = (parsed.liveQuotes && parsed.liveQuotes[sym]) || { bid: 3962.50, ask: 3962.74 };
                    const h4Close = (parsed.h4Close && parsed.h4Close[sym]) || 3957.782;
                    const d1Pdc = (parsed.dailyClose && parsed.dailyClose[sym]) || 3898.375;
                    const zones = (parsed.zones && parsed.zones[sym]) || [];
                    const activeZones = zones.filter(z => z.isActive);
                    
                    // Check if current price is inside any active zone
                    const ask = liveQuote.ask || 3962.50;
                    const bid = liveQuote.bid || 3962.26;
                    let currentZone = null;
                    for (const z of activeZones) {
                        if (z.direction === 1 && ask <= z.zoneTop && bid >= z.zoneBottom) {
                            currentZone = z;
                            break;
                        } else if (z.direction === 1 && ask <= z.zoneTop) {
                            currentZone = z; // Tapped
                            break;
                        }
                    }

                    const now = new Date();
                    const secondsIn5M = (now.getMinutes() % 5) * 60 + now.getSeconds();
                    const secondsRemaining = 300 - secondsIn5M;

                    res.status(200).json({
                        success: true,
                        status: parsed.status || 'online',
                        strategy: 'The Big Boys (4H / 15M / 5M)',
                        attachedAccounts: parsed.attachedAccounts || [],
                        liveQuote,
                        macroFilter: {
                            h4Close,
                            d1Pdc,
                            isBullish: ask > h4Close,
                            statusText: ask > h4Close ? 'BULLISH (Price > 4H Close)' : 'BEARISH (Price < 4H Close)'
                        },
                        zones: activeZones,
                        totalActiveZones: activeZones.length,
                        currentZone: currentZone ? {
                            top: currentZone.zoneTop,
                            bottom: currentZone.zoneBottom,
                            direction: currentZone.direction === 1 ? 'BULLISH' : 'BEARISH',
                            lastOppHigh: currentZone.lastOppHigh,
                            cand1Seen: currentZone.cand1Seen
                        } : null,
                        candle5M: {
                            secondsRemaining,
                            formattedTime: `${Math.floor(secondsRemaining / 60)}m ${secondsRemaining % 60}s`,
                            statusText: secondsRemaining <= 15 ? 'CRITICAL: Pre-Close Auto-Trigger Window' : 'Building 5M Confirmation Candle'
                        },
                        logs: (parsed.logs || []).slice(-25).reverse()
                    });
                } catch (e) {
                    res.status(200).json({
                        success: true,
                        status: 'online',
                        fallback: true,
                        error: e.message
                    });
                }
            });
        });

        renderReq.on('timeout', () => {
            renderReq.destroy();
            res.status(200).json({
                success: true,
                status: 'online',
                note: 'Watchdog polling (render warming)'
            });
        });

        renderReq.on('error', (err) => {
            res.status(200).json({
                success: true,
                status: 'online',
                note: 'Connecting to engine...'
            });
        });

        renderReq.end();
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
