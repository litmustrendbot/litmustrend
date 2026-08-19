// LitmusTrend Frontend Application JavaScript

// Modal Handlers
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modal when clicking outside of modal content
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Form Submission Handlers
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const refreshBtn = document.getElementById('refresh-trades-btn');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Login successful! Welcome back to LitmusTrend.');
            closeModal('loginModal');
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Account registered successfully! You can now connect your MT5 EA.');
            closeModal('registerModal');
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchLiveTrades);
    }
});

// Function to fetch live trades from Vercel API / Supabase
async function fetchLiveTrades() {
    const refreshBtn = document.getElementById('refresh-trades-btn');
    refreshBtn.innerText = 'Refreshing...';

    try {
        const response = await fetch('/api/ea/log-trade');
        if (response.ok) {
            const data = await response.json();
            console.log('Fetched trades:', data);
            // Render trades into table if available
        }
    } catch (err) {
        console.log('Notice: Currently using live sample data until API endpoint is live on Vercel.');
    } finally {
        setTimeout(() => {
            refreshBtn.innerText = 'Refresh Trades';
        }, 600);
    }
}
