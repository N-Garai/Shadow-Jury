function showDelta(report) {
    const section = $('deltaSection');
    const container = $('deltaContent');
    section.classList.remove('hidden');

    const narrative = report.narrative || {};
    const strengths = narrative.strengths || [];
    const weaknesses = narrative.weaknesses || [];
    const opportunities = narrative.opportunities || [];
    const recommendation = narrative.recommendation || {};
    const riskReports = report.risk_reports || [];

    let html = '';

    // Recommendation
    if (recommendation.verdict) {
        html += `
            <div class="glass rounded-lg p-4 border-l-4 ${recommendation.verdict.includes('Advance') ? 'border-neon-green' : recommendation.verdict.includes('revise') ? 'border-neon-yellow' : 'border-neon-red'}">
                <div class="flex items-center gap-2">
                    <i class="fas ${recommendation.verdict.includes('Advance') ? 'fa-check-circle text-neon-green' : recommendation.verdict.includes('revise') ? 'fa-clock text-neon-yellow' : 'fa-times-circle text-neon-red'}"></i>
                    <span class="font-semibold">Verdict: ${recommendation.verdict}</span>
                    <span class="text-xs text-gray-500">(${Math.round((recommendation.confidence || 0) * 100)}% confidence)</span>
                </div>
            </div>
        `;
    }

    // Key Action Items
    if (recommendation.key_action_items && recommendation.key_action_items.length) {
        html += `
            <div class="glass rounded-lg p-4">
                <h3 class="text-sm font-semibold mb-2"><i class="fas fa-tasks text-accent-light mr-1"></i> Priority Actions</h3>
                ${recommendation.key_action_items.map((item, i) => `
                    <div class="flex items-start gap-2 text-xs text-gray-300 mb-1">
                        <span class="text-neon-yellow font-bold">${i + 1}.</span>
                        <span>${item}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Risk reports
    if (riskReports.length) {
        const critical = riskReports.filter(r => r.severity === 'critical');
        if (critical.length) {
            html += `
                <div class="glass rounded-lg p-4 border border-neon-red/30">
                    <h3 class="text-sm font-semibold text-neon-red mb-2"><i class="fas fa-exclamation-triangle mr-1"></i> Critical Risks</h3>
                    ${critical.map(r => `
                        <p class="text-xs text-gray-300 mb-1">• ${r.description}</p>
                        <p class="text-xs text-accent-light ml-3 mb-2">→ ${r.recommendation}</p>
                    `).join('')}
                </div>
            `;
        }
    }

    // Competitive score
    const compScore = report.scorecard?.competition_score;
    if (compScore !== undefined) {
        html += `
            <div class="glass rounded-lg p-4">
                <h3 class="text-sm font-semibold mb-2"><i class="fas fa-trophy text-neon-yellow mr-1"></i> Competitive Edge Score: ${Math.round(compScore)}/100</h3>
                ${(opportunities || []).map(o => `<p class="text-xs text-gray-400 mb-1">• ${o}</p>`).join('')}
            </div>
        `;
    }

    container.innerHTML = html || '<p class="text-gray-500 text-sm">No delta analysis available.</p>';
}
