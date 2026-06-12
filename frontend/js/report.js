var currentReport = null;

function displayReport(report) {
    currentReport = report;
    show('reportSection');
    $('reportSection').scrollIntoView({ behavior: 'smooth' });

    $('reportProjectName').textContent = report.project_name || 'Untitled';
    $('reportGrade').textContent = 'Grade: ' + report.scorecard.final_score.grade + ' | Risk: ' + report.scorecard.final_score.risk_level + ' | ' + formatDate();
    $('reportSummary').textContent = report.narrative?.executive_summary || 'No summary available.';

    var scoreCircle = $('scoreCircle');
    var total = report.scorecard.final_score.total;
    scoreCircle.textContent = total;
    scoreCircle.className = 'w-20 h-20 rounded-full border-4 flex items-center justify-center text-2xl font-bold ' + scoreColor(total);
    var borderColors = { 'text-neon-green': 'border-neon-green', 'text-neon-yellow': 'border-neon-yellow', 'text-neon-red': 'border-neon-red' };
    for (var key in borderColors) {
        if (scoreCircle.classList.contains(key)) { scoreCircle.classList.add(borderColors[key]); break; }
    }

    renderCriteria(report.scorecard.criteria || []);
    renderWeaknesses(report.scorecard.weaknesses || []);
    renderRisks(report.risk_reports || []);
    renderSuggestions(report.suggestions || []);

    showDelta(report);
}

function renderCriteria(criteria) {
    var container = $('criteriaList');
    container.innerHTML = criteria.map(function(c) {
        return '<div class="glass rounded-lg p-4 animate-slide-up criterion-card">' +
            '<div class="flex justify-between items-center mb-2">' +
                '<div><span class="text-sm font-medium">' + c.criterion + '</span><span class="text-xs text-gray-500 ml-2">(weight: ' + c.weight + ')</span></div>' +
                '<span class="text-sm font-bold ' + scoreColor(c.score) + '">' + c.score + '/100</span>' +
            '</div>' +
            '<div class="w-full bg-gray-800 rounded-full h-1.5 mb-2">' +
                '<div class="score-bar ' + scoreBarColor(c.score) + ' h-1.5 rounded-full" style="width:' + c.score + '%"></div>' +
            '</div>' +
            '<p class="text-xs text-gray-400">' + (c.justification || 'No justification') + '</p>' +
            '<p class="text-xs text-gray-600 mt-1">Confidence: ' + Math.round(c.confidence * 100) + '%</p>' +
        '</div>';
    }).join('');
}

function renderWeaknesses(weaknesses) {
    var container = $('tabContentWeaknesses');
    if (!weaknesses.length) {
        container.innerHTML = '<div class="text-gray-500 text-sm">No weaknesses identified.</div>';
        return;
    }
    container.innerHTML = weaknesses.map(function(w) {
        var border = w.severity === 'critical' ? 'border-neon-red' : w.severity === 'high' ? 'border-neon-yellow' : 'border-gray-600';
        var sc = w.severity === 'critical' ? 'text-neon-red' : w.severity === 'high' ? 'text-neon-yellow' : 'text-gray-400';
        return '<div class="glass rounded-lg p-4 border-l-4 ' + border + ' animate-slide-up">' +
            '<div class="flex items-center gap-2 mb-1">' +
                '<span class="text-xs font-bold uppercase ' + sc + '">' + w.severity + '</span>' +
                '<span class="text-sm font-medium">' + w.category + '</span>' +
            '</div>' +
            '<p class="text-xs text-gray-300">' + w.description + '</p>' +
            '<p class="text-xs text-accent-light mt-1"><i class="fas fa-lightbulb mr-1"></i>' + w.suggestion + '</p>' +
        '</div>';
    }).join('');
}

function renderRisks(risks) {
    var container = $('tabContentRisks');
    if (!risks.length) {
        container.innerHTML = '<div class="text-gray-500 text-sm">No risks identified.</div>';
        return;
    }
    container.innerHTML = risks.map(function(r) {
        var border = r.severity === 'critical' ? 'border-neon-red' : 'border-neon-yellow';
        var sc = r.severity === 'critical' ? 'text-neon-red' : 'text-neon-yellow';
        return '<div class="glass rounded-lg p-4 border-l-4 ' + border + ' animate-slide-up">' +
            '<div class="flex items-center gap-2 mb-1">' +
                '<span class="text-xs font-bold uppercase ' + sc + '">' + r.severity + '</span>' +
                '<span class="text-sm font-medium">' + r.category + '</span>' +
            '</div>' +
            '<p class="text-xs text-gray-300">' + r.description + '</p>' +
            '<p class="text-xs text-accent-light mt-1"><i class="fas fa-check-circle mr-1"></i>' + r.recommendation + '</p>' +
        '</div>';
    }).join('');
}

function renderSuggestions(suggestions) {
    var container = $('tabContentSuggestions');
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
            var el = $('copyBtn') || event.target;
            el.textContent = 'Copied!';
            setTimeout(function() { el.innerHTML = '<i class="fas fa-copy mr-1"></i> Copy to Clipboard'; }, 2000);
        })
        .catch(function() { alert('Failed to copy to clipboard'); });
}

function exportPDF() {
    // Temporarily expand all deliberation content and show all tabs
    var panel = $('deliberationPanel');
    var wasCollapsed = panel.classList.contains('collapsed');
    if (wasCollapsed) {
        panel.classList.remove('collapsed');
        panel.classList.add('expanded');
    }

    // Show all tab contents for print capture
    var tabContents = document.querySelectorAll('.tab-content');
    var tabBtns = document.querySelectorAll('.tab-btn');
    var hiddenStates = [];
    tabContents.forEach(function(tc) {
        hiddenStates.push(tc.classList.contains('hidden'));
        tc.classList.remove('hidden');
    });

    if (typeof html2pdf !== 'undefined') {
        var opt = {
            margin:       0.4,
            filename:     'shadow-jury-report-' + Date.now() + '.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false, letterRendering: true },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        var btn = event && event.target ? event.target : $('exportBtn');
        var orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Generating...';
        btn.disabled = true;

        html2pdf().set(opt).from(document.body).save().then(function() {
            restorePrintState(wasCollapsed, hiddenStates, tabContents, btn, orig);
        }).catch(function() {
            // Fallback to window.print
            fallbackPrint(wasCollapsed, hiddenStates, tabContents);
        });
    } else {
        fallbackPrint(wasCollapsed, hiddenStates, tabContents);
    }
}

function fallbackPrint(wasCollapsed, hiddenStates, tabContents) {
    var msg = document.createElement('div');
    msg.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-accent text-white px-6 py-3 rounded-lg shadow-lg z-50 text-sm';
    msg.textContent = 'Use Ctrl+P / Cmd+P then select "Save as PDF"';
    document.body.appendChild(msg);
    setTimeout(function() { msg.remove(); }, 3000);
    window.print();
    restorePrintState(wasCollapsed, hiddenStates, tabContents, null, null);
}

function restorePrintState(wasCollapsed, hiddenStates, tabContents, btn, orig) {
    if (wasCollapsed) {
        var panel = $('deliberationPanel');
        panel.classList.add('collapsed');
        panel.classList.remove('expanded');
    }
    tabContents.forEach(function(tc, i) {
        if (hiddenStates[i]) tc.classList.add('hidden');
    });
    if (btn && orig) {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
}
