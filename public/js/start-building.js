const BUILD_PROMPT_STORAGE_KEY = 'fluxzeroBuildPrompt';
const BUILD_READY_PROMPT_STORAGE_KEY = 'fluxzeroBuildReadyPrompt';
const CODEX_HANDOFF_STORAGE_KEY = 'fluxzeroCodexHandoff';
const FLUXZERO_SESSION_READY_KEY = 'fluxzeroSessionReady';

function readStoredPrompt() {
    try {
        return localStorage.getItem(BUILD_PROMPT_STORAGE_KEY) || '';
    } catch (error) {
        return '';
    }
}

function saveStoredPrompt(value) {
    try {
        localStorage.setItem(BUILD_PROMPT_STORAGE_KEY, value);
        localStorage.setItem('fluxzeroBuildPromptUpdatedAt', new Date().toISOString());
    } catch (error) {
        /* The form remains usable when storage is unavailable. */
    }
}

function saveBuildReadyPrompt(value) {
    const payload = {
        prompt: value,
        source: 'fluxzero-start-building',
        updatedAt: new Date().toISOString()
    };

    try {
        localStorage.setItem(BUILD_READY_PROMPT_STORAGE_KEY, value);
        localStorage.setItem(CODEX_HANDOFF_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        /* The visible prompt remains available when storage is unavailable. */
    }

    window.dispatchEvent(new CustomEvent('fluxzero:codex-prompt-ready', { detail: payload }));
}

function readPromptFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('idea') || '';
}

function hasFluxzeroSession() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('fluxzeroLogin') === 'success') {
        try {
            localStorage.setItem(FLUXZERO_SESSION_READY_KEY, 'true');
        } catch (error) {
            /* Query param is enough for this page load. */
        }
        return true;
    }

    try {
        if (localStorage.getItem(FLUXZERO_SESSION_READY_KEY) === 'true') return true;
    } catch (error) {
        /* Ignore blocked storage. */
    }

    return Boolean(window.FluxzeroSession && window.FluxzeroSession.isAuthenticated === true);
}

function buildPromptText({ idea, audience, features }) {
    const normalizedIdea = idea || 'A platform that helps...';
    const normalizedAudience = audience || '[summary]';
    const normalizedFeatures = features.length ? features : ['Feature 1', 'Feature 2', 'Feature 3'];

    return `Original idea:
${normalizedIdea}

Project brief additions:
Audience:
${normalizedAudience}

Core features:
${normalizedFeatures.map(feature => `- ${feature}`).join('\n')}

Fluxzero automatically handles:
- Project structure
- Database
- Base interface
- Deployment preparation

You stay in control of:
- Content
- Features
- Adjustments
- Launch`;
}

function initStartBuildingPage() {
    const ideaField = document.querySelector('[data-brief-idea]');
    const audienceField = document.querySelector('[data-brief-audience]');
    const featureFields = Array.from(document.querySelectorAll('[data-brief-feature]'));
    const promptPreview = document.querySelector('[data-start-prompt-preview]');
    const combinedPrompt = document.querySelector('[data-combined-prompt]');
    const copyButton = document.querySelector('[data-copy-build-prompt]');
    const copyMessage = document.querySelector('[data-copy-message]');
    const handoff = document.querySelector('[data-start-handoff]');
    const loginButton = document.querySelector('[data-login-button]');
    const codexButton = document.querySelector('[data-codex-button]');
    const handoffNextAction = document.querySelector('[data-handoff-next-action]');
    const handoffMessage = document.querySelector('[data-handoff-message]');

    if (!ideaField || !combinedPrompt) return;

    const initialPrompt = readPromptFromUrl().trim() || readStoredPrompt().trim();
    if (initialPrompt) {
        ideaField.value = initialPrompt;
        saveStoredPrompt(initialPrompt);
    }

    function getBriefData() {
        return {
            idea: ideaField.value.trim(),
            audience: audienceField ? audienceField.value.trim() : '',
            features: featureFields
                .map(field => field.value.trim())
                .filter(Boolean)
        };
    }

    function renderPrompt() {
        const data = getBriefData();
        const promptText = buildPromptText(data);
        combinedPrompt.textContent = promptText;
        saveBuildReadyPrompt(promptText);

        if (promptPreview) {
            promptPreview.textContent = data.idea || 'Your homepage idea will appear here and become the base prompt for the project brief.';
        }

        saveStoredPrompt(data.idea);
        if (copyMessage) copyMessage.textContent = '';
    }

    [ideaField, audienceField, ...featureFields].filter(Boolean).forEach(field => {
        field.addEventListener('input', renderPrompt);
    });

    if (copyButton) {
        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(combinedPrompt.textContent || '');
                if (copyMessage) copyMessage.textContent = 'Copied.';
            } catch (error) {
                if (copyMessage) copyMessage.textContent = 'Copy failed. Select the prompt manually.';
            }
        });
    }

    function setHandoffMessage(message) {
        if (!handoffMessage) return;
        handoffMessage.textContent = message || '';
        handoffMessage.classList.toggle('show', Boolean(message));
    }

    function setHandoffReady(isReady) {
        if (handoff) handoff.classList.toggle('is-login-ready', isReady);
        if (codexButton) codexButton.disabled = !isReady;

        if (loginButton) {
            loginButton.textContent = isReady ? 'Fluxzero connected' : 'Log in to Fluxzero';
            loginButton.setAttribute('aria-disabled', String(isReady));
            loginButton.tabIndex = isReady ? -1 : 0;
        }

        if (codexButton) codexButton.textContent = 'Open build tool';

        if (handoffNextAction) {
            handoffNextAction.textContent = isReady ? 'Open build tool' : 'Connect Fluxzero';
        }

        if (isReady) {
            setHandoffMessage('Fluxzero is connected. Your build-ready prompt is prepared for your coding tool.');
        }
    }

    async function openCodex() {
        const promptText = combinedPrompt.textContent || '';
        saveBuildReadyPrompt(promptText);

        const handoffPayload = {
            prompt: promptText,
            source: 'fluxzero-start-building',
            updatedAt: new Date().toISOString()
        };

        if (window.FluxzeroCodexHandoff && typeof window.FluxzeroCodexHandoff.open === 'function') {
            await window.FluxzeroCodexHandoff.open(handoffPayload);
            setHandoffMessage('Opening your build tool with the build-ready prompt.');
            return;
        }

        try {
            await navigator.clipboard.writeText(promptText);
            setHandoffMessage('Prompt prepared for your coding tool. The integration hook is ready; clipboard fallback copied the prompt.');
        } catch (error) {
            setHandoffMessage('Prompt prepared for your coding tool. The integration hook is ready for your team to connect.');
        }
    }

    if (loginButton) {
        loginButton.addEventListener('click', event => {
            if (!hasFluxzeroSession()) return;
            event.preventDefault();
        });
    }

    if (codexButton) {
        codexButton.addEventListener('click', async () => {
            if (!hasFluxzeroSession()) {
                setHandoffMessage('Connect Fluxzero first. Then your build tool becomes the main action.');
                return;
            }

            await openCodex();
        });
    }

    window.addEventListener('fluxzero:login-ready', () => {
        try {
            localStorage.setItem(FLUXZERO_SESSION_READY_KEY, 'true');
        } catch (error) {
            /* The visible state still updates. */
        }
        setHandoffReady(true);
    });

    renderPrompt();
    setHandoffReady(hasFluxzeroSession());
}

initStartBuildingPage();
