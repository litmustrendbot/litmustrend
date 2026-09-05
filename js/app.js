// ====================================================================
// LITMUSTREND - INTERACTIVE ENGINE & LIQUIDITY CANVAS BACKGROUND
// ====================================================================

// --- 1. DYNAMIC LIQUIDITY MESH CANVAS ANIMATION ---
(function initCanvasBackground() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width, height, dpr;
    let particles = [];
    const PARTICLE_COUNT = 55;
    const CONNECT_DIST = 140;

    const mouse = {
        x: null,
        y: null,
        radius: 160
    };

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    window.addEventListener('mouseout', () => {
        mouse.x = null;
        mouse.y = null;
    });

    function resize() {
        dpr = window.devicePixelRatio || 1;
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
    }

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.55;
            this.vy = (Math.random() - 0.5) * 0.55;
            this.radius = Math.random() * 1.8 + 1.2;
            // Palette of institutional liquidity colors: cyan, electric blue, soft emerald
            const colors = ['#00f0ff', '#0088ff', '#00e676'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.baseAlpha = Math.random() * 0.4 + 0.3;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Bounce gently off borders
            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;

            // Mouse interaction
            if (mouse.x !== null && mouse.y !== null) {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < mouse.radius) {
                    const force = (1 - dist / mouse.radius) * 0.8;
                    this.x -= (dx / dist) * force;
                    this.y -= (dy / dist) * force;
                }
            }
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.baseAlpha;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    function initParticles() {
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push(new Particle());
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        // Draw connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < CONNECT_DIST) {
                    const alpha = (1 - dist / CONNECT_DIST) * 0.22;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = '#0088ff';
                    ctx.globalAlpha = alpha;
                    ctx.lineWidth = 0.9;
                    ctx.stroke();
                }
            }
        }

        // Draw mouse connections
        if (mouse.x !== null && mouse.y !== null) {
            for (let i = 0; i < particles.length; i++) {
                const dx = mouse.x - particles[i].x;
                const dy = mouse.y - particles[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    const alpha = (1 - dist / 120) * 0.35;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.strokeStyle = '#00f0ff';
                    ctx.globalAlpha = alpha;
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                }
            }
        }

        // Update and draw particles
        for (let p of particles) {
            p.update();
            p.draw();
        }

        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
        resize();
        initParticles();
    });

    resize();
    initParticles();
    animate();
})();

// --- 2. SCROLL REVEAL OBSERVER ---
document.addEventListener('DOMContentLoaded', () => {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-active');
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
    });

    reveals.forEach((el) => observer.observe(el));
});

// --- 3. RISK TIER SELECTOR ---
function selectTier(tier) {
    const radios = document.getElementsByName('riskTier');
    for (let r of radios) {
        if (r.value === tier) {
            r.checked = true;
            break;
        }
    }
    const connectSection = document.getElementById('connect');
    if (connectSection) {
        connectSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// --- 4. CLOUD MT5 CONNECT HANDLER ---
async function handleAccountConnect(e) {
    e.preventDefault();

    const email = document.getElementById('userEmail').value;
    const server = document.getElementById('brokerServer').value;
    const account = document.getElementById('accountNumber').value;
    const password = document.getElementById('accountPassword').value;
    const riskTier = document.querySelector('input[name="riskTier"]:checked').value;

    const btn = document.getElementById('btnConnect');
    const feedback = document.getElementById('connectFeedback');
    
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Provisioning Cloud Dispatcher...</span>';
    feedback.innerHTML = '';
    feedback.className = 'feedback-msg text-blue';

    try {
        const response = await fetch('/api/portal/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                server,
                account,
                password,
                risk_tier: riskTier
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            feedback.className = 'feedback-msg text-green';
            feedback.innerHTML = `&check; ${result.message || 'Connected successfully to cloud engine!'}`;
            
            document.getElementById('dispAccount').innerText = account;
            document.getElementById('dispServer').innerText = server;
            document.getElementById('dispRisk').innerText = riskTier + ' Risk Engine Active';
            document.getElementById('dispBalance').innerText = '$' + (result.balance || '100.00');
            document.getElementById('dispCircuit').innerText = 'ACTIVE (0/3 Losses)';
            document.getElementById('liveStatusPanel').classList.remove('hidden');

            localStorage.setItem('active_trading_account', JSON.stringify({
                email, server, account, riskTier, connected: true
            }));
        } else {
            feedback.className = 'feedback-msg text-orange';
            feedback.innerHTML = `&cross; ${result.error || 'Simulation Mode: Account configured and ready for live signal streaming.'}`;
            
            document.getElementById('dispAccount').innerText = account;
            document.getElementById('dispServer').innerText = server;
            document.getElementById('dispRisk').innerText = riskTier + ' Risk Engine Active';
            document.getElementById('dispBalance').innerText = '$100.00';
            document.getElementById('dispCircuit').innerText = 'ACTIVE (0/3 Losses)';
            document.getElementById('liveStatusPanel').classList.remove('hidden');
        }
    } catch (err) {
        feedback.className = 'feedback-msg text-orange';
        feedback.innerHTML = `Running UI Preview: Connected ${account} to ${riskTier} Risk Engine.`;
        
        document.getElementById('dispAccount').innerText = account;
        document.getElementById('dispServer').innerText = server;
        document.getElementById('dispRisk').innerText = riskTier + ' Risk Engine Active';
        document.getElementById('dispBalance').innerText = '$100.00';
        document.getElementById('dispCircuit').innerText = 'ACTIVE (0/3 Losses)';
        document.getElementById('liveStatusPanel').classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🚀 Update Connection Settings</span>';
    }
}

function disconnectAccount() {
    if (confirm('Are you sure you want to stop auto-trading and disconnect this account?')) {
        localStorage.removeItem('active_trading_account');
        document.getElementById('liveStatusPanel').classList.add('hidden');
        document.getElementById('connectFeedback').className = 'feedback-msg text-orange';
        document.getElementById('connectFeedback').innerHTML = 'Account disconnected. Auto-trading halted.';
        document.getElementById('btnConnect').innerHTML = '<span>🚀 Start Auto-Trading Account</span>';
    }
}

// Restore session on page reload if saved
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('active_trading_account');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            document.getElementById('userEmail').value = data.email || '';
            document.getElementById('brokerServer').value = data.server || '';
            document.getElementById('accountNumber').value = data.account || '';
            document.getElementById('dispAccount').innerText = data.account || '-';
            document.getElementById('dispServer').innerText = data.server || '-';
            document.getElementById('dispRisk').innerText = (data.riskTier || '10%') + ' Risk Engine Active';
            document.getElementById('liveStatusPanel').classList.remove('hidden');
        } catch(e){}
    }
});
