const revealElements = Array.from(document.querySelectorAll('.rv'));
const mobileRevealQuery = window.matchMedia('(max-width: 600px)');

if (mobileRevealQuery.matches) {
    revealElements.forEach(el => el.classList.add('v'));
} else {
    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('v');
            }
        });
    }, { threshold: 0.06, rootMargin: '0px 0px -28px 0px' });

    revealElements.forEach(el => revealObserver.observe(el));
}

    function initHeroHorizonGlow() {
        const hero = document.querySelector('.hero');
        if (!hero) return;

        const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const glowProperties = [
            '--horizon-glow-opacity',
            '--horizon-glow-blue-opacity',
            '--horizon-glow-warm-opacity',
            '--horizon-glow-blur',
            '--horizon-glow-spread',
            '--horizon-glow-blue-blur',
            '--horizon-glow-blue-spread',
            '--horizon-glow-warm-blur',
            '--horizon-glow-warm-spread',
            '--horizon-glow-radial-opacity',
            '--horizon-glow-radial-warm-opacity',
            '--horizon-glow-radial-blur',
            '--horizon-glow-radial-scale',
            '--horizon-glow-rim-opacity',
            '--sunrise-core-opacity',
            '--sunrise-core-blur',
            '--sunrise-core-scale'
        ];
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        let frame = 0;

        function setGlow(progress) {
            const eased = 1 - Math.pow(1 - progress, 3);

            hero.style.setProperty('--horizon-glow-opacity', (0.38 + eased * 0.56).toFixed(3));
            hero.style.setProperty('--horizon-glow-blue-opacity', (0.035 + eased * 0.025).toFixed(3));
            hero.style.setProperty('--horizon-glow-warm-opacity', (0.46 + eased * 0.4).toFixed(3));
            hero.style.setProperty('--horizon-glow-blur', Math.round(62 + eased * 78) + 'px');
            hero.style.setProperty('--horizon-glow-spread', (3 + eased * 22).toFixed(2) + 'px');
            hero.style.setProperty('--horizon-glow-blue-blur', Math.round(74 + eased * 48) + 'px');
            hero.style.setProperty('--horizon-glow-blue-spread', (eased * 3).toFixed(2) + 'px');
            hero.style.setProperty('--horizon-glow-warm-blur', Math.round(124 + eased * 126) + 'px');
            hero.style.setProperty('--horizon-glow-warm-spread', (10 + eased * 34).toFixed(2) + 'px');
            hero.style.setProperty('--horizon-glow-radial-opacity', (0.58 + eased * 0.38).toFixed(3));
            hero.style.setProperty('--horizon-glow-radial-warm-opacity', (0.54 + eased * 0.36).toFixed(3));
            hero.style.setProperty('--horizon-glow-radial-blur', Math.round(92 + eased * 54) + 'px');
            hero.style.setProperty('--horizon-glow-radial-scale', (1.04 + eased * 0.18).toFixed(3));
            hero.style.setProperty('--horizon-glow-rim-opacity', (0.82 + eased * 0.18).toFixed(3));
            hero.style.setProperty('--sunrise-core-opacity', (0.2 + eased * 0.58).toFixed(3));
            hero.style.setProperty('--sunrise-core-blur', Math.round(36 + eased * 28) + 'px');
            hero.style.setProperty('--sunrise-core-scale', (1 + eased * 0.34).toFixed(3));
        }

        function updateGlow() {
            frame = 0;
            const scrollRange = clamp(hero.offsetHeight * 0.82, 420, 940);
            const progress = clamp(window.scrollY / scrollRange, 0, 1);
            setGlow(progress);
        }

        function requestGlowUpdate() {
            if (frame || reduceMotionQuery.matches) return;
            frame = requestAnimationFrame(updateGlow);
        }

        function syncMotionPreference() {
            if (frame) {
                cancelAnimationFrame(frame);
                frame = 0;
            }

            if (reduceMotionQuery.matches) {
                glowProperties.forEach(property => hero.style.removeProperty(property));
                return;
            }

            updateGlow();
        }

        window.addEventListener('scroll', requestGlowUpdate, { passive: true });
        window.addEventListener('resize', requestGlowUpdate, { passive: true });

        if (typeof reduceMotionQuery.addEventListener === 'function') {
            reduceMotionQuery.addEventListener('change', syncMotionPreference);
        } else if (typeof reduceMotionQuery.addListener === 'function') {
            reduceMotionQuery.addListener(syncMotionPreference);
        }

        syncMotionPreference();
    }

    function initProofStats() {
        const stats = document.querySelector('[data-proof-stats]');
        if (!stats) return;

        const counts = Array.from(stats.querySelectorAll('.proof-count'));
        if (!counts.length) return;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let hasAnimated = false;

        function setFinalValues() {
            counts.forEach(count => {
                count.textContent = count.dataset.countTo || count.textContent;
            });
        }

        function animateCounts() {
            if (hasAnimated) return;
            hasAnimated = true;

            if (reducedMotion) {
                setFinalValues();
                return;
            }

            const duration = 1450;
            const startedAt = performance.now();

            counts.forEach(count => {
                count.textContent = '0';
            });

            function tick(now) {
                const progress = Math.min((now - startedAt) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);

                counts.forEach(count => {
                    const target = Number(count.dataset.countTo || 0);
                    const decimals = Number(count.dataset.decimals || 0);
                    count.textContent = decimals > 0
                        ? (target * eased).toFixed(decimals)
                        : String(Math.round(target * eased));
                });

                if (progress < 1) {
                    requestAnimationFrame(tick);
                } else {
                    setFinalValues();
                }
            }

            requestAnimationFrame(tick);
        }

        const statsObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                animateCounts();
                statsObserver.disconnect();
            });
        }, { threshold: 0.34, rootMargin: '0px 0px -12% 0px' });

        statsObserver.observe(stats);
    }

