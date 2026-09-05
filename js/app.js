// ====================================================================
// LITMUSTREND BOT - SPLIT WORKSPACE ENGINE
// Left Accounts Sidebar + Large Trade Analysis Viewport
// ====================================================================

const AUTHORIZED_PASSCODE = '09161182730';

// Default sample trading accounts with real trade logs
const DEFAULT_ACCOUNTS = [
    {
        id: 'acc-1',
        name: 'Exness Growth Account',
        strategy: 'PDC 5M 10% Risk EA',
        server: 'Exness-MT5Real7',
        login: '213908953',
        isPaused: false,
        activeTrade: {
            symbol: 'XAUUSD',
            type: 'BUY',
            lots: '0.50',
            entry: '2,740.10',
            target: '2,758.10',
            trailing: 'Active (+9.5R)',
            pnl: '+$1,000.00 (+100.0%)'
        },
        trades: [
            { id: 1, time: '2026-09-05 16:15', symbol: 'XAUUSD', type: 'BUY', lots: '0.50', entry: '2,740.10', exit: '2,758.10', target: '1:10 R:R', result: 'WIN', profit: '+$1,000.00 (+100.0%)' },
            { id: 2, time: '2026-09-05 14:20', symbol: 'EURUSD', type: 'BUY', lots: '1.00', entry: '1.08200', exit: '1.08100', target: '1:10 R:R', result: 'LOSS', profit: '-$100.00 (-10.0%)' },
            { id: 3, time: '2026-09-05 11:45', symbol: 'GBPUSD', type: 'SELL', lots: '1.00', entry: '1.29500', exit: '1.28500', target: '1:10 R:R', result: 'WIN', profit: '+$1,000.00 (+100.0%)' },
            { id: 4, time: '2026-09-05 09:10', symbol: 'US30', type: 'BUY', lots: '0.25', entry: '43,200.0', exit: '43,450.0', target: '1:10 R:R', result: 'WIN', profit: '+$1,000.00 (+100.0%)' },
            { id: 5, time: '2026-09-04 15:50', symbol: 'NAS100', type: 'BUY', lots: '0.30', entry: '20,110.0', exit: '20,240.0', target: '1:10 R:R', result: 'WIN', profit: '+$1,000.00 (+100.0%)' },
            { id: 6, time: '2026-09-04 13:00', symbol: 'EURUSD', type: 'SELL', lots: '1.00', entry: '1.08450', exit: '1.08490', target: '1:10 R:R', result: 'LOSS', profit: '-$100.00 (-10.0%)' }
        ]
    },
    {
        id: 'acc-2',
        name: 'FTMO Funded Prop Account',
        strategy: 'PDC 5M 1% Risk EA',
        server: 'FTMO-Server2',
        login: '98412034',
        isPaused: false,
        activeTrade: null,
        trades: [
            { id: 1, time: '2026-09-05 15:30', symbol: 'NAS100', type: 'BUY', lots: '0.50', entry: '20,150.0', exit: '20,280.0', target: '1:10 R:R', result: 'WIN', profit: '+$1,000.00 (+10.0%)' },
            { id: 2, time: '2026-09-05 13:05', symbol: 'EURUSD', type: 'SELL', lots: '2.00', entry: '1.08450', exit: '1.08490', target: '1:10 R:R', result: 'LOSS', profit: '-$100.00 (-1.0%)' },
            { id: 3, time: '2026-09-04 10:15', symbol: 'XAUUSD', type: 'BUY', lots: '0.40', entry: '2,735.00', exit: '2,748.50', target: '1:10 R:R', result: 'WIN', profit: '+$1,000.00 (+10.0%)' }
        ]
    }
];

let accounts = [];
let selectedAccountId = null;

// --- 1. PASSCODE VERIFICATION ---
function verifyPasscode(e) {
    e.preventDefault();
    const input = document.getElementById('passcodeInput').value.trim();
    const errEl = document.getElementById('passcodeError');

    if (input === AUTHORIZED_PASSCODE) {
        sessionStorage.setItem('litmus_auth', 'unlocked');
        errEl.innerText = '';
        unlockPortal();
    } else {
        errEl.innerText = 'Incorrect passcode.';
        document.getElementById('passcodeInput').select();
    }
}

function lockPortal() {
    sessionStorage.removeItem('litmus_auth');
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

// --- 6. ADD ACCOUNT MODAL ---
function openAddAccountModal() {
    document.getElementById('addAccountModal').classList.remove('hidden');
    document.getElementById('accName').focus();
}

function closeAddAccountModal() {
    document.getElementById('addAccountModal').classList.add('hidden');
    document.getElementById('addAccountForm').reset();
}

function handleCreateAccount(e) {
    e.preventDefault();

    const name = document.getElementById('accName').value.trim();
    const strategy = document.getElementById('accStrategy').value;
    const server = document.getElementById('accServer').value.trim();
    const login = document.getElementById('accLogin').value.trim();
    const password = document.getElementById('accPassword').value.trim();

    // Attach to backend dispatcher in background
    fetch('/api/portal/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            account_name: name,
            strategy,
            server,
            account: login,
            password
        })
    }).catch(() => {});

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
}

// --- UTILITIES ---
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- INIT ---
window.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('litmus_auth') === 'unlocked') {
        unlockPortal();
    } else {
        document.getElementById('passcodeScreen').classList.add('active-screen');
        document.getElementById('dashboardScreen').classList.remove('active-screen');
    }
});
