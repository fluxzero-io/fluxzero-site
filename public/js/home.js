const o=new IntersectionObserver(e=>e.forEach(x=>{if(x.isIntersecting)x.target.classList.add('v')}),{threshold:0.06,rootMargin:'0px 0px -28px 0px'});
document.querySelectorAll('.rv').forEach(el=>o.observe(el));

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

function toggleAdvanced() {
    const panel = document.getElementById('gen-advanced');
    const toggle = document.getElementById('gen-toggle');
    if (!panel || !toggle) return;
    const isOpen = panel.classList.toggle('show');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
}

function selectPill(el) {
    const pills = el.parentElement.querySelectorAll('.gen-pill');
    pills.forEach(p => p.classList.remove('active'));
    el.classList.add('active');

    if (el.parentElement.id === 'gen-lang') {
        const language = getActivePillValue('gen-lang').toLowerCase();
        const template = getProjectGeneratorCore().templateForLanguage(language);
        setActivePill('gen-build', getProjectGeneratorCore().defaultBuildToolForTemplate(template));
    }
}

function toggleFaq(btn) {
    const item = btn.parentElement;
    item.classList.toggle('open');
}

function getProjectGeneratorCore() {
    return window.FluxzeroProjectGenerator;
}

function getGeneratorField(id) {
    return document.getElementById(id);
}

function getActivePillValue(groupId) {
    const active = document.querySelector(`#${groupId} .gen-pill.active`);
    return active ? active.textContent.trim() : '';
}

function setActivePill(groupId, value) {
    const pills = document.querySelectorAll(`#${groupId} .gen-pill`);
    pills.forEach(pill => {
        pill.classList.toggle('active', pill.textContent.trim().toLowerCase() === value.toLowerCase());
    });
}

function setGeneratorFieldError(field, message) {
    const error = getGeneratorField(`gen-${field}-error`);
    const input = getGeneratorField(field === 'name' ? 'gen-name' : `gen-${field}`);
    if (error) {
        error.textContent = message || '';
        error.classList.toggle('show', Boolean(message));
    }
    if (input) {
        input.classList.toggle('has-error', Boolean(message));
    }
}

function setGeneratorMessage(message, type = 'error') {
    const el = getGeneratorField('gen-message');
    if (!el) return;
    el.textContent = message || '';
    el.dataset.type = type;
    el.classList.toggle('show', Boolean(message));
}

function setGeneratorLoading(isLoading) {
    const button = getGeneratorField('gen-submit');
    const icon = getGeneratorField('gen-btn-icon');
    const text = getGeneratorField('gen-btn-text');
    if (!button || !icon || !text) return;

    button.disabled = isLoading;
    button.classList.toggle('is-loading', isLoading);
    icon.textContent = isLoading ? '↻' : '↓';
    text.textContent = isLoading ? 'Generating...' : 'Generate app';
}

function setGeneratorSuccess() {
    const icon = getGeneratorField('gen-btn-icon');
    const text = getGeneratorField('gen-btn-text');
    if (icon) icon.textContent = '✓';
    if (text) text.textContent = 'Downloaded';
    setTimeout(() => setGeneratorLoading(false), 2000);
}

function getHomeGeneratorData() {
    const core = getProjectGeneratorCore();
    const language = getActivePillValue('gen-lang').toLowerCase() || 'java';
    const selectedTemplate = core.templateForLanguage(language);

    return {
        projectName: getGeneratorField('gen-name')?.value.trim() || '',
        groupId: getGeneratorField('gen-group')?.value.trim() || '',
        artifactId: getGeneratorField('gen-artifact')?.value.trim() || '',
        selectedTemplate,
        buildTool: (getActivePillValue('gen-build').toLowerCase() || core.defaultBuildToolForTemplate(selectedTemplate))
    };
}

function showHomeGeneratorValidation(errors) {
    setGeneratorFieldError('name', errors.projectName);
    setGeneratorFieldError('group', errors.groupId);
    setGeneratorFieldError('artifact', errors.artifactId);
}

function validateHomeGenerator() {
    const core = getProjectGeneratorCore();
    if (!core) return false;
    const data = getHomeGeneratorData();
    const errors = core.validateAll(data);
    showHomeGeneratorValidation(errors);
    return !core.hasValidationErrors(errors);
}

async function generateProject() {
    const core = getProjectGeneratorCore();
    if (!core) {
        setGeneratorMessage('The project generator is still loading. Please try again.', 'error');
        return;
    }

    const data = getHomeGeneratorData();
    const missingName = !data.projectName;
    const missingArtifact = !data.artifactId;

    setGeneratorFieldError('name', missingName ? 'Project name is required' : null);
    setGeneratorFieldError('artifact', missingArtifact ? 'Artifact ID is required' : null);

    if (missingName || missingArtifact || !data.selectedTemplate) {
        setGeneratorMessage('Please fill in all required fields', 'error');
        return;
    }

    const errors = core.validateAll(data);
    showHomeGeneratorValidation(errors);

    if (core.hasValidationErrors(errors)) {
        setGeneratorMessage(core.firstValidationError(errors), 'error');
        return;
    }

    setGeneratorLoading(true);
    setGeneratorMessage('', 'error');

    try {
        await core.downloadProject(data);
        setGeneratorMessage('Project downloaded successfully!', 'success');
        setGeneratorSuccess();
    } catch (error) {
        setGeneratorLoading(false);
        setGeneratorMessage('Failed to generate project. Please try again some time later.', 'error');
        console.error('Project generation error:', error);
    }
}

function initHomeGenerator() {
    const core = getProjectGeneratorCore();
    const name = getGeneratorField('gen-name');
    const group = getGeneratorField('gen-group');
    const artifact = getGeneratorField('gen-artifact');
    if (!core || !name || !group || !artifact) return;

    function updateArtifactFromName() {
        if (artifact.dataset.manuallyEdited === 'true') return;
        artifact.value = core.convertToArtifactId(name.value);
    }

    name.addEventListener('input', () => {
        updateArtifactFromName();
        validateHomeGenerator();
        setGeneratorMessage('', 'error');
    });

    group.addEventListener('input', () => {
        validateHomeGenerator();
        setGeneratorMessage('', 'error');
    });

    artifact.addEventListener('input', () => {
        artifact.dataset.manuallyEdited = 'true';
        validateHomeGenerator();
        setGeneratorMessage('', 'error');
    });

    setActivePill('gen-build', core.defaultBuildToolForTemplate(core.templateForLanguage('java')));
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

initHeroHorizonGlow();
initProofStats();
initInsidePanels();
initSystemStatus();
initHomeGenerator();
