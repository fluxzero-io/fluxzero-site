function copyCodeFallback(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
        copied = document.execCommand('copy');
    } finally {
        textarea.remove();
    }
    return copied;
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-copy-code]').forEach((button) => {
        const panel = button.closest('.product-code-panel');
        const code = panel?.querySelector('pre code');
        const icon = button.querySelector('i');
        const status = panel?.querySelector('[data-copy-code-status]');
        const title = button.dataset.copyTitle || 'Code';
        if (!code || !icon) return;

        let resetTimer;
        const reset = () => {
            button.classList.remove('is-copied', 'is-error');
            button.setAttribute('aria-label', `Copy code from ${title}`);
            button.setAttribute('title', `Copy code from ${title}`);
            icon.className = 'bx bx-copy';
            if (status) status.textContent = '';
        };

        button.addEventListener('click', async () => {
            window.clearTimeout(resetTimer);
            try {
                const text = code.textContent || '';
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                } else if (!copyCodeFallback(text)) {
                    throw new Error('Copy command was not available');
                }

                button.classList.remove('is-error');
                button.classList.add('is-copied');
                button.setAttribute('aria-label', `${title} copied`);
                button.setAttribute('title', `${title} copied`);
                icon.className = 'bx bx-check';
                if (status) status.textContent = `${title} copied to clipboard.`;
            } catch {
                button.classList.remove('is-copied');
                button.classList.add('is-error');
                button.setAttribute('aria-label', `Copying ${title} failed`);
                button.setAttribute('title', `Copying ${title} failed`);
                icon.className = 'bx bx-error-circle';
                if (status) status.textContent = `Could not copy ${title}. Select the code and copy it manually.`;
            }
            resetTimer = window.setTimeout(reset, 2200);
        });
    });
});
