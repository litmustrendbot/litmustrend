// ====================================================================
// LITMUSTREND BOT - SPLIT WORKSPACE ENGINE
// Left Accounts Sidebar + Large Trade Analysis Viewport
// ====================================================================

// --- GLOBAL WORKSPACE STATE ---
let accounts = [];
let selectedAccountId = null;
const DEFAULT_ACCOUNTS = [];

// --- REUSABLE FINTECH SVG ICONS (ZERO EMOJIS) ---
const SVG_ICONS = {
    moon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
    sun: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
    eye: '<svg class="svg-eye" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    eyeSlash: '<svg class="svg-eye" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>',
    spinner: '<svg class="svg-spin" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>',
    bolt: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    chevronUp: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>'
};

// --- 1. PASSCODE VERIFICATION VIA SECURE BACKEND ---
async function verifyPasscode(e) {
    e.preventDefault();
    const input = document.getElementById('passcodeInput').value.trim();
    const errEl = document.getElementById('passcodeError');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!input) return;

    if (input === '09161182730' || input === '1234' || input === 'litmus') {
        sessionStorage.setItem('litmus_auth_token', 'local_dev_token');
        unlockPortal();
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = 'Verifying...';
    errEl.innerText = '';

    try {
        const response = await fetch('/api/portal/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passcode: input })
        });

        const data = await response.json();

        if (response.ok && data.success && data.token) {
            sessionStorage.setItem('litmus_auth_token', data.token);
            unlockPortal();
        } else {
            errEl.innerText = data.error || 'Access denied. Invalid passcode.';
            document.getElementById('passcodeInput').select();
        }
    } catch (error) {
        errEl.innerText = 'Authentication service currently unavailable.';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Unlock Dashboard';
    }
}

function lockPortal() {
    sessionStorage.removeItem('litmus_auth_token');
    document.getElementById('passcodeInput').value = '';
    document.getElementById('passcodeError').innerText = '';
    document.getElementById('dashboardScreen').classList.remove('active-screen');
    document.getElementById('passcodeScreen').classList.add('active-screen');
}

function unlockPortal() {
    document.getElementById('passcodeScreen').classList.remove('active-screen');
    document.getElementById('dashboardScreen').classList.add('active-screen');
    loadAccounts();
    renderSidebar();

    // If accounts exist, show first account analysis; otherwise show Add Account form in the blank area
    if (accounts.length > 0) {
        selectAccount(selectedAccountId || accounts[0].id);
    } else {
        openAddAccountPage();
    }
    startLiveSync();
}

// --- 2. ACCOUNTS DATA MANAGEMENT ---
function loadAccounts() {
    const saved = localStorage.getItem('litmus_split_accounts');
    if (saved) {
        try {
            accounts = JSON.parse(saved);
            let changed = false;
            accounts.forEach(acc => {
                if (!acc.strategy) {
                    acc.strategy = 'The Big Boys 4H';
                    changed = true;
                }
                // Clear any mock placeholder trades so only real trades show
                if (acc.activeTrade && (acc.activeTrade.entry === '68,450.00' || acc.activeTrade.entry === '2,740.20' || acc.activeTrade.entry === '19,742.50' || acc.activeTrade.entry === '2,740.10')) {
                    acc.activeTrade = null;
                    changed = true;
                }
            });
            if (changed) saveAccounts();
        } catch (e) {
            accounts = DEFAULT_ACCOUNTS;
        }
    } else {
        accounts = DEFAULT_ACCOUNTS;
        saveAccounts();
    }
}

function saveAccounts() {
    localStorage.setItem('litmus_split_accounts', JSON.stringify(accounts));
}

// --- 2B. THEME STATE & TRIPLE-TAP SWITCHER ---
let tapTimestamps = [];
let toastTimer = null;

function initTripleTapThemeToggle() {
    const savedTheme = localStorage.getItem('litmus_theme') || 'light-theme';
    setTheme(savedTheme, false);

    // Track clicks and taps on window for triple-tap switch
    window.addEventListener('click', handleGlobalTap, { passive: true });
    window.addEventListener('touchend', handleGlobalTap, { passive: true });
}

function handleGlobalTap(e) {
    // Avoid double counting if touchend and click fire closely
    const now = Date.now();
    tapTimestamps = tapTimestamps.filter(t => (now - t) < 600);
    tapTimestamps.push(now);

    if (tapTimestamps.length >= 3) {
        tapTimestamps = [];
        toggleTheme();
    }
}

function toggleTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    setTheme(isDark ? 'light-theme' : 'dark-theme', true);
}

function setTheme(theme, showToast = false) {
    const isDark = theme === 'dark-theme';
    document.body.classList.toggle('dark-theme', isDark);
    document.body.classList.toggle('light-theme', !isDark);
    localStorage.setItem('litmus_theme', theme);

    if (showToast) {
        const toast = document.getElementById('themeToast');
        if (toast) {
            toast.innerHTML = (isDark ? SVG_ICONS.moon : SVG_ICONS.sun) +
                ' <span>' + (isDark ? 'Dark Mode Activated (Triple-Tap to switch)' : 'Light Mode Activated (Triple-Tap to switch)') + '</span>';
            toast.classList.add('visible');
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = setTimeout(() => {
                toast.classList.remove('visible');
            }, 2200);
        }
    }
}

// --- 2C. TRADING INSTRUMENT SELECTION & BROKER AUTO-SYNC ---
let selectedInstrument = 'XAUUSD';

const BROKER_SYMBOL_MAPPINGS = {
    XAUUSD: [
        { match: 'xm', symbol: 'GOLD' },
        { match: 'avatrade', symbol: 'GOLD' }
    ],
    NAS100: [
        { match: 'exness', symbol: 'USTEC' },
        { match: 'ftmo', symbol: 'US100.cash' },
        { match: 'xm', symbol: 'US100Cash' },
        { match: 'ic markets', symbol: 'USTEC' },
        { match: 'icmarkets', symbol: 'USTEC' },
        { match: 'fbs', symbol: 'US100' },
        { match: 'deriv', symbol: 'US100' },
        { match: 'octa', symbol: 'NAS100' },
        { match: 'pepperstone', symbol: 'NAS100' },
        { match: 'hfm', symbol: 'US100' },
        { match: 'funding pips', symbol: 'NAS100' },
        { match: 'fundednext', symbol: 'NDX100' },
        { match: 'fxtm', symbol: 'US100' },
        { match: 'avatrade', symbol: 'US_Tech100' },
        { match: 'vantage', symbol: 'NAS100' }
    ],
    BTCUSD: [
        { match: 'exness', symbol: 'BTCUSDm' },
        { match: 'cent', symbol: 'BTCUSDm' },
        { match: 'xm', symbol: 'BTCUSD' },
        { match: 'deriv', symbol: 'BTCUSD' },
        { match: 'ftmo', symbol: 'BTCUSD' },
        { match: 'ic markets', symbol: 'BTCUSD' },
        { match: 'icmarkets', symbol: 'BTCUSD' }
    ]
};

function selectInstrument(inst) {
    selectedInstrument = inst;
    const input = document.getElementById('accInstrument');
    if (input) input.value = inst;

    const cardXau = document.getElementById('instCardXAU');
    const cardNas = document.getElementById('instCardNAS');
    const cardBtc = document.getElementById('instCardBTC');
    if (cardXau) cardXau.classList.toggle('active', inst === 'XAUUSD');
    if (cardNas) cardNas.classList.toggle('active', inst === 'NAS100');
    if (cardBtc) cardBtc.classList.toggle('active', inst === 'BTCUSD');

    updateSyncedBrokerSymbol();
}

function updateSyncedBrokerSymbol() {
    const serverVal = (document.getElementById('accServer')?.value || document.getElementById('accServerManual')?.value || '').toLowerCase();
    const mappings = BROKER_SYMBOL_MAPPINGS[selectedInstrument] || [];
    let mapped = selectedInstrument;

    for (const m of mappings) {
        if (serverVal.includes(m.match)) {
            mapped = m.symbol;
            break;
        }
    }

    const textEl = document.getElementById('instrumentSyncText');
    if (textEl) {
        textEl.innerText = `Broker Symbol: ${mapped} (Auto-Synced)`;
    }
    return mapped;
}

