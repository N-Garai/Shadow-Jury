var agentCards = {};
var layerContainers = {};

var LAYER_ICONS = {
    1: { icon: 'fa-file-import', color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-500/30', label: 'Intake' },
    2: { icon: 'fa-gavel', color: 'text-purple-400', bg: 'bg-purple-900/20', border: 'border-purple-500/30', label: 'Judges' },
    3: { icon: 'fa-search', color: 'text-orange-400', bg: 'bg-orange-900/20', border: 'border-orange-500/30', label: 'Critics' },
    4: { icon: 'fa-layer-group', color: 'text-green-400', bg: 'bg-green-900/20', border: 'border-green-500/30', label: 'Synthesis' },
};

var AGENT_ICONS = {
    'Doc Parser': 'fa-file-code', 'Claim Extractor': 'fa-list-check',
    'Foundry IQ Indexer': 'fa-database', 'Foundry IQ Retriever': 'fa-search',
    'Relevance Judge': 'fa-bullseye', 'Reasoning Judge': 'fa-brain',
    'Creativity Judge': 'fa-lightbulb', 'UX Judge': 'fa-palette',
    'Safety Judge': 'fa-shield-halved',
    "Devil's Advocate": 'fa-skull', 'Evidence Verifier': 'fa-check-double',
    'Competitive Analyst': 'fa-chart-line',
    'Scoring Aggregator': 'fa-calculator', 'Narrative Builder': 'fa-feather-pointed',
    'README Doctor': 'fa-stethoscope',
};

var AGENT_COLORS = {
    'Doc Parser': 'text-blue-300', 'Claim Extractor': 'text-cyan-300',
    'Foundry IQ Indexer': 'text-sky-300', 'Foundry IQ Retriever': 'text-indigo-300',
    'Relevance Judge': 'text-purple-300', 'Reasoning Judge': 'text-violet-300',
    'Creativity Judge': 'text-pink-300', 'UX Judge': 'text-teal-300',
    'Safety Judge': 'text-red-300',
    "Devil's Advocate": 'text-orange-300', 'Evidence Verifier': 'text-emerald-300',
    'Competitive Analyst': 'text-yellow-300',
    'Scoring Aggregator': 'text-green-300', 'Narrative Builder': 'text-fuchsia-300',
    'README Doctor': 'text-rose-300',
};

function connectDeliberation(pipelineId) {
    var panel = $('deliberationPanel');
    var container = $('deliberationAgents');

    panel.classList.remove('hidden');
    panel.classList.add('expanded');
    panel.classList.remove('collapsed');
    container.innerHTML = '';
    updateToggleLabel('Jury Deliberation', 'down');

    agentCards = {};
    layerContainers = {};

    var url = API_BASE + '/run/stream/' + pipelineId;

    fetch(url, { method: 'POST' }).then(function(response) {
        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        function readChunk() {
            reader.read().then(function(result) {
                if (result.done) return;
                buffer += decoder.decode(result.value, { stream: true });
                var lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('data: ')) {
                        try {
                            var event = JSON.parse(lines[i].slice(6));
                            handleDeliberationEvent(event, container);
                        } catch (e) {}
                    }
                }
                readChunk();
            }).catch(function(err) {
                console.error('SSE error:', err);
            });
        }
        readChunk();
    }).catch(function(err) {
        console.error('Deliberation SSE error:', err);
    });
}

function toggleDeliberation() {
    var panel = $('deliberationPanel');
    var isCollapsed = panel.classList.contains('collapsed');
    if (isCollapsed) {
        panel.classList.remove('collapsed');
        panel.classList.add('expanded');
        updateToggleLabel('Jury Deliberation', 'down');
    } else {
        panel.classList.add('collapsed');
        panel.classList.remove('expanded');
        updateToggleLabel('Show Agent Deliberation', 'right');
    }
}

function updateToggleLabel(text, dir) {
    var toggle = $('deliberationToggle');
    toggle.innerHTML = '<i class="fas fa-people-arrows text-accent-light mr-2"></i>' + text +
        ' <i class="fas fa-chevron-' + dir + ' text-xs ml-1"></i>';
}

