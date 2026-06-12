let agentCards = {};
let layerContainers = {};

const LAYER_ICONS = {
    1: { icon: 'fa-file-import', color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-500/30', label: 'Intake' },
    2: { icon: 'fa-gavel', color: 'text-purple-400', bg: 'bg-purple-900/20', border: 'border-purple-500/30', label: 'Judges' },
    3: { icon: 'fa-search', color: 'text-orange-400', bg: 'bg-orange-900/20', border: 'border-orange-500/30', label: 'Critics' },
    4: { icon: 'fa-layer-group', color: 'text-green-400', bg: 'bg-green-900/20', border: 'border-green-500/30', label: 'Synthesis' },
};

const AGENT_ICONS = {
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

const AGENT_COLORS = {
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
    const panel = $('deliberationPanel');
    const container = $('deliberationAgents');
    const toggle = $('deliberationToggle');
    const chevron = $('deliberationChevron');

    panel.classList.remove('hidden');
    panel.classList.add('expanded');
    panel.classList.remove('collapsed');
    container.innerHTML = '';
    toggle.innerHTML = 'Jury Deliberation <i id="deliberationChevron" class="fas fa-chevron-down text-xs ml-1"></i>';
    chevron.className = 'fas fa-chevron-down text-xs ml-1';

    agentCards = {};
    layerContainers = {};

    const url = `${API_BASE}/run/stream/${pipelineId}`;

    fetch(url, { method: 'POST' }).then(async (response) => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const event = JSON.parse(line.slice(6));
                        handleDeliberationEvent(event, container);
                    } catch (e) {
                        // skip malformed events
                    }
                }
            }
        }
    }).catch((err) => {
        console.error('Deliberation SSE error:', err);
    });
}

function toggleDeliberation() {
    const panel = $('deliberationPanel');
    const chevron = $('deliberationChevron');
    const isCollapsed = panel.classList.contains('collapsed');
    if (isCollapsed) {
        panel.classList.remove('collapsed');
        panel.classList.add('expanded');
        chevron.className = 'fas fa-chevron-down text-xs ml-1';
    } else {
        panel.classList.add('collapsed');
        panel.classList.remove('expanded');
        chevron.className = 'fas fa-chevron-right text-xs ml-1';
    }
}

