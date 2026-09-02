document.addEventListener('DOMContentLoaded', () => {
    const revealTargets = document.querySelectorAll(
        '.v4-benefit-card, .v4-handoff__flow article, .v4-comparison__row, .v4-proof__stats article, .agent-capability-grid article, .agent-links__grid a'
    );

    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

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
