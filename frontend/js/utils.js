function $(id) { return document.getElementById(id); }

function show(id) { $(id).classList.remove('hidden'); }

function hide(id) { $(id).classList.add('hidden'); }

function scoreColor(score) {
    if (score >= 80) return 'text-neon-green';
    if (score >= 60) return 'text-neon-yellow';
    return 'text-neon-red';
}

function scoreBarColor(score) {
    if (score >= 80) return 'bg-neon-green';
    if (score >= 60) return 'bg-neon-yellow';
    return 'bg-neon-red';
}

function formatDate() {
    return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function truncate(str, n) {
    if (n === undefined) n = 100;
    if (!str) return '';
    return str.length > n ? str.slice(0, n) + '...' : str;
}

function debounce(fn, ms) {
    if (ms === undefined) ms = 100;
    var timer;
    return function() {
        var ctx = this, args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
    };
}

/* Scroll reveal using IntersectionObserver */
function initScrollReveal() {
    var els = document.querySelectorAll('.reveal, .reveal-fade, .reveal-scale, .reveal-stagger');
    if (!els.length) return;
    var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function(el) { obs.observe(el); });
}

/* Mobile menu toggle */
function toggleMobileMenu() {
    var uploadArea = $('uploadArea');
    if (uploadArea) {
        uploadArea.scrollIntoView({ behavior: 'smooth' });
    }
}

/* Load sample text into paste area */
function loadSample(level) {
    var samples = {
        weak: '# Weak Hackathon Project\n\n## Project: "Todo App with AI"\n\nA simple to-do list app that uses a random quote API to "motivate" users. No authentication, no database, no tests. Just HTML + a Python Flask backend that returns random quotes. The AI feature is just calling an API and displaying the result. No user research, no accessibility, no deployment.\n\nClaims:\n- "Built with AI" — it calls a quotes API\n- "Full-stack" — Flask + HTML\n- "Production-ready" — it runs locally\n\nFeatures:\n- Add/delete todos\n- Random motivational quote on page load\n- Basic CSS styling',
        medium: '# Medium Hackathon Project\n\n## Project: "DevMetrics Dashboard"\n\nA developer productivity dashboard that integrates with GitHub API to track commits, PRs, and issues across a team. Built with React frontend + FastAPI backend. Has basic auth, stores data in SQLite, and renders charts with Chart.js. Some tests exist but coverage is low. No CI/CD, deployed manually.\n\nClaims:\n- "Real-time team analytics"\n- "Integrates with GitHub"\n- "Interactive charts and graphs"\n\nFeatures:\n- GitHub OAuth login\n- Commit frequency chart\n- PR merge time tracking\n- Team member leaderboard\n- Dark/light theme toggle',
        strong: '# Strong Hackathon Project\n\n## Project: "CodeReview AI"\n\nAn AI-powered code review assistant that integrates with GitHub PRs via webhooks. Uses GPT-4o-mini to analyze diffs, detect bugs, suggest improvements, and enforce style guides. Built with Next.js + FastAPI, PostgreSQL, Redis caching, full test suite (85% coverage), Dockerized, deployed on Render with GitHub Actions CI/CD.\n\nClaims:\n- "Automated code review with AI"\n- "Supports 10+ languages"\n- "CI/CD integrated"\n- "Under 500ms response time"\n\nFeatures:\n- GitHub App webhook integration\n- Per-file diff analysis\n- Style guide enforcement (ESLint, Black, Prettier)\n- Bug pattern detection\n- Auto-suggest fixes as PR comments\n- Performance regression detection\n- Dashboard with review statistics\n- Slack notification integration\n- Rate limiting and caching layer\n- Comprehensive test suite with mocks'
    };
    var ta = $('pasteText');
    if (ta) {
        ta.value = samples[level] || samples.medium;
        ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/* Animate a number from 0 to target */
function animateValue(el, start, end, duration) {
    if (!el) return;
    var range = end - start;
    var startTime = null;
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + range * eased);
        if (progress < 1) { requestAnimationFrame(step); }
    }
    requestAnimationFrame(step);
}

/* Hero scrollytelling — progressive text reveal via scroll triggers */
function initHeroScrolly() {
    var triggers = document.querySelectorAll('.scroll-trigger');
    var reveals = document.querySelectorAll('.hero-reveal');
    if (!triggers.length || !reveals.length) return;

    var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var step = parseInt(entry.target.dataset.step);
                // reveal all steps up to and including current
                reveals.forEach(function(r) {
                    if (parseInt(r.dataset.step) <= step) {
                        r.classList.add('visible');
                    }
                });
            }
        });
    }, { threshold: 0.3 });

    triggers.forEach(function(t) { obs.observe(t); });
}

document.addEventListener('DOMContentLoaded', function() {
    initScrollReveal();
    initHeroScrolly();
});
