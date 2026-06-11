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

function truncate(str, n = 100) {
    if (!str) return '';
    return str.length > n ? str.slice(0, n) + '...' : str;
}