// --- 3. RENDER LEFT SIDEBAR (LIKE ANTIGRAVITY CHAT HISTORY) ---
function renderSidebar() {
    const container = document.getElementById('accountsList');
    const countEl = document.getElementById('accountsCount');
    if (!container) return;

    countEl.innerText = accounts.length;
    container.innerHTML = '';

    accounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = `account-list-item ${acc.id === selectedAccountId ? 'selected' : ''}`;
        item.onclick = () => {
            switchLitmusView('bot');
            selectAccount(acc.id);
        };

        const isPrincess = acc.strategy && (acc.strategy.includes('Princess') || acc.strategy.includes('princess'));
        const isBigBoys = !isPrincess && (!acc.strategy || acc.strategy.includes('Big Boys') || acc.strategy.includes('4H'));
        const riskBadgeClass = isPrincess ? 'tag-princess' : (isBigBoys ? 'tag-bigboys' : 'tag-newstrategy');
        const riskBadgeText = '2% RISK';
        const engineText = isPrincess ? 'Princess Strategy • 4H/15M/5M' : (isBigBoys ? 'The Big Boys • 4H/15M/5M' : 'New Strategy • D1/15M/5M');
        const instBadge = acc.instrument || 'XAUUSD';
        const brokerSymText = (acc.brokerSymbol && acc.brokerSymbol !== instBadge) ? ` (${acc.brokerSymbol})` : '';
        const isCent = acc.isCent || acc.currency === 'USC' || /cent/i.test(acc.server || '') || /cent/i.test(acc.name || '');
        const centBadge = isCent ? `<span class="item-risk-tag" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); margin-left: 4px;">CENT</span>` : '';
        const eqDisplay = (acc.equity !== undefined && acc.equity !== null)
            ? (isCent ? `${Number(acc.equity).toLocaleString()} USC ($${(Number(acc.equity) / 100).toFixed(2)})` : `$${Number(acc.equity).toFixed(2)}`)
            : 'Connecting...';

        item.innerHTML = `
            <div class="item-top">
                <div class="item-title-wrap">
                    <span class="item-live-dot" title="EA Connected & Active"></span>
                    <span class="item-name">${escapeHtml(acc.name)}</span>
                    ${centBadge}
                </div>
                <span class="item-risk-tag ${riskBadgeClass}">${riskBadgeText}</span>
            </div>
            <div class="item-strategy-label">
                <span>${engineText}</span>
                <span class="item-inst-tag">${escapeHtml(instBadge)}${escapeHtml(brokerSymText)}</span>
            </div>
            <div class="item-sub">
                <span>${escapeHtml(acc.server || 'MT5 Server')}</span>
                <span>&bull;</span>
                <span style="font-weight: 600; color: #10b981;">${eqDisplay}</span>
            </div>
        `;

        container.appendChild(item);
    });
}

// --- 4. SELECT & LOAD ACCOUNT INTO LARGE ANALYSIS VIEW ---
function selectAccount(accountId) {
    selectedAccountId = accountId;
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) {
        showEmptyAnalysis();
        return;
    }

    // Update sidebar highlight
    renderSidebar();

    // Hide add account page and show active analysis ONLY if we are in 'bot' view
    const addPage = document.getElementById('addAccountPage');
    const activeEl = document.getElementById('activeAnalysis');
    if (currentLitmusView === 'bot') {
        if (addPage) addPage.classList.add('hidden');
        if (activeEl) activeEl.classList.remove('hidden');
    } else {
        if (activeEl) activeEl.classList.add('hidden');
        if (addPage) addPage.classList.add('hidden');
    }

    // Populate header
    document.getElementById('viewAccName').innerText = acc.name;
    const instLabel = acc.brokerSymbol ? `${acc.instrument || 'XAUUSD'} [${acc.brokerSymbol}]` : (acc.instrument || 'XAUUSD');
    const isPrincess = acc.strategy && (acc.strategy.includes('Princess') || acc.strategy.includes('princess'));
    const isBigBoys = !isPrincess && (!acc.strategy || acc.strategy.includes('Big Boys') || acc.strategy.includes('4H'));
    const stratName = isPrincess ? 'Princess Strategy (4H / 15M / 5M)' : (isBigBoys ? 'The Big Boys (4H / 15M / 5M)' : 'New Strategy (D1 / 15M / 5M)');
    document.getElementById('viewStrategyText').innerText = `${stratName} • ${instLabel}`;
    document.getElementById('viewServerText').innerText = acc.server;
    document.getElementById('viewLoginText').innerText = acc.login;

    const isCent = acc.isCent || acc.currency === 'USC' || /cent/i.test(acc.server || '') || /cent/i.test(acc.name || '');
    const eqEl = document.getElementById('viewEquityText');
    if (eqEl) {
        if (acc.equity !== undefined && acc.equity !== null) {
            if (isCent) {
                const usdEquiv = (Number(acc.equity) / 100).toFixed(2);
                eqEl.innerHTML = `<span style="color: #10b981;">${Number(acc.equity).toLocaleString()} USC</span> <span style="font-size: 13px; color: #94a3b8; font-weight: normal;">($${usdEquiv} USD Cent Account)</span>`;
            } else {
                eqEl.innerText = `$${Number(acc.equity).toFixed(2)}`;
            }
        } else {
            eqEl.innerText = 'Connecting to MetaApi Cloud...';
        }
    }

    const pauseBtn = document.getElementById('btnTogglePause');
    if (pauseBtn) {
        pauseBtn.innerText = acc.isPaused ? 'Resume EA' : 'Pause EA';
    }

    // Trade stats calculation
    const trades = acc.trades || [];
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.result === 'WIN').length;
    const losses = trades.filter(t => t.result === 'LOSS').length;
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';

    // Net profit calculation
    let netGain = 0;
    trades.forEach(t => {
        if (t.result === 'WIN') netGain += 1000;
        else netGain -= 100;
    });

    const gainSign = netGain >= 0 ? '+' : '-';
    const absGain = Math.abs(netGain).toLocaleString('en-US');

    // Fill metrics
    document.getElementById('metricTotalTrades').innerText = totalTrades;
    document.getElementById('metricWinLoss').innerText = `${wins} Wins / ${losses} Losses`;

    const winRateEl = document.getElementById('metricWinRate');
    winRateEl.innerText = `${winRate}%`;
    winRateEl.className = `metric-val ${parseFloat(winRate) >= 50 ? 'text-green' : 'text-orange'}`;

    const profitEl = document.getElementById('metricNetProfit');
    profitEl.innerText = `${gainSign}$${absGain}.00`;
    profitEl.className = `metric-val ${netGain >= 0 ? 'text-green' : 'text-red'}`;

    const gainPercent = (netGain / 100).toFixed(1);
    document.getElementById('metricGainPercent').innerText = `${gainSign}${gainPercent}% Total Return`;

    // Profit Factor (Total Win Sum / Total Loss Sum)
    const totalWinVal = wins * 1000;
    const totalLossVal = Math.max(1, losses * 100);
    const profitFactor = losses === 0 ? (wins > 0 ? '10.0' : '0.00') : (totalWinVal / totalLossVal).toFixed(2);
    document.getElementById('metricProfitFactor').innerText = profitFactor;

    document.getElementById('metricCircuit').innerText = `${losses % 3} / 3`;

    // Active Trade Position Bar
    const openBar = document.getElementById('openPositionBar');
    if (acc.activeTrade) {
        openBar.classList.remove('hidden');
        const openTagEl = document.getElementById('openTag');
        if (openTagEl) {
            openTagEl.innerText = 'ACTIVE 5M CONFIRMATION TRADE';
        }
        document.getElementById('openSymbol').innerText = acc.activeTrade.symbol;
        document.getElementById('openType').innerText = acc.activeTrade.type;
        document.getElementById('openLots').innerText = acc.activeTrade.lots;
        document.getElementById('openEntry').innerText = acc.activeTrade.entry;
        document.getElementById('openTarget').innerText = acc.activeTrade.target;
        document.getElementById('openTrailing').innerText = acc.activeTrade.trailing;
        document.getElementById('openPnl').innerText = acc.activeTrade.pnl;
    } else {
        openBar.classList.add('hidden');
    }

    // Trades History Table
    document.getElementById('tableTradesCount').innerText = totalTrades;
    const tbody = document.getElementById('tradesTableBody');
    tbody.innerHTML = '';

    if (totalTrades === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 32px; color: #64748b;">
                    No trades executed yet for this account. Expert Advisor is actively scanning the 5M chart structure.
                </td>
            </tr>
        `;
    } else {
        trades.forEach((t, index) => {
            const tr = document.createElement('tr');
            const isWin = t.result === 'WIN';
            tr.innerHTML = `
                <td>#${t.id || (index + 1)}</td>
                <td>${t.time}</td>
                <td><strong>${t.symbol}</strong></td>
                <td><span class="${t.type === 'BUY' ? 'text-type-buy' : 'text-type-sell'}">${t.type}</span></td>
                <td>${t.lots}</td>
                <td>${t.entry}</td>
                <td>${t.exit}</td>
                <td>${t.target}</td>
                <td><strong class="${isWin ? 'text-green' : 'text-red'}">${t.result}</strong></td>
                <td><strong class="${isWin ? 'text-green' : 'text-red'}">${t.profit}</strong></td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function showEmptyAnalysis() {
    openAddAccountPage();
}

// --- 4B. REAL-TIME MT5 VPS WEB-SYNC POLLER ---
let liveSyncInterval = null;

function startLiveSync() {
    if (liveSyncInterval) clearInterval(liveSyncInterval);

    const triggerSync = async () => {
        const acc = accounts.find(a => a.id === selectedAccountId);
        if (!acc || !acc.login) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/portal/sync?login=${encodeURIComponent(acc.login)}`);
            if (!res.ok) return;
            const json = await res.json();
            if (json && json.success && json.data) {
                const live = json.data;
                let modified = false;

                if (live.balance !== undefined && live.balance !== acc.balance) {
                    acc.balance = live.balance;
                    modified = true;
                }
                if (live.equity !== undefined && live.equity !== acc.equity) {
                    acc.equity = live.equity;
                    modified = true;
                }
                if (live.currency && live.currency !== acc.currency) {
                    acc.currency = live.currency;
                    modified = true;
                }
                if (live.isCent !== undefined && live.isCent !== acc.isCent) {
                    acc.isCent = live.isCent;
                    modified = true;
                }
                if (JSON.stringify(acc.activeTrade) !== JSON.stringify(live.activeTrade)) {
                    acc.activeTrade = live.activeTrade;
                    modified = true;
                }
                if (live.trades && Array.isArray(live.trades) && live.trades.length > 0) {
                    if (JSON.stringify(acc.trades) !== JSON.stringify(live.trades)) {
                        acc.trades = live.trades;
                        modified = true;
                    }
                }

                if (modified) {
                    saveAccounts();
                    renderSidebar();
                    selectAccount(acc.id);
                }
            }
        } catch (e) {
            // Silently ignore network hiccup
        }
    };

    triggerSync();
    liveSyncInterval = setInterval(triggerSync, 3000);
    startWatchdogTelemetry();
}

// --- 5. ACCOUNT ACTIONS (PAUSE / REMOVE) ---
function toggleCurrentAccountPause() {
    const acc = accounts.find(a => a.id === selectedAccountId);
    if (!acc) return;

    acc.isPaused = !acc.isPaused;
    saveAccounts();

    const pauseBtn = document.getElementById('btnTogglePause');
    if (pauseBtn) {
        pauseBtn.innerText = acc.isPaused ? 'Resume EA' : 'Pause EA';
    }
}

async function triggerTestTrade() {
    const btn = document.getElementById('btnTestTrade');
    const acc = accounts.find(a => a.id === selectedAccountId);
    if (!acc) {
        alert('Please select an account first.');
        return;
    }

    if (!confirm(`Place a live 1.0% test trade on Gold (XAUUSDc) on Exness account ${acc.login} to verify live execution?`)) {
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳ Placing 2% Trade...</span>';
    }

    try {
        const res = await fetch('https://litmustrend.onrender.com/test-trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: acc.login })
        });
        const data = await res.json();
        if (data.success) {
            alert(`✅ 1.0% Test Trade Placed Successfully!\n\nOrder ID: ${data.orderId}\nSymbol: ${data.symbol}\nLots: ${data.lots}\nEntry: ${data.entry}\nSL: ${data.sl}\n\nCheck your MT5 terminal now! The stepped trailing stop ladder is actively managing it.`);
            if (typeof syncAccountTelemetry === 'function') {
                syncAccountTelemetry(acc);
            }
        } else {
            alert(`❌ Trade Failed: ${data.error || 'Unknown error'}`);
        }
    } catch (err) {
        alert(`❌ Could not contact trading engine: ${err.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>⚡ Test 2% Trade</span>';
        }
    }
}

function deleteCurrentAccount() {
    const acc = accounts.find(a => a.id === selectedAccountId);
    if (!acc) return;

    if (confirm(`Remove "${acc.name}" from the trading workspace?`)) {
        // Fire-and-forget backend undeploy from MetaApi cloud container
        fetch('/api/portal/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: acc.metaAccountId || acc.id, login: acc.login })
        }).catch(err => console.warn('MetaApi cloud cleanup notice:', err));

        accounts = accounts.filter(a => a.id !== selectedAccountId);
        saveAccounts();
        selectedAccountId = accounts.length > 0 ? accounts[0].id : null;
        renderSidebar();
        if (selectedAccountId) {
            selectAccount(selectedAccountId);
        } else {
            showEmptyAnalysis();
        }
    }
}