function toggleFaq(btn) {
    const item = btn.parentElement;
    item.classList.toggle('open');
}

function initInsidePanels() {
    document.querySelectorAll('[data-inside-panel]').forEach(panel => {
        const buttons = Array.from(panel.querySelectorAll('[data-inside-toggle]'));
        const front = panel.querySelector('.system-split__face--front');
        const back = panel.querySelector('.system-split__face--back');

        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const isOpen = !panel.classList.contains('is-showing-inside');
                panel.classList.toggle('is-showing-inside', isOpen);
                buttons.forEach(toggle => toggle.setAttribute('aria-expanded', String(isOpen)));
                if (front) front.setAttribute('aria-hidden', String(isOpen));
                if (back) back.setAttribute('aria-hidden', String(!isOpen));
            });
        });
    });
}

async function initSystemStatus() {
    const link = document.querySelector('[data-status-link]');
    const dot = document.querySelector('[data-status-dot]');
    if (!link || !dot || typeof fetch !== 'function') return;

    try {
        const response = await fetch('https://fluxzero.statuspage.io/api/v2/status.json', { cache: 'no-store' });
        if (!response.ok) return;

        const payload = await response.json();
        const status = payload && payload.status ? payload.status : {};
        const indicator = ['none', 'minor', 'major', 'critical', 'maintenance'].includes(status.indicator)
            ? status.indicator
            : 'none';
        const description = status.description || 'System status';

        dot.dataset.status = indicator;
        link.setAttribute('aria-label', 'System status: ' + description);
        link.title = description;
    } catch (error) {
        /* Keep the default healthy dot if the status API is unavailable. */
    }
}

function initHeroBuilder() {
    const form = document.getElementById('hero-builder-form');
    const prompt = document.getElementById('hero-builder-prompt');
    const message = document.getElementById('hero-builder-message');
    if (!form || !prompt) return;

    let isSubmitting = false;

    function setMessage(text) {
        if (!message) return;
        message.textContent = text || '';
        message.classList.toggle('show', Boolean(text));
    }

    function savePrompt(value) {
        try {
            localStorage.setItem('fluxzeroBuildPrompt', value);
            localStorage.setItem('fluxzeroBuildPromptUpdatedAt', new Date().toISOString());
        } catch (error) {
            /* The query string still carries the prompt when storage is unavailable. */
        }
    }

    function syncPromptState() {
        const hasIdea = Boolean(prompt.value.trim());
        form.classList.toggle('has-idea', hasIdea);
        form.classList.toggle('is-writing', document.activeElement === prompt);
    }

    function navigateToBuild(url) {
        if (isSubmitting) return true;
        isSubmitting = true;
        window.location.href = url;
        return true;
    }

    prompt.addEventListener('focus', () => {
        setMessage('');
        syncPromptState();
    });

    prompt.addEventListener('blur', syncPromptState);

    prompt.addEventListener('input', () => {
        setMessage('');
        syncPromptState();
    });

    function submitIdea() {
        const value = prompt.value.trim();

        if (!value) {
            setMessage('Add your product idea first.');
            prompt.focus();
            return false;
        }

        savePrompt(value);
        return navigateToBuild(`/start-building?idea=${encodeURIComponent(value)}`);
    }

    prompt.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) {
            return;
        }

        event.preventDefault();
        submitIdea();
    });

    form.addEventListener('submit', event => {
        event.preventDefault();
        submitIdea();
    });

    syncPromptState();
}

initHeroHorizonGlow();
initProofStats();
initInsidePanels();
initSystemStatus();
initHeroBuilder();
