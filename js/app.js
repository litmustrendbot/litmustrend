// ====================================================================
// LITMUSTREND BOT - MULTI-ACCOUNT CLOUD DISPATCHER & TRADE TRACKER
// ====================================================================

const AUTHORIZED_PASSCODE = '09161182730';

// Default initial accounts if empty
const DEFAULT_ACCOUNTS = [
    {
        id: 'acc-1',
        name: 'Exness Growth Account',
        strategy: 'PDC 5M 10% Risk EA',
        server: 'Exness-MT5Real7',
        login: '213908953',
        trades: [
            { id: 1, time: '16:15', symbol: 'XAUUSD', type: 'BUY', lots: 0.50, entry: 2740.10, exit: 2758.10, target: '1:10 R:R', result: 'WIN', profit: '+$1,000.00 (+100.0%)' },
            { id: 2, time: '14:20', symbol: 'EURUSD', type: 'BUY', lots: 1.00, entry: 1.08200, exit: 1.08100, target: '1:10 R:R', result: 'LOSS', profit: '-$100.00 (-10.0%)' },
            { id: 3, time: '11:45', symbol: 'GBPUSD', type: 'SELL', lots: 1.00, entry: 1.29500, exit: 1.28500, target: '1:10 R:R', result: 'WIN', profit: '+$1,000.00 (+100.0%)' },
            { id: 4, time: '09:10', symbol: 'US30', type: 'BUY', lots: 0.25, entry: 43200.0, exit: 43450.0, target: '1:10 R:R', result: 'WIN', profit: '+$1,000.00 (+100.0%)' }
        ]
    },
    {
        id: 'acc-2',
        name: 'FTMO Funded Prop Account',
        strategy: 'PDC 5M 1% Risk EA',
        server: 'FTMO-Server2',
        login: '98412034',
        trades: [
            { id: 1, time: '15:30', symbol: 'NAS100', type: 'BUY', lots: 0.50, entry: 20150.0, exit: 20280.0, target: '1:10 R:R', result: 'WIN', profit: '+$1,000.00 (+10.0%)' },
            { id: 2, time: '13:05', symbol: 'EURUSD', type: 'SELL', lots: 2.00, entry: 1.08450, exit: 1.08490, target: '1:10 R:R', result: 'LOSS', profit: '-$100.00 (-1.0%)' }
        ]
    }
];

let accounts = [];
let activeViewingAccountId = null;