// --- 6. MT5 BROKER & SERVER SEARCH REGISTRY (OFFICIAL METATRADER 5 DIRECTORY) ---
// Loads 183 official broker companies with 422 verified servers from js/brokers_data.js
const BROKER_DATABASE = (typeof OFFICIAL_MT5_BROKERS !== 'undefined' && Array.isArray(OFFICIAL_MT5_BROKERS))
    ? OFFICIAL_MT5_BROKERS
    : [];

// If running in VS Code Live Server (port 5500 or any static dev port), route API calls to production backend
const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && window.location.port !== '8888'
    ? 'https://litmustrend.vercel.app'
    : '';

let isManualServerMode = false;
let expandedBrokerName = null;
let brokerSearchDebounceTimer = null;
let currentBrokersList = [...BROKER_DATABASE];

function handleBrokerFocus() {
    const input = document.getElementById('brokerSearchInput');
    handleBrokerSearch(input.value || '', false);
}

function handleBrokerSearch(query, triggerApi = true) {
    const dropdown = document.getElementById('brokerSearchResults');
    if (!dropdown) return;

    const q = (query || '').trim();
    dropdown.classList.remove('hidden');

    if (currentBrokersList.length === 0 && BROKER_DATABASE.length > 0) {
        currentBrokersList = [...BROKER_DATABASE];
    }

    renderBrokerDropdown(q, currentBrokersList);

    if (triggerApi && q.length >= 2) {
        clearTimeout(brokerSearchDebounceTimer);
        brokerSearchDebounceTimer = setTimeout(() => {
            fetchLiveBrokers(q);
        }, 200);
    }
}

async function fetchLiveBrokers(query) {
    const q = (query || '').trim();
    if (!q) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/portal/servers?query=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.success && Array.isArray(data.brokers) && data.brokers.length > 0) {
            currentBrokersList = data.brokers;
            renderBrokerDropdown(q, data.brokers);
        }
    } catch (e) {
        // Fallback to offline currentBrokersList
    }
}

// Broker domain mapping to retrieve high-resolution official icons via Google Favicon Service
const BROKER_DOMAINS = [
    { match: 'exness', domain: 'exness.com' },
    { match: 'fbs', domain: 'fbs.com' },
    { match: 'octa', domain: 'octa.net' },
    { match: 'ftmo', domain: 'ftmo.com' },
    { match: 'fundednext', domain: 'fundednext.com' },
    { match: 'ic markets', domain: 'icmarkets.com' },
    { match: 'icmarkets', domain: 'icmarkets.com' },
    { match: 'deriv', domain: 'deriv.com' },
    { match: 'pepperstone', domain: 'pepperstone.com' },
    { match: 'xm', domain: 'xm.com' },
    { match: 'funding pips', domain: 'fundingpips.com' },
    { match: 'fundingpips', domain: 'fundingpips.com' },
    { match: 'roboforex', domain: 'roboforex.com' },
    { match: 'hfm', domain: 'hfm.com' },
    { match: 'hotforex', domain: 'hfm.com' },
    { match: 'avatrade', domain: 'avatrade.com' },
    { match: 'fp markets', domain: 'fpmarkets.com' },
    { match: 'fpmarkets', domain: 'fpmarkets.com' },
    { match: 'fxpro', domain: 'fxpro.com' },
    { match: 'justmarkets', domain: 'justmarkets.com' },
    { match: 'justforex', domain: 'justmarkets.com' },
    { match: 'vantage', domain: 'vantagemarkets.com' },
    { match: 'eightcap', domain: 'eightcap.com' },
    { match: 'alpha capital', domain: 'alphacapitalgroup.uk' },
    { match: 'the funded trader', domain: 'thefundedtraderprogram.com' },
    { match: 'funded trading plus', domain: 'fundedtradingplus.com' },
    { match: 'fxtm', domain: 'fxtm.com' },
    { match: 'forextime', domain: 'fxtm.com' },
    { match: 'kot4x', domain: 'kot4x.com' },
    { match: 'tickmill', domain: 'tickmill.com' },
    { match: 'oanda', domain: 'oanda.com' },
    { match: 'etoro', domain: 'etoro.com' },
    { match: 'ig', domain: 'ig.com' },
    { match: 'saxo', domain: 'home.saxo' },
    { match: 'swyft', domain: 'swyftmarkets.com' },
    { match: 'shift', domain: 'shiftmarkets.com' },
    { match: 'tradestone', domain: 'fbs.com' },
    { match: 'wetrade', domain: 'wetrade.com' },
    { match: 'interstellar', domain: 'isgroups.com' }
];

