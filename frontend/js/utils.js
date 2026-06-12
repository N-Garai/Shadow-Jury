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

document.addEventListener('DOMContentLoaded', initScrollReveal);