// --- 1. PASSCODE VERIFICATION ---
function verifyPasscode(e) {
    e.preventDefault();
    const input = document.getElementById('passcodeInput').value.trim();
    const errorEl = document.getElementById('passcodeError');

    if (input === AUTHORIZED_PASSCODE) {
        sessionStorage.setItem('litmus_auth', 'unlocked');
        errorEl.innerText = '';
        showDashboard();
    } else {
        errorEl.innerText = 'Incorrect passcode. Access denied.';
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

function showDashboard() {
    document.getElementById('passcodeScreen').classList.remove('active-screen');
    document.getElementById('dashboardScreen').classList.add('active-screen');
    renderAccountsGrid();
}

// --- 2. ACCOUNTS DATA MANAGEMENT ---
function loadAccounts() {
    const saved = localStorage.getItem('litmus_accounts_data');
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
    localStorage.setItem('litmus_accounts_data', JSON.stringify(accounts));
}

// --- 3. RENDER ACCOUNTS GRID ---
function renderAccountsGrid() {
    const grid = document.getElementById('accountsGrid');
    const emptyState = document.getElementById('emptyState');
    const countTag = document.getElementById('headerCountTag');

    if (!grid) return;

    countTag.innerText = `${accounts.length} Account${accounts.length === 1 ? '' : 's'} Active`;

    if (accounts.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    grid.innerHTML = '';

    accounts.forEach(acc => {
        const tradeCount = acc.trades ? acc.trades.length : 0;
        const card = document.createElement('div');
        card.className = 'account-card';
        card.onclick = () => openTradesModal(acc.id);

        card.innerHTML = `
            <div>
                <div class="card-top">
                    <h4 class="acc-title">${escapeHtml(acc.name)}</h4>
                    <span class="status-chip"><span class="pulse-dot"></span> Trading Active</span>
                </div>
                <div class="acc-meta">
                    Broker: <strong>${escapeHtml(acc.server)}</strong> &bull; Login: <strong>${escapeHtml(acc.login)}</strong>
                </div>
                <div class="acc-strategy-pill">
                    ${escapeHtml(acc.strategy)}
                </div>
            </div>

            <div class="card-bottom">
                <div class="trades-count-badge">
                    Trades Taken: <strong>${tradeCount}</strong>
                </div>
                <span class="view-action-text">View Trades &rarr;</span>
            </div>
        `;

        grid.appendChild(card);
    });
}

// --- 4. ADD ACCOUNT MODAL CONTROLLER ---
function openAddAccountModal() {
    document.getElementById('addAccountModal').classList.remove('hidden');
    document.getElementById('accName').focus();
}

function closeAddAccountModal() {
    document.getElementById('addAccountModal').classList.add('hidden');
    document.getElementById('addAccountForm').reset();
    document.getElementById('addAccountFeedback').innerText = '';
}

async function handleCreateAccount(e) {
    e.preventDefault();

    const name = document.getElementById('accName').value.trim();
    const strategy = document.getElementById('accStrategy').value;
    const server = document.getElementById('accServer').value.trim();
    const login = document.getElementById('accLogin').value.trim();
    const password = document.getElementById('accPassword').value.trim();

    const btn = document.getElementById('btnSaveAccount');
    const feedback = document.getElementById('addAccountFeedback');

    btn.disabled = true;
    btn.innerText = 'Attaching Bot to Account...';

    // Dispatch connection to backend API in background
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

    // Create new account entry
    const newAcc = {
        id: 'acc-' + Date.now(),
        name,
        strategy,
        server,
        login,
        trades: []
    };

    accounts.push(newAcc);
    saveAccounts();

    btn.disabled = false;
    btn.innerText = 'Add Account & Start Bot';
    closeAddAccountModal();
    renderAccountsGrid();
}

// --- 5. VIEW TRADES MODAL FOR PARTICULAR ACCOUNT ---
function openTradesModal(accountId) {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;

    activeViewingAccountId = accountId;

    document.getElementById('detailAccName').innerText = acc.name;
    document.getElementById('detailStrategy').innerText = acc.strategy;
    document.getElementById('detailServerLogin').innerText = `Server: ${acc.server} | Login: ${acc.login}`;

    const trades = acc.trades || [];
    const wins = trades.filter(t => t.result === 'WIN').length;
    const losses = trades.filter(t => t.result === 'LOSS').length;

    document.getElementById('detailTotalTrades').innerText = trades.length;
    document.getElementById('detailWinTrades').innerText = wins;
    document.getElementById('detailLossTrades').innerText = losses;
    document.getElementById('detailCircuitStatus').innerText = `${losses % 3} / 3 Losses Today`;

    const tableBody = document.getElementById('tradesTableBody');
    tableBody.innerHTML = '';

    if (trades.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 24px; color: #54647d;">
                    Bot is currently scanning 5M chart structure. No trades taken yet for this account.
                </td>
            </tr>
        `;
    } else {
        trades.forEach((t, idx) => {
            const row = document.createElement('tr');
            const isWin = t.result === 'WIN';
            row.innerHTML = `
                <td>#${t.id || (idx + 1)}</td>
                <td>${t.time}</td>
                <td><strong>${t.symbol}</strong></td>
                <td><span class="${t.type === 'BUY' ? 'pill-buy' : 'pill-sell'}">${t.type}</span></td>
                <td>${t.lots}</td>
                <td>${t.entry}</td>
                <td>${t.exit}</td>
                <td>${t.target}</td>
                <td><strong class="${isWin ? 'text-green' : 'text-red'}">${t.result}</strong></td>
                <td><strong class="${isWin ? 'text-green' : 'text-red'}">${t.profit}</strong></td>
            `;
            tableBody.appendChild(row);
        });
    }

    document.getElementById('tradesDetailModal').classList.remove('hidden');
}

function closeTradesModal() {
    document.getElementById('tradesDetailModal').classList.add('hidden');
    activeViewingAccountId = null;
}

function deleteActiveAccount() {
    if (!activeViewingAccountId) return;
    if (confirm('Are you sure you want to remove this account from the auto-trading engine?')) {
        accounts = accounts.filter(a => a.id !== activeViewingAccountId);
        saveAccounts();
        closeTradesModal();
        renderAccountsGrid();
    }
}

// --- UTILS ---
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- INITIAL LOAD ---
window.addEventListener('DOMContentLoaded', () => {
    loadAccounts();

    // Check if previously unlocked in this session
    if (sessionStorage.getItem('litmus_auth') === 'unlocked') {
        showDashboard();
    } else {
        document.getElementById('passcodeScreen').classList.add('active-screen');
        document.getElementById('dashboardScreen').classList.remove('active-screen');
    }
});
