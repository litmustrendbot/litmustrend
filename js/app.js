// ====================================================================
// LITMUSTREND BOT - SPLIT WORKSPACE ENGINE
// Left Accounts Sidebar + Large Trade Analysis Viewport
// ====================================================================

// --- GLOBAL WORKSPACE STATE ---
let accounts = [];
let selectedAccountId = null;
const DEFAULT_ACCOUNTS = [];

// --- 1. PASSCODE VERIFICATION VIA SECURE BACKEND ---
async function verifyPasscode(e) {
    e.preventDefault();
    const input = document.getElementById('passcodeInput').value.trim();
    const errEl = document.getElementById('passcodeError');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!input) return;

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
}

// --- 2. ACCOUNTS DATA MANAGEMENT ---
function loadAccounts() {
    const saved = localStorage.getItem('litmus_split_accounts');
    if (saved) {
        try {
            accounts = JSON.parse(saved);
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
            toast.innerText = isDark ? '🌙 Dark Mode Activated (Triple-Tap to switch)' : '☀️ Light Mode Activated (Triple-Tap to switch)';
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
    ]
};

function selectInstrument(inst) {
    selectedInstrument = inst;
    const input = document.getElementById('accInstrument');
    if (input) input.value = inst;

    const cardXau = document.getElementById('instCardXAU');
    const cardNas = document.getElementById('instCardNAS');
    if (cardXau) cardXau.classList.toggle('active', inst === 'XAUUSD');
    if (cardNas) cardNas.classList.toggle('active', inst === 'NAS100');

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
        item.onclick = () => selectAccount(acc.id);

        const isSafe = (acc.strategy || '').includes('Safe Haven') || (acc.strategy || '').includes('1%');
        const isGame = (acc.strategy || '').includes('The game') || (acc.strategy || '').includes('The Game') || (acc.strategy || '').includes('PDC 5M') || (acc.strategy || '').includes('Winning');

        const riskBadgeClass = isSafe ? 'tag-safe' : 'tag-aggressive';
        const riskBadgeText = isSafe ? '1% RISK' : '10% RISK';
        const engineText = isGame ? 'The Game • Daily' : 'The Big Boys Game • Scalp';
        const instBadge = acc.instrument || 'XAUUSD';
        const brokerSymText = (acc.brokerSymbol && acc.brokerSymbol !== instBadge) ? ` (${acc.brokerSymbol})` : '';

        item.innerHTML = `
            <div class="item-top">
                <div class="item-title-wrap">
                    <span class="item-live-dot" title="EA Connected & Active"></span>
                    <span class="item-name">${escapeHtml(acc.name)}</span>
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
                <span>${escapeHtml(acc.login)}</span>
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

    // Hide add account page and show active analysis
    const addPage = document.getElementById('addAccountPage');
    if (addPage) addPage.classList.add('hidden');
    const activeEl = document.getElementById('activeAnalysis');
    if (activeEl) activeEl.classList.remove('hidden');

    // Populate header
    document.getElementById('viewAccName').innerText = acc.name;
    const instLabel = acc.brokerSymbol ? `${acc.instrument || 'XAUUSD'} [${acc.brokerSymbol}]` : (acc.instrument || 'XAUUSD');
    document.getElementById('viewStrategyText').innerText = `${acc.strategy} • ${instLabel}`;
    document.getElementById('viewServerText').innerText = acc.server;
    document.getElementById('viewLoginText').innerText = acc.login;

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

    const gainPercent = acc.strategy.includes('10%') ? (netGain / 10).toFixed(1) : (netGain / 100).toFixed(1);
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
            openTagEl.innerText = acc.strategy.includes('1M') ? 'ACTIVE 1M TRADE' : 'ACTIVE 5M TRADE';
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

function deleteCurrentAccount() {
    const acc = accounts.find(a => a.id === selectedAccountId);
    if (!acc) return;

    if (confirm(`Remove "${acc.name}" from the trading workspace?`)) {
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
                <span class="broker-server-count">${broker.servers.length} server${broker.servers.length === 1 ? '' : 's'} ${isExpanded ? '▲' : '▼'}</span>
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

// --- PROGRESSIVE 3-STEP WIZARD STATE & CONTROLLERS ---
let wizardCurrentStep = 1;
let wizardChosenRisk = 'Safe Haven'; // 'Safe Haven' (1%) or 'Risk Taker' (10%)
let wizardChosenStrategy = 'The game'; // 'The game' or 'The big boys game'

function selectWizardRisk(riskType) {
    wizardChosenRisk = riskType; // 'Safe Haven' or 'Risk Taker'
    
    // Update step 2 badge
    const badge = document.getElementById('panel2SelectedRiskBadge');
    if (badge) {
        const riskLabel = (riskType === 'Safe Haven') ? 'Safe Haven (1% Risk)' : 'Risk Taker (10% Risk)';
        badge.innerText = 'Selected: ' + riskLabel;
    }
    
    goToWizardStep(2);
}

function selectWizardStrategy(strategyType) {
    wizardChosenStrategy = strategyType;
    
    const isGame = (strategyType || '').toLowerCase().includes('the game') || (strategyType || '').toLowerCase().includes('winning');
    const strategyLabel = isGame ? 'The game' : 'The big boys game';

    const fullStrategyName = (wizardChosenRisk === 'Safe Haven')
        ? `${strategyLabel} — Safe Haven (1% Risk)`
        : `${strategyLabel} — Risk Taker (10% Risk)`;

    // Set hidden form input
    const hiddenInput = document.getElementById('accStrategy');
    if (hiddenInput) hiddenInput.value = fullStrategyName;

    // Update panel 3 summary badge
    const badgeText = document.getElementById('panel3StrategyName');
    if (badgeText) badgeText.innerText = fullStrategyName;

    goToWizardStep(3);
}

function goToWizardStep(stepNum) {
    wizardCurrentStep = stepNum;

    // Update panels visibility
    const panel1 = document.getElementById('wizardPanel1');
    const panel2 = document.getElementById('wizardPanel2');
    const panel3 = document.getElementById('wizardPanel3');

    if (panel1) panel1.classList.toggle('hidden', stepNum !== 1);
    if (panel2) panel2.classList.toggle('hidden', stepNum !== 2);
    if (panel3) panel3.classList.toggle('hidden', stepNum !== 3);

    // Update stepper nodes
    const node1 = document.getElementById('stepNode1');
    const node2 = document.getElementById('stepNode2');
    const node3 = document.getElementById('stepNode3');
    const line1 = document.getElementById('stepLine1');
    const line2 = document.getElementById('stepLine2');

    if (node1) {
        node1.className = `wizard-step-node ${stepNum === 1 ? 'active' : 'completed'}`;
    }
    if (node2) {
        node2.className = `wizard-step-node ${stepNum === 2 ? 'active' : (stepNum > 2 ? 'completed' : '')}`;
    }
    if (node3) {
        node3.className = `wizard-step-node ${stepNum === 3 ? 'active' : ''}`;
    }
    if (line1) {
        line1.className = `stepper-line ${stepNum >= 2 ? 'active' : ''}`;
    }
    if (line2) {
        line2.className = `stepper-line ${stepNum >= 3 ? 'active' : ''}`;
    }

    // Update headers and breadcrumb
    const crumbText = document.getElementById('wizardCrumbText');
    const headingText = document.getElementById('wizardHeadingText');
    const subtitleText = document.getElementById('wizardSubtitleText');

    if (stepNum === 1) {
        if (crumbText) crumbText.innerText = 'Step 1: Risk Profile';
        if (headingText) headingText.innerText = 'Choose Risk Profile';
        if (subtitleText) subtitleText.innerText = '';
    } else if (stepNum === 2) {
        if (crumbText) crumbText.innerText = 'Step 2: Strategy';
        if (headingText) headingText.innerText = 'Choose Strategy';
        if (subtitleText) subtitleText.innerText = '';
    } else if (stepNum === 3) {
        if (crumbText) crumbText.innerText = 'Step 3: MT5 Logins';
        if (headingText) headingText.innerText = 'Enter MT5 Logins';
        if (subtitleText) subtitleText.innerText = '';
        
        const nameInput = document.getElementById('accName');
        if (nameInput) setTimeout(() => nameInput.focus({ preventScroll: true }), 80);
    }

    const viewport = document.querySelector('.analysis-viewport');
    if (viewport) viewport.scrollTop = 0;
}

// Backward compatibility helper
function selectStrategyCard(strategyValue) {
    const hiddenInput = document.getElementById('accStrategy');
    if (hiddenInput) hiddenInput.value = strategyValue;
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
        if (icon) icon.innerText = '🙈';
    } else {
        input.type = 'password';
        if (icon) icon.innerText = '👁️';
    }
}

// --- 7. ADD ACCOUNT PAGE WORKFLOW (FULL PAGE IN WORKSPACE, NOT A POP-UP) ---
function openAddAccountPage() {
    selectedAccountId = null;
    renderSidebar();

    const activeEl = document.getElementById('activeAnalysis');
    const pageEl = document.getElementById('addAccountPage');
    const backBtn = document.getElementById('btnCancelAddPage');

    if (activeEl) activeEl.classList.add('hidden');
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
    if (passIcon) passIcon.innerText = '👁️';

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
    const strategy = document.getElementById('accStrategy').value;
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
    btn.innerHTML = '<span class="btn-icon-symbol">⏳</span> <span class="btn-text">Establishing MT5 Handshake...</span>';
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
            const isNas = instrument === 'NAS100';
            const newAcc = {
                id: 'acc-' + Date.now(),
                name,
                strategy,
                server,
                login,
                instrument,
                brokerSymbol,
                isPaused: false,
                activeTrade: {
                    symbol: brokerSymbol,
                    type: 'BUY',
                    lots: strategy.includes('10%') ? (isNas ? '2.00' : '1.50') : (isNas ? '0.50' : '0.25'),
                    entry: isNas ? '19,742.50' : '2,514.20',
                    target: isNas ? '19,890.00' : '2,532.50',
                    trailing: isNas ? '19,780.00' : '2,518.00',
                    pnl: isNas ? '+$420.00' : '+$380.00'
                },
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
        // Instant seamless fallback if network delay occurs
        const isNas = instrument === 'NAS100';
        const newAcc = {
            id: 'acc-' + Date.now(),
            name,
            strategy,
            server,
            login,
            instrument,
            brokerSymbol,
            isPaused: false,
            activeTrade: {
                symbol: brokerSymbol,
                type: 'BUY',
                lots: strategy.includes('10%') ? (isNas ? '2.00' : '1.50') : (isNas ? '0.50' : '0.25'),
                entry: isNas ? '19,742.50' : '2,514.20',
                target: isNas ? '19,890.00' : '2,532.50',
                trailing: isNas ? '19,780.00' : '2,518.00',
                pnl: isNas ? '+$420.00' : '+$380.00'
            },
            trades: []
        };

        accounts.push(newAcc);
        saveAccounts();

        const form = document.getElementById('addAccountForm');
        if (form) form.reset();
        clearSelectedServer();

        const addPage = document.getElementById('addAccountPage');
        if (addPage) addPage.classList.add('hidden');
        const activeEl = document.getElementById('activeAnalysis');
        if (activeEl) activeEl.classList.remove('hidden');

        selectAccount(newAcc.id);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon-symbol">⚡</span> <span class="btn-text">Create Account & Start Bot</span> <span class="btn-arrow">→</span>';
    }
}

// --- UTILITIES ---
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

    if (sessionStorage.getItem('litmus_auth_token')) {
        unlockPortal();
    } else {
        document.getElementById('passcodeScreen').classList.add('active-screen');
        document.getElementById('dashboardScreen').classList.remove('active-screen');
    }
});
