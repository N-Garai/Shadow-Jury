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
    scoreCircle.textContent = '0';
    scoreCircle.className = 'score-circle w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 flex items-center justify-center score-cinema font-bold ' + scoreColor(total);
    var borderColors = { 'text-neon-green': 'border-neon-green', 'text-neon-yellow': 'border-neon-yellow', 'text-neon-red': 'border-neon-red' };
    for (var key in borderColors) {
        if (scoreCircle.classList.contains(key)) { scoreCircle.classList.add(borderColors[key]); break; }
    }
    setTimeout(function() { animateValue(scoreCircle, 0, total, 1200); }, 100);

    /* Stagger rendering across animation frames to avoid jank */
    var criteria = report.scorecard.criteria || [];
    var weaknesses = report.scorecard.weaknesses || [];
    var risks = report.risk_reports || [];
    var suggestions = report.suggestions || [];

    requestAnimationFrame(function() {
        renderCriteria(criteria);
        requestAnimationFrame(function() {
            renderWeaknesses(weaknesses);
            requestAnimationFrame(function() {
                renderRisks(risks);
                requestAnimationFrame(function() {
                    renderSuggestions(suggestions);
                    renderRadarChart(report);
                    showDelta(report);
                });
            });
        });
    });
}

function renderRadarChart(report) {
    var canvas = $('radarChart');
    if (!canvas || !report.scorecard) return;
    var ctx = canvas.getContext('2d');
    var criteria = report.scorecard.criteria || [];
    if (!criteria.length) return;

    if (window._radarChartInstance) window._radarChartInstance.destroy();

    var labels = criteria.map(function(c) { return c.criterion; });
    var scores = criteria.map(function(c) { return c.score; });

    window._radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Score',
                data: scores,
                backgroundColor: 'rgba(124,58,237,0.15)',
                borderColor: '#a78bfa',
                borderWidth: 2,
                pointBackgroundColor: '#a78bfa',
                pointBorderColor: '#1a1a2e',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function(ctx) { return ctx.parsed.r + '/100'; } } }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { stepSize: 20, color: '#9ca3af', backdropColor: 'transparent', font: { size: 10 } },
                    grid: { color: 'rgba(124,58,237,0.1)' },
                    angleLines: { color: 'rgba(124,58,237,0.1)' },
                    pointLabels: { color: '#e2e8f0', font: { size: 12, weight: 'bold' } }
                }
            }
        }
    });
}

