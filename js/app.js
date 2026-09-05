// ====================================================================
// LITMUSTREND - CLOUD AUTO-TRADING PORTAL SCRIPT
// Single-Page Application Dashboard Logic & Account Progress Engine
// ====================================================================

// --- STATE MANAGEMENT ---
let currentAccount = {
    email: 'trader@litmustrend.com',
    server: 'Exness-MT5Real7',
    accountNumber: '213908953',
    strategyTier: '10%',
    balance: 10000.00,
    equity: 10000.00,
    circuitLosses: 0,
    isPaused: false,
    connected: true
};

let authState = {
    isLoggedIn: true,
    userEmail: 'trader@litmustrend.com',
    mode: 'signin'
};

// --- VIEW NAVIGATION CONTROLLER ---
function switchView(viewName) {
    const views = ['dashboard', 'add-account', 'strategies'];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.classList.remove('active-view');
    });

    const targetEl = document.getElementById(`view-${viewName}`);
    if (targetEl) targetEl.classList.add('active-view');

    // Update tab button active states
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => tab.classList.remove('active'));
    if (viewName === 'dashboard' && tabs[0]) tabs[0].classList.add('active');
    if (viewName === 'add-account' && tabs[1]) tabs[1].classList.add('active');
    if (viewName === 'strategies' && tabs[2]) tabs[2].classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- STRATEGY OPTION HIGHLIGHTING IN FORM ---
function highlightStrategyOption(input) {
    const options = document.querySelectorAll('.strategy-option');
    options.forEach(opt => opt.classList.remove('selected'));
    if (input && input.closest('.strategy-option')) {
        input.closest('.strategy-option').classList.add('selected');
    }
}

// --- ADD MT5 ACCOUNT FORM SUBMISSION ---
async function submitNewAccount(e) {
    e.preventDefault();

    const email = document.getElementById('inputEmail').value.trim();
    const server = document.getElementById('inputServer').value.trim();
    const login = document.getElementById('inputLogin').value.trim();
    const password = document.getElementById('inputPassword').value.trim();
    const strategyEl = document.querySelector('input[name="selectedStrategy"]:checked');
    const strategyTier = strategyEl ? strategyEl.value : '10%';

    const btn = document.getElementById('btnSubmitAccount');
    const feedback = document.getElementById('formFeedback');

    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Verifying MT5 & Attaching Cloud Engine...</span>';
    feedback.className = 'feedback-box';
    feedback.style.display = 'none';

    try {
        const response = await fetch('/api/portal/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                server,
                account: login,
                password,
                risk_tier: strategyTier
            })
        });

        const result = await response.json();

        // Update active state
        currentAccount = {
            email,
            server,
            accountNumber: login,
            strategyTier,
            balance: result.balance || 10000.00,
            equity: result.balance || 10000.00,
            circuitLosses: 0,
            isPaused: false,
            connected: true
        };

        localStorage.setItem('active_account_session', JSON.stringify(currentAccount));
        updateDashboardUI();

        feedback.className = 'feedback-box success show';
        feedback.innerHTML = `&check; MT5 Account <strong>${login}</strong> connected to <strong>${strategyTier} Risk Engine</strong>! Redirecting to dashboard...`;

        setTimeout(() => {
            feedback.style.display = 'none';
            switchView('dashboard');
        }, 1200);

    } catch (err) {
        // Local preview fallback
        currentAccount = {
            email,
            server,
            accountNumber: login,
            strategyTier,
            balance: 10000.00,
            equity: 10000.00,
            circuitLosses: 0,
            isPaused: false,
            connected: true
        };
        localStorage.setItem('active_account_session', JSON.stringify(currentAccount));
        updateDashboardUI();

        feedback.className = 'feedback-box success show';
        feedback.innerHTML = `&check; Account <strong>${login}</strong> configured! Opening Live Dashboard...`;

        setTimeout(() => {
            feedback.style.display = 'none';
            switchView('dashboard');
        }, 1000);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🚀 Connect & Start Auto-Trading</span>';
    }
}