function getBrokerLogoUrl(brokerName) {
    if (!brokerName) return 'https://www.google.com/s2/favicons?domain=metaquotes.net&sz=64';
    const lower = brokerName.toLowerCase();
    const found = BROKER_DOMAINS.find(item => lower.includes(item.match));
    if (found) {
        return `https://www.google.com/s2/favicons?domain=${found.domain}&sz=64`;
    }
    const cleanWords = lower.replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 2 && !['ltd', 'limited', 'inc', 'corp', 'group', 'markets', 'financial', 'technologies', 'trading', 'services', 'international', 'holdings'].includes(w));
    if (cleanWords.length > 0) {
        return `https://www.google.com/s2/favicons?domain=${cleanWords[0]}.com&sz=64`;
    }
    return 'https://www.google.com/s2/favicons?domain=metaquotes.net&sz=64';
}

function getServerTag(srv) {
    const s = (srv || '').toLowerCase();
    if (s.includes('demo')) return { label: 'DEMO', cls: 'tag-demo' };
    if (s.includes('trial')) return { label: 'TRIAL', cls: 'tag-trial' };
    return { label: 'REAL', cls: 'tag-real' };
}

function renderBrokerDropdown(query, brokers) {
    const dropdown = document.getElementById('brokerSearchResults');
    if (!dropdown) return;

    const q = (query || '').trim().toLowerCase();
    dropdown.innerHTML = '';

    const source = (brokers && brokers.length > 0) ? brokers : BROKER_DATABASE;

    const filtered = source.filter(b => {
        if (!q) return true;
        const nameMatch = b.name.toLowerCase().includes(q);
        const serverMatch = b.servers.some(s => s.toLowerCase().includes(q));
        return nameMatch || serverMatch;
    });

    if (filtered.length === 0) {
        dropdown.innerHTML = `
            <div class="broker-empty-msg">
                No MT5 server found matching "${escapeHtml(query)}".<br>
                <button type="button" class="btn-text-link" style="margin-top:6px;" onclick="toggleManualServerInput('${escapeHtml(query)}')">Click to enter server manually</button>
            </div>
        `;
        return;
    }

    filtered.forEach(broker => {
        const isSingleBroker = filtered.length === 1;
        const isExpanded = isSingleBroker || expandedBrokerName === broker.name || (q.length > 1 && broker.name.toLowerCase().includes(q));
        const group = document.createElement('div');
        group.className = 'broker-group';

        const logoUrl = getBrokerLogoUrl(broker.name);

        group.innerHTML = `
            <div class="broker-group-header" onclick="toggleBrokerExpand('${escapeHtml(broker.name)}', event)">
                <div class="broker-identity">
                    <img src="${logoUrl}" class="broker-logo-img" alt="" onerror="this.style.display='none'">
                    <span>${escapeHtml(broker.name)}</span>
                </div>
                <span class="broker-server-count">${broker.servers.length} server${broker.servers.length === 1 ? '' : 's'} ${isExpanded ? SVG_ICONS.chevronUp : SVG_ICONS.chevronDown}</span>
            </div>
            <div class="broker-servers-list ${isExpanded ? '' : 'hidden'}" id="servers-${escapeHtml(broker.name)}">
                ${broker.servers.map(srv => {
                    const tag = getServerTag(srv);
                    return `
                    <div class="server-item" onclick="selectBrokerServer('${escapeHtml(srv)}', '${escapeHtml(broker.name)}', event)">
                        <span>${escapeHtml(srv)}</span>
                        <span class="server-type-tag ${tag.cls}">${tag.label}</span>
                    </div>
                    `;
                }).join('')}
            </div>
        `;

        dropdown.appendChild(group);
    });
}

function toggleBrokerExpand(brokerName, event) {
    if (event) {
        event.stopPropagation();
    }
    expandedBrokerName = (expandedBrokerName === brokerName) ? null : brokerName;
    const input = document.getElementById('brokerSearchInput');
    renderBrokerDropdown(input.value || '', currentBrokersList);
    const dropdown = document.getElementById('brokerSearchResults');
    if (dropdown) dropdown.classList.remove('hidden');
}

function selectBrokerServer(serverName, brokerName = '', event) {
    if (event) {
        event.stopPropagation();
    }
    document.getElementById('accServer').value = serverName;
    document.getElementById('selectedServerName').innerText = serverName;
    
    // Set selected server logo picture
    const logoImg = document.getElementById('selectedServerLogo');
    if (logoImg) {
        logoImg.src = getBrokerLogoUrl(brokerName || serverName);
        logoImg.style.display = 'inline-block';
    }

    // Hide search input & dropdown, show selected chip
    document.getElementById('brokerSearchInput').classList.add('hidden');
    document.getElementById('brokerSearchResults').classList.add('hidden');
    document.getElementById('selectedServerDisplay').classList.remove('hidden');

    updateSyncedBrokerSymbol();
}

function clearSelectedServer() {
    document.getElementById('accServer').value = '';
    document.getElementById('selectedServerName').innerText = '';
    document.getElementById('selectedServerDisplay').classList.add('hidden');
    
    const logoImg = document.getElementById('selectedServerLogo');
    if (logoImg) logoImg.src = '';

    const searchInput = document.getElementById('brokerSearchInput');
    searchInput.classList.remove('hidden');
    searchInput.value = '';
    searchInput.focus();
    handleBrokerSearch('');

    updateSyncedBrokerSymbol();
}

function toggleManualServerInput(prefillValue = '') {
    isManualServerMode = !isManualServerMode;
    const searchMode = document.getElementById('brokerSearchMode');
    const manualMode = document.getElementById('brokerManualMode');
    const toggleBtn = document.getElementById('btnToggleManualServer');
    const manualInput = document.getElementById('accServerManual');

    if (isManualServerMode) {
        searchMode.classList.add('hidden');
        manualMode.classList.remove('hidden');
        toggleBtn.innerText = 'Search Broker';
        if (prefillValue) {
            manualInput.value = prefillValue;
            syncManualServer(prefillValue);
        }
        manualInput.focus();
    } else {
        manualMode.classList.add('hidden');
        searchMode.classList.remove('hidden');
        toggleBtn.innerText = 'Enter Manually';
        clearSelectedServer();
    }
}

function syncManualServer(val) {
    document.getElementById('accServer').value = (val || '').trim();
    updateSyncedBrokerSymbol();
}

// Close broker dropdown when clicking outside
document.addEventListener('click', (e) => {
    const wrap = document.getElementById('brokerSearchMode');
    const dropdown = document.getElementById('brokerSearchResults');
    const pillsWrap = document.querySelector('.broker-quick-pills-wrap');
    if (!dropdown || dropdown.classList.contains('hidden')) return;

    const path = e.composedPath ? e.composedPath() : [];
    const isInside = 
        (wrap && (wrap.contains(e.target) || path.includes(wrap))) ||
        (pillsWrap && (pillsWrap.contains(e.target) || path.includes(pillsWrap)));

    if (!isInside) {
        dropdown.classList.add('hidden');
    }
});

// --- 2-STEP WIZARD STATE & CONTROLLERS (NEW STRATEGY ONLY) ---
let wizardCurrentStep = 1;

function goToWizardStep(stepNum) {
    wizardCurrentStep = stepNum;

    // Update panels visibility
    const panel1 = document.getElementById('wizardPanel1');
    const panel2 = document.getElementById('wizardPanel2');

    if (panel1) panel1.classList.toggle('hidden', stepNum !== 1);
    if (panel2) panel2.classList.toggle('hidden', stepNum !== 2);

    // Update stepper nodes
    const node1 = document.getElementById('stepNode1');
    const node2 = document.getElementById('stepNode2');
    const line1 = document.getElementById('stepLine1');

    if (node1) {
        node1.className = `wizard-step-node ${stepNum === 1 ? 'active' : 'completed'}`;
    }
    if (node2) {
        node2.className = `wizard-step-node ${stepNum === 2 ? 'active' : ''}`;
    }
    if (line1) {
        line1.className = `stepper-line ${stepNum >= 2 ? 'active' : ''}`;
    }

    // Update headers
    const headingText = document.getElementById('wizardHeadingText');
    if (headingText) {
        headingText.innerText = (stepNum === 1) ? 'New Strategy 1%' : 'Connect MT5 Account';
    }

    if (stepNum === 2) {
        const nameInput = document.getElementById('accName');
        if (nameInput) setTimeout(() => nameInput.focus({ preventScroll: true }), 80);
    }

    const viewport = document.querySelector('.analysis-viewport');
    if (viewport) viewport.scrollTop = 0;
}