function renderCriteria(criteria) {
    var container = $('criteriaList');
    container.innerHTML = criteria.map(function(c) {
        return '<div class="glass-card rounded-lg p-3 sm:p-4 reveal-child">' +
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

function downloadMarkdown() {
    if (!currentReport) return;
    var r = currentReport, sc = r.scorecard || {}, fs = sc.final_score || {}, narrative = r.narrative || {}, rec = narrative.recommendation || {};

    var md = '# Shadow Jury Report\n\n';
    md += '**Project:** ' + (r.project_name || 'Untitled') + '  \n';
    md += '**Grade:** ' + (fs.grade || '--') + '  \n';
    md += '**Total Score:** ' + (fs.total || 0) + '/100  \n';
    md += '**Risk Level:** ' + (fs.risk_level || '--') + '  \n';
    md += '**Competition Score:** ' + (sc.competition_score || 0) + '/100  \n';
    md += '**Date:** ' + formatDate() + '  \n\n';

    if (narrative.executive_summary) md += '## Executive Summary\n\n' + narrative.executive_summary + '\n\n';

    md += '## Criteria Scores\n\n| Criterion | Score | Weight | Confidence |\n|---|---|---|---|\n';
    (sc.criteria || []).forEach(function(c) { md += '| ' + c.criterion + ' | ' + c.score + '/100 | ' + c.weight + ' | ' + Math.round(c.confidence * 100) + '% |\n'; });
    md += '\n';

    (sc.criteria || []).forEach(function(c) {
        md += '### ' + c.criterion + ' (' + c.score + '/100)\n\n' + (c.justification || 'No justification.') + '\n\n';
        if (c.citations && c.citations.length) {
            md += '**Evidence:**\n';
            c.citations.forEach(function(ct) { md += '- ' + ct.content + ' (source: ' + ct.source + ', relevance: ' + Math.round(ct.relevance_score * 100) + '%)\n'; });
            md += '\n';
        }
    });

    if (sc.weaknesses && sc.weaknesses.length) {
        md += '## Weaknesses\n\n';
        sc.weaknesses.forEach(function(w) { md += '### [' + w.severity.toUpperCase() + '] ' + w.category + '\n\n' + w.description + '\n\n> **Suggestion:** ' + w.suggestion + '\n\n'; });
    }

    if (r.risk_reports && r.risk_reports.length) {
        md += '## Risk Reports\n\n';
        r.risk_reports.forEach(function(risk) { md += '### ' + risk.category + ' (' + risk.severity + ')\n\n' + risk.description + '\n\n> **Recommendation:** ' + (risk.recommendation || '') + '\n\n'; });
    }

    if (r.suggestions && r.suggestions.length) { md += '## Suggestions\n\n'; r.suggestions.forEach(function(s) { md += '- ' + s + '\n'; }); md += '\n'; }

    md += '## Agent Deliberation & Thinking\n\n';
    var agentCards = document.querySelectorAll('.agent-card');
    if (agentCards.length > 0) {
        agentCards.forEach(function(card) {
            var nameEl = card.querySelector('.text-sm\\.font-medium');
            if (!nameEl) nameEl = card.querySelector('.text-sm.font-medium');
            var layerEl = card.querySelector('[class*="px-1"]');
            var resultEl = card.querySelector('.agent-result');
            var descEl = card.querySelector('.agent-desc');
            var reasoningEl = card.querySelector('[id^="reasoning-"]');
            var agentName = nameEl ? nameEl.textContent.trim() : 'Unknown Agent';
            var layerName = layerEl ? layerEl.textContent.trim() : '';
            var desc = descEl ? descEl.textContent.trim() : '';
            md += '### ' + agentName + (layerName ? ' (' + layerName + ')' : '') + '\n\n';
            if (desc) md += desc + '\n\n';
            if (resultEl) { var rt = resultEl.textContent.trim(); if (rt) md += rt + '\n\n'; }
            if (reasoningEl) {
                reasoningEl.querySelectorAll('.thinking-item').forEach(function(item) {
                    var label = item.querySelector('.text-gray-400'); var text = item.querySelector('.text-gray-300');
                    var l = label ? label.textContent.trim() : ''; var t = text ? text.textContent.trim() : '';
                    if (l && t) md += '**' + l + ':**\n\n' + t + '\n\n';
                });
            }
        });
    } else { md += '*Deliberation data not available. Run a project first to see agent thinking.*\n\n'; }

    if (rec.verdict) {
        md += '## Verdict\n\n**' + rec.verdict + '**  \nConfidence: ' + Math.round((rec.confidence || 0) * 100) + '%  \n';
        if (rec.key_action_items && rec.key_action_items.length) { md += '\n**Key Actions:**\n\n'; rec.key_action_items.forEach(function(a, i) { md += (i+1) + '. ' + a + '\n'; }); md += '\n'; }
    }

    if (r.execution_summary) md += '---\n\n*' + r.execution_summary + '*\n\n';
    md += '---\n\n*Generated by Shadow Jury — ' + formatDate() + '*\n';

    var blob = new Blob([md], { type: 'text/markdown' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'shadow-jury-report-' + Date.now() + '.md'; a.click();
    URL.revokeObjectURL(url);
}

function exportPDF() {
    if (!currentReport) return;

    var btn = event && event.target ? event.target : $('exportBtn');
    var orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Generating...';
    btn.disabled = true;

    // Build clean PDF HTML
    var html = buildPDFContent(currentReport);

    // Populate hidden container
    var container = $('pdfExportContainer');
    var content = $('pdfContent');
    content.innerHTML = html;
    container.style.display = 'block';

    if (typeof html2pdf !== 'undefined') {
        var opt = {
            margin:       0.4,
            filename:     'shadow-jury-report-' + Date.now() + '.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false, letterRendering: true },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(container).save().then(function() {
            cleanupPDF(container, content, btn, orig);
        }).catch(function() {
            fallbackPrintPDF(container, content, btn, orig);
        });
    } else {
        fallbackPrintPDF(container, content, btn, orig);
    }
}

function buildPDFContent(report) {
    var r = report;
    var sc = r.scorecard || {};
    var finalScore = sc.final_score || {};
    var narrative = r.narrative || {};
    var rec = narrative.recommendation || {};

    var html = '';

    // Header
    html += '<div style="text-align:center; margin-bottom:20px; border-bottom:2px solid #7c3aed; padding-bottom:15px;">';
    html += '<h1 style="font-size:22px; margin:0; color:#7c3aed;">Shadow Jury Report</h1>';
    html += '<p style="font-size:14px; color:#666; margin:5px 0 0;">' + escapeHtml(r.project_name || 'Untitled') + '</p>';
    html += '</div>';

    // Score Summary
    html += '<div style="margin-bottom:20px;">';
    html += '<h2 style="font-size:16px; color:#333; border-bottom:1px solid #ddd; padding-bottom:5px;">Score Summary</h2>';
    html += '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
    html += '<tr><td style="padding:4px 8px; font-weight:bold;">Grade</td><td style="padding:4px 8px;">' + (finalScore.grade || '--') + '</td></tr>';
    html += '<tr><td style="padding:4px 8px; font-weight:bold;">Total Score</td><td style="padding:4px 8px;">' + (finalScore.total || 0) + '/100</td></tr>';
    html += '<tr><td style="padding:4px 8px; font-weight:bold;">Risk Level</td><td style="padding:4px 8px;">' + (finalScore.risk_level || '--') + '</td></tr>';
    html += '<tr><td style="padding:4px 8px; font-weight:bold;">Competition Score</td><td style="padding:4px 8px;">' + (sc.competition_score || 0) + '/100</td></tr>';
    html += '</table>';
    html += '</div>';

    // Executive Summary
    if (narrative.executive_summary) {
        html += '<div style="margin-bottom:20px;">';
        html += '<h2 style="font-size:16px; color:#333; border-bottom:1px solid #ddd; padding-bottom:5px;">Executive Summary</h2>';
        html += '<p style="font-size:13px; line-height:1.5;">' + escapeHtml(narrative.executive_summary) + '</p>';
        html += '</div>';
    }

    // Criteria Scores
    html += '<div style="margin-bottom:20px;">';
    html += '<h2 style="font-size:16px; color:#333; border-bottom:1px solid #ddd; padding-bottom:5px;">Criteria Scores</h2>';
    (sc.criteria || []).forEach(function(c) {
        html += '<div style="margin-bottom:10px; border:1px solid #eee; border-radius:6px; padding:10px;">';
        html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">';
        html += '<span style="font-size:13px; font-weight:bold;">' + escapeHtml(c.criterion) + ' (weight: ' + c.weight + ')</span>';
        html += '<span style="font-size:14px; font-weight:bold; color:' + (c.score >= 60 ? '#22c55e' : c.score >= 40 ? '#eab308' : '#ef4444') + ';">' + c.score + '/100</span>';
        html += '</div>';
        // Score bar
        var pct = Math.max(0, Math.min(100, c.score));
        html += '<div style="background:#eee; height:6px; border-radius:3px; margin-bottom:5px;">';
        html += '<div style="background:' + (c.score >= 60 ? '#22c55e' : c.score >= 40 ? '#eab308' : '#ef4444') + '; height:6px; border-radius:3px; width:' + pct + '%;"></div>';
        html += '</div>';
        html += '<p style="font-size:12px; color:#555; margin:2px 0;">' + escapeHtml(c.justification || '') + '</p>';
        html += '<p style="font-size:11px; color:#999;">Confidence: ' + Math.round((c.confidence || 0) * 100) + '%</p>';
        html += '</div>';
    });
    html += '</div>';

    // Weaknesses
    if (sc.weaknesses && sc.weaknesses.length) {
        html += '<div style="margin-bottom:20px;">';
        html += '<h2 style="font-size:16px; color:#333; border-bottom:1px solid #ddd; padding-bottom:5px;">Weaknesses</h2>';
        sc.weaknesses.forEach(function(w) {
            var sevColor = w.severity === 'critical' ? '#ef4444' : w.severity === 'high' ? '#eab308' : '#999';
            html += '<div style="margin-bottom:8px; border-left:3px solid ' + sevColor + '; padding:8px 12px; background:#f9f9f9; border-radius:0 4px 4px 0;">';
            html += '<div style="font-size:11px; font-weight:bold; color:' + sevColor + '; text-transform:uppercase;">' + w.severity + '</div>';
            html += '<div style="font-size:13px; font-weight:bold; margin:2px 0;">' + escapeHtml(w.category) + '</div>';
            html += '<p style="font-size:12px; color:#555; margin:2px 0;">' + escapeHtml(w.description) + '</p>';
            html += '<p style="font-size:11px; color:#7c3aed; margin:2px 0;">Suggestion: ' + escapeHtml(w.suggestion || '') + '</p>';
            html += '</div>';
        });
        html += '</div>';
    }

    // Risk Reports
    if (r.risk_reports && r.risk_reports.length) {
        html += '<div style="margin-bottom:20px;">';
        html += '<h2 style="font-size:16px; color:#333; border-bottom:1px solid #ddd; padding-bottom:5px;">Risk Reports</h2>';
        r.risk_reports.forEach(function(risk) {
            html += '<div style="margin-bottom:8px; border-left:3px solid #eab308; padding:8px 12px; background:#f9f9f9; border-radius:0 4px 4px 0;">';
            html += '<div style="font-size:13px; font-weight:bold;">' + escapeHtml(risk.category) + ' (' + risk.severity + ')</div>';
            html += '<p style="font-size:12px; color:#555;">' + escapeHtml(risk.description) + '</p>';
            html += '<p style="font-size:11px; color:#7c3aed;">Recommendation: ' + escapeHtml(risk.recommendation || '') + '</p>';
            html += '</div>';
        });
        html += '</div>';
    }

    // Suggestions
    if (r.suggestions && r.suggestions.length) {
        html += '<div style="margin-bottom:20px;">';
        html += '<h2 style="font-size:16px; color:#333; border-bottom:1px solid #ddd; padding-bottom:5px;">Suggestions</h2>';
        html += '<ul style="font-size:12px; line-height:1.6;">';
        r.suggestions.forEach(function(s) {
            html += '<li>' + escapeHtml(s) + '</li>';
        });
        html += '</ul>';
        html += '</div>';
    }

    // Agent Deliberation / Thinking
    html += '<div style="margin-bottom:20px;">';
    html += '<h2 style="font-size:16px; color:#333; border-bottom:2px solid #7c3aed; padding-bottom:5px;">Agent Deliberation & Thinking</h2>';
    html += '<p style="font-size:11px; color:#999; margin-bottom:10px;">Full reasoning from every agent in the Shadow Jury panel</p>';

    // Extract agent cards from DOM
    var agentCards = document.querySelectorAll('.agent-card');
    if (agentCards.length > 0) {
        agentCards.forEach(function(card) {
            var nameEl = card.querySelector('.text-sm.font-medium');
            var layerEl = card.querySelector('.text-xs.px-1\\.5');
            var resultEl = card.querySelector('.agent-result');
            var reasoningEl = card.querySelector('[id^="reasoning-"]');
            var descEl = card.querySelector('.agent-desc');

            var agentName = nameEl ? nameEl.textContent.trim() : 'Unknown Agent';
            var layerName = layerEl ? layerEl.textContent.trim() : '';
            var desc = descEl ? descEl.textContent.trim() : '';

            html += '<div style="margin-bottom:12px; border:1px solid #e0e0e0; border-radius:6px; padding:10px;">';
            html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">';
            html += '<span style="font-size:14px; font-weight:bold; color:#7c3aed;">' + escapeHtml(agentName) + '</span>';
            if (layerName) html += '<span style="font-size:10px; background:#f0f0f0; padding:2px 6px; border-radius:3px; color:#666;">' + escapeHtml(layerName) + '</span>';
            html += '</div>';
            if (desc) html += '<p style="font-size:12px; color:#555; margin:2px 0 5px;">' + escapeHtml(desc) + '</p>';

            // Result summary
            if (resultEl) {
                var resultText = resultEl.textContent.trim();
                if (resultText) {
                    html += '<div style="font-size:11px; color:#333; margin-bottom:4px;">' + escapeHtml(resultText) + '</div>';
                }
            }

            // Full reasoning
            if (reasoningEl) {
                var reasoningItems = reasoningEl.querySelectorAll('.thinking-item');
                if (reasoningItems.length > 0) {
                    reasoningItems.forEach(function(item) {
                        var labelEl = item.querySelector('.text-gray-400');
                        var textEl = item.querySelector('.text-gray-300');
                        var label = labelEl ? labelEl.textContent.trim() : '';
                        var text = textEl ? textEl.textContent.trim() : '';
                        if (label && text) {
                            html += '<div style="margin:4px 0 0 8px; border-left:2px solid #7c3aed; padding-left:8px;">';
                            html += '<div style="font-size:10px; font-weight:bold; color:#7c3aed; text-transform:uppercase;">' + escapeHtml(label) + '</div>';
                            html += '<div style="font-size:11px; color:#444; white-space:pre-wrap;">' + escapeHtml(text) + '</div>';
                            html += '</div>';
                        }
                    });
                }
            }
            html += '</div>';
        });
    } else {
        html += '<p style="font-size:12px; color:#999; font-style:italic;">Deliberation data not available in this export mode. Run a project first to see agent thinking.</p>';
    }
    html += '</div>';

    // Verdict
    if (rec.verdict) {
        html += '<div style="margin-bottom:20px; border:2px solid #7c3aed; border-radius:8px; padding:12px; text-align:center;">';
        html += '<h2 style="font-size:14px; color:#7c3aed; margin:0 0 5px;">Verdict</h2>';
        html += '<p style="font-size:16px; font-weight:bold; color:' + (rec.verdict.includes('Advance') ? '#22c55e' : '#ef4444') + ';">' + escapeHtml(rec.verdict) + '</p>';
        html += '<p style="font-size:11px; color:#999;">Confidence: ' + Math.round((rec.confidence || 0) * 100) + '%</p>';
        if (rec.key_action_items && rec.key_action_items.length) {
            html += '<div style="text-align:left; margin-top:8px;">';
            html += '<div style="font-size:11px; font-weight:bold; color:#333;">Key Actions:</div>';
            rec.key_action_items.forEach(function(action, i) {
                html += '<div style="font-size:11px; color:#555; margin:2px 0;">' + (i+1) + '. ' + escapeHtml(action) + '</div>';
            });
            html += '</div>';
        }
        html += '</div>';
    }

    // Execution Summary
    if (r.execution_summary) {
        html += '<div style="margin-top:20px; border-top:1px solid #ddd; padding-top:10px;">';
        html += '<p style="font-size:11px; color:#999; font-style:italic;">' + escapeHtml(r.execution_summary) + '</p>';
        html += '</div>';
    }

    // Footer
    html += '<div style="text-align:center; margin-top:30px; border-top:1px solid #eee; padding-top:10px;">';
    html += '<p style="font-size:10px; color:#bbb;">Generated by Shadow Jury — ' + formatDate() + '</p>';
    html += '</div>';

    return html;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cleanupPDF(container, content, btn, orig) {
    content.innerHTML = '';
    container.style.display = 'none';
    if (btn && orig) {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
}

function fallbackPrintPDF(container, content, btn, orig) {
    // Show a quick-use print version
    container.style.display = 'block';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '9999';
    container.style.overflow = 'auto';
    container.style.display = 'block';
    var msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;z-index:10000;font-size:14px;';
    msg.textContent = 'Press Ctrl+P / Cmd+P then select "Save as PDF"';
    document.body.appendChild(msg);
    setTimeout(function() {
        window.print();
        msg.remove();
        cleanupPDF(container, content, btn, orig);
    }, 500);
}
