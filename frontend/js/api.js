// Set API_BASE via a script tag or default to same-origin
// For Vercel+Render split, set: <script>window.API_BASE = 'https://shadow-jury-backend.onrender.com/api'</script>
const API_BASE = window.API_BASE || (window.location.origin + '/api');

async function apiUpload(files, pasteText, githubUrl) {
    const formData = new FormData();
    if (files) {
        for (const f of files) {
            formData.append('files', f);
        }
    }
    if (pasteText) formData.append('paste_text', pasteText);
    if (githubUrl) formData.append('github_url', githubUrl);

    const resp = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
    if (!resp.ok) throw new Error(`Upload failed: ${resp.statusText}`);
    return resp.json();
}

async function apiRunPipeline(pipelineId) {
    const resp = await fetch(`${API_BASE}/run/${pipelineId}`, { method: 'POST' });
    if (!resp.ok) throw new Error(`Pipeline run failed: ${resp.statusText}`);
    return resp.json();
}

async function apiGetStatus(pipelineId) {
    const resp = await fetch(`${API_BASE}/status/${pipelineId}`);
    if (!resp.ok) throw new Error(`Status failed: ${resp.statusText}`);
    return resp.json();
}

async function apiGetReport(pipelineId) {
    const resp = await fetch(`${API_BASE}/report/${pipelineId}`);
    if (!resp.ok) throw new Error(`Report failed: ${resp.statusText}`);
    return resp.json();
}

function apiGetDownloadUrl(pipelineId) {
    return `${API_BASE}/download/${pipelineId}`;
}
