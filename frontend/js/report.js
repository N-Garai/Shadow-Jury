let currentReport = null;

function displayReport(report) {
    currentReport = report;
    show('reportSection');
    $('reportSection').scrollIntoView({ behavior: 'smooth' });

    $('reportProjectName').textContent = report.project_name || 'Untitled';
    $('reportGrade').textContent = 'Grade: ' + report.scorecard.final_score.grade + ' | Risk: ' + report.scorecard.final_score.risk_level + ' | ' + formatDate();
    $('reportSummary').textContent = report.narrative?.executive_summary || 'No summary available.';

    const scoreCircle = $('scoreCircle');
    const total = report.scorecard.final_score.total;
    scoreCircle.textContent = total;
    scoreCircle.className = 'w-20 h-20 rounded-full border-4 flex items-center justify-center text-2xl font-bold ' + scoreColor(total);
    const borderColors = { 'text-neon-green': 'border-neon-green', 'text-neon-yellow': 'border-neon-yellow', 'text-neon-red': 'border-neon-red' };
    for (const [cls, border] of Object.entries(borderColors)) {
        if (scoreCircle.classList.contains(cls)) { scoreCircle.classList.add(border); break; }
    }

    renderCriteria(report.scorecard.criteria || []);
    renderWeaknesses(report.scorecard.weaknesses || []);
    renderRisks(report.risk_reports || []);
    renderSuggestions(report.suggestions || []);

    showDelta(report);
}

function renderCriteria(criteria) {
    const container = $('criteriaList');
    container.innerHTML = criteria.map(function(c) {
        const barColor = scoreBarColor(c.score);
        return '<div class="glass rounded-lg p-4 animate-slide-up">' +
            '<div class="flex justify-between items-center mb-2">' +
                '<div><span class="text-sm font-medium">' + c.criterion + '</span><span class="text-xs text-gray-500 ml-2">(weight: ' + c.weight + ')</span></div>' +
                '<span class="text-sm font-bold ' + scoreColor(c.score) + '">' + c.score + '/100</span>' +
            '</div>' +
            '<div class="w-full bg-gray-800 rounded-full h-1.5 mb-2">' +
                '<div class="score-bar ' + barColor + ' h-1.5 rounded-full" style="width:' + c.score + '%"></div>' +
            '</div>' +
            '<p class="text-xs text-gray-400">' + (c.justification || 'No justification') + '</p>' +
            '<p class="text-xs text-gray-600 mt-1">Confidence: ' + Math.round(c.confidence * 100) + '%</p>' +
        '</div>';
    }).join('');
}

function renderWeaknesses(weaknesses) {
    const container = $('tabContentWeaknesses');
    if (!weaknesses.length) {
        container.innerHTML = '<div class="text-gray-500 text-sm">No weaknesses identified.</div>';
        return;
    }
    container.innerHTML = weaknesses.map(function(w) {
        var borderColor = w.severity === 'critical' ? 'border-neon-red' : w.severity === 'high' ? 'border-neon-yellow' : 'border-gray-600';
        var severityColor = w.severity === 'critical' ? 'text-neon-red' : w.severity === 'high' ? 'text-neon-yellow' : 'text-gray-400';
        return '<div class="glass rounded-lg p-4 border-l-4 ' + borderColor + ' animate-slide-up">' +
            '<div class="flex items-center gap-2 mb-1">' +
                '<span class="text-xs font-bold uppercase ' + severityColor + '">' + w.severity + '</span>' +
                '<span class="text-sm font-medium">' + w.category + '</span>' +
            '</div>' +
            '<p class="text-xs text-gray-300">' + w.description + '</p>' +
            '<p class="text-xs text-accent-light mt-1"><i class="fas fa-lightbulb mr-1"></i>' + w.suggestion + '</p>' +
        '</div>';
    }).join('');
}

function renderRisks(risks) {
    const container = $('tabContentRisks');
    if (!risks.length) {
        container.innerHTML = '<div class="text-gray-500 text-sm">No risks identified.</div>';
        return;
    }
    container.innerHTML = risks.map(function(r) {
        return '<div class="glass rounded-lg p-4 border-l-4 ' + (r.severity === 'critical' ? 'border-neon-red' : 'border-neon-yellow') + ' animate-slide-up">' +
            '<div class="flex items-center gap-2 mb-1">' +
                '<span class="text-xs font-bold uppercase ' + (r.severity === 'critical' ? 'text-neon-red' : 'text-neon-yellow') + '">' + r.severity + '</span>' +
                '<span class="text-sm font-medium">' + r.category + '</span>' +
            '</div>' +
            '<p class="text-xs text-gray-300">' + r.description + '</p>' +
            '<p class="text-xs text-accent-light mt-1"><i class="fas fa-check-circle mr-1"></i>' + r.recommendation + '</p>' +
        '</div>';
    }).join('');
}

function renderSuggestions(suggestions) {
    const container = $('tabContentSuggestions');
    if (!suggestions.length) {
        container.innerHTML = '<div class="text-gray-500 text-sm">No suggestions available.</div>';
        return;
    }
    container.innerHTML = suggestions.map(function(s) {
        return '<div class="glass rounded-lg p-4 flex items-start gap-3 animate-slide-up">' +
            '<i class="fas fa-lightbulb text-neon-yellow mt-0.5"></i>' +
            '<p class="text-sm text-gray-300">' + s + '</p>' +
        '</div>';
    }).join('');
}

function switchTab(tab, btn) {
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.add('hidden'); });
    var target = $('tabContent' + tab.charAt(0).toUpperCase() + tab.slice(1));
    if (target) target.classList.remove('hidden');
}

function downloadReport() {
    if (!currentReport) return;
    var blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'shadow-jury-report-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

function copyReport() {
    if (!currentReport) return;
    navigator.clipboard.writeText(JSON.stringify(currentReport, null, 2))
        .then(function() {
            var btn = event.target;
            btn.textContent = 'Copied!';
            setTimeout(function() { btn.innerHTML = '<i class="fas fa-copy mr-1"></i> Copy to Clipboard'; }, 2000);
        })
        .catch(function() { alert('Failed to copy to clipboard'); });
}

function exportPDF() {
    if (!currentReport) return;

    var element = document.getElementById('reportSection');
    var opt = {
        margin:       0.5,
        filename:     'shadow-jury-report-' + Date.now() + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    var btn = event.target;
    var originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Generating PDF...';
    btn.disabled = true;

    html2pdf().set(opt).from(element).save().then(function() {
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
}
