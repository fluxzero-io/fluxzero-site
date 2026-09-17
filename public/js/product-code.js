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
    const languageButtons = document.querySelectorAll('[data-code-language]');
    languageButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const language = button.dataset.codeLanguage;
            // Keep the clicked control in place when preceding examples change height.
            const top = button.getBoundingClientRect().top;
            document.querySelectorAll('[data-code-variant]').forEach((variant) => {
                variant.hidden = variant.dataset.codeVariant !== language;
            });
            languageButtons.forEach((choice) => {
                choice.setAttribute('aria-pressed', String(choice.dataset.codeLanguage === language));
            });
            document.querySelectorAll('[data-copy-code]').forEach((copy) => {
                const panel = copy.closest('.product-code-panel');
                copy.dataset.copyTitle = panel.querySelector('[data-code-variant]:not([hidden])').dataset.codeTitle;
                copy.dispatchEvent(new Event('code-language-change'));
            });
            window.scrollBy({ top: button.getBoundingClientRect().top - top, behavior: 'instant' });
        });
    });
    document.querySelectorAll('[data-copy-code]').forEach((button) => {
        const panel = button.closest('.product-code-panel');
        const code = panel?.querySelector('pre code');
        const icon = button.querySelector('i');
        const status = panel?.querySelector('[data-copy-code-status]');
        let title = button.dataset.copyTitle || 'Code';
        if (!code || !icon) return;

        let resetTimer;
        const reset = () => {
            title = button.dataset.copyTitle || 'Code';
            button.classList.remove('is-copied', 'is-error');
            button.setAttribute('aria-label', `Copy code from ${title}`);
            button.setAttribute('title', `Copy code from ${title}`);
            icon.className = 'bx bx-copy';
            if (status) status.textContent = '';
        };

        button.addEventListener('code-language-change', () => {
            window.clearTimeout(resetTimer);
            reset();
        });

        button.addEventListener('click', async () => {
            window.clearTimeout(resetTimer);
            try {
                const text = [...panel.querySelectorAll('[data-code-variant]:not([hidden]) pre code')]
                    .map((source) => source.textContent || '').join('\n\n');
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
