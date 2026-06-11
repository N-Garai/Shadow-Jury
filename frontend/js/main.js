document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle
    const themeToggle = $('themeToggle');
    themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        themeToggle.innerHTML = document.documentElement.classList.contains('dark')
            ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    });

    // GitHub URL preview (basic)
    const githubInput = $('githubUrl');
    githubInput.addEventListener('input', () => {
        const preview = $('githubPreview');
        const url = githubInput.value.trim();
        if (url && url.includes('github.com')) {
            preview.innerHTML = `<span class="text-xs text-green-400"><i class="fas fa-check-circle"></i> GitHub repo detected</span>`;
        } else {
            preview.innerHTML = '';
        }
    });
});
