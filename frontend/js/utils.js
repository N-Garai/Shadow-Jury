var __SHADOW_JURY__ = {
    frozen: false,
    particleRaf: null,
    nodeRaf: null,
    scrollTicking: {}
};

function $(id) { return document.getElementById(id); }

function freezeAnimations() {
    __SHADOW_JURY__.frozen = true;
    document.documentElement.classList.add('animations-paused');
}
function thawAnimations() {
    __SHADOW_JURY__.frozen = false;
    document.documentElement.classList.remove('animations-paused');
}

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

/* Scroll reveal — bidirectional (visible on enter, hidden on leave) */
function initScrollReveal() {
    var els = document.querySelectorAll('.reveal, .reveal-fade, .reveal-scale, .reveal-stagger');
    if (!els.length) return;
    var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            } else {
                entry.target.classList.remove('visible');
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function(el) { obs.observe(el); });
}

/* Reveal items — each element independently fades in/out on scroll (bidirectional) */
function initRevealItems() {
    var items = document.querySelectorAll('.reveal-item');
    if (!items.length) return;
    var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            } else {
                entry.target.classList.remove('visible');
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -20px 0px' });
    items.forEach(function(el) { obs.observe(el); });
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

/* ===== 3D Mouse Tilt on Glass Cards ===== */
function init3DTilt() {
    var els = document.querySelectorAll('.glass-tilt');
    if (!els.length) return;
    els.forEach(function(el) {
        el.addEventListener('mousemove', function(e) {
            var rect = el.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY - rect.top;
            var cx = rect.width / 2;
            var cy = rect.height / 2;
            var rx = ((y - cy) / cy) * -6;
            var ry = ((x - cx) / cx) * 6;
            el.style.transform = 'perspective(1000px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
        });
        el.addEventListener('mouseleave', function() {
            el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
        });
    });
}

/* ===== Scroll-Driven Gradient Text ===== */
function initScrollGradient() {
    var els = document.querySelectorAll('.gradient-text');
    if (!els.length) return;
    var ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            requestAnimationFrame(function() {
                var maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
                var pct = Math.min(1, window.scrollY / maxScroll);
                var pos = pct * 100;
                els.forEach(function(el) {
                    el.style.backgroundPosition = pos + '% 50%';
                });
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
}

/* ===== Hero Scrollytelling ===== */
function initHeroScrolly() {
    var triggers = document.querySelectorAll('.scroll-trigger');
    var reveals = document.querySelectorAll('.hero-reveal');
    if (!triggers.length || !reveals.length) return;

    function recalcReveals() {
        var maxVisible = 0;
        triggers.forEach(function(t) {
            if (t.dataset._intersecting === 'true') {
                var s = parseInt(t.dataset.step);
                if (s > maxVisible) maxVisible = s;
            }
        });
        reveals.forEach(function(r) {
            var s = parseInt(r.dataset.step);
            if (s <= maxVisible) {
                r.classList.add('visible');
            } else {
                r.classList.remove('visible');
            }
        });
    }

    var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            entry.target.dataset._intersecting = entry.isIntersecting ? 'true' : 'false';
            recalcReveals();
        });
    }, { threshold: 0.3 });

    triggers.forEach(function(t) {
        t.dataset._intersecting = 'false';
        obs.observe(t);
    });

    /* Hero smooth fade-out/in based on raw scrollY (no feedback loop) */
    var hero = document.getElementById('heroSticky');
    if (!hero) return;

    var ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            requestAnimationFrame(function() {
                var scrollY = window.scrollY;
                var vh = window.innerHeight;
                var docH = document.documentElement.scrollHeight;

                /* Progress from 0 (top) to 1 (bottom of page) */
                var pct = Math.min(1, scrollY / Math.max(1, docH - vh));

                /* Start fading at 15% of page, fully invisible by 45% */
                var fadeStart = 0.15;
                var fadeEnd = 0.45;
                var heroOpacity = Math.max(0, Math.min(1, 1 - (pct - fadeStart) / (fadeEnd - fadeStart)));
                hero.style.opacity = heroOpacity;

                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
}

/* ===== Explainer Cards — scroll-progress staggered reveal ===== */
function initExplainerCards() {
    var cards = document.querySelectorAll('.explainer-card-stagger');
    var section = document.getElementById('agentExplainer');
    if (!cards.length || !section) return;

    function updateCards() {
        var rect = section.getBoundingClientRect();
        var vh = window.innerHeight;
        var totalDist = rect.height + vh;
        var scrolled = vh - rect.top;
        var progress = Math.max(0, Math.min(1, scrolled / totalDist));

        /* 4 cards: staggered thresholds with wider spacing */
        cards.forEach(function(card) {
            var idx = parseInt(card.dataset.card) || 1;
            var threshold = (idx - 1) * 0.16 + 0.02;
            if (progress >= threshold) {
                card.classList.add('visible');
            } else {
                card.classList.remove('visible');
            }
        });
    }

    /* Update on scroll via rAF */
    var ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            requestAnimationFrame(function() {
                updateCards();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    /* Also update when section enters/leaves viewport */
    var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                updateCards();
            }
        });
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
    obs.observe(section);

    /* Hide cards when upload enters viewport; restore on exit */
    var upload = document.getElementById('uploadArea');
    if (upload) {
        var hideObs = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    section.classList.add('hidden-state');
                    cards.forEach(function(c) { c.classList.remove('visible'); });
                } else {
                    section.classList.remove('hidden-state');
                    /* Recompute card visibility when upload leaves viewport */
                    requestAnimationFrame(function() {
                        updateCards();
                    });
                }
            });
        }, { threshold: 0.08 });
        hideObs.observe(upload);
    }

    updateCards();
}

