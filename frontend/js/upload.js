let uploadedFiles = [];

function setupDropzone() {
    const dropzone = $('dropzone');
    const fileInput = $('fileInput');

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
}

function handleFiles(fileList) {
    for (const file of fileList) {
        if (!uploadedFiles.find(f => f.name === file.name && f.size === file.size)) {
            uploadedFiles.push(file);
        }
    }
    renderFileList();
}

function renderFileList() {
    const container = $('fileList');
    if (uploadedFiles.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = uploadedFiles.map((f, i) =>
        `<div class="flex items-center justify-between text-xs text-gray-400 bg-midnight rounded px-2 py-1">
            <span><i class="fas fa-file mr-1"></i>${f.name}</span>
            <button onclick="removeFile(${i})" class="text-neon-red hover:text-red-400"><i class="fas fa-times"></i></button>
        </div>`
    ).join('');
}

function removeFile(index) {
    uploadedFiles.splice(index, 1);
    renderFileList();
}

async function startAnalysis() {
    const btn = $('analyzeBtn');
    btn.disabled = true;
    show('uploadSpinner');
    show('progressSection');
    $('reportSection').classList.add('hidden');
    $('deltaSection').classList.add('hidden');
    $('progressTitle').textContent = 'Uploading files...';
    $('progressMessage').textContent = 'Sending files to Shadow Jury...';
    $('statusBadge').textContent = 'Uploading';
    $('statusBadge').className = 'text-xs px-2 py-1 rounded-full bg-yellow-900 text-yellow-300';

    try {
        const pasteText = $('pasteText').value;
        const githubUrl = $('githubUrl').value;
        const uploadResult = await apiUpload(uploadedFiles.length > 0 ? uploadedFiles : null, pasteText, githubUrl);

        $('progressTitle').textContent = 'Running Shadow Jury pipeline...';
        $('progressMessage').textContent = '13 agents evaluating your project...';
        $('statusBadge').textContent = 'Evaluating';
        $('statusBadge').className = 'text-xs px-2 py-1 rounded-full bg-blue-900 text-blue-300';

        const result = await apiRunPipeline(uploadResult.pipeline_id);

        $('progressBar').style.width = '100%';
        $('progressPercent').textContent = '100%';
        $('progressMessage').textContent = 'Evaluation complete!';
        $('statusBadge').textContent = 'Complete';
        $('statusBadge').className = 'text-xs px-2 py-1 rounded-full bg-green-900 text-green-300';

        displayReport(result.report);
    } catch (err) {
        $('progressTitle').textContent = 'Error';
        $('progressMessage').textContent = err.message;
        $('statusBadge').textContent = 'Failed';
        $('statusBadge').className = 'text-xs px-2 py-1 rounded-full bg-red-900 text-red-300';
        console.error(err);
    } finally {
        btn.disabled = false;
        hide('uploadSpinner');
    }
}

function resetAll() {
    uploadedFiles = [];
    $('fileList').innerHTML = '';
    $('pasteText').value = '';
    $('githubUrl').value = '';
    $('githubPreview').innerHTML = '';
    $('reportSection').classList.add('hidden');
    $('deltaSection').classList.add('hidden');
    $('progressSection').classList.add('hidden');
    $('progressBar').style.width = '0%';
    $('progressPercent').textContent = '0%';
    $('statusBadge').textContent = 'Ready';
    $('statusBadge').className = 'text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400';
}

document.addEventListener('DOMContentLoaded', setupDropzone);