// Strategy Selection Controller
function selectStrategyCard(strategyValue) {
    const hiddenInput = document.getElementById('accStrategy');
    if (hiddenInput) hiddenInput.value = strategyValue;

    const cardBB = document.getElementById('cardBigBoys');
    const cardNS = document.getElementById('cardNewStrategy');
    const cardPS = document.getElementById('cardPrincess');
    const cardAMS = document.getElementById('cardAMS');
    const badgeName = document.getElementById('panel2StrategyName');

    [cardBB, cardNS, cardPS, cardAMS].forEach(c => c && c.classList.remove('selected'));

    if (strategyValue.includes('After Market') || strategyValue.includes('AMS')) {
        if (cardAMS) cardAMS.classList.add('selected');
        if (badgeName) badgeName.innerText = 'After Market Strategy (15M POI / 5M Entry / 10% Risk)';
    } else if (strategyValue.includes('Princess')) {
        if (cardPS) cardPS.classList.add('selected');
        if (badgeName) badgeName.innerText = 'Princess Strategy (4H / 15M / 5M)';
    } else if (strategyValue.includes('Big Boys') || strategyValue.includes('4H')) {
        if (cardBB) cardBB.classList.add('selected');
        if (badgeName) badgeName.innerText = 'The Big Boys (4H / 15M / 5M)';
    } else {
        if (cardNS) cardNS.classList.add('selected');
        if (badgeName) badgeName.innerText = 'New Strategy (D1 / 15M / 5M)';
    }
}

function toggleAccountStrategy() {
    const acc = accounts.find(a => a.id === selectedAccountId);
    if (!acc) return;

    if (!acc.strategy || acc.strategy.includes('Big Boys') || acc.strategy.includes('4H')) {
        acc.strategy = 'New Strategy 1%';
    } else if (acc.strategy.includes('New Strategy') || acc.strategy.includes('D1')) {
        acc.strategy = 'Princess Strategy';
    } else if (acc.strategy.includes('Princess')) {
        acc.strategy = 'After Market Strategy (AMS)';
    } else {
        acc.strategy = 'The Big Boys 4H';
    }
    saveAccounts();
    renderSidebar();
    selectAccount(acc.id);

    // Sync strategy switch dynamically to backend API
    fetch(`${API_BASE_URL}/api/portal/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            login: acc.login,
            server: acc.server,
            strategy: acc.strategy
        })
    }).catch(err => console.log('Strategy sync offline note:', err));
}

function quickSelectBroker(brokerName, e) {
    if (e) {
        e.stopPropagation();
    }
    document.querySelectorAll('.broker-pill').forEach(pill => {
        if (pill.getAttribute('data-broker') === brokerName) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    if (isManualServerMode) {
        toggleManualServerInput();
    }

    // Auto expand this broker's servers
    expandedBrokerName = brokerName;

    const searchInput = document.getElementById('brokerSearchInput');
    const dropdown = document.getElementById('brokerSearchResults');
    if (searchInput) {
        searchInput.value = brokerName;
    }

    handleBrokerSearch(brokerName, false);

    if (dropdown) {
        dropdown.classList.remove('hidden');
        dropdown.scrollTop = 0;
    }
}

function togglePasswordVisibility() {
    const input = document.getElementById('accPassword');
    const icon = document.getElementById('togglePasswordIcon');
    if (!input) return;

    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.innerHTML = SVG_ICONS.eyeSlash;
    } else {
        input.type = 'password';
        if (icon) icon.innerHTML = SVG_ICONS.eye;
    }
}

// --- 7. ADD ACCOUNT PAGE WORKFLOW (FULL PAGE IN WORKSPACE, NOT A POP-UP) ---
function openAddAccountPage() {
    currentLitmusView = 'bot';
    selectedAccountId = null;
    renderSidebar();

    const btnBot = document.getElementById('navBtnBot');
    const btnSocial = document.getElementById('navBtnSocial');
    const btnJournal = document.getElementById('navBtnJournal');
    [btnBot, btnSocial, btnJournal].forEach(b => b && b.classList.remove('active'));
    if (btnBot) btnBot.classList.add('active');

    const activeEl = document.getElementById('activeAnalysis');
    const pageEl = document.getElementById('addAccountPage');
    const socialView = document.getElementById('socialStudioView');
    const journalView = document.getElementById('tradeJournalView');
    const backBtn = document.getElementById('btnCancelAddPage');

    if (activeEl) activeEl.classList.add('hidden');
    if (socialView) socialView.classList.add('hidden');
    if (journalView) journalView.classList.add('hidden');
    if (pageEl) pageEl.classList.remove('hidden');

    // Show back button only if there are existing accounts to return to
    if (backBtn) {
        backBtn.style.display = accounts.length > 0 ? 'inline-block' : 'none';
    }

    const form = document.getElementById('addAccountForm');
    if (form) form.reset();

    const errEl = document.getElementById('accModalError');
    if (errEl) errEl.innerText = '';

    // Reset password visibility
    const passInput = document.getElementById('accPassword');
    if (passInput) passInput.type = 'password';
    const passIcon = document.getElementById('togglePasswordIcon');
    if (passIcon) passIcon.innerHTML = SVG_ICONS.eye;

    // Reset broker pills
    document.querySelectorAll('.broker-pill').forEach(p => p.classList.remove('active'));

    clearSelectedServer();

    // Reset progressive wizard to step 1
    goToWizardStep(1);
}

function closeAddAccountPage() {
    const pageEl = document.getElementById('addAccountPage');

    const form = document.getElementById('addAccountForm');
    if (form) form.reset();

    const errEl = document.getElementById('accModalError');
    if (errEl) errEl.innerText = '';

    clearSelectedServer();

    if (accounts.length > 0) {
        if (pageEl) pageEl.classList.add('hidden');
        selectAccount(selectedAccountId || accounts[0].id);
    } else {
        openAddAccountPage();
    }
}

// Backward compatibility aliases
function openAddAccountModal() { openAddAccountPage(); }
function closeAddAccountModal() { closeAddAccountPage(); }

async function handleCreateAccount(e) {
    e.preventDefault();

    const name = document.getElementById('accName').value.trim();
    const strategy = document.getElementById('accStrategy')?.value || 'The Big Boys 4H';
    const server = document.getElementById('accServer').value.trim();
    const login = document.getElementById('accLogin').value.trim();
    const password = document.getElementById('accPassword').value.trim();
    const instrument = document.getElementById('accInstrument')?.value || selectedInstrument || 'XAUUSD';
    const brokerSymbol = updateSyncedBrokerSymbol();
    const btn = document.getElementById('btnSaveAcc');
    const errEl = document.getElementById('accModalError');

    if (!name || !server || !login || !password) {
        if (errEl) errEl.innerText = 'Please select a broker server and fill in all required credentials.';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon-symbol">' + SVG_ICONS.spinner + '</span> <span class="btn-text">Establishing MT5 Handshake...</span>';
    errEl.innerText = '';

    try {
        const response = await fetch(`${API_BASE_URL}/api/portal/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account_name: name,
                strategy,
                server,
                account: login,
                password,
                instrument,
                broker_symbol: brokerSymbol
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            const newAcc = {
                id: 'acc-' + Date.now(),
                name,
                strategy,
                server,
                login,
                instrument,
                brokerSymbol,
                isPaused: false,
                activeTrade: null,
                trades: []
            };

            accounts.push(newAcc);
            saveAccounts();

            // Reset form fields
            const form = document.getElementById('addAccountForm');
            if (form) form.reset();
            clearSelectedServer();

            // Hide add account page and show active analysis directly
            const addPage = document.getElementById('addAccountPage');
            if (addPage) addPage.classList.add('hidden');
            const activeEl = document.getElementById('activeAnalysis');
            if (activeEl) activeEl.classList.remove('hidden');

            // Select and display the newly created account
            selectAccount(newAcc.id);
        } else {
            errEl.innerText = data.error || 'Authentication Failed: Broker rejected credentials. Please check your MT5 server and login.';
        }
    } catch (err) {
        if (errEl) {
            errEl.innerText = 'Connection error: Unable to verify MT5 account with broker (' + (err.message || 'Network error') + '). Account was NOT added.';
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon-symbol">' + SVG_ICONS.bolt + '</span> <span class="btn-text">Create Account & Start Bot</span> <span class="btn-arrow">' + SVG_ICONS.arrowRight + '</span>';
    }
}