/* ===== Particle Network Background ===== */
var _particleCanvas = null, _particleCtx = null, _particles = [], _particleMouse = { x: null, y: null, radius: 120 };

function initParticleNetwork() {
    var canvas = document.getElementById('particleNetwork');
    if (!canvas) return;
    _particleCanvas = canvas;
    _particleCtx = canvas.getContext('2d');
    _particles = [];
    _particleMouse = { x: null, y: null, radius: 120 };

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    var count = Math.min(50, Math.floor(window.innerWidth * window.innerHeight / 22000));

    for (var i = 0; i < count; i++) {
        _particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            r: Math.random() * 1.5 + 0.5
        });
    }

    window.addEventListener('mousemove', function(e) {
        _particleMouse.x = e.clientX;
        _particleMouse.y = e.clientY;
    }, { passive: true });
    window.addEventListener('mouseleave', function() {
        _particleMouse.x = null;
        _particleMouse.y = null;
    }, { passive: true });

    drawParticles();
}

var _particleConnCache = [];

function drawParticles() {
    if (__SHADOW_JURY__.frozen) {
        __SHADOW_JURY__.particleRaf = requestAnimationFrame(drawParticles);
        return;
    }
    var ctx = _particleCtx, canvas = _particleCanvas, particles = _particles, mouse = _particleMouse;
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var isDark = document.documentElement.classList.contains('dark');
    var color = isDark ? '148, 58, 237' : '124, 58, 237';
    var connectDist = Math.min(120, canvas.width * 0.1);

    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (mouse.x !== null && mouse.y !== null) {
            var dx = p.x - mouse.x;
            var dy = p.y - mouse.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < mouse.radius) {
                var force = (mouse.radius - dist) / mouse.radius;
                p.vx += (dx / dist || 0) * force * 0.5;
                p.vy += (dy / dist || 0) * force * 0.5;
            }
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;
    }

    /* Spatial grid for connection optimization */
    var cellSize = connectDist;
    var grid = {};
    for (var i = 0; i < particles.length; i++) {
        var px = particles[i], cx = Math.floor(px.x / cellSize), cy = Math.floor(px.y / cellSize);
        var key = cx + ',' + cy;
        if (!grid[key]) grid[key] = [];
        grid[key].push(i);
    }

    var drawn = {};
    for (var key in grid) {
        var cell = grid[key];
        var parts = key.split(',');
        var gx = parseInt(parts[0]), gy = parseInt(parts[1]);
        for (var ci = 0; ci < cell.length; ci++) {
            for (var cj = ci + 1; cj < cell.length; cj++) {
                var id = cell[ci] < cell[cj] ? cell[ci] + '-' + cell[cj] : cell[cj] + '-' + cell[ci];
                if (drawn[id]) continue;
                drawn[id] = true;
                var a = particles[cell[ci]], b = particles[cell[cj]];
                var dx = a.x - b.x, dy = a.y - b.y, dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < connectDist) {
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = 'rgba(' + color + ', ' + ((1 - dist / connectDist) * 0.35) + ')';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
            /* Check adjacent cells */
            for (var nx = -1; nx <= 1; nx++) {
                for (var ny = -1; ny <= 1; ny++) {
                    if (nx === 0 && ny === 0) continue;
                    var nk = (gx + nx) + ',' + (gy + ny);
                    var ncell = grid[nk];
                    if (!ncell) continue;
                    for (var ni = 0; ni < ncell.length; ni++) {
                        var id = cell[ci] < ncell[ni] ? cell[ci] + '-' + ncell[ni] : ncell[ni] + '-' + cell[ci];
                        if (drawn[id]) continue;
                        drawn[id] = true;
                        var a = particles[cell[ci]], b = particles[ncell[ni]];
                        var dx = a.x - b.x, dy = a.y - b.y, dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < connectDist) {
                            ctx.beginPath();
                            ctx.moveTo(a.x, a.y);
                            ctx.lineTo(b.x, b.y);
                            ctx.strokeStyle = 'rgba(' + color + ', ' + ((1 - dist / connectDist) * 0.35) + ')';
                            ctx.lineWidth = 0.5;
                            ctx.stroke();
                        }
                    }
                }
            }
        }
    }

    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + color + ', 0.5)';
        ctx.fill();
    }

    __SHADOW_JURY__.particleRaf = requestAnimationFrame(drawParticles);
}

