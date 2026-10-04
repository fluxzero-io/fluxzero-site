// Above-the-fold content animates in CSS from its first paint. Only prepare
// offscreen content here, so deferred JavaScript never resets visible text.
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 600px)');
const targets = document.querySelectorAll<HTMLElement>('[data-entrance]');

if (!motionQuery.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer.unobserve(entry.target);
            entry.target.removeAttribute('data-entrance-pending');
        }
    }, { threshold: 0.06, rootMargin: '0px 0px -28px 0px' });

    targets.forEach(target => {
        if (target.getBoundingClientRect().top < window.innerHeight) return;
        target.setAttribute('data-entrance-pending', '');
        observer.observe(target);
    });
    motionQuery.addEventListener('change', () => {
        if (!motionQuery.matches) return;
        observer.disconnect();
        targets.forEach(target => target.removeAttribute('data-entrance-pending'));
    });
}