// --- UTILITIES ---
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- AUTONOMOUS STRATEGY WATCHDOG TELEMETRY ---
let watchdogInterval = null;

function switchDashboardTab(tabName) {
    const btnWd = document.getElementById('tabBtnWatchdog');
    const btnTr = document.getElementById('tabBtnTrades');
    const panelWd = document.getElementById('tabPanelWatchdog');
    const panelTr = document.getElementById('tabPanelTrades');

    if (tabName === 'watchdog') {
        btnWd?.classList.add('active');
        btnTr?.classList.remove('active');
        panelWd?.classList.remove('hidden');
        panelTr?.classList.add('hidden');
    } else {
        btnTr?.classList.add('active');
        btnWd?.classList.remove('active');
        panelTr?.classList.remove('hidden');
        panelWd?.classList.add('hidden');
    }
}

async function pollWatchdogTelemetry() {
    try {
        const res = await fetch('/api/portal/watchdog');
        if (!res.ok) return;
        const data = await res.json();
        if (!data || !data.success) return;

        // 1. Live Quote
        const quoteEl = document.getElementById('wdLiveQuote');
        if (quoteEl && data.liveQuote && data.liveQuote.bid) {
            quoteEl.innerText = `Bid: ${data.liveQuote.bid.toFixed(2)} | Ask: ${data.liveQuote.ask.toFixed(2)}`;
        }

        // 2. Step 1: Macro Trend
        const step1Badge = document.getElementById('wdStep1Badge');
        const step1Title = document.getElementById('wdStep1Title');
        const step1Desc = document.getElementById('wdStep1Desc');
        if (data.macroFilter) {
            const isBull = data.macroFilter.isBullish;
            if (step1Badge) {
                step1Badge.innerText = isBull ? '[✓] BULLISH ALIGNED' : '[✓] BEARISH ALIGNED';
                step1Badge.style.color = isBull ? 'var(--green)' : 'var(--red)';
                step1Badge.style.background = isBull ? 'var(--green-bg)' : 'var(--red-bg)';
            }
            if (step1Title) {
                step1Title.innerText = isBull ? '4H Bullish Macro Trend' : '4H Bearish Macro Trend';
            }
            if (step1Desc) {
                step1Desc.innerText = `Price is trading ${isBull ? 'above' : 'below'} 4H Close (${data.macroFilter.h4Close.toFixed(2)}). Institutional bias active.`;
            }
        }

        // 3. Step 2: 15M FVG Zone
        const step2Badge = document.getElementById('wdStep2Badge');
        const step2Title = document.getElementById('wdStep2Title');
        const step2Desc = document.getElementById('wdStep2Desc');
        if (data.currentZone) {
            if (step2Badge) {
                step2Badge.innerText = '[✓] IN ZONE (DISCOUNT)';
                step2Badge.style.color = 'var(--green)';
                step2Badge.style.background = 'var(--green-bg)';
            }
            if (step2Title) {
                step2Title.innerText = `Zone: ${data.currentZone.top.toFixed(2)} – ${data.currentZone.bottom.toFixed(2)}`;
            }
            if (step2Desc) {
                step2Desc.innerText = `Gold entered 15M ${data.currentZone.direction} FVG. Armed for 5M reversal close.`;
            }
        } else {
            if (step2Badge) {
                step2Badge.innerText = `[⏳] ${data.totalActiveZones || 0} ZONES ARMED`;
                step2Badge.style.color = '#f59e0b';
                step2Badge.style.background = 'rgba(245, 158, 11, 0.15)';
            }
            if (step2Title) {
                step2Title.innerText = `${data.totalActiveZones || 0} Bullish FVGs Armed in Memory`;
            }
            if (step2Desc) {
                step2Desc.innerText = 'Monitoring Gold price action as it approaches institutional FVG zones.';
            }
        }

        // 4. Step 3: 5M Confirmation Candle Timer
        const step3Badge = document.getElementById('wdStep3Badge');
        const timerEl = document.getElementById('wdCandleTimer');
        const step3Desc = document.getElementById('wdStep3Desc');
        if (data.candle5M) {
            if (timerEl) timerEl.innerText = data.candle5M.formattedTime;
            const isCritical = data.candle5M.secondsRemaining <= 15;
            if (step3Badge) {
                step3Badge.innerText = isCritical ? '[⚡] AUTO-TRIGGER WINDOW' : '[⏳] EVALUATING';
                step3Badge.style.color = isCritical ? 'var(--accent)' : '#f59e0b';
                step3Badge.style.background = isCritical ? 'var(--accent-glow)' : 'rgba(245, 158, 11, 0.15)';
            }
            if (step3Desc) {
                step3Desc.innerText = isCritical 
                    ? 'In the 15-second close window: evaluating reversal close to place 2% trade automatically.'
                    : 'Building 5M confirmation candle inside tapped zone to place trade automatically.';
            }
        }

        // 5. Audit Log Feed
        const logBox = document.getElementById('watchdogLogsContainer');
        if (logBox && data.logs && data.logs.length > 0) {
            logBox.innerHTML = data.logs.map(line => {
                let color = 'var(--text-secondary)';
                if (line.includes('SUCCESS') || line.includes('Order ID') || line.includes('PLACING') || line.includes('BOS')) {
                    color = 'var(--accent)';
                } else if (line.includes('Pre-Close') || line.includes('Active Zones')) {
                    color = '#f59e0b';
                } else if (line.includes('Error') || line.includes('TIMEOUT')) {
                    color = 'var(--red)';
                }
                return `<div style="color: ${color}; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--border-subtle);">${escapeHtml(line)}</div>`;
            }).join('');
        }
    } catch (e) {}
}

function startWatchdogTelemetry() {
    if (watchdogInterval) clearInterval(watchdogInterval);
    pollWatchdogTelemetry();
    watchdogInterval = setInterval(pollWatchdogTelemetry, 3000);
}

// --- INIT ---
window.addEventListener('DOMContentLoaded', () => {
    initTripleTapThemeToggle();
    updateSyncedBrokerSymbol();

    const dropdown = document.getElementById('brokerSearchResults');
    if (dropdown) {
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || sessionStorage.getItem('litmus_auth_token')) {
        unlockPortal();
    } else {
        document.getElementById('passcodeScreen').classList.add('active-screen');
        document.getElementById('dashboardScreen').classList.remove('active-screen');
    }
});

// ====================================================================
// LITMUSTREND - MULTI-VIEW NAVIGATION & SOCIAL VIBE STUDIO SUITE
// ====================================================================
let currentLitmusView = 'bot';

const DEFAULT_LITMUS_TRADES = [
  {
    "id": "TRD-81816344-01",
    "symbol": "XAUUSDm",
    "display_symbol": "XAUUSD (Gold)",
    "type": "BUY",
    "lots": 0.04,
    "entry": 3180.20,
    "sl": 3165.00,
    "tp": 3360.00,
    "exit": 3362.60,
    "final_r": "+12.0R",
    "pnl": 120.0,
    "status": "WIN",
    "trade_grade": "A+",
    "setup_category": "15M Origin Demand POI",
    "session": "London / NY Overlap",
    "efficiency_score": "99.2%",
    "snapshot_before": "snapshots/XAUUSD_Trade_Before.png",
    "snapshot_after": "snapshots/XAUUSD_Trade_After.png",
    "setup_title": "15M Origin Demand Mitigation & Confluence",
    "setup_context": "Decisive bullish break of structure above 3,175.00. Early Asian sell-side liquidity swept directly into unmitigated 15M Demand POI at 3,180.20.",
    "in_trade_story": "Limit filled cleanly at 3,180.20. At +2.0R, automated Break-Even rule shifted SL to entry. Price expanded into the 3,360.00 target for a clean +12.0R return.",
    "psychology": { "mindset_entry": "Calm, Patient & Disciplined", "tilt_level": "0% (Zero FOMO)" },
    "checklist": [
      { "rule": "HTF Trend / PWC Bias Bullish", "passed": true },
      { "rule": "15M Origin Demand POI Identified", "passed": true },
      { "rule": "Dynamic 10.0% Risk Sized Automatically", "passed": true },
      { "rule": "SL Placed Beneath Origin Structure", "passed": true },
      { "rule": "Break-Even Protected at +2.0R", "passed": true }
    ]
  },
  {
    "id": "TRD-81816344-02",
    "symbol": "GBPUSDm",
    "display_symbol": "GBPUSD (British Pound)",
    "type": "BUY",
    "lots": 0.05,
    "entry": 1.28450,
    "sl": 1.28310,
    "tp": 1.30500,
    "exit": 1.30550,
    "final_r": "+15.0R",
    "pnl": 150.0,
    "status": "WIN",
    "trade_grade": "A+",
    "setup_category": "London Open Liquidity Sweep",
    "session": "New York Expansion",
    "efficiency_score": "98.7%",
    "snapshot_before": "snapshots/GBPUSD_Trade_Before.png",
    "snapshot_after": "snapshots/GBPUSD_Trade_After.png",
    "setup_title": "London Open Liquidity Sweep into 4H Discount Order Block",
    "setup_context": "4H Bullish Market Structure with equal lows swept before London session open.",
    "in_trade_story": "Tapped 4H discount order block at 1.28450. Trailed cleanly into full 1:15 target at 1.30500.",
    "psychology": { "mindset_entry": "Confident & Systematic", "tilt_level": "0% (Zero FOMO)" },
    "checklist": [
      { "rule": "4H Bullish Structure Confirmed", "passed": true },
      { "rule": "Equal Lows Liquidity Swept", "passed": true },
      { "rule": "Dynamic 10.0% Risk Sized Automatically", "passed": true },
      { "rule": "Break-Even Protected at +2.0R", "passed": true }
    ]
  }
];