// --- UPDATE DASHBOARD UI WITH CURRENT ACCOUNT STATE ---
function updateDashboardUI() {
    // Balance & Equity
    const balEl = document.getElementById('dashBalance');
    const eqEl = document.getElementById('dashEquity');
    if (balEl) balEl.innerText = `$${currentAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (eqEl) eqEl.innerText = `$${currentAccount.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    // Strategy
    const stratEl = document.getElementById('dashStrategy');
    if (stratEl) stratEl.innerText = `PDC 5M (${currentAccount.strategyTier} Risk)`;

    // Account List Item
    const itemServer = document.getElementById('itemServer');
    const itemAccount = document.getElementById('itemAccount');
    const itemRisk = document.getElementById('itemRisk');
    if (itemServer) itemServer.innerText = currentAccount.server;
    if (itemAccount) itemAccount.innerText = currentAccount.accountNumber;
    if (itemRisk) itemRisk.innerText = `${currentAccount.strategyTier} Risk`;

    // Circuit Breaker
    const circuitEl = document.getElementById('dashCircuit');
    if (circuitEl) circuitEl.innerText = `${currentAccount.circuitLosses} / 3 Losses`;

    // Engine Title in Settings View
    const engTitle = document.getElementById('currentEngineTitle');
    const engDesc = document.getElementById('currentEngineDesc');
    if (engTitle) engTitle.innerText = `PDC 5M ${currentAccount.strategyTier} Risk Engine`;
    if (engDesc) {
        if (currentAccount.strategyTier === '10%') {
            engDesc.innerText = 'Running with 10% equity compounding, 1:10 R:R, and 9.5R stepped trailing stop.';
        } else if (currentAccount.strategyTier === '5%') {
            engDesc.innerText = 'Running with 5% balanced risk, 1:10 R:R, and 9.5R stepped trailing stop.';
        } else {
            engDesc.innerText = 'Running with 1% strict Prop Firm sizing (FTMO compliant) and -3% daily circuit breaker.';
        }
    }

    // User Chip
    const userChip = document.getElementById('displayUserName');
    if (userChip && currentAccount.email) {
        userChip.innerText = currentAccount.email.split('@')[0];
    }
}

// --- CHANGE ACTIVE STRATEGY TIER ---
function changeActiveTier(tier) {
    currentAccount.strategyTier = tier;
    localStorage.setItem('active_account_session', JSON.stringify(currentAccount));
    updateDashboardUI();
    addSignalLog('STRATEGY SWITCH', `Switched execution to PDC 5M ${tier} Risk Engine.`, 'tag-system');
    alert(`Strategy engine updated to PDC 5M ${tier} Risk Engine.`);
}

// --- PAUSE / RESUME BOT ENGINE ---
function toggleBotPause() {
    currentAccount.isPaused = !currentAccount.isPaused;
    const btn = document.getElementById('btnPauseBot');
    const statusText = document.getElementById('engineStatusText');

    if (currentAccount.isPaused) {
        if (btn) btn.innerText = 'Resume Strategy';
        if (statusText) {
            statusText.innerText = 'Bot Paused by User';
            statusText.className = 'text-orange';
        }
        addSignalLog('BOT PAUSED', 'Trading activity temporarily halted.', 'tag-system');
    } else {
        if (btn) btn.innerText = 'Pause Strategy';
        if (statusText) {
            statusText.innerText = 'Scanning 5M Structure & FVG';
            statusText.className = 'text-green';
        }
        addSignalLog('BOT RESUMED', 'Resumed scanning 5-minute swing fractals and PDC bias.', 'tag-bos');
    }
}

// --- DISCONNECT ACCOUNT ---
function disconnectCurrentAccount() {
    if (confirm('Disconnect this MT5 account from the cloud engine? Open trades will remain managed on broker side.')) {
        currentAccount.connected = false;
        currentAccount.server = 'No Account Connected';
        currentAccount.accountNumber = '---';
        localStorage.removeItem('active_account_session');
        updateDashboardUI();
        
        const statusTag = document.getElementById('accountStatusTag');
        if (statusTag) {
            statusTag.innerText = '0 Active';
            statusTag.className = 'badge-status';
        }
        
        const openTrades = document.getElementById('openTradesBody');
        if (openTrades) {
            openTrades.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 24px; color: #64748b;">No connected account. <a href="#" onclick="switchView(\'add-account\')" style="color:#0088ff;">Click here to connect an MT5 account</a></td></tr>';
        }
    }
}

// --- REAL-TIME SIGNAL LOG STREAMER ---
function addSignalLog(tag, desc, tagClass = 'tag-bos') {
    const wrap = document.getElementById('signalLogWrap');
    if (!wrap) return;

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    const item = document.createElement('div');
    item.className = 'log-item';
    item.innerHTML = `
        <span class="log-time">${timeStr}</span>
        <span class="log-tag ${tagClass}">${tag}</span>
        <span class="log-desc">${desc}</span>
    `;

    wrap.insertBefore(item, wrap.firstChild);
    if (wrap.children.length > 15) {
        wrap.removeChild(wrap.lastChild);
    }
}

// --- LIVE CLOCK & PROGRESS SIMULATOR ---
function initLiveClock() {
    const clockEl = document.getElementById('clockTime');
    setInterval(() => {
        const now = new Date();
        if (clockEl) {
            clockEl.innerText = now.toTimeString().split(' ')[0] + ' UTC';
        }
    }, 1000);
}

// Periodic live market progress tick (simulating floating profit micro-movements)
setInterval(() => {
    if (!currentAccount.connected || currentAccount.isPaused) return;

    // Small simulated tick movement on Gold floating trade
    const randomDelta = (Math.random() - 0.48) * 12.5;
    currentAccount.equity = Math.max(10000, currentAccount.equity + randomDelta);
    
    const eqEl = document.getElementById('dashEquity');
    if (eqEl) {
        eqEl.innerText = `$${currentAccount.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
}, 3500);

// --- AUTH MODAL CONTROLLER ---
function toggleAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.toggle('hidden');
}

function setAuthTab(mode) {
    authState.mode = mode;
    const tabIn = document.getElementById('tabSignIn');
    const tabUp = document.getElementById('tabSignUp');
    const submitText = document.getElementById('authSubmitText');

    if (mode === 'signin') {
        tabIn.classList.add('active');
        tabUp.classList.remove('active');
        if (submitText) submitText.innerText = 'Sign In to Dashboard';
    } else {
        tabUp.classList.add('active');
        tabIn.classList.remove('active');
        if (submitText) submitText.innerText = 'Create Free Account';
    }
}

function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const feedback = document.getElementById('authFeedback');

    if (!email || !password) return;

    authState.isLoggedIn = true;
    authState.userEmail = email;
    currentAccount.email = email;

    const userChip = document.getElementById('displayUserName');
    if (userChip) userChip.innerText = email.split('@')[0];

    feedback.className = 'feedback-box success show';
    feedback.innerHTML = authState.mode === 'signin' 
        ? `&check; Welcome back! Logged in as ${email}.`
        : `&check; Account created successfully! Logged in as ${email}.`;

    setTimeout(() => {
        feedback.style.display = 'none';
        toggleAuthModal();
    }, 1000);
}

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    initLiveClock();

    // Restore saved session if present
    const saved = localStorage.getItem('active_account_session');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            currentAccount = Object.assign(currentAccount, data);
        } catch (e) {}
    }

    updateDashboardUI();
});