function toggleAgentReasoning(agentId) {
    var block = document.getElementById('reasoning-' + agentId);
    var btn = document.getElementById('toggle-' + agentId);
    if (!block) return;
    if (block.classList.contains('hidden')) {
        block.classList.remove('hidden');
        if (btn) btn.innerHTML = '<i class="fas fa-chevron-up text-xs mr-1"></i>Hide reasoning';
    } else {
        block.classList.add('hidden');
        if (btn) btn.innerHTML = '<i class="fas fa-chevron-down text-xs mr-1"></i>Show reasoning';
    }
}

function handleDeliberationEvent(event, container) {
    var type = event.type, layer = event.layer, agent = event.agent;
    var description = event.description || '', data = event.data || {};

    if (type === 'pipeline_start') {
        addSystemMessage(container, description);
        // Show AI mode badge
        var badge = $('aiModeBadge');
        var text = $('aiModeText');
        if (description.indexOf('GPT-4o-mini') > -1) {
            badge.className = 'text-xs px-2 py-1 rounded-full bg-green-900 text-green-300';
            text.textContent = 'GPT-4o-mini';
        } else {
            badge.className = 'text-xs px-2 py-1 rounded-full bg-yellow-900 text-yellow-300';
            text.textContent = 'Rule-based (set GITHUB_TOKEN)';
        }
        badge.classList.remove('hidden');
        return;
    }
    if (type === 'error') {
        addSystemMessage(container, 'Error: ' + description, true);
        return;
    }
    if (type === 'layer_start' || type === 'layer_done') {
        handleLayerEvent(type, layer, description, container);
        return;
    }
    if (type === 'pipeline_done') {
        handleLayerEvent('layer_done', 4, description, container);
        addSystemMessage(container, 'Complete: ' + description);
        if (data && data.report) {
            setTimeout(function() {
                updateToggleLabel('Show Agent Deliberation', 'right');
                collapseDeliberation();
                displayReport(data.report);
            }, 600);
        }
        return;
    }
    if (type === 'agent_start') {
        addAgentCard(agent, layer, description, container);
        return;
    }
    if (type === 'agent_result') {
        updateAgentResult(agent, description, data);
        return;
    }
}

function collapseDeliberation() {
    var panel = $('deliberationPanel');
    panel.classList.add('collapsed');
    panel.classList.remove('expanded');
}

function handleLayerEvent(type, layer, description, container) {
    var li = LAYER_ICONS[layer] || { icon: 'fa-circle', color: 'text-gray-400', bg: 'bg-gray-800', border: 'border-gray-600', label: 'Layer ' + layer };

    if (type === 'layer_start') {
        var div = document.createElement('div');
        div.className = 'layer-header ' + li.bg + ' ' + li.border + ' border-l-4 rounded-lg px-4 py-3 mt-4 mb-2';
        div.dataset.layer = layer;
        div.innerHTML = '<div class="flex items-center gap-2"><i class="fas ' + li.icon + ' ' + li.color + '"></i><span class="text-sm font-semibold ' + li.color + '">' + li.label + '</span><span class="text-xs text-gray-500">Layer ' + layer + '</span></div><p class="text-xs text-gray-400 mt-1 thinking-text">' + description + '</p>';
        container.appendChild(div);

        var agentsDiv = document.createElement('div');
        agentsDiv.className = 'space-y-2 mt-2';
        agentsDiv.id = 'layer-agents-' + layer;
        container.appendChild(agentsDiv);
        layerContainers[layer] = agentsDiv;
    } else if (type === 'layer_done') {
        var header = container.querySelector('[data-layer="' + layer + '"]');
        if (header) {
            var msg = header.querySelector('.thinking-text');
            if (msg) msg.textContent = 'Done: ' + description;
        }
    }
}