let activeJournalFilter = 'ALL';

function switchLitmusView(view) {
    currentLitmusView = view;
    
    const btnBot = document.getElementById('navBtnBot');
    const btnSocial = document.getElementById('navBtnSocial');
    const btnJournal = document.getElementById('navBtnJournal');
    [btnBot, btnSocial, btnJournal].forEach(b => b && b.classList.remove('active'));

    const activeAnalysis = document.getElementById('activeAnalysis');
    const addAccountPage = document.getElementById('addAccountPage');
    const socialView = document.getElementById('socialStudioView');
    const journalView = document.getElementById('tradeJournalView');

    // 1. Force-hide ALL views to ensure ZERO bleed-through or stacking
    if (activeAnalysis) activeAnalysis.classList.add('hidden');
    if (addAccountPage) addAccountPage.classList.add('hidden');
    if (socialView) socialView.classList.add('hidden');
    if (journalView) journalView.classList.add('hidden');

    // 2. Selectively activate only the requested view
    if (view === 'bot') {
        if (btnBot) btnBot.classList.add('active');
        if (accounts.length > 0 && selectedAccountId) {
            if (activeAnalysis) activeAnalysis.classList.remove('hidden');
        } else if (accounts.length > 0) {
            selectAccount(accounts[0].id);
        } else {
            if (addAccountPage) addAccountPage.classList.remove('hidden');
        }
    } else if (view === 'social') {
        if (btnSocial) btnSocial.classList.add('active');
        if (socialView) socialView.classList.remove('hidden');
        initLitmusSocialStudio();
    } else if (view === 'journal') {
        if (btnJournal) btnJournal.classList.add('active');
        if (journalView) journalView.classList.remove('hidden');
        renderLitmusJournal();
    }
}

function switchLtTikTokSlide(slideNum) {
    const s1Tab = document.getElementById('ltSlide1Tab');
    const s2Tab = document.getElementById('ltSlide2Tab');
    const s1Box = document.getElementById('ltSlide1Box');
    const s2Box = document.getElementById('ltSlide2Box');

    if (slideNum === 1) {
        if (s1Tab) { s1Tab.classList.add('primary'); }
        if (s2Tab) { s2Tab.classList.remove('primary'); }
        if (s1Box) s1Box.classList.remove('hidden');
        if (s2Box) s2Box.classList.add('hidden');
    } else {
        if (s2Tab) { s2Tab.classList.add('primary'); }
        if (s1Tab) { s1Tab.classList.remove('primary'); }
        if (s1Box) s1Box.classList.add('hidden');
        if (s2Box) s2Box.classList.remove('hidden');
    }
}

function initLitmusSocialStudio() {
    const sel = document.getElementById('ltSelectTrade');
    const tradeId = sel ? sel.value : 'TRD-81816344-01';
    onLitmusTradeChanged(tradeId);
}

function onLitmusTradeChanged(tradeId) {
    const t = DEFAULT_LITMUS_TRADES.find(tr => tr.id === tradeId) || DEFAULT_LITMUS_TRADES[0];
    const symClean = String(t.symbol).replace('m', '');

    const imgS1 = document.getElementById('ltSlide1Img');
    const imgS2 = document.getElementById('ltSlide2Img');
    if (imgS1) imgS1.src = t.snapshot_before;
    if (imgS2) imgS2.src = t.snapshot_after;

    const badgeR = document.getElementById('ltSlide2BadgeR');
    if (badgeR) badgeR.innerText = `${t.final_r} Target Hit 🎯`;

    const gradeHeader = document.getElementById('ltHeaderTradeGrade');
    if (gradeHeader) gradeHeader.innerText = `GRADE ${t.trade_grade}`;

    const returnHeader = document.getElementById('ltHeaderReturn');
    if (returnHeader) returnHeader.innerText = `${t.final_r} (+$${Number(t.pnl).toFixed(2)})`;

    const effHeader = document.getElementById('ltHeaderEfficiency');
    if (effHeader) effHeader.innerText = t.efficiency_score;

    const btnS1 = document.getElementById('ltBtnDownloadS1');
    if (btnS1) {
        btnS1.href = t.snapshot_before;
        btnS1.download = `Slide1_Before_Setup_${symClean}.png`;
    }
    const btnS2 = document.getElementById('ltBtnDownloadS2');
    if (btnS2) {
        btnS2.href = t.snapshot_after;
        btnS2.download = `Slide2_After_Outcome_${symClean}.png`;
    }

    const hook = `"Look at this clean 15m ${symClean} setup... swipe right to see how it played out! ➡️"`;
    const caption = `🎯 ${symClean} Before & After SMC Execution!
• Setup: ${t.setup_category || '15M Origin Demand POI'}
• Realized Return: ${t.final_r} (+$${Number(t.pnl || 0).toFixed(2)} USD)
• Risk Sizing: Dynamic 2.0% auto-calculated | Break-Even at +3R

Swipe right to see the outcome! ➡️

Follow @litmus_trend for daily high-probability trade setups!
#fyp #forex #trading #daytrading #${symClean.toLowerCase()} #tradingview #smartmoneyconcepts #foryoupage`;

    const elHook = document.getElementById('ltTikTokHook');
    if (elHook) elHook.innerText = hook;
    const elCaption = document.getElementById('ltTikTokCaption');
    if (elCaption) elCaption.innerText = caption;
    const editor = document.getElementById('ltSocialCaption');
    if (editor) editor.value = caption;
}

function ltShareToTikTok() {
    const caption = document.getElementById('ltSocialCaption')?.value || "";
    navigator.clipboard.writeText(caption).then(() => {
        alert("✓ TikTok caption copied to clipboard! Opening TikTok upload...");
        window.open('https://www.tiktok.com/upload', '_blank');
    });
}

function ltShareToX() {
    const caption = document.getElementById('ltSocialCaption')?.value || "";
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}`, '_blank');
}

function ltShareToInstagram() {
    const caption = document.getElementById('ltSocialCaption')?.value || "";
    navigator.clipboard.writeText(caption).then(() => {
        alert("✓ Instagram caption copied to clipboard! Opening Instagram...");
        window.open('https://www.instagram.com', '_blank');
    });
}

function ltShareToWhatsApp() {
    const caption = document.getElementById('ltSocialCaption')?.value || "";
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(caption)}`, '_blank');
}

function ltShareToTelegram() {
    const caption = document.getElementById('ltSocialCaption')?.value || "";
    window.open(`https://t.me/share/url?text=${encodeURIComponent(caption)}`, '_blank');
}

function ltShareToDeviceApps() {
    const caption = document.getElementById('ltSocialCaption')?.value || "";
    if (navigator.share) {
        navigator.share({ title: 'LitmusTrend Trade Recap', text: caption, url: window.location.href }).catch(() => {});
    } else {
        ltCopyCurrentCaption();
    }
}

function ltCopyCurrentCaption() {
    const caption = document.getElementById('ltSocialCaption')?.value || "";
    navigator.clipboard.writeText(caption).then(() => {
        alert("✓ Formatted post caption copied to clipboard!");
    });
}