/* ===== Agent Node Popup — JS direct hover + click control ===== */
function initAgentPopups() {
    var nodes = document.querySelectorAll('.agent-node');
    nodes.forEach(function(node) {
        var popup = node.querySelector('.agent-info-popup');
        if (!popup) return;

        function showPopup() {
            /* Hide any other open popups first */
            document.querySelectorAll('.agent-node.hover-active').forEach(function(n) {
                if (n !== node) {
                    n.classList.remove('hover-active');
                    var p = n.querySelector('.agent-info-popup');
                    if (p) p.classList.remove('show');
                }
            });
            node.classList.add('hover-active');
            popup.classList.add('show');
            /* Reset prior overrides */
            popup.style.bottom = '';
            popup.style.top = '';
            popup.style.left = '';
            popup.style.right = '';
            popup.style.transform = '';
            var pr = node.getBoundingClientRect();
            var vw = window.innerWidth;
            var vh = window.innerHeight;
            var popupW = popup.offsetWidth || 160;
            var popupH = popup.offsetHeight || 36;
            var pad = 14;

            /* Show below if too close to top */
            if (pr.top < popupH + pad) {
                popup.style.bottom = 'auto';
                popup.style.top = 'calc(100% + ' + pad + 'px)';
            }
            /* Shift left if near right edge */
            if (pr.right + popupW / 2 > vw - pad) {
                popup.style.left = 'auto';
                popup.style.right = '0';
                popup.style.transform = 'none';
            }
            /* Shift right if near left edge */
            if (pr.left - popupW / 2 < pad) {
                popup.style.left = '0';
                popup.style.right = 'auto';
                popup.style.transform = 'none';
            }
        }

        function hidePopup() {
            node.classList.remove('hover-active');
            popup.classList.remove('show');
        }

        node.addEventListener('mouseenter', showPopup);
        node.addEventListener('mouseleave', hidePopup);
        node.addEventListener('click', function(e) {
            e.stopPropagation();
            /* Toggle on click — if already shown via hover, keep it; if not, show it */
            if (popup.classList.contains('show')) {
                hidePopup();
            } else {
                showPopup();
            }
        });
    });
    /* Click anywhere outside to close any open popup */
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.agent-node')) {
            document.querySelectorAll('.agent-node.hover-active').forEach(function(n) {
                n.classList.remove('hover-active');
                var p = n.querySelector('.agent-info-popup');
                if (p) p.classList.remove('show');
            });
        }
    });
}

/* ===== Dynamic Node Network — three-body-problem orbital motion ===== */
var _nodePos = null, _nodeVel = null, _nodePaths = null, _nodeSvg = null, _nodeEls = null;
var _nodeMouseX = -1, _nodeMouseY = -1, _nodeMouseInside = false;

