// ====================================================================
// LITMUSTREND BOT - SPLIT WORKSPACE ENGINE
// Left Accounts Sidebar + Large Trade Analysis Viewport
// ====================================================================

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

    // Select the first account by default if available
    if (accounts.length > 0 && !selectedAccountId) {
        selectAccount(accounts[0].id);
    } else if (selectedAccountId) {
        selectAccount(selectedAccountId);
    } else {
        showEmptyAnalysis();
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

        const tradeCount = acc.trades ? acc.trades.length : 0;

        item.innerHTML = `
            <div class="item-top">
                <span class="item-name">${escapeHtml(acc.name)}</span>
                <span class="item-trades-badge">${tradeCount} trades</span>
            </div>
            <div class="item-sub">
                <span>${escapeHtml(acc.strategy)}</span>
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

    // Show active analysis content
    document.getElementById('emptyAnalysis').classList.add('hidden');
    document.getElementById('activeAnalysis').classList.remove('hidden');

    // Populate header
    document.getElementById('viewAccName').innerText = acc.name;
    document.getElementById('viewStrategyText').innerText = acc.strategy;
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
    document.getElementById('emptyAnalysis').classList.remove('hidden');
    document.getElementById('activeAnalysis').classList.add('hidden');
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
        const isExpanded = expandedBrokerName === broker.name || (q.length > 1 && broker.name.toLowerCase().includes(q));
        const group = document.createElement('div');
        group.className = 'broker-group';

        group.innerHTML = `
            <div class="broker-group-header" onclick="toggleBrokerExpand('${escapeHtml(broker.name)}')">
                <span>🏦 ${escapeHtml(broker.name)}</span>
                <span class="broker-server-count">${broker.servers.length} server${broker.servers.length === 1 ? '' : 's'} ${isExpanded ? '▲' : '▼'}</span>
            </div>
            <div class="broker-servers-list ${isExpanded ? '' : 'hidden'}" id="servers-${escapeHtml(broker.name)}">
                ${broker.servers.map(srv => {
                    const tag = getServerTag(srv);
                    return `
                    <div class="server-item" onclick="selectBrokerServer('${escapeHtml(srv)}')">
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

function toggleBrokerExpand(brokerName) {
    expandedBrokerName = (expandedBrokerName === brokerName) ? null : brokerName;
    const input = document.getElementById('brokerSearchInput');
    renderBrokerDropdown(input.value || '', currentBrokersList);
}

function selectBrokerServer(serverName) {
    document.getElementById('accServer').value = serverName;
    document.getElementById('selectedServerName').innerText = serverName;
    
    // Hide search input & dropdown
    document.getElementById('brokerSearchInput').classList.add('hidden');
    document.getElementById('brokerSearchResults').classList.add('hidden');
    document.getElementById('selectedServerDisplay').classList.remove('hidden');
}

function clearSelectedServer() {
    document.getElementById('accServer').value = '';
    document.getElementById('selectedServerName').innerText = '';
    document.getElementById('selectedServerDisplay').classList.add('hidden');
    
    const searchInput = document.getElementById('brokerSearchInput');
    searchInput.classList.remove('hidden');
    searchInput.value = '';
    searchInput.focus();
    handleBrokerSearch('');
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
}

// Close broker dropdown when clicking outside
document.addEventListener('click', (e) => {
    const wrap = document.getElementById('brokerSearchMode');
    const dropdown = document.getElementById('brokerSearchResults');
    if (wrap && dropdown && !wrap.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// --- 7. ADD ACCOUNT MODAL ---
function openAddAccountModal() {
    document.getElementById('addAccountModal').classList.remove('hidden');
    document.getElementById('accModalError').innerText = '';
    clearSelectedServer();
    document.getElementById('accName').focus();
}

function closeAddAccountModal() {
    document.getElementById('addAccountModal').classList.add('hidden');
    document.getElementById('addAccountForm').reset();
    document.getElementById('accModalError').innerText = '';
    clearSelectedServer();
}

async function handleCreateAccount(e) {
    e.preventDefault();

    const name = document.getElementById('accName').value.trim();
    const strategy = document.getElementById('accStrategy').value;
    const server = document.getElementById('accServer').value.trim();
    const login = document.getElementById('accLogin').value.trim();
    const password = document.getElementById('accPassword').value.trim();
    const btn = document.getElementById('btnSaveAcc');
    const errEl = document.getElementById('accModalError');

    if (!name || !server || !login || !password) return;

    btn.disabled = true;
    btn.innerText = 'Verifying with MT5 Broker...';
    errEl.innerText = '';

    try {
        const response = await fetch('/api/portal/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account_name: name,
                strategy,
                server,
                account: login,
                password
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
                isPaused: false,
                activeTrade: null,
                trades: []
            };

            accounts.push(newAcc);
            saveAccounts();
            closeAddAccountModal();

            // Select the new account immediately
            selectAccount(newAcc.id);
        } else {
            errEl.innerText = data.error || 'Authentication Failed: Broker rejected credentials. Please check your MT5 server and login.';
        }
    } catch (err) {
        errEl.innerText = 'Verification service error. Unable to reach broker gateway.';
    } finally {
        btn.disabled = false;
        btn.innerText = 'Add Account & Start Bot';
    }
}

// --- UTILITIES ---
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- INIT ---
window.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('litmus_auth_token')) {
        unlockPortal();
    } else {
        document.getElementById('passcodeScreen').classList.add('active-screen');
        document.getElementById('dashboardScreen').classList.remove('active-screen');
    }
});
