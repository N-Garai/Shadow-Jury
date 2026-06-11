// Pipeline is managed via the backend; this file handles progress polling
// Currently the pipeline runs synchronously in the API call.
// For async support, poll /api/status/{id} every 500ms.

let pipelinePollInterval = null;

async function pollPipeline(pipelineId) {
    if (pipelinePollInterval) clearInterval(pipelinePollInterval);

    return new Promise((resolve, reject) => {
        pipelinePollInterval = setInterval(async () => {
            try {
                const status = await apiGetStatus(pipelineId);
                const pct = Math.round(status.progress * 100);
                $('progressBar').style.width = pct + '%';
                $('progressPercent').textContent = pct + '%';
                if (status.message) $('progressMessage').textContent = status.message;

                if (status.state === 'completed') {
                    clearInterval(pipelinePollInterval);
                    pipelinePollInterval = null;
                    resolve(status);
                } else if (status.state === 'failed') {
                    clearInterval(pipelinePollInterval);
                    pipelinePollInterval = null;
                    reject(new Error(status.error || 'Pipeline failed'));
                }
            } catch (e) {
                // Polling errors are expected if pipeline finishes quickly
            }
        }, 500);
    });
}