function addAgentCard(agent, layer, description, container) {
    if (agentCards[agent]) return;

    var layerContainer = layerContainers[layer] || container;
    var iconClass = AGENT_ICONS[agent] || 'fa-robot';
    var colorClass = AGENT_COLORS[agent] || 'text-gray-300';
    var li = LAYER_ICONS[layer] || { color: 'text-gray-400', label: 'Layer ' + layer };

    var agentId = agent.replace(/\s+/g, '-').toLowerCase();

    var card = document.createElement('div');
    card.className = 'agent-card glass rounded-lg p-3 border-l-4 border-gray-700 animate-slide-up';
    card.id = 'agent-' + agentId;
    card.dataset.status = 'thinking';
    card.innerHTML =
        '<div class="flex items-start gap-3">' +
            '<div class="w-8 h-8 rounded-full ' + li.color.replace('text', 'bg').replace('300', '800') + ' flex items-center justify-center flex-shrink-0">' +
                '<i class="fas ' + iconClass + ' ' + colorClass + ' text-sm"></i>' +
            '</div>' +
            '<div class="flex-1 min-w-0">' +
                '<div class="flex items-center gap-2">' +
                    '<span class="text-sm font-medium ' + colorClass + '">' + agent + '</span>' +
                    '<span class="text-xs px-1.5 py-0.5 rounded ' + li.color.replace('text', 'bg').replace('300', '900') + ' ' + li.color + '">' + li.label + '</span>' +
                    '<span class="thinking-spinner ml-auto"><i class="fas fa-spinner fa-spin text-accent-light text-xs"></i></span>' +
                '</div>' +
                '<p class="text-xs text-gray-400 mt-1 agent-desc">' + description + '</p>' +
                '<div class="agent-result mt-2 hidden"></div>' +
                '<div id="reasoning-' + agentId + '" class="reasoning-block hidden mt-2"></div>' +
            '</div>' +
        '</div>';

    layerContainer.appendChild(card);
    agentCards[agent] = card;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateAgentResult(agent, description, data) {
    var card = agentCards[agent];
    if (!card) return;

    var agentId = agent.replace(/\s+/g, '-').toLowerCase();
    card.dataset.status = 'done';

    var spinner = card.querySelector('.thinking-spinner');
    var aiBadge = $('aiModeText');
    var mode = aiBadge ? aiBadge.textContent : '';
    var icon = mode.indexOf('GPT') > -1 ? 'fas fa-check-circle text-neon-green' : 'fas fa-check-circle text-gray-400';
    if (spinner) spinner.innerHTML = '<i class="' + icon + ' text-xs"></i> <span class="text-xs text-gray-600 ml-1">' + mode + '</span>';

    var desc = card.querySelector('.agent-desc');
    if (desc) desc.textContent = description;

    var resultDiv = card.querySelector('.agent-result');
    var reasoningDiv = card.querySelector('#reasoning-' + agentId);

    if (!resultDiv) return;
    resultDiv.classList.remove('hidden');

    var summaryHtml = '';
    var thinkingHtml = '';

    // --- Summary line (score, grade, counts) ---
    if (data.score !== undefined) {
        summaryHtml += '<span class="text-xs font-bold ' + scoreColor(data.score) + '">Score: ' + data.score + '/100</span>';
        if (data.confidence) {
            summaryHtml += ' <span class="text-xs text-gray-500">(' + Math.round(data.confidence * 100) + '% confidence)</span>';
        }
    }
    if (data.grade) {
        summaryHtml += ' <span class="text-xs font-bold ' + (data.grade === 'A' || data.grade === 'B' ? 'text-neon-green' : 'text-neon-red') + '">Grade: ' + data.grade + '</span>';
        if (data.total !== undefined) {
            summaryHtml += ' <span class="text-xs text-gray-500">(' + data.total + '/100)</span>';
        }
    }
    if (data.weaknesses && data.weaknesses.length) {
        summaryHtml += ' <span class="text-xs text-neon-red">! ' + data.weaknesses.length + ' weaknesses</span>';
    }
    if (data.suggestions && data.suggestions.length) {
        summaryHtml += ' <span class="text-xs text-neon-yellow">* ' + data.suggestions.length + ' suggestions</span>';
    }
    if (data.claims && data.claims.length) {
        summaryHtml += ' <span class="text-xs text-gray-500">Claims: ' + data.claims.length + '</span>';
    }
    if (data.verified_count !== undefined) {
        summaryHtml += ' <span class="text-xs text-gray-500">' + data.verified_count + ' verified</span>';
    }
    if (data.competition_score !== undefined) {
        summaryHtml += ' <span class="text-xs text-neon-yellow">Competition: ' + data.competition_score + '/100</span>';
    }
    if (data.chunks_indexed !== undefined) {
        summaryHtml += ' <span class="text-xs text-accent-light">' + data.chunks_indexed + ' chunks</span>';
    }

    // --- Full thinking / reasoning text ---
    var thinkingParts = [];

    // Justification is the core thinking
    if (data.justification) {
        thinkingParts.push({
            label: 'Reasoning',
            text: data.justification
        });
    }

    // Citations show evidence thought process
    if (data.citations && data.citations.length) {
        var citeTexts = data.citations.map(function(c) { return '[Source: ' + c.source + ' (score: ' + c.relevance_score + ')] ' + c.content; });
        thinkingParts.push({
            label: 'Evidence Considered',
            text: citeTexts.join('\n')
        });
    }

    // Weaknesses in detail
    if (data.weaknesses && data.weaknesses.length) {
        var wTexts = data.weaknesses.map(function(w) { return w.severity.toUpperCase() + ': ' + w.description + ' -> ' + w.suggestion; });
        thinkingParts.push({
            label: 'Weaknesses Identified',
            text: wTexts.join('\n')
        });
    }

    // Verdict
    if (data.verdict) {
        var vText = typeof data.verdict === 'string' ? data.verdict : (data.verdict.verdict || JSON.stringify(data.verdict));
        thinkingParts.push({
            label: 'Verdict',
            text: vText
        });
    }

    // Executive summary
    if (data.executive_summary) {
        thinkingParts.push({
            label: 'Executive Summary',
            text: data.executive_summary
        });
    }

    // Opportunities
    if (data.opportunities && data.opportunities.length) {
        thinkingParts.push({
            label: 'Opportunities',
            text: data.opportunities.join('\n')
        });
    }

    // Risks detail
    if (data.risks && data.risks.length) {
        var rTexts = data.risks.map(function(r) { return r.severity + ': ' + r.description; });
        thinkingParts.push({
            label: 'Risks',
            text: rTexts.join('\n')
        });
    }

    // Tech stack & features
    if (data.tech_stack && data.tech_stack.length) {
        thinkingParts.push({
            label: 'Tech Stack Analyzed',
            text: data.tech_stack.join(', ')
        });
    }

    resultDiv.innerHTML = summaryHtml;

    // Build reasoning/thinking section
    if (thinkingParts.length > 0) {
        var toggleBtn = document.createElement('button');
        toggleBtn.className = 'text-xs text-accent-light hover:text-white mt-2 transition-colors';
        toggleBtn.id = 'toggle-' + agentId;
        toggleBtn.innerHTML = '<i class="fas fa-chevron-down text-xs mr-1"></i>Show reasoning';
        toggleBtn.onclick = function() { toggleAgentReasoning(agentId); };
        resultDiv.appendChild(toggleBtn);

        for (var i = 0; i < thinkingParts.length; i++) {
            var part = thinkingParts[i];
            var block = document.createElement('div');
            block.className = 'thinking-item mt-2';
            block.innerHTML =
                '<div class="text-xs font-semibold text-gray-400 mb-1">' + part.label + '</div>' +
                '<div class="text-xs text-gray-300 bg-midnight/50 rounded p-2 leading-relaxed whitespace-pre-wrap">' + escapeHtml(part.text) + '</div>';
            reasoningDiv.appendChild(block);
        }
    }

    card.classList.add('border-opacity-100');
    card.style.borderLeftColor = '#22c55e';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function addSystemMessage(container, message, isError) {
    var div = document.createElement('div');
    div.className = 'text-xs ' + (isError ? 'text-neon-red' : 'text-gray-400') + ' py-1 px-2 animate-fade-in';
    div.textContent = message;
    container.appendChild(div);
}