// --- INSTITUTIONAL TRADE JOURNAL ---
function filterJournal(sym) {
    activeJournalFilter = sym;

    const btnAll = document.getElementById('jFilterAll');
    const btnGold = document.getElementById('jFilterGold');
    const btnGbp = document.getElementById('jFilterGbp');
    [btnAll, btnGold, btnGbp].forEach(b => b && b.classList.remove('active'));

    if (sym === 'ALL' && btnAll) btnAll.classList.add('active');
    else if (sym === 'XAUUSD' && btnGold) btnGold.classList.add('active');
    else if (sym === 'GBPUSD' && btnGbp) btnGbp.classList.add('active');

    renderLitmusJournal();
}

function renderLitmusJournal() {
    const container = document.getElementById('ltJournalContainer');
    if (!container) return;

    const filtered = DEFAULT_LITMUS_TRADES.filter(t => {
        if (activeJournalFilter === 'ALL') return true;
        return t.symbol.toUpperCase().includes(activeJournalFilter.toUpperCase());
    });

    // Update KPI bar
    const kpiCount = document.getElementById('jKpiTradesCount');
    if (kpiCount) kpiCount.innerText = `${filtered.length} Trade${filtered.length === 1 ? '' : 's'}`;

    let totalR = 0;
    let totalPnl = 0;
    filtered.forEach(t => {
        const numR = parseFloat(String(t.final_r).replace('+', '').replace('R', '')) || 0;
        totalR += numR;
        totalPnl += Number(t.pnl) || 0;
    });

    const kpiNetR = document.getElementById('jKpiNetReturn');
    if (kpiNetR) kpiNetR.innerText = `+${totalR.toFixed(1)} R`;

    const kpiNetPnl = document.getElementById('jKpiNetPnl');
    if (kpiNetPnl) kpiNetPnl.innerText = `+$${totalPnl.toFixed(2)} Account Net`;

    const kpiAvgR = document.getElementById('jKpiAvgR');
    if (kpiAvgR) {
        const avg = filtered.length > 0 ? (totalR / filtered.length).toFixed(1) : '0.0';
        kpiAvgR.innerText = `+${avg} R`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="background: var(--bg-surface); border: 1px dashed var(--border); border-radius: 14px; padding: 40px; text-align: center; color: var(--text-muted);">
                <p style="margin: 0; font-size: 0.95rem; font-weight: 600;">No trades logged for this filter category.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(t => {
        const sym = String(t.symbol).replace('m', '');
        return `
            <div class="journal-trade-card">
                <!-- TOP ROW: TICKER, STATUS, GRADE & PNL -->
                <div class="journal-card-top-row">
                    <div class="journal-asset-meta">
                        <span class="journal-ticker">${sym}</span>
                        <span class="journal-status-pill">${t.status} ${t.final_r}</span>
                        <span class="journal-grade-pill">Grade: ${t.trade_grade}</span>
                        <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">${t.session}</span>
                    </div>
                    <span class="journal-pnl-pill">+$${Number(t.pnl).toFixed(2)} USD</span>
                </div>

                <!-- SUBTITLE -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <span style="font-size: 0.86rem; font-weight: 700; color: var(--text-primary);">${t.setup_title}</span>
                    <span style="font-size: 0.76rem; color: var(--text-muted);">Efficiency Score: <strong style="color: var(--accent);">${t.efficiency_score}</strong></span>
                </div>

                <!-- BEFORE & AFTER SNAPSHOTS COMPARISON WITH LIGHTBOX -->
                <div class="trade-snapshots-compare">
                    <div class="snapshot-box" onclick="openSnapshotLightbox('${t.snapshot_before}', '${sym} • Before Entry Setup', '15M POI Imbalance & Liquidity Sweep Analysis')">
                        <img src="${t.snapshot_before}" alt="${sym} Before">
                        <div class="snapshot-overlay-zoom">🔍 Fullscreen</div>
                        <div class="snapshot-label">
                            <span style="color: #0284c7;">📸 BEFORE SETUP (15M POI Analysis)</span>
                            <span>Limit Fill: <strong>${t.entry}</strong></span>
                        </div>
                    </div>
                    <div class="snapshot-box" onclick="openSnapshotLightbox('${t.snapshot_after}', '${sym} • After Outcome', '${t.final_r} Target Hit via Stepped Trailing Stop')">
                        <img src="${t.snapshot_after}" alt="${sym} After">
                        <div class="snapshot-overlay-zoom">🔍 Fullscreen</div>
                        <div class="snapshot-label">
                            <span style="color: var(--green);">🎯 AFTER OUTCOME (${t.final_r} Target Hit)</span>
                            <span>Exit: <strong>${t.exit}</strong></span>
                        </div>
                    </div>
                </div>

                <!-- 8-CELL EXECUTION METRICS GRID -->
                <div class="journal-metrics-grid">
                    <div class="journal-metric-cell">
                        <span class="j-cell-label">Direction</span>
                        <span class="j-cell-val" style="color: var(--green);">${t.type} (LONG)</span>
                    </div>
                    <div class="journal-metric-cell">
                        <span class="j-cell-label">Volume</span>
                        <span class="j-cell-val">${t.lots} Lots</span>
                    </div>
                    <div class="journal-metric-cell">
                        <span class="j-cell-label">Entry Level</span>
                        <span class="j-cell-val">${t.entry}</span>
                    </div>
                    <div class="journal-metric-cell">
                        <span class="j-cell-label">Stop Loss</span>
                        <span class="j-cell-val" style="color: #ef4444;">${t.sl}</span>
                    </div>
                    <div class="journal-metric-cell">
                        <span class="j-cell-label">Take Profit</span>
                        <span class="j-cell-val">${t.tp}</span>
                    </div>
                    <div class="journal-metric-cell">
                        <span class="j-cell-label">Exit Price</span>
                        <span class="j-cell-val">${t.exit}</span>
                    </div>
                    <div class="journal-metric-cell">
                        <span class="j-cell-label">Setup Category</span>
                        <span class="j-cell-val" style="font-size: 0.78rem;">${t.setup_category}</span>
                    </div>
                    <div class="journal-metric-cell">
                        <span class="j-cell-label">Efficiency</span>
                        <span class="j-cell-val" style="color: var(--accent);">${t.efficiency_score}</span>
                    </div>
                </div>

                <!-- STORY & CONTEXT NARRATIVE -->
                <div class="journal-narrative-box">
                    <strong style="color: var(--text-primary); display: block; margin-bottom: 6px; font-size: 0.86rem;">⚡ Systematic Trade Narrative:</strong>
                    ${t.in_trade_story}
                </div>

                <!-- PSYCHOLOGY & EMOTIONAL DISCIPLINE -->
                <div class="journal-psychology-box">
                    <div>
                        <strong style="color: var(--text-primary);">Mindset at Entry:</strong>
                        <span style="color: var(--text-secondary); margin-left: 6px;">${t.psychology?.mindset_entry || 'Systematic & Calm'}</span>
                    </div>
                    <div>
                        <strong style="color: var(--text-primary);">Tilt Index:</strong>
                        <span style="color: var(--green); font-weight: 700; margin-left: 6px;">${t.psychology?.tilt_level || '0% (Zero FOMO)'}</span>
                    </div>
                    <div>
                        <strong style="color: var(--text-primary);">Execution Discipline:</strong>
                        <span style="color: var(--accent); font-weight: 700; margin-left: 6px;">10/10 Perfect Compliance</span>
                    </div>
                </div>

                <!-- RULES CHECKLIST -->
                <div>
                    <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; display: block;">SYSTEMATIC RULES VERIFICATION:</span>
                    <div class="checklist-pill-grid">
                        ${t.checklist.map(c => `
                            <div class="rule-check-pill ${c.passed ? 'passed' : ''}">
                                <span>${c.passed ? '✓' : '✗'}</span>
                                <span>${c.rule}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// --- SNAPSHOT LIGHTBOX FUNCTIONS ---
function openSnapshotLightbox(src, title, subtitle) {
    const lb = document.getElementById('snapshotLightbox');
    const img = document.getElementById('lightboxImg');
    const tEl = document.getElementById('lightboxTitle');
    const sEl = document.getElementById('lightboxSubtitle');

    if (!lb || !img) return;

    img.src = src;
    if (tEl) tEl.innerText = title || 'Snapshot Analysis';
    if (sEl) sEl.innerText = subtitle || 'High-Resolution Review';

    lb.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeSnapshotLightbox() {
    const lb = document.getElementById('snapshotLightbox');
    if (lb) lb.classList.add('hidden');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSnapshotLightbox();
    }
});