function initDynamicNetwork() {
    _nodeSvg = document.getElementById('agentLines');
    if (!_nodeSvg) return;

    _nodeEls = document.querySelectorAll('.agent-node');
    if (_nodeEls.length < 13) return;

    _nodePos = [
        {x:24,y:24},{x:28,y:38},{x:20,y:52},{x:26,y:66},{x:22,y:80},
        {x:76,y:24},{x:72,y:38},{x:80,y:52},{x:74,y:66},{x:78,y:80},
        {x:50,y:34},{x:50,y:54},{x:50,y:78}
    ];

    _nodeVel = [];
    for (var i = 0; i < 13; i++) {
        _nodeVel.push({ x: (Math.random() - 0.5) * 0.08, y: (Math.random() - 0.5) * 0.08 });
    }

    var conn = [
        [0,1],[1,2],[2,3],[3,4],[5,6],[6,7],[7,8],[8,9],
        [10,11],[11,12],[1,10],[6,10],[3,11],[8,11],[4,12],[9,12]
    ];

    _nodePaths = [];
    conn.forEach(function(c) {
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'agent-line');
        _nodeSvg.appendChild(path);
        _nodePaths.push({el: path, a: c[0], b: c[1]});
    });

    document.addEventListener('mousemove', function(e) {
        _nodeMouseX = (e.clientX / window.innerWidth) * 100;
        _nodeMouseY = (e.clientY / window.innerHeight) * 100;
        _nodeMouseInside = true;
    }, { passive: true });
    document.addEventListener('mouseleave', function() {
        _nodeMouseInside = false;
    }, { passive: true });

    updateNodeDOM();
    tickNodes();
}

function updateNodeDOM() {
    for (var i = 0; i < _nodeEls.length; i++) {
        _nodeEls[i].style.setProperty('--nx', _nodePos[i].x + '%');
        _nodeEls[i].style.setProperty('--ny', _nodePos[i].y + '%');
    }
    for (var j = 0; j < _nodePaths.length; j++) {
        var p = _nodePaths[j];
        var a = _nodePos[p.a], b = _nodePos[p.b];
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + 2;
        p.el.setAttribute('d', 'M' + a.x + ',' + a.y + ' Q' + mx + ',' + my + ' ' + b.x + ',' + b.y);
    }
}

function tickNodes() {
    if (__SHADOW_JURY__.frozen) {
        __SHADOW_JURY__.nodeRaf = requestAnimationFrame(tickNodes);
        return;
    }
    var pos = _nodePos, vel = _nodeVel;
    if (!pos) return;

    var G = 0.00035, damping = 0.998, centerPull = 0.0006, repulsion = 0.012, minDist = 8;
    var forces = [];
    for (var i = 0; i < pos.length; i++) forces.push({x:0, y:0});

    for (var i = 0; i < pos.length; i++) {
        for (var j = i + 1; j < pos.length; j++) {
            var dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
            var dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
            var gForce = G / (dist * dist + 0.5);
            var rForce = dist < minDist ? repulsion * (minDist - dist) / minDist : 0;
            var total = gForce - rForce;
            var fx = total * dx / dist, fy = total * dy / dist;
            forces[i].x += fx; forces[i].y += fy;
            forces[j].x -= fx; forces[j].y -= fy;
        }
    }

    for (var i = 0; i < pos.length; i++) {
        var cx = 50 - pos[i].x, cy = 48 - pos[i].y;
        var cDist = Math.sqrt(cx * cx + cy * cy) + 1;
        forces[i].x += centerPull * cx / cDist;
        forces[i].y += centerPull * cy / cDist;

        if (_nodeMouseInside) {
            var mdx = pos[i].x - _nodeMouseX, mdy = pos[i].y - _nodeMouseY;
            var mDist = Math.sqrt(mdx * mdx + mdy * mdy) + 1;
            if (mDist < 20) {
                var mForce = 0.003 / (mDist * 0.5);
                forces[i].x += mForce * mdx / mDist;
                forces[i].y += mForce * mdy / mDist;
            }
        }

        vel[i].x = (vel[i].x + forces[i].x) * damping;
        vel[i].y = (vel[i].y + forces[i].y) * damping;
        pos[i].x += vel[i].x;
        pos[i].y += vel[i].y;

        if (pos[i].x < 6) { pos[i].x = 6; vel[i].x *= -0.5; }
        if (pos[i].x > 94) { pos[i].x = 94; vel[i].x *= -0.5; }
        if (pos[i].y < 8) { pos[i].y = 8; vel[i].y *= -0.5; }
        if (pos[i].y > 90) { pos[i].y = 90; vel[i].y *= -0.5; }
    }

    /* Only update DOM every 2nd frame — reduces layout thrash */
    if (Math.random() > 0.5) updateNodeDOM();

    __SHADOW_JURY__.nodeRaf = requestAnimationFrame(tickNodes);
}

document.addEventListener('DOMContentLoaded', function() {
    initScrollReveal();
    initRevealItems();
    initHeroScrolly();
    init3DTilt();
    initScrollGradient();
    initExplainerCards();
    initParticleNetwork();
    initAgentPopups();
    initDynamicNetwork();
});
