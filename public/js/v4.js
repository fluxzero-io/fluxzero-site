document.addEventListener('DOMContentLoaded', () => {
    const revealTargets = document.querySelectorAll('[data-reveal]');
    const revealDisabled = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || window.matchMedia('(max-width: 600px)').matches;

    if ('IntersectionObserver' in window && !revealDisabled) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.06, rootMargin: '0px 0px -28px 0px' });

        revealTargets.forEach((target) => observer.observe(target));
    } else {
        revealTargets.forEach((target) => target.classList.add('is-visible'));
    }

    const copyButton = document.querySelector('[data-copy-instruction]');
    const instruction = document.querySelector('#agent-instruction-text');
    const copyStatus = document.querySelector('[data-copy-status]');

    copyButton?.addEventListener('click', async () => {
        if (!instruction) return;

        try {
            await navigator.clipboard.writeText(instruction.textContent?.trim() || '');
            copyButton.textContent = 'Copied';
            if (copyStatus) copyStatus.textContent = 'Instructions copied to your clipboard.';
            window.setTimeout(() => {
                copyButton.textContent = 'Copy';
                if (copyStatus) copyStatus.textContent = '';
            }, 2200);
        } catch {
            if (copyStatus) copyStatus.textContent = 'Select the instructions and copy them manually.';
        }
    });
});
