document.addEventListener('DOMContentLoaded', function() {
    // Theme toggle
    var html = document.documentElement;
    var toggle = $('themeToggle');

    function setTheme(dark) {
        if (dark) {
            html.classList.add('dark');
            toggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            html.classList.remove('dark');
            toggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
        localStorage.setItem('shadow-jury-theme', dark ? 'dark' : 'light');
    }

    var saved = localStorage.getItem('shadow-jury-theme');
    if (saved === 'light') setTheme(false);
    else if (saved === 'dark') setTheme(true);
    else setTheme(true); // default dark

    toggle.addEventListener('click', function() {
        setTheme(!html.classList.contains('dark'));
    });

    // GitHub URL preview
    var githubInput = $('githubUrl');
    if (githubInput) {
        githubInput.addEventListener('input', function() {
            var preview = $('githubPreview');
            var url = githubInput.value.trim();
            if (url && url.includes('github.com')) {
                preview.innerHTML = '<span class="text-xs text-green-400"><i class="fas fa-check-circle"></i> GitHub repo detected</span>';
            } else {
                preview.innerHTML = '';
            }
        });
    }
});