function handleDeliberationEvent(event, container) {
    const { type, layer, agent, description, data } = event;

    if (type === 'pipeline_start') {
        addSystemMessage(container, 'Shadow Jury convened -- 13 agents preparing for deliberation');
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
            setTimeout(() => {
                $('deliberationToggle').innerHTML = 'Show Agent Deliberation <i id="deliberationChevron" class="fas fa-chevron-right text-xs ml-1"></i>';
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
    const panel = $('deliberationPanel');
    panel.classList.add('collapsed');
    panel.classList.remove('expanded');
}

function handleLayerEvent(type, layer, description, container) {
    const layerInfo = LAYER_ICONS[layer] || { icon: 'fa-circle', color: 'text-gray-400', bg: 'bg-gray-800', border: 'border-gray-600', label: 'Layer ' + layer };

    if (type === 'layer_start') {
        const div = document.createElement('div');
        div.className = 'layer-header ' + layerInfo.bg + ' ' + layerInfo.border + ' border-l-4 rounded-lg px-4 py-3 mt-4 mb-2';
        div.dataset.layer = layer;
        div.innerHTML = '<div class="flex items-center gap-2"><i class="fas ' + layerInfo.icon + ' ' + layerInfo.color + '"></i><span class="text-sm font-semibold ' + layerInfo.color + '">' + layerInfo.label + '</span><span class="text-xs text-gray-500">Layer ' + layer + '</span></div><p class="text-xs text-gray-400 mt-1">' + description + '</p>';
        container.appendChild(div);

        const agentsDiv = document.createElement('div');
        agentsDiv.className = 'space-y-2 mt-2';
        agentsDiv.id = 'layer-agents-' + layer;
        container.appendChild(agentsDiv);
        layerContainers[layer] = agentsDiv;
    } else if (type === 'layer_done') {
        const header = container.querySelector('[data-layer="' + layer + '"]');
        if (header) {
            const msg = header.querySelector('p');
            if (msg) msg.textContent = 'Done: ' + description;
        }
    }
}

function addAgentCard(agent, layer, description, container) {
    if (agentCards[agent]) return;

    const layerContainer = layerContainers[layer] || container;
    const iconClass = AGENT_ICONS[agent] || 'fa-robot';
    const colorClass = AGENT_COLORS[agent] || 'text-gray-300';
    const layerInfo = LAYER_ICONS[layer] || { color: 'text-gray-400' };

    const card = document.createElement('div');
    card.className = 'agent-card glass rounded-lg p-3 border-l-4 border-gray-700 animate-slide-up';
    card.id = 'agent-' + agent.replace(/\s+/g, '-').toLowerCase();
    card.dataset.status = 'thinking';
    card.innerHTML =
        '<div class="flex items-start gap-3">' +
            '<div class="w-8 h-8 rounded-full ' + layerInfo.color.replace('text', 'bg').replace('300', '800') + ' flex items-center justify-center flex-shrink-0">' +
                '<i class="fas ' + iconClass + ' ' + colorClass + ' text-sm"></i>' +
            '</div>' +
            '<div class="flex-1 min-w-0">' +
                '<div class="flex items-center gap-2">' +
                    '<span class="text-sm font-medium ' + colorClass + '">' + agent + '</span>' +
                    '<span class="text-xs px-1.5 py-0.5 rounded ' + layerInfo.color.replace('text', 'bg').replace('300', '900') + ' ' + layerInfo.color + '">' + layerInfo.label + '</span>' +
                    '<span class="thinking-spinner ml-auto"><i class="fas fa-spinner fa-spin text-accent-light text-xs"></i></span>' +
                '</div>' +
                '<p class="text-xs text-gray-400 mt-1 agent-desc">' + description + '</p>' +
                '<div class="agent-result mt-2 hidden"></div>' +
            '</div>' +
        '</div>';

    layerContainer.appendChild(card);
    agentCards[agent] = card;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateAgentResult(agent, description, data) {
    const card = agentCards[agent];
    if (!card) return;

    card.dataset.status = 'done';
    const spinner = card.querySelector('.thinking-spinner');
    if (spinner) spinner.innerHTML = '<i class="fas fa-check-circle text-neon-green text-xs"></i>';

    const desc = card.querySelector('.agent-desc');
    if (desc) desc.textContent = description;

    const resultDiv = card.querySelector('.agent-result');
    if (resultDiv && data) {
        resultDiv.classList.remove('hidden');
        let html = '';

        if (data.score !== undefined) {
            const sc = scoreColor(data.score);
            html += '<span class="text-xs font-bold ' + sc + '">Score: ' + data.score + '/100</span>';
            if (data.confidence) {
                html += ' <span class="text-xs text-gray-500">(' + Math.round(data.confidence * 100) + '% confidence)</span>';
            }
        }

        if (data.justification) {
            html += '<p class="text-xs text-gray-500 mt-1">' + data.justification + '</p>';
        }

        if (data.grade) {
            html += '<span class="text-xs font-bold ' + (data.grade === 'A' || data.grade === 'B' ? 'text-neon-green' : 'text-neon-red') + '">Grade: ' + data.grade + '</span>';
            if (data.total !== undefined) {
                html += ' <span class="text-xs text-gray-500">(' + data.total + '/100)</span>';
            }
        }

        if (data.weaknesses && data.weaknesses.length) {
            html += '<div class="mt-1"><span class="text-xs text-neon-red">! ' + data.weaknesses.length + ' weaknesses found</span></div>';
        }

        if (data.suggestions && data.suggestions.length) {
            html += '<div class="mt-1"><span class="text-xs text-neon-yellow">* ' + data.suggestions.length + ' suggestions</span></div>';
        }

        if (data.claims && data.claims.length) {
            html += '<div class="mt-1 text-xs text-gray-500">Claims: ' + data.claims.length + ', Features: ' + (data.features ? data.features.length : '?') + '</div>';
        }

        if (data.verified_count !== undefined) {
            html += '<div class="mt-1 text-xs text-gray-500">' + data.verified_count + ' verified, ' + data.flagged_count + ' flagged</div>';
        }

        if (data.executive_summary) {
            html += '<p class="text-xs text-gray-500 mt-1">' + data.executive_summary.slice(0, 200) + '</p>';
        }

        if (data.verdict) {
            const verdictText = data.verdict.verdict || data.verdict;
            html += '<div class="mt-1"><span class="text-xs font-bold ' + (verdictText.includes('Advance') ? 'text-neon-green' : 'text-neon-red') + '">' + verdictText + '</span></div>';
        }

        if (data.citations && data.citations.length) {
            html += '<div class="mt-1"><span class="text-xs text-accent-light">' + data.citations.length + ' evidence citations</span></div>';
        }

        if (data.competition_score !== undefined) {
            html += '<div class="mt-1"><span class="text-xs text-neon-yellow">Competition edge: ' + data.competition_score + '/100</span></div>';
        }

        if (data.chunks_indexed !== undefined) {
            html += '<div class="mt-1"><span class="text-xs text-accent-light">' + data.chunks_indexed + ' chunks indexed</span></div>';
        }

        if (data.tech_stack && data.tech_stack.length) {
            html += '<div class="mt-1 text-xs text-gray-500">Tech: ' + data.tech_stack.join(', ') + '</div>';
        }

        resultDiv.innerHTML = html;
    }

    card.classList.add('border-opacity-100');
    card.style.borderLeftColor = '#22c55e';
}

function addSystemMessage(container, message, isError) {
    var div = document.createElement('div');
    div.className = 'text-xs ' + (isError ? 'text-neon-red' : 'text-gray-400') + ' py-1 px-2 animate-fade-in';
    div.textContent = message;
    container.appendChild(div);
}
